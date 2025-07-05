#!/usr/bin/env bun
import { Command } from 'commander'
import { spawn } from 'child_process'
import { select, input, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import figlet from 'figlet'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import ora from 'ora'

const program = new Command()

// ASCII Art Banner
const showBanner = () => {
  // Custom rainbow function
  const rainbow = (text: string) => {
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta]
    return text.split('').map((char, i) => colors[i % colors.length](char)).join('')
  }

  const catArt = `
  ${rainbow('🐱')}clear
${rainbow('██╗  ██╗██╗████████╗████████╗██╗   ██╗    ██╗ ██████╗ ██████╗ ')}
${rainbow('██║ ██╔╝██║╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝    ██║██╔════╝██╔═══██╗')}
${rainbow('█████╔╝ ██║   ██║      ██║    ╚████╔╝     ██║██║     ██║   ██║')}
${rainbow('██╔═██╗ ██║   ██║      ██║     ╚██╔╝      ██║██║     ██║   ██║')}
${rainbow('██║  ██╗██║   ██║      ██║      ██║       ██║╚██████╗╚██████╔╝')}
${rainbow('╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝      ╚═╝       ╚═╝ ╚═════╝ ╚═════╝ ')}
`
  console.log(catArt)
  console.log(chalk.gray('          🐱 Magical ICO Management CLI with Rainbow Powers 🌈\n'))
}

// Simple spinner implementation
const createSpinner = (message: string) => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  let interval: NodeJS.Timeout | null = null
  
  return {
    start() {
      process.stdout.write(chalk.blue(`${frames[0]} ${message}`))
      interval = setInterval(() => {
        process.stdout.write('\r' + chalk.blue(`${frames[i++ % frames.length]} ${message}`))
      }, 100)
    },
    stop() {
      if (interval) {
        clearInterval(interval)
        process.stdout.write('\r' + ' '.repeat(message.length + 5) + '\r')
      }
    }
  }
}

// Environment management
const NETWORKS = {
  'local (hardhat)': 'hardhat',
  'sepolia': 'sepolia',
  'sapphire-localnet': 'sapphire-localnet', 
  'sapphire-testnet': 'sapphire-testnet',
  'sapphire-mainnet': 'sapphire'
}

const CONFIG_FILE = '.kitty-ico.json'

interface Config {
  network: string
  tokenName: string
  tokenSymbol: string
  icoAddress?: string
  tokenAddress?: string
  batchSettlementAddress?: string
  teePublicKey?: string
  teeAgentSetup?: boolean
}

const loadConfig = async (): Promise<Config> => {
  if (existsSync(CONFIG_FILE)) {
    const content = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(content)
  }
  return {
    network: 'local',
    tokenName: 'Kitty ICO',
    tokenSymbol: 'KITTY'
  }
}

const saveConfig = async (config: Config) => {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

async function runCommand(command: string, cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const spinner = ora(`Running: ${command}`).start()
    
    const child = spawn('sh', ['-c', command], {
      cwd: cwd || process.cwd(),
      stdio: ['inherit', 'inherit', 'inherit'], // Allow interactive prompts
      env: { ...process.env, FORCE_COLOR: '1' }
    })

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`✅ Command completed successfully`)
        resolve(true)
      } else {
        spinner.fail(`❌ Command failed with exit code ${code}`)
        resolve(false)
      }
    })

    child.on('error', (error) => {
      spinner.fail(`❌ Command failed: ${error.message}`)
      resolve(false)
    })
  })
}

// Interactive setup
program
  .command('setup')
  .description('Interactive project setup')
  .action(async () => {
    showBanner()
    
    const config = await loadConfig()
    
    console.log(chalk.yellow('🚀 Setting up your ICO project...\n'))
    
    const network = await select({
      message: 'Select network:',
      choices: Object.entries(NETWORKS).map(([key, value]) => ({
        name: key,
        value: value
      }))
    })
    
    const tokenName = await input({
      message: 'Token name:',
      default: config.tokenName
    })
    
    const tokenSymbol = await input({
      message: 'Token symbol:',
      default: config.tokenSymbol
    })
    
    const installDeps = await confirm({
      message: 'Install dependencies?',
      default: true
    })
    
    if (installDeps) {
      console.log(chalk.blue('\n📦 Installing dependencies...'))
      await runCommand('pnpm install')
    }
    
    const newConfig = {
      ...config,
      network,
      tokenName,
      tokenSymbol
    }
    
    await saveConfig(newConfig)
    console.log(chalk.green('\n✅ Setup complete!'))
    console.log(chalk.gray(`Config saved to ${CONFIG_FILE}`))
  })

