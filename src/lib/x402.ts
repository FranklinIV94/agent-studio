/**
 * x402 Payment Protocol Integration for Agent Studio
 * 
 * Implements the x402 protocol (HTTP 402 Payment Required) for agentic commerce on Base.
 * 
 * Flow:
 * 1. Agent requests data from x402-enabled endpoint
 * 2. Server responds with HTTP 402 + x402 payment headers (amount, recipient, network)
 * 3. Agent evaluates cost, signs USDC payment on Base
 * 4. Agent retries request with X-PAYMENT header containing payment proof
 * 5. Server verifies payment via facilitator, delivers content
 * 
 * Reference: https://github.com/coinbase/x402
 * AWS Reference: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
 */

import { parseUnits, formatUnits } from 'viem'

// ─── Configuration ─────────────────────────────────────────────────────

export const X402_CONFIG = {
  /** Base Sepolia USDC contract */
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`, // Base Sepolia USDC
  /** Payment recipient (our demo treasury) */
  recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38' as `0x${string}`,
  /** x402 facilitator URL — AWS Lambda */
  facilitatorUrl: process.env.NEXT_PUBLIC_AWS_API_URL
    ? `${process.env.NEXT_PUBLIC_AWS_API_URL}/v1/x402/initiate`
    : 'https://x402.org/facilitate',
  /** AWS Bedrock evaluation URL */
  bedrockEvaluateUrl: process.env.NEXT_PUBLIC_BEDROCK_EVALUATE_URL || '',
  /** AWS Bedrock discovery URL */
  bedrockDiscoverUrl: process.env.NEXT_PUBLIC_BEDROCK_DISCOVER_URL || '',
  /** AWS x402 services URL */
  awsServicesUrl: process.env.NEXT_PUBLIC_X402_AWS_SERVICES_URL || '',
  /** Network identifier */
  network: 'base-sepolia',
  /** Default price per data request (in USDC, 6 decimals) */
  defaultPrice: '0.01',
  /** Max payment amount an agent will auto-approve (in USDC) */
  maxAutoApprove: '1.00',
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface X402PaymentRequirement {
  /** Payment amount in USDC */
  amount: string
  /** Recipient wallet address */
  recipient: string
  /** USDC contract address */
  resource: string
  /** Network for settlement */
  network: string
  /** Facilitator URL for payment verification */
  facilitatorUrl: string
  /** Description of what's being purchased */
  description: string
}

export interface X402Payment {
  /** EIP-3009 authorization signature */
  signature: string
  /** Payment amount (USDC with 6 decimals) */
  amount: string
  /** Recipient address */
  recipient: string
  /** USDC contract address */
  tokenAddress: string
  /** Payer address */
  payer: string
  /** Network */
  network: string
  /** Block number for verification */
  blockNumber?: number
}

export interface X402ChallengeResponse {
  status: 402
  paymentRequired: X402PaymentRequirement
  /** X-PAYMENT header value for retry */
  xPaymentHeader: string
}

export interface X402DataResponse<T> {
  status: 200
  data: T
  payment: {
    amount: string
    txHash?: string
    network: string
  }
}

// ─── x402 Server Side (Payment-Gated Content Provider) ─────────────────

/**
 * Create a 402 payment challenge response
 * This is what the server returns when an agent requests paid content
 */
export function create402Challenge(options: {
  amount?: string
  description: string
  resource?: string
}): X402ChallengeResponse {
  const amount = options.amount || X402_CONFIG.defaultPrice
  const resource = options.resource || X402_CONFIG.usdcAddress

  const paymentRequired: X402PaymentRequirement = {
    amount,
    recipient: X402_CONFIG.recipientAddress,
    resource,
    network: X402_CONFIG.network,
    facilitatorUrl: X402_CONFIG.facilitatorUrl,
    description: options.description,
  }

  // x402 header format: amount,recipient,resource,network,facilitatorUrl
  const xPaymentHeader = [
    `amount=${amount}`,
    `recipient=${paymentRequired.recipient}`,
    `resource=${resource}`,
    `network=${X402_CONFIG.network}`,
    `facilitator=${X402_CONFIG.facilitatorUrl}`,
  ].join(',')

  return {
    status: 402,
    paymentRequired,
    xPaymentHeader,
  }
}

/**
 * Verify an x402 payment proof
 * In production, this calls the facilitator. For hackathon, we verify the structure.
 */
export async function verifyX402Payment(payment: X402Payment): Promise<{
  valid: boolean
  error?: string
  txHash?: string
}> {
  // Basic structural validation
  if (!payment.signature || !payment.amount || !payment.recipient || !payment.payer) {
    return { valid: false, error: 'Missing required payment fields' }
  }

  // Check amount is within expected range
  const amountNum = parseFloat(payment.amount)
  if (isNaN(amountNum) || amountNum <= 0) {
    return { valid: false, error: 'Invalid payment amount' }
  }

  // In production: call facilitator to verify on-chain
  // const response = await fetch(`${X402_CONFIG.facilitatorUrl}/verify`, { ... })
  
  // Hackathon: simulate verification
  return {
    valid: true,
    txHash: `0x${Date.now().toString(16)}${payment.payer.slice(2, 10)}`,
  }
}

// ─── x402 Client Side (Agent Payment Handler) ──────────────────────────

/**
 * Agent evaluates a 402 challenge and decides whether to pay
 */
export function evaluate402Challenge(challenge: X402PaymentRequirement): {
  shouldPay: boolean
  reason: string
} {
  const amount = parseFloat(challenge.amount)
  const maxAuto = parseFloat(X402_CONFIG.maxAutoApprove)

  if (amount <= 0) {
    return { shouldPay: false, reason: 'Invalid amount: zero or negative' }
  }

  if (amount > maxAuto) {
    return { 
      shouldPay: false, 
      reason: `Amount $${amount} exceeds auto-approve limit of $${maxAuto}. Requires human approval.` 
    }
  }

  return {
    shouldPay: true,
    reason: `Payment of $${amount} USDC for "${challenge.description}" within auto-approve limit. Proceeding.`,
  }
}

/**
 * Create an x402 payment authorization
 * In production: uses EIP-3009 (USDC authorize function) with wallet signature
 * For hackathon: generates a mock payment proof
 */
export async function createX402Payment(options: {
  challenge: X402PaymentRequirement
  payerAddress: string
  walletClient?: unknown // wagmi wallet client for real signing
}): Promise<X402Payment> {
  const { challenge, payerAddress } = options

  // In production with real wallet:
  // 1. Call USDC.approve() or use EIP-3009 transferWithAuthorization()
  // 2. Get tx hash from Base Sepolia
  // 3. Return payment proof with signature

  // Hackathon: simulate payment
  const mockSignature = `0x${Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}`

  return {
    signature: mockSignature,
    amount: challenge.amount,
    recipient: challenge.recipient,
    tokenAddress: X402_CONFIG.usdcAddress,
    payer: payerAddress,
    network: X402_CONFIG.network,
  }
}

/**
 * Build X-PAYMENT header value for retry request
 */
export function buildPaymentHeader(payment: X402Payment): string {
  return Buffer.from(JSON.stringify({
    signature: payment.signature,
    amount: payment.amount,
    recipient: payment.recipient,
    tokenAddress: payment.tokenAddress,
    payer: payment.payer,
    network: payment.network,
  })).toString('base64')
}

/**
 * Parse X-PAYMENT header from incoming request
 */
export function parsePaymentHeader(header: string): X402Payment | null {
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString())
    return {
      signature: decoded.signature,
      amount: decoded.amount,
      recipient: decoded.recipient,
      tokenAddress: decoded.tokenAddress,
      payer: decoded.payer,
      network: decoded.network,
    }
  } catch {
    return null
  }
}

// ─── x402 Data Services (Paid Content Endpoints) ──────────────────────

export interface DataService {
  id: string
  name: string
  description: string
  price: string
  category: 'market-data' | 'compliance' | 'credit' | 'insurance'
  endpoint: string
}

/** Available x402-enabled data services (FSI use cases from AWS blog) */
export const X402_DATA_SERVICES: DataService[] = [
  {
    id: 'market-feed',
    name: 'Real-Time Market Data',
    description: 'Token prices, volume, and liquidity data for DeFi trading agents',
    price: '0.01',
    category: 'market-data',
    endpoint: '/api/x402/data/market-feed',
  },
  {
    id: 'sanctions-screen',
    name: 'Sanctions Screening',
    description: 'OFAC/PEP screening for compliance agents — per-query access',
    price: '0.05',
    category: 'compliance',
    endpoint: '/api/x402/data/sanctions-screen',
  },
  {
    id: 'credit-bureau',
    name: 'Credit Bureau Query',
    description: 'Single credit bureau pull for lending/credit decisioning agents',
    price: '0.10',
    category: 'credit',
    endpoint: '/api/x402/data/credit-bureau',
  },
  {
    id: 'risk-signal',
    name: 'Fraud Risk Signal',
    description: 'Real-time fraud probability score for transaction monitoring agents',
    price: '0.02',
    category: 'insurance',
    endpoint: '/api/x402/data/risk-signal',
  },
  {
    id: 'fx-rates',
    name: 'FX Rate Snapshot',
    description: 'Current foreign exchange rates for treasury/remittance agents',
    price: '0.01',
    category: 'market-data',
    endpoint: '/api/x402/data/fx-rates',
  },
]

/** Generate mock data for a paid service */
export function generateServiceData(serviceId: string): Record<string, unknown> {
  switch (serviceId) {
    case 'market-feed':
      return {
        timestamp: Date.now(),
        tokens: [
          { symbol: 'ETH', price: 3842.50 + Math.random() * 100, volume24h: 12.4e9 },
          { symbol: 'USDC', price: 1.0001, volume24h: 8.2e9 },
          { symbol: 'BTC', price: 94250 + Math.random() * 500, volume24h: 28.1e9 },
        ],
      }
    case 'sanctions-screen':
      return {
        screeningId: `SCR-${Date.now()}`,
        result: 'CLEAR',
        checkedAgainst: ['OFAC-SDN', 'EU-Sanctions', 'UK-HMT', 'UN-Security-Council'],
        timestamp: Date.now(),
      }
    case 'credit-bureau':
      return {
        inquiryId: `CBQ-${Date.now()}`,
        score: 720 + Math.floor(Math.random() * 50),
        factors: ['payment-history:good', 'utilization:low', 'inquiries:few'],
        timestamp: Date.now(),
      }
    case 'risk-signal':
      return {
        signalId: `RSK-${Date.now()}`,
        fraudProbability: (Math.random() * 0.05).toFixed(4),
        riskLevel: 'LOW',
        indicators: ['ip-velocity:normal', 'device-fingerprint:trusted'],
        timestamp: Date.now(),
      }
    case 'fx-rates':
      return {
        baseCurrency: 'USD',
        rates: {
          BRL: 5.12 + Math.random() * 0.1,
          MXN: 17.85 + Math.random() * 0.2,
          PHP: 56.40 + Math.random() * 0.3,
          INR: 83.50 + Math.random() * 0.2,
        },
        timestamp: Date.now(),
      }
    default:
      return { error: 'Unknown service', serviceId }
  }
}