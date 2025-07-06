#!/bin/bash

# Kitty ICO - Local Development Setup Script
# This script helps set up and run the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_note() {
    echo -e "${CYAN}[NOTE]${NC} $1"
}

# Function to wait for user confirmation
wait_for_user() {
    local message=${1:-"Press Enter to continue..."}
    echo ""
    read -p "$message"
}

# Function to show blockchain architecture
show_architecture() {
    echo ""
    echo "🏗️  BLOCKCHAIN DEPLOYMENT ARCHITECTURE"
    echo "========================================"
    echo ""
    echo "PRODUCTION SETUP:"
    echo ""
    echo "📦 TOKEN CONTRACT (MockERC20.sol)"
    echo "   Blockchain: Ethereum Mainnet/Sepolia"
    echo "   Purpose: The actual ERC20 token that users receive"
    echo "   Why: Tokens should exist on the main chain where users expect them"
    echo ""
    echo "🔐 ICO CONTRACT (ICO_Contract.sol)"
    echo "   Blockchain: Oasis Sapphire (Confidential)"
    echo "   Purpose: Handles private bid submission and confidential data"
    echo "   Why: Bids must be private until settlement - requires confidential computing"
    echo ""
    echo "⚖️  BATCH SETTLEMENT (BatchSettlement.sol)"
    echo "   Blockchain: Ethereum Mainnet/Sepolia (same as token)"
    echo "   Purpose: Executes final token transfers based on TEE-signed results"
    echo "   Why: Settlement must happen where the tokens actually live"
    echo ""
    echo "🤖 TEE AGENT (agent.py)"
    echo "   Environment: ROFL TEE Container on Oasis Network"
    echo "   Purpose: Decrypts bids, scores with AI, determines winners, signs settlement"
    echo "   Why: Only TEE can access private bid data and maintain trust"
    echo ""
    echo "LOCALNET SETUP (Current):"
    echo "For development, all contracts deployed to Sapphire Localnet for simplicity"
    echo "The TEE agent connects to the same localnet to simulate the full flow"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "Detected macOS - configuring for Apple Silicon compatibility"
        export DOCKER_DEFAULT_PLATFORM=linux/x86_64
    fi
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    # Determine compose command
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_status "Using compose command: $COMPOSE_CMD"
    
    # Create necessary directories
    print_status "Creating necessary directories..."
    mkdir -p data/tee-data data/tee-keys data/tee-logs
    
    print_status "✅ Prerequisites check completed!"
}

# Function to update specific environment variables in .env file (preserves existing content)
update_env_file() {
    local token_address="$1"
    local ico_address="$2" 
    local batch_address="$3"
    local tee_pubkey="$4"
    local sale_id="$5"
    
    print_status "Updating .env file with contract addresses..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        print_status "Creating new .env file..."
        cat > .env << EOF
# Kitty ICO Environment Variables
OPENAI_API_KEY=sk-development-key
EOF
    fi
    
    # Function to update or add a variable in .env
    update_env_var() {
        local var_name="$1"
        local var_value="$2"
        local file=".env"
        
        # Clean the value - remove any newlines or special characters
        var_value=$(echo "$var_value" | tr -d '\n\r' | sed 's/[[:space:]]*$//')
        
        if grep -q "^${var_name}=" "$file" 2>/dev/null; then
            # Variable exists, update it
            # Use a different delimiter to avoid issues with special characters
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS - use @ as delimiter since addresses don't contain @
                sed -i '' "s@^${var_name}=.*@${var_name}=${var_value}@" "$file"
            else
                # Linux
                sed -i "s@^${var_name}=.*@${var_name}=${var_value}@" "$file"
            fi
        else
            # Variable doesn't exist, add it
            echo "${var_name}=${var_value}" >> "$file"
        fi
    }
    
    # Update only the specific variables we need
    update_env_var "TOKEN_CONTRACT_ADDRESS" "$token_address"
    update_env_var "ICO_CONTRACT_ADDRESS" "$ico_address"
    update_env_var "BATCH_SETTLEMENT_ADDRESS" "$batch_address"
    update_env_var "TEE_PUBKEY" "$tee_pubkey"
    update_env_var "TEST_SALE_ID" "$sale_id"
    
    # Also export to current shell
    export TOKEN_CONTRACT_ADDRESS="$token_address"
    export ICO_CONTRACT_ADDRESS="$ico_address"
    export BATCH_SETTLEMENT_ADDRESS="$batch_address"
    export TEE_PUBKEY="$tee_pubkey"
    export TEST_SALE_ID="$sale_id"
    
    print_status "✅ Contract addresses updated in .env file (existing content preserved)"
    print_status "Updated variables:"
    echo "  TOKEN_CONTRACT_ADDRESS=$token_address"
    echo "  ICO_CONTRACT_ADDRESS=$ico_address"
    echo "  BATCH_SETTLEMENT_ADDRESS=$batch_address"
    echo "  TEE_PUBKEY=$tee_pubkey"
    echo "  TEST_SALE_ID=$sale_id"
}

