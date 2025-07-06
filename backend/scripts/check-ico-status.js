const { ethers } = require("hardhat");

async function main() {
  console.log("Checking ICO Status...");
  
  const icoAddress = process.env.ICO_CONTRACT_ADDRESS;
  if (!icoAddress) {
    throw new Error("ICO_CONTRACT_ADDRESS not set");
  }
  
  // Load ICO contract
  const ICOContract = await ethers.getContractFactory("ICO_Contract");
  const ico = ICOContract.attach(icoAddress);
  
  console.log("ICO Contract:", icoAddress);
  
  try {
    // Get total sales count
    const totalSales = await ico.totalSales();
    console.log("Total Sales Created:", totalSales.toString());
    
    if (totalSales > 0) {
      console.log("\n📊 Sale Details:");
      
      for (let i = 1; i <= totalSales; i++) {
        console.log(`\n🎯 Sale ${i}:`);
        
        try {
          const sale = await ico.sales(i);
          const [creator, supply, deadline, finalized] = sale;
          
          console.log(`  Creator: ${creator}`);
          console.log(`  Supply: ${ethers.formatUnits(supply, 18)} tokens`);
          console.log(`  Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);
          console.log(`  Status: ${finalized ? 'Finalized' : 'Active'}`);
          
          // Check if sale has expired
          const now = Math.floor(Date.now() / 1000);
          const hasExpired = Number(deadline) <= now;
          console.log(`  Expired: ${hasExpired ? 'YES' : 'NO'}`);
          
          if (hasExpired && !finalized) {
            console.log(`  ⚠️  Sale has expired but not yet finalized`);
          }
          
        } catch (saleError) {
          console.log(`  ❌ Error reading sale ${i}: ${saleError.message}`);
        }
      }
    }
    
    // Check recent events
    console.log("\n📋 Recent Events:");
    
    try {
      // Get SaleCreated events
      const saleCreatedFilter = ico.filters.SaleCreated();
      const saleCreatedEvents = await ico.queryFilter(saleCreatedFilter, -100); // Last 100 blocks
      
      console.log(`  SaleCreated Events: ${saleCreatedEvents.length}`);
      saleCreatedEvents.forEach((event, i) => {
        console.log(`    ${i + 1}. Sale ${event.args.id} - ${ethers.formatUnits(event.args.supply, 18)} tokens`);
      });
      
      // Get BidSubmitted events
      const bidSubmittedFilter = ico.filters.BidSubmitted();
      const bidSubmittedEvents = await ico.queryFilter(bidSubmittedFilter, -100); // Last 100 blocks
      
      console.log(`  BidSubmitted Events: ${bidSubmittedEvents.length}`);
      bidSubmittedEvents.forEach((event, i) => {
        console.log(`    ${i + 1}. Sale ${event.args.id} - Bidder: ${event.args.bidder.substring(0, 10)}...`);
      });
      
    } catch (eventError) {
      console.log(`  ❌ Error reading events: ${eventError.message}`);
    }
    
    // Check TEE agent status
    console.log("\n🔍 TEE Agent Status:");
    
    try {
      const teeAgentUrl = process.env.TEE_AGENT_URL || 'http://localhost:8080';
      const response = await fetch(`${teeAgentUrl}/health`);
      
      if (response.ok) {
        const health = await response.json();
        console.log(`  Status: ${health.status}`);
        console.log(`  ✅ TEE Agent is reachable`);
        
        // Check settlements
        try {
          const settlementsResponse = await fetch(`${teeAgentUrl}/settlements`);
          if (settlementsResponse.ok) {
            const settlements = await settlementsResponse.json();
            console.log(`  Settlements: ${settlements.total_settlements}`);
          }
        } catch (e) {
          console.log(`  Settlements: Unable to check`);
        }
        
      } else {
        console.log(`  ❌ TEE Agent not reachable (${response.status})`);
      }
    } catch (teeError) {
      console.log(`  ❌ TEE Agent not reachable: ${teeError.message}`);
    }
    
  } catch (error) {
    console.error("Error checking ICO status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 