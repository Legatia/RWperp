# RWperp Backend Services

Backend services for the RWperp protocol - oracle validators, settlement keepers, and API servers.

## Services

### 1. Oracle Validator (`oracle-validator/`)

Fetches real-world asset prices from external APIs and submits to the Casper blockchain.

**Features:**
- Fetches prices from multiple sources (Yahoo Finance, Metals.live, Alpha Vantage)
- Submits to oracle contract daily
- Runs as decentralized validator node
- Automatic retry and error handling

**Setup:**
```bash
cd oracle-validator
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

**Pricing Sources:**
- Gold/Silver: metals.live API (free)
- Stocks: Alpha Vantage API (requires key)
- Commodities: Various APIs

**Schedule:**
- Runs daily at 00:00 UTC (configurable)
- Can run on startup for testing

### 2. Settlement Keeper (`settlement-keeper/`)

Triggers daily market settlements on the blockchain.

**Features:**
- Runs at 00:05 UTC (5 min after oracle submission)
- Calls `settle_all_markets()` on settlement contract
- Automatic retry on failure
- Health checks and monitoring

**Setup:**
```bash
cd settlement-keeper
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

**Process:**
1. Fetches list of active markets
2. Triggers settlement for all markets
3. Waits for confirmation
4. Retries if failed

### 3. API Server (`api-server/`) - TODO

REST/GraphQL API for frontend to query blockchain data.

**Planned Features:**
- Market data endpoints
- Position history
- User statistics
- Real-time price updates (websocket)
- Caching layer

---

## Architecture

```
┌─────────────────────────────────────────┐
│         External Data Sources           │
│  (Yahoo Finance, Metals.live, etc.)     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│       Oracle Validator Nodes (5-7)      │
│  - Fetch prices every 24h               │
│  - Submit to oracle contract            │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│         Casper Blockchain               │
│  - Oracle Contract (aggregates prices)  │
│  - Settlement Contract                  │
│  - Market Factory                       │
└──────────────┬──────────────────────────┘
               │
               ↑
┌─────────────────────────────────────────┐
│       Settlement Keeper Bot             │
│  - Triggers daily settlement            │
│  - Monitors success                     │
└─────────────────────────────────────────┘
```

---

## Deployment

### Development (Local)

```bash
# Terminal 1: Oracle Validator
cd oracle-validator
npm run dev

# Terminal 2: Settlement Keeper
cd settlement-keeper
npm run dev
```

### Production (Docker)

```bash
# Build images
docker build -t rwperp-oracle oracle-validator/
docker build -t rwperp-keeper settlement-keeper/

# Run containers
docker run -d --name oracle -v ./keys:/app/keys rwperp-oracle
docker run -d --name keeper -v ./keys:/app/keys rwperp-keeper
```

### Production (systemd)

```bash
# Create systemd services
sudo cp oracle-validator.service /etc/systemd/system/
sudo cp settlement-keeper.service /etc/systemd/system/

# Enable and start
sudo systemctl enable oracle-validator settlement-keeper
sudo systemctl start oracle-validator settlement-keeper

# Check status
sudo systemctl status oracle-validator
sudo systemctl status settlement-keeper
```

---

## Monitoring

### Logs

```bash
# Oracle validator logs
tail -f oracle-validator/oracle-validator.log

# Settlement keeper logs
tail -f settlement-keeper/settlement-keeper.log
```

### Metrics (TODO)

- Uptime monitoring (UptimeRobot)
- Error alerts (PagerDuty, Discord webhooks)
- Performance metrics (Prometheus + Grafana)

---

## Configuration

### Environment Variables

**Oracle Validator:**
- `CASPER_NODE_ADDRESS` - Casper RPC endpoint
- `ORACLE_CONTRACT_HASH` - Oracle contract hash
- `VALIDATOR_KEY_PATH` - Path to validator private key
- `ALPHA_VANTAGE_API_KEY` - API key for stock prices
- `SUBMISSION_SCHEDULE` - Cron schedule for submissions

**Settlement Keeper:**
- `CASPER_NODE_ADDRESS` - Casper RPC endpoint
- `SETTLEMENT_CONTRACT_HASH` - Settlement contract hash
- `KEEPER_KEY_PATH` - Path to keeper private key
- `SETTLEMENT_SCHEDULE` - Cron schedule for settlements

---

## Security

### Key Management

- Store private keys securely (never commit to git)
- Use environment variables or key management services
- Rotate keys periodically
- Use separate keys for each validator/keeper

### Network Security

- Firewall rules to restrict access
- HTTPS for all external API calls
- Rate limiting on API endpoints
- DDoS protection

### Monitoring

- Alert on failed submissions/settlements
- Monitor gas costs
- Track validator performance
- Automated health checks

---

## Troubleshooting

### Oracle Validator Not Submitting

```bash
# Check logs
tail -f oracle-validator.log

# Common issues:
# 1. API keys not configured
# 2. Network connectivity
# 3. Insufficient CSPR for gas
# 4. Wrong contract hash
```

### Settlement Keeper Not Running

```bash
# Check logs
tail -f settlement-keeper.log

# Common issues:
# 1. Wrong schedule configuration
# 2. No active markets found
# 3. Insufficient gas
# 4. Oracle prices not ready
```

### Debugging

```bash
# Run with debug logging
LOG_LEVEL=debug npm start

# Test single submission
node src/submit-price.js

# Test settlement
RUN_ON_STARTUP=true npm start
```

---

## Development

### Adding New Price Sources

1. Create new fetcher in `oracle-validator/src/price-fetcher.js`
2. Add to `fetchAllPrices()` function
3. Update `ASSET_TYPES` mapping
4. Test locally before deploying

### Adding New Features

1. Create feature branch
2. Implement with tests
3. Update documentation
4. Submit PR

---

## License

MIT
