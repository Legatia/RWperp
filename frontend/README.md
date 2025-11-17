# RWperp Frontend

Modern, responsive web application for the RWperp Real World Asset prediction market platform built on Casper Network.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Blockchain**: Casper JS SDK
- **Icons**: Lucide React

## Features

### 🎨 Beautiful UI/UX
- Modern gradient design with dark mode
- Responsive layout for mobile, tablet, and desktop
- Smooth animations and transitions
- Glass morphism effects

### 📊 Markets Dashboard
- Real-time market overview
- Filter by category (Commodities, Equities, Crypto ETFs, etc.)
- Search functionality
- Sortable market data

### 💼 Portfolio Management
- View all active positions
- Real-time PnL tracking
- Position history
- Balance management

### 📈 Trading Interface
- Interactive price charts
- Long/Short position opening
- Adjustable leverage (1-10x)
- Liquidation price calculator
- Risk warnings

### 🔗 Wallet Integration
- Casper Signer wallet support
- Connect/disconnect functionality
- Balance display
- Transaction signing

## Getting Started

### Prerequisites

```bash
Node.js 18+
npm or yarn
Casper Signer browser extension
```

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Global styles
│   ├── markets/
│   │   ├── page.tsx        # Markets dashboard
│   │   └── [id]/
│   │       └── page.tsx    # Individual market trading page
│   └── portfolio/
│       └── page.tsx        # User portfolio
├── components/
│   ├── ui/
│   │   ├── Button.tsx      # Button component
│   │   └── Card.tsx        # Card component
│   ├── Navbar.tsx          # Navigation bar
│   ├── Footer.tsx          # Footer
│   ├── MarketOverview.tsx  # Markets grid
│   ├── PriceChart.tsx      # Price charts
│   └── OpenPositionModal.tsx # Position modal
├── lib/
│   ├── utils.ts            # Utility functions
│   └── hooks/
│       └── useWallet.ts    # Wallet state management
├── public/                 # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Key Pages

### Landing Page (`/`)
- Hero section with CTA
- Feature highlights
- How it works
- Market overview

### Markets Dashboard (`/markets`)
- All available markets
- Category filters
- Search functionality
- Quick trade access

### Market Detail (`/markets/[id]`)
- Live price chart
- Market statistics
- Long/Short trading panel
- Settlement countdown
- Position opening modal

### Portfolio (`/portfolio`)
- Active positions table
- PnL tracking
- Trading history
- Balance management
- Deposit/withdraw

## Casper Integration

### Wallet Connection

```typescript
import { useWallet } from '@/lib/hooks/useWallet'

function Component() {
  const { address, isConnected, connect, disconnect } = useWallet()

  return (
    <button onClick={connect}>
      {isConnected ? address : 'Connect Wallet'}
    </button>
  )
}
```

### Opening a Position

```typescript
// TODO: Implement actual contract calls
const openPosition = async () => {
  const deploy = await casperClient.makeDeploy({
    contractHash: POSITION_MANAGER_HASH,
    entryPoint: "open_position",
    args: {
      market_key: "gold_2024_11_17",
      side: 0, // 0 = Long, 1 = Short
      collateral: "100000000000", // 100 CSPR
      leverage: 10,
      entry_price: "2000000000"
    }
  })

  await deploy.send()
}
```

## Styling

### Custom Gradients

```css
.gradient-primary { /* Purple gradient */ }
.gradient-success { /* Green gradient */ }
.gradient-danger  { /* Red gradient */ }
```

### Utility Classes

```css
.glass           /* Glass morphism effect */
.pulse-glow      /* Pulsing glow animation */
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_CASPER_NETWORK=testnet
NEXT_PUBLIC_NODE_ADDRESS=http://18.144.176.168:7777
NEXT_PUBLIC_VAULT_HASH=hash-...
NEXT_PUBLIC_POSITION_MANAGER_HASH=hash-...
NEXT_PUBLIC_MARKET_FACTORY_HASH=hash-...
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## Responsive Design

- **Mobile**: Optimized for small screens (<768px)
- **Tablet**: Adapted layout (768px-1024px)
- **Desktop**: Full experience (>1024px)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires Casper Signer extension

## Performance Optimizations

- Next.js App Router for faster navigation
- Image optimization with next/image
- Code splitting and lazy loading
- Minimal bundle size
- Server-side rendering where beneficial

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs.rwperp.com](https://docs.rwperp.com)
- Discord: [discord.gg/rwperp](https://discord.gg/rwperp)
- Twitter: [@rwperp](https://twitter.com/rwperp)

---

Built with ❤️ on Casper Network
