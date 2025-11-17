'use client'

import { useState } from 'react'
import { TrendingUp, Lock, Coins, Percent, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useWallet } from '@/lib/hooks/useWallet'
import { formatCSPR, formatPercent } from '@/lib/utils'

interface StakingPool {
  id: number
  name: string
  stakingToken: string
  rewardToken: string
  tvl: number
  apr: number
  yourStake: number
  pendingRewards: number
  lockPeriod?: number
}

// Mock data
const mockPools: StakingPool[] = [
  {
    id: 1,
    name: 'LP Staking',
    stakingToken: 'rwLP-CSPR',
    rewardToken: 'RWP',
    tvl: 2500000,
    apr: 85,
    yourStake: 1000,
    pendingRewards: 45.5,
  },
  {
    id: 2,
    name: 'RWP Staking',
    stakingToken: 'RWP',
    rewardToken: 'CSPR (Fees)',
    tvl: 5000000,
    apr: 45,
    yourStake: 5000,
    pendingRewards: 125.3,
    lockPeriod: 2592000, // 30 days
  },
  {
    id: 3,
    name: 'Boosted LP Pool',
    stakingToken: 'rwLP-CSPR + RWP',
    rewardToken: 'RWP (2x)',
    tvl: 1200000,
    apr: 160,
    yourStake: 500,
    pendingRewards: 89.2,
  },
]

export default function StakingPage() {
  const { isConnected, connect } = useWallet()
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [lockPeriod, setLockPeriod] = useState<number>(0)

  const totalStaked = mockPools.reduce((sum, pool) => sum + pool.yourStake, 0)
  const totalPendingRewards = mockPools.reduce((sum, pool) => sum + pool.pendingRewards, 0)

  const handleStake = () => {
    if (!selectedPool) return

    // TODO: Call smart contract to stake
    console.log('Staking', stakeAmount, 'in pool', selectedPool.id)

    setSelectedPool(null)
    setStakeAmount('')
  }

  const handleHarvest = (poolId: number) => {
    // TODO: Call smart contract to harvest
    console.log('Harvesting rewards from pool', poolId)
  }

  const handleUnstake = (poolId: number, amount: number) => {
    // TODO: Call smart contract to unstake
    console.log('Unstaking', amount, 'from pool', poolId)
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto p-12 text-center">
          <Lock className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Casper wallet to stake tokens and earn rewards
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Staking</h1>
        <p className="text-muted-foreground">
          Stake LP tokens or RWP to earn rewards
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Staked</div>
          <div className="text-3xl font-bold">{formatCSPR(totalStaked)}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all pools</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Pending Rewards</div>
          <div className="text-3xl font-bold text-success">
            {totalPendingRewards.toFixed(2)} RWP
          </div>
          <div className="text-xs text-muted-foreground mt-1">Ready to harvest</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Avg APR</div>
          <div className="text-3xl font-bold text-primary">96.67%</div>
          <div className="text-xs text-muted-foreground mt-1">Across your positions</div>
        </Card>
      </div>

      {/* Staking Pools */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Staking Pools</h2>

        {mockPools.map((pool) => (
          <Card key={pool.id} className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold mb-1">{pool.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Stake {pool.stakingToken} → Earn {pool.rewardToken}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-success">
                  {formatPercent(pool.apr)}
                </div>
                <div className="text-sm text-muted-foreground">APR</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">TVL</div>
                <div className="font-semibold">{formatCSPR(pool.tvl)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Your Stake</div>
                <div className="font-semibold">{formatCSPR(pool.yourStake)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Pending Rewards</div>
                <div className="font-semibold text-success">
                  {pool.pendingRewards.toFixed(2)} {pool.rewardToken.split(' ')[0]}
                </div>
              </div>
              {pool.lockPeriod && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Lock Period</div>
                  <div className="font-semibold">
                    {Math.floor(pool.lockPeriod / 86400)} days
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setSelectedPool(pool)}
                className="gradient-primary text-white"
              >
                <Coins className="h-4 w-4 mr-2" />
                Stake
              </Button>
              {pool.yourStake > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleUnstake(pool.id, pool.yourStake)}
                  >
                    Unstake
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleHarvest(pool.id)}
                    className="border-success text-success hover:bg-success/10"
                  >
                    Harvest {pool.pendingRewards.toFixed(1)} {pool.rewardToken.split(' ')[0]}
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Lock Period Info */}
      <Card className="mt-8 p-6 bg-primary/10 border-primary/30">
        <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Lock for Higher Rewards
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Lock your RWP tokens for longer periods to earn higher APR and increased voting power
        </p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-background">
            <div className="font-semibold">No Lock</div>
            <div className="text-xs text-muted-foreground">1x voting, 5% APR</div>
          </div>
          <div className="p-3 rounded-lg bg-background">
            <div className="font-semibold">1 Week</div>
            <div className="text-xs text-muted-foreground">1.25x voting, 10% APR</div>
          </div>
          <div className="p-3 rounded-lg bg-background">
            <div className="font-semibold">1 Month</div>
            <div className="text-xs text-muted-foreground">1.5x voting, 20% APR</div>
          </div>
          <div className="p-3 rounded-lg bg-background">
            <div className="font-semibold">3 Months</div>
            <div className="text-xs text-muted-foreground">2x voting, 35% APR</div>
          </div>
          <div className="p-3 rounded-lg bg-background">
            <div className="font-semibold">6 Months</div>
            <div className="text-xs text-muted-foreground">2.5x voting, 50% APR</div>
          </div>
          <div className="p-3 rounded-lg bg-background border-2 border-primary">
            <div className="font-semibold text-primary">1 Year</div>
            <div className="text-xs text-muted-foreground">3x voting, 75% APR</div>
          </div>
        </div>
      </Card>

      {/* Stake Modal */}
      {selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Stake in {selectedPool.name}</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Amount to Stake</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  Available: 10,000 {selectedPool.stakingToken}
                </div>
              </div>

              {selectedPool.lockPeriod && (
                <div>
                  <label className="block text-sm font-medium mb-2">Lock Period</label>
                  <select
                    value={lockPeriod}
                    onChange={(e) => setLockPeriod(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={0}>No lock (5% APR, 1x voting)</option>
                    <option value={604800}>1 week (10% APR, 1.25x voting)</option>
                    <option value={2592000}>1 month (20% APR, 1.5x voting)</option>
                    <option value={7776000}>3 months (35% APR, 2x voting)</option>
                    <option value={15552000}>6 months (50% APR, 2.5x voting)</option>
                    <option value={31536000}>1 year (75% APR, 3x voting)</option>
                  </select>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">You will receive</span>
                  <span className="font-semibold">
                    {stakeAmount || '0'} {selectedPool.stakingToken} (staked)
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">APR</span>
                  <span className="font-semibold text-success">
                    {formatPercent(selectedPool.apr)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. rewards/day</span>
                  <span className="font-semibold">
                    ~{((Number(stakeAmount) || 0) * selectedPool.apr / 100 / 365).toFixed(2)} RWP
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPool(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStake}
                  className="flex-1 gradient-primary text-white"
                >
                  Stake <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
