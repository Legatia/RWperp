# RWA Prediction Market Architecture

## System Overview

This is a **daily-settled prediction market** for Real World Assets (RWA) built on Casper Network 2.0. Users can take **long or short positions** with up to **10x leverage** on RWA prices including stocks, commodities, real estate indices, and more.

## Key Design Decisions

### 1. Daily Settlement vs Continuous Perp
- **Daily Settlement**: Markets settle every 24 hours at 00:00 UTC
- **Benefits**:
  - Simpler oracle requirements (once-per-day price feed)
  - Lower gas costs (batched operations)
  - Reduced liquidation risk (no flash crash liquidations)
  - Easier to manage for slower-moving RWA prices

### 2. 10x Leverage vs 50x
- **10x Maximum**: Safer than traditional 50x+ perpetual markets
- **Liquidation Buffer**: Larger margin for error
- **Better for RWAs**: RWA volatility is lower than crypto, 10x is sufficient

### 3. Multi-Collateral Support
- **CSPR**: Native Casper token
- **Stablecoins**: For users wanting USD-denominated exposure

## Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│                                                             │
│  Deposit → Open Position → Monitor → Settlement → Withdraw  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  SMART CONTRACTS LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │    VAULT     │◄────►│   POSITION   │                   │
│  │   CONTRACT   │      │   MANAGER    │                   │
│  └──────┬───────┘      └──────┬───────┘                   │
│         │                     │                            │
│         │       ┌─────────────┴────────┐                  │
│         │       │                      │                  │
│         ▼       ▼                      ▼                  │
│  ┌──────────────────┐         ┌──────────────┐           │
│  │  MARKET FACTORY  │◄────────►│  SETTLEMENT  │           │
│  └──────────────────┘         └──────┬───────┘           │
│                                       │                    │
│                                       ▼                    │
│                              ┌──────────────┐             │
│                              │    ORACLE    │             │
│                              └──────────────┘             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               EXTERNAL DATA LAYER                           │
│                                                             │
│  Oracle Validators → Price APIs → Aggregation → On-chain   │
└─────────────────────────────────────────────────────────────┘
```

## Contract Responsibilities

### 1. **Vault Contract** (`contracts/vault/`)
**Purpose**: Manage all user funds and collateral

**Key Functions**:
- `deposit_cspr()` - Users deposit CSPR
- `deposit_stablecoin()` - Users deposit stablecoins
- `withdraw_cspr()` - Users withdraw CSPR
- `lock_collateral()` - Lock funds for open positions (called by position manager)
- `unlock_and_settle()` - Release funds + apply PnL (called by settlement)
- `get_balance()` - Check user balance

**Security Features**:
- Emergency pause function
- Separate tracking of locked vs available collateral
- Insurance fund for underwater positions

**State**:
```rust
UserAccount {
    cspr_balance,
    stablecoin_balance,
    locked_collateral,
    total_deposited,
    total_withdrawn,
    realized_pnl
}
```

### 2. **Position Manager Contract** (`contracts/position-manager/`)
**Purpose**: Create and manage leveraged positions

**Key Functions**:
- `open_position()` - Open long/short with leverage
- `close_position()` - Close position early (before settlement)
- `get_position()` - View position details
- `calculate_position_pnl()` - Real-time PnL calculation
- `settle_market_positions()` - Settle all positions for a market (called by settlement)

**Position Logic**:
```rust
Position {
    user,
    market_key,
    side,              // Long or Short
    collateral,        // Amount deposited
    leverage,          // 1-10x
    effective_size,    // collateral * leverage
    entry_price,       // Price when opened
    timestamp,
    is_closed
}

// PnL Calculation
Long:  (settlement_price - entry_price) / entry_price * effective_size
Short: (entry_price - settlement_price) / entry_price * effective_size

// Liquidation Price
Long:  entry_price * (1 - 1/leverage)
Short: entry_price * (1 + 1/leverage)
```

**Example**:
```
User deposits: 100 CSPR
Opens: LONG Gold @ $2000 with 10x leverage
Effective size: 1000 CSPR

If Gold settles at $2020 (+1%):
  PnL = 1000 CSPR * 1% = 10 CSPR profit
  Final = 110 CSPR

If Gold settles at $1980 (-1%):
  PnL = 1000 CSPR * 1% = 10 CSPR loss
  Final = 90 CSPR

