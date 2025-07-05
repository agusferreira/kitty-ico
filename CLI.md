# 🐱 Kitty ICO CLI

A modern, interactive CLI tool for managing your ICO project with style! Built with Bun for blazing fast performance.

## ✨ Features

- **Interactive Menu**: Beautiful ASCII art banner with intuitive menu system
- **Smart Configuration**: Persistent config management with `.kitty-ico.json`
- **Multi-Network Support**: Deploy to local, testnet, or mainnet with ease
- **Real-time Feedback**: Spinners, colors, and progress indicators
- **Integrated Workflow**: Deploy, test, and develop all from one command

## 🚀 Quick Start

First, install Bun if you haven't already:
```bash
curl -fsSL https://bun.sh/install | bash
```

Then install dependencies:
```bash
pnpm install
```

## 🎯 Usage

### Interactive Menu (Recommended)
```bash
pnpm cli
# or
bun cli.ts
```

This opens an interactive menu where you can:
- 🚀 Deploy contracts
- 🧪 Run tests  
- 🔧 Start development
- ⚙️ Setup/Configure
- 📊 Show status

### Direct Commands

```bash
# Initial setup
pnpm setup

# Deploy contracts
pnpm deploy

# Run tests
pnpm test
pnpm test --watch  # Watch mode

# Start development
pnpm dev

# Show project status
pnpm status
```

## 🔧 Configuration

The CLI stores configuration in `.kitty-ico.json`:

```json
{
  "network": "sapphire-localnet",
  "tokenName": "Kitty ICO",
  "tokenSymbol": "KITTY",
  "icoAddress": "0x...",
  "tokenAddress": "0x...",
  "teePublicKey": "0x..."
}
```

## 🌐 Supported Networks

- **local**: Hardhat local network (fastest for testing)
- **sapphire-localnet**: Local Sapphire node
- **sapphire-testnet**: Sapphire testnet
- **sapphire-mainnet**: Sapphire mainnet

## 🎨 Why This CLI is Cool

1. **Bun-powered**: Lightning fast execution and TypeScript support out of the box
2. **Modern UX**: Beautiful prompts, colors, and spinners for great developer experience
3. **Zero Config**: Works out of the box, but highly configurable
4. **Persistent State**: Remembers your preferences between sessions
5. **Integrated Workflow**: All tools in one place - no more remembering complex commands

## 🔄 Workflow Example

```bash
# 1. First time setup
pnpm setup
# Choose network, configure token details, install deps

# 2. Deploy contracts
pnpm deploy
# Automatically uses your configuration

# 3. Run tests
pnpm test
# Verify everything works

# 4. Start development
pnpm dev
# Choose frontend, backend, or both
```

## 🤝 Contributing

The CLI is designed to be easily extensible. To add new commands:

1. Add the command to the `program` in `cli.ts`
2. Add the corresponding script to `package.json`
3. Update this README

## 🔮 Future Enhancements

- Contract verification
- Gas estimation
- Deployment history
- Multi-environment management
- Integration with block explorers
- Automated testing pipelines

---

*Built with ❤️ using Bun, Commander.js, and Inquirer* 