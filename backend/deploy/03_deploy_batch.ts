import hre from 'hardhat'
import { Wallet } from 'ethers';

/**
 * Deploy BatchSettlement Contract on Ethereum (Sepolia)
 * 
 * This script deploys the BatchSettlement contract that will handle
 * cross-chain token distribution based on TEE agent decisions.
 */

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk'
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)
  
  console.log('=== DEPLOYING BATCH SETTLEMENT ===')
  console.log('Deployer:', deployer.address)
  console.log('Network:', hre.network.name)

  // Validate network
  if (hre.network.name !== 'sepolia' && hre.network.name !== 'mainnet') {
    console.error('❌ This script must run on Ethereum (sepolia/mainnet)')
    console.error('Current network:', hre.network.name)
    process.exit(1)
  }

  // Get TEE public key
  const teePubKey = process.env.TEE_PUBKEY
  if (!teePubKey) {
    console.error('❌ TEE_PUBKEY environment variable is required')
    console.error('Please set: export TEE_PUBKEY=<tee_public_key>')
    process.exit(1)
  }

  console.log('🔐 TEE Public Key:', teePubKey)

  // Deploy BatchSettlement contract
  const BatchSettlement = await ethers.getContractFactory('BatchSettlement', deployer)
  const batchSettlement = await BatchSettlement.deploy(teePubKey)
  await batchSettlement.waitForDeployment()
  
  const batchAddress = await batchSettlement.getAddress()
  console.log('✅ BatchSettlement deployed successfully!')
  console.log('📍 Address:', batchAddress)
  
  // Export for next deployment steps
  console.log('\n=== EXPORT FOR NEXT STEPS ===')
  console.log('export BATCH_SETTLEMENT_ADDR=' + batchAddress)
  
  return batchAddress
}

main().catch(err => {
  console.error('❌ BatchSettlement deployment failed:', err)
  process.exit(1)
}) 