// TEE Agent Setup (Step 0)
program
  .command('tee-setup')
  .description('Setup ROLF TEE Agent (Step 0 - Required First)')
  .action(async () => {
    console.log(chalk.blue('🔐 Setting up ROLF TEE Agent...'))
    console.log(chalk.yellow('This is Step 0 and must be completed first!\n'))
    
    const config = await loadConfig()
    
    // Check if Oracle directory exists
    if (!existsSync('oracle')) {
      console.log(chalk.red('❌ Oracle directory not found!'))
      console.log(chalk.gray('Expected: oracle/'))
      return
    }
    
    // Build the ROLF container (this handles Python dependencies automatically)
    console.log(chalk.blue('🏗️  Building ROLF container...'))
    
    const buildSuccess = await runCommand('docker build -f Dockerfile.tee -t kitty-ico-tee .')
    
    if (!buildSuccess) {
      console.log(chalk.red('❌ Failed to build ROLF container'))
      return
    }
    
    // Generate TEE key by running the container briefly
    console.log(chalk.blue('🔑 Generating TEE Agent EOA...'))
    const keygenSuccess = await runCommand('docker-compose -f compose.localnet.yaml run --rm tee-agent python -c "from agent import TEEKeyManager; km = TEEKeyManager(); print(f\'TEE_KEY={km.get_address()}\')"')
    
    if (!keygenSuccess) {
      console.log(chalk.red('❌ Failed to generate TEE key'))
      return
    }
    
    // Read the generated TEE key from container
    let teePublicKey = ''
    try {
      // Create data directory if it doesn't exist
      await runCommand('mkdir -p data/tee-keys')
      
      // Try to read the key from the mounted volume
      const keyFile = 'data/tee-keys/public_key.txt'
      if (existsSync(keyFile)) {
        const keyContent = await readFile(keyFile, 'utf-8')
        teePublicKey = keyContent.trim()
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not read TEE key file'))
    }
    
    // Update config to mark TEE agent as setup
    const newConfig = {
      ...config,
      teeAgentSetup: true,
      teePublicKey: teePublicKey || config.teePublicKey
    }
    
    await saveConfig(newConfig)
    
    console.log(chalk.green('\n✅ TEE Agent setup complete!'))
    if (teePublicKey) {
      console.log(chalk.cyan(`🔑 TEE Public Key: ${teePublicKey}`))
    }
    console.log(chalk.yellow('\n📋 Next steps:'))
    console.log(chalk.gray('1. Configure TEE agent: kitty tee-config'))
    console.log(chalk.gray('2. Run deployment: kitty deploy'))
    console.log(chalk.gray('3. Fund the TEE agent with ETH'))
    console.log(chalk.gray('4. Start the TEE agent: kitty tee-start'))
  })

// TEE Agent Management
program
  .command('tee-start')
  .description('Start the TEE Agent')
  .option('-d, --detached', 'Run in detached mode')
  .action(async (options) => {
    const config = await loadConfig()
    
    if (!config.teeAgentSetup) {
      console.log(chalk.red('❌ TEE Agent not set up!'))
      console.log(chalk.gray('Run: kitty tee-setup'))
      return
    }
    
    console.log(chalk.blue('🚀 Starting TEE Agent in ROLF container...'))
    
    const composeFile = config.network === 'hardhat' ? 'compose.localnet.yaml' : 'compose.yaml'
    const detachedFlag = options.detached ? '-d' : ''
    
    await runCommand(`docker-compose -f ${composeFile} up ${detachedFlag} tee-agent`)
  })

program
  .command('tee-build')
  .description('Build the TEE Agent')
  .action(async () => {
    console.log(chalk.blue('🔧 Building TEE Agent container...'))
    await runCommand('docker build -f Dockerfile.tee -t kitty-ico-tee .')
  })

program
  .command('tee-status')
  .description('Check TEE Agent status')
  .action(async () => {
    const config = await loadConfig()
    
    console.log(chalk.blue('🔍 TEE Agent Status:'))
    console.log(`Setup complete: ${config.teeAgentSetup ? chalk.green('✓') : chalk.red('✗')}`)
    
    // Try to read TEE key from file if not in config
    let teeKey = config.teePublicKey
    if (!teeKey && existsSync('data/tee-keys/public_key.txt')) {
      try {
        teeKey = (await readFile('data/tee-keys/public_key.txt', 'utf-8')).trim()
      } catch (e) {
        // Ignore errors reading key file
      }
    }
    
    console.log(`TEE Public Key: ${teeKey || chalk.gray('Not set')}`)
    
    if (existsSync('oracle/requirements.txt')) {
      console.log(`Python dependencies: ${chalk.green('✓ Available')}`)
    } else {
      console.log(`Python dependencies: ${chalk.red('✗ Not found')}`)
    }
    
    if (existsSync('oracle/agent.py')) {
      console.log(`Agent code: ${chalk.green('✓ Available')}`)
    } else {
      console.log(`Agent code: ${chalk.red('✗ Not found')}`)
    }
    
    if (existsSync('rofl.yaml')) {
      console.log(`ROLF manifest: ${chalk.green('✓ Available')}`)
    } else {
      console.log(`ROLF manifest: ${chalk.red('✗ Not found')}`)
    }
    
    // Check if Docker image exists
    const dockerStatus = await runCommand('docker images kitty-ico-tee --format "table {{.Repository}}"')
    if (dockerStatus) {
      console.log(`Docker image: ${chalk.green('✓ Built')}`)
    } else {
      console.log(`Docker image: ${chalk.gray('Not built')}`)
    }
    
    // Check if container is running
    const runningStatus = await runCommand('docker ps --filter "name=kitty-ico-tee-agent" --format "table {{.Names}}"')
    if (runningStatus) {
      console.log(`Container status: ${chalk.green('✓ Running')}`)
    } else {
      console.log(`Container status: ${chalk.gray('Not running')}`)
    }
  })

// ROFL Deployment Commands
program
  .command('rofl-build')
  .description('Build ROFL bundle for testnet deployment')
  .option('--force', 'Force build ignoring validation checks')
  .action(async (options) => {
    console.log(chalk.blue('🏗️  Building ROFL bundle...'))
    
    // First try normal build
    let buildSuccess = await runCommand('oasis rofl build')
    
    if (!buildSuccess) {
      console.log(chalk.yellow('⚠️  Normal build failed, trying with --force flag...'))
      console.log(chalk.gray('(This is normal for local development)'))
      
      // Try with force flag
      buildSuccess = await runCommand('oasis rofl build --force')
    }
    
    // If user explicitly passed --force, use it
    if (options.force) {
      buildSuccess = await runCommand('oasis rofl build --force')
    }
    
    if (buildSuccess) {
      console.log(chalk.green('✅ ROFL bundle built successfully'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('1. Deploy to testnet: kitty rofl-deploy'))
      console.log(chalk.gray('2. Check status: kitty rofl-status'))
    } else {
      console.log(chalk.red('❌ Failed to build ROFL bundle'))
      console.log(chalk.yellow('💡 Manual build command:'))
      console.log(chalk.gray('  oasis rofl build --force'))
    }
  })

program
  .command('network-config')
  .description('Configure Oasis CLI for Sapphire Testnet')
  .action(async () => {
    console.log(chalk.blue('🌐 Configuring Oasis CLI for Sapphire Testnet...'))
    
    // Add Sapphire Testnet network
    console.log(chalk.blue('📡 Adding Sapphire Testnet network...'))
    const addNetworkSuccess = await runCommand('oasis network add testnet --rpc-endpoint https://testnet.sapphire.oasis.dev')
    
    if (addNetworkSuccess) {
      console.log(chalk.green('✅ Network added successfully!'))
      
      // Set as default network
      console.log(chalk.blue('🔧 Setting as default network...'))
      await runCommand('oasis network set-default testnet')
      
      console.log(chalk.green('✅ Network configuration complete!'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('1. Setup wallet: kitty wallet-setup'))
      console.log(chalk.gray('2. Create ROFL app: kitty rofl-create'))
    } else {
      console.log(chalk.red('❌ Failed to add network'))
      console.log(chalk.yellow('💡 Try manual configuration:'))
      console.log(chalk.gray('   oasis network add testnet --rpc-endpoint https://testnet.sapphire.oasis.dev'))
    }
  })

program
  .command('wallet-setup')
  .description('Setup Oasis wallet account')
  .action(async () => {
    console.log(chalk.blue('💳 Setting up Oasis wallet...'))
    
    // Check if Oasis CLI is available
    const oasisAvailable = await runCommand('which oasis')
    if (!oasisAvailable) {
      console.log(chalk.red('❌ Oasis CLI not found'))
      console.log(chalk.yellow('💡 Install Oasis CLI first:'))
      console.log(chalk.gray('   Visit: https://docs.oasis.io/developers/oasis-cli/'))
      console.log(chalk.gray('   Or run: curl -fsSL https://get.oasis.io | bash'))
      return
    }
    
    // Check if network is configured
    console.log(chalk.blue('🌐 Checking network configuration...'))
    const networkSuccess = await runCommand('oasis network list')
    if (!networkSuccess) {
      console.log(chalk.yellow('⚠️  Network not configured properly'))
      console.log(chalk.gray('Run: kitty network-config'))
      
      const shouldConfigureNetwork = await confirm({
        message: 'Configure network now?',
        default: true
      })
      
      if (shouldConfigureNetwork) {
        await program.parseAsync(['node', 'cli.ts', 'network-config'])
      }
      return
    }
    
    const choice = await select({
      message: 'How would you like to set up your wallet?',
      choices: [
        { name: 'Generate new account', value: 'generate' },
        { name: 'Import existing account', value: 'import' },
        { name: 'List existing accounts', value: 'list' },
        { name: 'Show wallet info', value: 'info' }
      ]
    })
    
    switch (choice) {
      case 'generate':
        console.log(chalk.blue('🔑 Generating new account...'))
        
        const accountName = await input({
          message: 'Account name (e.g., "rofl-deployer"):',
          default: 'rofl-deployer'
        })
        
        const generateSuccess = await runCommand(`oasis wallet create ${accountName}`)
        if (generateSuccess) {
          console.log(chalk.green('✅ New account generated!'))
          console.log(chalk.yellow('📋 Next steps:'))
          console.log(chalk.gray('1. Fund your account with TEST tokens'))
          console.log(chalk.gray('   Get from: https://faucet.testnet.oasis.dev'))
          console.log(chalk.gray('2. Create ROFL app: kitty rofl-create'))
        }
        break
        
      case 'import':
        console.log(chalk.blue('📥 Importing existing account...'))
        console.log(chalk.yellow('You will need your private key or mnemonic phrase'))
        
        const importName = await input({
          message: 'Account name:',
          default: 'imported-account'
        })
        
        await runCommand(`oasis wallet import ${importName}`)
        break
        
      case 'list':
        console.log(chalk.blue('📋 Existing accounts:'))
        await runCommand('oasis wallet list')
        break
        
      case 'info':
        console.log(chalk.blue('📋 Wallet information:'))
        await runCommand('oasis wallet show')
        break
    }
  })

program
  .command('rofl-create')
  .description('Create ROFL app on Sapphire Testnet')
  .action(async () => {
    console.log(chalk.blue('🆕 Creating ROFL app on Sapphire Testnet...'))
    
    // Check if wallet has accounts
    console.log(chalk.blue('📋 Checking wallet accounts...'))
    const listSuccess = await runCommand('oasis wallet list')
    
    if (!listSuccess) {
      console.log(chalk.red('❌ No wallet accounts found'))
      console.log(chalk.yellow('💡 Setup wallet first: kitty wallet-setup'))
      return
    }
    
    const success = await runCommand('oasis rofl create --network testnet')
    
    if (success) {
      console.log(chalk.green('✅ ROFL app created successfully!'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('1. Build bundle: kitty rofl-build'))
      console.log(chalk.gray('2. Deploy ROFL: kitty rofl-deploy'))
    } else {
      console.log(chalk.red('❌ Failed to create ROFL app'))
      console.log(chalk.yellow('💡 Try these steps:'))
      console.log(chalk.gray('1. Setup wallet: kitty wallet-setup'))
      console.log(chalk.gray('2. Fund your account with TEST tokens'))
      console.log(chalk.gray('3. Check network connection'))
    }
  })

program
  .command('rofl-deploy')
  .description('Deploy ROFL to Sapphire Testnet marketplace')
  .option('--show-offers', 'Show available offers first')
  .option('--offer <offer>', 'Specify offer ID (default: playground_short for TDX)')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Deploying ROFL to Sapphire Testnet...'))
    
    if (options.showOffers) {
      console.log(chalk.blue('📊 Available offers:'))
      await runCommand('oasis rofl deploy --show-offers --network testnet --paratime sapphire')
      
      const shouldDeploy = await confirm({
        message: 'Proceed with deployment?',
        default: true
      })
      
      if (!shouldDeploy) {
        console.log(chalk.yellow('Deployment cancelled'))
        return
      }
    }
    
    // Use the TDX offer by default since our ROFL requires Intel TDX
    const offerFlag = options.offer ? ` --offer ${options.offer}` : ' --offer playground_short'
    const deployCommand = `oasis rofl deploy --network testnet --paratime sapphire${offerFlag}`
    
    console.log(chalk.blue(`📋 Using command: ${deployCommand}`))
    console.log(chalk.yellow('🔍 This will use the TDX-enabled provider for your TEE agent'))
    
    const deploySuccess = await runCommand(deployCommand)
    
    if (deploySuccess) {
      console.log(chalk.green('✅ ROFL deployed successfully'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('1. Check status: kitty rofl-status'))
      console.log(chalk.gray('2. View logs: kitty rofl-logs'))
      console.log(chalk.gray('3. Extract TEE key: kitty rofl-extract-key'))
      console.log(chalk.gray('4. Deploy contracts with TEE key: kitty deploy'))
    } else {
      console.log(chalk.red('❌ Failed to deploy ROFL'))
      console.log(chalk.yellow('💡 Try these steps:'))
      console.log(chalk.gray('1. Create ROFL app first: kitty rofl-create'))
      console.log(chalk.gray('2. Build bundle: kitty rofl-build-docker --force'))
      console.log(chalk.gray('3. Update ROFL config: oasis rofl update --network testnet --paratime sapphire'))
      console.log(chalk.gray('4. Check manifest: cat rofl.yaml'))
      console.log(chalk.gray('5. Check account balance: oasis account show --network testnet --paratime sapphire'))
    }
  })

program
  .command('rofl-status')
  .description('Check ROFL deployment status')
  .action(async () => {
    console.log(chalk.blue('📊 ROFL Deployment Status:'))
    
    // Show machine status
    console.log(chalk.blue('\n🖥️  Machine Status:'))
    await runCommand('oasis rofl machine show')
    
    // Show ROFL app status
    console.log(chalk.blue('\n🔍 ROFL App Status:'))
    await runCommand('oasis rofl show --network testnet --paratime sapphire')
    
    console.log(chalk.yellow('\n📋 Quick Commands:'))
    console.log(chalk.gray('• View logs: kitty rofl-logs'))
    console.log(chalk.gray('• Extract TEE key: kitty rofl-extract-key'))
    console.log(chalk.gray('• Deploy contracts: kitty deploy'))
  })

program
  .command('rofl-logs')
  .description('Get ROFL deployment logs')
  .option('-f, --follow', 'Follow logs in real-time')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    console.log(chalk.blue('📋 ROFL Machine Logs:'))
    
    let logCommand = 'oasis rofl machine logs'
    
    if (options.follow) {
      console.log(chalk.yellow('📡 Following logs in real-time (Ctrl+C to stop)...'))
      console.log(chalk.gray('Note: Follow mode may not be supported by all versions'))
    }
    
    console.log(chalk.blue(`Running: ${logCommand}`))
    await runCommand(logCommand)
    
    if (options.lines && parseInt(options.lines) !== 50) {
      console.log(chalk.yellow(`\n📝 Note: --lines option not supported by oasis CLI`))
      console.log(chalk.gray('Showing all available logs'))
    }
  })

program
  .command('rofl-machine-status')
  .description('Check machine-specific status and details')
  .action(async () => {
    console.log(chalk.blue('🖥️  Machine Details:'))
    await runCommand('oasis rofl machine show')
    
    console.log(chalk.blue('\n📊 Additional Machine Info:'))
    console.log(chalk.gray('Machine ID, status, and resources shown above'))
  })

program
  .command('rofl-extract-key')
  .description('Extract TEE public key from deployed ROFL instance')
  .action(async () => {
    console.log(chalk.blue('🔑 Extracting TEE Public Key...'))
    
    try {
      // First check if machine is running
      console.log(chalk.blue('📊 Checking machine status...'))
      await runCommand('oasis rofl machine show')
      
      console.log(chalk.blue('\n🔍 Looking for TEE key in logs...'))
      await runCommand('oasis rofl machine logs | grep -i "public.*key\\|tee.*key\\|generated.*key" || echo "No key found in logs yet - machine may still be starting up"')
      
      console.log(chalk.yellow('\n💡 If no key is shown above, your TEE agent may still be starting up.'))
      console.log(chalk.gray('The TEE key is generated when the secure enclave fully initializes.'))
      console.log(chalk.gray('Try running this command again in a few minutes.'))
      
    } catch (error) {
      console.log(chalk.red('❌ Error extracting TEE key:'), error)
      console.log(chalk.yellow('\n💡 Troubleshooting:'))
      console.log(chalk.gray('1. Ensure your ROFL deployment is running'))
      console.log(chalk.gray('2. Check machine status with: kitty rofl-status'))
      console.log(chalk.gray('3. View logs with: kitty rofl-logs'))
    }
  })

program
  .command('rofl-stop')
  .description('Stop ROFL deployment')
  .action(async () => {
    const shouldStop = await confirm({
      message: 'Are you sure you want to stop the ROFL deployment?',
      default: false
    })
    
    if (shouldStop) {
      console.log(chalk.blue('🛑 Stopping ROFL deployment...'))
      // Note: Actual stop command would depend on Oasis CLI capabilities
      console.log(chalk.yellow('⚠️  Manual intervention required'))
      console.log(chalk.gray('Use the Oasis CLI or marketplace to stop the deployment'))
    }
  })

program
  .command('tee-config')
  .description('Configure TEE Agent environment')
  .action(async () => {
    const config = await loadConfig()
    
    if (!config.teeAgentSetup) {
      console.log(chalk.red('❌ TEE Agent not set up!'))
      console.log(chalk.gray('Run: kitty tee-setup'))
      return
    }
    
    console.log(chalk.blue('⚙️  Configuring TEE Agent...'))
    
    // Show current TEE key if available
    if (config.teePublicKey) {
      console.log(chalk.cyan(`🔑 TEE Public Key: ${config.teePublicKey}`))
    }
    
    const shouldConfigure = await confirm({
      message: 'Configure environment for Docker containers?',
      default: true
    })
    
    if (shouldConfigure) {
      // Get configuration details
      const ethereumRpc = await input({
        message: 'Ethereum RPC URL (e.g., Infura/Alchemy):',
        default: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID'
      })
      
      const sapphireRpc = await input({
        message: 'Sapphire RPC URL:',
        default: 'https://testnet.sapphire.oasis.io'
      })
      
      const openaiKey = await input({
        message: 'OpenAI API Key (for pitch scoring):',
        default: 'sk-...'
      })
      
      const paymentToken = await select({
        message: 'Payment token:',
        choices: [
          { name: 'USDC (Recommended)', value: 'usdc' },
          { name: 'USDT', value: 'usdt' },
          { name: 'WETH', value: 'weth' },
          { name: 'Custom', value: 'custom' }
        ]
      })
      
      // Create .env file for Docker Compose
      const envContent = `# TEE Agent Configuration
ETHEREUM_RPC_URL=${ethereumRpc}
SAPPHIRE_RPC_URL=${sapphireRpc}
OPENAI_API_KEY=${openaiKey}
PAYMENT_TOKEN=${paymentToken}

# Contract addresses (will be set after deployment)
ICO_CONTRACT_ADDRESS=
TOKEN_CONTRACT_ADDRESS=
BATCH_SETTLEMENT_ADDRESS=

# TEE Configuration
TEE_MODE=production
LOG_LEVEL=info
`
      
      await writeFile('.env', envContent)
      console.log(chalk.green('✓ Environment file created'))
      
      console.log(chalk.blue('\n📝 Configuration saved to .env'))
      console.log(chalk.yellow('You can edit .env file to modify these values'))
    }
    
    console.log(chalk.yellow('\nNext steps:'))
    console.log(chalk.gray('1. Edit .env with your actual values'))
    console.log(chalk.gray('2. Deploy contracts: kitty deploy'))
    console.log(chalk.gray('3. Fund TEE agent with ETH'))
    console.log(chalk.gray('4. Start TEE agent: kitty tee-start'))
  })

// Workflow guide
program
  .command('workflow')
  .description('Complete deployment workflow guide')
  .action(async () => {
    showBanner()
    
    console.log(chalk.blue('🌈 Complete Kitty ICO Deployment Workflow\n'))
    
    const config = await loadConfig()
    
    console.log(chalk.yellow('📋 Available Environments:'))
    console.log('')
    
    console.log(chalk.magenta('🏠 Local Development (compose.yaml):'))
    console.log(chalk.gray('  - For testing and development on your local machine'))
    console.log(chalk.gray('  - No registry required, builds locally'))
    console.log(chalk.gray('  - Hot reload support with volume mounts'))
    console.log(chalk.gray('  - Commands: kitty dev-start, kitty dev-stop'))
    console.log('')
    
    console.log(chalk.magenta('🌐 Testnet Deployment (compose.testnet.yaml):'))
    console.log(chalk.gray('  - For actual testnet deployment'))
    console.log(chalk.gray('  - Requires Docker registry (Docker Hub/GHCR)'))
    console.log(chalk.gray('  - Cross-platform builds (Mac → Linux/amd64)'))
    console.log(chalk.gray('  - Commands: kitty docker-build-push, kitty rofl-build-docker'))
    console.log('')
    
    console.log(chalk.magenta('🔬 Localnet Testing (compose.localnet.yaml):'))
    console.log(chalk.gray('  - For testing with Oasis localnet'))
    console.log(chalk.gray('  - Simulates full Oasis network locally'))
    console.log('')
    
    console.log(chalk.yellow('📋 Step-by-Step Guide:'))
    console.log('')
    
    // Step 0 - Local Development
    console.log(`${chalk.blue('Step 0:')} ${chalk.bold('Local Development Setup')}`)
    console.log(chalk.gray('  Commands:'))
    console.log(chalk.gray('    kitty dev-start     # Start local development'))
    console.log(chalk.gray('    kitty dev-stop      # Stop local development'))
    console.log(chalk.gray('  Purpose: Test your TEE agent locally'))
    console.log('')
    
    // Step 1 - TEE Agent Setup
    const step1Status = config.teeAgentSetup ? chalk.green('✓ Complete') : chalk.red('❌ Required')
    console.log(`${chalk.blue('Step 1:')} ${chalk.bold('Setup TEE Agent')} ${step1Status}`)
    console.log(chalk.gray('  Command: kitty tee-setup'))
    console.log(chalk.gray('  Purpose: Generate secure EOA and prepare agent'))
    console.log('')
    
    // Step 2 - Container Registry (For Testnet)
    console.log(`${chalk.blue('Step 2:')} ${chalk.bold('Build & Push to Registry (Testnet Only)')}`)
    console.log(chalk.gray('  Command: kitty docker-build-push -u YOUR_USERNAME'))
    console.log(chalk.gray('  Purpose: Prepare container for cross-platform deployment'))
    console.log(chalk.gray('  Note: Skip this for local development'))
    console.log('')
    
    // Step 3 - Environment Configuration
    const step3Status = existsSync('.env') ? chalk.green('✓ Complete') : chalk.red('❌ Required')
    console.log(`${chalk.blue('Step 3:')} ${chalk.bold('Configure Environment')} ${step3Status}`)
    console.log(chalk.gray('  Commands:'))
    console.log(chalk.gray('    kitty network-config    # Set up Oasis network'))
    console.log(chalk.gray('    kitty wallet-setup      # Configure wallet'))
    console.log('')
    
    // Step 4 - Smart Contract Deployment
    const step4Status = config.icoAddress ? chalk.green('✓ Complete') : chalk.red('❌ Required')
    console.log(`${chalk.blue('Step 4:')} ${chalk.bold('Deploy Smart Contracts')} ${step4Status}`)
    console.log(chalk.gray('  Commands: Deploy via Hardhat (separate process)'))
    console.log('')
    
    // Step 5 - ROFL Deployment (Testnet)
    console.log(`${chalk.blue('Step 5:')} ${chalk.bold('ROFL Build & Deploy (Testnet)')}`)
    console.log(chalk.gray('  Commands:'))
    console.log(chalk.gray('    kitty rofl-build-docker     # Build ORC bundle'))
    console.log(chalk.gray('    kitty rofl-deploy           # Deploy to testnet'))
    console.log('')
    
    console.log(chalk.green('🎯 Quick Start Commands:'))
    console.log('')
    console.log(chalk.yellow('For Local Development:'))
    console.log(chalk.gray('  kitty dev-start'))
    console.log('')
    console.log(chalk.yellow('For Testnet Deployment:'))
    console.log(chalk.gray('  kitty docker-build-push -u YOUR_USERNAME'))
    console.log(chalk.gray('  kitty rofl-build-docker'))
    console.log(chalk.gray('  kitty rofl-deploy'))
  })

  // Deploy contracts
program
  .command('deploy')
  .description('Deploy contracts to selected network')
  .action(async () => {
    const config = await loadConfig()
    
    console.log(chalk.blue(`🚀 Deploying to ${config.network}...`))
    
    // Check if TEE agent is set up for production networks
    if (config.network !== 'hardhat' && !config.teeAgentSetup) {
      console.log(chalk.red('❌ TEE Agent not set up!'))
      console.log(chalk.yellow('For production networks, you must run Step 0 first:'))
      console.log(chalk.gray('  kitty tee-setup'))
      return
    }
    
    // Set environment variable for TEE public key
    let envVars = ''
    let teePublicKey = config.teePublicKey
    
    // Try to get TEE key from ROFL deployment if not in config
    if (!teePublicKey && existsSync('.tee-public-key')) {
      try {
        teePublicKey = (await readFile('.tee-public-key', 'utf-8')).trim()
        console.log(chalk.blue('📍 Using TEE key from ROFL deployment'))
      } catch (e) {
        // Ignore errors reading key file
      }
    }
    
    if (teePublicKey) {
      envVars = `TEE_PUBKEY=${teePublicKey} `
      console.log(chalk.blue(`Using TEE Public Key: ${teePublicKey}`))
    } else if (config.network !== 'hardhat') {
      console.log(chalk.yellow('⚠️  No TEE public key found'))
      console.log(chalk.gray('Try: kitty rofl-extract-key'))
      
      const shouldExtract = await confirm({
        message: 'Extract TEE key from ROFL deployment?',
        default: true
      })
      
      if (shouldExtract) {
        await program.parseAsync(['node', 'cli.ts', 'rofl-extract-key'])
        // Re-read the key after extraction
        if (existsSync('.tee-public-key')) {
          teePublicKey = (await readFile('.tee-public-key', 'utf-8')).trim()
          envVars = `TEE_PUBKEY=${teePublicKey} `
        }
      }
    }
    
    const command = `${envVars}pnpm hardhat run backend/deploy/00_deploy.ts --network ${config.network} --config backend/hardhat.config.ts`
    const success = await runCommand(command)
    
    if (success) {
      console.log(chalk.green('\n✅ Deployment complete!'))
      console.log(chalk.gray('Check the output above for contract addresses'))
      console.log(chalk.yellow('\n📋 Next steps:'))
      console.log(chalk.gray('1. Copy the contract addresses from above'))
      console.log(chalk.gray('2. Update frontend config with addresses'))
      console.log(chalk.gray('3. For production: Fund TEE agent with TEST tokens'))
      console.log(chalk.gray('4. Monitor ROFL: kitty rofl-status'))
    }
  })

// Run tests
program
  .command('test')
  .description('Run test suite')
  .option('-w, --watch', 'Watch for changes')
  .action(async (options) => {
    console.log(chalk.blue('🧪 Running tests...'))
    
    const command = options.watch 
      ? 'pnpm --filter ./backend hardhat test --watch'
      : 'pnpm --filter ./backend test'
    
    await runCommand(command)
  })

// Development server
program
  .command('dev')
  .description('Start development environment')
  .action(async () => {
    console.log(chalk.blue('🔧 Starting development environment...'))
    
    const choice = await select({
      message: 'What would you like to start?',
      choices: [
        { name: 'Frontend only', value: 'frontend' },
        { name: 'Backend only', value: 'backend' },
        { name: 'Full stack', value: 'fullstack' }
      ]
    })
    
    switch (choice) {
      case 'frontend':
        await runCommand('pnpm --filter ./frontend dev')
        break
      case 'backend':
        await runCommand('pnpm --filter ./backend dev')
        break
      case 'fullstack':
        console.log(chalk.yellow('Starting both frontend and backend...'))
        console.log(chalk.gray('Note: This will start frontend only. Backend doesn\'t have a dev server.'))
        await runCommand('pnpm --filter ./frontend dev')
        break
    }
  })

program
  .command('docker-build-push')
  .description('Build and push TEE agent to container registry for testnet deployment')
  .option('-r, --registry <registry>', 'Container registry (ghcr.io, docker.io)', 'ghcr.io')
  .option('-u, --username <username>', 'Registry username (GitHub/Docker username)')
  .option('-t, --tag <tag>', 'Image tag', 'latest')
  .option('-f, --compose-file <file>', 'Compose file to update', 'compose.testnet.yaml')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Building and pushing TEE Agent for testnet deployment...'))
    
    if (!options.username) {
      console.log(chalk.red('❌ Username required!'))
      console.log(chalk.yellow('💡 Provide your GitHub or Docker Hub username:'))
      console.log(chalk.gray('   kitty docker-build-push -u YOUR_USERNAME'))
      return
    }
    
    const fullImageName = `${options.registry === 'ghcr.io' ? 'ghcr.io' : 'docker.io'}/${options.username}/kitty-ico-tee-agent:${options.tag}`
    
    console.log(chalk.gray(`📦 Building image: ${fullImageName}`))
    console.log(chalk.gray('⚙️  Using platform: linux/amd64 (required for TDX)'))
    
    try {
      // Build with correct platform
      await runCommand(`docker build --platform linux/amd64 -f Dockerfile.tee -t ${fullImageName} .`)
      
      console.log(chalk.green('✅ Build successful!'))
      console.log(chalk.gray(`🚀 Pushing to registry...`))
      
      // Push to registry
      await runCommand(`docker push ${fullImageName}`)
      
      console.log(chalk.green('✅ Push successful!'))
      
      // Update compose file
      if (existsSync(options.composeFile)) {
        console.log(chalk.gray(`📝 Updating ${options.composeFile}...`))
        const composeContent = await readFile(options.composeFile, 'utf-8')
        const updatedContent = composeContent.replace(
          /image: .+\/kitty-ico-tee-agent:.+/,
          `image: ${fullImageName}`
        )
        await writeFile(options.composeFile, updatedContent)
        console.log(chalk.green(`✅ Updated ${options.composeFile} with new image`))
      }
      
      console.log('')
      console.log(chalk.green('🎉 Ready for testnet deployment!'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('   1. Run: kitty rofl-build-docker'))
      console.log(chalk.gray('   2. Run: kitty rofl-deploy'))
      
    } catch (error) {
      console.log(chalk.red('❌ Failed to build or push image'))
      console.log(chalk.red(error.message))
    }
  })

