# Pitch-Bid ICO - Comprehensive API Documentation

## Overview

This document provides comprehensive documentation for all public APIs, functions, and components in the Pitch-Bid ICO project. The project consists of three main components:

1. **Smart Contracts** (Solidity) - Backend contracts for ICO functionality
2. **Frontend Application** (Next.js 14, React, TypeScript) - User interface 
3. **CLI Interface** (Node.js) - Command-line management tools

## Table of Contents

- [Smart Contracts](#smart-contracts)
- [Frontend Components](#frontend-components)
- [React Hooks](#react-hooks)
- [Context Providers](#context-providers)
- [Utility Functions](#utility-functions)
- [CLI Interface](#cli-interface)
- [Configuration](#configuration)

---

## Smart Contracts

### ICO_Contract

**Location**: `backend/contracts/ICO_Contract.sol`

The main contract for managing confidential ICO sales with encrypted bidding.

#### Constructor

```solidity
constructor(address teePubKey_, address newToken_)
```

**Parameters:**
- `teePubKey_`: Public address derived from the enclave private key
- `newToken_`: Address of the ERC20 token being sold

#### Public Functions

##### createSale

```solidity
function createSale(
    uint256 supply,
    uint256 deadline,
    bytes calldata policyHash
) external returns (uint256 saleId)
```

Creates a new ICO sale and locks tokens.

**Parameters:**
- `supply`: Amount of tokens to sell
- `deadline`: Unix timestamp when bidding ends
- `policyHash`: Hash of the scoring policy JSON

**Returns:** Sale ID for the created sale

**Events:** Emits `SaleCreated(uint256 indexed id, address indexed issuer, uint256 supply)`

**Example:**
```solidity
// Approve tokens first
newToken.approve(icoContract, 1000000 * 10**18);

// Create sale
uint256 saleId = icoContract.createSale(
    1000000 * 10**18,  // 1M tokens
    block.timestamp + 86400,  // 24 hours from now
    keccak256("scoring-policy-json")
);
```

##### submitBid

```solidity
function submitBid(
    uint256 saleId,
    bytes calldata encBlob,
    uint256 maxSpend,
    bytes calldata permitSig
) external
```

Submits an encrypted bid for a sale.

**Parameters:**
- `saleId`: ID of the sale to bid on
- `encBlob`: HPKE encrypted bid data
- `maxSpend`: Maximum amount willing to spend
- `permitSig`: EIP-2612 permit signature

**Events:** Emits `BidSubmitted(uint256 indexed id, address indexed bidder)`

**Example:**
```solidity
// Submit encrypted bid
icoContract.submitBid(
    saleId,
    encryptedBidBlob,
    1000 * 10**18,  // Max spend 1000 tokens
    permitSignature
);
```

##### finalize

```solidity
function finalize(
    uint256 saleId,
    bytes calldata result,
    bytes calldata teeSig
) external
```

Finalizes the sale using TEE-verified results.

**Parameters:**
- `saleId`: ID of the sale to finalize
- `result`: ABI-encoded (uint256 clearingPrice, address[] winners)
- `teeSig`: TEE signature over the result

**Events:** Emits `SaleFinalized(uint256 indexed id, uint256 price)`

**Example:**
```solidity
// Finalize sale with TEE results
icoContract.finalize(
    saleId,
    abi.encode(clearingPrice, winners),
    teeSignature
);
```

#### View Functions

##### bidOf

```solidity
function bidOf(uint256 saleId, address bidder) external view returns (Bid memory)
```

Returns the bid information for a specific bidder.

**Parameters:**
- `saleId`: ID of the sale
- `bidder`: Address of the bidder

**Returns:** Bid struct containing encrypted blob, max spend, permit signature, and claim status

#### Public Variables

- `sales`: Mapping of sale ID to Sale struct
- `nextSaleId`: Counter for generating sale IDs  
- `newToken`: Address of the token being sold
- `teePubKey`: TEE public key for signature verification

### MockERC20

**Location**: `backend/contracts/MockERC20.sol`

Simple ERC20 token for testing and demo purposes.

#### Constructor

```solidity
constructor(string memory name_, string memory symbol_, uint256 initialSupply_)
```

**Parameters:**
- `name_`: Token name
- `symbol_`: Token symbol
- `initialSupply_`: Initial supply minted to deployer

**Example:**
```solidity
MockERC20 token = new MockERC20("Test Token", "TEST", 1000000 * 10**18);
```

---

## Frontend Components

### Button

**Location**: `frontend/src/components/Button/index.tsx`

Reusable button component with multiple variants and sizes.

#### Props

```typescript
interface Props extends PropsWithChildren {
  disabled?: boolean
  color?: 'primary' | 'secondary' | 'success'
  size?: 'small' | 'medium'
  variant?: 'solid' | 'outline' | 'text'
  fullWidth?: boolean
  onClick?: (e?: MouseEvent) => void
  className?: string
  type?: 'submit' | 'reset' | 'button'
  startSlot?: ReactElement
}
```

#### Example Usage

```tsx
import { Button } from './components/Button'

// Basic button
<Button onClick={() => console.log('clicked')}>
  Click me
</Button>

// Button with custom styling
<Button 
  color="success" 
  size="small" 
  variant="outline"
  fullWidth
>
  Submit
</Button>

// Button with icon
<Button startSlot={<Icon />}>
  With Icon
</Button>
```

### Card

**Location**: `frontend/src/components/Card/index.tsx`

Container component with optional header.

#### Props

```typescript
interface Props extends PropsWithChildren {
  header?: ReactNode
  className?: string
}
```

#### Example Usage

```tsx
import { Card } from './components/Card'

// Basic card
<Card>
  <p>Card content</p>
</Card>

// Card with header
<Card header={<h2>Title</h2>}>
  <p>Card content</p>
</Card>
```

### Input

**Location**: `frontend/src/components/Input/index.tsx`

Input component with label and error handling.

#### Props

```typescript
interface Props {
  value: string
  label?: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  type?: 'text' | 'password' | 'email'
}
```

#### Example Usage

```tsx
import { Input } from './components/Input'

const [value, setValue] = useState('')
const [error, setError] = useState('')

<Input
  value={value}
  onChange={setValue}
  label="Enter message"
  error={error}
  placeholder="Type something..."
/>
```

### RevealInput

**Location**: `frontend/src/components/Input/RevealInput.tsx`

Special input component that can toggle between hidden and revealed states.

#### Props

```typescript
interface Props {
  value: string
  label?: string
  disabled?: boolean
  reveal: boolean
  revealLabel?: string
  onRevealChange: () => Promise<void>
}
```

#### Example Usage

```tsx
import { RevealInput } from './components/Input/RevealInput'

<RevealInput
  value={secretMessage}
  label="Secret Message"
  reveal={isRevealed}
  revealLabel="Click to reveal"
  onRevealChange={handleReveal}
  disabled={!canReveal}
/>
```

### Layout

**Location**: `frontend/src/components/Layout/index.tsx`

Main application layout with navigation and routing.

#### Example Usage

```tsx
import { Layout } from './components/Layout'

// Used automatically by router
<Layout>
  <HomePage />
</Layout>
```

### HomePage

**Location**: `frontend/src/pages/HomePage/index.tsx`

Main application page with message functionality.

#### Features

- Wallet connection status
- Message reveal functionality
- Message setting capability
- Transaction status handling

#### Example Usage

```tsx
import { HomePage } from './pages/HomePage'

// Rendered by router at root path
<HomePage />
```

---

## React Hooks

### useAppState

**Location**: `frontend/src/hooks/useAppState.ts`

Hook for accessing global application state.

#### Returns

```typescript
interface AppStateProviderContext {
  state: {
    appError: string
    isMobileScreen: boolean
    isDesktopScreen: boolean
  }
  setAppError: (error: Error | object | string) => void
  clearAppError: () => void
}
```

#### Example Usage

```tsx
import { useAppState } from './hooks/useAppState'

function MyComponent() {
  const { state, setAppError, clearAppError } = useAppState()
  
  const handleError = (error: Error) => {
    setAppError(error)
  }
  
  return (
    <div>
      {state.appError && <div className="error">{state.appError}</div>}
      {state.isMobileScreen && <div>Mobile Layout</div>}
    </div>
  )
}
```

### useWeb3Auth

**Location**: `frontend/src/hooks/useWeb3Auth.ts`

Hook for Web3 authentication using SIWE (Sign-In with Ethereum).

#### Returns

```typescript
interface Web3AuthProviderContext {
  state: {
    authInfo: string | null
    signature: { r: string; s: string; v: number } | null
    siweMessage: string | null
  }
  fetchAuthInfo: () => Promise<void>
}
```

#### Example Usage

```tsx
import { useWeb3Auth } from './hooks/useWeb3Auth'

function AuthComponent() {
  const { state, fetchAuthInfo } = useWeb3Auth()
  
  const handleAuth = async () => {
    try {
      await fetchAuthInfo()
      console.log('Authenticated:', state.authInfo)
    } catch (error) {
      console.error('Auth failed:', error)
    }
  }
  
  return (
    <button onClick={handleAuth}>
      {state.authInfo ? 'Authenticated' : 'Sign In'}
    </button>
  )
}
```

---

## Context Providers

### AppStateProvider

**Location**: `frontend/src/providers/AppStateProvider.tsx`

Provides global application state management.

#### Features

- Error handling
- Screen size detection
- App state persistence

#### Example Usage

```tsx
import { AppStateContextProvider } from './providers/AppStateProvider'

function App() {
  return (
    <AppStateContextProvider>
      <YourApp />
    </AppStateContextProvider>
  )
}
```

### Web3AuthProvider

**Location**: `frontend/src/providers/Web3AuthProvider.tsx`

Provides Web3 authentication context using SIWE.

#### Features

- SIWE message generation
- Signature handling
- Authentication state management

#### Example Usage

```tsx
import { Web3AuthContextProvider } from './providers/Web3AuthProvider'

function App() {
  return (
    <Web3AuthContextProvider>
      <YourApp />
    </Web3AuthContextProvider>
  )
}
```

---

## Utility Functions

### StringUtils

**Location**: `frontend/src/utils/string.utils.ts`

Utility functions for string manipulation.

#### Methods

##### clsx

```typescript
static clsx(...classNames: (string | undefined)[]): string
```

Combines CSS class names, filtering out undefined values.

**Example:**
```typescript
import { StringUtils } from './utils/string.utils'

const className = StringUtils.clsx(
  'base-class',
  isActive ? 'active' : undefined,
  'another-class'
)
// Result: "base-class active another-class"
```

##### truncate

```typescript
static truncate(s: string, sliceIndex = 200): string
```

Truncates a string to specified length.

**Example:**
```typescript
const truncated = StringUtils.truncate("Very long string...", 50)
```

### NumberUtils

**Location**: `frontend/src/utils/number.utils.ts`

Utility functions for number operations.

#### Methods

##### jsNumberForAddress

```typescript
static jsNumberForAddress(address: string): number
```

Converts an Ethereum address to a JavaScript number for avatar generation.

**Example:**
```typescript
import { NumberUtils } from './utils/number.utils'

const avatarSeed = NumberUtils.jsNumberForAddress("0x742d35Cc6634C0532925a3b8D8C1C4f13d8f12BF")
```

---

## CLI Interface

**Location**: `cli.ts`

Interactive command-line interface for managing the ICO project.

### Commands

#### setup

Interactive project setup with network selection and configuration.

```bash
# Run interactive setup
./cli.ts setup

# Or use the menu
./cli.ts menu
```

**Features:**
- Network selection (local, testnet, mainnet)
- Token configuration
- Dependency installation

#### deploy

Deploy smart contracts to selected network.

```bash
# Deploy to configured network
./cli.ts deploy
```

**Features:**
- Automated contract deployment
- Address output for frontend integration
- Network-specific configuration

#### test

Run the test suite.

```bash
# Run tests once
./cli.ts test

# Run tests in watch mode
./cli.ts test --watch
```

#### dev

Start development environment.

```bash
# Start development server
./cli.ts dev
```

**Options:**
- Frontend only
- Backend only  
- Full stack

#### status

Show current project status.

```bash
# Show project status
./cli.ts status
```

**Information displayed:**
- Current network
- Token configuration
- Contract addresses
- Compilation status
- Dependency status

#### menu

Interactive menu for all commands.

```bash
# Start interactive menu
./cli.ts menu
```

### Configuration

The CLI uses a configuration file `.kitty-ico.json` to store:

```json
{
  "network": "local",
  "tokenName": "Kitty ICO",
  "tokenSymbol": "KITTY",
  "icoAddress": "0x...",
  "tokenAddress": "0x...",
  "teePublicKey": "0x..."
}
```

---

## Configuration

### Environment Variables

#### Frontend

- `VITE_NETWORK`: Network ID (0x5afd=local, 0x5aff=testnet, 0x5afe=mainnet)
- `DEV`: Development mode flag

#### Backend

- `TEE_PUBKEY`: TEE public key for deployment
- `NETWORK`: Target network name

### Network Configuration

#### Supported Networks

- **Local**: Hardhat local network
- **Sapphire Testnet**: Oasis Sapphire testnet
- **Sapphire Mainnet**: Oasis Sapphire mainnet

#### Contract Configuration

**Location**: `frontend/src/constants/config.ts`

```typescript
export const WAGMI_CONTRACT_CONFIG = {
  address: '0x...',
  abi: contractABI,
}
```

---

## Usage Examples

### Complete ICO Flow

1. **Setup Project**
   ```bash
   ./cli.ts setup
   ```

2. **Deploy Contracts**
   ```bash
   ./cli.ts deploy
   ```

3. **Create Sale (Smart Contract)**
   ```solidity
   uint256 saleId = icoContract.createSale(
     1000000 * 10**18,  // 1M tokens
     block.timestamp + 86400,  // 24 hours
     keccak256("policy")
   );
   ```

4. **Submit Bid (Smart Contract)**
   ```solidity
   icoContract.submitBid(
     saleId,
     encryptedBid,
     maxSpend,
     permitSignature
   );
   ```

5. **Finalize Sale (Smart Contract)**
   ```solidity
   icoContract.finalize(
     saleId,
     teeResult,
     teeSignature
   );
   ```

### Frontend Integration

```tsx
import { useAccount, useWriteContract } from 'wagmi'
import { Button } from './components/Button'
import { Card } from './components/Card'
import { useAppState } from './hooks/useAppState'

function ICOInterface() {
  const { address } = useAccount()
  const { writeContract } = useWriteContract()
  const { setAppError } = useAppState()
  
  const handleCreateSale = async () => {
    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: ICO_ABI,
        functionName: 'createSale',
        args: [supply, deadline, policyHash]
      })
    } catch (error) {
      setAppError(error)
    }
  }
  
  return (
    <Card header={<h2>ICO Management</h2>}>
      <Button onClick={handleCreateSale}>
        Create Sale
      </Button>
    </Card>
  )
}
```

---

## Development Guidelines

### Smart Contract Development

1. Use Solidity `0.8.24`
2. Follow the required event pattern: `SaleCreated`, `BidSubmitted`, `SaleFinalized`
3. Enforce HPKE encryption for bids
4. Verify ROFL enclave signatures before settlement

### Frontend Development

1. Use Next.js 14 with TypeScript
2. Implement components in `frontend/src/components/`
3. Use wagmi v1 for Web3 integration
4. Follow the established CSS module pattern

### Testing

1. Use Foundry for smart contract tests
2. Use Playwright for frontend E2E tests
3. Mock Sapphire private storage limitations

---

## Security Considerations

1. **Smart Contracts**
   - Always verify TEE signatures
   - Use proper access controls
   - Handle edge cases (overflow, reentrancy)

2. **Frontend**
   - Validate user inputs
   - Handle wallet connection errors
   - Implement proper error boundaries

3. **TEE Integration**
   - Ensure proper HPKE encryption
   - Validate enclave signatures
   - Handle decryption errors gracefully

---

## Support and Troubleshooting

### Common Issues

1. **Contract deployment fails**
   - Check network configuration
   - Verify sufficient gas
   - Ensure proper dependencies

2. **Frontend connection issues**
   - Verify network ID matches
   - Check wallet configuration
   - Confirm contract addresses

3. **TEE signature verification fails**
   - Validate TEE public key
   - Check signature format
   - Verify message hash

### Getting Help

- Check the project README
- Review the definitions in `definitions/`
- Use the CLI status command for diagnostics
- Consult the development logs

---

*This documentation covers all public APIs, functions, and components in the Pitch-Bid ICO project. For additional implementation details, refer to the source code and inline comments.*