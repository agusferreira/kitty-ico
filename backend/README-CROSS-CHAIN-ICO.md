# Cross-Chain ICO System

## 🎯 Overview

This is a **cross-chain ICO system** that combines **private bidding** on Oasis Sapphire with **atomic settlement** on Ethereum. The system provides:

- ✅ **Private bidding** with encrypted bids on Sapphire
- ✅ **Atomic settlement** with batch processing on Ethereum  
- ✅ **60-70% gas savings** compared to individual settlements
- ✅ **Fault-tolerant** design with graceful failure handling
- ✅ **TEE-verified** results with cryptographic proofs

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CROSS-CHAIN ICO SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐         ┌─────────────────────┐                │
│  │    ETHEREUM         │         │     SAPPHIRE        │                │
│  │   (Settlement)      │         │   (Private Bids)    │                │
│  │                     │         │                     │                │
│  │  ┌───────────────┐  │         │  ┌───────────────┐  │                │
│  │  │ KITTY Token   │  │         │  │ ICO Contract  │  │                │
│  │  │ (ERC20)       │  │         │  │ (Confidential)│  │                │
│  │  └───────────────┘  │         │  └───────────────┘  │                │
│  │                     │         │                     │                │
│  │  ┌───────────────┐  │         │  ┌───────────────┐  │                │
│  │  │BatchSettlement│  │         │  │  Encrypted    │  │                │
│  │  │ (Atomic)      │  │         │  │  Bid Storage  │  │                │
│  │  └───────────────┘  │         │  └───────────────┘  │                │
│  └─────────────────────┘         └─────────────────────┘                │
│                                                                         │
│                    ┌─────────────────────┐                             │
│                    │   TEE AGENT (ROLF)  │                             │
│                    │                     │                             │
│                    │  • Monitors Events  │                             │
│                    │  • Processes Bids   │                             │
│                    │  • Executes Batch   │                             │
│                    │  • Signs Results    │                             │
│                    └─────────────────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📋 Contract Addresses

| Contract | Network | Purpose |
|----------|---------|---------|
| **KITTY Token** | Ethereum | ERC20 token being sold |
| **BatchSettlement** | Ethereum | Atomic settlement execution |
| **ICO Contract** | Sapphire | Private bidding & TEE coordination |

## 🔄 Complete Flow

### 1. **Setup Phase**
```bash
# Deploy on Ethereum
npx hardhat run deploy/00_deploy.ts --network sepolia

# Deploy on Sapphire  
TOKEN_CONTRACT_ADDRESS=0x... BATCH_SETTLEMENT_ADDR=0x... \
npx hardhat run deploy/00_deploy.ts --network sapphire-testnet
```

### 2. **Sale Creation**
```solidity
// Issuer approves BatchSettlement to spend tokens
kittyToken.approve(batchSettlementAddress, saleSupply);

// Create sale on Sapphire
icoContract.createSale(supply, deadline, policyHash);
```

### 3. **Bidding Phase**
```solidity
// Bidders encrypt their bids with TEE public key
{
  price: "1000000000000000000",      // 1 USDC per token
  quantity: "50000000000000000000",  // 50 tokens
  pitch: "Strategic partnership...",
  country: "US"
}

// Submit encrypted bid with USDC permit
icoContract.submitBid(saleId, encryptedBid, maxSpend, permitSignature);
```

### 4. **TEE Processing**
```typescript
// TEE Agent monitors Sapphire events
icoContract.on('SettlementRecorded', async (saleId, totalWinners, totalTokens) => {
  // Process settlement
  const settlements = await collectSettlements(saleId);
  const signature = await signWithTEE(settlements);
  
  // Execute batch settlement on Ethereum
  await batchSettlement.batchSettle({
    saleId,
    issuer,
    tokenAddress: KITTY_TOKEN,
    paymentToken: USDC,
    settlements,
    teeSignature: signature
  });
});
```

### 5. **Atomic Settlement**
```solidity
// BatchSettlement executes atomically:
// 1. Verify TEE signature
// 2. For each winner:
//    - Execute permit() to authorize payment
//    - Transfer USDC from winner to issuer
//    - Transfer KITTY tokens from issuer to winner
// 3. Emit settlement events
```

## 📊 Gas Efficiency

| Method | Gas Cost | USD Cost* |
|--------|----------|-----------|
| **Individual Settlements** | ~8.6M gas | $200-500 |
| **Batch Settlement** | ~3.0M gas | $70-150 |
| **Savings** | **60-70%** | **$130-350** |

*_Based on 100 winners, gas price varies with network congestion_

## 🔐 Security Features

### **TEE Verification**
- All settlement results are signed by the TEE agent
- Cryptographic proof ensures integrity
- Public verification on-chain

