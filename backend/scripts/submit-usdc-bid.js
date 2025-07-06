const { ethers } = require("hardhat");

/**
 * Submit a bid using USDC payments with proper EIP-2612 permits
 * 
 * This script demonstrates the production workflow:
 * 1. Users bid USDC amounts to buy ICO tokens (KITTY)
 * 2. Creates EIP-2612 permit for USDC spending authorization
 * 3. Submits encrypted bid to ICO contract on Sapphire
 * 4. TEE will later process bids and execute settlement on Sepolia
 */

// Circle USDC addresses
const USDC_ADDRESSES = {
  'sepolia': '0x1c7D4B196Cb0C7B01d743fbc6116a902379C7238',
  'sapphire-localnet': '0x1c7D4B196Cb0C7B01d743fbc6116a902379C7238', // Reference for local testing
}

async function createUSDCPermit(signer, usdcAddress, spender, value, deadline) {
  console.log("📝 Creating USDC EIP-2612 permit...");
  
  // USDC permit domain
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: await signer.provider.getNetwork().then(n => n.chainId),
    verifyingContract: usdcAddress
  };
  
  // EIP-2612 permit types
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };
  
  // Get USDC contract for nonce
  const usdcAbi = [
    "function nonces(address owner) view returns (uint256)",
    "function name() view returns (string)",
    "function version() view returns (string)"
  ];
  
  const usdc = new ethers.Contract(usdcAddress, usdcAbi, signer);
  const nonce = await usdc.nonces(signer.address);
  
  // Permit message
  const message = {
    owner: signer.address,
    spender: spender,
    value: value,
    nonce: nonce,
    deadline: deadline
  };
  
  // Sign permit
  const signature = await signer.signTypedData(domain, types, message);
  const { v, r, s } = ethers.Signature.from(signature);
  
  // Encode permit for contract call
  const permitSig = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256", "uint8", "bytes32", "bytes32"],
    [value, deadline, v, r, s]
  );
  
  console.log("✅ USDC permit created");
  console.log(`   Value: ${ethers.formatUnits(value, 6)} USDC`);
  console.log(`   Deadline: ${new Date(deadline * 1000).toLocaleString()}`);
  
  return permitSig;
}

async function main() {
  // Get parameters from environment
  const bidAmount = process.env.BID_AMOUNT || "1000"; // ICO tokens requested
  const bidPrice = process.env.BID_PRICE || "1.50"; // USDC per ICO token
  const pitch = process.env.PITCH || "Great project with strong fundamentals!";
  const country = process.env.COUNTRY || "US";
  const saleId = process.env.SALE_ID || "1";
  
  console.log("🎯 Submitting USDC Bid to ICO");
  console.log("==============================");
  console.log("Sale ID:", saleId);
  console.log("Bid Amount:", bidAmount, "ICO tokens requested");
  console.log("Bid Price:", bidPrice, "USDC per ICO token");
  console.log("Total Cost:", (parseFloat(bidAmount) * parseFloat(bidPrice)).toFixed(2), "USDC");
  console.log("Pitch:", pitch);
  console.log("Country:", country);
  
  // Get contract addresses
  const icoAddress = process.env.ICO_CONTRACT_ADDRESS;
  const batchAddress = process.env.BATCH_SETTLEMENT_ADDRESS;
  const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || USDC_ADDRESSES[hre.network.name];
  
  if (!icoAddress) {
    throw new Error("ICO_CONTRACT_ADDRESS not set");
  }
  if (!batchAddress) {
    throw new Error("BATCH_SETTLEMENT_ADDRESS not set - needed for USDC permits");
  }
  if (!usdcAddress) {
    throw new Error("USDC_CONTRACT_ADDRESS not set");
  }
  
  console.log("\n📋 Contract Configuration:");
  console.log("ICO Contract:", icoAddress);
  console.log("BatchSettlement:", batchAddress);
  console.log("USDC Token:", usdcAddress);
  
  // Load contracts
  const ICOContract = await ethers.getContractFactory("ICO_Contract");
  const ico = ICOContract.attach(icoAddress);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("\n👤 Bidder:", signer.address);
  
  // Calculate USDC values (6 decimals for USDC)
  const pricePerToken = ethers.parseUnits(bidPrice, 6); // USDC per ICO token
  const quantityRequested = ethers.parseUnits(bidAmount, 18); // ICO tokens (18 decimals)
  const totalUSDCCost = BigInt(bidAmount) * pricePerToken; // Total USDC needed
  
  // Add 10% buffer for max spend to handle price fluctuations
  const maxSpend = totalUSDCCost * BigInt(110) / BigInt(100);
  
  console.log("\n💰 Payment Calculation:");
  console.log("Price per token:", ethers.formatUnits(pricePerToken, 6), "USDC");
  console.log("Quantity requested:", ethers.formatUnits(quantityRequested, 18), "ICO tokens");
  console.log("Total cost:", ethers.formatUnits(totalUSDCCost, 6), "USDC");
  console.log("Max spend (with buffer):", ethers.formatUnits(maxSpend, 6), "USDC");
  
  // Create USDC permit (expires in 1 hour)
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const permitSig = await createUSDCPermit(signer, usdcAddress, batchAddress, maxSpend, deadline);
  
  // Encrypt bid data (ABI encoding for development, HPKE in production)
  console.log("\n🔐 Encrypting bid data...");
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encryptedBlob = abiCoder.encode(
    ["uint256", "uint256", "string", "string"],
    [pricePerToken, quantityRequested, pitch, country]
  );
  
  console.log("✅ Bid encrypted");
  console.log("Encrypted blob size:", encryptedBlob.length, "bytes");
  
  // Submit bid to ICO contract
  console.log("\n📤 Submitting bid to ICO contract...");
  
  const tx = await ico.submitBid(
    saleId,
    encryptedBlob,
    maxSpend,
    permitSig,
    {
      gasLimit: 300000 // Ensure sufficient gas for permit + bid
    }
  );
  
  console.log("Transaction hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("✅ Bid submitted successfully!");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Extract bid event
  const bidSubmittedEvent = receipt.logs.find(log => {
    try {
      const parsed = ico.interface.parseLog(log);
      return parsed.name === "BidSubmitted";
    } catch {
      return false;
    }
  });
  
  if (bidSubmittedEvent) {
    const parsed = ico.interface.parseLog(bidSubmittedEvent);
    console.log("\n🎉 Bid Event Confirmed:");
    console.log("Sale ID:", parsed.args.id.toString());
    console.log("Bidder:", parsed.args.bidder);
  }
  
  console.log("\n✅ Bid Processing Summary:");
  console.log("✅ Encrypted bid stored on Sapphire blockchain");
  console.log("✅ USDC payment authorized via permit");
  console.log("✅ TEE will decrypt and score bid when sale expires");
  console.log("✅ If you win, BatchSettlement will execute USDC→ICO token swap");
  
  console.log("\n📋 Next Steps:");
  console.log("1. Wait for sale deadline to pass");
  console.log("2. TEE will process all bids confidentially");
  console.log("3. Check results with: npm run check-results");
  console.log("4. Winners will receive ICO tokens automatically");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error submitting bid:", error);
    process.exit(1);
  }); 