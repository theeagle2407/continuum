/// <reference types="vite/client" />

import type { Transaction } from '@solana/web3.js'

declare global {
  interface Window {
    solana?: SolanaProvider
    phantom?: { solana?: SolanaProvider }
    solflare?: SolanaProvider
  }
}

export interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }

  connect(options?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string }
  }>

  disconnect(): Promise<void>

  signAndSendTransaction(transaction: Transaction): Promise<{
    signature: string
  }>

  on?(event: string, callback: (...args: unknown[]) => void): void
  removeListener?(event: string, callback: (...args: unknown[]) => void): void
}

export {}