Liquidation at: $2000 * 0.9 = $1800 (-10%)
```

### 3. **Market Factory Contract** (`contracts/market-factory/`)
**Purpose**: Create and manage daily markets for each RWA

**Key Functions**:
- `create_daily_market()` - Create new 24h market
- `settle_market()` - Mark market as settled with final price
- `get_market()` - Get market details
- `update_config()` - Update leverage limits, fees

**Market Lifecycle**:
```
Day 1 00:00 UTC
  ├─ create_daily_market(Gold, $2000)
  ├─ Market opens for 24 hours
  ├─ Users open positions throughout the day
  │
Day 2 00:00 UTC
  ├─ Oracle provides closing price
  ├─ settle_market(Gold, $2020)
  ├─ All positions settled
  ├─ create_daily_market(Gold, $2020) ← New market for next day
  └─ Cycle repeats
```

**Market State**:
```rust
DailyMarket {
    asset_type,        // Gold, SP500, etc.
    opening_price,     // Yesterday's close
    settlement_price,  // Today's close (when settled)
    market_date,       // Unix timestamp
    settlement_time,   // market_date + 86400
    total_long_collateral,
    total_short_collateral,
    max_leverage,      // Default: 10x
    is_settled,
    is_active
}
```

### 4. **Oracle Contract** (`contracts/oracle/`)
**Purpose**: Provide reliable daily price feeds for RWA assets

**Architecture**: Multi-validator system
- 5-7 validators stake CSPR
- Each submits daily closing prices
- Contract aggregates using median
- Validates deviation within acceptable range

**Key Functions**:
- `register_validator()` - Stake CSPR to become validator
- `submit_price()` - Submit daily price (validators only)
- `aggregate_prices()` - Calculate median price
- `get_price()` - Retrieve finalized price
- `slash_validator()` - Penalize bad data

**Price Aggregation**:
```rust
// Example: 5 validators submit Gold price
Submissions: [$2018, $2020, $2019, $2021, $2020]

// Calculate median
Sorted: [$2018, $2019, $2020, $2020, $2021]
Median: $2020

// Check deviation
Max deviation: $2021 - $2018 = $3 (0.15%)
Allowed: 5% ✓

// Finalize
Settlement price = $2020
```

**Security**:
- Validators stake 10k+ CSPR
- Slashed for prices outside acceptable range
- Require minimum 3/5 validators to finalize

### 5. **Settlement Contract** (`contracts/settlement/`)
**Purpose**: Coordinate daily settlement process

**Daily Settlement Flow**:
```
00:00 UTC Daily
├─ 1. Get finalized price from Oracle
├─ 2. Settle market in Market Factory
├─ 3. Calculate PnL for all positions
├─ 4. Update Vault balances (profits/losses)
├─ 5. Distribute fees to insurance fund
├─ 6. Create new market for next day
└─ 7. Store settlement record
```

**Key Functions**:
- `settle_market()` - Settle single market
- `settle_all_markets()` - Settle all active markets (keeper)
- `emergency_settle()` - Force settlement with custom price (admin only)
- `get_settlement_history()` - View past settlements

**Keeper Integration**:
Settlement contract is designed to be called by:
- **Automated keeper** (off-chain cron job)
- **Manual trigger** (admin)
- **Anyone** (permissionless settlement after 00:00 UTC)

## Data Flow Examples

### Opening a Position

```
1. User deposits 100 CSPR
   → vault.deposit_cspr(100)
   → Vault tracks: cspr_balance = 100

2. User opens LONG Gold @ $2000, 10x leverage
   → position_manager.open_position(
       market_key: "gold_2024_11_17",
       side: Long,
       collateral: 100,
       leverage: 10,
       entry_price: 2000
     )

3. Position Manager calls Vault
   → vault.lock_collateral(user, 100, CSPR)
   → Vault updates: locked_collateral = 100

4. Position created
   → Position ID returned to user
   → Liquidation price calculated: $1800
```

### Daily Settlement

```
Day 2 00:00 UTC - Settlement Process

1. Oracle validators submit prices
   → oracle.submit_price(Gold, $2020)
   → 5 validators submit

2. Oracle aggregates
   → oracle.aggregate_prices(Gold)
   → Median calculated: $2020