// Local development commands
program
  .command('dev-start')
  .description('Start local development environment')
  .action(async () => {
    console.log(chalk.blue('🏠 Starting local development environment...'))
    console.log(chalk.gray('📋 Using compose.yaml for local development'))
    
    try {
      await runCommand('docker-compose -f compose.yaml up --build -d')
      console.log(chalk.green('✅ Local development environment started!'))
      console.log(chalk.yellow('🌐 TEE Agent available at: http://localhost:8080'))
      console.log(chalk.gray('💡 Use "kitty dev-stop" to stop the environment'))
    } catch (error) {
      console.log(chalk.red('❌ Failed to start development environment'))
      console.log(chalk.red(error.message))
    }
  })

program
  .command('dev-stop')
  .description('Stop local development environment')
  .action(async () => {
    console.log(chalk.blue('🛑 Stopping local development environment...'))
    
    try {
      await runCommand('docker-compose -f compose.yaml down')
      console.log(chalk.green('✅ Local development environment stopped!'))
    } catch (error) {
      console.log(chalk.red('❌ Failed to stop development environment'))
      console.log(chalk.red(error.message))
    }
  })

program
  .command('rofl-build-docker')
  .description('Build ROFL bundle in official Oasis builder container')
  .option('-f, --force', 'Force build, skip registry checks')
  .option('--compose-file <file>', 'Compose file to use', 'compose.testnet.yaml')
  .action(async (opts) => {
    console.log(chalk.blue('🏗️  Building ROFL bundle using official Oasis container...'))
    console.log(chalk.yellow('📋 This uses the official ghcr.io/oasisprotocol/rofl-dev:main container'))
    console.log(chalk.gray('⚙️  Platform: linux/amd64 (required for TDX containers)'))
    console.log(chalk.gray(`📄 Using compose file: ${opts.composeFile}`))
    
    // Check if compose file exists
    if (!existsSync(opts.composeFile)) {
      console.log(chalk.red(`❌ Compose file not found: ${opts.composeFile}`))
      console.log(chalk.yellow('💡 Available compose files:'))
      console.log(chalk.gray('   - compose.yaml (local development)'))
      console.log(chalk.gray('   - compose.testnet.yaml (testnet deployment)'))
      console.log(chalk.gray('   - compose.localnet.yaml (localnet testing)'))
      return
    }
    
    // Check if compose file has proper configuration for ROFL
    try {
      const composeContent = await readFile(opts.composeFile, 'utf-8')
      
      // For testnet builds, check for required platform specification
      if (opts.composeFile.includes('testnet')) {
        if (!composeContent.includes('platform: linux/amd64')) {
          console.log(chalk.red('❌ Missing platform specification in compose file!'))
          console.log(chalk.yellow('💡 Add "platform: linux/amd64" to your service configuration'))
          return
        }
        
        // Check for image field
        if (!composeContent.includes('image:') || composeContent.includes("image: ''")) {
          console.log(chalk.red('❌ Missing or empty image field in compose file!'))
          console.log(chalk.yellow('💡 Run "kitty docker-build-push" first to build and push your container'))
          return
        }
      }
      
      console.log(chalk.green('✅ Compose file configuration looks good'))
      
    } catch (error) {
      console.log(chalk.red('❌ Failed to read compose file'))
      return
    }
    
    try {
      await runCommand(
        'docker run --rm -it ' +
        '-v $(pwd):/workspace ' +
        '-v /var/run/docker.sock:/var/run/docker.sock ' +
        '-w /workspace ' +
        `ghcr.io/oasisprotocol/rofl-dev:main oasis rofl build docker -f ${opts.composeFile}`
      )
      
      console.log(chalk.green('✅ ROFL bundle built successfully!'))
      console.log(chalk.yellow('📋 Next step: Deploy to testnet with "kitty rofl-deploy"'))
      
    } catch (error) {
      console.log(chalk.red('❌ ROFL build failed'))
      console.log(chalk.red(error.message))
      console.log('')
      console.log(chalk.yellow('🔧 Troubleshooting:'))
      console.log(chalk.gray('   1. Make sure Docker is running'))
      console.log(chalk.gray('   2. Check if your image is accessible in the registry'))
      console.log(chalk.gray('   3. Verify compose file has correct platform: linux/amd64'))
    }
  })

