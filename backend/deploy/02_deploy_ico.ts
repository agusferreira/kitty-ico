import hre from 'hardhat'
import { Wallet } from 'ethers';

/**
 * Deploy ICO Contract on Sapphire (Testnet)
 * 
 * This script deploys the ICO contract that will handle bid collection
 * and winner selection on Oasis Sapphire.
 */

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk'
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)
  
  console.log('=== DEPLOYING ICO CONTRACT ===')
  console.log('Deployer:', deployer.address)
  console.log('Network:', hre.network.name)

  // Validate network
  if (hre.network.name !== 'sapphire-testnet' && hre.network.name !== 'sapphire') {
    console.error('❌ This script must run on Sapphire (sapphire-testnet/sapphire)')
    console.error('Current network:', hre.network.name)
    process.exit(1)
  }

  // Get the token address from environment
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS
  if (!tokenAddress) {
    console.error('❌ TOKEN_CONTRACT_ADDRESS environment variable is required')
    console.error('Please deploy the token first and set: export TOKEN_CONTRACT_ADDRESS=<token_address>')
    process.exit(1)
  }

  // Get TEE public key
  const teePubKey = process.env.TEE_PUBKEY
  if (!teePubKey) {
    console.error('❌ TEE_PUBKEY environment variable is required')
    console.error('Please set: export TEE_PUBKEY=<tee_public_key>')
    process.exit(1)
  }

  console.log('🔗 Token Address:', tokenAddress)
  console.log('🔐 TEE Public Key:', teePubKey)

  // Deploy ICO_Contract on Sapphire
  const ICO = await ethers.deployContract('ICO_Contract', [teePubKey, tokenAddress], { signer: deployer })
  await ICO.waitForDeployment()
  
  const icoAddress = await ICO.getAddress()
  console.log('✅ ICO Contract deployed successfully!')
  console.log('📍 Address:', icoAddress)
  
  // Export for next deployment steps
  console.log('\n=== EXPORT FOR NEXT STEPS ===')
  console.log('export ICO_CONTRACT_ADDRESS=' + icoAddress)
  
  return icoAddress
}

main().catch(err => {
  console.error('❌ ICO deployment failed:', err)
  process.exit(1)
}) 