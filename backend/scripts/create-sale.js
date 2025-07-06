const { ethers } = require("hardhat");

async function main() {
  const tokenAmount = process.env.TOKEN_AMOUNT || "10000";
  const deadline = process.env.DEADLINE || Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  console.log("Creating ICO Sale...");
  console.log("Token Amount:", tokenAmount);
  console.log("Deadline:", deadline);
  
  const icoAddress = process.env.ICO_CONTRACT_ADDRESS;
  if (!icoAddress) {
    throw new Error("ICO_CONTRACT_ADDRESS not set");
  }
  
  // Load ICO contract
  const ICOContract = await ethers.getContractFactory("ICO_Contract");
  const ico = ICOContract.attach(icoAddress);
  
  // Create sale
  const tx = await ico.createSale(
    ethers.parseUnits(tokenAmount, 18), // Convert to wei
    deadline
  );
  
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("Sale created successfully!");
  
  // Extract sale ID from events
  const saleCreatedEvent = receipt.logs.find(
    log => log.fragment && log.fragment.name === "SaleCreated"
  );
  
  if (saleCreatedEvent) {
    console.log("Sale ID:", saleCreatedEvent.args.id.toString());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 