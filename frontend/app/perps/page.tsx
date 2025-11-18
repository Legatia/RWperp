'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Clock, Activity, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface PerpMarket {
  assetType: number
  name: string
  symbol: string
  currentPrice: string
  indexPrice: string
  markPrice: string
  fundingRate: number
  fundingRatePercentage: string
  annualizedRate: string
  lastFundingTime: number
  nextFundingTime: number
  timeUntilFunding: number
  totalLongOI: string
  totalShortOI: string
  maxLeverage: number
  isActive: boolean
  change24h?: number
}

const assetTypeToSlug: { [key: number]: string } = {
  0: 'gold',
  1: 'silver',
  2: 'sp500',
  3: 'nasdaq',
  4: 'oil',
}

export default function PerpsPage() {
  const [markets, setMarkets] = useState<PerpMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string>('All')
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch perp markets
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch('/api/perps/markets')
        const data = await response.json()

        if (data.success) {
          setMarkets(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch perp markets:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMarkets()
    // Refresh every 30 seconds to get latest funding rates
    const interval = setInterval(fetchMarkets, 30000)
    return () => clearInterval(interval)
  }, [])

  const categories = ['All', 'Metals', 'Equities', 'Energy']

  const filteredMarkets = markets.filter((market) => {
    if (selectedFilter === 'All') return true
    if (selectedFilter === 'Metals') return market.assetType === 0 || market.assetType === 1
    if (selectedFilter === 'Equities') return market.assetType === 2 || market.assetType === 3
    if (selectedFilter === 'Energy') return market.assetType === 4
    return true
  })

  const formatTimeUntilFunding = (seconds: number): string => {
    if (seconds <= 0) return 'Due now'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getFundingRateColor = (rate: number): string => {
    if (rate > 0) return 'text-red-500' // Longs pay shorts
    if (rate < 0) return 'text-green-500' // Shorts pay longs
    return 'text-gray-500'
  }

  const getFundingRateLabel = (rate: number): string => {
    if (rate > 0) return 'Longs pay shorts'
    if (rate < 0) return 'Shorts pay longs'
    return 'Neutral'
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Loading perpetual markets...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Continuous Perpetuals</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Trade real-world assets with 10x leverage and 8-hour funding rates
        </p>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                About Funding Rates
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Funding rates keep perpetual prices anchored to spot prices. Paid every 8 hours (00:00, 08:00, 16:00 UTC).
                <span className="font-medium"> Positive rate:</span> Longs pay shorts.
                <span className="font-medium"> Negative rate:</span> Shorts pay longs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedFilter === category ? 'default' : 'outline'}
            onClick={() => setSelectedFilter(category)}
            size="sm"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Markets Grid */}
      {filteredMarkets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No perpetual markets available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMarkets.map((market) => {
            const timeRemaining = market.nextFundingTime - now
            const fundingRateNum = parseFloat(market.fundingRatePercentage || '0')

            return (
              <Card key={market.assetType} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Market Info */}
                    <div className="lg:col-span-3">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{market.name}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {market.symbol}
                        </span>
                      </div>
                      <div className="text-3xl font-bold mb-1">
                        ${parseFloat(market.currentPrice || '0').toLocaleString()}
                      </div>
                      {market.change24h !== undefined && (
                        <div className={`flex items-center gap-1 ${
                          market.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {market.change24h >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {formatPercent(Math.abs(market.change24h))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Funding Rate */}
                    <div className="lg:col-span-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Funding Rate (8h)
                      </div>
                      <div className={`text-2xl font-bold ${getFundingRateColor(fundingRateNum)}`}>
                        {fundingRateNum >= 0 ? '+' : ''}{fundingRateNum}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {getFundingRateLabel(fundingRateNum)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        APR: {parseFloat(market.annualizedRate || '0').toFixed(2)}%
                      </div>
                    </div>

                    {/* Next Funding */}
                    <div className="lg:col-span-2">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Next Funding In
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-lg font-semibold">
                          {formatTimeUntilFunding(timeRemaining)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Every 8 hours
                      </div>
                    </div>

                    {/* Open Interest */}
                    <div className="lg:col-span-2">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Open Interest
                      </div>
                      <div className="text-sm font-medium text-green-600 dark:text-green-400">
                        Long: ${(parseFloat(market.totalLongOI || '0') / 1e9).toFixed(2)}M
                      </div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        Short: ${(parseFloat(market.totalShortOI || '0') / 1e9).toFixed(2)}M
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Max {market.maxLeverage}x leverage
                      </div>
                    </div>

                    {/* Action */}
                    <div className="lg:col-span-2 flex items-center justify-end">
                      <Link href={`/perps/${assetTypeToSlug[market.assetType]}`}>
                        <Button className="w-full lg:w-auto">
                          Trade Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total Open Interest
            </div>
            <div className="text-2xl font-bold">
              ${markets.reduce((sum, m) =>
                sum + (parseFloat(m.totalLongOI || '0') + parseFloat(m.totalShortOI || '0')) / 1e9
              , 0).toFixed(2)}M
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Active Markets
            </div>
            <div className="text-2xl font-bold">
              {markets.filter(m => m.isActive).length} / {markets.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Avg Funding Rate
            </div>
            <div className="text-2xl font-bold">
              {(markets.reduce((sum, m) =>
                sum + parseFloat(m.fundingRatePercentage || '0')
              , 0) / markets.length).toFixed(4)}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
