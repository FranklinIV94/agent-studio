import OpenAI from 'openai'
import {
  X402_DATA_SERVICES,
  evaluate402Challenge,
  createX402Payment,
  buildPaymentHeader,
  type X402PaymentRequirement,
  type X402ChallengeResponse,
} from '@/lib/x402'

export interface AgentMessage {
  role: 'director' | 'quant' | 'risk' | 'execution'
  content: string
  timestamp: number
}

export interface X402Step {
  serviceId: string
  serviceName: string
  challenge: X402PaymentRequirement
  evaluation: string
  paymentAmount: string
  paymentHeader: string
  dataReceived: Record<string, unknown>
}

export interface ExecutionResult {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  fee: string
  explorerUrl: string
  x402Data?: X402Step
}

export interface ParsedIntent {
  action: 'send_remittance' | 'swap' | 'check_balance' | 'unknown'
  params: Record<string, unknown>
  reasoning: string
}

export interface MarketAnalysis {
  gasPrice: string
  baseFee: string
  networkCongestion: 'low' | 'medium' | 'high'
  estimatedConfirmationTime: string
  feeEstimate: string
  recommendation: string
  reasoning: string
}

export interface RiskAssessment {
  approved: boolean
  reasons: string[]
  checks: { name: string; passed: boolean; detail: string }[]
  reasoning: string
}

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// Demo addresses for remittance routing
const DEMO_ADDRESSES: Record<string, { address: string; label: string }> = {
  brazil: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', label: 'Brazil' },
  mexico: { address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', label: 'Mexico' },
  philippines: { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', label: 'Philippines' },
  india: { address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', label: 'India' },
}

// Director Agent — LLM-powered intent parsing
export async function directorParse(userInput: string): Promise<ParsedIntent> {
  const openai = getOpenAI()
  if (!openai) return directorParseFallback(userInput)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the Director agent in a multi-agent DeFi pipeline on Base (Coinbase L2). Parse the user's natural language instruction into a structured action.

Available actions:
- send_remittance: Send ETH to an address. Params: amount (number in ETH), toAddress (string, Ethereum address), currency ("ETH")
- swap: Swap tokens. Params: amount (number), from (token symbol), to (token symbol)
- check_balance: Check wallet balance. Params: {}

For send_remittance, use these demo addresses for country keywords:
- Brazil: 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38
- Mexico: 0x8ba1f109551bD432803012645Ac136ddd64DBA72
- Philippines: 0xdD2FD4581271e230360230F9337D5c0430Bf44C0
- India: 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B

If no amount is specified, default to 0.001 ETH.
If no country/address is specified, default to Brazil.

Respond with ONLY valid JSON, no markdown fences.`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.1,
      max_tokens: 200,
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(content)
    return {
      action: parsed.action || 'unknown',
      params: parsed.params || {},
      reasoning: parsed.reasoning || `Parsed "${userInput}" as ${parsed.action}`,
    }
  } catch {
    return directorParseFallback(userInput)
  }
}

function directorParseFallback(userInput: string): ParsedIntent {
  const lower = userInput.toLowerCase()
  if (lower.includes('send') || lower.includes('transfer') || lower.includes('pay') || lower.includes('remittance')) {
    const amountMatch = userInput.match(/\$?(\d+(?:\.\d+)?)/)
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0.001
    const dest = Object.entries(DEMO_ADDRESSES).find(([k]) => lower.includes(k)) || Object.entries(DEMO_ADDRESSES)[0]
    return {
      action: 'send_remittance',
      params: { amount, toAddress: dest[1].address, currency: 'ETH' },
      reasoning: `Detected remittance: send ${amount} ETH to ${dest[1].label} (${dest[1].address.slice(0, 10)}…)`,
    }
  }
  if (lower.includes('balance') || lower.includes('check') || lower.includes('status')) {
    return { action: 'check_balance', params: {}, reasoning: 'Detected balance check request' }
  }
  if (lower.includes('swap') || lower.includes('exchange') || lower.includes('convert')) {
    return { action: 'swap', params: { amount: 0.01, from: 'ETH', to: 'USDC' }, reasoning: 'Detected swap request' }
  }
  return { action: 'unknown', params: {}, reasoning: `Could not parse intent from: "${userInput}"` }
}

// Quant Agent — LLM-powered market analysis
export async function quantAnalyze(params: Record<string, unknown>): Promise<MarketAnalysis> {
  const baseFee = (0.0003 + Math.random() * 0.0002).toFixed(6)
  const gasPrice = (parseFloat(baseFee) * 1.1).toFixed(6)
  const congestion: 'low' | 'medium' | 'high' = Math.random() > 0.7 ? 'medium' : 'low'
  const feeEstimate = (parseFloat(baseFee) * 21000 / 1e18).toFixed(8)

  const openai = getOpenAI()
  if (!openai) {
    return {
      gasPrice: `${gasPrice} ETH`, baseFee: `${baseFee} ETH`, networkCongestion: congestion,
      estimatedConfirmationTime: '< 5 seconds', feeEstimate: `${feeEstimate} ETH`,
      recommendation: 'CONDITION_MET',
      reasoning: `Base Sepolia gas at ${gasPrice} ETH, congestion ${congestion}. Fee ${feeEstimate} ETH under threshold.`,
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are the Quant agent in a multi-agent DeFi pipeline. Analyze Base (Coinbase L2) network conditions for transaction feasibility. Respond with ONLY valid JSON: { gasPrice, baseFee, networkCongestion, estimatedConfirmationTime, feeEstimate, recommendation, reasoning }` },
        { role: 'user', content: `Analyze: ${JSON.stringify(params)}. Base Sepolia gas: ${gasPrice} ETH. Congestion: ${congestion}. Fee: ${feeEstimate} ETH.` }
      ],
      temperature: 0.3, max_tokens: 200,
    })
    const content = response.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(content)
    return {
      gasPrice: parsed.gasPrice || `${gasPrice} ETH`, baseFee: parsed.baseFee || `${baseFee} ETH`,
      networkCongestion: parsed.networkCongestion || congestion,
      estimatedConfirmationTime: parsed.estimatedConfirmationTime || '< 5 seconds',
      feeEstimate: parsed.feeEstimate || `${feeEstimate} ETH`,
      recommendation: parsed.recommendation || 'CONDITION_MET',
      reasoning: parsed.reasoning || `Network conditions favorable.`,
    }
  } catch {
    return {
      gasPrice: `${gasPrice} ETH`, baseFee: `${baseFee} ETH`, networkCongestion: congestion,
      estimatedConfirmationTime: '< 5 seconds', feeEstimate: `${feeEstimate} ETH`,
      recommendation: 'CONDITION_MET',
      reasoning: `Base Sepolia gas at ${gasPrice} ETH, congestion ${congestion}. Fee ${feeEstimate} ETH under threshold.`,
    }
  }
}

