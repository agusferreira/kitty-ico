
import hre from 'hardhat'

async function main() {
  const { ethers } = hre as any
  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // 1. Deploy the ERC-20 token used for the sale.
  const initialSupply = ethers.parseEther('1000000')
  const Token = await ethers.getContractFactory('MockERC20')
  const newToken = await Token.deploy('Kitty ICO', 'KITTY', initialSupply)
  await newToken.waitForDeployment()
  console.log('Token deployed at', await newToken.getAddress())

  // 2. Determine the TEE public key – for local deploy we reuse deployer.
  const teePubKey = process.env.TEE_PUBKEY ?? deployer.address

  // 3. Deploy the ICO_Contract, linking TEE key and token address.
  const ICO = await ethers.deployContract('ICO_Contract', [teePubKey, await newToken.getAddress()])
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
