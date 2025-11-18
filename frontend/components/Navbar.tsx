'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Wallet } from 'lucide-react'
import { Button } from './ui/Button'
import { useWallet } from '@/lib/hooks/useWallet'
import { truncateAddress } from '@/lib/utils'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { address, isConnected, connect, disconnect } = useWallet()

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
              RWperp
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/markets"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Daily Markets
            </Link>
            <Link
              href="/perps"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Perpetuals
            </Link>
            <Link
              href="/portfolio"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
          </div>

          {/* Wallet Connect */}
          <div className="hidden md:block">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-md bg-muted text-sm font-mono">
                  {truncateAddress(address!)}
                </div>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={connect} className="gradient-primary text-white">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link
              href="/markets"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Daily Markets
            </Link>
            <Link
              href="/perps"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Perpetuals
            </Link>
            <Link
              href="/portfolio"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Portfolio
            </Link>
            <Link
              href="/docs"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Docs
            </Link>
            <div className="pt-4 border-t">
              {isConnected ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-md bg-muted text-sm font-mono">
                    {truncateAddress(address!)}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={disconnect}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button onClick={connect} className="w-full gradient-primary text-white">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
