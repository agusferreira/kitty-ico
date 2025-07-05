# Docker Compose Configuration Guide

This project uses multiple Docker Compose files for different development and deployment environments. Each file is optimized for its specific use case.

## 📁 Compose Files Overview

### `compose.yaml` - Local Development
**Purpose**: Local development and testing on your machine

**Features**:
- ✅ No registry requirements
- ✅ Local builds only
- ✅ Hot reload with volume mounts
- ✅ Debug logging enabled
- ✅ Development environment variables
- ✅ Port exposure for local testing

**When to use**:
- Developing and testing TEE agent locally
- Rapid iteration during development
- No need for cross-platform builds

**Commands**:
```bash
kitty dev-start    # Start local development environment
kitty dev-stop     # Stop local development environment
```

### `compose.testnet.yaml` - Testnet Deployment
**Purpose**: Production testnet deployment

**Features**:
- ✅ Registry image required (`agusferreira906/kitty-ico-tee-agent:latest`)
- ✅ Cross-platform support (Mac → Linux/amd64)
- ✅ Platform specification for TDX compatibility
- ✅ Production environment variables
- ✅ Testnet network configuration
- ✅ Production logging levels
- ❌ No port exposure for security
- ❌ No volume mounts for security

**When to use**:
- Deploying to Sapphire Testnet
- Building ROFL bundles for production
- Cross-platform deployment from Mac

**Commands**:
```bash
kitty docker-build-push -u YOUR_USERNAME  # Build and push to registry
kitty rofl-build-docker                   # Build ROFL bundle
kitty rofl-deploy                         # Deploy to testnet
```

### `compose.localnet.yaml` - Localnet Testing
**Purpose**: Testing with Oasis localnet

**Features**:
- ✅ Connects to local Oasis network
- ✅ Simulates full Oasis environment
- ✅ Integration testing

**When to use**:
- Testing against a full Oasis stack locally
- Integration testing before testnet deployment

## 🚀 Workflow Examples

### Local Development Workflow
```bash
# 1. Start local development
kitty dev-start

# 2. Your TEE agent is available at http://localhost:8080
# 3. Make changes to oracle/agent.py - they reload automatically
# 4. Test your changes

# 5. Stop when done
kitty dev-stop
```

### Testnet Deployment Workflow
```bash
# 1. Build and push your container to registry
kitty docker-build-push -u YOUR_USERNAME

# 2. Build ROFL bundle using official Oasis container
kitty rofl-build-docker

# 3. Deploy to testnet
kitty rofl-deploy
```

### Complete Development-to-Production Flow
```bash
# 1. Local Development
kitty dev-start                           # Develop locally
# ... make changes, test ...
kitty dev-stop

# 2. Registry Preparation
kitty docker-build-push -u YOUR_USERNAME  # Prepare for testnet

# 3. Testnet Deployment
kitty rofl-build-docker                   # Build production bundle
kitty rofl-deploy                         # Deploy to testnet
```

## 🔧 Configuration Details

### Environment Variables by Environment

| Variable | Local Dev | Testnet | Localnet |
|----------|-----------|---------|----------|
| `OASIS_NETWORK` | `localnet` | `testnet` | `localnet` |
| `ETHEREUM_NETWORK` | `localhost` | `sepolia` | `localhost` |
| `SAPPHIRE_RPC_URL` | `http://localhost:8545` | `https://testnet.sapphire.oasis.dev` | `http://localhost:8545` |
| `TEE_MODE` | `development` | `production` | `development` |
| `LOG_LEVEL` | `debug` | `info` | `debug` |

### Platform Requirements

- **Local Development**: Uses your native platform (Mac/Linux)
- **Testnet Deployment**: Requires `linux/amd64` for TDX compatibility
- **Localnet Testing**: Uses your native platform

## 🛠️ Best Practices

### 1. Environment Separation
- **Never** use production settings in development
- **Always** use the appropriate compose file for your environment
- **Keep** sensitive data in environment variables, not in compose files

### 2. Registry Management
- **Only** push to registry when deploying to testnet
- **Use** semantic versioning for image tags in production
- **Keep** registry images private unless intentionally public

### 3. Development Workflow
- **Start** with local development (`compose.yaml`)
- **Test** against localnet when needed (`compose.localnet.yaml`)
- **Deploy** to testnet only after local testing (`compose.testnet.yaml`)

### 4. Security Considerations
- **Local**: Full debugging and access enabled
- **Testnet**: Production security - no unnecessary port exposure
- **Always** use different API keys for different environments

## 🔍 Troubleshooting

### Common Issues

1. **"Image platform mismatch"**
   - Ensure you're using `compose.testnet.yaml` for cross-platform builds
   - Check that `platform: linux/amd64` is specified

2. **"Registry access denied"**
   - Make sure you've run `docker login`
   - Verify your registry permissions
   - Use `kitty docker-build-push` to handle the process

3. **"Container not found"**
   - Run `kitty docker-build-push` first for testnet deployment
   - Verify the image exists in your registry

### Getting Help

Use the interactive CLI for guided workflows:
```bash
kitty menu    # Interactive menu with all options
kitty workflow  # Complete workflow guide
``` 