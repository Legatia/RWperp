# 🚨 CRITICAL FIXES REQUIRED BEFORE TESTNET

**Status:** ⛔ **SYSTEM NOT READY FOR DEPLOYMENT**

---

## Top 5 Critical Issues

### 1. 🔴 BROKEN FUNDING MECHANISM
**File:** `backend/services/funding-keeper.js:148-151`
**Current Code:**
```javascript
await new Promise(resolve => setTimeout(resolve, 5000));

// TODO: Fetch funding rate from deploy result
const fundingRate = 0; // ❌ ALWAYS ZERO - FUNDING DOESN'T WORK!
```

**Why Critical:** The entire perpetual swaps funding mechanism is non-functional. Positions don't receive funding payments, meaning there's no mechanism to keep mark price anchored to index price.

**Fix:**
```javascript
// Wait for deploy finalization
const [deployResult] = await casperClient.nodeClient.waitForDeploy(
  signedDeploy,
  180000 // 3 minutes timeout
);

// Check execution success
if (!deployResult || deployResult.execution_results[0].result.Failure) {
  throw new Error(`pay_funding failed: ${JSON.stringify(deployResult)}`);
}

// Extract funding rate from contract state
// The contract should emit an event or we need to query the perp market
const perpKey = `perp_${assetType}`;
const perpData = await casperClient.queryContractData(
  config.marketFactoryContractHash,
  [perpKey]
);

const fundingRate = perpData.funding_rate || 0;
```

**Better Solution:** Modify the `pay_funding` contract to return the funding rate:
```rust
// In contracts/market-factory/src/main.rs
#[no_mangle]
pub extern "C" fn pay_funding() {
    // ... calculate funding rate ...

    // Return the funding rate so caller can use it
    runtime::ret(CLValue::from_t(funding_rate).unwrap_or_revert());
}
```

Then in funding-keeper.js:
```javascript
const deploy = DeployUtil.makeDeploy(/* ... */);
const signedDeploy = deploy.sign([keeperKeys]);
const deployHash = await casperClient.putDeploy(signedDeploy);

// Wait for execution
const [deployResult] = await casperClient.nodeClient.waitForDeploy(signedDeploy, 180000);

// Extract return value
const fundingRate = deployResult.execution_results[0].result.Success.effect.transforms
  .find(t => t.key === 'result')?.transform.WriteCLValue.parsed || 0;
```

---

### 2. 🔴 NO TRANSACTION VERIFICATION (Oracle & Funding)
**Files:** `oracle-validator.js:305`, `funding-keeper.js:143, 191`

**Current Code:**
```javascript
const deployHash = await casperClient.putDeploy(signedDeploy);
console.log(`✓ Submitted...`); // FALSE - only submitted, not executed!
return true; // ❌ Don't know if it succeeded
```

**Why Critical:** Transactions could fail on-chain but services report success. Leads to:
- Stale oracle prices → unfair liquidations
- Failed funding payments → broken perp mechanism
- Silent failures with no alerts

**Fix:**
```javascript
async function submitAndVerifyDeploy(deploy, description) {
  const signedDeploy = deploy.sign([keys]);
  const deployHash = await casperClient.putDeploy(signedDeploy);

  console.log(`  ⏳ Waiting for ${description} (deploy: ${deployHash})...`);

  // Wait for finalization (timeout: 3 minutes)
  const [deployResult] = await casperClient.nodeClient.waitForDeploy(
    signedDeploy,
    180000
  );

  // Check result
  if (!deployResult) {
    throw new Error(`${description} timed out`);
  }

  const executionResult = deployResult.execution_results[0].result;

  if (executionResult.Failure) {
    const errorMsg = executionResult.Failure.error_message || 'Unknown error';
    throw new Error(`${description} failed: ${errorMsg}`);
  }

  console.log(`  ✓ ${description} confirmed on-chain`);
  return { deployHash, result: executionResult.Success };
}

// Usage:
await submitAndVerifyDeploy(priceDeploy, 'Price update');
```

---

### 3. 🔴 PRICE MANIPULATION VIA MOCK DATA
**Files:** `oracle-validator.js:130-138, 156-158, 181-183, 206-208, 230-232`

**Current Code:**
```javascript
// Fallback: return mock price with slight variation
const basePrice = 2045.50;
const variation = (Math.random() - 0.5) * 20;
return basePrice + variation; // ❌ PREDICTABLE & MANIPULABLE
```

