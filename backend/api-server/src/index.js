require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const WebSocket = require('ws');

const logger = require('./utils/logger');
const { initializeRedis } = require('./utils/redis');
const { initializeCasperClient } = require('./services/casper-client');
const { startPriceUpdateService } = require('./services/price-updater');

// Import routes
const marketsRouter = require('./routes/markets');
const positionsRouter = require('./routes/positions');
const liquidityRouter = require('./routes/liquidity');
const governanceRouter = require('./routes/governance');
const stakingRouter = require('./routes/staking');
const statsRouter = require('./routes/stats');
const socialRouter = require('./routes/social');

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/markets', marketsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/liquidity', liquidityRouter);
app.use('/api/governance', governanceRouter);
app.use('/api/staking', stakingRouter);
app.use('/api/stats', statsRouter);
app.use('/api/social', socialRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize Redis
    await initializeRedis();
    logger.info('✓ Redis connected');

    // Initialize Casper client
    await initializeCasperClient();
    logger.info('✓ Casper client initialized');

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start HTTP server
async function startServer() {
  await initializeServices();

  const server = createServer(app);

  server.listen(PORT, () => {
    logger.info(`🚀 API Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Casper Node: ${process.env.CASPER_NODE_URL}`);
  });

  return server;
}

// Start WebSocket server
function startWebSocketServer() {
  const wss = new WebSocket.Server({ port: WS_PORT });

  logger.info(`🔌 WebSocket server running on port ${WS_PORT}`);

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info(`WebSocket client connected: ${clientIp}`);

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to RWperp WebSocket server',
      timestamp: new Date().toISOString()
    }));

    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        // Handle subscription requests
        if (data.type === 'subscribe') {
          ws.subscriptions = ws.subscriptions || new Set();
          if (data.channel) {
            ws.subscriptions.add(data.channel);
            ws.send(JSON.stringify({
              type: 'subscribed',
              channel: data.channel,
              timestamp: new Date().toISOString()
            }));
          }
        }

        if (data.type === 'unsubscribe') {
          if (ws.subscriptions && data.channel) {
            ws.subscriptions.delete(data.channel);
            ws.send(JSON.stringify({
              type: 'unsubscribed',
              channel: data.channel,
              timestamp: new Date().toISOString()
            }));
          }
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      logger.info(`WebSocket client disconnected: ${clientIp}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Ping-pong heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Store wss globally for broadcasting
  global.wss = wss;

  return wss;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start both servers
(async () => {
  try {
    await startServer();
    startWebSocketServer();

    // Start price update service
    startPriceUpdateService();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = app;
