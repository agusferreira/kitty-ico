# 🚀 Kitty ICO Deployment Guide

Complete step-by-step deployment guide for the cross-chain Kitty ICO system.

## 🏗️ System Overview

The Kitty ICO system consists of:
- **ROLF TEE Agent**: Secure bid processing and settlement execution
- **Ethereum Contracts**: KITTY token and BatchSettlement (public chain)
- **Sapphire Contracts**: ICO contract for private bidding
- **Frontend**: React app for user interaction

## 📋 Prerequisites

- Node.js 18+
- Hardhat development environment
- Ethereum RPC access (Infura/Alchemy)
- OpenAI API key (for pitch scoring)
- Sepolia ETH (for testnet deployment)
- Sapphire testnet tokens

## 🔄 Deployment Process

### Step 0: Setup TEE Agent (FIRST!)

**⚠️ This must be done first** - the TEE agent generates the public key needed for contract deployment.

```bash
# Navigate to ROLF directory
cd backend/rolf

# Install dependencies
npm install

# Generate TEE agent and get public key
npm run setup
```

This will:
1. Generate a secure EOA within the TEE
2. Output the TEE public key (save this!)
3. Create `.env.generated` configuration file
4. Show complete setup instructions

**Save the TEE public key** - you'll need it for the next steps!

### Step 1: Deploy on Ethereum

Deploy the KITTY token and BatchSettlement contract on Ethereum:

```bash
# Navigate to backend
cd backend

# Deploy using the TEE public key from Step 0
TEE_PUBKEY=<your_tee_public_key> npx hardhat run deploy/00_deploy.ts --network sepolia
```

This will deploy:
- **KITTY Token**: ERC20 token with 1M initial supply
- **BatchSettlement Contract**: Handles atomic cross-chain settlements

**Save the contract addresses** shown in the output!

### Step 2: Deploy on Sapphire

Deploy the ICO contract on Sapphire network:

```bash
# Use the addresses from Step 1
TOKEN_CONTRACT_ADDRESS=<token_address> BATCH_SETTLEMENT_ADDR=<batch_address> TEE_PUBKEY=<tee_public_key> npx hardhat run deploy/00_deploy.ts --network sapphire-testnet
```

This will deploy:
- **ICO Contract**: Handles private bidding and winner selection

### Step 3: Configure TEE Agent

Update the TEE agent configuration:

```bash
cd backend/rolf

# Copy generated config
cp .env.generated .env

# Edit .env and add:
# - ETHEREUM_RPC_URL (your Infura/Alchemy endpoint)
# - OPENAI_API_KEY (for pitch scoring)
# - Contract addresses from deployment
```

### Step 4: Fund TEE Agent

The TEE agent needs ETH for gas costs:

```bash
# Send ETH to the TEE agent address
# Address: <your_tee_public_key>
# Amount: 0.1 ETH (testnet), 0.5 ETH (mainnet)
```

### Step 5: Start TEE Agent

```bash
cd backend/rolf
npm run dev
```

The agent will start monitoring for ICO events and processing settlements.

### Step 6: Configure Frontend

Update frontend configuration:

```bash
cd frontend

# Update src/constants/config.ts with contract addresses
```

### Step 7: Start Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🎯 Complete Deployment Example

Here's a complete example with real commands:

```bash
# Step 0: Setup TEE Agent
cd backend/rolf
npm install
npm run setup
# Output: TEE Public Key: 0x1234567890abcdef...

# Step 1: Deploy Ethereum
cd ../
TEE_PUBKEY=0x1234567890abcdef... npx hardhat run deploy/00_deploy.ts --network sepolia
# Output: 
# Token: 0xabc123...
# BatchSettlement: 0xdef456...

# Step 2: Deploy Sapphire
TOKEN_CONTRACT_ADDRESS=0xabc123... BATCH_SETTLEMENT_ADDR=0xdef456... TEE_PUBKEY=0x1234567890abcdef... npx hardhat run deploy/00_deploy.ts --network sapphire-testnet
# Output:
# ICO Contract: 0x789ghi...

# Step 3: Configure TEE Agent
cd backend/rolf
cp .env.generated .env
# Edit .env with your RPC URLs and API keys

# Step 4: Fund TEE Agent
# Send 0.1 ETH to 0x1234567890abcdef...

# Step 5: Start TEE Agent
npm run dev

# Step 6: Configure Frontend
cd ../../frontend
# Update config.ts with contract addresses

# Step 7: Start Frontend
npm install
npm run dev
```

## 🔧 Configuration Details

