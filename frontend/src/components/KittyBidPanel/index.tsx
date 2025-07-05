import { FC, useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '../Button'
import { Card } from '../Card'
import { BidPayload } from '../../types/ico'
import classes from './index.module.css'

interface KittyBidPanelProps {
  onSubmit: (bid: BidPayload) => Promise<void>
  isLoading: boolean
}

export const KittyBidPanel: FC<KittyBidPanelProps> = ({ onSubmit, isLoading }) => {
  const { isConnected } = useAccount()
  const [country, setCountry] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [amount, setAmount] = useState<number | ''>('')
  const [pitch, setPitch] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!country || !price || !amount || !pitch) {
      // Basic validation
      alert('Please fill out all fields.')
      return
    }
    await onSubmit({ country, price, amount, pitch })
    // Reset form on success
    setCountry('')
    setPrice('')
    setAmount('')
    setPitch('')
  }

  if (!isConnected) {
    return (
      <Card header={<h2>Submit Your Bid</h2>}>
        <div className={classes.connectPrompt}>
          <p>Please connect your wallet to pitch Kitty.</p>
        </div>
      </Card>
    )
  }

  const totalCost = typeof price === 'number' && typeof amount === 'number' ? (price * amount).toFixed(4) : '0.00'

  return (
    <Card header={<h2>Sealed Bid Terminal</h2>}>
      <form className={classes.kittyBidPanel} onSubmit={handleSubmit}>
        {/* Token Metadata */}
        <div className={classes.formSection}>
          <label className={classes.label}>Token</label>
          <div className={classes.tokenMeta}>
            <span>$KITTY</span>
            <span>1,000,000 Supply</span>
          </div>
        </div>

        {/* Country Input */}
        <div className={classes.formGroup}>
          <label htmlFor="country" className={classes.label}>Where are you bidding from?</label>
          <input
            id="country"
            type="text"
            className={classes.input}
            placeholder="e.g., France"
            value={country}
            onChange={e => setCountry(e.target.value)}
            required
          />
        </div>

        {/* Bid Details */}
        <div className={classes.formGroupRow}>
          <div className={classes.formGroup}>
            <label htmlFor="price" className={classes.label}>Price per token (USDC)</label>
            <input
              id="price"
              type="number"
              className={classes.input}
              placeholder="0.10"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              min="0.01"
              step="0.01"
              required
            />
          </div>
          <div className={classes.formGroup}>
            <label htmlFor="amount" className={classes.label}>Amount to buy</label>
            <input
              id="amount"
              type="number"
              className={classes.input}
              placeholder="1000"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min="1"
              required
            />
          </div>
        </div>
        <div className={classes.totalCost}>Total: {totalCost} USDC</div>

        {/* Pitch Box */}
        <div className={classes.formGroup}>
          <label htmlFor="pitch" className={classes.label}>Your pitch to Kitty</label>
          <textarea
            id="pitch"
            className={classes.textarea}
            placeholder="Convince Kitty you deserve this allocation..."
            rows={5}
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            required
          />
        </div>

        {/* Submit Button */}
        <Button type="submit" disabled={isLoading} fullWidth>
          {isLoading ? 'Sending...' : 'Send Sealed Bid to Kitty 🐱'}
        </Button>
      </form>
    </Card>
  )
}