**Why Critical:**
- Attacker can DoS external APIs (metals-api.com, Alpha Vantage)
- Oracle falls back to predictable mock prices
- Base prices are hardcoded from 2024 - could be way off in 2025+
- Enables front-running and market manipulation

**Fix:**
```javascript
async function fetchGoldPrice() {
  const sources = [];

  // Source 1: metals-api.com
  if (config.metalsApiKey) {
    try {
      const response = await axios.get(
        `https://metals-api.com/api/latest?access_key=${config.metalsApiKey}&base=USD&symbols=XAU`,
        { timeout: 5000 }
      );
      if (response.data?.rates?.XAU) {
        sources.push(1 / response.data.rates.XAU);
      }
    } catch (err) {
      console.warn('metals-api failed:', err.message);
    }
  }

  // Source 2: goldapi.io (backup)
  if (config.goldApiKey) {
    try {
      const response = await axios.get(
        `https://www.goldapi.io/api/XAU/USD`,
        {
          headers: { 'x-access-token': config.goldApiKey },
          timeout: 5000
        }
      );
      if (response.data?.price) {
        sources.push(response.data.price);
      }
    } catch (err) {
      console.warn('goldapi failed:', err.message);
    }
  }

  // REQUIRE at least 2 sources
  if (sources.length < 2) {
    throw new Error(`Insufficient price sources for Gold: ${sources.length}/2 required`);
  }

  // Return median (more robust than average)
  sources.sort((a, b) => a - b);
  return sources[Math.floor(sources.length / 2)];
}

// Remove ALL mock price fallbacks
```

**Critical:** Add multiple independent price sources and require agreement:
- Gold: metals-api.com + goldapi.io + kitco.com API
- Silver: Same as gold
- S&P 500: Use actual ^GSPC index, not SPY ETF
- Nasdaq: Use actual ^NDX index, not QQQ ETF
- Oil: Alpha Vantage + oilpriceapi.com

---

### 4. 🔴 NONCE CONFLICTS CAUSE FAILURES
**Files:** `oracle-validator.js:347`, `funding-keeper.js:252-258`

**Current Code (Oracle):**
```javascript
// Submit all price updates in parallel
await Promise.all(updates); // ❌ NONCE COLLISIONS!
```

**Current Code (Funding):**
```javascript
for (const asset of PERP_ASSETS) {
  await executeFundingForAsset(asset);
  await new Promise(resolve => setTimeout(resolve, 2000)); // ❌ 2s may not be enough
}
```

**Why Critical:**
- Parallel deploys use same nonce → all but first fail
- 2-second delay insufficient during congestion
- Failures are silent (due to issue #2)

**Fix - Option 1: Sequential with Nonce Tracking**
```javascript
class NonceManager {
  constructor(casperClient, publicKey) {
    this.client = casperClient;
    this.publicKey = publicKey;
    this.currentNonce = null;
  }

  async initialize() {
    const stateRootHash = await this.client.nodeClient.getStateRootHash();
    const accountHash = this.publicKey.toAccountHashStr();
    const { Account: account } = await this.client.nodeClient.getBlockState(
      stateRootHash,
      accountHash,
      []
    );
    this.currentNonce = account.mainPurse.toString(); // Get actual nonce
  }

  getNextNonce() {
    return this.currentNonce++;
  }

  reset() {
    this.currentNonce = null;
  }
}

// Usage:
const nonceManager = new NonceManager(casperClient, validatorKeys.publicKey);
await nonceManager.initialize();

for (const [key, asset] of Object.entries(ASSETS)) {
  const nonce = nonceManager.getNextNonce();
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      validatorKeys.publicKey,
      config.chainName,
      config.gasPrice,
      config.ttl,
      nonce // ✓ Explicit nonce
    ),
    // ...
  );

  await submitAndVerifyDeploy(deploy, `Price update for ${asset.name}`);
}
```

**Fix - Option 2: Proper Delays**
```javascript
// For funding keeper - wait for previous deploy to finalize before next
for (const asset of PERP_ASSETS) {
  await executeFundingForAsset(asset); // Already waits for finalization
  // No need for additional delay if we wait for finalization
}
```

---

### 5. 🔴 INCORRECT INDEX PRICES (S&P 500, Nasdaq)
**Files:** `oracle-validator.js:177, 202`

**Current Code:**
```javascript
// S&P 500
const spyPrice = parseFloat(response.data['Global Quote']['05. price']);
return spyPrice * 10; // ❌ SPY ≠ SPX/10 exactly

