import hre from 'hardhat'
import { Wallet, JsonRpcProvider } from 'ethers'

/**
 * Multi-chain deployment script for Kitty ICO development
 * 
 * This script implements TRUE multi-chain architecture:
 * - ICO Contract → Sapphire Localnet (confidential bidding)
 * - ICO Token + BatchSettlement → Ethereum Sepolia (token distribution + USDC payments)
 * - Uses Circle USDC address as reference for payments
 * 
 * Steps:
 * 1. Gets TEE public key from agent
 * 2. Deploys ICO token + BatchSettlement to Ethereum Sepolia
 * 3. Deploys ICO contract to Sapphire Localnet
 * 4. Creates a test sale
 * 5. Exports all addresses for TEE agent
 */

const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743fbc6116a902379C7238'

interface DeploymentResult {
  icoTokenAddress: string
  usdcAddress: string
  icoContractAddress: string
  batchAddress: string
  teePubKey: string
  saleId?: number
}

async function getTEEPublicKey(): Promise<string> {
  console.log('🔑 Getting TEE public key from agent...')
  
  try {
    const response = await fetch('http://localhost:8080/status')
    const status = await response.json()
    
    if (!status.address) {
      throw new Error('TEE agent not providing public key')
    }
    
    console.log(`✅ TEE Public Key: ${status.address}`)
    return status.address
    
  } catch (error) {
    console.log('⚠️  TEE agent not available, using default key for testing')
    // Fallback to a test key for development
    return '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  }
}

async function deployToSepoliaNetwork(teePubKey: string): Promise<{tokenAddress: string, batchAddress: string}> {
  console.log('\n🌐 Deploying to Ethereum Sepolia Network...')
  
  // Get Sepolia RPC URL from environment
  const sepoliaRpcUrl = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY'
  const privateKey = process.env.PRIVATE_KEY || process.env.MNEMONIC
  
  if (!privateKey) {
    throw new Error('❌ PRIVATE_KEY or MNEMONIC environment variable required for Sepolia deployment')
  }
  
  if (sepoliaRpcUrl.includes('YOUR_KEY')) {
    console.log('⚠️  Warning: Using default Sepolia RPC URL. For production, set ETHEREUM_RPC_URL')
    console.log('   You can get a free API key from: https://infura.io or https://alchemy.com')
  }
  
  // Create Sepolia provider and wallet
  const sepoliaProvider = new JsonRpcProvider(sepoliaRpcUrl)
  
  let sepoliaWallet
  if (privateKey.includes(' ')) {
    // It's a mnemonic
    sepoliaWallet = Wallet.fromPhrase(privateKey).connect(sepoliaProvider)
  } else {
    // It's a private key
    sepoliaWallet = new Wallet(privateKey, sepoliaProvider)
  }
  
  console.log(`💰 Sepolia Deployer: ${sepoliaWallet.address}`)
  
  // Check balance
  try {
    const balance = await sepoliaProvider.getBalance(sepoliaWallet.address)
    const balanceEth = hre.ethers.formatEther(balance)
    console.log(`💰 Sepolia Balance: ${balanceEth} ETH`)
    
    if (parseFloat(balanceEth) < 0.01) {
      console.log('⚠️  Warning: Low Sepolia ETH balance. Get test ETH from:')
      console.log('   https://sepoliafaucet.com/')
      console.log('   https://faucet.sepolia.dev/')
    }
  } catch (error: unknown) {
    console.log('⚠️  Could not check Sepolia balance:', error instanceof Error ? error.message : String(error))
  }
  
  // Deploy ICO Token on Sepolia
  console.log('📦 Deploying ICO Token on Ethereum Sepolia...')
  
  const MockERC20Factory = new hre.ethers.ContractFactory(
    (await hre.artifacts.readArtifact('MockERC20')).abi,
    (await hre.artifacts.readArtifact('MockERC20')).bytecode,
    sepoliaWallet
  )
  
  const initialSupply = hre.ethers.parseEther('1000000') // 1M ICO tokens
  
  console.log('   Sending transaction to Sepolia...')
  const token = await MockERC20Factory.deploy('Kitty ICO Token', 'KITTY', initialSupply)
  console.log('   Waiting for deployment confirmation...')
  await token.waitForDeployment()
  
  const tokenAddress = await token.getAddress()
  console.log(`✅ ICO Token deployed on Sepolia: ${tokenAddress}`)
  console.log(`   Network: Ethereum Sepolia (Chain ID: 11155111)`)
  console.log(`   Symbol: KITTY`)
  console.log(`   Initial supply: ${hre.ethers.formatEther(initialSupply)} KITTY tokens`)
  console.log(`   Explorer: https://sepolia.etherscan.io/address/${tokenAddress}`)
  
  // Deploy BatchSettlement on Sepolia
  console.log('📦 Deploying Batch Settlement on Ethereum Sepolia...')
  
  const BatchSettlementFactory = new hre.ethers.ContractFactory(
    (await hre.artifacts.readArtifact('BatchSettlement')).abi,
    (await hre.artifacts.readArtifact('BatchSettlement')).bytecode,
    sepoliaWallet
  )
  
  console.log('   Sending transaction to Sepolia...')
  const batch = await BatchSettlementFactory.deploy(tokenAddress)
  console.log('   Waiting for deployment confirmation...')
  await batch.waitForDeployment()
  
  const batchAddress = await batch.getAddress()
  console.log(`✅ Batch Settlement deployed on Sepolia: ${batchAddress}`)
  console.log(`   Network: Ethereum Sepolia (Chain ID: 11155111)`)
  console.log(`   Explorer: https://sepolia.etherscan.io/address/${batchAddress}`)
  
  // Transfer all ICO tokens to BatchSettlement for distribution
  console.log('💰 Transferring ICO tokens to BatchSettlement...')
  console.log('   This allows the BatchSettlement to distribute tokens to ICO winners')
  
  // Get properly typed token contract instance for the transfer
  const tokenContract = new hre.ethers.Contract(
    tokenAddress,
    (await hre.artifacts.readArtifact('MockERC20')).abi,
    sepoliaWallet
  )
  
  const transferTx = await tokenContract.transfer(batchAddress, initialSupply)
  console.log('   Waiting for transfer confirmation...')
  await transferTx.wait()
  
  console.log(`✅ Transferred ${hre.ethers.formatEther(initialSupply)} KITTY tokens to BatchSettlement`)
  console.log(`   From: ${sepoliaWallet.address} (deployer)`)
  console.log(`   To: ${batchAddress} (BatchSettlement contract)`)
  console.log(`   Amount: ${hre.ethers.formatEther(initialSupply)} KITTY tokens`)
  console.log(`   🎯 BatchSettlement now has custody of all ICO tokens for winner distribution`)
  
  return { tokenAddress, batchAddress }
}

async function getUSDCAddress(): Promise<string> {
  console.log('\n💰 Using Circle USDC for payments...')
  console.log(`✅ USDC Address: ${CIRCLE_USDC_SEPOLIA}`)
  console.log(`✅ Network: Ethereum Sepolia (production) / Hardhat simulation`)
  console.log(`✅ Get test tokens: https://faucet.circle.com`)
  
  return CIRCLE_USDC_SEPOLIA
}

async function deployICOToSapphire(deployer: any, teePubKey: string, tokenAddress: string): Promise<string> {
  console.log('\n🔐 Deploying ICO Contract to Sapphire Localnet...')
  
  const ICO = await hre.ethers.getContractFactory('ICO_Contract', deployer)
  const ico = await ICO.deploy(teePubKey, tokenAddress)
  await ico.waitForDeployment()
  
  const icoAddress = await ico.getAddress()
  console.log(`✅ ICO Contract deployed on Sapphire: ${icoAddress}`)
  console.log(`   Network: Sapphire Localnet`)
  console.log(`   TEE Public Key: ${teePubKey}`)
  console.log(`   Token Address (cross-chain): ${tokenAddress}`)
  
  return icoAddress
}

async function createTestSale(deployer: any, icoAddress: string): Promise<number> {
  console.log('\n🚀 Creating test sale on Sapphire...')
  
  // Get ICO contract instance on Sapphire
  const ico = await hre.ethers.getContractAt('ICO_Contract', icoAddress, deployer)
  
  // Sale parameters
  const supply = hre.ethers.parseEther('10000') // 10,000 tokens for sale
  const deadline = Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes from now
  const policyHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('{"scoring": "0.6*price + 0.2*geo + 0.2*pitch"}'))
  
  // Create sale (no token approval needed since we're using cross-chain reference)
  console.log('   Creating sale on ICO contract...')
  const tx = await ico.createSale(supply, deadline, policyHash)
  const receipt = await tx.wait()
  
  // Get sale ID from events
  const saleCreatedEvent = receipt?.logs.find(log => {
    try {
      const parsed = ico.interface.parseLog(log)
      return parsed?.name === 'SaleCreated'
    } catch {
      return false
    }
  })
  
  const saleId = saleCreatedEvent ? ico.interface.parseLog(saleCreatedEvent)?.args.id : 1
  
  console.log(`✅ Test sale created on Sapphire:`)
  console.log(`   Sale ID: ${saleId}`)
  console.log(`   Supply: ${hre.ethers.formatEther(supply)} ICO tokens`)
  console.log(`   Deadline: ${new Date(deadline * 1000).toLocaleString()}`)
  console.log(`   Time remaining: 5 minutes`)
  
  return Number(saleId)
}

