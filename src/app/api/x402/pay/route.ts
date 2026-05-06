import type { NextRequest } from 'next/server'
import {
  evaluate402Challenge,
  createX402Payment,
  buildPaymentHeader,
  X402_CONFIG,
  type X402PaymentRequirement,
} from '@/lib/x402'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * x402 Agent Payment Handler
 * 
 * Called by the pipeline when an agent encounters a 402 challenge.
 * Evaluates the payment requirement, creates a payment, and returns
 * the X-PAYMENT header for retry.
 * 
 * In production: uses EIP-3009 (USDC transferWithAuthorization) with wallet signature
 * In hackathon: simulates the payment flow
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { challenge, payerAddress } = body as {
      challenge: X402PaymentRequirement
      payerAddress: string
    }

    if (!challenge || !payerAddress) {
      return Response.json({ error: 'Missing challenge or payerAddress' }, { status: 400 })
    }

    // Step 1: Agent evaluates whether to pay
    const evaluation = evaluate402Challenge(challenge)

    if (!evaluation.shouldPay) {
      return Response.json({
        status: 'rejected',
        reason: evaluation.reason,
        challenge,
      })
    }

    // Step 2: Agent creates payment (EIP-3009 in production)
    const payment = await createX402Payment({
      challenge,
      payerAddress,
    })

    // Step 3: Build X-PAYMENT header for retry
    const paymentHeader = buildPaymentHeader(payment)

    return Response.json({
      status: 'approved',
      evaluation: evaluation.reason,
      payment: {
        amount: payment.amount,
        recipient: payment.recipient,
        network: payment.network,
        payer: payment.payer,
      },
      xPaymentHeader: paymentHeader,
      // The agent now retries the original request with this header
      retryHeaders: {
        'X-PAYMENT': paymentHeader,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment handler failed'
    return Response.json({ error: message }, { status: 500 })
  }
}