// Nasdaq
const qqqPrice = parseFloat(response.data['Global Quote']['05. price']);
return qqqPrice * 50; // ❌ QQQ ≠ NDX/50 exactly
```

**Why Critical:**
- SPY tracks S&P 500 but with expense ratio, dividends, tracking error
- QQQ tracks Nasdaq-100 but not at exact 1/50 ratio
- Could be off by 1-3%, causing unfair liquidations
- Example: SPY = $478.30, but SPX = $4,785.20 (not 4783.00)

**Fix:**
```javascript
// S&P 500 - Use actual index
async function fetchSP500Price() {
  if (!config.alphaVantageApiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY required');
  }

  try {
    // Use ^GSPC symbol for actual S&P 500 index
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=^GSPC&apikey=${config.alphaVantageApiKey}`,
      { timeout: 5000 }
    );

    if (response.data?.['Global Quote']?.['05. price']) {
      return parseFloat(response.data['Global Quote']['05. price']);
    }

    throw new Error('Invalid response from Alpha Vantage');
  } catch (error) {
    console.error('Failed to fetch S&P 500:', error.message);

    // Try backup source: IEX Cloud
    if (config.iexApiKey) {
      const iexResponse = await axios.get(
        `https://cloud.iexapis.com/stable/stock/SPY/quote?token=${config.iexApiKey}`,
        { timeout: 5000 }
      );
      return iexResponse.data.latestPrice * 10;
    }

    throw new Error('All S&P 500 price sources failed');
  }
}

// Nasdaq - Use actual index
async function fetchNasdaqPrice() {
  // Use ^NDX or ^IXIC symbol for actual index
  // Similar implementation as S&P 500
}
```

---

## Quick Summary

| Issue | Impact | Fix Time | Status |
|-------|--------|----------|--------|
| 1. Broken funding mechanism | 🔥 CRITICAL | 4 hours | ⛔ BLOCKING |
| 2. No transaction verification | 🔥 CRITICAL | 2 hours | ⛔ BLOCKING |
| 3. Mock price manipulation | 🔥 CRITICAL | 6 hours | ⛔ BLOCKING |
| 4. Nonce conflicts | 🔥 CRITICAL | 3 hours | ⛔ BLOCKING |
| 5. Incorrect index prices | 🔥 CRITICAL | 2 hours | ⛔ BLOCKING |

**Total Fix Time:** ~17 hours of development work

---

## Deployment Checklist

Before deploying to testnet:

- [ ] Fix #1: Retrieve funding rate from contract
- [ ] Fix #2: Add deploy finalization verification
- [ ] Fix #3: Remove all mock prices, require 2+ sources
- [ ] Fix #4: Implement proper nonce management
- [ ] Fix #5: Use actual indices, not ETF proxies
- [ ] Add logging to persistent storage (files/database)
- [ ] Add health check HTTP endpoints
- [ ] Add monitoring and alerting (PagerDuty, etc.)
- [ ] Test with simulated failures (API down, contract reverts)
- [ ] Test during high volatility (>2% price swings)
- [ ] Test for 24+ hours continuous operation
- [ ] Document deployment procedures
- [ ] Set up API keys for multiple price sources
- [ ] Configure proper gas prices for testnet
- [ ] Review and update all environment variables
- [ ] Create settlement-keeper.js for daily settlements

---

## Recommended Development Order

1. **Fix #2 first** (deploy verification) - Makes debugging other issues easier
2. **Fix #4** (nonce management) - Prevents deploy failures
3. **Fix #1** (funding rate) - Core functionality
4. **Fix #5** (index prices) - Accuracy
5. **Fix #3** (mock prices) - Security
6. Add monitoring and testing infrastructure
7. Run 24-hour test on testnet
8. Address HIGH and MEDIUM severity issues from full audit

---

## Contact

For questions about these fixes, refer to:
- Full audit report: `SECURITY_AUDIT_REPORT.md`
- Casper SDK docs: https://docs.casper.network/
- Alpha Vantage API: https://www.alphavantage.co/documentation/

**DO NOT DEPLOY TO TESTNET UNTIL ALL 5 CRITICAL ISSUES ARE FIXED**
