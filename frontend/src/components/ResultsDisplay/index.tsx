import { FC } from 'react'
import { Card } from '../Card'
import { Sale, SaleResult } from '../../types/ico'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import classes from './index.module.css'

interface ResultsDisplayProps {
  sale: Sale
  result: SaleResult
  userAddress?: string
}

export const ResultsDisplay: FC<ResultsDisplayProps> = ({ sale, result, userAddress }) => {
  const { address } = useAccount()
  const currentUserAddress = userAddress || address
  const isWinner = currentUserAddress && result.winners.includes(currentUserAddress)
  
  return (
    <Card header={<h3>Sale #{sale.id} Results</h3>}>
      <div className={classes.resultsContainer}>
        <div className={classes.saleInfo}>
          <h4>Sale Information</h4>
          <div className={classes.infoRow}>
            <span>Total Supply:</span>
            <span>{formatEther(sale.supply)} NEW</span>
          </div>
          <div className={classes.infoRow}>
            <span>Clearing Price:</span>
            <span>{formatEther(result.clearingPrice)} per token</span>
          </div>
          <div className={classes.infoRow}>
            <span>Total Winners:</span>
            <span>{result.winners.length}</span>
          </div>
        </div>

        {isWinner && (
          <div className={classes.winnerNotice}>
            <h4>🎉 Congratulations!</h4>
            <p>You won this ICO sale! Your tokens have been distributed to your wallet.</p>
            <div className={classes.winnerDetails}>
              <div className={classes.infoRow}>
                <span>Your Allocation:</span>
                <span>{formatEther(sale.supply / BigInt(result.winners.length))} NEW</span>
              </div>
              <div className={classes.infoRow}>
                <span>Price Paid:</span>
                <span>{formatEther(result.clearingPrice)} per token</span>
              </div>
            </div>
          </div>
        )}

        {!isWinner && currentUserAddress && (
          <div className={classes.notWinnerNotice}>
            <h4>Better luck next time!</h4>
            <p>You didn't win this ICO sale, but your funds remain in your wallet.</p>
            <p>Keep an eye out for future opportunities!</p>
          </div>
        )}

        <div className={classes.winnersSection}>
          <h4>Winners List</h4>
          <div className={classes.winnersList}>
            {result.winners.map((winner, index) => (
              <div key={winner} className={classes.winnerItem}>
                <span className={classes.winnerRank}>#{index + 1}</span>
                <span className={classes.winnerAddress}>
                  {winner === currentUserAddress ? 'You' : `${winner.slice(0, 6)}...${winner.slice(-4)}`}
                </span>
                <span className={classes.winnerAllocation}>
                  {formatEther(sale.supply / BigInt(result.winners.length))} NEW
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
} 