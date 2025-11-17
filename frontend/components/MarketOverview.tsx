'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Market {
  id: string
  name: string
  symbol: string
  price: number
  change24h: number
  volume24h: number
  openInterest: number
}

// Mock data - in production, fetch from contract
const mockMarkets: Market[] = [
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'XAU/USD',
    price: 2045.50,
    change24h: 0.75,
    volume24h: 1250000,
    openInterest: 5420000,
  },
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: 'SPX',
    price: 4783.45,
    change24h: -0.32,
    volume24h: 3500000,
    openInterest: 12500000,
  },
  {
    id: 'silver',
    name: 'Silver',
    symbol: 'XAG/USD',
    price: 24.12,
    change24h: 1.25,
    volume24h: 850000,
    openInterest: 2100000,
  },
  {
    id: 'oil',
    name: 'Crude Oil',
    symbol: 'WTI',
    price: 77.85,
    change24h: -1.15,
    volume24h: 2100000,
    openInterest: 8900000,
  },
]

export function MarketOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {mockMarkets.map((market) => (
        <Link key={market.id} href={`/markets/${market.id}`}>
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {market.name}
                </h3>
                <p className="text-sm text-muted-foreground">{market.symbol}</p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  market.change24h >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {market.change24h >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {formatPercent(market.change24h)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">{formatCurrency(market.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">24h Volume</span>
                <span className="font-mono">{formatCurrency(market.volume24h, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Open Interest</span>
                <span className="font-mono">{formatCurrency(market.openInterest, 0)}</span>
              </div>
            </div>

            <Button className="w-full mt-4 gradient-primary text-white group-hover:scale-105 transition-transform">
              Trade Now
            </Button>
          </Card>
        </Link>
      ))}
    </div>
  )
}
