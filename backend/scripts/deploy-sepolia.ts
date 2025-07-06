import hre from 'hardhat'

/**
 * Sepolia deployment script for Kitty ICO
 * 
 * This script deploys the ICO token and BatchSettlement contract on Sepolia.
 * It uses the existing Circle USDC token for payments.
 * 
 * Multi-chain architecture:
 * - Sepolia: ICO Token (what we're selling) + BatchSettlement + Circle USDC (payment method)
 * - Sapphire: ICO Contract (for confidential bids)
 */

const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743fbc6116a902379C7238'

async function deployICOToken(deployer: any): Promise<string> {
  console.log('\n📦 Deploying ICO Token (what we\'re selling)...')
  
  const MockERC20 = await hre.ethers.getContractFactory('MockERC20', deployer)
  const initialSupply = hre.ethers.parseEther('1000000') // 1M ICO tokens
  const token = await MockERC20.deploy('Kitty ICO Token', 'KITTY', initialSupply)
  await token.waitForDeployment()
  
  const tokenAddress = await token.getAddress()
  console.log(`✅ ICO Token deployed: ${tokenAddress}`)
  console.log(`✅ Symbol: KITTY`)
  console.log(`✅ Initial supply: ${hre.ethers.formatEther(initialSupply)} KITTY tokens`)
  
  return tokenAddress
}

async function deployBatchSettlement(deployer: any, teePubKey: string, icoTokenAddress: string): Promise<string> {
  console.log('\n📦 Deploying BatchSettlement Contract to Sepolia...')
  console.log(`🎫 ICO Token: ${icoTokenAddress}`)
  console.log(`💰 Payment Token: ${CIRCLE_USDC_SEPOLIA} (Circle USDC)`)
  
  const BatchSettlement = await hre.ethers.getContractFactory('BatchSettlement', deployer)
  const batch = await BatchSettlement.deploy(teePubKey)
  await batch.waitForDeployment()
  
  const batchAddress = await batch.getAddress()
  console.log(`✅ BatchSettlement deployed: ${batchAddress}`)
  console.log(`   TEE Public Key: ${teePubKey}`)
  console.log(`   Handles: ICO Token distribution + USDC payments`)
  
  return batchAddress
}

async function main() {
  const { ethers } = hre as any
  
  console.log('🎯 Deploying Kitty ICO to Sepolia (Settlement Layer)')
  console.log('================================================')
  
  // Validate network
  if (hre.network.name !== 'sepolia') {
    throw new Error(`❌ This script must run on sepolia, current: ${hre.network.name}`)
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners()
  console.log(`🚀 Deployer: ${deployer.address}`)
  console.log(`💰 Balance: ${hre.ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`)
  
  // Get TEE public key from environment
  const teePubKey = process.env.TEE_PUBKEY
  if (!teePubKey) {
    throw new Error('❌ TEE_PUBKEY environment variable required')
  }
  console.log(`🔑 TEE Public Key: ${teePubKey}`)
  
  // Deploy ICO token (what we're selling in the ICO)
  const icoTokenAddress = await deployICOToken(deployer)
  
  // Deploy BatchSettlement contract
  const batchAddress = await deployBatchSettlement(deployer, teePubKey, icoTokenAddress)
  
  // Output configuration
  console.log('\n📋 Sepolia Deployment Results')
  console.log('=============================')
  console.log(`export ICO_TOKEN_ADDRESS=${icoTokenAddress}`)
  console.log(`export BATCH_SETTLEMENT_ADDRESS=${batchAddress}`)
  console.log(`export USDC_CONTRACT_ADDRESS=${CIRCLE_USDC_SEPOLIA}`)
  console.log(`export TEE_PUBKEY=${teePubKey}`)
  
  console.log('\n📝 .env file updates:')
  console.log('====================')
  console.log(`ICO_TOKEN_ADDRESS=${icoTokenAddress}`)
  console.log(`BATCH_SETTLEMENT_ADDRESS=${batchAddress}`)
  console.log(`USDC_CONTRACT_ADDRESS=${CIRCLE_USDC_SEPOLIA}`)
  console.log(`TEE_PUBKEY=${teePubKey}`)
  
  console.log('\n✅ Sepolia deployment completed!')
  console.log('\n🎉 Next steps:')
  console.log('   1. Get USDC test tokens: https://faucet.circle.com')
  console.log('   2. Deploy ICO contract to Sapphire: npm run deploy:sapphire')
  console.log('   3. Update TEE agent with contract addresses')
  console.log('   4. Test the complete multi-chain workflow')
  
  return {
    icoTokenAddress,
    batchSettlementAddress: batchAddress,
    usdcAddress: CIRCLE_USDC_SEPOLIA,
    teePubKey
  }
}

// Export for use in other scripts
export { main as deploySepolia }

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
} 