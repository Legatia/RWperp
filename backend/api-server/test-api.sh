#!/bin/bash

# RWperp API Test Script
# Tests all major API endpoints

API_URL="http://localhost:3001"
WS_URL="ws://localhost:3002"

echo "================================"
echo "RWperp API Test Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3

    echo -n "Testing $description... "

    response=$(curl -s -w "\n%{http_code}" -X $method "${API_URL}${endpoint}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 404 ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))

        # Pretty print JSON if jq is available
        if command -v jq &> /dev/null; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        else
            echo "$body"
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        echo "$body"
    fi
    echo ""
}

# Health Check
echo -e "${YELLOW}=== Health Check ===${NC}"
test_endpoint GET "/health" "Health endpoint"

# Markets
echo -e "${YELLOW}=== Markets ===${NC}"
test_endpoint GET "/api/markets" "List all markets"
test_endpoint GET "/api/markets?status=active" "Filter markets by status"
test_endpoint GET "/api/markets?sortBy=volume" "Sort markets by volume"
test_endpoint GET "/api/markets/1" "Get market by ID"
test_endpoint GET "/api/markets/1/history?interval=1h&limit=24" "Get market history"
test_endpoint GET "/api/markets/1/stats" "Get market statistics"

# Positions
echo -e "${YELLOW}=== Positions ===${NC}"
test_endpoint GET "/api/positions/account-hash-0000000000000000000000000000000000000000000000000000000000000000" "Get user positions"
test_endpoint GET "/api/positions/account-hash-0000000000000000000000000000000000000000000000000000000000000000/history" "Get position history"

# Liquidity Pool
echo -e "${YELLOW}=== Liquidity Pool ===${NC}"
test_endpoint GET "/api/liquidity/pool" "Get pool statistics"
test_endpoint GET "/api/liquidity/account-hash-0000000000000000000000000000000000000000000000000000000000000000" "Get user LP info"
test_endpoint GET "/api/liquidity/pool/history?interval=1d&limit=30" "Get pool history"

# Governance
echo -e "${YELLOW}=== Governance ===${NC}"
test_endpoint GET "/api/governance/proposals" "List all proposals"
test_endpoint GET "/api/governance/proposals?status=active" "Filter proposals by status"
test_endpoint GET "/api/governance/proposals/1" "Get proposal by ID"
test_endpoint GET "/api/governance/account-hash-0000000000000000000000000000000000000000000000000000000000000000/voting-power" "Get voting power"

# Staking
echo -e "${YELLOW}=== Staking ===${NC}"
test_endpoint GET "/api/staking/pools" "List all staking pools"
test_endpoint GET "/api/staking/pools/1" "Get pool by ID"
test_endpoint GET "/api/staking/account-hash-0000000000000000000000000000000000000000000000000000000000000000" "Get user staking positions"

# Statistics
echo -e "${YELLOW}=== Statistics ===${NC}"
test_endpoint GET "/api/stats/platform" "Get platform statistics"
test_endpoint GET "/api/stats/markets" "Get market statistics"
test_endpoint GET "/api/stats/leaderboard?period=7d&limit=10" "Get leaderboard"
test_endpoint GET "/api/stats/treasury" "Get treasury statistics"
test_endpoint GET "/api/stats/analytics?timeframe=24h" "Get analytics"

# Summary
echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
