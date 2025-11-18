# Security & Code Quality Audit Report
## RWperp Continuous Perpetuals System

**Audit Date:** 2025-11-18
**Auditor:** Claude Code (Automated Analysis)
**Scope:** Oracle Validator Service, Funding Keeper Service, Settlement Contract Updates

---

## Executive Summary

This audit covers three new components added for the continuous perpetuals system:
1. Oracle Validator Service (`backend/services/oracle-validator.js`)
2. Funding Keeper Service (`backend/services/funding-keeper.js`)
3. Settlement Contract Updates (`contracts/settlement/`)

**Overall Risk Assessment:** 🟡 **MEDIUM-HIGH**

**Critical Issues Found:** 3
**High Severity Issues:** 8
**Medium Severity Issues:** 7
**Low Severity Issues:** 8
**Informational:** 3

---

## 🔴 CRITICAL SEVERITY ISSUES

### C1: No Deploy Finalization Verification (Oracle Validator)
**File:** `backend/services/oracle-validator.js:305`
**Issue:** After submitting a deploy via `putDeploy()`, there's no confirmation the transaction was executed successfully.

```javascript
const deployHash = await casperClient.putDeploy(signedDeploy);
console.log(`✓ Submitted price update...`); // FALSE POSITIVE
return true; // Returns success without checking execution
```

**Impact:** Price updates could fail silently, leaving oracle with stale data. Traders could be liquidated due to incorrect prices.

**Recommendation:**
```javascript
const deployHash = await casperClient.putDeploy(signedDeploy);

// Wait for finalization
const [deployResult] = await casperClient.nodeClient.waitForDeploy(signedDeploy, 180000);

if (!deployResult || deployResult.execution_results[0].result.Failure) {
  throw new Error(`Deploy failed: ${JSON.stringify(deployResult)}`);
}

console.log(`✓ Price update confirmed on-chain`);
```

---

### C2: Funding Rate Not Retrieved from Contract (Funding Keeper)
**File:** `backend/services/funding-keeper.js:148-151`
**Issue:** After calling `pay_funding()`, the actual funding rate calculated by the contract is not retrieved. A placeholder value of `0` is used.

```javascript
await new Promise(resolve => setTimeout(resolve, 5000));

// TODO: Fetch funding rate from deploy result
const fundingRate = 0; // ❌ PLACEHOLDER - WRONG!

return { success: true, deployHash, fundingRate };
```

**Impact:** The `apply_funding_batch()` call receives a funding rate of `0`, meaning NO funding is applied to positions. The entire funding mechanism is broken.

**Recommendation:**
```javascript
// Wait for deploy finalization and get result
const [deployResult] = await casperClient.nodeClient.waitForDeploy(signedDeploy, 180000);

// Extract funding rate from contract call result
const fundingRate = deployResult.execution_results[0].result.Success.effect.transforms
  .find(t => t.key.includes('funding_rate'))?.transform.WriteCLValue.parsed || 0;

return { success: true, deployHash, fundingRate };
```

---

### C3: Price Manipulation via Forced Fallback (Oracle Validator)
**File:** `backend/services/oracle-validator.js:130-138` (and similar in other fetch functions)
**Issue:** If API keys are not configured or APIs are unreachable, the service falls back to mock prices with predictable patterns.

```javascript
// Fallback: Yahoo Finance (requires scraping or different approach)
// For demo, return mock price with slight variation
const basePrice = 2045.50;
const variation = (Math.random() - 0.5) * 20; // ±$10
return basePrice + variation;
```

**Impact:** An attacker could:
1. DoS the external APIs (metals-api.com, Alpha Vantage)
2. Force the oracle to use predictable mock prices
3. Front-run based on known price ranges
4. Manipulate markets with outdated base prices

**Recommendation:**
1. **NEVER** use mock prices in production
2. Revert/halt if all API sources fail
3. Require at least 2 independent price sources
4. Add circuit breaker if price sources unavailable for >5 minutes

