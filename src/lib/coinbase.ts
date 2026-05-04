import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { coinbaseWallet } from 'wagmi/connectors'

// Base Sepolia configuration
export const chain = baseSepolia

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

// Pre-funded demo wallet for hackathon demo
// This wallet has testnet ETH for live demos even without user wallet
export const DEMO_WALLET = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38' as `0x${string}`,
  label: 'Demo Recipient (Brazil)',
}

// Demo addresses by region for remittance routing
export const DEMO_ADDRESSES: Record<string, { address: `0x${string}`; label: string }> = {
  brazil: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', label: 'Brazil' },
  mexico: { address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', label: 'Mexico' },
  philippines: { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', label: 'Philippines' },
  india: { address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', label: 'India' },
}

export interface TransactionResult {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  fee: string
  explorerUrl: string
  blockNumber?: number
}

// Get explorer URL for any transaction
export function getExplorerUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

// Get account info
export async function getAccountInfo(address: string): Promise<{
  balance: string
  txCount: number
}> {
  const balance = await publicClient.getBalance({
    address: address as `0x${string}`,
  })
  const txCount = await publicClient.getTransactionCount({
    address: address as `0x${string}`,
  })
  return {
    balance: formatEther(balance),
    txCount,
  }
}