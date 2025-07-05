import hre from 'hardhat'
import { Wallet } from 'ethers';

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk' // Fallback to hardhat test mnemonic
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)
  
  console.log('=== DEPLOYING BATCH SETTLEMENT TO ETHEREUM ===')
  console.log('Deployer:', deployer.address)
  console.log('Mnemonic in use:', mnemonic)
  console.log('Network:', hre.network.name)
  console.log('Chain ID:', hre.network.config.chainId)

  // Check if we're on Ethereum network
  const isEthereum = hre.network.name === 'sepolia' || hre.network.name === 'mainnet'
  if (!isEthereum) {
    console.error('❌ BatchSettlement must be deployed on Ethereum (sepolia/mainnet)')
    console.error('Current network:', hre.network.name)
    process.exit(1)
  }

  // Get TEE public key (from TEE agent logs)
  const teePubKey = process.env.TEE_PUBKEY ?? '0x16d435EC891be39706e82DB88AedCA39167622dD'
  if (teePubKey === '0x16d435EC891be39706e82DB88AedCA39167622dD') {
    console.log('🔐 Using TEE agent public key from deployment')
  } else {
    console.log('🔐 Using custom TEE public key')
  }

  console.log('🔐 TEE Public Key:', teePubKey)

  // Deploy BatchSettlement contract
  const BatchSettlement = await ethers.getContractFactory('BatchSettlement', deployer)
  const batchSettlement = await BatchSettlement.deploy(teePubKey)
  await batchSettlement.waitForDeployment()
  
  const batchAddress = await batchSettlement.getAddress()
  console.log('✅ BatchSettlement deployed successfully!')
  console.log('📍 Contract Address:', batchAddress)
  console.log('🌐 Network:', hre.network.name)
  
  console.log('\n=== NEXT STEPS ===')
  console.log('1. Deploy KITTY token:')
  console.log('   npx hardhat run deploy/01_deploy_token.ts --network', hre.network.name)
  console.log('2. Deploy ICO contract on Sapphire:')
  console.log('   TOKEN_CONTRACT_ADDRESS=<token_addr> npx hardhat run deploy/02_deploy_ico.ts --network sapphire-testnet')
  console.log('3. Setup issuer approval:')
  console.log('   kittyToken.approve(' + batchAddress + ', saleSupply)')
  
  console.log('\n=== EXPORT ADDRESSES ===')
  console.log('export BATCH_SETTLEMENT_ADDR=' + batchAddress)
  console.log('export TEE_PUBKEY=' + teePubKey)
  
  return batchAddress
}

main().catch(err => {
  console.error('❌ BatchSettlement deployment failed:', err)
  process.exit(1)
}) 