```javascript
if (!config.metalsApiKey) {
  throw new Error('METALS_API_KEY required - no fallback allowed');
}
// Remove all mock price logic
```

---

## 🟠 HIGH SEVERITY ISSUES

### H1: No Deploy Finalization Verification (Funding Keeper)
**File:** `backend/services/funding-keeper.js:143, 191`
**Issue:** Same as C1, but for funding keeper service.

**Impact:** Funding payments could fail silently, causing incorrect position accounting.

**Recommendation:** Same as C1 - use `waitForDeploy()` to confirm execution.

---

### H2: Price Change Validation Inconsistency (Oracle Validator)
**File:** `backend/services/oracle-validator.js:258-266`
**Issue:** Validator allows up to 5% price changes even though oracle contract enforces 2% max deviation.

```javascript
// Oracle contract enforces 2% max deviation
if (change > 0.02) {
  console.warn(`⚠ Price change exceeds 2%...`);
  // Still allow if change is reasonable (< 5%)
  return change < 0.05; // ❌ WILL BE REJECTED BY CONTRACT
}
```

**Impact:** Wastes gas on transactions that will revert. During high volatility, all price updates could fail.

**Recommendation:**
```javascript
const MAX_DEVIATION = 0.02; // Match contract exactly

if (change > MAX_DEVIATION) {
  console.error(`Price change ${(change*100).toFixed(2)}% exceeds maximum ${MAX_DEVIATION*100}%`);
  return false; // Don't submit
}
```

---

### H3: No Nonce Management (Both Services)
**File:** `backend/services/oracle-validator.js:347`, `backend/services/funding-keeper.js:252-258`
**Issue:** Multiple deploys submitted without explicit nonce tracking.

**Oracle Validator:**
```javascript
// Wait for all updates to complete
await Promise.all(updates); // ❌ Parallel deploys = nonce conflicts
```

**Funding Keeper:**
```javascript
// Process each asset sequentially to avoid gas conflicts
for (const asset of PERP_ASSETS) {
  await executeFundingForAsset(asset);
  await new Promise(resolve => setTimeout(resolve, 2000)); // ❌ 2s may not be enough
}
```

**Impact:** Nonce conflicts cause transaction failures, especially during congestion.

**Recommendation:**
1. Use casper-js-sdk's built-in nonce management
2. Track nonce manually and increment for each deploy
3. For oracle: Submit sequentially, not in parallel
4. For funding: Increase delay or fetch account nonce before each deploy

```javascript
// Fetch current nonce
const accountInfo = await casperClient.nodeClient.getAccountInfo(publicKey);
let nonce = accountInfo.namedKeys.find(k => k.name === 'nonce')?.value || 0;

// Use explicit nonce in deploy
const deploy = DeployUtil.makeDeploy(
  new DeployUtil.DeployParams(publicKey, chainName, gasPrice, ttl, nonce++),
  // ...
);
```

---

### H4: Hardcoded Gas Prices Too Low
**File:** `oracle-validator.js:42`, `funding-keeper.js:37`
**Issue:** Gas price hardcoded to `1` mote per gas.

```javascript
gasPrice: 1, // ❌ May be too low during congestion
```

**Impact:** During network congestion, transactions could be stuck in mempool indefinitely or rejected.

**Recommendation:**
```javascript
// Query current network gas price
const gasPrice = Math.max(
  parseInt(process.env.MIN_GAS_PRICE) || 1,
  await casperClient.getMinGasPrice() || 1
);
```

---

### H5: String-Based Settlement Mode Detection (Settlement Contract)
**File:** `contracts/market-factory/src/main.rs:464-475`
**Issue:** Settlement mode determined by string prefix matching rather than explicit storage.

```rust
if market_key.starts_with("perp_") {
    // This is a continuous perp
    runtime::ret(CLValue::from_t(SettlementMode::Continuous as u8).unwrap_or_revert());
} else {
    // This is a daily market
    runtime::ret(CLValue::from_t(SettlementMode::Daily as u8).unwrap_or_revert());
}
```

