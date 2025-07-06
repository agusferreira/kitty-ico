import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { WAGMI_CONTRACT_CONFIG } from '../constants/config'
import { Sale, BidFormData, BidPayload } from '../types/ico'
import { encryptBidData, generatePermitSignature } from '../utils/encryption.utils'
import { parseEther } from 'viem'

/**
 * Custom hook for ICO contract interactions
 */
export function useICO() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Get connected wallet address
  const { address } = useAccount()

  // Read contract hooks
  const { data: nextSaleId } = useReadContract({
    ...WAGMI_CONTRACT_CONFIG,
    functionName: 'nextSaleId',
  })

  // Write contract hooks
  const {
    data: submitBidTxHash,
    writeContract: writeSubmitBid,
    isPending: isSubmitBidPending,
    isError: isSubmitBidError,
    error: submitBidError,
  } = useWriteContract()

  const {
    isPending: isSubmitBidReceiptPending,
    isSuccess: isSubmitBidReceiptSuccess,
    isError: isSubmitBidReceiptError,
    error: submitBidReceiptError,
  } = useWaitForTransactionReceipt({
    hash: submitBidTxHash,
  })

  const isSubmittingBid = isSubmitBidPending || (submitBidTxHash && isSubmitBidReceiptPending)

  /**
   * Fetches all sales from the contract
   */
  const fetchSales = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const salePromises: Promise<Sale>[] = []
      const totalSales = Number(nextSaleId || 0)
      
      // Fetch each sale individually
      for (let i = 1; i <= totalSales; i++) {
        const salePromise = new Promise<Sale>((resolve) => {
          // This would be replaced with actual contract reads
          // For now, create mock data
          const mockSale: Sale = {
            id: i,
            issuer: `0x${Math.random().toString(16).slice(2, 42)}`,
            supply: parseEther('1000'),
            deadline: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours from now
            policyHash: '0x1234567890abcdef',
            finalized: false
          }
          resolve(mockSale)
        })
        salePromises.push(salePromise)
      }
      
      const fetchedSales = await Promise.all(salePromises)
      setSales(fetchedSales)
    } catch (err) {
      setError('Failed to fetch sales')
      console.error('Error fetching sales:', err)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Submits an encrypted bid to the contract
   */
  const submitBid = async (saleId: number, bidData: BidFormData): Promise<void> => {
    setError(null)
    
    try {
      // Create the full bid payload with all required fields
      const bidPayload: BidPayload = {
        saleId: saleId,
        walletAddress: bidData.walletAddress || '', // Add fallback in case walletAddress is not provided
        price: parseFloat(bidData.price),
        amount: parseFloat(bidData.amount),
        pitch: bidData.pitch,
        country: bidData.country
      }
      
      // Encrypt the bid data using our HPKE encryption utility
      const encryptedBlob = await encryptBidData(bidPayload)
      
      // Calculate max spend (price * quantity)
      const maxSpend = parseEther((bidPayload.price * bidPayload.amount).toString())
      
      // Get current timestamp + 1 hour for deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      
      // For a production app, we would fetch the nonce from the token contract
      // For now, we'll use 0 as a placeholder
      const nonce = BigInt(0)
      
      if (!address) {
        throw new Error('No wallet connected')
      }
      
      // Generate real EIP-2612 permit signature
      const permitSignature = await generatePermitSignature(
        maxSpend,
        nonce,
        deadline,
        address
      )
      
      // Submit to contract
      await writeSubmitBid({
        ...WAGMI_CONTRACT_CONFIG,
        functionName: 'submitBid',
        args: [
          BigInt(saleId),
          encryptedBlob,
          maxSpend,
          permitSignature
        ]
      })
    } catch (err) {
      setError('Failed to submit bid')
      throw err
    }
  }

  /**
   * Fetches a specific sale by ID
   */
  const getSale = (saleId: number): Sale | undefined => {
    return sales.find(sale => sale.id === saleId)
  }

  // Fetch sales on component mount
  useEffect(() => {
    fetchSales()
  }, [nextSaleId])

  // Handle bid submission success
  useEffect(() => {
    if (isSubmitBidReceiptSuccess) {
      // Refresh sales to get updated data
      fetchSales()
    }
  }, [isSubmitBidReceiptSuccess])

  // Handle bid submission error
  useEffect(() => {
    if (isSubmitBidError || isSubmitBidReceiptError) {
      setError(submitBidError?.message || submitBidReceiptError?.message || 'Bid submission failed')
    }
  }, [isSubmitBidError, isSubmitBidReceiptError, submitBidError, submitBidReceiptError])

  return {
    sales,
    isLoading,
    error,
    isSubmittingBid,
    submitBid,
    getSale,
    fetchSales,
    clearError: () => setError(null)
  }
} 