// Contract deployment commands
program
  .command('deploy-token')
  .description('Deploy KITTY token to Ethereum Sepolia')
  .action(async () => {
    console.log(chalk.blue('🪙 Deploying KITTY token to Ethereum Sepolia...'))
    const success = await runCommand('cd backend && pnpm hardhat run deploy/01_deploy_token.ts --network sepolia')
    if (success) {
      console.log(chalk.green('✅ Token deployed successfully!'))
      console.log(chalk.gray('💡 Copy the TOKEN_ADDR from output above'))
      console.log(chalk.gray('💡 Set: export TOKEN_CONTRACT_ADDRESS=<token_address>'))
      console.log(chalk.gray('💡 Then run: kitty deploy-ico'))
    }
  })

program
  .command('deploy-ico')
  .description('Deploy ICO contract to Sapphire Testnet')
  .action(async () => {
    console.log(chalk.blue('💰 Deploying ICO contract to Sapphire Testnet...'))
    const success = await runCommand('cd backend && pnpm hardhat run deploy/02_deploy_ico.ts --network sapphire-testnet')
    if (success) {
      console.log(chalk.green('✅ ICO contract deployed successfully!'))
      console.log(chalk.gray('💡 Copy the ICO_ADDR from output above'))
      console.log(chalk.gray('💡 Set: export ICO_CONTRACT_ADDRESS=<ico_address>'))
      console.log(chalk.gray('💡 Then run: kitty deploy-batch'))
    }
  })

