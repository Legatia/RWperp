# RWperp API Documentation

Complete API reference for RWperp platform.

## Base URL

```
REST API: http://localhost:3001/api
WebSocket: ws://localhost:3002
```

## Authentication

Currently, the API is public and does not require authentication. User-specific endpoints require passing the Casper account address as a URL parameter.

Future versions will include:
- API key authentication for rate limit increases
- JWT tokens for write operations
- Signature verification for transaction submissions

## Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10,        // Optional: for list endpoints
  "summary": { ... }  // Optional: aggregated data
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Pagination

List endpoints support pagination via query parameters:

- `limit` - Number of items per page (default: 50, max: 100)
- `offset` - Number of items to skip (default: 0)

Example:
```
GET /api/markets?limit=20&offset=40
```

## Sorting

List endpoints support sorting via `sortBy` query parameter:

Example:
```
GET /api/markets?sortBy=volume
```

## Filtering

List endpoints support filtering via specific query parameters documented for each endpoint.

---

# Endpoints Reference

## Markets

### List All Markets

```http
GET /api/markets
```

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| status | string | Filter by market status | active, settled, pending |
| asset | string | Search by asset name | Any string |
| sortBy | string | Sort results | volume, change, default |

**Example Request:**
```bash
curl "http://localhost:3001/api/markets?status=active&sortBy=volume"
```

**Example Response:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": 1,
      "asset": "Gold",
      "assetType": 0,
      "marketKey": "market_Gold_1700000000",
      "settlementTime": 1700086400,
      "startPrice": 2000.00,
      "currentPrice": 2050.25,
      "priceChange": 2.51,
      "volume24h": 1500000,
      "openInterest": 5000000,
      "longShortRatio": 0.65,
      "status": "active",
      "createdAt": "2024-11-17T00:00:00Z",
      "updatedAt": "2024-11-17T12:30:00Z"
    }
  ]
}
```

---

### Get Market Details

```http
GET /api/markets/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Market ID or key |

**Example Request:**
```bash
curl http://localhost:3001/api/markets/1
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "asset": "Gold",
    "assetType": 0,
    "marketKey": "market_Gold_1700000000",
    "settlementTime": 1700086400,
    "startPrice": 2000.00,
    "currentPrice": 2050.25,
    "priceChange": 2.51,
    "volume24h": 1500000,
    "openInterest": 5000000,
    "longPositions": 3250000,
    "shortPositions": 1750000,
    "longShortRatio": 0.65,
    "totalLongs": 150,
    "totalShorts": 85,
    "status": "active",
    "maxLeverage": 10,
    "tradingFee": 0.002,
    "minPositionSize": "10000000000",
    "maxPositionSize": "500000000000000",
    "settlementHistory": [
      {
        "timestamp": 1699996800,
        "settlementPrice": 1995.50,
        "totalSettled": 1000000
      }
    ],
    "createdAt": "2024-11-17T00:00:00Z",
    "updatedAt": "2024-11-17T12:30:00Z"
  }
}
```

---

### Get Market Price History

```http
GET /api/markets/:id/history
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Market ID |

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| interval | string | Time interval | 1h, 4h, 1d |
| limit | number | Number of data points | 1-1000 (default: 100) |

**Example Request:**
```bash
curl "http://localhost:3001/api/markets/1/history?interval=1h&limit=24"
```

**Example Response:**
```json
{
  "success": true,
  "marketId": "1",
  "interval": "1h",
  "count": 24,
  "data": [
    {
      "timestamp": 1700000000000,
      "price": 2000.50,
      "volume": 50000,
      "high": 2005.00,
      "low": 1998.00,
      "open": 2000.00,
      "close": 2000.50
    }
  ]
}
```

---

### Get Market Statistics

```http
GET /api/markets/:id/stats
```

**Example Response:**
```json
{
  "success": true,
  "marketId": "1",
  "data": {
    "volume24h": 1500000,
    "volume7d": 8500000,
    "trades24h": 450,
    "openInterest": 5000000,
    "longShortRatio": 0.65,
    "avgLeverage": 6.5,
    "liquidations24h": 3,
    "fundingRate": 0,
    "nextSettlement": 1700086400,
    "highPrice24h": 2060.00,
    "lowPrice24h": 2040.00
  }
}
```

---

## Positions

### Get User Positions

```http
GET /api/positions/:address
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| address | string | Casper account hash |

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| status | string | Filter by status | open, closed, liquidated |

