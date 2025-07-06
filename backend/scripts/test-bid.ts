import hre from 'hardhat'
import { Wallet } from 'ethers'

/**
 * Test script for submitting encrypted USDC bids to the ICO contract
 * 
 * This script submits multiple test bids with different characteristics
 * to test the TEE agent's scoring and settlement logic.
 * 
 * Architecture:
 * - Users bid USDC amounts to buy ICO tokens (KITTY)
 * - TEE processes bids confidentially on Sapphire
 * - Settlement distributes ICO tokens for USDC payments on Sepolia
 */

interface BidData {
  price: string      // Price per ICO token in USDC
  quantity: number   // Number of ICO tokens requested
  pitch: string      // Pitch for AI scoring
  country: string    // Country code for geo scoring
}

interface TestBidder {
  wallet: Wallet
  bidData: BidData
  name: string
}

async function createTestBidders(): Promise<TestBidder[]> {
  // Create test wallets with different characteristics for USDC bidding
  const bidders: TestBidder[] = [
    {
      wallet: new hre.ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', hre.ethers.provider),
      name: 'HighPriceBidder',
      bidData: {
        price: '2.50', // High USDC price per ICO token
        quantity: 1000,
        pitch: 'Your Royal Furriness, I offer tribute of premium tuna and endless chin scratches! I have dedicated my entire fortune to building a golden litter box empire. My portfolio includes 47 cat cafes and a laser pointer manufacturing dynasty. I once saved a kitten from a tree during a thunderstorm. Please, oh mighty King Cat, let me serve in your noble court of crypto!',
        country: 'US'
      }
    },
    {
      wallet: new hre.ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', hre.ethers.provider),
      name: 'InnovativeBidder',
      bidData: {
        price: '2.00', // Mid USDC price
        quantity: 2000,
        pitch: 'Dearest King Cat, I am but a humble servant who has studied the ancient art of cardboard box architecture. I have invented self-warming cat beds powered by blockchain and developed a decentralized yarn ball protocol. My grandmother was part Maine Coon. I pledge to donate 90% of profits to building cat towers that reach the moon. Meow means yes, right?',
        country: 'CA'
      }
    },
    {
      wallet: new hre.ethers.Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', hre.ethers.provider),
      name: 'LowPriceBidder',
      bidData: {
        price: '1.20', // Lower USDC price
        quantity: 5000,
        pitch: 'My Liege, I may not have much, but I offer my soul and my extensive collection of cat memes from 2012. I speak fluent purr and have mastered the ancient art of opening tuna cans with my eyes closed. I once had a cat named Mr. Whiskers who I swear understood quantum physics. I will name my firstborn child after you, Your Majesty!',
        country: 'DE'
      }
    },
    {
      wallet: new hre.ethers.Wallet('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', hre.ethers.provider),
      name: 'LargeBidder',
      bidData: {
        price: '2.20', // Good USDC price with large quantity
        quantity: 3000,
        pitch: 'Oh Magnificent Whiskers of Wall Street! I bring offerings of the finest catnip from the Swiss Alps and a business plan written entirely in hairball hieroglyphics. I have trained an army of 1000 cats to mine crypto using their paws. My startup revolutionizes the pet industry by teaching cats to trade derivatives. I bow before your fluffy supremacy and beg for your blessing!',
        country: 'GB'
      }
    }
  ]

  // Fund all bidders from the main account
  const [funder] = await hre.ethers.getSigners()
  const fundAmount = hre.ethers.parseEther('10') // 10 ETH each

  for (const bidder of bidders) {
    const balance = await hre.ethers.provider.getBalance(bidder.wallet.address)
    if (balance < hre.ethers.parseEther('1')) {
      console.log(`💰 Funding ${bidder.name} (${bidder.wallet.address})...`)
      await funder.sendTransaction({
        to: bidder.wallet.address,
        value: fundAmount
      })
    }
  }

  return bidders
}

function encryptBidData(bidData: BidData): string {
  // For localnet testing, we'll use ABI encoding instead of full HPKE
  // In production, this would be proper HPKE encryption with the TEE public key
  
  // Convert USDC price (6 decimals) and ICO token quantity (18 decimals)
  const priceUsdcWei = hre.ethers.parseUnits(bidData.price, 6) // USDC has 6 decimals
  const quantityTokenWei = hre.ethers.parseEther(bidData.quantity.toString()) // ICO tokens have 18 decimals
  
  // Encode as (uint256 priceUsdc, uint256 quantityTokens, string pitch, string country)
  const encoded = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'uint256', 'string', 'string'],
    [priceUsdcWei, quantityTokenWei, bidData.pitch, bidData.country]
  )
  
  return encoded
}