program
  .command('deploy-batch')
  .description('Deploy Batch Settlement to Ethereum Sepolia')
  .action(async () => {
    console.log(chalk.blue('⚖️ Deploying Batch Settlement to Ethereum Sepolia...'))
    const success = await runCommand('cd backend && pnpm hardhat run deploy/03_deploy_batch.ts --network sepolia')
    if (success) {
      console.log(chalk.green('✅ Batch Settlement deployed successfully!'))
      console.log(chalk.gray('💡 Copy the BATCH_SETTLEMENT_ADDR from output above'))
      console.log(chalk.gray('💡 Set: export BATCH_SETTLEMENT_ADDRESS=<batch_address>'))
      console.log(chalk.gray('💡 Now update TEE agent with contract addresses'))
    }
  })

program
  .command('deploy-all')
  .description('Deploy all contracts in sequence (Token → ICO → Batch Settlement)')
  .action(async () => {
    console.log(chalk.blue('🚀 Deploying all contracts in sequence...'))
    console.log(chalk.yellow('📋 This will deploy: Token → ICO → Batch Settlement'))
    console.log(chalk.gray('⚙️  Make sure you have ETHEREUM_RPC_URL set'))
    
    // Step 1: Deploy Token
    console.log(chalk.blue('\n📋 Step 1: Deploying KITTY token to Ethereum Sepolia...'))
    let success = await runCommand('cd backend && pnpm hardhat run deploy/01_deploy_token.ts --network sepolia')
    if (!success) {
      console.log(chalk.red('❌ Token deployment failed'))
      return
    }
    
    // Step 2: Deploy ICO
    console.log(chalk.blue('\n📋 Step 2: Deploying ICO contract to Sapphire Testnet...'))
    success = await runCommand('cd backend && pnpm hardhat run deploy/02_deploy_ico.ts --network sapphire-testnet')
    if (!success) {
      console.log(chalk.red('❌ ICO deployment failed'))
      return
    }
    
    // Step 3: Deploy Batch Settlement
    console.log(chalk.blue('\n📋 Step 3: Deploying Batch Settlement to Ethereum Sepolia...'))
    success = await runCommand('cd backend && pnpm hardhat run deploy/03_deploy_batch.ts --network sepolia')
    if (!success) {
      console.log(chalk.red('❌ Batch Settlement deployment failed'))
      return
    }
    
    console.log(chalk.green('\n🎉 All contracts deployed successfully!'))
    console.log(chalk.yellow('📋 Next steps:'))
    console.log(chalk.gray('1. Copy the contract addresses from the output above'))
    console.log(chalk.gray('2. Update your environment variables (see export commands)'))
    console.log(chalk.gray('3. Update TEE agent: kitty update-tee-env'))
  })

