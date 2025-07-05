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
}

export interface SaleResult {
  clearingPrice: bigint
  winners: string[]
} 