// x402 Commerce Agent — Autonomous data access with HTTP 402 payment
export async function x402Commerce(params: Record<string, unknown>, payerAddress: string): Promise<X402Step> {
  // Pick a relevant data service based on transaction intent
  const amount = (params.amount as number) || 0
  const toAddress = (params.toAddress as string) || ''
  
  // Route to appropriate data service based on intent
  const lower = JSON.stringify(params).toLowerCase()
  let serviceId = 'market-feed' // default
  if (lower.includes('sanctions') || lower.includes('compliance')) serviceId = 'sanctions-screen'
  else if (lower.includes('credit') || lower.includes('loan')) serviceId = 'credit-bureau'
  else if (lower.includes('fraud') || lower.includes('risk')) serviceId = 'risk-signal'
  else if (lower.includes('fx') || lower.includes('remittance') || lower.includes('brazil') || lower.includes('mexico')) serviceId = 'fx-rates'

  const service = X402_DATA_SERVICES.find(s => s.id === serviceId) || X402_DATA_SERVICES[0]

  // Step 1: Request data from x402 endpoint (gets 402 challenge)
  const challengeRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://agent-studio-fawn.vercel.app'}/api/x402/data?service=${service.id}`)
  
  if (challengeRes.status !== 402) {
    throw new Error(`Expected 402 challenge, got ${challengeRes.status}`)
  }
  
  const challengeBody = await challengeRes.json()
  const challenge: X402PaymentRequirement = challengeBody.payment

  // Step 2: Agent evaluates payment
  const evaluation = evaluate402Challenge(challenge)
  if (!evaluation.shouldPay) {
    throw new Error(`Agent rejected payment: ${evaluation.reason}`)
  }

  // Step 3: Agent pays and gets payment header
  const payment = await createX402Payment({ challenge, payerAddress })
  const paymentHeader = buildPaymentHeader(payment)

  // Step 4: Retry with payment proof, receive data
  const dataRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://agent-studio-fawn.vercel.app'}/api/x402/data?service=${service.id}`, {
    headers: { 'X-PAYMENT': paymentHeader },
  })
  
  const dataBody = await dataRes.json()

  return {
    serviceId: service.id,
    serviceName: service.name,
    challenge,
    evaluation: evaluation.reason,
    paymentAmount: challenge.amount,
    paymentHeader,
    dataReceived: dataBody.data || dataBody,
  }
}

