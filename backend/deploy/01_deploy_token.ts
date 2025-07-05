import hre from 'hardhat'
import { Wallet } from 'ethers';

/**
 * Deploy KITTY Token on Ethereum (Sepolia)
 * 
 * This script deploys the ERC20 token that will be used in the ICO.
 * Tokens are minted to the deployer address.
 */

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk'
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)

  console.log('=== DEPLOYING KITTY TOKEN ===')
  console.log('Deployer:', deployer.address)
  console.log('Network:', hre.network.name)

  // Validate network
  if (hre.network.name !== 'sepolia' && hre.network.name !== 'mainnet') {
    console.error('❌ This script must run on Ethereum (sepolia/mainnet)')
    console.error('Current network:', hre.network.name)
    process.exit(1)
  }

  // Deploy the ERC-20 token
  const initialSupply = ethers.parseEther('1000000') // 1M tokens
  const Token = await ethers.getContractFactory('MockERC20', deployer)
  const token = await Token.deploy('Kitty Token', 'KITTY', initialSupply)
  await token.waitForDeployment()
  
  const tokenAddress = await token.getAddress()
  console.log('✅ KITTY Token deployed successfully!')
  console.log('📍 Address:', tokenAddress)
  console.log('🏷️  Symbol: KITTY')
  console.log('📊 Supply:', ethers.formatEther(initialSupply), 'KITTY')
  
  // Export for next deployment steps
  console.log('\n=== EXPORT FOR NEXT STEPS ===')
  console.log('export TOKEN_CONTRACT_ADDRESS=' + tokenAddress)
  
  return tokenAddress
}

main().catch(err => {
  console.error('❌ Token deployment failed:', err)
  process.exit(1)
}) 