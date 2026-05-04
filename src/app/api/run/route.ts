import type { NextRequest } from 'next/server'
import { directorParse, quantAnalyze, riskValidate } from '@/agents/pipeline'
import type { AgentMessage } from '@/agents/pipeline'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { input } = body

    if (!input || typeof input !== 'string') {
      return Response.json({ error: 'Missing or invalid input' }, { status: 400 })
    }

    const steps: AgentMessage[] = []

    // Step 1: Director parses intent
    steps.push({ role: 'director', content: 'Parsing user intent with AI reasoning...', timestamp: Date.now() })
    const { action, params, reasoning: directorReasoning } = await directorParse(input)
    steps.push({ role: 'director', content: directorReasoning, timestamp: Date.now() })

    if (action === 'unknown') {
      return Response.json({
        success: false,
        steps,
        error: `Could not understand: "${input}". Try "Send 0.001 ETH to Brazil" or "Check my balance".`,
      })
    }

    // Step 2: Quant analyzes market
    steps.push({ role: 'quant', content: 'Analyzing Base network conditions...', timestamp: Date.now() })
    const analysis = await quantAnalyze(params)
    steps.push({ role: 'quant', content: analysis.reasoning, timestamp: Date.now() })

    // Step 3: Risk validates
    steps.push({ role: 'risk', content: 'Running risk assessment...', timestamp: Date.now() })
    const riskResult = await riskValidate(params, analysis)
    if (!riskResult.approved) {
      steps.push({ role: 'risk', content: `BLOCKED: ${riskResult.reasoning}`, timestamp: Date.now() })
      return Response.json({ success: false, steps, riskChecks: riskResult.checks })
    }
    steps.push({ role: 'risk', content: riskResult.reasoning, timestamp: Date.now() })

    // Step 4: Execution params ready — client will handle wallet signing
    steps.push({
      role: 'execution',
      content: `Ready: ${(params.amount as number) || 0.001} ETH → ${(params.toAddress as string)?.slice(0, 10)}…`,
      timestamp: Date.now(),
    })

    return Response.json({
      success: true,
      steps,
      action,
      params,
      analysis,
      riskChecks: riskResult.checks,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline failed'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}