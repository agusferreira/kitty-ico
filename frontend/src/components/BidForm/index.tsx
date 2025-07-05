import { FC, useState } from 'react'
import { Card } from '../Card'
import { Input } from '../Input'
import { Button } from '../Button'
import { Sale, BidFormData } from '../../types/ico'
import { formatEther } from 'viem'
import classes from './index.module.css'

interface BidFormProps {
  sale: Sale
  onSubmit: (bidData: BidFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export const BidForm: FC<BidFormProps> = ({ sale, onSubmit, onCancel, isSubmitting = false }) => {
  const [formData, setFormData] = useState<BidFormData>({
    amount: '',
    price: '',
    pitch: '',
    country: ''
  })
  
  const [errors, setErrors] = useState<Partial<BidFormData>>({})

  const handleInputChange = (field: keyof BidFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<BidFormData> = {}
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }
    
    if (!formData.pitch.trim()) {
      newErrors.pitch = 'Pitch is required'
    } else if (formData.pitch.length < 10) {
      newErrors.pitch = 'Pitch must be at least 10 characters'
    }
    
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Bid submission failed:', error)
    }
  }

  const timeRemaining = sale.deadline * 1000 - Date.now()
  const isExpired = timeRemaining <= 0

  return (
    <Card header={<h3>Submit Bid - Sale #{sale.id}</h3>}>
      <div className={classes.saleInfo}>
        <div className={classes.infoRow}>
          <span>Available Supply:</span>
          <span>{formatEther(sale.supply)} NEW</span>
        </div>
        <div className={classes.infoRow}>
          <span>Deadline:</span>
          <span>{new Date(sale.deadline * 1000).toLocaleString()}</span>
        </div>
      </div>

      {isExpired ? (
        <div className={classes.expiredNotice}>
          <p>This sale has expired and no longer accepts bids.</p>
        </div>
      ) : (
        <div className={classes.form}>
          <div className={classes.formGroup}>
            <label className={classes.label}>Amount (NEW tokens to buy)</label>
            <Input
              label="e.g., 1000"
              value={formData.amount}
              onChange={(value) => handleInputChange('amount', value)}
              error={errors.amount}
              disabled={isSubmitting}
            />
          </div>

          <div className={classes.formGroup}>
            <label className={classes.label}>Price per token (in payment currency)</label>
            <Input
              label="e.g., 0.01"
              value={formData.price}
              onChange={(value) => handleInputChange('price', value)}
              error={errors.price}
              disabled={isSubmitting}
            />
          </div>

          <div className={classes.formGroup}>
            <label className={classes.label}>Pitch (Why should you win?)</label>
            <textarea
              className={classes.textarea}
              placeholder="Describe your project, use case, or why you deserve these tokens..."
              value={formData.pitch}
              onChange={(e) => handleInputChange('pitch', e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
            {errors.pitch && <span className={classes.error}>{errors.pitch}</span>}
          </div>

          <div className={classes.formGroup}>
            <label className={classes.label}>Country</label>
            <Input
              label="e.g., United States"
              value={formData.country}
              onChange={(value) => handleInputChange('country', value)}
              error={errors.country}
              disabled={isSubmitting}
            />
          </div>

          <div className={classes.notice}>
            <p>
              <strong>Note:</strong> Your bid will be encrypted and scored by AI. 
              The scoring considers price competitiveness, geographic diversity, and pitch quality.
            </p>
          </div>
        </div>
      )}

      <div className={classes.actions}>
        <Button color="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        {!isExpired && (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Encrypted Bid'}
          </Button>
        )}
      </div>
    </Card>
  )
} 