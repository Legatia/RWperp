'use client'

import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface Market {
  id: string
  name: string
  symbol: string
  category: string
  price: number
  change24h: number
  volume24h: number
  openInterest: number
  longShortRatio: number
}

const mockMarkets: Market[] = [
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'XAU/USD',
    category: 'Commodities',
    price: 2045.50,
    change24h: 0.75,
    volume24h: 1250000,
    openInterest: 5420000,
    longShortRatio: 1.35,
  },
  {
    id: 'silver',
    name: 'Silver',
    symbol: 'XAG/USD',
    category: 'Commodities',
    price: 24.12,
    change24h: 1.25,
    volume24h: 850000,
    openInterest: 2100000,
    longShortRatio: 1.58,
  },
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: 'SPX',
    category: 'Equities',
    price: 4783.45,
    change24h: -0.32,
    volume24h: 3500000,
    openInterest: 12500000,
    longShortRatio: 0.89,
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ 100',
    symbol: 'NDX',
    category: 'Equities',
    price: 16845.30,
    change24h: -0.48,
    volume24h: 2800000,
    openInterest: 9200000,
    longShortRatio: 0.92,
  },
  {
    id: 'oil',
    name: 'Crude Oil (WTI)',
    symbol: 'WTI',
    category: 'Commodities',
    price: 77.85,
    change24h: -1.15,
    volume24h: 2100000,
    openInterest: 8900000,
    longShortRatio: 1.12,
  },
  {
    id: 'btc',
    name: 'Bitcoin ETF',
    symbol: 'IBIT',
    price: 42150.00,
    category: 'Crypto ETF',
    change24h: 2.45,
    volume24h: 5200000,
    openInterest: 15800000,
    longShortRatio: 1.92,
  },
]

export default function MarketsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const categories = ['All', 'Commodities', 'Equities', 'Crypto ETF', 'Real Estate']

  const filteredMarkets = mockMarkets.filter((market) => {
    const matchesSearch =
      market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === 'All' || market.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Markets</h1>
        <p className="text-muted-foreground">
          Trade predictions on real-world assets with up to 10x leverage
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? 'gradient-primary text-white' : ''}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Markets Table/Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Available Markets ({filteredMarkets.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-semibold">Asset</th>
                  <th className="text-right p-4 font-semibold">Price</th>
                  <th className="text-right p-4 font-semibold">24h Change</th>
                  <th className="text-right p-4 font-semibold hidden md:table-cell">
                    24h Volume
                  </th>
                  <th className="text-right p-4 font-semibold hidden lg:table-cell">
                    Open Interest
                  </th>
                  <th className="text-right p-4 font-semibold hidden lg:table-cell">
                    Long/Short
                  </th>
                  <th className="text-right p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map((market) => (
                  <tr
                    key={market.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-semibold">{market.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {market.symbol}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono">
                      {formatCurrency(market.price)}
                    </td>
                    <td className="p-4 text-right">
                      <div
                        className={`inline-flex items-center gap-1 font-medium ${
                          market.change24h >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        }`}
                      >
                        {market.change24h >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {formatPercent(market.change24h)}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono hidden md:table-cell">
                      {formatCurrency(market.volume24h, 0)}
                    </td>
                    <td className="p-4 text-right font-mono hidden lg:table-cell">
                      {formatCurrency(market.openInterest, 0)}
                    </td>
                    <td className="p-4 text-right hidden lg:table-cell">
                      <span
                        className={`font-medium ${
                          market.longShortRatio > 1
                            ? 'text-success'
                            : 'text-destructive'
                        }`}
                      >
                        {market.longShortRatio.toFixed(2)}x
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/markets/${market.id}`}>
                        <Button
                          size="sm"
                          className="gradient-primary text-white hover:scale-105 transition-transform"
                        >
                          Trade
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Daily Settlement</h3>
          <p className="text-sm text-muted-foreground">
            All positions settle at 00:00 UTC with oracle-provided closing prices.
            No flash crash liquidations.
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">10x Leverage</h3>
          <p className="text-sm text-muted-foreground">
            Amplify your predictions with up to 10x leverage. Lower risk than
            traditional 50x+ perpetual markets.
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Secure Oracles</h3>
          <p className="text-sm text-muted-foreground">
            Multi-validator oracle network with median aggregation ensures accurate,
            manipulation-resistant pricing.
          </p>
        </Card>
      </div>
    </div>
  )
}
