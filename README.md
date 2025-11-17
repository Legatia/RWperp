# RWA Prediction Market on Casper Network

A decentralized prediction market for Real World Assets (RWA) with 10x leverage built on Casper Network 2.0.

## 🎯 Overview

Predict daily price movements of real-world assets including:
- 📈 **Stocks** (S&P 500, NASDAQ, individual stocks)
- 🏠 **Real Estate** (housing indices, rent prices)
- 🥇 **Commodities** (Gold, Silver, Oil, Copper)
- 💎 **Precious Metals** (Platinum, Palladium)

## ✨ Features

- **10x Leverage**: Long or short positions with up to 10x leverage
- **Daily Settlement**: Positions settle every 24 hours at 00:00 UTC
- **Multi-Collateral**: Support for CSPR and stablecoins
- **Safe Liquidations**: Daily settlement eliminates continuous liquidation risk
- **Low Gas Costs**: Batched operations reduce transaction fees
- **Oracle-Powered**: Reliable daily price feeds for RWA assets

## 🏗️ Architecture

### Smart Contracts

1. **Market Factory** (`market-factory/`)
   - Creates daily markets for each RWA asset
   - Manages market lifecycle (open → settle → archive)
   - Configures leverage limits and fees

2. **Position Manager** (`position-manager/`)
   - Handles long/short position creation
   - Enforces 10x leverage limits
   - Tracks user positions and exposure

3. **Vault** (`vault/`)
   - Manages CSPR and stablecoin collateral
   - Processes deposits and withdrawals
   - Distributes PnL after settlement

4. **Oracle** (`oracle/`)
   - Receives daily price feeds for RWA assets
   - Validates and aggregates multiple price sources
   - Provides settlement prices at 00:00 UTC

5. **Settlement** (`settlement/`)
   - Calculates daily PnL for all positions
   - Distributes profits and deducts losses
   - Closes settled markets and opens new ones

## 🔧 How It Works

```
Day 1 (00:00 UTC)
├─ Markets open for 24 hours
├─ Users create long/short positions (10x leverage)
├─ Collateral locked in vault
│
Day 2 (00:00 UTC)
├─ Oracle submits closing prices
├─ Settlement contract calculates PnL
├─ Vault distributes profits/losses
├─ New markets open
└─ Cycle repeats
```

### Example Trade

```
Deposit: 100 CSPR
Position: LONG Gold @ $2,000 (10x leverage)
Exposure: 1,000 CSPR equivalent

Scenario A - Gold closes at $2,020 (+1%)
Profit: 1,000 CSPR × 1% = 10 CSPR
Final: 110 CSPR ✅

Scenario B - Gold closes at $1,980 (-1%)
Loss: 1,000 CSPR × 1% = 10 CSPR
Final: 90 CSPR ⚠️
```

## 🚀 Getting Started

### Prerequisites

- Rust 1.70+
- Casper CLI tools
- Make

### Build Contracts

```bash
make build-contracts
```

### Run Tests

```bash
make test
```

### Deploy to Testnet

```bash
make deploy-testnet
```

## 🛡️ Risk Management

- **10x Maximum Leverage**: Safer than traditional 50x+ perp markets
- **Daily Settlement**: No flash crash liquidations
- **Position Limits**: Maximum 5% of total collateral pool per position
- **Insurance Fund**: 20% of fees fund insurance for edge cases
- **Circuit Breakers**: Automatic pause if price deviation > 10%

## 📊 Supported RWA Markets (Planned)

### Tier 1 - Launch
- Gold (XAU/USD)
- S&P 500 Index
- Bitcoin ETF Price

### Tier 2 - Post-Launch
- Silver, Platinum, Oil
- NASDAQ, Dow Jones
- US Housing Index

### Tier 3 - Future
- Local rent indices
- Individual stocks (AAPL, GOOGL, etc.)
- Agricultural commodities

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## ⚠️ Disclaimer

This is experimental DeFi software. Use at your own risk. Leverage trading can result in loss of collateral.
