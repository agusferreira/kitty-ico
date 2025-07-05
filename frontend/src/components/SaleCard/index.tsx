import { FC } from 'react'
import { Card } from '../Card'
import { Button } from '../Button'
import { Sale } from '../../types/ico'
import { formatEther } from 'viem'
import classes from './index.module.css'

interface SaleCardProps {
  sale: Sale
  onBidClick: (saleId: number) => void
  showBidButton?: boolean
}

export const SaleCard: FC<SaleCardProps> = ({ sale, onBidClick, showBidButton = true }) => {
  const { id, issuer, supply, deadline, finalized } = sale
  
  // Calculate time remaining
  const timeRemaining = deadline * 1000 - Date.now()
  const isExpired = timeRemaining <= 0
  
  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return 'Expired'
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <Card header={<h3>Sale #{id}</h3>}>
      <div className={classes.saleInfo}>
        <div className={classes.infoRow}>
          <span className={classes.label}>Issuer:</span>
          <span className={classes.value}>{issuer.slice(0, 6)}...{issuer.slice(-4)}</span>
        </div>
        <div className={classes.infoRow}>
          <span className={classes.label}>Supply:</span>
          <span className={classes.value}>{formatEther(supply)} NEW</span>
        </div>
        <div className={classes.infoRow}>
          <span className={classes.label}>Status:</span>
          <span className={`${classes.value} ${finalized ? classes.finalized : classes.active}`}>
            {finalized ? 'Finalized' : isExpired ? 'Expired' : 'Active'}
          </span>
        </div>
        <div className={classes.infoRow}>
          <span className={classes.label}>Time Remaining:</span>
          <span className={`${classes.value} ${isExpired ? classes.expired : ''}`}>
            {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
      </div>
      
      {showBidButton && !finalized && !isExpired && (
        <div className={classes.actions}>
          <Button onClick={() => onBidClick(id)}>
            Submit Bid
          </Button>
        </div>
      )}
    </Card>
  )
} 