**Impact:** If market_key naming convention changes, settlement breaks. Brittle coupling.

**Recommendation:**
Store settlement_mode explicitly in DailyMarket and ContinuousPerp structs:

```rust
pub struct DailyMarket {
    pub settlement_mode: SettlementMode, // Add this field
    // ... other fields
}

pub struct ContinuousPerp {
    pub settlement_mode: SettlementMode, // Add this field
    // ... other fields
}

// In get_market_settlement_mode:
let market_uref = runtime::get_key(&market_key)
    .unwrap_or_revert_with(errors::MARKET_NOT_FOUND)
    .into_uref()
    .unwrap_or_revert();

// Try to read as DailyMarket first
if let Ok(Some(daily_market)) = storage::read::<DailyMarket>(market_uref) {
    runtime::ret(CLValue::from_t(daily_market.settlement_mode as u8).unwrap_or_revert());
}

// Try as ContinuousPerp
if let Ok(Some(perp)) = storage::read::<ContinuousPerp>(market_uref) {
    runtime::ret(CLValue::from_t(perp.settlement_mode as u8).unwrap_or_revert());
}

runtime::revert(errors::MARKET_NOT_FOUND);
```

---

### H6: SPY/SPX Price Conversion Inaccurate
**File:** `backend/services/oracle-validator.js:177`
**Issue:** Assumes SPY ETF tracks S&P 500 index at exactly 1/10th ratio.

```javascript
const spyPrice = parseFloat(response.data['Global Quote']['05. price']);
// SPY tracks SPX at ~1/10th, adjust
return spyPrice * 10; // ❌ Inaccurate - actual ratio varies
```

**Impact:** S&P 500 index price will be incorrect, could cause unfair liquidations.

**Recommendation:**
1. Use actual SPX index data (Alpha Vantage supports `^GSPC`)
2. Or use a more accurate ETF like SPX futures

```javascript
const response = await axios.get(
  `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=^GSPC&apikey=${config.alphaVantageApiKey}`
);
const spxPrice = parseFloat(response.data['Global Quote']['05. price']);
return spxPrice; // Actual index price
```

---

### H7: QQQ/NDX Price Conversion Inaccurate
**File:** `backend/services/oracle-validator.js:202`
**Issue:** Same as H6, but for Nasdaq 100.

**Recommendation:** Use actual NDX index data (`^NDX` symbol).

---

### H8: Hardcoded Payment Amounts May Be Insufficient
**File:** `oracle-validator.js:299`, `funding-keeper.js:139, 187`
**Issue:** Gas payment amounts are hardcoded and may be insufficient for complex operations.

```javascript
DeployUtil.standardPayment(5000000000) // 5 CSPR - might not be enough
```

**Impact:** Transactions could fail due to out-of-gas errors.

**Recommendation:**
1. Make payment amounts configurable via environment variables
2. Use higher amounts for batch operations (funding keeper uses 10 CSPR, which is better)
3. Add 20% buffer to estimated gas costs

---

## 🟡 MEDIUM SEVERITY ISSUES

### M1: No Error Recovery or Retry Logic (Oracle Validator)
**File:** `backend/services/oracle-validator.js:324-343`
**Issue:** If price fetch fails, it logs and continues without retry.

**Impact:** Temporary network issues could cause missed price updates.

**Recommendation:** Add exponential backoff retry (3 attempts).

---

### M2: Price Cache Never Expires (Oracle Validator)
**File:** `backend/services/oracle-validator.js:81`
**Issue:** `priceCache` object grows indefinitely without cleanup.

**Impact:** Memory leak over long-running instances (days/weeks).

