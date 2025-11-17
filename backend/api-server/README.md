# RWperp API Server

REST API and WebSocket server for the RWperp platform - Real World Asset Prediction Market on Casper Network.

## Features

- 📊 **REST API** - Complete HTTP API for markets, positions, liquidity, governance, and staking
- 🔌 **WebSocket** - Real-time price updates, market updates, and position updates
- ⚡ **Redis Caching** - High-performance caching layer for frequently accessed data
- 🔗 **Casper Integration** - Direct integration with Casper blockchain via casper-js-sdk
- 🛡️ **Security** - Rate limiting, CORS, helmet, and comprehensive error handling
- 📝 **Logging** - Winston-based logging with file rotation

## Prerequisites

- Node.js 16+ and npm
- Redis server running
- Casper Network RPC node access
- Deployed RWperp smart contracts

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env` file:

```bash
# Server
PORT=3001
NODE_ENV=development

# Casper Network
CASPER_NODE_URL=http://localhost:11101/rpc
CASPER_NETWORK_NAME=casper-test

# Contract Addresses (update after deployment)
VAULT_CONTRACT_HASH=hash-xxxxx
POSITION_MANAGER_CONTRACT_HASH=hash-xxxxx
# ... etc

# Redis
REDIS_URL=redis://localhost:6379

# WebSocket
WS_PORT=3002
```

## Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on:
- **REST API**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3002`

## API Endpoints

### Markets

#### GET /api/markets
Get all available markets

**Query Parameters:**
- `status` (optional) - Filter by status: `active`, `settled`, `pending`
- `asset` (optional) - Filter by asset name
- `sortBy` (optional) - Sort by: `volume`, `change`

**Response:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": 1,
      "asset": "Gold",
      "assetType": 0,
      "currentPrice": 2050.25,
      "priceChange": 1.25,
      "volume24h": 1500000,
      "openInterest": 5000000,
      "status": "active"
    }
  ]
}
```

#### GET /api/markets/:id
Get specific market details

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "asset": "Gold",
    "currentPrice": 2050.25,
    "startPrice": 2025.50,
    "settlementTime": 1700000000,
    "maxLeverage": 10,
    "tradingFee": 0.002
  }
}
```

#### GET /api/markets/:id/history
Get market price history

**Query Parameters:**
- `interval` - Time interval: `1h`, `4h`, `1d`
- `limit` - Number of data points (default: 100)

#### GET /api/markets/:id/stats
Get market statistics

### Positions

#### GET /api/positions/:address
Get all positions for a user

**Query Parameters:**
- `status` (optional) - Filter by status: `open`, `closed`, `liquidated`

**Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "count": 2,
  "data": [
    {
      "id": "pos_123",
      "marketId": 1,
      "asset": "Gold",
      "isLong": true,
      "entryPrice": 2000,
      "currentPrice": 2050,
      "size": 1000,
      "collateral": 100,
      "leverage": 10,
      "pnl": 50,
      "pnlPercentage": 5.0
    }
  ],
  "summary": {
    "totalPositions": 2,
    "totalCollateral": 200,
    "totalPnl": 75
  }
}
```

#### GET /api/positions/:address/:positionId
Get specific position details

#### GET /api/positions/:address/history
Get position history for a user

### Liquidity

#### GET /api/liquidity/pool
Get liquidity pool statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLiquidity": 10000000,
    "totalLpTokens": 9500000,
    "lpTokenPrice": 1.0526,
    "totalFeesEarned": 50000,
    "apy": 45.5,
    "utilizationRate": 35
  }
}
```

#### GET /api/liquidity/:address
Get LP info for a user

**Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "data": {
    "lpTokens": 10000,
    "depositedAmount": 9500,
    "currentValue": 10526,
    "profitLoss": 1026,
    "profitLossPercentage": 10.8,
    "feesEarned": 526
  }
}
```

#### GET /api/liquidity/pool/history
Get liquidity pool history

### Governance

#### GET /api/governance/proposals
Get all governance proposals

**Query Parameters:**
- `status` (optional) - Filter by: `active`, `passed`, `rejected`, `pending`

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "title": "Add Platinum Market",
      "description": "...",
      "proposalType": "AddMarket",
      "votesFor": 3500000,
      "votesAgainst": 250000,
      "quorumPercentage": 37.5,
      "status": "active",
      "endTime": 1700000000
    }
  ],
  "summary": {
    "total": 3,
    "active": 1,
    "passed": 1,
    "rejected": 1
  }
}
```

#### GET /api/governance/proposals/:id
Get specific proposal details

#### GET /api/governance/:address/voting-power
Get voting power for a user

**Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "data": {
    "stakedAmount": 10000,
    "votingPower": 15000,
    "multiplier": 1.5,
    "lockPeriod": 2592000,
    "unlockTime": 1700000000
  }
}
```

### Staking

#### GET /api/staking/pools
Get all staking/farming pools

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "name": "LP Staking",
      "stakingToken": "rwLP-CSPR",
      "rewardToken": "RWP",
      "totalStaked": 2500000,
      "apr": 85,
      "isActive": true
    }
  ]
}
```

#### GET /api/staking/pools/:id
Get specific pool details

#### GET /api/staking/:address
Get all staking positions for a user

**Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "count": 2,
  "data": [
    {
      "poolId": 1,
      "poolName": "LP Staking",
      "stakedAmount": 1000,
      "pendingRewards": 45.5,
      "isLocked": false
    }
  ],
  "summary": {
    "totalStaked": 6000,
    "totalPendingRewards": 170.5,
    "activePositions": 2
  }
}
```

#### GET /api/staking/:address/:poolId
Get specific staking position

### Statistics

#### GET /api/stats/platform
Get overall platform statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolume24h": 5000000,
    "totalOpenInterest": 15000000,
    "totalValueLocked": 25000000,
    "activeMarkets": 6,
    "totalProposals": 15,
    "activeProposals": 2,
    "totalFeesCollected": 250000
  }
}
```

#### GET /api/stats/markets
Get aggregated market statistics

#### GET /api/stats/leaderboard
Get trader leaderboard

**Query Parameters:**
- `period` - Time period: `24h`, `7d`, `30d`, `all`
- `limit` - Number of entries (default: 10)

#### GET /api/stats/treasury
Get treasury statistics

#### GET /api/stats/analytics
Get detailed analytics

**Query Parameters:**
- `timeframe` - Time frame: `24h`, `7d`, `30d`

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  console.log('Connected to RWperp WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Subscribing to Channels

```javascript
// Subscribe to price updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices'
}));

// Subscribe to specific market
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'market:1'
}));

// Subscribe to user positions
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'user:account-hash-abc123...'
}));
```

### Message Types

#### Price Update
```json
{
  "type": "price_update",
  "data": {
    "0": 2050.25,
    "1": 28.50,
    "2": 75.30
  },
  "timestamp": "2024-11-17T12:00:00.000Z"
}
```

#### Market Update
```json
{
  "type": "market_update",
  "data": {
    "id": 1,
    "asset": "Gold",
    "currentPrice": 2050.25,
    "volume24h": 1500000
  },
  "timestamp": "2024-11-17T12:00:00.000Z"
}
```

#### Position Update
```json
{
  "type": "position_update",
  "data": {
    "id": "pos_123",
    "pnl": 75.5,
    "currentValue": 1075.5
  },
  "timestamp": "2024-11-17T12:00:00.000Z"
}
```

## Caching

The API uses Redis for caching with different TTLs based on data volatility:

- **10 seconds**: Positions, user-specific data
- **30 seconds**: Markets, prices, pool stats
- **1 minute**: Proposals, staking pools
- **5 minutes**: History, analytics

Cache keys follow the pattern: `category:subcategory:identifier`

Examples:
- `markets:all:active:volume`
- `position:account-hash-abc:pos_123`
- `liquidity:user:account-hash-abc`

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

Default rate limit: 100 requests per 15 minutes per IP

Headers included in response:
- `RateLimit-Limit` - Total requests allowed
- `RateLimit-Remaining` - Requests remaining
- `RateLimit-Reset` - Time when limit resets

## Development

### File Structure

```
backend/api-server/
├── src/
│   ├── index.js              # Main server file
│   ├── routes/               # API route handlers
│   │   ├── markets.js
│   │   ├── positions.js
│   │   ├── liquidity.js
│   │   ├── governance.js
│   │   ├── staking.js
│   │   └── stats.js
│   ├── services/             # Business logic
│   │   ├── casper-client.js  # Blockchain integration
│   │   └── price-updater.js  # Price update service
│   └── utils/                # Utilities
│       ├── logger.js         # Winston logger
│       └── redis.js          # Redis client
├── logs/                     # Log files
├── package.json
├── .env.example
└── README.md
```

### Adding New Endpoints

1. Create route handler in `src/routes/`
2. Import in `src/index.js`
3. Register route with `app.use()`
4. Add caching logic
5. Update this README

### Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test markets endpoint
curl http://localhost:3001/api/markets

# Test with query parameters
curl "http://localhost:3001/api/markets?status=active&sortBy=volume"
```

## Production Deployment

### Requirements

- Node.js 16+ production environment
- Redis server with persistence
- Casper RPC node (dedicated or public)
- Process manager (PM2 recommended)
- Reverse proxy (nginx recommended)

### PM2 Setup

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start src/index.js --name rwperp-api

# Enable startup script
pm2 startup
pm2 save

# View logs
pm2 logs rwperp-api

# Monitor
pm2 monit
```

### Nginx Configuration

```nginx
upstream rwperp_api {
    server localhost:3001;
}

upstream rwperp_ws {
    server localhost:3002;
}

server {
    listen 80;
    server_name api.rwperp.com;

    # REST API
    location /api/ {
        proxy_pass http://rwperp_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://rwperp_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-17T12:00:00.000Z",
  "uptime": 3600
}
```

### Logs

Logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

### Metrics to Monitor

- Request rate and latency
- Redis hit/miss ratio
- Casper RPC response times
- WebSocket connection count
- Memory usage
- CPU usage

## Troubleshooting

### Redis Connection Error

```
Error: Redis Client Error: connect ECONNREFUSED
```

**Solution**: Ensure Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

### Casper RPC Connection Error

```
Error: Failed to initialize Casper client
```

**Solution**: Check `CASPER_NODE_URL` in `.env` and verify node is accessible:
```bash
curl -X POST http://localhost:11101/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"info_get_status","id":1}'
```

### Contract Hash Not Found

```
Error: Contract client not found: vault
```

**Solution**: Update contract hashes in `.env` after deployment

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
