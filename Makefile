.PHONY: build-contracts test clean deploy-testnet deploy-mainnet

# Build all contracts
build-contracts:
	@echo "Building all contracts..."
	cargo build --release --target wasm32-unknown-unknown
	@echo "✅ Contracts built successfully"

# Run tests
test:
	@echo "Running tests..."
	cargo test --workspace
	@echo "✅ Tests passed"

# Clean build artifacts
clean:
	cargo clean
	rm -rf target/

# Format code
fmt:
	cargo fmt --all

# Check code
check:
	cargo check --workspace
	cargo clippy --workspace -- -D warnings

# Deploy to Casper testnet
deploy-testnet:
	@echo "Deploying to Casper testnet..."
	@echo "⚠️  Make sure you have CASPER_TESTNET_KEY set"
	# Deploy commands will go here

# Deploy to Casper mainnet
deploy-mainnet:
	@echo "⚠️  MAINNET DEPLOYMENT - Are you sure?"
	@read -p "Type 'yes' to continue: " confirm && [ $$confirm = "yes" ]
	# Mainnet deploy commands will go here

# Build documentation
docs:
	cargo doc --workspace --no-deps --open

# Watch mode for development
watch:
	cargo watch -x 'build --release --target wasm32-unknown-unknown'
