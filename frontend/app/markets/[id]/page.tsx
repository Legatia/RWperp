'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent, formatCSPR } from '@/lib/utils'
import { PriceChart } from '@/components/PriceChart'
import { OpenPositionModal } from '@/components/OpenPositionModal'

interface MarketData {
  id: string
  name: string
  symbol: string
  price: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  nextSettlement: Date
  longShortRatio: number
  fundingRate: number
}

// Mock market data
const getMarketData = (id: string): MarketData => {
  const markets: Record<string, MarketData> = {
    gold: {
      id: 'gold',
      name: 'Gold',
      symbol: 'XAU/USD',
      price: 2045.50,
      change24h: 0.75,
      high24h: 2052.30,
      low24h: 2038.10,
      volume24h: 1250000,
      openInterest: 5420000,
      nextSettlement: new Date('2024-11-18T00:00:00'),
      longShortRatio: 1.35,
      fundingRate: 0.02,
    },
    silver: {
      id: 'silver',
      name: 'Silver',
      symbol: 'XAG/USD',
      price: 24.12,
      change24h: 1.25,
      high24h: 24.45,
      low24h: 23.85,
      volume24h: 850000,
      openInterest: 2100000,
      nextSettlement: new Date('2024-11-18T00:00:00'),
      longShortRatio: 1.58,
      fundingRate: 0.03,
    },
    sp500: {
      id: 'sp500',
      name: 'S&P 500',
      symbol: 'SPX',
      price: 4783.45,
      change24h: -0.32,
      high24h: 4795.20,
      low24h: 4771.30,
      volume24h: 3500000,
      openInterest: 12500000,
      nextSettlement: new Date('2024-11-18T00:00:00'),
      longShortRatio: 0.89,
      fundingRate: -0.01,
    },
  }

  return markets[id] || markets.gold
}

export default function MarketDetailPage() {
  const params = useParams()
  const marketId = params.id as string
  const market = getMarketData(marketId)

  const [showPositionModal, setShowPositionModal] = useState(false)
  const [positionSide, setPositionSide] = useState<'long' | 'short'>('long')

  const timeUntilSettlement = () => {
    const now = new Date()
    const diff = market.nextSettlement.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const openPosition = (side: 'long' | 'short') => {
    setPositionSide(side)
    setShowPositionModal(true)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{market.name}</h1>
          <p className="text-muted-foreground">{market.symbol}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold">{formatCurrency(market.price)}</div>
          <div
            className={`flex items-center justify-end gap-1 text-lg font-medium ${
              market.change24h >= 0 ? 'text-success' : 'text-destructive'
            }`}
          >
            {market.change24h >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            {formatPercent(market.change24h)}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">24h High</div>
          <div className="text-xl font-bold">{formatCurrency(market.high24h)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">24h Low</div>
          <div className="text-xl font-bold">{formatCurrency(market.low24h)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">24h Volume</div>
          <div className="text-xl font-bold">{formatCurrency(market.volume24h, 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Open Interest</div>
          <div className="text-xl font-bold">{formatCurrency(market.openInterest, 0)}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Chart & Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Price Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart marketId={marketId} />
            </CardContent>
          </Card>

          {/* Market Info */}
          <Card>
            <CardHeader>
              <CardTitle>Market Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Long/Short Ratio</span>
                <span
                  className={`font-semibold ${
                    market.longShortRatio > 1 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {market.longShortRatio.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Next Settlement</span>
                <div className="text-right">
                  <div className="font-semibold">
                    {market.nextSettlement.toLocaleDateString()} 00:00 UTC
                  </div>
                  <div className="text-sm text-muted-foreground">
                    in {timeUntilSettlement()}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Max Leverage</span>
                <span className="font-semibold">10x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Trading Fees</span>
                <span className="font-semibold">0.1% - 0.2%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trading Panel */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-6">Open Position</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Button
                size="lg"
                onClick={() => openPosition('long')}
                className="gradient-success text-white py-8 text-lg font-semibold hover:scale-105 transition-transform"
              >
                <TrendingUp className="h-5 w-5 mr-2" />
                LONG
              </Button>
              <Button
                size="lg"
                onClick={() => openPosition('short')}
                className="gradient-danger text-white py-8 text-lg font-semibold hover:scale-105 transition-transform"
              >
                <TrendingDown className="h-5 w-5 mr-2" />
                SHORT
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Daily Settlement</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Positions settle automatically at 00:00 UTC with oracle prices
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Up to 10x Leverage</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Amplify your predictions while managing risk effectively
                </p>
              </div>
            </div>
          </Card>

          {/* Settlement Timer */}
          <Card className="p-6 gradient-primary text-white">
            <div className="text-center">
              <div className="text-sm opacity-90 mb-2">Next Settlement In</div>
              <div className="text-4xl font-bold mb-1">{timeUntilSettlement()}</div>
              <div className="text-xs opacity-75">
                {market.nextSettlement.toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Position Modal */}
      <OpenPositionModal
        isOpen={showPositionModal}
        onClose={() => setShowPositionModal(false)}
        market={market}
        side={positionSide}
      />
    </div>
  )
}