### **Fault Tolerance**
- Failed permits don't break entire batch
- Detailed failure events for debugging
- Graceful partial completion

### **Privacy**
- Bid details remain confidential on Sapphire
- Only final allocations are public
- No bid information leakage

## 🚀 Deployment Guide

### **Prerequisites**
```bash
# Install dependencies
cd backend && pnpm install

# Set environment variables
export TEE_PRIVATE_KEY=0x...
export ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
```

### **Step 1: Deploy on Ethereum**
```bash
npx hardhat run deploy/00_deploy.ts --network sepolia
```

**Output:**
```
✅ KITTY Token deployed: 0x1234...
✅ BatchSettlement deployed: 0x5678...

export TOKEN_CONTRACT_ADDRESS=0x1234...
export BATCH_SETTLEMENT_ADDR=0x5678...
```

### **Step 2: Deploy on Sapphire**
```bash
TOKEN_CONTRACT_ADDRESS=0x1234... BATCH_SETTLEMENT_ADDR=0x5678... \
npx hardhat run deploy/00_deploy.ts --network sapphire-testnet
```

**Output:**
```
✅ ICO Contract deployed: 0x9abc...

export ICO_ADDR=0x9abc...
```

### **Step 3: Start TEE Agent**
```bash
# Set additional environment variables
export ICO_ADDR=0x9abc...
export PAYMENT_TOKEN_ADDRESS=0x... # USDC address

# Run TEE agent
npx ts-node src/tee-agent-example.ts
```

## 🧪 Testing

### **Unit Tests**
```bash
npx hardhat test
```

### **Integration Tests**
```bash
# Test cross-chain flow
npx hardhat test test/CrossChainICO.ts
```

### **Local Development**
```bash
# Start local Sapphire node
docker run -it -p8545:8545 ghcr.io/oasisprotocol/sapphire-localnet

# Deploy to local networks
npx hardhat run deploy/00_deploy.ts --network localhost
npx hardhat run deploy/00_deploy.ts --network sapphire-localnet
```

## 📚 API Reference

### **ICO Contract (Sapphire)**
```solidity
// Create a new sale
function createSale(uint256 supply, uint256 deadline, bytes policyHash) 
  returns (uint256 saleId)

// Submit encrypted bid
function submitBid(uint256 saleId, bytes encBlob, uint256 maxSpend, bytes permitSig)

// Finalize sale (TEE only)
function finalize(uint256 saleId, bytes result, bytes teeSig)
```

### **BatchSettlement (Ethereum)**
```solidity
// Execute atomic settlement
function batchSettle(BatchSettleParams params)

struct BatchSettleParams {
  uint256 saleId;
  address issuer;
  address tokenAddress;
  address paymentToken;
  SettlementData[] settlements;
  bytes teeSignature;
}
```

## 🔧 Configuration

### **Supported Payment Tokens**
- **USDC** (Recommended) - Full EIP-2612 support
- **WETH** - Requires ETH wrapping
- **USDT** - Higher gas costs, limited permit support

### **Network Configuration**
```typescript
// Ethereum Networks
sepolia: {
  chainId: 11155111,
  url: 'https://sepolia.infura.io/v3/...'
}

// Sapphire Networks
'sapphire-testnet': {
  chainId: 0x5aff,
  url: 'https://testnet.sapphire.oasis.io'
}
```

## 🎯 Benefits

### **For Issuers**
- ✅ Choose strategic backers, not just highest bidders
- ✅ Automated settlement with minimal gas costs
- ✅ Transparent and auditable process

### **For Bidders**
- ✅ Private bidding prevents front-running
- ✅ Fair allocation based on multiple criteria
- ✅ Atomic settlement guarantees

### **For Developers**
- ✅ Modular, extensible architecture
- ✅ Clear separation of concerns
- ✅ Comprehensive testing framework

## 🔬 Advanced Features

### **Scoring Algorithm**
```javascript
score = 0.6 × price + 0.2 × geoBonus + 0.2 × pitchScore
```

### **Bid Encryption**
```javascript
// HPKE encryption with TEE public key
const encryptedBid = await hpke.encrypt(teePubKey, JSON.stringify({
  price: "1000000000000000000",
  quantity: "50000000000000000000", 
  pitch: "Strategic partnership proposal...",
  country: "US"
}));
```

### **Permit Signatures**
```javascript
// EIP-2612 permit for gasless approvals
const permit = await signPermit(
  usdc,
  owner,
  spender,
  value,
  deadline,
  privateKey
);
```

## 📞 Support

- 📧 **Issues**: GitHub Issues
- 📖 **Documentation**: `/docs` directory
- 💬 **Community**: Discord/Telegram
- 🐛 **Bug Reports**: Security contact

---

Built with ❤️ for the Oasis ecosystem 