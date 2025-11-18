'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock, Activity, Info, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PerpData {
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
}

interface Position {
  id: string
  side: 'long' | 'short'
  collateral: string
  leverage: number
  entryPrice: string
  currentPrice: string
  pnl: string
  pnlPercentage: number
  accumulatedFunding: string
  liquidationPrice: string
  timestamp: number
}

const assetSlugToType: { [key: string]: { type: number; name: string; symbol: string } } = {
  'gold': { type: 0, name: 'Gold', symbol: 'XAU/USD' },
  'silver': { type: 1, name: 'Silver', symbol: 'XAG/USD' },
  'sp500': { type: 2, name: 'S&P 500', symbol: 'SPX' },
  'nasdaq': { type: 3, name: 'Nasdaq 100', symbol: 'NDX' },
  'oil': { type: 4, name: 'Crude Oil (WTI)', symbol: 'WTI' },
}

export default function PerpTradingPage() {
  const params = useParams()
  const assetSlug = params.asset as string
  const assetInfo = assetSlugToType[assetSlug]

  const [perpData, setPerpData] = useState<PerpData | null>(null)
  const [fundingHistory, setFundingHistory] = useState<any[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  // Form state
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [collateral, setCollateral] = useState('')
  const [leverage, setLeverage] = useState(5)

  // Update current time
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch perp data
  useEffect(() => {
    if (!assetInfo) return

    const fetchData = async () => {
      try {
        // Fetch perp market data
        const marketRes = await fetch(`/api/perps/markets`)
        const marketData = await marketRes.json()
        if (marketData.success) {
          const market = marketData.data.find((m: PerpData) => m.assetType === assetInfo.type)
          if (market) {
            setPerpData(market)
          }
        }

        // Fetch funding history
        const historyRes = await fetch(`/api/perps/funding-history/${assetInfo.type}?limit=24`)
        const historyData = await historyRes.json()
        if (historyData.success) {
          setFundingHistory(historyData.data)
        }

        // TODO: Fetch user positions for this asset
        // const positionsRes = await fetch(`/api/perps/positions/${userAddress}?asset=${assetInfo.type}`)
      } catch (error) {
        console.error('Failed to fetch perp data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [assetInfo])

  if (!assetInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Asset Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400">
              The requested perpetual market does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading || !perpData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Loading market data...</p>
          </div>
        </div>
      </div>
    )
  }

  const formatTimeUntilFunding = (seconds: number): string => {
    if (seconds <= 0) return 'Due now'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const timeRemaining = perpData.nextFundingTime - now
  const fundingRateNum = parseFloat(perpData.fundingRatePercentage || '0')
  const currentPrice = parseFloat(perpData.currentPrice || '0')
  const collateralNum = parseFloat(collateral || '0')
  const notionalSize = collateralNum * leverage

  const calculateLiquidationPrice = (side: 'long' | 'short', entry: number, lev: number): number => {
    if (side === 'long') {
      return entry * (1 - 1 / lev)
    } else {
      return entry * (1 + 1 / lev)
    }
  }

  const handleOpenPosition = async () => {
    // TODO: Implement position opening logic
    console.log('Opening position:', { side, collateral, leverage, assetType: assetInfo.type })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold">{assetInfo.name}</h1>
          <span className="text-xl text-gray-500 dark:text-gray-400">{assetInfo.symbol}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold">${currentPrice.toLocaleString()}</div>
          <div className={`px-3 py-1 rounded-full ${
            fundingRateNum >= 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
            'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            <span className="text-sm font-medium">
              Funding: {fundingRateNum >= 0 ? '+' : ''}{fundingRateNum}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Market Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Funding Rate Card */}
          <Card>
            <CardHeader>
              <CardTitle>Funding Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Current Rate (8h)
                  </div>
                  <div className={`text-2xl font-bold ${
                    fundingRateNum >= 0 ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {fundingRateNum >= 0 ? '+' : ''}{fundingRateNum}%
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Annualized
                  </div>
                  <div className="text-2xl font-bold">
                    {parseFloat(perpData.annualizedRate || '0').toFixed(2)}%
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Next Funding In
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="font-mono font-semibold">
                      {formatTimeUntilFunding(timeRemaining)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Direction
                  </div>
                  <div className="text-sm font-medium">
                    {fundingRateNum > 0 ? 'Longs → Shorts' : fundingRateNum < 0 ? 'Shorts → Longs' : 'Neutral'}
                  </div>
                </div>
              </div>

              {/* Funding Rate Chart */}
              {fundingHistory.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fundingHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts * 1000).toLocaleDateString()}
                      />
                      <YAxis tickFormatter={(val) => `${val}%`} />
                      <Tooltip
                        labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                        formatter={(val: any) => [`${val}%`, 'Funding Rate']}
                      />
                      <Line
                        type="monotone"
                        dataKey="fundingRate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Market Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Mark Price
                  </div>
                  <div className="text-lg font-semibold">
                    ${parseFloat(perpData.markPrice || '0').toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Index Price
                  </div>
                  <div className="text-lg font-semibold">
                    ${parseFloat(perpData.indexPrice || '0').toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Long OI
                  </div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    ${(parseFloat(perpData.totalLongOI || '0') / 1e9).toFixed(2)}M
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Short OI
                  </div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    ${(parseFloat(perpData.totalShortOI || '0') / 1e9).toFixed(2)}M
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Trading Form */}
        <div className="space-y-6">
          {/* Position Opening Form */}
          <Card>
            <CardHeader>
              <CardTitle>Open Position</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Side Selection */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  variant={side === 'long' ? 'default' : 'outline'}
                  onClick={() => setSide('long')}
                  className={side === 'long' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Long
                </Button>
                <Button
                  variant={side === 'short' ? 'default' : 'outline'}
                  onClick={() => setSide('short')}
                  className={side === 'short' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Short
                </Button>
              </div>

              {/* Collateral Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Collateral (CSPR)
                </label>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  placeholder="1000"
                />
              </div>

              {/* Leverage Slider */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Leverage: {leverage}x
                </label>
                <input
                  type="range"
                  min="1"
                  max={perpData.maxLeverage}
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1x</span>
                  <span>{perpData.maxLeverage}x</span>
                </div>
              </div>

              {/* Position Summary */}
              {collateralNum > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Notional Size</span>
                    <span className="font-semibold">${notionalSize.toLocaleString()} CSPR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Entry Price</span>
                    <span className="font-semibold">${currentPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Liquidation Price</span>
                    <span className="font-semibold text-red-500">
                      ${calculateLiquidationPrice(side, currentPrice, leverage).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Funding (next 8h)</span>
                    <span className={`font-semibold ${fundingRateNum >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {side === 'long' && fundingRateNum > 0 ? '-' : '+'}
                      ${Math.abs(notionalSize * fundingRateNum / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Open Position Button */}
              <Button
                className="w-full"
                onClick={handleOpenPosition}
                disabled={!collateralNum || collateralNum <= 0}
              >
                Open {side === 'long' ? 'Long' : 'Short'} Position
              </Button>

              {/* Warning */}
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    Funding payments occur every 8 hours. Monitor your position to avoid unexpected costs.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