async function submitBid(
  bidder: TestBidder, 
  icoAddress: string, 
  saleId: number
): Promise<void> {
  console.log(`📤 Submitting bid from ${bidder.name}...`)
  
  // Get ICO contract instance
  const ico = await hre.ethers.getContractAt('ICO_Contract', icoAddress, bidder.wallet)
  
  // Encrypt bid data
  const encryptedBid = encryptBidData(bidder.bidData)
  
  // Calculate max spend in USDC (6 decimals) with 10% buffer using pure integer arithmetic
  const priceUsdc = hre.ethers.parseUnits(bidder.bidData.price, 6) // Convert price to USDC wei (BigInt)
  const totalUsdcCostWei = priceUsdc * BigInt(bidder.bidData.quantity) // Total cost in USDC wei
  const maxSpend = totalUsdcCostWei * BigInt(110) / BigInt(100) // Add 10% buffer using integer math
  
  // For display purposes only (convert back to human readable)
  const totalUsdcCost = parseFloat(bidder.bidData.price) * bidder.bidData.quantity
  const maxSpendUsdc = totalUsdcCost * 1.1
  
  // Create permit signature (simplified for testing)
  const permitSig = '0x' // Empty for testing
  
  console.log(`   Price: ${bidder.bidData.price} USDC per ICO token`)
  console.log(`   Quantity: ${bidder.bidData.quantity} ICO tokens`)
  console.log(`   Total Cost: ${totalUsdcCost.toFixed(2)} USDC`)
  console.log(`   Max Spend: ${maxSpendUsdc.toFixed(2)} USDC (with buffer)`)
  console.log(`   Country: ${bidder.bidData.country}`)
  console.log(`   Pitch: ${bidder.bidData.pitch.substring(0, 50)}...`)
  
  try {
    const tx = await ico.submitBid(saleId, encryptedBid, maxSpend, permitSig)
    const receipt = await tx.wait()
    
    console.log(`   ✅ Bid submitted! Gas used: ${receipt?.gasUsed}`)
    console.log(`   📋 Transaction: ${tx.hash}`)
    
  } catch (error: any) {
    console.log(`   ❌ Bid failed: ${error.message}`)
  }
}

async function checkSaleStatus(icoAddress: string, saleId: number): Promise<void> {
  console.log('\n📊 Checking sale status...')
  
  const ico = await hre.ethers.getContractAt('ICO_Contract', icoAddress)
  
  try {
    const sale = await ico.sales(saleId)
    const [issuer, supply, deadline, policyHash, finalized] = sale
    
    const now = Math.floor(Date.now() / 1000)
    const timeRemaining = Number(deadline) - now
    
    console.log(`   Sale ID: ${saleId}`)
    console.log(`   Issuer: ${issuer}`)
    console.log(`   Supply: ${hre.ethers.formatEther(supply)} tokens`)
    console.log(`   Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`)
    console.log(`   Time remaining: ${timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s` : 'EXPIRED'}`)
    console.log(`   Finalized: ${finalized}`)
    
    if (timeRemaining <= 0) {
      console.log('   🔥 Sale has expired - TEE agent should process settlement!')
    }
    
  } catch (error: any) {
    console.log(`   ❌ Failed to get sale info: ${error.message}`)
  }
}

async function main(): Promise<void> {
  console.log('🧪 Starting USDC Bid Testing Script')
  console.log('====================================')
  console.log('💰 Testing multi-chain ICO: USDC payments → ICO token distribution')
  
  // Validate network
  if (hre.network.name !== 'sapphire-localnet') {
    throw new Error(`❌ This script must run on sapphire-localnet, current: ${hre.network.name}`)
  }
  
  // Get contract addresses from environment
  const icoAddress = process.env.ICO_CONTRACT_ADDRESS
  const saleId = parseInt(process.env.TEST_SALE_ID || '1')
  
  if (!icoAddress) {
    throw new Error('❌ ICO_CONTRACT_ADDRESS environment variable required')
  }
  
  console.log(`🎯 ICO Contract: ${icoAddress}`)
  console.log(`🎯 Sale ID: ${saleId}`)
  
  // Check initial sale status
  await checkSaleStatus(icoAddress, saleId)
  
  // Create test bidders
  console.log('\n👥 Creating test bidders...')
  const bidders = await createTestBidders()
  console.log(`✅ Created ${bidders.length} test bidders`)
  
  // Submit bids
  console.log('\n📤 Submitting bids...')
  for (const bidder of bidders) {
    await submitBid(bidder, icoAddress, saleId)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Small delay between bids
  }
  
  // Final status check
  await checkSaleStatus(icoAddress, saleId)
  
  console.log('\n✅ Bid testing completed!')
  console.log('\n🎉 Next steps:')
  console.log('   1. Wait for sale deadline to pass')
  console.log('   2. Monitor TEE agent logs: ./dev-local.sh logs tee-agent')
  console.log('   3. Check agent status: curl http://localhost:8080/sales')
  console.log('   4. Watch for settlement processing and signature generation')
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Bid testing failed:', err)
    process.exit(1)
  })
} 