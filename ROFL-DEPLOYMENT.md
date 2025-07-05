# ROFL Testnet Deployment Guide

This guide explains how to deploy the Kitty ICO TEE Agent to the Sapphire Testnet using the Oasis ROFL marketplace.

## Prerequisites

1. **Oasis CLI**: Install the latest Oasis CLI
   ```bash
   curl -fsSL https://github.com/oasisprotocol/cli/releases/latest/download/oasis_linux_amd64 -o oasis
   chmod +x oasis
   sudo mv oasis /usr/local/bin/
   ```

2. **Wallet**: Set up an Oasis wallet with TEST tokens
   - Get testnet tokens from: https://faucet.testnet.oasis.dev
   - You'll need tokens to pay for ROFL deployment

3. **RPC Access**: Get RPC URLs for:
   - Ethereum Sepolia (e.g., Infura/Alchemy)
   - OpenAI API key for pitch scoring

## Step-by-Step Deployment

### 1. Local Setup and Configuration

```bash
# Setup TEE agent locally (generates EOA)
kitty tee-setup

# Configure environment variables
kitty tee-config
```

This creates a `.env` file with your configuration. Edit it to add your actual values:
```env
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
SAPPHIRE_RPC_URL=https://testnet.sapphire.oasis.dev
OPENAI_API_KEY=sk-your-openai-key-here
```

### 2. Build ROFL Bundle

```bash
# Build the ROFL bundle (.orc file)
kitty rofl-build
```

This command runs `oasis rofl build` which:
- Creates a deployable ROFL bundle
- Includes the Python TEE agent and all dependencies
- Validates the ROFL manifest (rofl.yaml)

### 3. Deploy to Testnet Marketplace

```bash
# Show available offers first
kitty rofl-deploy --show-offers

# Deploy to the marketplace
kitty rofl-deploy
```

The deployment process:
1. **Pushes** the ROFL bundle to an OCI repository
2. **Rents** a machine from the ROFL marketplace
3. **Starts** your TEE agent in a secure environment
4. **Generates** the actual TEE key within the secure enclave

### 4. Verify Deployment

```bash
# Check deployment status
kitty rofl-status

# View logs from the deployed ROFL
kitty rofl-logs
```

The status command shows:
- **Machine details**: Provider, resources, expiration
- **ROFL app status**: App ID, instances, nodes
- **TEE key**: The actual public key generated in the TEE

### 5. Deploy Smart Contracts

Once the ROFL is running and you have the TEE public key:

```bash
# Deploy ICO and token contracts using the TEE key
kitty deploy
```

The TEE public key from the deployed ROFL will be used to authorize the agent.

### 6. Fund the TEE Agent

Send TEST tokens to the TEE agent address for transaction gas:
- **Address**: Check `kitty rofl-status` for the TEE agent address
- **Amount**: ~5-10 TEST tokens should be sufficient
- **Faucet**: https://faucet.testnet.oasis.dev

### 7. Monitor and Manage

```bash
# Check status regularly
kitty rofl-status

# View logs for debugging
kitty rofl-logs

# If needed, stop the deployment
kitty rofl-stop
```

## ROFL Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sapphire Testnet                            │
│  ┌─────────────────┐              ┌─────────────────────────┐    │
│  │   ICO Contract  │◄─────────────┤    ROFL TEE Agent      │    │
│  │   (Private Bids)│              │  (Secure Processing)    │    │
│  └─────────────────┘              └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Cross-chain settlement
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Ethereum Sepolia                             │
│  ┌─────────────────┐              ┌─────────────────────────┐    │
│  │   KITTY Token   │              │   BatchSettlement       │    │
│  │                 │              │                         │    │
│  └─────────────────┘              └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Common Issues

1. **"No machine available"**: Try again or use different provider
2. **"Insufficient funds"**: Add more TEST tokens to your wallet
3. **"Build failed"**: Check Docker installation and rofl.yaml syntax
4. **"TEE key not found"**: Wait for ROFL deployment to complete

### Debugging

```bash
# Check ROFL app logs
kitty rofl-logs

# Verify ROFL bundle
oasis rofl build --verify

# Check machine status
oasis rofl machine show
```

### Resources

- **Oasis Explorer**: Monitor your ROFL deployment
- **Testnet Faucet**: https://faucet.testnet.oasis.dev
- **Documentation**: https://docs.oasis.io/runtime/rofl/
- **Discord Support**: https://discord.gg/oasisprotocol

## Cost Estimation

- **Deployment**: ~2-5 TEST tokens
- **Hourly Rate**: ~5 TEST/hour (varies by provider)
- **Daily Cost**: ~120 TEST tokens
- **Recommended Wallet**: 200+ TEST tokens for testing

## Security Notes

- TEE keys are generated within the secure enclave
- All bid data is processed privately within the TEE
- Cross-chain signatures are created securely
- Logs are unencrypted - avoid printing sensitive data
- Only app admin can access deployment logs 