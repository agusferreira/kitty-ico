#!/usr/bin/env bun
import { Command } from 'commander'
import { spawn } from 'child_process'
import { select, input, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import figlet from 'figlet'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

const program = new Command()

// ASCII Art Banner
const showBanner = () => {
  // Custom rainbow function
  const rainbow = (text: string) => {
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta]
    return text.split('').map((char, i) => colors[i % colors.length](char)).join('')
  }

  const catArt = `
${chalk.cyan('    /\\_/\\  ')}
${chalk.cyan('   ( ')}${chalk.red('◉')}${chalk.yellow('◉')}${chalk.cyan(' ) ')}  ${chalk.red('🌈')}${chalk.yellow('🌈')}${chalk.green('🌈')}${chalk.blue('🌈')}${chalk.magenta('🌈')}
${chalk.cyan('    > ^ <   ')}  ${chalk.red('🌈')}${chalk.yellow('🌈')}${chalk.green('🌈')}${chalk.blue('🌈')}${chalk.magenta('🌈')}
${chalk.cyan('   /     \\  ')}
${chalk.cyan('  (  ')}${chalk.white('___')}${chalk.cyan('  ) ')}
${chalk.cyan('   \\     /  ')}
${chalk.cyan('    |   |   ')}
${chalk.cyan('    |___|   ')}

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
  'local': 'hardhat',
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
  teePublicKey?: string
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

const runCommand = async (command: string, cwd = process.cwd()) => {
  const s = createSpinner(`Running: ${command}`)
  s.start()
  
  try {
    const [cmd, ...args] = command.split(' ')
    const proc = spawn(cmd, args, { cwd, stdio: 'inherit' })
    
    const result = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code || 0))
    })
    
    s.stop()
    if (result === 0) {
      console.log(chalk.green('✓ Command completed successfully'))
      return true
    } else {
      console.log(chalk.red('✗ Command failed'))
      return false
    }
  } catch (error) {
    s.stop()
    console.log(chalk.red(`✗ Error: ${error}`))
    return false
  }
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

// Deploy contracts
program
  .command('deploy')
  .description('Deploy contracts to selected network')
  .action(async () => {
    const config = await loadConfig()
    
    console.log(chalk.blue(`🚀 Deploying to ${config.network}...`))
    
    // Update deploy script with current config
    const deployScript = `
import hre from 'hardhat'

async function main() {
  const { ethers } = hre as any
  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // 1. Deploy the ERC-20 token used for the sale.
  const initialSupply = ethers.parseEther('1000000')
  const Token = await ethers.getContractFactory('MockERC20')
  const newToken = await Token.deploy('${config.tokenName}', '${config.tokenSymbol}', initialSupply)
  await newToken.waitForDeployment()
  console.log('Token deployed at', await newToken.getAddress())

  // 2. Determine the TEE public key – for local deploy we reuse deployer.
  const teePubKey = process.env.TEE_PUBKEY ?? deployer.address

  // 3. Deploy the ICO_Contract, linking TEE key and token address.
  const ICO = await ethers.deployContract('ICO_Contract', [teePubKey, await newToken.getAddress()])
  await ICO.waitForDeployment()
  console.log('ICO_Contract deployed at', await ICO.getAddress())

  // 4. Export addresses for front-end or subsequent scripts.
  console.log('\\nexport ICO_ADDR=%s', await ICO.getAddress())
  console.log('export TOKEN_ADDR=%s', await newToken.getAddress())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
`
    
    await writeFile('backend/deploy/00_deploy.ts', deployScript)
    
    const command = `pnpm hardhat run backend/deploy/00_deploy.ts --network ${config.network} --config backend/hardhat.config.ts`
    const success = await runCommand(command)
    
    if (success) {
      console.log(chalk.green('\n✅ Deployment complete!'))
      console.log(chalk.gray('Check the output above for contract addresses'))
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
          { name: '🚀 Deploy contracts', value: 'deploy' },
          { name: '🧪 Run tests', value: 'test' },
          { name: '🔧 Start development', value: 'dev' },
          { name: '⚙️  Setup/Configure', value: 'setup' },
          { name: '📊 Show status', value: 'status' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      })
      
      if (action === 'exit') break
      
      // Execute the selected action
      await program.parseAsync(['node', 'cli.ts', action])
      
      console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'))
    }
  })

// Status command
program
  .command('status')
  .description('Show project status')
  .action(async () => {
    const config = await loadConfig()
    
    console.log(chalk.blue('\n📊 Project Status\n'))
    console.log(`Network: ${chalk.cyan(config.network)}`)
    console.log(`Token: ${chalk.cyan(config.tokenName)} (${config.tokenSymbol})`)
    
    if (config.icoAddress) {
      console.log(`ICO Contract: ${chalk.green(config.icoAddress)}`)
    }
    
    if (config.tokenAddress) {
      console.log(`Token Contract: ${chalk.green(config.tokenAddress)}`)
    }
    
    // Check if contracts are compiled
    const artifactsExist = existsSync('backend/artifacts')
    console.log(`Contracts compiled: ${artifactsExist ? chalk.green('✓') : chalk.red('✗')}`)
    
    // Check if dependencies are installed
    const nodeModulesExist = existsSync('node_modules')
    console.log(`Dependencies installed: ${nodeModulesExist ? chalk.green('✓') : chalk.red('✗')}`)
  })

// Default to menu if no command provided
if (process.argv.length === 2) {
  program.parseAsync(['node', 'cli.ts', 'menu'])
} else {
  program.parse()
} 