**Recommendation:** Add TTL and periodic cleanup:
```javascript
const CACHE_TTL = 3600000; // 1 hour

// In updateAllPrices:
Object.keys(priceCache).forEach(key => {
  if (Date.now() - priceCache[key].timestamp > CACHE_TTL) {
    delete priceCache[key];
  }
});
```

---

### M3: No Funding History Persistence (Funding Keeper)
**File:** `backend/services/funding-keeper.js:56`
**Issue:** Funding history only stored in memory.

**Impact:** History lost on service restart. No audit trail.

**Recommendation:** Persist to database or file:
```javascript
const fs = require('fs');

// After funding cycle:
fs.appendFileSync(
  'funding-history.jsonl',
  JSON.stringify({ timestamp: Date.now(), results }) + '\n'
);
```

---

### M4: setInterval Can Drift (Oracle Validator)
**File:** `backend/services/oracle-validator.js:364`
**Issue:** `setInterval` doesn't account for `updateAllPrices()` execution time.

**Impact:** Over time, updates could drift from intended 30s interval.

**Recommendation:** Use `setTimeout` with calculated delay:
```javascript
async function scheduleNextUpdate() {
  const start = Date.now();
  await updateAllPrices();
  const elapsed = Date.now() - start;
  const delay = Math.max(0, (config.updateInterval * 1000) - elapsed);
  setTimeout(scheduleNextUpdate, delay);
}
```

---

### M5: No Validation of Contract Hashes (Both Services)
**File:** `oracle-validator.js:34-35`, `funding-keeper.js:32-33`
**Issue:** Contract hashes not validated as proper hex strings.

**Impact:** Service could start with invalid config and fail later.

**Recommendation:**
```javascript
function validateContractHash(hash) {
  if (!hash || !/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(`Invalid contract hash: ${hash}`);
  }
}

validateContractHash(config.oracleContractHash);
```

---

### M6: Unused Variable (Settlement Contract)
**File:** `contracts/settlement/src/main.rs:167`
**Issue:** `skipped_count` is calculated but never used or returned.

**Impact:** Caller can't tell how many perps were skipped.

**Recommendation:**
```rust
// Return both counts
runtime::ret(CLValue::from_t((settled_count, skipped_count)).unwrap_or_revert());
```

---

### M7: No Handling of Empty Market List (Settlement Contract)
**File:** `contracts/settlement/src/main.rs:146-200`
**Issue:** `settle_all_markets` doesn't check if `market_keys` is empty.

**Impact:** Could waste gas calling function with no markets.

**Recommendation:**
```rust
if market_keys.is_empty() {
    runtime::revert(errors::NO_MARKETS_TO_SETTLE);
}
```

---

## 🔵 LOW SEVERITY ISSUES

### L1: No Logging to File
**File:** Both services
**Issue:** Only console logging, no persistent logs.

**Recommendation:** Use winston or pino for structured logging.

---

### L2: No Metrics Collection
**File:** Both services
**Issue:** No success/failure rate tracking.

**Recommendation:** Add Prometheus metrics or similar.

---

### L3: No Health Check Endpoint
**File:** Both services
**Issue:** No way to monitor if service is healthy.

**Recommendation:** Add HTTP endpoint on port 8080 returning status.

---

### L4: Magic Numbers
**File:** `funding-keeper.js:257`
**Issue:** Hardcoded 2000ms delay.

**Recommendation:** Make configurable.

---

### L5: No Version Logging
**File:** Both services
**Issue:** No version/build info logged on startup.

**Recommendation:** Log git commit hash and build timestamp.

---

### L6: Funding History Size Limit Arbitrary
**File:** `funding-keeper.js:278`
**Issue:** History limited to 30 entries without clear reason.

**Recommendation:** Make configurable or increase to 100.

---

### L7: No Graceful Degradation
**File:** Both services
**Issue:** If one asset fails, no fallback strategy.

**Recommendation:** Continue with other assets, alert on failures.

---

