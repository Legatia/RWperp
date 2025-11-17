'use client'

import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, X, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useWallet } from '@/lib/hooks/useWallet'
import { formatCurrency, formatCSPR, formatPercent } from '@/lib/utils'

interface Position {
  id: number
  market: string
  symbol: string
  side: 'Long' | 'Short'
  entryPrice: number
  currentPrice: number
  collateral: number
  leverage: number
  effectiveSize: number
  pnl: number
  pnlPercent: number
  liquidationPrice: number
  openTime: Date
}

// Mock positions
const mockPositions: Position[] = [
  {
    id: 1,
    market: 'Gold',
    symbol: 'XAU/USD',
    side: 'Long',
    entryPrice: 2040.00,
    currentPrice: 2045.50,
    collateral: 100,
    leverage: 10,
    effectiveSize: 1000,
    pnl: 5.5,
    pnlPercent: 5.5,
    liquidationPrice: 1836.00,
    openTime: new Date('2024-11-17T10:30:00'),
  },
  {
    id: 2,
    market: 'S&P 500',
    symbol: 'SPX',
    side: 'Short',
    entryPrice: 4790.00,
    currentPrice: 4783.45,
    collateral: 200,
    leverage: 5,
    effectiveSize: 1000,
    pnl: 1.37,
    pnlPercent: 0.685,
    liquidationPrice: 5269.00,
    openTime: new Date('2024-11-17T14:15:00'),
  },
]

export default function PortfolioPage() {
  const { address, isConnected, connect, balance } = useWallet()
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions')

  // Mock portfolio stats
  const portfolioValue = 312.87
  const totalPnL = 6.87
  const totalPnLPercent = 2.24

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto p-12 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Casper wallet to view your portfolio and manage positions
          </p>
          <Button
            onClick={connect}
            size="lg"
            className="gradient-primary text-white px-8"
          >
            Connect Wallet
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Portfolio Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
        <p className="text-muted-foreground">Manage your positions and track performance</p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-3xl font-bold">{formatCSPR(portfolioValue)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            ≈ {formatCurrency(portfolioValue * 0.05)}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total PnL</div>
          <div
            className={`text-3xl font-bold ${
              totalPnL >= 0 ? 'text-success' : 'text-destructive'
            }`}
          >
            {totalPnL >= 0 ? '+' : ''}{formatCSPR(totalPnL)}
          </div>
          <div className={`text-sm font-medium ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPercent(totalPnLPercent)}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Available Balance</div>
          <div className="text-3xl font-bold">{formatCSPR(306)}</div>
          <Button variant="outline" size="sm" className="mt-2 w-full">
            Deposit
          </Button>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Active Positions</div>
          <div className="text-3xl font-bold">{mockPositions.length}</div>
          <Button variant="outline" size="sm" className="mt-2 w-full">
            View Markets
          </Button>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'positions'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('positions')}
        >
          Active Positions
        </button>
        <button
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {/* Active Positions */}
      {activeTab === 'positions' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Positions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {mockPositions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-semibold">Market</th>
                      <th className="text-left p-4 font-semibold">Side</th>
                      <th className="text-right p-4 font-semibold">Entry</th>
                      <th className="text-right p-4 font-semibold">Current</th>
                      <th className="text-right p-4 font-semibold hidden md:table-cell">
                        Collateral
                      </th>
                      <th className="text-right p-4 font-semibold hidden md:table-cell">
                        Leverage
                      </th>
                      <th className="text-right p-4 font-semibold">PnL</th>
                      <th className="text-right p-4 font-semibold hidden lg:table-cell">
                        Liq. Price
                      </th>
                      <th className="text-right p-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockPositions.map((position) => (
                      <tr
                        key={position.id}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-semibold">{position.market}</div>
                          <div className="text-sm text-muted-foreground">
                            {position.symbol}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                              position.side === 'Long'
                                ? 'bg-success/10 text-success'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {position.side === 'Long' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {position.side}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          {formatCurrency(position.entryPrice)}
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          {formatCurrency(position.currentPrice)}
                        </td>
                        <td className="p-4 text-right font-mono text-sm hidden md:table-cell">
                          {formatCSPR(position.collateral)}
                        </td>
                        <td className="p-4 text-right font-medium hidden md:table-cell">
                          {position.leverage}x
                        </td>
                        <td className="p-4 text-right">
                          <div
                            className={`font-semibold ${
                              position.pnl >= 0 ? 'text-success' : 'text-destructive'
                            }`}
                          >
                            {position.pnl >= 0 ? '+' : ''}{formatCSPR(position.pnl)}
                          </div>
                          <div
                            className={`text-xs ${
                              position.pnl >= 0 ? 'text-success' : 'text-destructive'
                            }`}
                          >
                            {formatPercent(position.pnlPercent)}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-sm text-muted-foreground hidden lg:table-cell">
                          {formatCurrency(position.liquidationPrice)}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="hover:scale-105 transition-transform"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <p>No active positions</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trading History</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="p-12 text-center text-muted-foreground">
              <p>No trading history yet</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Warning */}
      <Card className="mt-8 p-6 bg-warning/10 border-warning">
        <h3 className="font-semibold text-warning mb-2">⚠️ Risk Warning</h3>
        <p className="text-sm text-muted-foreground">
          Trading with leverage carries significant risk. You can lose more than your initial
          collateral. Only trade with funds you can afford to lose. Past performance does not
          guarantee future results.
        </p>
      </Card>
    </div>
  )
}
