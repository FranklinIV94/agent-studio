import type { NextRequest } from 'next/server'
import { AgentPipeline } from '@/agents/pipeline'

export const runtime = 'edge'

const pipeline = new AgentPipeline()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { input, userId } = body

    if (!input || typeof input !== 'string') {
      return Response.json({ error: 'Missing or invalid input' }, { status: 400 })
    }

    // Collect all pipeline steps
    const steps: { role: string; content: string }[] = []

    const result = await pipeline.run(input, (role, content) => {
      steps.push({ role, content })
    })

    return Response.json({
      success: true,
      steps,
      result,
      userId: userId || 'anonymous',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline failed'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}