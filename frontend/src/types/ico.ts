// ICO-specific type definitions for the frontend
export interface Sale {
  id: number
  issuer: string
  supply: bigint
  deadline: number
  policyHash: string
  finalized: boolean
}

export interface BidData {
  price: number
  quantity: number
  pitch: string
  country: string
}

export interface EncryptedBid {
  encBlob: string
  maxSpend: bigint
  permitSig: string
}

export interface BidPayload {
  saleId: number;
  walletAddress: string;
  country: string;
  price: number;
  amount: number;
  pitch: string;
}

export interface BidFormData {
  amount: string
  price: string
  pitch: string
  country: string
  walletAddress?: string // Optional since it might be added programmatically
}

export interface SaleResult {
  clearingPrice: bigint
  winners: string[]
} 