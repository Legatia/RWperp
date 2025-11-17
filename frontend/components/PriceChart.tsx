'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PriceChartProps {
  marketId: string
}

// Generate mock price data
const generateMockData = (basePrice: number) => {
  const data = []
  const now = new Date()

  for (let i = 24; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    const randomChange = (Math.random() - 0.5) * basePrice * 0.02
    const price = basePrice + randomChange

    data.push({
      time: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      price: Number(price.toFixed(2)),
    })
  }

  return data
}

export function PriceChart({ marketId }: PriceChartProps) {
  const basePrices: Record<string, number> = {
    gold: 2045,
    silver: 24,
    sp500: 4783,
    nasdaq: 16845,
    oil: 77,
    btc: 42150,
  }

  const data = generateMockData(basePrices[marketId] || 2000)

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            className="text-xs"
            stroke="currentColor"
            tick={{ fill: 'currentColor' }}
          />
          <YAxis
            className="text-xs"
            stroke="currentColor"
            tick={{ fill: 'currentColor' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
