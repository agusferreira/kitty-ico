import { FC, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { KittyBidPanel } from '../../components/KittyBidPanel'
import classes from './index.module.css'
import { useAccount } from 'wagmi'
import { useICO } from '../../hooks/useICO'
import { BidFormData, BidPayload } from '../../types/ico'
import { StringUtils } from '../../utils/string.utils'

export const HomePage: FC = () => {
  const { address } = useAccount()
  const { error, isSubmittingBid, submitBid, clearError } = useICO()
  const [bidSuccess, setBidSuccess] = useState<string | null>(null)

  const handlePanelSubmit = async (bid: BidPayload) => {
    // We are assuming a single sale, so we can hardcode the saleId to 1
    const saleId = 1;
    const bidData: BidFormData = {
      ...bid,
      price: String(bid.price),
      amount: String(bid.amount),
    };

    try {
      await submitBid(saleId, bidData)
      setBidSuccess(`Bid submitted successfully for Sale #${saleId}!`)
    } catch (error) {
      console.error('Bid submission failed:', error)
      // Error is handled by the useICO hook
    }
  }



  return (
    <div className={classes.homePage}>
      {!address && (
        <Card header={<h2>Kitty Sale</h2>}>
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

      {address && (
        <>
          {bidSuccess && (
            <Card>
              <div className={classes.successMessage}>
                <p>{bidSuccess}</p>
                <Button color="secondary" onClick={() => setBidSuccess(null)}>
                  Dismiss
                </Button>
              </div>
            </Card>
          )}
          {error && (
            <Card>
              <div className={classes.errorMessage}>
                <p className="error">{StringUtils.truncate(error)}</p>
                <Button color="secondary" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            </Card>
          )}
          <KittyBidPanel onSubmit={handlePanelSubmit} isLoading={isSubmittingBid ?? false} />
        </>
      )}


    </div>
  )
}
