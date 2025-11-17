'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircleIcon, StarIcon, TrophyIcon, FireIcon, ChartBarIcon } from '@heroicons/react/24/solid'

interface Leader {
  address: string
  username: string
  avatar: string
  verified: boolean
  totalFollowers: number
  aum: string
  performanceFee: number
  minCopyAmount: string
  roi: number
  roiByTimeframe: {
    '7d': number
    '30d': number
    '90d': number
    '1y': number
    all: number
  }
  winRate: number
  totalTrades: number
  riskScore: number
  favoriteMarkets: string[]
  badges: string[]
  reputationScore: number
  trades30d: number
}

export default function LeadersPage() {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    sortBy: 'roi',
    timeframe: '30d',
    minRoi: 0,
    verified: false,
    search: ''
  })

  useEffect(() => {
    fetchLeaders()
  }, [filters])

  const fetchLeaders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        sortBy: filters.sortBy,
        timeframe: filters.timeframe,
        minRoi: filters.minRoi.toString(),
        verified: filters.verified.toString()
      })

      const res = await fetch(`http://localhost:3001/api/social/leaders?${params}`)
      const data = await res.json()

      if (data.success) {
        setLeaders(data.data)
      }
    } catch (error) {
      console.error('Error fetching leaders:', error)
    } finally {
      setLoading(false)
    }
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

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount) / 1e9
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}k`
    return num.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <TrophyIcon className="w-10 h-10 text-yellow-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Top Traders
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Copy the best traders automatically and earn while you learn
          </p>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Leaders</div>
            <div className="text-2xl font-bold">{leaders.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg ROI (30d)</div>
            <div className="text-2xl font-bold text-green-600">
              +{leaders.length > 0 ? (leaders.reduce((sum, l) => sum + l.roi, 0) / leaders.length).toFixed(1) : 0}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Followers</div>
            <div className="text-2xl font-bold">
              {leaders.reduce((sum, l) => sum + l.totalFollowers, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total AUM</div>
            <div className="text-2xl font-bold">
              {formatCurrency(leaders.reduce((sum, l) => sum + BigInt(l.aum), BigInt(0)).toString())} CSPR
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700"
              >
                <option value="roi">Highest ROI</option>
                <option value="aum">Most AUM</option>
                <option value="followers">Most Followers</option>
                <option value="reputation">Best Reputation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Timeframe</label>
              <select
                value={filters.timeframe}
                onChange={(e) => setFilters({...filters, timeframe: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Min ROI (%)</label>
              <input
                type="number"
                value={filters.minRoi}
                onChange={(e) => setFilters({...filters, minRoi: parseFloat(e.target.value) || 0})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700"
                placeholder="Search traders..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">&nbsp;</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => setFilters({...filters, verified: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span>Verified Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Leaders Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading traders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaders
              .filter(leader =>
                !filters.search ||
                leader.username.toLowerCase().includes(filters.search.toLowerCase())
              )
              .map((leader, index) => (
                <LeaderCard key={leader.address} leader={leader} rank={index + 1} />
              ))
            }
          </div>
        )}

        {!loading && leaders.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">No traders found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LeaderCard({ leader, rank }: { leader: Leader; rank: number }) {
  const getRiskColor = (score: number) => {
    if (score <= 3) return 'bg-green-500'
    if (score <= 6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getRiskLabel = (score: number) => {
    if (score <= 3) return 'Low Risk'
    if (score <= 6) return 'Medium Risk'
    return 'High Risk'
  }

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount) / 1e9
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}k`
    return num.toFixed(2)
  }

  const getBadgeColor = (badge: string) => {
    if (badge === 'Verified') return 'bg-blue-100 text-blue-800'
    if (badge.includes('Top')) return 'bg-purple-100 text-purple-800'
    if (badge === 'Hot Trader') return 'bg-red-100 text-red-800'
    if (badge === 'Consistent') return 'bg-green-100 text-green-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-blue-500">
      {/* Rank Badge */}
      {rank <= 3 && (
        <div className="absolute -top-3 -left-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
            rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : 'bg-orange-600'
          }`}>
            #{rank}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={leader.avatar}
              alt={leader.username}
              className="w-16 h-16 rounded-full border-2 border-blue-500"
            />
            {leader.verified && (
              <CheckCircleIcon className="absolute -bottom-1 -right-1 w-6 h-6 text-blue-500 bg-white rounded-full" />
            )}
          </div>

          <div>
            <h3 className="font-bold text-lg">{leader.username}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>#{rank}</span>
              <span>•</span>
              <span>{leader.totalFollowers} followers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {leader.badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {leader.badges.slice(0, 3).map(badge => (
            <span
              key={badge}
              className={`text-xs px-2 py-1 rounded-full font-medium ${getBadgeColor(badge)}`}
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">ROI (30d)</div>
          <div className={`text-xl font-bold ${leader.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {leader.roi > 0 ? '+' : ''}{leader.roi.toFixed(2)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Win Rate</div>
          <div className="text-xl font-bold text-blue-600">
            {(leader.winRate * 100).toFixed(1)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">AUM</div>
          <div className="text-xl font-bold text-purple-600">
            {formatCurrency(leader.aum)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Trades</div>
          <div className="text-xl font-bold text-orange-600">
            {leader.totalTrades}
          </div>
        </div>
      </div>

      {/* Risk Score */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Risk Level</span>
          <span className={getRiskLabel(leader.riskScore) === 'Low Risk' ? 'text-green-600' :
                          getRiskLabel(leader.riskScore) === 'Medium Risk' ? 'text-yellow-600' : 'text-red-600'}>
            {getRiskLabel(leader.riskScore)}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getRiskColor(leader.riskScore)}`}
            style={{ width: `${leader.riskScore * 10}%` }}
          />
        </div>
      </div>

      {/* Favorite Markets */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Specializes in:</div>
        <div className="flex gap-2 flex-wrap">
          {leader.favoriteMarkets.slice(0, 3).map(market => (
            <span
              key={market}
              className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm font-medium"
            >
              {market}
            </span>
          ))}
        </div>
      </div>

      {/* Performance Fee */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex items-center justify-between">
        <span>Performance Fee:</span>
        <span className="font-bold">{leader.performanceFee}%</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/social/copy/${leader.address}`}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium text-center transition-all"
        >
          Copy Trader
        </Link>
        <Link
          href={`/social/leaders/${leader.address}`}
          className="border-2 border-gray-300 dark:border-gray-600 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all"
        >
          View Profile
        </Link>
      </div>
    </div>
  )
}
