'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircleIcon,
  PauseCircleIcon,
  StopCircleIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/solid'

interface CopyRelationship {
  leader: string
  leaderName: string
  leaderAvatar: string
  leaderVerified: boolean
  allocationAmount: string
  allocationPercentage: number
  totalProfit: number
  roi: number
  activePositions: any[]
  feesPaid: string
  riskLimits: {
    maxLeverage: number
    stopLossPercentage: number
    maxPositionSize: string
    allowedMarkets: number[]
    maxConcurrentPositions: number
  }
  tradingDays: number
  tradesCopied: number
  isActive: boolean
  pauseReason: string
  leaderRoi30d: number
  leaderWinRate: number
  createdAt: number
}

interface Summary {
  totalCopies: number
  activeCopies: number
  totalAllocated: string
  totalProfit: number
  totalFees: string
  overallRoi: number
}

export default function MyCopiesPage() {
  const [copies, setCopies] = useState<CopyRelationship[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCopy, setSelectedCopy] = useState<CopyRelationship | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Mock user address - in production, get from wallet
  const userAddress = 'account-hash-user0000000000000000000000000000000000000000000000000000000'

  useEffect(() => {
    fetchMyCopies()
  }, [])

  const fetchMyCopies = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/social/my-copies/${userAddress}`)
      const data = await res.json()

      if (data.success) {
        setCopies(data.data)
        setSummary({
          totalCopies: data.totalCopies,
          activeCopies: data.activeCopies,
          totalAllocated: data.totalAllocated,
          totalProfit: data.totalProfit,
          totalFees: data.totalFees,
          overallRoi: data.overallRoi
        })
      }
    } catch (error) {
      console.error('Error fetching copies:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) / 1e9 : amount
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}k`
    return num.toFixed(2)
  }

  const handlePauseCopy = async (leader: string) => {
    // In production, call API to pause copy
    alert(`Pausing copy relationship with ${leader}`)
    fetchMyCopies()
  }

  const handleResumeCopy = async (leader: string) => {
    // In production, call API to resume copy
    alert(`Resuming copy relationship with ${leader}`)
    fetchMyCopies()
  }

  const handleStopCopy = async (leader: string) => {
    if (confirm('Are you sure you want to stop copying this trader? All positions will be closed.')) {
      // In production, call API to stop copy
      alert(`Stopped copying ${leader}`)
      fetchMyCopies()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your copies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Copy Trading</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your copy trading relationships and monitor performance
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Copies</div>
              <div className="text-2xl font-bold">{summary.totalCopies}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active</div>
              <div className="text-2xl font-bold text-green-600">{summary.activeCopies}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Allocated</div>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalAllocated)}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Profit</div>
              <div className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalProfit >= 0 ? '+' : ''}{formatCurrency(summary.totalProfit)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall ROI</div>
              <div className={`text-2xl font-bold ${summary.overallRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.overallRoi >= 0 ? '+' : ''}{summary.overallRoi.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fees Paid</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalFees)}</div>
            </div>
          </div>
        )}

        {/* Copy Relationships */}
        {copies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-lg">
            <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Copy Trading Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start copying successful traders to grow your portfolio automatically
            </p>
            <Link
              href="/social/leaders"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
            >
              Browse Top Traders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {copies.map((copy) => (
              <CopyCard
                key={copy.leader}
                copy={copy}
                onPause={() => handlePauseCopy(copy.leader)}
                onResume={() => handleResumeCopy(copy.leader)}
                onStop={() => handleStopCopy(copy.leader)}
                onSettings={() => {
                  setSelectedCopy(copy)
                  setShowSettingsModal(true)
                }}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && selectedCopy && (
        <SettingsModal
          copy={selectedCopy}
          onClose={() => setShowSettingsModal(false)}
          onSave={(updated) => {
            alert('Settings updated! (Demo mode)')
            setShowSettingsModal(false)
            fetchMyCopies()
          }}
        />
      )}
    </div>
  )
}

function CopyCard({
  copy,
  onPause,
  onResume,
  onStop,
  onSettings,
  formatCurrency
}: {
  copy: CopyRelationship
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSettings: () => void
  formatCurrency: (amount: string | number) => string
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 ${
      copy.isActive ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Leader Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className="relative">
            <img
              src={copy.leaderAvatar}
              alt={copy.leaderName}
              className="w-16 h-16 rounded-full border-2 border-blue-500"
            />
            {copy.leaderVerified && (
              <CheckCircleIcon className="absolute -bottom-1 -right-1 w-6 h-6 text-blue-500 bg-white rounded-full" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/social/leaders/${copy.leader}`}
                className="text-xl font-bold hover:text-blue-600"
              >
                {copy.leaderName}
              </Link>
              {copy.isActive ? (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                  ACTIVE
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  PAUSED
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Allocated</div>
                <div className="font-bold">{formatCurrency(copy.allocationAmount)} CSPR</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">My ROI</div>
                <div className={`font-bold ${copy.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {copy.roi >= 0 ? '+' : ''}{copy.roi.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Profit</div>
                <div className={`font-bold ${copy.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {copy.totalProfit >= 0 ? '+' : ''}{formatCurrency(copy.totalProfit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Trades Copied</div>
                <div className="font-bold">{copy.tradesCopied}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                {copy.leaderRoi30d >= 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                )}
                <span className="text-gray-600 dark:text-gray-400">
                  Leader: <span className={copy.leaderRoi30d >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {copy.leaderRoi30d >= 0 ? '+' : ''}{copy.leaderRoi30d.toFixed(2)}%
                  </span>
                </span>
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Win Rate: {(copy.leaderWinRate * 100).toFixed(1)}%
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {copy.tradingDays} days
              </div>
            </div>

            {!copy.isActive && copy.pauseReason && (
              <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                Paused: {copy.pauseReason}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2 min-w-[200px]">
          <button
            onClick={onSettings}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-all"
          >
            <Cog6ToothIcon className="w-5 h-5" />
            Settings
          </button>

          {copy.isActive ? (
            <button
              onClick={onPause}
              className="flex items-center justify-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-medium transition-all"
            >
              <PauseCircleIcon className="w-5 h-5" />
              Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-all"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Resume
            </button>
          )}

          <button
            onClick={onStop}
            className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium transition-all"
          >
            <StopCircleIcon className="w-5 h-5" />
            Stop Copying
          </button>

          <div className="text-xs text-gray-600 dark:text-gray-400 text-center mt-1">
            Fees: {formatCurrency(copy.feesPaid)} CSPR
          </div>
        </div>
      </div>

      {/* Active Positions */}
      {copy.activePositions && copy.activePositions.length > 0 && (
        <div className="mt-6 pt-6 border-t dark:border-gray-700">
          <h4 className="font-bold mb-3">Active Positions ({copy.activePositions.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {copy.activePositions.map((pos, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Market #{pos.market}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    pos.isLong ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {pos.isLong ? 'LONG' : 'SHORT'} {pos.leverage}x
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Size: {formatCurrency(pos.size)}
                </div>
                <div className={`text-sm font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  PnL: {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsModal({
  copy,
  onClose,
  onSave
}: {
  copy: CopyRelationship
  onClose: () => void
  onSave: (updated: any) => void
}) {
  const [settings, setSettings] = useState({
    maxLeverage: copy.riskLimits.maxLeverage,
    stopLossPercentage: copy.riskLimits.stopLossPercentage,
    maxConcurrentPositions: copy.riskLimits.maxConcurrentPositions
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Risk Management Settings</h2>

        <div className="space-y-6">
          {/* Max Leverage */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Leverage: {settings.maxLeverage}x
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxLeverage}
              onChange={(e) => setSettings({ ...settings, maxLeverage: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Override if leader uses higher leverage
            </p>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Stop Loss: {settings.stopLossPercentage}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.stopLossPercentage}
              onChange={(e) => setSettings({ ...settings, stopLossPercentage: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Automatically stop copying if down by this amount
            </p>
          </div>

          {/* Max Concurrent Positions */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Concurrent Positions: {settings.maxConcurrentPositions}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxConcurrentPositions}
              onChange={(e) => setSettings({ ...settings, maxConcurrentPositions: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Maximum number of positions to copy from this leader
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => onSave(settings)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
