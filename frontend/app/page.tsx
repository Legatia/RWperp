'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp, Shield, Zap, Clock, BarChart3, Globe } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MarketOverview } from '@/components/MarketOverview'

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="container relative mx-auto px-4 py-24 sm:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <span className="text-sm font-semibold">Built on Casper Network 2.0</span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
              Trade Real World Assets
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-purple-100 max-w-2xl mx-auto">
              Daily markets OR continuous perps for stocks, commodities, real estate with <span className="font-bold text-yellow-300">10x leverage</span>. Hybrid settlement for every asset class.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/perps">
                <Button size="lg" className="gradient-primary text-white px-8 py-6 text-lg group">
                  Trade Perpetuals
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/markets">
                <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-8 py-6 text-lg">
                  Daily Markets
                </Button>
              </Link>
              <Link href="/portfolio">
                <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-8 py-6 text-lg">
                  Connect Wallet
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>
      </section>

      {/* Market Overview Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Live Markets</h2>
          <MarketOverview />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Why RWperp?</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Hybrid settlement system: Daily markets for slow-moving assets, continuous perps for fast-moving RWAs
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Hybrid Settlement</h3>
              <p className="text-muted-foreground">
                Daily settlement (00:00 UTC) OR continuous perps with 8-hour funding rates. Choose the right model for each asset.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg gradient-success flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">10x Leverage</h3>
              <p className="text-muted-foreground">
                Amplify your predictions with up to 10x leverage. Safe buffer for RWA volatility.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Decentralized Oracle</h3>
              <p className="text-muted-foreground">
                Multi-validator oracle network with staking and slashing. Median aggregation prevents manipulation.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Oracle</h3>
              <p className="text-muted-foreground">
                30-second price updates for perpetuals, daily batch aggregation for slow assets. Best of both worlds on Casper.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Diverse Assets</h3>
              <p className="text-muted-foreground">
                Trade predictions on gold, stocks, real estate, commodities - any RWA with daily price feeds.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Insurance Fund</h3>
              <p className="text-muted-foreground">
                20% of fees go to insurance fund. Protection against edge cases and underwater positions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">How It Works</h2>

          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Deposit Collateral</h3>
                <p className="text-muted-foreground text-lg">
                  Connect your Casper wallet and deposit CSPR or stablecoins as collateral. Your funds are securely held in the vault contract.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Open Position</h3>
                <p className="text-muted-foreground text-lg">
                  Choose a market (Gold, S&P 500, etc.), pick LONG or SHORT, set leverage (1-10x), and open your position. You'll see your liquidation price immediately.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Monitor & Trade</h3>
                <p className="text-muted-foreground text-lg">
                  Track your position in real-time. View current PnL, liquidation price, and market charts. Close early or let it settle daily.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                4
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Daily Settlement</h3>
                <p className="text-muted-foreground text-lg">
                  At 00:00 UTC, oracles provide closing prices. Your position auto-settles with profits/losses applied. Withdraw anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container relative mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">Ready to Start Trading?</h2>
          <p className="text-xl mb-8 text-purple-100 max-w-2xl mx-auto">
            Join the first RWA prediction market on Casper. Start with as little as 10 CSPR.
          </p>
          <Link href="/markets">
            <Button size="lg" className="bg-white text-purple-900 hover:bg-purple-50 px-10 py-6 text-lg">
              Launch App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
