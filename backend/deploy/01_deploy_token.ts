import hre from 'hardhat'
import { Wallet } from 'ethers';

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk' // Fallback to hardhat test mnemonic
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)

  console.log('=== DEPLOYING KITTY TOKEN TO ETHEREUM ===')
  console.log('Deployer:', deployer.address)
  console.log('Network:', hre.network.name)
  console.log('Chain ID:', hre.network.config.chainId)

  // Deploy the ERC-20 token on Ethereum
  const initialSupply = ethers.parseEther('1000000') // 1M tokens
  const Token = await ethers.getContractFactory('MockERC20', deployer)
  const newToken = await Token.deploy('Kitty Token', 'KITTY', initialSupply)
  await newToken.waitForDeployment()
  
  const tokenAddress = await newToken.getAddress()
  console.log('✅ Kitty Token deployed successfully!')
  console.log('📍 Token Address:', tokenAddress)
  console.log('🏷️  Token Symbol: KITTY')
  console.log('📊 Initial Supply:', ethers.formatEther(initialSupply), 'KITTY')
  
  // Save for cross-chain reference
  console.log('\n=== NEXT STEPS ===')
  console.log('1. Save this token address for Sapphire deployment:')
  console.log('   export TOKEN_CONTRACT_ADDRESS=' + tokenAddress)
  console.log('2. Deploy ICO contract on Sapphire:')
  console.log('   npx hardhat run deploy/02_deploy_ico.ts --network sapphire-testnet')
  
  return tokenAddress
}

main().catch(err => {
  console.error('❌ Token deployment failed:', err)
  process.exit(1)
}) 