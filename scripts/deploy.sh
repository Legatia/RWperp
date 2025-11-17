#!/bin/bash

# RWA Prediction Market Deployment Script
# This script deploys all contracts to Casper Network

set -e

echo "🚀 RWA Prediction Market - Deployment Script"
echo "=============================================="

# Configuration
NETWORK=${1:-"testnet"}
ADMIN_KEY=${CASPER_ADMIN_KEY}
NODE_ADDRESS="http://localhost:7777"

if [ "$NETWORK" = "testnet" ]; then
    NODE_ADDRESS="http://18.144.176.168:7777"
elif [ "$NETWORK" = "mainnet" ]; then
    NODE_ADDRESS="http://3.14.161.135:7777"
    echo "⚠️  WARNING: Deploying to MAINNET"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

echo "Network: $NETWORK"
echo "Node: $NODE_ADDRESS"
echo ""

# Build all contracts
echo "📦 Building contracts..."
make build-contracts

echo ""
echo "✅ Contracts built successfully"
echo ""

# Deploy contracts in order
echo "🔧 Deploying contracts..."
echo ""

# 1. Deploy Vault
echo "1️⃣  Deploying Vault contract..."
VAULT_HASH=$(casper-client put-deploy \
    --node-address $NODE_ADDRESS \
    --chain-name casper-test \
    --secret-key $ADMIN_KEY \
    --payment-amount 200000000000 \
    --session-path target/wasm32-unknown-unknown/release/vault.wasm \
    --session-arg "admin:key='$ADMIN_KEY'" \
    --session-arg "position_manager:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    --session-arg "settlement_contract:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    --session-arg "stablecoin_contract:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    | jq -r '.result.deploy_hash')

echo "   Vault deployed: $VAULT_HASH"
sleep 30

# 2. Deploy Oracle
echo "2️⃣  Deploying Oracle contract..."
ORACLE_HASH=$(casper-client put-deploy \
    --node-address $NODE_ADDRESS \
    --chain-name casper-test \
    --secret-key $ADMIN_KEY \
    --payment-amount 150000000000 \
    --session-path target/wasm32-unknown-unknown/release/oracle.wasm \
    --session-arg "admin:key='$ADMIN_KEY'" \
    --session-arg "settlement_contract:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    | jq -r '.result.deploy_hash')

echo "   Oracle deployed: $ORACLE_HASH"
sleep 30

# 3. Deploy Market Factory
echo "3️⃣  Deploying Market Factory contract..."
MARKET_FACTORY_HASH=$(casper-client put-deploy \
    --node-address $NODE_ADDRESS \
    --chain-name casper-test \
    --secret-key $ADMIN_KEY \
    --payment-amount 150000000000 \
    --session-path target/wasm32-unknown-unknown/release/market-factory.wasm \
    --session-arg "admin:key='$ADMIN_KEY'" \
    --session-arg "vault_contract:key='$VAULT_HASH'" \
    --session-arg "oracle_contract:key='$ORACLE_HASH'" \
    --session-arg "settlement_contract:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    | jq -r '.result.deploy_hash')

echo "   Market Factory deployed: $MARKET_FACTORY_HASH"
sleep 30

# 4. Deploy Position Manager
echo "4️⃣  Deploying Position Manager contract..."
POSITION_MANAGER_HASH=$(casper-client put-deploy \
    --node-address $NODE_ADDRESS \
    --chain-name casper-test \
    --secret-key $ADMIN_KEY \
    --payment-amount 200000000000 \
    --session-path target/wasm32-unknown-unknown/release/position-manager.wasm \
    --session-arg "admin:key='$ADMIN_KEY'" \
    --session-arg "vault_contract:key='$VAULT_HASH'" \
    --session-arg "market_factory:key='$MARKET_FACTORY_HASH'" \
    | jq -r '.result.deploy_hash')

echo "   Position Manager deployed: $POSITION_MANAGER_HASH"
sleep 30

# 5. Deploy Settlement
echo "5️⃣  Deploying Settlement contract..."
SETTLEMENT_HASH=$(casper-client put-deploy \
    --node-address $NODE_ADDRESS \
    --chain-name casper-test \
    --secret-key $ADMIN_KEY \
    --payment-amount 150000000000 \
    --session-path target/wasm32-unknown-unknown/release/settlement.wasm \
    --session-arg "admin:key='$ADMIN_KEY'" \
    --session-arg "market_factory:key='$MARKET_FACTORY_HASH'" \
    --session-arg "position_manager:key='$POSITION_MANAGER_HASH'" \
    --session-arg "vault:key='$VAULT_HASH'" \
    --session-arg "oracle:key='$ORACLE_HASH'" \
    | jq -r '.result.deploy_hash')

echo "   Settlement deployed: $SETTLEMENT_HASH"
sleep 30

echo ""
echo "✅ All contracts deployed successfully!"
echo ""
echo "📝 Contract Addresses:"
echo "===================="
echo "Vault:            $VAULT_HASH"
echo "Oracle:           $ORACLE_HASH"
echo "Market Factory:   $MARKET_FACTORY_HASH"
echo "Position Manager: $POSITION_MANAGER_HASH"
echo "Settlement:       $SETTLEMENT_HASH"
echo ""

# Save addresses to file
cat > deployed_contracts.json <<EOF
{
  "network": "$NETWORK",
  "node": "$NODE_ADDRESS",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "vault": "$VAULT_HASH",
    "oracle": "$ORACLE_HASH",
    "market_factory": "$MARKET_FACTORY_HASH",
    "position_manager": "$POSITION_MANAGER_HASH",
    "settlement": "$SETTLEMENT_HASH"
  }
}
EOF

echo "💾 Contract addresses saved to deployed_contracts.json"
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Register oracle validators: casper-client call-entry-point ..."
echo "2. Create initial markets: casper-client call-entry-point ..."
echo "3. Fund insurance fund (optional)"
echo "4. Open platform to users"
