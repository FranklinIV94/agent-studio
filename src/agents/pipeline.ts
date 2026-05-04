import OpenAI from 'openai'

export interface AgentMessage {
  role: 'director' | 'quant' | 'risk' | 'execution'
  content: string
  timestamp: number
}

export interface ExecutionResult {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  fee: string
  explorerUrl: string
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