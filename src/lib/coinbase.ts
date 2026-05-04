import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'

// Base Sepolia testnet configuration
const chain = baseSepolia
const publicClient = createPublicClient({
  chain,
  transport: http(),
})

export interface WalletConnection {
  address: `0x${string}`
  balance: string // in ETH
  chainId: number
}

export interface TransactionResult {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  fee: string
  explorerUrl: string
  blockNumber?: bigint
}

// Connect a wallet using the provider from Coinbase Wallet SDK
export async function connectWallet(): Promise<WalletConnection> {
  // In browser, this uses the injected provider
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection requires browser environment')
  }

  const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
  if (!provider) {
    throw new Error('No wallet provider found. Install Coinbase Wallet or MetaMask.')
  }

  const accounts = await provider.request({
    method: 'eth_requestAccounts',
  }) as string[]

  const address = accounts[0] as `0x${string}`
  const balance = await publicClient.getBalance({ address })

  const chainId = await provider.request({
    method: 'eth_chainId',
  }) as string

  return {
    address,
    balance: formatEther(balance),
    chainId: parseInt(chainId, 16),
  }
}

// Send ETH on Base Sepolia testnet
export async function sendETH(
  toAddress: `0x${string}`,
  amount: string // in ETH
): Promise<TransactionResult> {
  if (typeof window === 'undefined') {
    throw new Error('Transaction requires browser environment')
  }

  const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
  if (!provider) {
    throw new Error('No wallet provider found')
  }

  const accounts = await provider.request({
    method: 'eth_requestAccounts',
  }) as string[]

  const fromAddress = accounts[0] as `0x${string}`
  const value = parseEther(amount)

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: fromAddress,
      to: toAddress,
      value: `0x${value.toString(16)}`,
      data: '0x',
    }],
  }) as string

  // Wait for transaction receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  })

  const fee = receipt.gasUsed * receipt.effectiveGasPrice

  return {
    txHash,
    fromAddress,
    toAddress,
    amount,
    fee: formatEther(fee),
    explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    blockNumber: receipt.blockNumber,
  }
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

// Get explorer URL for any transaction
export function getExplorerUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

export { chain, publicClient }