**Example Request:**
```bash
curl http://localhost:3001/api/positions/account-hash-abc123...
```

**Example Response:**
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
      "assetType": 0,
      "isLong": true,
      "entryPrice": 2000.00,
      "currentPrice": 2050.25,
      "size": 1000,
      "collateral": 100,
      "leverage": 10,
      "liquidationPrice": 1800.00,
      "pnl": 50.25,
      "pnlPercentage": 50.25,
      "currentValue": 150.25,
      "liquidationDistance": 12.2,
      "openedAt": "2024-11-17T08:00:00Z",
      "lastUpdated": "2024-11-17T12:30:00Z",
      "status": "open",
      "marketKey": "market_Gold_1700000000"
    }
  ],
  "summary": {
    "totalPositions": 2,
    "totalCollateral": 200,
    "totalPnl": 75.5,
    "longPositions": 1,
    "shortPositions": 1
  }
}
```

---

### Get Position Details

```http
GET /api/positions/:address/:positionId
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "pos_123",
    "marketId": 1,
    "asset": "Gold",
    "isLong": true,
    "entryPrice": 2000.00,
    "currentPrice": 2050.25,
    "size": 1000,
    "collateral": 100,
    "leverage": 10,
    "liquidationPrice": 1800.00,
    "pnl": 50.25,
    "pnlPercentage": 50.25,
    "currentValue": 150.25,
    "liquidationDistance": 12.2,
    "openedAt": "2024-11-17T08:00:00Z",
    "lastUpdated": "2024-11-17T12:30:00Z",
    "status": "open"
  }
}
```

---

### Get Position History

```http
GET /api/positions/:address/history
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Items per page (default: 50) |
| offset | number | Items to skip (default: 0) |

---

## Liquidity Pool

### Get Pool Statistics

```http
GET /api/liquidity/pool
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalLiquidity": 10000000,
    "totalLpTokens": 9500000,
    "lpTokenPrice": 1.0526,
    "totalFeesEarned": 50000,
    "traderPnl": -25000,
    "utilizationRate": 35,
    "apy": 45.5,
    "volume24h": 1500000,
    "lpCount": 150,
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

### Get User LP Info

```http
GET /api/liquidity/:address
```

**Example Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "data": {
    "address": "account-hash-abc123...",
    "lpTokens": 10000,
    "depositedAmount": 9500,
    "currentValue": 10526,
    "profitLoss": 1026,
    "profitLossPercentage": 10.8,
    "feesEarned": 526,
    "depositTimestamp": 1700000000,
    "withdrawalRequests": [
      {
        "amount": 1000,
        "requestTime": 1700080000,
        "unlockTime": 1700166400
      }
    ],
    "poolShare": 0.105,
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

### Get Pool History

```http
GET /api/liquidity/pool/history
```

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| interval | string | Time interval | 1h, 1d |
| limit | number | Data points | 1-365 (default: 30) |

---

## Governance

### List Proposals

```http
GET /api/governance/proposals
```

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| status | string | Filter by status | active, passed, rejected, pending |

**Example Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "proposer": "account-hash-abc123...",
      "title": "Add Platinum (XPT/USD) Market",
      "description": "Proposal to add a new prediction market...",
      "proposalType": "AddMarket",
      "votesFor": 3500000,
      "votesAgainst": 250000,
      "totalVotes": 3750000,
      "quorumRequired": 10000000,
      "quorumPercentage": 37.5,
      "startTime": 1700000000,
      "endTime": 1700604800,
      "executed": false,
      "status": "active",
      "createdAt": "2024-11-15T00:00:00Z",
      "lastUpdated": "2024-11-17T12:30:00Z"
    }
  ],
  "summary": {
    "total": 3,
    "active": 1,
    "passed": 1,
    "rejected": 1,
    "pending": 0
  }
}
```