### L8: Error Messages Could Be More Descriptive
**File:** `contracts/settlement/src/lib.rs:90`
**Issue:** `CANNOT_SETTLE_CONTINUOUS_PERP` error doesn't include market_key.

**Recommendation:** Add context to error (requires custom error type).

---

## ℹ️ INFORMATIONAL

### I1: Missing Settlement Keeper Service
**Issue:** Funding keeper exists, but no equivalent for triggering daily settlements at 00:00 UTC.

**Recommendation:** Create `settlement-keeper.js` to call `settle_all_markets()` daily.

---

### I2: No Monitoring/Alerting
**Issue:** No way to detect if services crash or stop working.

**Recommendation:** Add:
- Heartbeat monitoring (e.g., PagerDuty, Datadog)
- Dead man's switch (alert if no activity in 1 hour)
- Error rate alerts

---

### I3: No API Rate Limiting Protection
**Issue:** External APIs (metals-api, Alpha Vantage) have rate limits.

**Recommendation:** Track API call counts, implement backoff if approaching limits.

---

## Priority Recommendations

### 🔴 FIX IMMEDIATELY (Before Testnet)

1. **C2**: Fix funding rate retrieval in funding-keeper.js
2. **C3**: Remove mock price fallbacks in oracle-validator.js
3. **C1**: Add deploy finalization checks in both services
4. **H1**: Add deploy finalization in funding-keeper.js
5. **H2**: Fix price change validation to match 2% limit

### 🟠 FIX BEFORE MAINNET

6. **H3**: Implement proper nonce management
7. **H4**: Add dynamic gas price fetching
8. **H5**: Store settlement_mode explicitly in contracts
9. **H6, H7**: Fix SPY/SPX and QQQ/NDX conversion or use actual indices
10. **H8**: Make gas payment amounts configurable

### 🟡 RECOMMENDED IMPROVEMENTS

11. Add error recovery and retry logic
12. Add persistent logging and metrics
13. Create settlement-keeper service
14. Add monitoring and alerting
15. Add health check endpoints

---

## Testing Recommendations

Before deploying to testnet:

1. **Unit Tests**: Test each price fetch function with mock APIs
2. **Integration Tests**: Test full funding cycle with test contracts
3. **Chaos Tests**: Simulate API failures, network issues, contract reverts
4. **Load Tests**: Verify services handle sustained operation (24+ hours)
5. **Gas Cost Analysis**: Measure actual gas usage vs. payment amounts
6. **Nonce Conflict Tests**: Submit rapid deploys to verify nonce handling
7. **Price Volatility Tests**: Test with >2% price swings to verify rejection

---

## Security Best Practices Checklist

- [ ] Private keys stored in secure vault (not env vars)
- [ ] All API keys rotated regularly
- [ ] Services run in isolated containers
- [ ] Network egress restricted to required APIs
- [ ] Rate limiting on external API calls
- [ ] Circuit breakers for repeated failures
- [ ] All deploys verified for finalization
- [ ] Nonce management prevents conflicts
- [ ] Gas prices dynamically adjusted
- [ ] Comprehensive logging and monitoring
- [ ] Automated alerts on failures
- [ ] Disaster recovery plan documented
- [ ] Service auto-restart on crash
- [ ] Health checks and liveness probes
- [ ] Mock prices completely removed

---

## Conclusion

The continuous perpetuals system has a solid architectural foundation, but **contains critical issues that must be fixed before testnet deployment**. The most severe issue is the broken funding rate mechanism (C2), which would render the entire perp system non-functional.

**Recommended Actions:**
1. Fix all CRITICAL issues immediately (C1-C3)
2. Fix all HIGH issues before testnet (H1-H8)
3. Implement comprehensive testing suite
4. Add monitoring and alerting infrastructure
5. Create settlement-keeper service
6. Document deployment and operations procedures

Once these issues are addressed, the system will be ready for testnet deployment and thorough testing.

---

**Audit Completed:** 2025-11-18
**Next Review:** After critical fixes implemented
