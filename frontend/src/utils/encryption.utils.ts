import { BidPayload } from '../types/ico'
import { hexToBytes } from 'viem'
import { TOKEN_CONTRACT_ADDRESS, ICO_CONTRACT_ADDRESS, DEFAULT_CHAIN_ID, TOKEN_METADATA } from '../constants/erc20.config'

// X25519DeoxysII encryption utilities for confidential bid submission using Oasis Sapphire

/**
 * Encrypts data using X25519DeoxysII from Sapphire ParaTime
 * @param plaintext - The plaintext data to encrypt
 * @param publicKey - The recipient's public key
 * @returns Promise<Object> - The encrypted data with nonce and ciphertext
 */
async function encryptWithX25519DeoxysII(plaintext: Uint8Array, publicKey: Uint8Array): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
  try {
    // Usar require dinámico para evitar problemas de tipos
    // @ts-ignore - Ignoramos errores de TypeScript aquí para poder usar require dinámicamente
    const sapphireParatime = await eval("require('@oasisprotocol/sapphire-paratime')");
    
    if (!sapphireParatime.X25519DeoxysII) {
      throw new Error('X25519DeoxysII not found in @oasisprotocol/sapphire-paratime');
    }
    
    // Create a cipher using the recipient's public key
    const cipher = sapphireParatime.X25519DeoxysII.ephemeral(publicKey);
    
    // Encrypt the data
    const { nonce, ciphertext } = cipher.encrypt(plaintext);
    
    return { nonce, ciphertext };
  } catch (error) {
    console.error('X25519DeoxysII encryption failed:', error);
    throw new Error(`X25519DeoxysII encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encrypts bid data using X25519DeoxysII for confidential submission
 * @param bidPayload - The bid payload to encrypt
 * @returns Promise<string> - The encrypted blob as base64 string
 */
export async function encryptBidData(bidPayload: BidPayload): Promise<string> {
  try {
    // Convert the bid payload to a JSON string
    const plaintext = JSON.stringify(bidPayload);
    
    // Convert the plaintext to Uint8Array
    const plaintextBytes = new TextEncoder().encode(plaintext);
    
    // Get the TEE public key
    const teePublicKey = await getTeePublicKey();
    
    // Remove '0x' prefix if present and convert to proper format
    const publicKeyHex = teePublicKey.startsWith('0x') ? teePublicKey.substring(2) : teePublicKey;
    const publicKey = hexToBytes(`0x${publicKeyHex}` as `0x${string}`);
    
    // Encrypt the data using X25519DeoxysII
    const { nonce, ciphertext } = await encryptWithX25519DeoxysII(plaintextBytes, publicKey);
    
    // Combine nonce and ciphertext for transmission
    const encryptedData = new Uint8Array(nonce.length + ciphertext.length);
    encryptedData.set(nonce);
    encryptedData.set(ciphertext, nonce.length);
    
    // Convert the encrypted data to base64 for transmission
    const base64Encoded = Buffer.from(encryptedData).toString('base64');
    
    return base64Encoded;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(`Failed to encrypt bid data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a permit signature for EIP-2612 permit functionality
 * @param amount - The amount to approve
 * @param nonce - The nonce for the permit (can be obtained from the token contract)
 * @param deadline - The deadline for the permit (timestamp in seconds)
 * @param ownerAddress - The address of the token owner (bidder)
 * @returns Promise<string> - The permit signature
 */
export async function generatePermitSignature(
  amount: bigint,
  nonce: bigint,
  deadline: bigint,
  ownerAddress: string
): Promise<string> {
  try {
    // Import necessary functions from viem
    const { createWalletClient, custom } = await import('viem');
    
    // Get the wallet client
    const walletClient = createWalletClient({
      transport: custom(window.ethereum)
    });
    
    // Define the domain for EIP-712 typed data
    const domain = {
      name: TOKEN_METADATA.name,
      version: TOKEN_METADATA.version,
      chainId: Number(DEFAULT_CHAIN_ID),
      verifyingContract: TOKEN_CONTRACT_ADDRESS as `0x${string}`
    };
    
    // Define the types for EIP-712 typed data
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };
    
    // Define the values for EIP-712 typed data
    const values = {
      owner: ownerAddress,
      spender: ICO_CONTRACT_ADDRESS,
      value: amount,
      nonce: nonce,
      deadline: deadline
    };
    
    // No need to generate the hash separately, signTypedData does this internally
    
    // Sign the typed data hash using signTypedData
    const signature = await walletClient.signTypedData({
      account: ownerAddress as `0x${string}`,
      domain,
      types,
      primaryType: 'Permit',
      message: values
    });
    
    return signature;
  } catch (error) {
    console.error('Failed to generate permit signature:', error);
    throw new Error(`Failed to generate permit signature: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates that the encryption utilities are properly configured
 * @returns Promise<boolean> - Whether encryption is ready
 */
export async function isEncryptionReady(): Promise<boolean> {
  try {
    // Usar require dinámico para verificar si el módulo está disponible
    // @ts-ignore - Ignoramos errores de TypeScript aquí para poder usar require dinámicamente
    const sapphireParatime = eval("require('@oasisprotocol/sapphire-paratime')");
    return typeof sapphireParatime.X25519DeoxysII === 'function';
  } catch (error) {
    console.error('Encryption not ready:', error);
    return false;
  }
}

/**
 * Gets the TEE public key from the smart contract or configuration
 * @returns Promise<string> - The TEE public key
 */
export async function getTeePublicKey(): Promise<string> {
  // Using the TEE Agent Address provided in the requirements
  return "0x16d435EC891be39706e82DB88AedCA39167622dD";
} 