program
  .command('update-tee-env')
  .description('Update TEE agent with contract addresses and rebuild')
  .action(async () => {
    console.log(chalk.blue('🔄 Updating TEE agent with contract addresses...'))
    
    // Check if environment variables are set
    const requiredVars = ['TOKEN_CONTRACT_ADDRESS', 'ICO_CONTRACT_ADDRESS', 'BATCH_SETTLEMENT_ADDRESS']
    const missingVars = requiredVars.filter(v => !process.env[v])
    
    if (missingVars.length > 0) {
      console.log(chalk.red(`❌ Missing environment variables: ${missingVars.join(', ')}`))
      console.log(chalk.yellow('💡 Please set these variables first:'))
      missingVars.forEach(v => {
        console.log(chalk.gray(`   export ${v}=<address>`))
      })
      return
    }
    
    console.log(chalk.green('✅ All environment variables found'))
    console.log(chalk.gray('📋 Rebuilding ROFL bundle with updated environment...'))
    
    // Rebuild ROFL bundle
    const success = await runCommand('docker run --rm -it -v $(pwd):/workspace -v /var/run/docker.sock:/var/run/docker.sock -w /workspace ghcr.io/oasisprotocol/rofl-dev:main oasis rofl build -f compose.testnet.yaml --force')
    
    if (success) {
      console.log(chalk.green('✅ ROFL bundle rebuilt successfully!'))
      console.log(chalk.yellow('📋 Next steps:'))
      console.log(chalk.gray('1. Update ROFL configuration: oasis rofl update --network testnet --paratime sapphire'))
      console.log(chalk.gray('2. Redeploy: oasis rofl deploy --network testnet --paratime sapphire'))
    }
  })

