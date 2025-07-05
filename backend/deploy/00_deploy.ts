
import hre from 'hardhat'
import { spawn } from 'child_process'

/**
 * End-to-end cross-chain ICO deployment orchestrator
 * 
 * This script coordinates the complete deployment sequence:
 * 1. Deploy Token on Ethereum (Sepolia)
 * 2. Deploy BatchSettlement on Ethereum (Sepolia) 
 * 3. Deploy ICO Contract on Sapphire (Testnet)
 * 
 * Prerequisites:
 * - TEE_PUBKEY environment variable must be set
 * - MNEMONIC environment variable must be set
 * - Network configurations must be properly set in hardhat.config.ts
 */

async function runDeploymentScript(scriptPath: string, network: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${scriptPath} on ${network}`)
    
    const child = spawn('pnpm', ['hardhat', 'run', scriptPath, '--network', network], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptPath} completed successfully`)
        resolve()
      } else {
        console.error(`❌ ${scriptPath} failed with exit code ${code}`)
        reject(new Error(`Deployment script failed: ${scriptPath}`))
      }
    })

    child.on('error', (error) => {
      console.error(`❌ Failed to run ${scriptPath}:`, error.message)
      reject(error)
    })
  })
}

async function main() {
  console.log('=== CROSS-CHAIN ICO DEPLOYMENT ORCHESTRATOR ===')
  console.log('Network:', hre.network.name)
  
  // Validate prerequisites
  const teePubKey = process.env.TEE_PUBKEY
  if (!teePubKey) {
    console.error('❌ TEE_PUBKEY environment variable is required')
    console.error('Please start the TEE agent first and get its public key:')
    console.error('1. Run: kitty tee-setup')
    console.error('2. Run: kitty tee-start') 
    console.error('3. Get key from logs: kitty rofl-extract-key')
    console.error('4. Set: export TEE_PUBKEY=<tee_public_key>')
    process.exit(1)
  }
  
  const mnemonic = process.env.MNEMONIC
  if (!mnemonic) {
    console.error('❌ MNEMONIC environment variable is required')
    console.error('Set: export MNEMONIC="your twelve word mnemonic phrase here"')
    process.exit(1)
  }

  console.log('🔐 TEE Public Key:', teePubKey)
  console.log('👤 Deployer mnemonic configured')

  try {
    // Step 1: Deploy Token on Ethereum (Sepolia)
    console.log('\n=== STEP 1: TOKEN DEPLOYMENT (ETHEREUM) ===')
    await runDeploymentScript('deploy/01_deploy_token.ts', 'sepolia')
    
    // Step 2: Deploy BatchSettlement on Ethereum (Sepolia)
    console.log('\n=== STEP 2: BATCH SETTLEMENT DEPLOYMENT (ETHEREUM) ===')
    await runDeploymentScript('deploy/03_deploy_batch.ts', 'sepolia')
    
    // Step 3: Deploy ICO Contract on Sapphire (Testnet)
    console.log('\n=== STEP 3: ICO CONTRACT DEPLOYMENT (SAPPHIRE) ===')
    await runDeploymentScript('deploy/02_deploy_ico.ts', 'sapphire-testnet')

    console.log('\n🎉 CROSS-CHAIN DEPLOYMENT COMPLETE!')
    console.log('\n=== NEXT STEPS ===')
    console.log('1. Configure TEE agent with the deployed contract addresses')
    console.log('2. Approve BatchSettlement contract to spend tokens')
    console.log('3. Update frontend configuration with contract addresses')
    console.log('4. Test the complete flow with a sample ICO')
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message)
    console.error('\nPlease check the error above and retry the deployment')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Deployment orchestrator failed:', err)
  process.exit(1)
})
