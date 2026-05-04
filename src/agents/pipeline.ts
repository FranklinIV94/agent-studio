// Agent Types
export interface AgentMessage {
  role: 'director' | 'quant' | 'risk' | 'execution'
  content: string
  timestamp: number
}

export interface AgentState {
  status: 'idle' | 'reasoning' | 'executing' | 'done' | 'error'
  messages: AgentMessage[]
  currentRole: string | null
  result: ExecutionResult | null
  error: string | null
}

export interface ExecutionResult {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: number
  fee: number
  explorerUrl: string
}

// Agent Pipeline
export class DirectorAgent {
  parseIntent(userInput: string): { action: string; params: Record<string, unknown> } {
    const lower = userInput.toLowerCase()
    
    if (lower.includes('send') || lower.includes('transfer') || lower.includes('pay')) {
      const amountMatch = userInput.match(/\$?(\d+(?:\.\d+)?)/)
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 50
      
      let toCountry = 'brazil'
      if (lower.includes('mexico')) toCountry = 'mexico'
      else if (lower.includes('philippines')) toCountry = 'philippines'
      else if (lower.includes('india')) toCountry = 'india'
      
      return {
        action: 'send_remittance',
        params: { amount, toCountry }
      }
    }
    
    if (lower.includes('swap') || lower.includes('exchange')) {
      const amountMatch = userInput.match(/\$?(\d+(?:\.\d+)?)/)
      return {
        action: 'swap',
        params: { 
          amount: amountMatch ? parseFloat(amountMatch[1]) : 100,
          from: 'usdc',
          to: 'xrp'
        }
      }
    }
    
    return { action: 'unknown', params: {} }
  }
}

export class QuantAgent {
  async analyze(params: Record<string, unknown>): Promise<{
    marketData: { price: number; depth: number; feeEstimate: number }
    recommendation: string
  }> {
    // In production: fetch real market data from XRPL DEX
    // For demo: simulate plausible market conditions
    return {
      marketData: {
        price: 2.45 + Math.random() * 0.1,
        depth: 150000,
        feeEstimate: 0.0012
      },
      recommendation: 'CONDITION_MET'
    }
  }
}

export class RiskAgent {
  validate(params: Record<string, unknown>, marketData: { feeEstimate: number }): {
    approved: boolean
    reasons: string[]
  } {
    const reasons: string[] = []
    
    if (marketData.feeEstimate > 1) {
      reasons.push(`Fee too high: $${marketData.feeEstimate}`)
    }
    
    const amount = (params.amount as number) || 0
    if (amount > 1000) {
      reasons.push('Amount exceeds safe threshold')
    }
    
    return {
      approved: reasons.length === 0,
      reasons
    }
  }
}

export class ExecutionAgent {
  async execute(params: Record<string, unknown>): Promise<ExecutionResult> {
    // This would call the actual XRPL function in production
    // For demo, we return a simulated result
    const mockHash = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    
    return {
      txHash: mockHash,
      fromAddress: 'rDemoWallet123456789',
      toAddress: `rRecipient_${(params.toCountry as string || 'unknown')}`,
      amount: (params.amount as number) || 50,
      fee: 0.0012,
      explorerUrl: `https://testnet.xrpl.org/transactions/${mockHash}`
    }
  }
}

// Pipeline Orchestrator
export class AgentPipeline {
  private director = new DirectorAgent()
  private quant = new QuantAgent()
  private risk = new RiskAgent()
  private execution = new ExecutionAgent()
  
  async run(
    userInput: string,
    onStep: (role: AgentMessage['role'], thought: string) => void
  ): Promise<ExecutionResult> {
    // Step 1: Director parses intent
    onStep('director', 'Parsing user intent...')
    const { action, params } = this.director.parseIntent(userInput)
    onStep('director', `Intent: ${action} with params ${JSON.stringify(params)}`)
    
    // Step 2: Quant analyzes market
    onStep('quant', 'Fetching market data...')
    const marketData = await this.quant.analyze(params)
    onStep('quant', `Price: $${marketData.marketData.price}, Depth: ${marketData.marketData.depth}`)
    
    // Step 3: Risk validates
    onStep('risk', 'Running risk checks...')
    const riskResult = this.risk.validate(params, marketData.marketData)
    if (!riskResult.approved) {
      onStep('risk', `BLOCKED: ${riskResult.reasons.join(', ')}`)
      throw new Error(`Risk check failed: ${riskResult.reasons.join(', ')}`)
    }
    onStep('risk', `Approved. Fee estimate: $${marketData.marketData.feeEstimate}`)
    
    // Step 4: Execute
    onStep('execution', 'Broadcasting transaction...')
    const result = await this.execution.execute(params)
    onStep('execution', `Confirmed! Tx: ${result.txHash.slice(0, 8)}...`)
    
    return result
  }
}
