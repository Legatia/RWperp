'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircleIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  UsersIcon,
  TrophyIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/solid'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface LeaderProfile {
  address: string
  username: string
  avatar: string
  verified: boolean
  bio: string
  strategy: string
  totalFollowers: number
  aum: string
  performanceFee: number
  minCopyAmount: string
  roi_7d: number
  roi_30d: number
  roi_90d: number
  roi_1y: number
  roi_all: number
  winRate: number
  totalTrades: number
  winningTrades: number
  avgPositionDuration: number
  maxDrawdown: number
  sharpeRatio: number
  avgLeverage: number
  riskScore: number
  favoriteMarkets: string[]
  longShortRatio: number
  trades30d: number
  reputationScore: number
  badges: string[]
  currentPositions: any[]
  recentTrades: any[]
  equityCurve: any[]
  followerStats: {
    total: number
    active: number
    avgCopyAmount: number
    totalProfits: number
    topFollowers: any[]
  }
}

export default function LeaderProfilePage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const [profile, setProfile] = useState<LeaderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30d')
  const [showCopyModal, setShowCopyModal] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [address, timeframe])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/social/leaders/${address}?timeframe=${timeframe}`)
      const data = await res.json()

      if (data.success) {
        setProfile(data.data)
      }
    } catch (error) {
      console.error('Error fetching leader profile:', error)
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

  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    if (days > 0) return `${days}d`
    const hours = Math.floor(seconds / 3600)
    return `${hours}h`
  }

  const getRiskColor = (score: number) => {
    if (score <= 3) return 'text-green-600'
    if (score <= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskLabel = (score: number) => {
    if (score <= 3) return 'Low Risk'
    if (score <= 6) return 'Medium Risk'
    return 'High Risk'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trader profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">Trader not found</p>
          <Link href="/social/leaders" className="text-blue-600 hover:underline">
            Back to Leaders
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Back Button */}
        <Link
          href="/social/leaders"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Leaders
        </Link>

        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Avatar and Info */}
            <div className="flex items-start gap-6">
              <div className="relative">
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full border-4 border-blue-500"
                />
                {profile.verified && (
                  <CheckCircleIcon className="absolute -bottom-2 -right-2 w-10 h-10 text-blue-500 bg-white rounded-full" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{profile.username}</h1>
                  {profile.badges.map(badge => (
                    <span
                      key={badge}
                      className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs px-2 py-1 rounded-full font-medium"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 mb-4">
                  <div className="flex items-center gap-1">
                    <UsersIcon className="w-5 h-5" />
                    <span>{profile.totalFollowers} followers</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrophyIcon className="w-5 h-5" />
                    <span>{profile.reputationScore} reputation</span>
                  </div>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-3">{profile.bio}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">{profile.strategy}</p>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowCopyModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold text-lg transition-all shadow-lg"
              >
                Copy This Trader
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Performance Fee: {profile.performanceFee}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Min: {formatCurrency(profile.minCopyAmount)} CSPR
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
            <div className="text-sm opacity-90 mb-2">ROI (30d)</div>
            <div className="text-3xl font-bold">+{profile.roi_30d.toFixed(2)}%</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
            <div className="text-sm opacity-90 mb-2">Win Rate</div>
            <div className="text-3xl font-bold">{(profile.winRate * 100).toFixed(1)}%</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
            <div className="text-sm opacity-90 mb-2">AUM</div>
            <div className="text-3xl font-bold">{formatCurrency(profile.aum)}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
            <div className="text-sm opacity-90 mb-2">Total Trades</div>
            <div className="text-3xl font-bold">{profile.totalTrades}</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-6 shadow-lg">
            <div className="text-sm opacity-90 mb-2">Sharpe Ratio</div>
            <div className="text-3xl font-bold">{profile.sharpeRatio.toFixed(2)}</div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Performance History</h2>
            <div className="flex gap-2">
              {['7d', '30d', '90d', '1y', 'all'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timeframe === tf
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {profile.equityCurve && profile.equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profile.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Performance chart will be available soon
            </div>
          )}
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Performance Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <MetricRow label="ROI (7d)" value={`+${profile.roi_7d.toFixed(2)}%`} />
              <MetricRow label="ROI (30d)" value={`+${profile.roi_30d.toFixed(2)}%`} />
              <MetricRow label="ROI (90d)" value={`+${profile.roi_90d.toFixed(2)}%`} />
              <MetricRow label="ROI (1y)" value={`+${profile.roi_1y.toFixed(2)}%`} />
              <MetricRow label="ROI (All Time)" value={`+${profile.roi_all.toFixed(2)}%`} />
              <MetricRow label="Max Drawdown" value={`${profile.maxDrawdown.toFixed(2)}%`} negative />
            </div>
          </div>

          {/* Trading Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Trading Statistics</h3>
            <div className="space-y-4">
              <MetricRow label="Total Trades" value={profile.totalTrades.toString()} />
              <MetricRow label="Winning Trades" value={profile.winningTrades.toString()} />
              <MetricRow label="Win Rate" value={`${(profile.winRate * 100).toFixed(1)}%`} />
              <MetricRow label="Trades (30d)" value={profile.trades30d.toString()} />
              <MetricRow label="Avg Duration" value={formatDuration(profile.avgPositionDuration)} />
              <MetricRow label="Sharpe Ratio" value={profile.sharpeRatio.toFixed(2)} />
            </div>
          </div>

          {/* Risk Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Risk Profile</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Risk Score</span>
                  <span className={getRiskColor(profile.riskScore)}>
                    {getRiskLabel(profile.riskScore)} ({profile.riskScore}/10)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      profile.riskScore <= 3 ? 'bg-green-500' :
                      profile.riskScore <= 6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${profile.riskScore * 10}%` }}
                  />
                </div>
              </div>
              <MetricRow label="Avg Leverage" value={`${profile.avgLeverage.toFixed(1)}x`} />
              <MetricRow label="Max Drawdown" value={`${profile.maxDrawdown.toFixed(2)}%`} />
              <MetricRow label="Long/Short Ratio" value={`${(profile.longShortRatio * 100).toFixed(0)}/${((1 - profile.longShortRatio) * 100).toFixed(0)}`} />
            </div>
          </div>

          {/* Market Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Market Preferences</h3>
            <div className="space-y-3">
              {profile.favoriteMarkets.map((market, index) => (
                <div key={market} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    <span className="font-medium">{market}</span>
                  </div>
                  <span className="text-sm text-gray-500">Top {index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Positions */}
        {profile.currentPositions && profile.currentPositions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Current Positions ({profile.currentPositions.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3">Market</th>
                    <th className="text-left py-3">Direction</th>
                    <th className="text-right py-3">Size</th>
                    <th className="text-right py-3">Leverage</th>
                    <th className="text-right py-3">PnL</th>
                    <th className="text-right py-3">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.currentPositions.map((position, index) => (
                    <tr key={index} className="border-b dark:border-gray-700">
                      <td className="py-3">{position.market}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          position.isLong ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {position.isLong ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="text-right py-3">{formatCurrency(position.size)}</td>
                      <td className="text-right py-3">{position.leverage}x</td>
                      <td className={`text-right py-3 font-bold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {position.pnl >= 0 ? '+' : ''}{position.pnlPercentage.toFixed(2)}%
                      </td>
                      <td className="text-right py-3 text-sm text-gray-500">
                        {new Date(position.openedAt * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Follower Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4">Follower Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{profile.followerStats.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Followers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{profile.followerStats.active}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Copiers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatCurrency(profile.followerStats.avgCopyAmount)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Copy Amount</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {formatCurrency(profile.followerStats.totalProfits.toString())}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Copier Profits</div>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Modal */}
      {showCopyModal && (
        <CopyModal
          leader={profile}
          onClose={() => setShowCopyModal(false)}
        />
      )}
    </div>
  )
}

function MetricRow({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-bold ${negative ? 'text-red-600' : ''}`}>{value}</span>
    </div>
  )
}

function CopyModal({ leader, onClose }: { leader: LeaderProfile; onClose: () => void }) {
  const [amount, setAmount] = useState(leader.minCopyAmount)
  const [allocation, setAllocation] = useState(100)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Copy {leader.username}</h2>

        <div className="space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Copy Amount (CSPR)</label>
            <input
              type="number"
              value={parseFloat(amount) / 1e9}
              onChange={(e) => setAmount((parseFloat(e.target.value) * 1e9).toString())}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700"
              min={parseFloat(leader.minCopyAmount) / 1e9}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Minimum: {parseFloat(leader.minCopyAmount) / 1e9} CSPR
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium mb-3">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Copy Amount:</span>
                <span className="font-medium">{parseFloat(amount) / 1e9} CSPR</span>
              </div>
              <div className="flex justify-between">
                <span>Performance Fee:</span>
                <span className="font-medium">{leader.performanceFee}%</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Monthly Return:</span>
                <span className="font-medium text-green-600">
                  +{((parseFloat(amount) / 1e9) * (leader.roi_30d / 100)).toFixed(2)} CSPR
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                alert('Copy trading initiated! (Demo mode)')
                onClose()
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
            >
              Start Copying
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