---

### Get Proposal Details

```http
GET /api/governance/proposals/:id
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "proposer": "account-hash-abc123...",
    "title": "Add Platinum (XPT/USD) Market",
    "description": "Full proposal description...",
    "proposalType": "AddMarket",
    "votesFor": 3500000,
    "votesAgainst": 250000,
    "totalVotes": 3750000,
    "forPercentage": 93.33,
    "againstPercentage": 6.67,
    "quorumRequired": 10000000,
    "quorumPercentage": 37.5,
    "startTime": 1700000000,
    "endTime": 1700604800,
    "executed": false,
    "status": "active",
    "timeRemaining": 432000,
    "createdAt": "2024-11-15T00:00:00Z",
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

### Get Voting Power

```http
GET /api/governance/:address/voting-power
```

**Example Response:**
```json
{
  "success": true,
  "address": "account-hash-abc123...",
  "data": {
    "stakedAmount": 10000,
    "votingPower": 15000,
    "lockPeriod": 2592000,
    "stakeTimestamp": 1700000000,
    "unlockTime": 1702592000,
    "rewardsEarned": 125,
    "multiplier": 1.5,
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

## Staking (Yield Farming)

### List Staking Pools

```http
GET /api/staking/pools
```

**Example Response:**
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
      "rewardPerSecond": 1.157,
      "apr": 85,
      "startTime": 1700000000,
      "endTime": 1831536000,
      "lastRewardTime": 1700082400,
      "accumulatedRewardPerShare": "1500000000000000000",
      "isActive": true,
      "minStake": 10000000000,
      "lockPeriod": 0,
      "lastUpdated": "2024-11-17T12:30:00Z"
    }
  ]
}
```

---

### Get Pool Details

```http
GET /api/staking/pools/:id
```

---

### Get User Staking Positions

```http
GET /api/staking/:address
```

**Example Response:**
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
      "stakeTimestamp": 1700000000,
      "pendingRewards": 45.5,
      "rewardDebt": "500000000000000000",
      "unlockTime": null,
      "isLocked": false,
      "lastUpdated": "2024-11-17T12:30:00Z"
    }
  ],
  "summary": {
    "totalStaked": 6000,
    "totalPendingRewards": 170.5,
    "activePositions": 2
  }
}
```

---

### Get Specific Staking Position

```http
GET /api/staking/:address/:poolId
```

---

## Statistics

### Platform Statistics

```http
GET /api/stats/platform
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalVolume24h": 5000000,
    "totalVolume7d": 28000000,
    "totalOpenInterest": 15000000,
    "activeMarkets": 6,
    "totalMarkets": 6,
    "totalValueLocked": 25000000,
    "liquidityPoolTVL": 10000000,
    "farmingTVL": 15000000,
    "lpTokenPrice": 1.0526,
    "totalProposals": 15,
    "activeProposals": 2,
    "totalRWPStaked": 9500000,
    "activeFarmingPools": 3,
    "totalFarmingPools": 3,
    "totalFeesCollected": 250000,
    "fees24h": 8333,
    "totalTraderPnL": -25000,
    "lpPnL": 25000,
    "poolUtilization": 35,
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

### Market Statistics

```http
GET /api/stats/markets
```

**Example Response:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "asset": "Gold",
      "assetType": 0,
      "currentPrice": 2050.25,
      "markets": 1,
      "volume24h": 1500000,
      "openInterest": 5000000,
      "avgLongShortRatio": 0.65
    }
  ]
}
```

---

### Leaderboard

```http
GET /api/stats/leaderboard
```

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| period | string | Time period | 24h, 7d, 30d, all |
| limit | number | Number of entries | 1-100 (default: 10) |