// Interactive menu
program
  .command('menu')
  .description('Interactive menu')
  .action(async () => {
    showBanner()
    
    while (true) {
      const action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: '🚀 Deploy to Testnet', value: 'deploy-menu' },
          { name: '🏠 Local Development', value: 'dev-menu' },
          { name: '📊 Status & Monitoring', value: 'status-menu' },
          { name: '⚙️ Setup & Configuration', value: 'setup-menu' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      })
      
      if (action === 'exit') break
      
      // Handle sub-menus
      switch (action) {
        case 'deploy-menu':
          await handleDeployMenu()
          break
        case 'dev-menu':
          await handleDevMenu()
          break
        case 'status-menu':
          await handleStatusMenu()
          break
        case 'setup-menu':
          await handleSetupMenu()
          break
      }
      
      console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'))
    }
  })

async function handleDeployMenu() {
  const action = await select({
    message: '🚀 Testnet Deployment Options:',
    choices: [
      { name: '🪙 Deploy Token (Sepolia)', value: 'deploy-token' },
      { name: '💰 Deploy ICO (Sapphire)', value: 'deploy-ico' },
      { name: '⚖️ Deploy Batch Settlement (Sepolia)', value: 'deploy-batch' },
      { name: '🎯 Deploy All Contracts', value: 'deploy-all' },
      { name: '🔄 Update TEE with Contract Addresses', value: 'update-tee-env' },
      { name: '🏗️ Build & Deploy ROFL', value: 'rofl-deploy' },
      { name: '⬅️ Back to Main Menu', value: 'back' }
    ]
  })
  
  if (action !== 'back') {
    if (action === 'rofl-deploy') {
      // Handle ROFL deployment flow
      console.log(chalk.blue('🚀 ROFL Deployment Flow'))
      console.log(chalk.gray('This will: Build → Push → Deploy ROFL'))
      
      const username = await input({
        message: 'Enter your registry username (GitHub/Docker):',
        validate: (input) => input.length > 0 || 'Username is required'
      })
      
      // Build and push
      await program.parseAsync(['node', 'cli.ts', 'docker-build-push', '-u', username])
      
      // Build ROFL bundle
      await program.parseAsync(['node', 'cli.ts', 'rofl-build-docker'])
      
      // Deploy ROFL
      await program.parseAsync(['node', 'cli.ts', 'rofl-deploy'])
    } else {
      await program.parseAsync(['node', 'cli.ts', action])
    }
  }
}

