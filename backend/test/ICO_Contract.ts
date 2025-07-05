import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import '@nomicfoundation/hardhat-chai-matchers'

describe('ICO_Contract', function () {
  const TOTAL_SUPPLY = ethers.parseEther('1000')
  const SALE_SUPPLY = ethers.parseEther('600')

  async function deployFixture() {
    // Deploy NEW token
    const MockERC20 = await ethers.getContractFactory('MockERC20')
    const newToken = await MockERC20.deploy('Kitty ICO', 'KITTY', TOTAL_SUPPLY) as any
    await newToken.waitForDeployment()

    // Simulated TEE key – use a random wallet
    const teeWallet = ethers.Wallet.createRandom()

    // Deploy ICO contract
    const ICO = (await ethers.deployContract('ICO_Contract', [await teeWallet.getAddress(), await newToken.getAddress()])) as any
    await ICO.waitForDeployment()

    // Sale issuer approves tokens
    const [issuer, bidder1, bidder2] = await ethers.getSigners()
    await (newToken as any).connect(issuer).approve(await ICO.getAddress(), SALE_SUPPLY)

    return { ICO, newToken, teeWallet, issuer, bidder1, bidder2 }
  }

  it('happy path: createSale → submitBid → finalize', async function () {
    const { ICO, newToken, teeWallet, issuer, bidder1, bidder2 } = await deployFixture()

    // issuer creates sale
    const blk = (await ethers.provider.getBlock('latest')) as any
    const now = Number(blk.timestamp)
    const deadline = now + 60 // 1 min
    await ICO.connect(issuer).createSale(SALE_SUPPLY, deadline, '0x')
    const saleId: bigint = await ICO.nextSaleId()

    // bidders submit bids (encBlob and permits are just dummies)
    await ICO.connect(bidder1).submitBid(saleId, '0xabcdef', 0, '0x')
    await ICO.connect(bidder2).submitBid(saleId, '0x123456', 0, '0x')

    // move time forward past deadline
    await network.provider.send('evm_setNextBlockTimestamp', [deadline + 1])
    await network.provider.send('evm_mine')

    // craft TEE-signed result
    const winners = [await bidder1.getAddress(), await bidder2.getAddress()]
    const price = ethers.parseEther('1')
    const result = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address[]'], [price, winners])

    const digest = ethers.keccak256(ethers.solidityPacked(['address', 'uint256', 'bytes'], [await ICO.getAddress(), saleId, result]))
    const signature = await teeWallet.signMessage(ethers.getBytes(digest))

    // finalize sale
    await expect(ICO.connect(bidder1).finalize(saleId, result, signature)).to.emit(ICO, 'SaleFinalized')

    // Each winner receives half of SALE_SUPPLY
    const expected = SALE_SUPPLY / BigInt(winners.length)
    expect(await newToken.balanceOf(winners[0])).to.equal(expected)
    expect(await newToken.balanceOf(winners[1])).to.equal(expected)

    // Contract supply reduced to zero
    expect(await newToken.balanceOf(await ICO.getAddress())).to.equal(SALE_SUPPLY - expected * BigInt(winners.length))

    // second finalize should revert
    await expect(ICO.finalize(saleId, result, signature)).to.be.revertedWith('already finalized')
  })

  it('should reject finalize with bad signature', async function () {
    const { ICO, teeWallet, issuer } = await deployFixture()
    const blk2 = (await ethers.provider.getBlock('latest')) as any
    const now = Number(blk2.timestamp)
    const deadline = now + 10
    await ICO.connect(issuer).createSale(SALE_SUPPLY, deadline, '0x')
    const saleId: bigint = await ICO.nextSaleId()
    await network.provider.send('evm_setNextBlockTimestamp', [deadline + 1])
    await network.provider.send('evm_mine')

    const result = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address[]'], [0, []])
    const badSig = await teeWallet.signMessage(ethers.getBytes('0xdeadbeef'))
    await expect(ICO.finalize(saleId, result, badSig)).to.be.revertedWith('bad tee sig')
  })
}) 