---

### Treasury Statistics

```http
GET /api/stats/treasury
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "balance": 50000,
    "feesCollected24h": 1666,
    "feesCollected7d": 11666,
    "totalFeesAllTime": 50000,
    "allocations": {
      "development": 20000,
      "marketing": 15000,
      "operations": 10000,
      "reserve": 5000
    },
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

### Analytics

```http
GET /api/stats/analytics
```

**Query Parameters:**

| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| timeframe | string | Time frame | 24h, 7d, 30d |

**Example Response:**
```json
{
  "success": true,
  "timeframe": "24h",
  "data": {
    "trading": {
      "totalVolume": 5000000,
      "numberOfTrades": 1250,
      "averageTradeSize": 4000,
      "liquidations": 12
    },
    "liquidity": {
      "totalLiquidity": 10000000,
      "utilizationRate": 35,
      "lpCount": 150,
      "averageLpSize": 66667
    },
    "users": {
      "totalUsers": 500,
      "activeTraders24h": 85,
      "newUsers24h": 12
    },
    "markets": {
      "mostTradedAsset": "Gold",
      "mostVolatileAsset": "Bitcoin",
      "highestOpenInterest": "Gold"
    },
    "lastUpdated": "2024-11-17T12:30:00Z"
  }
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Subscribe to Channel

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices'
}));
```

### Available Channels

| Channel | Description |
|---------|-------------|
| `prices` | Real-time price updates for all assets |
| `markets` | Updates for all markets |
| `market:{id}` | Updates for specific market |
| `user:{address}` | Updates for specific user's positions |

### Message Types

#### Connected
```json
{
  "type": "connected",
  "message": "Connected to RWperp WebSocket server",
  "timestamp": "2024-11-17T12:30:00.000Z"
}
```

#### Subscribed
```json
{
  "type": "subscribed",
  "channel": "prices",
  "timestamp": "2024-11-17T12:30:00.000Z"
}
```

#### Price Update
```json
{
  "type": "price_update",
  "data": {
    "0": 2050.25,
    "1": 28.50,
    "2": 75.30,
    "3": 4500.00,
    "4": 15000.00,
    "5": 45000.00
  },
  "timestamp": "2024-11-17T12:30:00.000Z"
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
    "volume24h": 1500000,
    "openInterest": 5000000
  },
  "timestamp": "2024-11-17T12:30:00.000Z"
}
```

#### Position Update
```json
{
  "type": "position_update",
  "data": {
    "id": "pos_123",
    "pnl": 75.5,
    "pnlPercentage": 75.5,
    "currentValue": 175.5,
    "liquidationDistance": 12.5
  },
  "timestamp": "2024-11-17T12:30:00.000Z"
}
```

---

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Burst**: Up to 20 requests per second

### Rate Limit Headers

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1700086400
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Errors

### Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## Data Types

### Market Status
- `pending` - Market created, not yet active
- `active` - Currently trading
- `settled` - Settlement complete

### Position Status
- `open` - Active position
- `closed` - Manually closed
- `liquidated` - Liquidated due to insufficient collateral

### Proposal Status
- `pending` - Voting not started
- `active` - Voting in progress
- `ended` - Voting ended, not executed
- `passed` - Executed successfully
- `rejected` - Failed quorum or majority

### Asset Types

| ID | Asset |
|----|-------|
| 0 | Gold |
| 1 | Silver |
| 2 | Oil |
| 3 | S&P 500 |
| 4 | Nasdaq |
| 5 | Bitcoin |

---

## Changelog

### v1.0.0 (2024-11-17)
- Initial API release
- REST endpoints for markets, positions, liquidity, governance, staking, stats
- WebSocket support for real-time updates
- Redis caching layer
- Rate limiting

---

## Support

For API issues or questions:
- GitHub Issues: https://github.com/yourorg/rwperp/issues
- Documentation: https://docs.rwperp.com
