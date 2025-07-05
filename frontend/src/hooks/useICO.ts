import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { WAGMI_CONTRACT_CONFIG } from '../constants/config'
import { Sale, BidFormData, BidData } from '../types/ico'
import { encryptBidData, generatePermitSignature, getTeePublicKey } from '../utils/encryption.utils'
import { parseEther } from 'viem'

/**
 * Custom hook for ICO contract interactions
 */
export function useICO() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read contract hooks
  const { data: nextSaleId, refetch: refetchNextSaleId } = useReadContract({
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
      // Convert form data to bid data
      const bidDataForEncryption: BidData = {
        price: parseFloat(bidData.price),
        quantity: parseFloat(bidData.amount),
        pitch: bidData.pitch,
        country: bidData.country
      }
      
      // Get TEE public key
      const teePublicKey = await getTeePublicKey()
      
      // Encrypt the bid data
      const encryptedBlob = await encryptBidData(bidDataForEncryption, teePublicKey)
      
      // Calculate max spend (price * quantity)
      const maxSpend = parseEther((bidDataForEncryption.price * bidDataForEncryption.quantity).toString())
      
      // Generate permit signature (placeholder)
      const permitSignature = await generatePermitSignature(maxSpend, BigInt(0), BigInt(Math.floor(Date.now() / 1000) + 3600))
      
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