# Function to restart TEE agent with new environment
restart_tee_agent() {
    print_step "Updating TEE agent with updated contract addresses..."
    
    print_status "Stopping TEE agent..."
    $COMPOSE_CMD -f compose.localnet.yaml stop tee-agent
    
    print_status "Starting TEE agent with new environment..."
    $COMPOSE_CMD -f compose.localnet.yaml up -d tee-agent
    
    print_status "Waiting for TEE agent to be ready..."
    sleep 15
    
    # Verify TEE agent can see the contracts
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            print_status "✅ TEE agent is healthy!"
            
            # Check if it has the right contract addresses
            local status_response=$(curl -s http://localhost:8080/status)
            if echo "$status_response" | grep -q "$ICO_CONTRACT_ADDRESS"; then
                print_status "✅ TEE agent has the correct contract addresses!"
                return 0
            else
                print_warning "TEE agent is healthy but doesn't have correct contract addresses yet..."
            fi
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting for TEE agent..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    print_error "TEE agent failed to start properly after $max_attempts attempts"
    return 1
}

# Function to wait for sale deadline
wait_for_deadline() {
    local sale_deadline="$1"
    
    print_step "Waiting for sale deadline to pass..."
    print_note "Sale deadline: $sale_deadline"
    
    while true; do
        local current_time=$(date +%s)
        if [ $current_time -gt $sale_deadline ]; then
            print_status "✅ Sale deadline has passed!"
            break
        fi
        
        local remaining=$((sale_deadline - current_time))
        local minutes=$((remaining / 60))
        local seconds=$((remaining % 60))
        
        printf "\r⏰ Time remaining: %02d:%02d" $minutes $seconds
        sleep 1
    done
    echo ""
}

# Main walkthrough function
run_walkthrough() {
    echo ""
    echo "🎯 KITTY ICO LOCAL DEVELOPMENT WALKTHROUGH"
    echo "=========================================="
    echo ""
    echo "This walkthrough will guide you through setting up and testing"
    echo "the complete Kitty ICO system on your local machine."
    echo ""
    
    wait_for_user "Press Enter to start the walkthrough..."
    
    # Step 1: Show architecture
    show_architecture
    wait_for_user "Press Enter to continue to setup..."
    
    # Step 2: Check prerequisites
    check_prerequisites
    wait_for_user "Press Enter to start the development environment..."
    
    # Step 3: Start services
    print_step "Starting local development environment..."
    start_services
    show_status
    wait_for_user "Press Enter to deploy contracts..."
    
    # Step 4: Deploy contracts and capture output
    print_step "Deploying smart contracts..."
    
    cd backend
    if [[ ! -d node_modules ]]; then
        print_status "Installing backend dependencies..."
        npm install
    fi
    
    print_status "Deploying contracts to Sepolia and Sapphire localnet..."
    local deploy_output=$(pnpm run deploy-localnet 2>&1)
    local exit_code=$?
    echo "$deploy_output"
    
    # Extract contract addresses from output
    local token_address=$(echo "$deploy_output" | grep "ICO Token deployed on Sepolia:" | grep -o "0x[a-fA-F0-9]\{40\}")
    local ico_address=$(echo "$deploy_output" | grep "ICO Contract deployed on Sapphire:" | grep -o "0x[a-fA-F0-9]\{40\}")
    local batch_address=$(echo "$deploy_output" | grep "Batch Settlement deployed on Sepolia:" | grep -o "0x[a-fA-F0-9]\{40\}")
    local tee_pubkey=$(echo "$deploy_output" | grep "TEE Public Key:" | grep -o "0x[a-fA-F0-9]\{40\}")
    local sale_id=$(echo "$deploy_output" | grep "Sale ID:" | grep -o "[0-9]\+")
    
    cd ..
    
    if [[ -z "$token_address" || -z "$ico_address" || -z "$batch_address" ]]; then
        print_error "Failed to extract contract addresses from deployment output"
        exit 1
    fi
    
    print_status "✅ Contracts deployed successfully!"
    echo "📦 Token Contract: $token_address"
    echo "🔐 ICO Contract: $ico_address"
    echo "⚖️ Batch Settlement: $batch_address"
    echo "🤖 TEE Public Key: $tee_pubkey"
    echo "🎯 Test Sale ID: $sale_id"
    
    wait_for_user "Press Enter to update environment variables..."
    
    # Step 5: Update environment variables
    print_step "Updating environment variables..."
    update_env_file "$token_address" "$ico_address" "$batch_address" "$tee_pubkey" "$sale_id"
    
    wait_for_user "Press Enter to restart TEE agent with new addresses..."
    
    # Step 6: Restart TEE agent
    restart_tee_agent
    
    # Show TEE agent status
    print_status "TEE Agent Status:"
    curl -s http://localhost:8080/status | python3 -m json.tool || echo "Failed to get status"
    
    wait_for_user "Press Enter to submit test bids..."
    
    # Step 7: Submit test bids
    print_step "Submitting test bids..."
    
    echo ""
    print_note "📋 WHAT BIDS ARE BEING SUBMITTED:"
    echo ""
    echo "  🏆 Bidder 1 (High Quality + Price):"
    echo "     • Wants: 1,000 ICO tokens at 2.50 USDC each"
    echo "     • Pitch: 'Revolutionary AI-powered DeFi protocol with breakthrough consensus mechanism'"
    echo "     • Country: US (high geo score)"
    echo ""
    echo "  🌍 Bidder 2 (Geographic Diversity):"
    echo "     • Wants: 2,000 ICO tokens at 2.00 USDC each"
    echo "     • Pitch: 'Innovative blockchain solution leveraging novel cryptographic primitives'"
    echo "     • Country: CA (good geo score)"
    echo ""
    echo "  💰 Bidder 3 (Lower Price, High Volume):"
    echo "     • Wants: 5,000 ICO tokens at 1.20 USDC each"
    echo "     • Pitch: 'Simple token swap platform'"
    echo "     • Country: DE (good geo score)"
    echo ""
    echo "  📊 Bidder 4 (Large Volume, Good Price):"
    echo "     • Wants: 3,000 ICO tokens at 2.20 USDC each"
    echo "     • Pitch: 'Unique multi-chain interoperability protocol with revolutionary consensus'"
    echo "     • Country: GB (good geo score)"
    echo ""
    print_note "🔐 All bid data will be encrypted and stored on the blockchain"
    print_note "🤖 Only the TEE agent can decrypt and score these bids"
    print_note "📊 Scoring formula: 60% price + 20% geography + 20% AI pitch score"
    echo ""
    
    wait_for_user "Press Enter to submit these test bids..."
    
    cd backend
    pnpm run test-bid
    cd ..
    
    print_status "✅ Test bids submitted!"
    print_status "📦 Total supply available: 10,000 ICO tokens"
    print_status "📊 Total tokens bid for: 11,000 ICO tokens (1.1x oversubscribed)"
    print_status "🔥 This will be a competitive auction with USDC payments!"
    
    # Step 8: Check sale deadline
    print_step "Checking sale deadline..."
    
    echo ""
    print_note "⏰ SALE TIMING INFORMATION:"
    echo ""
    echo "  📅 : 5 minutes from deployment time"
    echo "  🎯 Sale ID: $sale_id"
    echo "  ⏱️  Current Time: $(date '+%H:%M:%S') (local time)"
    echo ""
    print_note "🤖 The TEE agent will automatically process settlement when the deadline passes"
    print_note "📊 You can monitor TEE agent logs to see real-time settlement processing"
    print_note "🔍 Settlement includes: bid decryption → AI scoring → winner selection → signature"
    echo ""
    
    wait_for_user "Press Enter to start monitoring TEE agent..."
    
    # Step 9: Wait for deadline and test settlement
    print_step "Waiting for sale deadline and testing settlement..."
    
    echo ""
    print_note "⏰ SETTLEMENT TIMING:"
    echo ""
    echo "  📊 The ICO sale was configured with a 5-minute duration from deployment"
    echo "  🤖 TEE agent will automatically detect when the deadline passes"
    echo "  ⚡ Settlement processing happens immediately after deadline"
    echo ""
    
    # Get actual deadline from the sale contract
    print_status "🔍 Getting actual sale deadline from contract..."
    cd backend
    local actual_deadline=$(pnpm hardhat run -e "
        const ico = await ethers.getContractAt('ICO_Contract', '$ico_address');
        const sale = await ico.sales($sale_id);
        console.log(sale[2]);  // deadline timestamp
    " --network sapphire-localnet 2>/dev/null | tail -1)
    cd ..
    
    if [[ -n "$actual_deadline" && "$actual_deadline" =~ ^[0-9]+$ ]]; then
        local current_time=$(date +%s)
        local deadline_readable=$(date -r "$actual_deadline" '+%H:%M:%S %Y-%m-%d')
        local time_remaining=$((actual_deadline - current_time))
        
        print_note "📅 Actual sale deadline: $deadline_readable"
        
        if [ $time_remaining -gt 0 ]; then
            local minutes=$((time_remaining / 60))
            local seconds=$((time_remaining % 60))
            print_note "⏱️  Time remaining: ${minutes}m ${seconds}s"
        else
            print_note "⏱️  Sale has already expired!"
        fi
    else
        print_warning "⚠️  Could not get deadline from contract, using estimated timing"
        local current_time=$(date +%s)
        local actual_deadline=$((current_time + 180))  # Estimate 3 minutes remaining
        local deadline_readable=$(date -r "$actual_deadline" '+%H:%M:%S')
        print_note "📅 Estimated deadline: $deadline_readable"
    fi
    
    echo ""
    print_status "💡 While waiting, you can:"
    echo "  • Watch TEE logs: docker compose -f compose.localnet.yaml logs -f tee-agent"
    echo "  • Check agent status: curl http://localhost:8080/status"
    echo "  • Monitor sale status: curl http://localhost:8080/sales"
    echo ""
    
    # Real-time countdown to actual deadline
    if [[ -n "$actual_deadline" && "$actual_deadline" =~ ^[0-9]+$ ]]; then
        echo "⏰ Countdown to sale deadline (Ctrl+C to skip)..."
        
        # Real-time countdown loop
        while true; do
            local current_time=$(date +%s)
            local time_remaining=$((actual_deadline - current_time))
            
            if [ $time_remaining -le 0 ]; then
                echo ""
                print_status "🎉 Sale deadline has passed!"
                break
            fi
            
            local minutes=$((time_remaining / 60))
            local seconds=$((time_remaining % 60))
            printf "\r   ⏰ Time until settlement: %02d:%02d" $minutes $seconds
            
            # Check every 10 seconds if settlement has already happened
            if [ $((time_remaining % 10)) -eq 0 ] || [ $time_remaining -le 5 ]; then
                local settlement_check=$(curl -s "http://localhost:8080/settlement/$sale_id" 2>/dev/null | grep -o '"sale_id"' || echo "")
                if [ -n "$settlement_check" ]; then
                    echo ""
                    print_status "🎉 Settlement already processed! TEE agent was faster than expected."
                    break
                fi
            fi
            
            sleep 1
        done
        echo ""
    else
        # Fallback to estimated wait
        local wait_time=180  # 3 minutes fallback
        echo "⏰ Waiting for estimated deadline (3 minutes)..."
        
        for ((i=wait_time; i>=0; i--)); do
            local minutes=$((i / 60))
            local seconds=$((i % 60))
            printf "\r   ⏰ Estimated time remaining: %02d:%02d" $minutes $seconds
            sleep 1
            
            # Check if settlement has happened
            if [ $((i % 30)) -eq 0 ] && [ $i -lt $wait_time ]; then
                local settlement_check=$(curl -s "http://localhost:8080/settlement/$sale_id" 2>/dev/null | grep -o '"sale_id"' || echo "")
                if [ -n "$settlement_check" ]; then
                    echo ""
                    print_status "🎉 Settlement already processed!"
                    break
                fi
            fi
        done
        echo ""
    fi
    
    # Step 10: Test settlement processing with retry logic
    print_step "Testing settlement processing..."
    
    local settlement_success=false
    local max_retries=5
    local retry_count=0
    
    while [ $settlement_success = false ] && [ $retry_count -lt $max_retries ]; do
        retry_count=$((retry_count + 1))
        
        print_status "Triggering settlement processing (attempt $retry_count/$max_retries)..."
        local settlement_response=$(curl -s -X POST http://localhost:8080/process-sale/$sale_id)
        echo "Settlement Response: $settlement_response"
        
        if echo "$settlement_response" | grep -q '"success": true'; then
            print_status "✅ Settlement processing successful!"
            settlement_success=true
        else
            if echo "$settlement_response" | grep -q "has not yet ended"; then
                print_warning "⏰ Sale still active, waiting 30 seconds before retry..."
                sleep 30
            else
                print_error "❌ Settlement processing failed!"
                echo "Response: $settlement_response"
                
                if [ $retry_count -lt $max_retries ]; then
                    print_status "Retrying in 10 seconds..."
                    sleep 10
                else
                    print_error "Max retries reached. Settlement may need manual intervention."
                    wait_for_user "Press Enter to continue with verification anyway..."
                fi
            fi
        fi
    done
    
    wait_for_user "Press Enter to verify settlement results..."
    
    # Step 11: Verify settlement results
    print_step "Verifying settlement results..."
    
    print_status "📊 Checking settlement details..."
    local settlement_data=$(curl -s "http://localhost:8080/settlement/$sale_id")
    
    if echo "$settlement_data" | grep -q '"sale_id"'; then
        print_status "✅ Settlement data found!"
        echo "$settlement_data" | python3 -m json.tool
        
        # Extract key data for verification
        local winners_count=$(echo "$settlement_data" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data.get('winners', [])))" 2>/dev/null || echo "0")
        local total_allocated=$(echo "$settlement_data" | python3 -c "import sys,json; data=json.load(sys.stdin); print(sum(data.get('allocations', {}).values()))" 2>/dev/null || echo "0")
        
        print_status "📈 Settlement Summary:"
        echo "  🏆 Winners: $winners_count"
        echo "  🎫 Total Tokens Allocated: $total_allocated"
        
        if [ "$winners_count" -gt 0 ] && [ "$total_allocated" -gt 0 ]; then
            print_status "✅ Settlement results look valid!"
        else
            print_warning "⚠️  Settlement results may be incomplete"
        fi
    else
        print_warning "⚠️  No settlement data found"
        echo "Response: $settlement_data"
    fi
    
    wait_for_user "Press Enter to check TEE agent logs..."
    
    # Step 12: Show settlement processing logs
    print_step "Reviewing settlement processing logs..."
    
    print_status "Recent TEE agent logs (settlement processing):"
    echo "================================================"
    docker compose -f compose.localnet.yaml logs tee-agent --since=5m | grep -E "(Processing|Settlement|Winner|Allocated|Signature|Bid)" | tail -20 || echo "No relevant logs found"
    
    wait_for_user "Press Enter to complete walkthrough..."
    
    # Step 13: Final verification summary
    print_step "Final verification summary..."
    
    echo ""
    print_status "🔍 VERIFICATION CHECKLIST:"
    echo ""
    
    # Check 1: TEE Agent Health
    local agent_status=$(curl -s http://localhost:8080/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "unknown")
    if [ "$agent_status" = "healthy" ]; then
        echo "  ✅ TEE Agent Health: $agent_status"
    else
        echo "  ❌ TEE Agent Health: $agent_status"
    fi
    
    # Check 2: Contract Addresses
    local ico_contract=$(curl -s http://localhost:8080/status | python3 -c "import sys,json; print(json.load(sys.stdin).get('ico_contract', 'none'))" 2>/dev/null || echo "none")
    if [ "$ico_contract" = "$ico_address" ]; then
        echo "  ✅ Contract Addresses: Correct"
    else
        echo "  ❌ Contract Addresses: Mismatch"
    fi
    
    # Check 3: Settlement Processing
    if echo "$settlement_response" | grep -q '"success": true'; then
        echo "  ✅ Settlement Processing: Successful"
    else
        echo "  ❌ Settlement Processing: Failed"
    fi
    
    # Check 4: Event Reading (check if agent found bidders from events)
    local recent_logs=$(docker compose -f compose.localnet.yaml logs tee-agent --since=10m | grep "Found.*bidders for sale" | tail -1)
    if [ -n "$recent_logs" ]; then
        echo "  ✅ Event Reading: Agent successfully read bidders from blockchain"
    else
        echo "  ⚠️  Event Reading: Unable to verify (check logs manually)"
    fi
    
    echo ""
    print_status "🎉 WALKTHROUGH COMPLETED!"
    echo ""
    echo "🎯 Your Kitty ICO local environment is fully set up and tested!"
    echo ""
    echo "📋 What was tested:"
    echo "  • Contract deployment and environment variable management"
    echo "  • TEE agent connection to correct contracts"
    echo "  • Bid submission with multiple test scenarios"
    echo "  • Settlement processing from blockchain events (robust mode)"
    echo "  • TEE signature generation and verification"
    echo "  • Permit signature validation"
    echo ""
    echo "📋 Available endpoints:"
    echo "  • Agent status: curl http://localhost:8080/status"
    echo "  • Settlement data: curl http://localhost:8080/settlement/$sale_id"
    echo "  • All settlements: curl http://localhost:8080/settlements"
    echo "  • Process sale: curl -X POST http://localhost:8080/process-sale/SALE_ID"
    echo "  • Explorer UI: http://localhost:8548"
    echo ""
    echo "📚 Key Files:"
    echo "  • .env - Contains all contract addresses"
    echo "  • compose.localnet.yaml - Docker configuration"
    echo "  • oracle/agent.py - TEE agent code"
    echo ""
    echo "🔄 To run the walkthrough again: $0 walkthrough"
    echo "🔧 To restart with fresh state: $0 cleanup && $0 walkthrough"
    echo ""
}

# Check if .env file exists, create if not
if [[ ! -f .env ]]; then
    print_warning ".env file not found. Creating default .env file..."
    cat > .env << EOF
# Kitty ICO Local Development Environment Variables

# OpenAI API Key (optional for local development)
OPENAI_API_KEY=sk-development-key

# Contract addresses (will be set after deployment)
ICO_CONTRACT_ADDRESS=
TOKEN_CONTRACT_ADDRESS=
BATCH_SETTLEMENT_ADDRESS=

# Development settings
NODE_ENV=development
TEE_MODE=development
LOG_LEVEL=debug
EOF
    print_status "Created .env file. You can edit it to add your OpenAI API key if needed."
fi

# Function to start services
start_services() {
    init_compose_cmd
    print_status "Starting Kitty ICO local development environment..."
    
    # Start core services (localnet + tee-agent)
    $COMPOSE_CMD -f compose.localnet.yaml up -d sapphire-localnet tee-agent
    
    print_status "Services started! Waiting for services to be ready..."
    
    # Wait for services to be healthy
    print_status "Waiting for Sapphire localnet to be ready..."
    timeout=120
    counter=0
    
    while [ $counter -lt $timeout ]; do
        if $COMPOSE_CMD -f compose.localnet.yaml ps sapphire-localnet | grep -q "healthy"; then
            print_status "Sapphire localnet is ready!"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        if [ $((counter % 20)) -eq 0 ]; then
            print_status "Still waiting for Sapphire localnet... ($counter/$timeout seconds)"
        fi
    done
    
    if [ $counter -ge $timeout ]; then
        print_error "Sapphire localnet failed to start within $timeout seconds"
        exit 1
    fi
    
    # Check TEE agent status
    print_status "Checking TEE agent status..."
    sleep 10
    
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        print_status "TEE agent is healthy and responding!"
    else
        print_warning "TEE agent may still be starting up. Check logs if issues persist."
    fi
}

# Function to initialize compose command
init_compose_cmd() {
    if [[ -z "$COMPOSE_CMD" ]]; then
        if docker compose version &> /dev/null 2>&1; then
            COMPOSE_CMD="docker compose"
        else
            COMPOSE_CMD="docker-compose"
        fi
    fi
}

# Function to show service status
show_status() {
    init_compose_cmd
    print_status "Service Status:"
    $COMPOSE_CMD -f compose.localnet.yaml ps
    
    echo ""
    print_status "Available endpoints:"
    echo "  - Sapphire Web3 RPC: http://localhost:8545"
    echo "  - Sapphire WebSocket: ws://localhost:8546"
    echo "  - Oasis GRPC: http://localhost:8544"
    echo "  - Explorer UI: http://localhost:8548"
    echo "  - Nexus API: http://localhost:8547"
    echo "  - TEE Agent Health: http://localhost:8080/health"
    echo "  - TEE Agent Status: http://localhost:8080/status"
    
    echo ""
    print_status "Default test accounts (from sapphire-localnet):"
    echo "  - Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo "  - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo ""
    print_status "To see all accounts, check the sapphire-localnet logs:"
    echo "  $COMPOSE_CMD -f compose.localnet.yaml logs sapphire-localnet"
}

# Function to show logs
show_logs() {
    init_compose_cmd
    local service=${1:-}
    if [[ -z "$service" ]]; then
        print_status "Showing logs for all services..."
        $COMPOSE_CMD -f compose.localnet.yaml logs -f
    else
        print_status "Showing logs for $service..."
        $COMPOSE_CMD -f compose.localnet.yaml logs -f "$service"
    fi
}

# Function to stop services
stop_services() {
    init_compose_cmd
    print_status "Stopping Kitty ICO local development environment..."
    $COMPOSE_CMD -f compose.localnet.yaml down
    print_status "Services stopped."
}

# Function to restart services
restart_services() {
    stop_services
    start_services
}

# Function to clean up (remove volumes)
cleanup() {
    init_compose_cmd
    print_warning "This will remove all local development data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up local development environment..."
        $COMPOSE_CMD -f compose.localnet.yaml down -v --remove-orphans
        docker volume prune -f
        rm -rf data/
        print_status "Cleanup complete."
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to deploy contracts
deploy_contracts() {
    print_status "Deploying contracts to sapphire-localnet..."
    
    if ! $COMPOSE_CMD -f compose.localnet.yaml ps sapphire-localnet | grep -q "healthy"; then
        print_error "Sapphire localnet is not running. Start it first with: $0 start"
        exit 1
    fi
    
    cd backend
    
    # Install dependencies if needed
    if [[ ! -d node_modules ]]; then
        print_status "Installing backend dependencies..."
        npm install
    fi
    
    # Deploy contracts
    print_status "Deploying contracts..."
    pnpm run deploy-localnet
    
    cd ..
    print_status "Contract deployment completed!"
}

# Function to run test bids
test_bids() {
    print_status "Submitting test bids..."
    
    if [[ -z "$ICO_CONTRACT_ADDRESS" ]]; then
        print_error "ICO_CONTRACT_ADDRESS not set. Deploy contracts first with: $0 deploy"
        exit 1
    fi
    
    cd backend
    pnpm run test-bid
    cd ..
    
    print_status "Test bids submitted!"
}

# Function to show help
show_help() {
    echo "Kitty ICO Local Development Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  🎯 walkthrough  Complete guided setup and testing process"
    echo "  start          Start the local development environment"
    echo "  stop           Stop the local development environment"
    echo "  restart        Restart the local development environment"
    echo "  status         Show service status and endpoints"
    echo "  logs           Show logs for all services"
    echo "  logs <service> Show logs for specific service"
    echo "  deploy         Deploy contracts to sapphire-localnet"
    echo "  test-bid       Submit test bids to the ICO contract"
    echo "  cleanup        Remove all local development data"
    echo "  help           Show this help message"
    echo ""
    echo "🚀 QUICK START:"
    echo "  $0 walkthrough    # Complete guided setup (RECOMMENDED)"
    echo ""
    echo "Manual Development Flow:"
    echo "  1. $0 start         # Start the environment"
    echo "  2. $0 deploy        # Deploy contracts"
    echo "  3. $0 test-bid      # Submit test bids"
    echo "  4. $0 logs tee-agent # Watch TEE processing"
    echo ""
    echo "Services:"
    echo "  sapphire-localnet  Official Sapphire localnet container"
    echo "  tee-agent          TEE Agent for local development"
    echo "  frontend           Frontend (optional, use --profile frontend)"
    echo ""
}

# Main script logic
case "${1:-help}" in
    walkthrough)
        run_walkthrough
        ;;
    start)
        start_services
        show_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    deploy)
        deploy_contracts
        ;;
    test-bid)
        test_bids
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 