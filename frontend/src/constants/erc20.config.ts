// ERC-20 Token Configuration for EIP-2612 Permit
import { WAGMI_CONTRACT_CONFIG } from './config'

// Environment variables
const { VITE_TOKEN_CONTRACT_ADDRESS } = import.meta.env

// Default chain ID for the network we're using (e.g., Sepolia = 11155111, Oasis Sapphire = 23294)
// This should be configured based on your deployment environment
export const DEFAULT_CHAIN_ID = 11155111n // Sepolia testnet by default

// Token contract address - from environment variable or fallback to a default
export const TOKEN_CONTRACT_ADDRESS = 
  (VITE_TOKEN_CONTRACT_ADDRESS as string) || '0x1234567890123456789012345678901234567890'

// Token metadata for EIP-712 domain
export const TOKEN_METADATA = {
  name: 'USD Coin', // Should match the actual token name
  version: '1',     // Should match the token version
  symbol: 'USDC'    // Token symbol
}

// ICO contract address (spender for the permit)
export const ICO_CONTRACT_ADDRESS = WAGMI_CONTRACT_CONFIG.address
