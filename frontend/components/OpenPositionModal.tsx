'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { formatCurrency, formatCSPR } from '@/lib/utils'
import { useWallet } from '@/lib/hooks/useWallet'

interface OpenPositionModalProps {
  isOpen: boolean
  onClose: () => void
  market: {
    name: string
    symbol: string
    price: number
  }
  side: 'long' | 'short'
}

export function OpenPositionModal({ isOpen, onClose, market, side }: OpenPositionModalProps) {
  const { isConnected, connect } = useWallet()
  const [collateral, setCollateral] = useState('100')
  const [leverage, setLeverage] = useState(5)

  if (!isOpen) return null

  const collateralNum = parseFloat(collateral) || 0
  const effectiveSize = collateralNum * leverage
  const entryPrice = market.price

  // Calculate liquidation price
  const liquidationPrice =
    side === 'long'
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage)

  const handleOpenPosition = async () => {
    if (!isConnected) {
      await connect()
      return
    }

    // TODO: Call smart contract to open position
    console.log('Opening position:', {
      market: market.name,
      side,
      collateral: collateralNum,
      leverage,
      entryPrice,
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {side === 'long' ? (
              <div className="w-10 h-10 rounded-lg gradient-success flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg gradient-danger flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">
                {side === 'long' ? 'LONG' : 'SHORT'} {market.name}
              </h2>
              <p className="text-sm text-muted-foreground">{market.symbol}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Collateral Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Collateral (CSPR)</label>
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="100"
              min="10"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              Min: 10 CSPR • Available: 306 CSPR
            </div>
          </div>

          {/* Leverage Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Leverage</label>
              <span className="text-lg font-bold text-primary">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Position Summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-semibold">{formatCurrency(entryPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Effective Size</span>
              <span className="font-semibold">{formatCSPR(effectiveSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Liquidation Price</span>
              <span className="font-semibold text-destructive">
                {formatCurrency(liquidationPrice)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Trading Fee</span>
              <span className="font-semibold">{formatCSPR(collateralNum * 0.002)}</span>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-warning mb-1">Risk Warning</p>
                <p>
                  {leverage}x leverage means a {(100 / leverage).toFixed(1)}% price move against
                  your position will result in liquidation. Trade responsibly.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleOpenPosition}
              className={`flex-1 text-white ${
                side === 'long' ? 'gradient-success' : 'gradient-danger'
              }`}
            >
              {isConnected ? `Open ${side.toUpperCase()} Position` : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
