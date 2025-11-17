# Social Trading Feature - Complete Guide

## Overview

RWperp's Social Trading feature allows users to automatically copy the trades of successful traders. This creates a win-win ecosystem where experienced traders earn performance fees while helping beginners profit from their expertise.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [For Followers (Copiers)](#for-followers-copiers)
3. [For Leaders (Signal Providers)](#for-leaders-signal-providers)
4. [Smart Contracts](#smart-contracts)
5. [API Reference](#api-reference)
6. [Frontend Pages](#frontend-pages)
7. [Risk Management](#risk-management)
8. [Fee Structure](#fee-structure)
9. [Security](#security)
10. [Getting Started](#getting-started)

---

## How It Works

### The Copy Trading Flow

```
1. Leader opens a position
   ↓
2. Smart contract triggers mirror_position()
   ↓
3. For each active follower:
   - Calculate proportional position size
   - Apply follower's risk limits
   - Check daily trade limits
   - Open mirrored position
   ↓
4. Position settles (daily at 00:00 UTC)
   ↓
5. Calculate P&L
   ↓
6. Settle performance fees
```

### Key Concepts

**Leader (Signal Provider)**
- Experienced trader who shares trades publicly
- Earns 5-20% performance fee on follower profits
- Must have 10+ trades, 30+ days history, 5%+ ROI
- Can have up to 1000 followers

**Follower (Copier)**
- User who automatically copies a leader's trades
- Allocates capital to one or more leaders
- Sets risk limits (leverage, stop-loss, markets)
- Pays performance fees only on profits

**Copy Relationship**
- Connection between follower and leader
- Includes allocation amount, risk limits, status
- Can be paused/resumed/stopped anytime

**Mirrored Position**
- Follower's position that copies leader's position
- Proportional size based on allocation and AUM
- Same direction (long/short) and market
- May have different leverage if risk limits applied

---

## For Followers (Copiers)

### Why Copy Trade?

✅ **No Trading Knowledge Required** - Learn while earning
✅ **Diversify Across Multiple Leaders** - Reduce risk
✅ **Full Control** - Pause, adjust, or stop anytime
✅ **Risk Management** - Set your own limits
✅ **Pay Only on Profits** - No upfront fees

### How to Start Copying

1. **Browse Leaders**
   - Visit `/social/leaders`
   - Filter by ROI, followers, risk level
   - View detailed profiles and performance

2. **Select a Leader**
   - Review performance metrics
   - Check current positions
   - Read strategy description
   - Verify follower satisfaction

3. **Configure Copy Settings**
   - Allocation amount (min varies by leader)
   - Allocation percentage (% of portfolio)
   - Risk limits:
     - Max leverage (1-10x)
     - Stop-loss percentage (5-50%)
     - Max position size
     - Allowed markets (optional filter)
     - Max concurrent positions

4. **Start Copying**
   - Confirm settings
   - Transfer CSPR to copy vault
   - Leader's new trades auto-copy

### Risk Limits Explained

**Max Leverage**
- Overrides leader's leverage if higher
- Example: Leader uses 10x, your limit is 5x → you get 5x
- Lower leverage = less risk, less reward

**Stop-Loss Percentage**
- Auto-stops copying if allocation down by X%
- Example: 20% stop-loss on 100 CSPR → stops at 80 CSPR
- Protects from prolonged losing streaks

**Max Position Size**
- Limits collateral per trade
- Example: 1000 CSPR max → no trade uses more
- Prevents over-concentration

**Allowed Markets**
- Optional whitelist of markets to copy
- Example: Only copy gold and oil trades
- Useful for specialists

**Max Concurrent Positions**
- Limits open positions from this leader
- Example: Max 3 → only copies 3 trades at once
- Prevents portfolio over-leverage

### Managing Your Copies

**Dashboard** (`/social/my-copies`)
- View all copy relationships
- Monitor real-time P&L
- See active positions
- Track fees paid

**Actions Available**
- **Pause** - Stop new trades, keep existing positions
- **Resume** - Re-enable auto-copying
- **Stop** - Close all positions, end relationship
- **Adjust Settings** - Modify risk limits anytime

### Performance Tracking

**Metrics Displayed**
- My ROI (your return from this leader)
- Total Profit/Loss
- Trades Copied
- Fees Paid
- Active Positions
- Leader's Recent Performance

**Notifications** (via WebSocket)
- New position copied
- Position closed
- Stop-loss triggered
- Leader paused (high drawdown)

---

## For Leaders (Signal Providers)

### Why Become a Leader?

💰 **Passive Income** - Earn 5-20% of follower profits
📈 **Build Reputation** - Gain recognition and following
🎓 **Help Others** - Share your expertise
🏆 **Unlock Benefits** - Higher leverage, reduced fees

### Requirements to Register

Must meet ALL criteria:
- ✅ 10+ total trades
- ✅ 30+ days of trading history
- ✅ 5%+ overall ROI
- ✅ Valid performance track record

### How to Become a Leader

1. **Register as Leader**
   ```javascript
   // Call smart contract
   register_as_leader({
     performance_fee: 15,  // 5-20%
     min_copy_amount: "10000000000",  // 10 CSPR
     bio: "Commodity specialist...",
     strategy_description: "Trend-following strategy..."
   })
   ```

2. **Set Your Parameters**
   - **Performance Fee** (5-20%): Your cut of follower profits
   - **Min Copy Amount**: Minimum allocation per follower
   - **Max Copiers** (default 1000): Follower limit
   - **Bio**: Introduce yourself (200 chars)
   - **Strategy**: Explain your approach (500 chars)

3. **Build Your Following**
   - Maintain consistent performance
   - Share insights and analysis
   - Engage with followers
   - Keep drawdowns low

### Verification Program

**Benefits of Verification ✓**
- Blue checkmark badge
- Higher search ranking
- Increased follower trust
- Featured in recommendations
- Access to institutional clients

**Requirements**
- 90+ days as leader
- 100+ trades
- 50+ followers
- 15%+ 90-day ROI
- <20% max drawdown
- Application review

### Revenue Model

**Performance Fees**
- Earned monthly on follower profits
- Automatically calculated and settled
- Paid in CSPR
- Example:
  - Follower allocates 1000 CSPR
  - Makes 200 CSPR profit (20% ROI)
  - Your fee is 15%
  - You earn: 200 * 0.15 = 30 CSPR

**Scaling Income**
```
100 followers × 1000 CSPR avg × 10% monthly ROI × 15% fee
= 100 × 1000 × 0.10 × 0.15
= 1,500 CSPR per month
```

With 500 followers: **7,500 CSPR/month**

### Reputation System

**Reputation Score (0-1000)**
Calculated from:
- Win rate (0-300 points)
- ROI performance (0-300 points)
- Consistency/Sharpe ratio (0-300 points)
- Longevity (0-100 points)

**Impact**
- Higher scores rank higher
- Unlock badges (Top 10, Consistent, etc.)
- Attract more followers
- Better recommendations

### Best Practices

**For Maximum Followers**
1. ✅ Maintain 60%+ win rate
2. ✅ Keep drawdowns <20%
3. ✅ Trade consistently (avoid gaps)
4. ✅ Diversify across markets
5. ✅ Share your thought process
6. ✅ Respond to followers
7. ✅ Update bio regularly

**Avoid**
1. ❌ Overtrading (>20 trades/day)
2. ❌ Excessive leverage (>10x)
3. ❌ Holding losing positions too long
4. ❌ Sudden strategy changes
5. ❌ Disappearing for weeks

---

## Smart Contracts

### Architecture

**contracts/social-trading/src/lib.rs**
- Data structures (Leader, CopyRelationship, etc.)
- Validation helpers
- Reputation calculations

**contracts/social-trading/src/main.rs**
- Entry points (8 functions)
- Business logic
- Fee settlement

### Entry Points

#### 1. `register_as_leader()`
Become a signal provider

**Parameters:**
- `performance_fee: u8` (5-20)
- `min_copy_amount: U512`
- `bio: String`
- `strategy_description: String`

**Requirements:**
- 10+ trades
- 30+ days history
- 5%+ ROI

**Example:**
```rust
casper-client put-deploy \
  --node-address http://localhost:11101/rpc \
  --chain-name casper-test \
  --session-hash hash-xxx \
  --session-entry-point register_as_leader \
  --session-arg "performance_fee:u8='15'" \
  --session-arg "min_copy_amount:u512='10000000000'" \
  --session-arg "bio:string='Expert trader'" \
  --session-arg "strategy_description:string='Momentum strategy'"
```

#### 2. `start_copying()`
Begin copying a leader

**Parameters:**
- `leader: Key`
- `amount: U512`
- `allocation_percentage: u8`
- `max_leverage: Option<u8>`
- `stop_loss_percentage: Option<u8>`
- `allowed_markets: Option<Vec<u64>>`

**Actions:**
- Transfers CSPR to copy vault
- Creates copy relationship
- Updates leader stats

#### 3. `stop_copying()`
End copy relationship

**Parameters:**
- `leader: Key`
- `reason: String`

**Actions:**
- Closes all mirrored positions
- Settles performance fees
- Returns remaining collateral

#### 4. `mirror_position()`
Auto-copy leader's trade (called by position-manager)

**Parameters:**
- `market_id: u64`
- `is_long: bool`
- `size: U512`
- `collateral: U512`
- `leverage: u8`
- `entry_price: U512`
- `position_id: String`

**Logic:**
```
For each follower:
  1. Check if copy active
  2. Apply risk limits
  3. Calculate proportional size
  4. Check daily trade limit
  5. Open mirrored position
```

#### 5. `settle_performance_fees()`
Distribute fees to leader

**Parameters:**
- `leader: Key`

**Calculation:**
```
profit = follower_total_profit
fee_amount = profit * leader_performance_fee / 100
transfer(vault, leader, fee_amount)
```

#### 6. `update_risk_limits()`
Modify copy settings

#### 7. `pause_copying()`
Temporarily stop auto-copying

#### 8. `resume_copying()`
Re-enable auto-copying

### State Management

**Dictionaries:**
- `leaders` - Leader data by address
- `copy_relationships` - Follower-leader pairs
- `copied_positions` - Mirrored positions
- `follower_leaders` - Follower's leader list
- `leader_followers` - Leader's follower list
- `leader_stats` - Performance metrics

**Keys:**
- Leader: `address`
- Relationship: `follower_leader`
- Position: `follower_leader_market_timestamp`

---

## API Reference

### Base URL
```
http://localhost:3001/api/social
```

### Endpoints

#### GET /leaders
List all leaders

**Query Parameters:**
- `sortBy` - roi | aum | followers | reputation
- `timeframe` - 7d | 30d | 90d | 1y | all
- `minRoi` - number (0-100)
- `minFollowers` - number
- `verified` - boolean
- `limit` - number (default: 50)
- `offset` - number (default: 0)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "data": [
    {
      "address": "account-hash-...",
      "username": "GoldBull",
      "verified": true,
      "totalFollowers": 245,
      "aum": "125000000000000",
      "performanceFee": 15,
      "roi": 32.5,
      "winRate": 0.68,
      "riskScore": 4,
      "badges": ["Verified", "Top 1%"]
    }
  ]
}
```

#### GET /leaders/:address
Get leader profile

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "account-hash-...",
    "username": "GoldBull",
    "bio": "Commodity specialist...",
    "strategy": "Trend-following...",
    "roi_30d": 12.5,
    "winRate": 0.68,
    "currentPositions": [...],
    "followerStats": {
      "total": 245,
      "active": 230
    }
  }
}
```

#### GET /my-copies/:address
Get user's copy relationships

**Response:**
```json
{
  "success": true,
  "address": "account-hash-...",
  "totalCopies": 2,
  "totalAllocated": "80000000000000",
  "totalProfit": 10500000000000,
  "overallRoi": 13.1,
  "data": [...]
}
```

#### GET /discover
Get personalized recommendations

**Response:**
```json
{
  "success": true,
  "data": {
    "hotTraders": [...],
    "consistent": [...],
    "conservative": [...],
    "aggressive": [...],
    "specialists": {...},
    "risingStars": [...]
  }
}
```

#### GET /stats
Platform-wide statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLeaders": 100,
    "totalCopiers": 5000,
    "totalAum": "500000000000000"
  }
}
```

---

## Frontend Pages

### 1. Leaders Leaderboard
**Path:** `/social/leaders`

**Features:**
- Browse all leaders
- Filter by performance, risk, verification
- Sort by ROI, AUM, followers
- Search by name
- Quick stats overview

**Components:**
- LeaderCard - Individual leader preview
- Filters - Search and filter controls
- Stats banner - Platform metrics

### 2. Leader Profile
**Path:** `/social/leaders/[address]`

**Features:**
- Detailed trader profile
- Performance charts (equity curve)
- Current positions table
- Follower statistics
- Copy button with settings modal

**Components:**
- Profile header - Avatar, bio, badges
- Stats grid - ROI, win rate, metrics
- Performance chart - Historical returns
- Copy modal - Configure copy settings

### 3. My Copies Dashboard
**Path:** `/social/my-copies`

**Features:**
- View all copy relationships
- Monitor real-time P&L
- See active positions per leader
- Pause/resume/stop copying
- Adjust risk settings

**Components:**
- Summary cards - Total stats
- CopyCard - Per-leader details
- Settings modal - Risk limit controls
- Position list - Active trades

---

## Risk Management

### Follower Protection

**1. Proportional Sizing**
```
follower_collateral = (follower_allocation × leader_collateral) / leader_AUM
```

**2. Leverage Limits**
```
final_leverage = min(leader_leverage, follower_max_leverage)
```

**3. Stop-Loss**
```
if follower_loss > stop_loss_percentage:
  pause_copying()
  close_all_positions()
```

**4. Daily Trade Limits**
```
if trades_today >= max_daily_trades:
  skip_this_trade()
```

**5. Position Limits**
```
if active_positions >= max_concurrent:
  wait_for_position_close()
```

**6. Drawdown Protection**
```
if leader_drawdown_30d > 30%:
  auto_pause_copying()
  notify_follower()
```

### Leader Safeguards

**1. Fee Caps**
- Minimum: 5%
- Maximum: 20%
- Transparent calculation

**2. Follower Limits**
- Max 1000 followers (prevent over-concentration)
- Can adjust via governance

**3. Slippage Protection**
- Large leader positions may experience slippage
- Follower's position opens at current market price

**4. Circuit Breakers**
- Pause during extreme volatility
- Settlement window restrictions

---

## Fee Structure

### Performance Fees

**Who Pays:** Followers (only on profits)
**Who Receives:** Leaders
**Rate:** 5-20% (set by leader)
**Settlement:** Monthly or on unfollow

**Example Calculation:**
```
Follower allocation: 1000 CSPR
Month 1 profit: +200 CSPR (20% ROI)
Leader fee rate: 15%

Performance fee = 200 × 0.15 = 30 CSPR

Follower net profit: 200 - 30 = 170 CSPR
Leader earnings: 30 CSPR
```

**No Profit, No Fee:**
```
Month 2 loss: -100 CSPR (-10% ROI)
Performance fee = 0 CSPR

Leader earns nothing
Follower pays nothing
```

### Platform Fees

**Trading Fees (on all trades):**
- 0.2% per trade (same as regular trading)
- Applies to leader and all followers

**No Additional Copy Fees:**
- No subscription fees
- No withdrawal fees
- No deposit fees

---

## Security

### Smart Contract Security

**Audits:**
- 2+ independent security audits required
- Bug bounty program ($50k+ pool)
- Continuous monitoring

**Key Protections:**
- Non-custodial (users control funds)
- Time-locked withdrawals
- Multi-sig for upgrades
- Rate limiting
- Reentrancy guards

### User Security

**For Followers:**
- Never share private keys
- Always verify leader address
- Start with small amounts
- Diversify across leaders
- Monitor regularly

**For Leaders:**
- Secure your account
- Enable 2FA (when available)
- Don't share login credentials
- Review follower list periodically

### Common Scams to Avoid

**Fake Leaders:**
- ❌ Promises of guaranteed returns
- ❌ "Get rich quick" schemes
- ❌ Pressure to invest immediately
- ✅ Check on-chain performance
- ✅ Verify follower count
- ✅ Read reviews/comments

**Phishing:**
- ❌ Suspicious links claiming to be RWperp
- ❌ Emails asking for private keys
- ✅ Always use official domain
- ✅ Bookmark the correct URL
- ✅ Check contract addresses

---

## Getting Started

### Quick Start (Follower)

**5 Minutes to First Copy:**

1. **Connect Wallet**
   ```
   Visit app.rwperp.com
   Click "Connect Wallet"
   Select Casper Wallet
   ```

2. **Browse Leaders**
   ```
   Navigate to Social → Leaders
   Filter by "Low Risk" + "Verified"
   Click on interesting profiles
   ```

3. **Review Performance**
   ```
   Check ROI (30d)
   Verify win rate >60%
   Read strategy description
   See current positions
   ```

4. **Start Copying**
   ```
   Click "Copy Trader"
   Enter amount (min varies)
   Set risk limits
   Confirm transaction
   ```

5. **Monitor**
   ```
   Go to Social → My Copies
   Track real-time P&L
   Adjust settings anytime
   ```

### Quick Start (Leader)

**Become a Leader in 3 Steps:**

1. **Meet Requirements**
   - Trade for 30+ days
   - Complete 10+ trades
   - Achieve 5%+ ROI
   - Build track record

2. **Register**
   ```javascript
   // Via contract call
   register_as_leader({
     performance_fee: 12,  // Your choice
     min_copy_amount: "20000000000",  // 20 CSPR
     bio: "Expert in gold and commodities",
     strategy: "Trend-following with risk management"
   })
   ```

3. **Attract Followers**
   - Share your profile link
   - Post analysis on social media
   - Engage with community
   - Maintain performance

---

## Best Practices

### For Followers

**Diversification Strategy:**
```
Recommended allocation:
- 3-5 different leaders
- Mix of risk levels (conservative + moderate + aggressive)
- Different market specialists (gold trader + stocks trader)
- 20-30% per leader maximum
```

**Risk Management:**
```
Conservative: 5x max leverage, 10% stop-loss
Moderate: 7x max leverage, 20% stop-loss
Aggressive: 10x max leverage, 30% stop-loss
```

**Monitoring:**
- Check dashboard daily
- Review weekly performance
- Adjust if leader underperforms 2+ months
- Don't panic on short-term losses

### For Leaders

**Building Trust:**
1. Complete your profile (bio, strategy)
2. Explain your trades (optional comments)
3. Be consistent (trade regularly)
4. Manage risk (keep drawdowns low)
5. Communicate (respond to questions)

**Growing Followers:**
1. Start with friends/family
2. Share on Twitter/Discord
3. Create educational content
4. Maintain 70%+ win rate
5. Achieve top 10% ranking

---

## FAQ

### General

**Q: Is social trading safe?**
A: Funds are non-custodial (you control them). However, copying trades carries risk. Start small, diversify, and use risk limits.

**Q: Can I lose more than I invest?**
A: No. Losses are limited to your copy allocation amount. Liquidation ensures you can't go negative.

**Q: How are fees calculated?**
A: Performance fees = (your_profit × leader_fee_rate). Only paid on profits, never on losses.

### For Followers

**Q: Can I stop copying anytime?**
A: Yes. Click "Stop Copying" to close all positions and end the relationship.

**Q: What if the leader makes a bad trade?**
A: Your risk limits protect you. Stop-loss will auto-pause if losses exceed your threshold.

**Q: How many leaders can I copy?**
A: Unlimited. We recommend 3-5 for diversification.

**Q: Can I partially copy (e.g., only long trades)?**
A: Not currently. You copy all trades or none. Future update may add filters.

### For Leaders

**Q: How do I get verified?**
A: Meet verification requirements (90 days, 100 trades, 50 followers, etc.) and apply via Discord.

**Q: Can I change my performance fee?**
A: No. Set once at registration. You'd need to create a new leader account.

**Q: What happens if I stop trading?**
A: Followers will see "inactive" status. If >30 days, auto-pause may trigger.

**Q: Can I kick followers?**
A: No. Followers control when to start/stop copying. You cannot force them out.

---

## Troubleshooting

### Common Issues

**Copy Not Working**
- ✅ Check you have sufficient CSPR
- ✅ Verify leader is active
- ✅ Ensure not at max copier limit
- ✅ Check risk limits aren't too restrictive

**Positions Not Copying**
- ✅ Confirm copy relationship is active (not paused)
- ✅ Check daily trade limit not reached
- ✅ Verify market is in allowed list (if set)
- ✅ Ensure leader's position meets your size limits

**Performance Fee Questions**
- ✅ Check "Fees Paid" in My Copies dashboard
- ✅ Fees only on profits, not losses
- ✅ Settled monthly or on unfollow

**Can't Register as Leader**
- ✅ Need 10+ trades, 30+ days, 5%+ ROI
- ✅ Check transaction succeeded
- ✅ Wait for blockchain confirmation

### Getting Help

**Support Channels:**
- Discord: discord.gg/rwperp (fastest)
- Telegram: t.me/rwperp
- Email: support@rwperp.com
- GitHub Issues: github.com/rwperp/issues

**Include in Support Request:**
- Account address
- Leader/follower address (if applicable)
- Transaction hash (if available)
- Screenshot of issue
- Steps to reproduce

---

## Roadmap

### Phase 1 (Current) ✅
- ✅ Leader registration
- ✅ Basic copy trading
- ✅ Risk management
- ✅ Performance tracking
- ✅ Frontend pages

### Phase 2 (Month 1-2)
- [ ] Verification program launch
- [ ] Badge system
- [ ] Social features (comments, follows)
- [ ] Enhanced analytics
- [ ] Mobile PWA optimization

### Phase 3 (Month 3-4)
- [ ] Portfolio managers (curated baskets)
- [ ] Strategy marketplace
- [ ] Advanced fee models (tiered, rebates)
- [ ] Institutional accounts
- [ ] API for third-party integrations

### Phase 4 (Month 5-6)
- [ ] AI-powered recommendations
- [ ] Automated portfolio rebalancing
- [ ] Copy trading tournaments
- [ ] White-label solutions
- [ ] Multi-chain expansion

---

## Metrics & Success

### Key Performance Indicators

**Platform Level:**
- Total leaders: Target 500+ by month 6
- Total copiers: Target 10,000+ by month 6
- Total AUM: Target $20M+ by month 6
- Average leader ROI: >10% monthly
- Copier satisfaction: >80% NPS

**Individual Level (Follower):**
- Positive ROI: >60% of followers
- Average return: >8% monthly
- Retention rate: >70% at 90 days

**Individual Level (Leader):**
- Average monthly income: $500-$5000
- Follower count: 50-500 average
- Win rate: 65% average
- Sharpe ratio: >1.5 average

### Success Stories (Target)

**Follower Example:**
```
User: Alice
Started: 3 leaders, 1000 CSPR each
After 6 months: +450 CSPR profit (15% ROI)
Fees paid: 67.5 CSPR
Net profit: 382.5 CSPR
Status: Happy, now follows 5 leaders
```

**Leader Example:**
```
User: Bob "GoldBull"
Followers: 250
Avg allocation: 1200 CSPR each
Monthly ROI: 12%
Performance fee: 15%

Monthly earnings:
250 × 1200 × 0.12 × 0.15 = 5,400 CSPR
Plus his own trading profits

Annual: 64,800 CSPR
```

---

## Conclusion

Social trading democratizes access to professional trading strategies. By combining smart contract automation, risk management, and transparent performance tracking, RWperp creates a sustainable ecosystem where both leaders and followers can thrive.

**Get started today:**
- Followers: [Browse Leaders](/social/leaders)
- Leaders: [Register Now](#getting-started)

**Questions?** Join our [Discord](https://discord.gg/rwperp) community!

---

*Last Updated: 2024-11-17*
*Version: 1.0*