3. Settlement contract triggers
   → settlement.settle_market("gold_2024_11_17")

4. Settlement calls Oracle
   → price = oracle.get_price(Gold, timestamp)
   → Returns: $2020

5. Settlement calls Market Factory
   → market_factory.settle_market("gold_2024_11_17", $2020)
   → Market marked as settled

6. Settlement calls Position Manager
   → position_manager.settle_market_positions("gold_2024_11_17", $2020)
   → For each position:
     - Calculate PnL
     - Long at $2000 → $2020 = +1% = +10 CSPR profit

7. Position Manager calls Vault
   → vault.unlock_and_settle(
       user,
       locked_amount: 100,
       pnl_amount: 10,
       is_profit: true,
       collateral_type: CSPR
     )
   → Vault updates:
     - locked_collateral = 0
     - cspr_balance = 110
     - realized_pnl = +10

8. Settlement creates new market
   → market_factory.create_daily_market(Gold, $2020, tomorrow)
   → New market ready for next day
```

## Security Considerations

### 1. Oracle Security
- **Multi-validator**: Require 3/5 agreement
- **Median pricing**: Resistant to outliers
- **Deviation limits**: Max 5% price deviation
- **Staking**: Validators stake to prevent Sybil attacks
- **Slashing**: Bad data = loss of stake

### 2. Position Limits
- **Max position size**: 5% of total collateral pool
- **Prevents whale manipulation**
- **Ensures liquidity for settlements**

### 3. Insurance Fund
- **20% of fees** go to insurance fund
- Covers underwater positions (losses > collateral)
- Emergency buffer for edge cases

### 4. Access Control
- **Admin functions**: Config updates, emergency pause
- **Contract-to-contract**: Only authorized contracts can call certain functions
- **User functions**: Deposit, withdraw, open/close positions

### 5. Emergency Controls
- **Pause vault**: Stop deposits/withdrawals
- **Emergency settle**: Force settlement with custom price
- **Circuit breakers**: Auto-pause on extreme price deviation

## Deployment Order

```
1. Deploy Vault
   ├─ Initialize with admin

2. Deploy Oracle
   ├─ Initialize with admin

3. Deploy Market Factory
   ├─ Link to Vault, Oracle

4. Deploy Position Manager
   ├─ Link to Vault, Market Factory

5. Deploy Settlement
   ├─ Link to all contracts

6. Update cross-references
   ├─ Vault: Add Position Manager + Settlement
   ├─ Oracle: Add Settlement
   ├─ Market Factory: Add Settlement

7. Register Oracle validators
   ├─ At least 3 validators stake

8. Create initial markets
   ├─ Gold, SP500, etc.

9. Open to users
```

## Gas Optimization

### Batched Operations
- **Daily settlement**: All positions settled in single transaction
- **Lower cost per position** due to batching

### Storage Efficiency
- **URefs for user data**: Efficient lookups
- **Dictionaries for collections**: O(1) access
- **Minimal on-chain storage**: Only essential data

### Once-per-day Oracle
- **No real-time feeds**: Significantly cheaper
- **Batched price submissions**: Validators submit once daily
- **Lower frequency = lower costs**

## Future Enhancements

### Phase 2
- [ ] Add more RWA markets (real estate, bonds, etc.)
- [ ] Support for limit orders
- [ ] Position partial close
- [ ] Multi-sig admin

### Phase 3
- [ ] Governance token
- [ ] Community market creation
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Cross-collateral positions

### Phase 4
- [ ] Bridge to other chains
- [ ] Institutional features (API trading)
- [ ] Market maker incentives
- [ ] Insurance mining

## Testing Strategy

### Unit Tests
- Each contract function tested independently
- Edge cases (liquidations, underwater positions)
- Access control verification

### Integration Tests
- End-to-end user flows
- Daily settlement simulation
- Oracle aggregation testing

### Testnet Deployment
- Deploy to Casper testnet
- Simulate 30 days of trading
- Stress test with multiple users

### Mainnet Launch
- Start with 2-3 markets only
- Lower leverage initially (5x)
- Gradually increase over 3 months

## References

- [Casper 2.0 Documentation](https://docs.casper.network/)
- [RWA Tokenization Standards](https://www.iosco.org/)
- [Perpetual Market Design](https://research.paradigm.xyz/perps)
