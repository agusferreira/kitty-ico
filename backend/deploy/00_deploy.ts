
import hre from 'hardhat'
import { Wallet } from 'ethers';

async function main() {
  const { ethers } = hre as any
  
  // Get deployer from mnemonic
  const mnemonic = process.env.MNEMONIC 
    ?? 'test test test test test test test test test test test junk' // Fallback to hardhat test mnemonic
  const deployer = Wallet.fromPhrase(mnemonic).connect(ethers.provider)
  
  console.log('Deployer:', deployer.address)
  console.log('Mnemonic in use:', mnemonic)

  // 1. Deploy the ERC-20 token used for the sale.
  const initialSupply = ethers.parseEther('1000000')
  const Token = await ethers.getContractFactory('MockERC20', deployer)
  const newToken = await Token.deploy('Kitty ICO', 'KITTY', initialSupply)
  await newToken.waitForDeployment()
  console.log('Token deployed at', await newToken.getAddress())

  // 2. Determine the TEE public key – use deployed TEE agent key
  const teePubKey = process.env.TEE_PUBKEY ?? '0x16d435EC891be39706e82DB88AedCA39167622dD'
  console.log('🔐 TEE Public Key:', teePubKey)

  // 3. Deploy the ICO_Contract, linking TEE key and token address.
  const ICO = await ethers.deployContract('ICO_Contract', [teePubKey, await newToken.getAddress()], { signer: deployer })
  await ICO.waitForDeployment()
  console.log('ICO_Contract deployed at', await ICO.getAddress())

  // 4. Export addresses for front-end or subsequent scripts.
  console.log('\nexport ICO_ADDR=%s', await ICO.getAddress())
  console.log('export TOKEN_ADDR=%s', await newToken.getAddress())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
