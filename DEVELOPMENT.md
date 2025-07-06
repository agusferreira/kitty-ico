# Local Development Guide

This guide explains how to set up and run the Kitty ICO TEE Agent locally for development and testing.

## Prerequisites

- **Docker Desktop** (installed and running)
- **macOS** (Apple Silicon supported)
- **16GB+ RAM** (required for sapphire-localnet)

## Quick Start

1. **Start the development environment:**
   ```bash
   ./dev-local.sh start
   ```

2. **Check service status:**
   ```bash
   ./dev-local.sh status
   ```

3. **View logs:**
   ```bash
   ./dev-local.sh logs tee-agent
   ```

4. **Stop the environment:**
   ```bash
   ./dev-local.sh stop
   ```

## What's Included

The local development environment includes:

- **Sapphire Localnet**: Official Oasis Sapphire network simulator
- **TEE Agent**: Your Kitty ICO TEE agent in development mode
- **Explorer UI**: Web interface for blockchain exploration
- **Health Endpoints**: API endpoints for monitoring

## Available Endpoints

After starting the environment, you can access:

- **Sapphire Web3 RPC**: `http://localhost:8545`
- **Sapphire WebSocket**: `ws://localhost:8546`
- **Explorer UI**: `http://localhost:8548`
- **TEE Agent Health**: `http://localhost:8080/health`
- **TEE Agent Status**: `http://localhost:8080/status`

## Test Accounts

The sapphire-localnet provides pre-funded test accounts:

```
Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Balance: 10000 TEST
```

For more accounts, check the sapphire-localnet logs:
```bash
./dev-local.sh logs sapphire-localnet
```

## Development Features

### TEE Agent Configuration

The TEE agent runs in development mode with:

- **No real TEE**: Simulates TEE functionality without hardware requirements
- **Relaxed security**: Simplified for development and testing
- **Hot reload**: Source code changes are reflected (requires restart)
- **Health endpoints**: Monitor agent status via HTTP

### Environment Variables

Key environment variables for development:

```bash
# Development mode
NODE_ENV=development
TEE_MODE=development
LOG_LEVEL=debug

# Network endpoints
SAPPHIRE_RPC_URL=http://sapphire-localnet:8545
ETHEREUM_RPC_URL=http://sapphire-localnet:8545

# Optional API keys
OPENAI_API_KEY=sk-development-key  # Default for testing
```

## Development Workflow

1. **Start environment**: `./dev-local.sh start`
2. **Deploy contracts**: Use the blockchain endpoints to deploy your contracts
3. **Test TEE logic**: The agent will process events and execute TEE functions
4. **Monitor logs**: `./dev-local.sh logs tee-agent`
5. **Iterate**: Make changes and restart as needed

## Troubleshooting

### Common Issues

**Services won't start:**
- Check if Docker is running
- Ensure ports 8544-8548 and 8080 are available
- Try `./dev-local.sh cleanup` to reset

**TEE agent health check fails:**
- Wait a few minutes for startup
- Check logs: `./dev-local.sh logs tee-agent`
- Restart: `./dev-local.sh restart`

**Out of memory:**
- Increase Docker memory allocation to 8GB+
- Close other memory-intensive applications

### macOS Specific

- **Apple Silicon**: The script automatically configures `linux/x86_64` platform
- **Docker Desktop**: Ensure "Use Docker Compose V2" is enabled
- **Memory**: Allocate at least 8GB to Docker Desktop

## Advanced Usage

### Custom Configuration

Edit `.env` file to customize:
```bash
# Add your OpenAI API key
OPENAI_API_KEY=your-real-api-key

# Set contract addresses after deployment
ICO_CONTRACT_ADDRESS=0x...
TOKEN_CONTRACT_ADDRESS=0x...
BATCH_SETTLEMENT_ADDRESS=0x...
```

### Frontend Development

To run the frontend alongside:
```bash
docker compose -f compose.localnet.yaml --profile frontend up -d
```

### Full Reset

To completely reset the development environment:
```bash
./dev-local.sh cleanup
```

## Next Steps

Once your local development is working:

1. **Deploy contracts** using the Web3 endpoints
2. **Test TEE functionality** with real contract events
3. **Validate** your implementation works correctly
4. **Deploy to testnet** using the production configuration

## Differences from Production

The local environment differs from production in:

- **No real TEE**: Uses simulated TEE functions
- **Single node**: No distributed consensus
- **Fast blocks**: 1-second block time vs production
- **Ephemeral**: Data is lost when containers stop
- **Development keys**: Uses fixed test accounts

This setup is perfect for development and testing, but remember to test on the actual testnet before production deployment. 