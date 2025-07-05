import hre from 'hardhat'
import { Wallet } from 'ethers';

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk' // Fallback to hardhat test mnemonic
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)
  
  console.log('=== DEPLOYING ICO CONTRACT TO SAPPHIRE ===')
  console.log('Deployer:', deployer.address)
  console.log('Mnemonic in use:', mnemonic)
  console.log('Network:', hre.network.name)
  console.log('Chain ID:', hre.network.config.chainId)

  // Get the token address from environment (deployed on Ethereum)
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS
  if (!tokenAddress) {
    console.error('❌ TOKEN_CONTRACT_ADDRESS not found!')
    console.error('Please deploy the token first on Ethereum and set:')
    console.error('export TOKEN_CONTRACT_ADDRESS=<token_address>')
    process.exit(1)
  }

  // TEE public key for signature verification (from TEE agent logs)
  const teePubKey = process.env.TEE_PUBKEY ?? '0x16d435EC891be39706e82DB88AedCA39167622dD'
  if (teePubKey === '0x16d435EC891be39706e82DB88AedCA39167622dD') {
    console.log('🔐 Using TEE agent public key from deployment')
  } else {
    console.log('🔐 Using custom TEE public key')
  }

  console.log('🔗 Ethereum Token Address:', tokenAddress)
  console.log('🔐 TEE Public Key:', teePubKey)

  // Deploy ICO_Contract on Sapphire
  const ICO = await ethers.deployContract('ICO_Contract', [teePubKey, tokenAddress], { signer: deployer })
  await ICO.waitForDeployment()
  
  const icoAddress = await ICO.getAddress()
  console.log('✅ ICO Contract deployed successfully!')
  console.log('📍 Sapphire ICO Address:', icoAddress)
  console.log('🌐 Network:', hre.network.name)
  
  console.log('\n=== DEPLOYMENT SUMMARY ===')
  console.log('Ethereum Token:', tokenAddress)
  console.log('Sapphire ICO Contract:', icoAddress)
  console.log('TEE Public Key:', teePubKey)

  
  return icoAddress
}

main().catch(err => {
  console.error('❌ ICO deployment failed:', err)
  process.exit(1)
}) 