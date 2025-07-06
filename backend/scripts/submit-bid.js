const { ethers } = require("hardhat");

async function main() {
  const bidAmount = process.env.BID_AMOUNT || "1000";
  const bidPrice = process.env.BID_PRICE || "0.1";
  const pitch = process.env.PITCH || "Great project!";
  const country = process.env.COUNTRY || "US";
  const saleId = process.env.SALE_ID || "1";
  
  console.log("Submitting Bid...");
  console.log("Sale ID:", saleId);
  console.log("Bid Amount:", bidAmount, "tokens");
  console.log("Bid Price:", bidPrice, "ETH per token");
  console.log("Pitch:", pitch);
  console.log("Country:", country);
  
  const icoAddress = process.env.ICO_CONTRACT_ADDRESS;
  if (!icoAddress) {
    throw new Error("ICO_CONTRACT_ADDRESS not set");
  }
  
  // Load ICO contract
  const ICOContract = await ethers.getContractFactory("ICO_Contract");
  const ico = ICOContract.attach(icoAddress);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Bidder address:", signer.address);
  
  // Calculate values
  const priceWei = ethers.parseUnits(bidPrice, 18);
  const quantityWei = ethers.parseUnits(bidAmount, 18);
  const maxSpend = priceWei * BigInt(bidAmount);
  
  // For development/testing, we'll use simple ABI encoding instead of proper HPKE encryption
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encryptedBlob = abiCoder.encode(
    ["uint256", "uint256", "string", "string"],
    [priceWei, quantityWei, pitch, country]
  );
  
  console.log("Max spend:", ethers.formatUnits(maxSpend, 18), "ETH");
  console.log("Encrypted blob size:", encryptedBlob.length, "bytes");
  
  // Submit bid
  const tx = await ico.submitBid(
    saleId,
    encryptedBlob,
    maxSpend,
    "0x" // Empty permit signature for development
  );
  
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("Bid submitted successfully!");
  
  // Extract bid event
  const bidSubmittedEvent = receipt.logs.find(
    log => log.fragment && log.fragment.name === "BidSubmitted"
  );
  
  if (bidSubmittedEvent) {
    console.log("Bid confirmed for sale:", bidSubmittedEvent.args.id.toString());
    console.log("Bidder:", bidSubmittedEvent.args.bidder);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 