### TEE Agent Environment (.env)

```bash
# Networks
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
SAPPHIRE_RPC_URL=https://testnet.sapphire.oasis.io

# Contracts (from deployment)
ICO_CONTRACT_ADDRESS=0x789ghi...
BATCH_SETTLEMENT_ADDRESS=0xdef456...
TOKEN_CONTRACT_ADDRESS=0xabc123...
PAYMENT_TOKEN_ADDRESS=0x... # USDC/USDT/WETH

# AI
OPENAI_API_KEY=sk-...

# TEE (auto-generated)
TEE_PUBKEY=0x1234567890abcdef...
```

### Frontend Configuration (src/constants/config.ts)

```typescript
export const CONTRACTS = {
  ICO_CONTRACT: '0x789ghi...',
  KITTY_TOKEN: '0xabc123...',
  BATCH_SETTLEMENT: '0xdef456...',
  PAYMENT_TOKEN: '0x...' // USDC/USDT/WETH
}

export const NETWORKS = {
  ETHEREUM: 'sepolia',
  SAPPHIRE: 'sapphire-testnet'
}
```

## 📊 Verification Steps

### 1. Verify TEE Agent

```bash
# Check TEE agent status
curl http://localhost:3000/health

# Verify TEE public key matches
grep TEE_PUBKEY backend/rolf/.env
```

### 2. Verify Contracts

```bash
# Check BatchSettlement TEE key
npx hardhat console --network sepolia
> const batch = await ethers.getContractAt('BatchSettlement', '<batch_address>')
> await batch.teePublicKey()
# Should match your TEE public key

# Check ICO contract
npx hardhat console --network sapphire-testnet
> const ico = await ethers.getContractAt('ICO_Contract', '<ico_address>')
> await ico.teePublicKey()
# Should match your TEE public key
```

### 3. Verify Frontend

```bash
# Check if frontend connects to contracts
# Open browser to http://localhost:3000
# Should show contract addresses in developer console
```

## 🚨 Troubleshooting

### Common Issues

1. **"TEE_PUBKEY not found"**
   - Run Step 0 first: `cd backend/rolf && npm run setup`
   - Make sure to export the TEE_PUBKEY environment variable

2. **"Contract deployment failed"**
   - Check you have enough ETH for gas
   - Verify RPC endpoint is working
   - Ensure network configuration is correct

3. **"TEE agent fails to start"**
   - Check all environment variables are set
   - Verify contract addresses are correct
   - Ensure TEE agent is funded with ETH

4. **"Frontend can't connect to contracts"**
   - Update contract addresses in frontend config
   - Check network configuration
   - Verify contracts are deployed

### Debug Commands

```bash
# Check balances
npx hardhat console --network sepolia
> await ethers.provider.getBalance('<address>')

# Check contract state
> const contract = await ethers.getContractAt('ContractName', '<address>')
> await contract.someFunction()

# Check TEE agent logs
cd backend/rolf
npm run dev # View detailed logs
```

## 🔒 Security Checklist

Before mainnet deployment:

- [ ] TEE agent private key is secure
- [ ] Contract addresses are verified
- [ ] TEE agent has sufficient ETH balance
- [ ] OpenAI API key is secured
- [ ] RPC endpoints are reliable
- [ ] All contracts are audited
- [ ] Test the complete flow on testnet

## 📈 Post-Deployment

### Create a Sale

```bash
# Connect to ICO contract
npx hardhat console --network sapphire-testnet
> const ico = await ethers.getContractAt('ICO_Contract', '<ico_address>')
> await ico.createSale(
    ethers.parseEther('1000'), // 1000 tokens
    ethers.parseEther('0.1'),  // min price 0.1 ETH
    ethers.parseEther('1.0'),  // max price 1.0 ETH
    3600                       // 1 hour duration
  )
```

### Monitor TEE Agent

```bash
# Check agent status
curl http://localhost:3000/health

# View settlement stats
curl http://localhost:3000/stats
```

### Frontend Usage

1. Open http://localhost:3000
2. Connect wallet
3. Browse available sales
4. Submit encrypted bids
5. Monitor settlement results

## 🎉 Success!

If you've completed all steps successfully, you now have:

- ✅ TEE agent running and monitoring
- ✅ Cross-chain contracts deployed
- ✅ Frontend connected and operational
- ✅ Full ICO system ready for testing

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Verify all environment variables
3. Review deployment logs
4. Ensure all prerequisites are met

---

**Remember**: TEE agent setup (Step 0) must be completed first! 