async function main(): Promise<DeploymentResult> {
  const { ethers } = hre as any
  
  console.log('🎯 Starting Kitty ICO Multi-Chain Deployment')
  console.log('==============================================')
  console.log('📋 Architecture:')
  console.log('   • ICO Token + BatchSettlement → Ethereum Sepolia')
  console.log('   • ICO Contract → Sapphire Localnet')
  console.log('')
  
  // Validate network
  if (hre.network.name !== 'sapphire-localnet') {
    throw new Error(`❌ This script must run on sapphire-localnet, current: ${hre.network.name}`)
  }
  
  // Get deployer for Sapphire
  const [deployer] = await ethers.getSigners()
  console.log(`🚀 Sapphire Deployer: ${deployer.address}`)
  console.log(`💰 Sapphire Balance: ${hre.ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`)
  
  // Step 1: Get TEE public key
  const teePubKey = await getTEEPublicKey()
  
  // Step 2: Deploy to Ethereum Sepolia
  const { tokenAddress: icoTokenAddress, batchAddress } = await deployToSepoliaNetwork(teePubKey)
  
  // Step 3: Get USDC address (Circle token for payments)
  const usdcAddress = await getUSDCAddress()
  
  // Step 4: Deploy ICO contract (Sapphire Localnet)
  const icoContractAddress = await deployICOToSapphire(deployer, teePubKey, icoTokenAddress)
  
  // Step 5: Create test sale
  const saleId = await createTestSale(deployer, icoContractAddress)
  
  const result: DeploymentResult = {
    icoTokenAddress,
    usdcAddress,
    icoContractAddress,
    batchAddress,
    teePubKey,
    saleId
  }
  
  // Output summary
  console.log('\n🎉 MULTI-CHAIN DEPLOYMENT COMPLETE!')
  console.log('===================================')
  console.log('📦 ICO Token (KITTY):', result.icoTokenAddress, '(Ethereum Sepolia)')
  console.log('💰 USDC Reference:', result.usdcAddress, '(Sepolia production address)')
  console.log('⚖️ Batch Settlement:', result.batchAddress, '(Ethereum Sepolia)')
  console.log('🔐 ICO Contract:', result.icoContractAddress, '(Sapphire Localnet)')
  console.log('🤖 TEE Public Key:', result.teePubKey)
  console.log('🎯 Test Sale ID:', result.saleId)
  
  // Output environment variables for easy copy-paste
  console.log('\n📋 Environment Variables')
  console.log('=========================')
  console.log(`export ICO_TOKEN_ADDRESS=${result.icoTokenAddress}`)
  console.log(`export USDC_CONTRACT_ADDRESS=${result.usdcAddress}`)
  console.log(`export ICO_CONTRACT_ADDRESS=${result.icoContractAddress}`)
  console.log(`export BATCH_SETTLEMENT_ADDRESS=${batchAddress}`)
  console.log(`export TEE_PUBKEY=${teePubKey}`)
  console.log(`export TEST_SALE_ID=${saleId}`)
  
  console.log('\n✅ Ready for testing! TEE agent will process bids on Sapphire and settle via Sepolia')
  
  return result
}

// Export for use in other scripts
export { main as deployLocalnet, getTEEPublicKey }

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Deployment failed:', err)
    process.exit(1)
  })
} 