# Quick Start Guide

Get started with RWA Prediction Markets on Casper Network in 5 minutes.

## For Users

### 1. Prerequisites
- Casper Wallet (Signer or compatible wallet)
- CSPR tokens for gas + collateral
- OR stablecoins on Casper

### 2. Deposit Collateral

```javascript
// Using Casper Signer
const deploy = await casperClient.makeDeploy({
  contractHash: VAULT_CONTRACT_HASH,
  entryPoint: "deposit_cspr",
  args: {
    amount: "100000000000" // 100 CSPR (9 decimals)
  }
});
```

### 3. Open a Position

```javascript
const deploy = await casperClient.makeDeploy({
  contractHash: POSITION_MANAGER_HASH,
  entryPoint: "open_position",
  args: {
    market_key: "gold_2024_11_17",
    side: 0,  // 0 = Long, 1 = Short
    collateral: "100000000000", // 100 CSPR
    leverage: 10, // 10x leverage
    entry_price: "2000000000" // $2000 (with decimals)
  }
});

// Returns: (position_id, liquidation_price)
```

### 4. Monitor Position

```javascript
const position = await casperClient.queryContract({
  contractHash: POSITION_MANAGER_HASH,
  entryPoint: "get_position",
  args: {
    position_id: 123
  }
});

// Calculate current PnL
const pnl = await casperClient.queryContract({
  contractHash: POSITION_MANAGER_HASH,
  entryPoint: "calculate_position_pnl",
  args: {
    position_id: 123,
    current_price: "2020000000" // Current Gold price
  }
});
```

### 5. Close Position (Optional)

```javascript
// Close before daily settlement
const deploy = await casperClient.makeDeploy({
  contractHash: POSITION_MANAGER_HASH,
  entryPoint: "close_position",
  args: {
    position_id: 123,
    exit_price: "2020000000" // Current price from oracle
  }
});
```

### 6. Withdraw Profits

```javascript
const deploy = await casperClient.makeDeploy({
  contractHash: VAULT_CONTRACT_HASH,
  entryPoint: "withdraw_cspr",
  args: {
    amount: "110000000000" // 110 CSPR (100 + 10 profit)
  }
});
```

## For Developers

### Build Contracts

```bash
# Install dependencies
rustup target add wasm32-unknown-unknown

# Build all contracts
make build-contracts

# Run tests
make test

# Format code
make fmt
```

### Deploy to Testnet

```bash
# Set your admin key
export CASPER_ADMIN_KEY=/path/to/secret_key.pem

# Deploy all contracts
bash scripts/deploy.sh testnet

# Contract addresses saved to deployed_contracts.json
```

### Create Test Market

```bash
casper-client put-deploy \
  --node-address http://18.144.176.168:7777 \
  --chain-name casper-test \
  --secret-key $CASPER_ADMIN_KEY \
  --payment-amount 5000000000 \
  --session-hash $MARKET_FACTORY_HASH \
  --session-entry-point create_daily_market \
  --session-arg "asset_type:u8='0'" \
  --session-arg "opening_price:u256='2000000000'" \
  --session-arg "market_date:u64='1700179200'"
```

## For Oracle Validators

### Register as Validator

```bash
casper-client put-deploy \
  --node-address http://18.144.176.168:7777 \
  --chain-name casper-test \
  --secret-key $VALIDATOR_KEY \
  --payment-amount 5000000000 \
  --session-hash $ORACLE_HASH \
  --session-entry-point register_validator \
  --session-arg "stake_amount:u64='10000'"  # 10k CSPR stake
```

### Submit Daily Price

```bash
# Fetch prices from APIs (Gold, stocks, etc.)
GOLD_PRICE=$(curl -s 'https://api.metals.live/v1/spot/gold' | jq '.price')

# Submit to oracle
casper-client put-deploy \
  --node-address http://18.144.176.168:7777 \
  --chain-name casper-test \
  --secret-key $VALIDATOR_KEY \
  --payment-amount 3000000000 \
  --session-hash $ORACLE_HASH \
  --session-entry-point submit_price \
  --session-arg "asset_type:u8='0'" \
  --session-arg "price:u256='${GOLD_PRICE}000000'" \
  --session-arg "data_sources:u8='7'" \
  --session-arg "target_timestamp:u64='1700179200'"
```

### Automate with Cron

```bash
# Add to crontab
0 0 * * * /home/validator/submit_oracle_prices.sh
```

## For Keepers (Settlement)

### Run Daily Settlement

```bash
# At 00:00 UTC daily
casper-client put-deploy \
  --node-address http://18.144.176.168:7777 \
  --chain-name casper-test \
  --secret-key $KEEPER_KEY \
  --payment-amount 10000000000 \
  --session-hash $SETTLEMENT_HASH \
  --session-entry-point settle_all_markets \
  --session-arg "market_keys:string_list=['gold_2024_11_17', 'sp500_2024_11_17']" \
  --session-arg "asset_types:u8_list='[0, 2]'" \
  --session-arg "target_timestamp:u64='1700179200'"
```

### Keeper Bot (Node.js)

```javascript
const cron = require('node-cron');

// Run at 00:05 UTC daily (5 min after settlement time)
cron.schedule('5 0 * * *', async () => {
  console.log('Starting daily settlement...');

  const markets = await getActiveMarkets();

  const deploy = await casperClient.makeDeploy({
    contractHash: SETTLEMENT_HASH,
    entryPoint: "settle_all_markets",
    args: {
      market_keys: markets.map(m => m.key),
      asset_types: markets.map(m => m.asset_type),
      target_timestamp: Math.floor(Date.now() / 1000)
    }
  });

  await deploy.send();
  console.log('Settlement complete!');
});
```

## Example Scenarios

### Scenario 1: Profitable Long Position

```
Day 1 09:00 UTC:
  User deposits 100 CSPR
  Opens LONG Gold @ $2000 with 10x leverage
  Liquidation price: $1800

Day 2 00:00 UTC:
  Gold settles at $2020 (+1%)
  PnL: 1000 CSPR exposure * 1% = 10 CSPR profit
  Final balance: 110 CSPR
  User can withdraw 110 CSPR
```

### Scenario 2: Losing Short Position

```
Day 1 14:00 UTC:
  User deposits 50 CSPR
  Opens SHORT S&P500 @ 4500 with 5x leverage
  Liquidation price: 4950

Day 2 00:00 UTC:
  S&P500 settles at 4545 (+1%)
  PnL: 250 CSPR exposure * 1% = 2.5 CSPR loss
  Final balance: 47.5 CSPR
  User can withdraw 47.5 CSPR
```

### Scenario 3: Early Exit

```
Day 1 10:00 UTC:
  User deposits 100 CSPR
  Opens LONG Gold @ $2000 with 10x

Day 1 16:00 UTC:
  Gold now at $2010 (+0.5%)
  User closes position early
  PnL: 1000 CSPR * 0.5% = 5 CSPR profit
  Final balance: 105 CSPR (minus fees)
```

## API Reference

Full API documentation available at: [docs/API.md](docs/API.md)

## Support

- Discord: [discord.gg/rwapredictions]
- Documentation: [docs.rwapredictions.com]
- GitHub Issues: [github.com/your-org/rwperp/issues]

## Security

**Audits**: Not yet audited - use at your own risk
**Bug Bounty**: Coming soon
**Insurance Fund**: 20% of fees go to insurance fund

---

Happy Trading! 🚀
