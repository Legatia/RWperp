import { create } from 'zustand'

interface WalletState {
  address: string | null
  isConnected: boolean
  balance: bigint
  connect: () => Promise<void>
  disconnect: () => void
  updateBalance: (balance: bigint) => void
}

export const useWallet = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  balance: BigInt(0),

  connect: async () => {
    try {
      // Check if Casper Signer is installed
      if (typeof window === 'undefined' || !(window as any).CasperWalletProvider) {
        alert('Please install Casper Signer extension')
        return
      }

      const provider = (window as any).CasperWalletProvider()

      // Request connection
      const isConnected = await provider.requestConnection()

      if (isConnected) {
        const publicKey = await provider.getActivePublicKey()
        set({
          address: publicKey,
          isConnected: true
        })

        // Get balance (optional)
        // const balance = await getAccountBalance(publicKey)
        // set({ balance })
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  },

  disconnect: () => {
    try {
      if (typeof window !== 'undefined' && (window as any).CasperWalletProvider) {
        const provider = (window as any).CasperWalletProvider()
        provider.disconnectFromSite()
      }
      set({
        address: null,
        isConnected: false,
        balance: BigInt(0)
      })
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  },

  updateBalance: (balance: bigint) => {
    set({ balance })
  },
}))
