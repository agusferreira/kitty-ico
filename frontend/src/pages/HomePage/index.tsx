import { FC, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { SaleCard } from '../../components/SaleCard'
import { BidForm } from '../../components/BidForm'
import classes from './index.module.css'
import { useAccount } from 'wagmi'
import { useICO } from '../../hooks/useICO'
import { BidFormData } from '../../types/ico'
import { StringUtils } from '../../utils/string.utils'

export const HomePage: FC = () => {
  const { address } = useAccount()
  const { sales, isLoading, error, isSubmittingBid, submitBid, getSale, fetchSales, clearError } = useICO()
  
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)
  const [bidSuccess, setBidSuccess] = useState<string | null>(null)

  const handleBidClick = (saleId: number) => {
    setSelectedSaleId(saleId)
    setBidSuccess(null)
    clearError()
  }

  const handleBidCancel = () => {
    setSelectedSaleId(null)
    setBidSuccess(null)
    clearError()
  }

  const handleBidSubmit = async (bidData: BidFormData) => {
    if (!selectedSaleId) return

    try {
      await submitBid(selectedSaleId, bidData)
      setBidSuccess(`Bid submitted successfully for Sale #${selectedSaleId}!`)
      setSelectedSaleId(null)
    } catch (error) {
      console.error('Bid submission failed:', error)
      // Error is handled by the useICO hook
    }
  }

  const selectedSale = selectedSaleId ? getSale(selectedSaleId) : null

  return (
    <div className={classes.homePage}>
      {!address && (
        <Card header={<h2>AI-Scored Pitch-Bid ICO</h2>}>
          <div className={classes.connectWalletText}>
            <p>Connect your wallet to participate in confidential ICO sales.</p>
            <p>Your bids will be encrypted and scored by AI based on price, pitch quality, and geographic diversity.</p>
          </div>
        </Card>
      )}

      {address && !selectedSale && (
        <>
          <Card header={<h2>Available ICO Sales</h2>}>
            <div className={classes.salesDescription}>
              <p>Participate in confidential ICO sales with AI-powered scoring.</p>
              <p>Your bids are encrypted and evaluated based on multiple criteria including price competitiveness, pitch quality, and geographic diversity.</p>
            </div>
            
            {error && (
              <div className={classes.errorMessage}>
                <p className="error">{StringUtils.truncate(error)}</p>
                <Button color="secondary" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            )}
            
            {bidSuccess && (
              <div className={classes.successMessage}>
                <p className={classes.success}>{bidSuccess}</p>
                <Button color="secondary" onClick={() => setBidSuccess(null)}>
                  Dismiss
                </Button>
              </div>
            )}
            
            <div className={classes.salesControls}>
              <Button color="secondary" onClick={fetchSales} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh Sales'}
              </Button>
            </div>
          </Card>

          <div className={classes.salesGrid}>
            {isLoading && sales.length === 0 && (
              <Card>
                <div className={classes.loadingText}>
                  <p>Loading ICO sales...</p>
                </div>
              </Card>
            )}
            
            {!isLoading && sales.length === 0 && (
              <Card>
                <div className={classes.noSalesText}>
                  <p>No ICO sales available at the moment.</p>
                  <p>Check back later for new opportunities.</p>
                </div>
              </Card>
            )}
            
            {sales.map(sale => (
              <SaleCard
                key={sale.id}
                sale={sale}
                onBidClick={handleBidClick}
                showBidButton={!sale.finalized}
              />
            ))}
          </div>
        </>
      )}

      {address && selectedSale && (
        <BidForm
          sale={selectedSale}
          onSubmit={handleBidSubmit}
          onCancel={handleBidCancel}
          isSubmitting={isSubmittingBid}
        />
      )}
    </div>
  )
}
