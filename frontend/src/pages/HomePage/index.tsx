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
        <Card header={<h2>Kitty ICO</h2>}>
          <div className={classes.connectWalletText}>
            <p>Pitch Kitty why you should get the token.</p>
            <p>If Kitty approves, nobody will ask.</p>

            <div className={classes.pitch}>
              <p><strong>How it works:</strong></p>
              <ul>
                <li>
                  You submit a <strong>sealed bid</strong> to Kitty’s brain — a cryptographically secure AI agent inside a TEE.
                </li>
                <li>
                  Kitty follows a preset logic. <em>No team control. No human hands.</em>
                </li>
                <li>
                  Bids are sorted. Tokens are sent. Done.
                </li>
              </ul>

              <p><strong>Why it matters:</strong></p>
              <ul>
                <li>Fair, private, trustless token sales.</li>
                <li>No whales. No interference. Just the algorithm.</li>
                <li>All logic enforced by a secure AI. Kitty doesn’t negotiate.</li>
              </ul>

              <p>
                <em>Prove your worth to Kitty. Make your pitch. The rest is sealed fate.</em>
              </p>
            </div>
          </div>
        </Card>
      )}

      {address && !selectedSale && (
        <>
          <Card header={<h2>Kitty Sale</h2>}>
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