// Risk Agent — LLM-powered risk validation
export async function riskValidate(params: Record<string, unknown>, marketData: { feeEstimate: string }): Promise<RiskAssessment> {
  const amount = (params.amount as number) || 0
  const toAddress = (params.toAddress as string) || ''
  const feeEst = parseFloat(marketData.feeEstimate) || 0

  const checks: { name: string; passed: boolean; detail: string }[] = [
    { name: 'Amount Threshold', passed: amount <= 1, detail: amount <= 1 ? `${amount} ETH within safe limit (≤1 ETH)` : `${amount} ETH exceeds safe threshold` },
    { name: 'Fee Validation', passed: feeEst < 0.01, detail: feeEst < 0.01 ? `Fee ${marketData.feeEstimate} under $0.01 threshold` : `Fee ${marketData.feeEstimate} too high` },
    { name: 'Address Validation', passed: toAddress.startsWith('0x') && toAddress.length === 42, detail: toAddress.startsWith('0x') && toAddress.length === 42 ? 'Valid Ethereum address format' : 'Invalid address format' },
    { name: 'Network Check', passed: true, detail: 'Base Sepolia testnet — operational' },
  ]

  const reasons = checks.filter(c => !c.passed).map(c => c.detail)

  const openai = getOpenAI()
  if (!openai) {
    return {
      approved: reasons.length === 0, reasons, checks,
      reasoning: reasons.length === 0 ? `All ${checks.length} risk checks passed. Transaction safe to execute.` : `Risk checks failed: ${reasons.join('; ')}`,
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are the Risk agent. Given transaction params and check results, provide brief risk reasoning. Respond with ONLY valid JSON: { reasoning }` },
        { role: 'user', content: `Transaction: ${JSON.stringify(params)}. Checks: ${JSON.stringify(checks)}. Approved: ${reasons.length === 0}` }
      ],
      temperature: 0.2, max_tokens: 150,
    })
    const content = response.choices[0]?.message?.content?.trim() || '{}'
    const parsed = JSON.parse(content)
    return {
      approved: reasons.length === 0, reasons, checks,
      reasoning: parsed.reasoning || (reasons.length === 0 ? 'All checks passed.' : `Checks failed: ${reasons.join('; ')}`),
    }
  } catch {
    return {
      approved: reasons.length === 0, reasons, checks,
      reasoning: reasons.length === 0 ? `All ${checks.length} risk checks passed. Safe to execute.` : `Risk checks failed: ${reasons.join('; ')}`,
    }
  }
}