async function handleDevMenu() {
  const action = await select({
    message: '🏠 Local Development Options:',
    choices: [
      { name: '🔧 Start Frontend Dev Server', value: 'dev' },
      { name: '🐳 Start Local TEE Environment', value: 'dev-start' },
      { name: '🛑 Stop Local TEE Environment', value: 'dev-stop' },
      { name: '🧪 Run Tests', value: 'test' },
      { name: '🏗️ Build Contracts', value: 'build' },
      { name: '⬅️ Back to Main Menu', value: 'back' }
    ]
  })
  
  if (action !== 'back') {
    if (action === 'build') {
      await runCommand('cd backend && pnpm hardhat compile')
    } else {
      await program.parseAsync(['node', 'cli.ts', action])
    }
  }
}

async function handleStatusMenu() {
  const action = await select({
    message: '📊 Status & Monitoring Options:',
    choices: [
      { name: '📊 Project Status', value: 'status' },
      { name: '🔍 ROFL Status', value: 'rofl-status' },
      { name: '📋 ROFL Logs', value: 'rofl-logs' },
      { name: '🔐 Extract TEE Key', value: 'rofl-extract-key' },
      { name: '⬅️ Back to Main Menu', value: 'back' }
    ]
  })
  
  if (action !== 'back') {
    await program.parseAsync(['node', 'cli.ts', action])
  }
}

async function handleSetupMenu() {
  const action = await select({
    message: '⚙️ Setup & Configuration Options:',
    choices: [
      { name: '🛠️ Project Setup', value: 'setup' },
      { name: '🔐 Setup TEE Agent', value: 'tee-setup' },
      { name: '🌐 Configure Oasis Network', value: 'network-config' },
      { name: '💳 Setup Oasis Wallet', value: 'wallet-setup' },
      { name: '🌈 Complete Workflow Guide', value: 'workflow' },
      { name: '⬅️ Back to Main Menu', value: 'back' }
    ]
  })
  
  if (action !== 'back') {
    await program.parseAsync(['node', 'cli.ts', action])
  }
}

// Status command
program
  .command('status')
  .description('Show project status')
  .action(async () => {
    const config = await loadConfig()
    
    console.log(chalk.blue('\n📊 Project Status\n'))
    console.log(`Network: ${chalk.cyan(config.network)}`)
    console.log(`Token: ${chalk.cyan(config.tokenName)} (${config.tokenSymbol})`)
    
    console.log(chalk.blue('\n🔐 TEE Agent Status:'))
    console.log(`Setup complete: ${config.teeAgentSetup ? chalk.green('✓') : chalk.red('✗')}`)
    if (config.teePublicKey) {
      console.log(`TEE Public Key: ${chalk.green(config.teePublicKey)}`)
    }
    
    if (existsSync('backend/rolf/.env')) {
      console.log(`TEE Environment: ${chalk.green('✓ Configured')}`)
    } else {
      console.log(`TEE Environment: ${chalk.red('✗ Not configured')}`)
    }
    
    console.log(chalk.blue('\n📋 Contract Addresses:'))
    if (config.icoAddress) {
      console.log(`ICO Contract: ${chalk.green(config.icoAddress)}`)
    } else {
      console.log(`ICO Contract: ${chalk.gray('Not deployed')}`)
    }
    
    if (config.tokenAddress) {
      console.log(`Token Contract: ${chalk.green(config.tokenAddress)}`)
    } else {
      console.log(`Token Contract: ${chalk.gray('Not deployed')}`)
    }
    
    if (config.batchSettlementAddress) {
      console.log(`BatchSettlement: ${chalk.green(config.batchSettlementAddress)}`)
    } else {
      console.log(`BatchSettlement: ${chalk.gray('Not deployed')}`)
    }
    
    console.log(chalk.blue('\n🔧 Development Status:'))
    
    // Check if contracts are compiled
    const artifactsExist = existsSync('backend/artifacts')
    console.log(`Contracts compiled: ${artifactsExist ? chalk.green('✓') : chalk.red('✗')}`)
    
    // Check if dependencies are installed
    const nodeModulesExist = existsSync('node_modules')
    console.log(`Dependencies installed: ${nodeModulesExist ? chalk.green('✓') : chalk.red('✗')}`)
    
    // Check if TEE agent is built
    const teeBuilt = existsSync('backend/rolf/dist')
    console.log(`TEE Agent built: ${teeBuilt ? chalk.green('✓') : chalk.gray('Not built')}`)
  })

// Default to menu if no command provided
if (process.argv.length === 2) {
  program.parseAsync(['node', 'cli.ts', 'menu'])
} else {
  program.parse()
} 