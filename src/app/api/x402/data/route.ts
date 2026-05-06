import type { NextRequest } from 'next/server'
import { 
  X402_CONFIG, 
  parsePaymentHeader, 
  verifyX402Payment, 
  generateServiceData,
  type X402ChallengeResponse 
} from '@/lib/x402'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * x402 Data Service Endpoint — Payment-gated content delivery
 * 
 * Flow:
 * 1. Agent requests data (no payment header)
 * 2. Server returns 402 + x402 payment specification
 * 3. Agent pays and retries with X-PAYMENT header
 * 4. Server verifies payment, delivers content
 * 
 * Reference: https://github.com/coinbase/x402
 * AWS Reference: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
 */
export async function GET(req: NextRequest) {
  const serviceId = req.nextUrl.searchParams.get('service')

  if (!serviceId) {
    return Response.json({
      services: X402_DATA_SERVICES,
      protocol: 'x402',
      version: '1.0',
    })
  }

  const service = X402_DATA_SERVICES.find(s => s.id === serviceId)
  if (!service) {
    return Response.json({ error: 'Unknown service', availableServices: X402_DATA_SERVICES.map(s => s.id) }, { status: 404 })
  }

  // Check for X-PAYMENT header (payment proof)
  const paymentHeader = req.headers.get('X-PAYMENT')

  if (!paymentHeader) {
    // Step 1: Return 402 Payment Required with payment specification
    const challenge = create402Challenge({
      amount: service.price,
      description: service.description,
    })

    return new Response(
      JSON.stringify({
        status: 402,
        error: 'Payment Required',
        payment: challenge.paymentRequired,
        message: `Access to "${service.name}" requires ${service.price} USDC on ${X402_CONFIG.network}`,
      }),
      {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-REQUIRED': challenge.xPaymentHeader,
          'X-402-VERSION': '1',
          'X-402-RECIPIENT': challenge.paymentRequired.recipient,
          'X-402-AMOUNT': challenge.paymentRequired.amount,
          'X-402-NETWORK': challenge.paymentRequired.network,
          'X-402-FACILITATOR': challenge.paymentRequired.facilitatorUrl,
        },
      }
    )
  }

  // Step 2: Verify payment proof
  const payment = parsePaymentHeader(paymentHeader)
  if (!payment) {
    return Response.json({ error: 'Invalid payment header format' }, { status: 400 })
  }

  const verification = await verifyX402Payment(payment)
  if (!verification.valid) {
    return Response.json({ error: verification.error || 'Payment verification failed' }, { status: 402 })
  }

  // Step 3: Payment verified — deliver content
  const data = generateServiceData(serviceId)

  return Response.json({
    status: 200,
    service: service.name,
    serviceId: service.id,
    data,
    payment: {
      amount: payment.amount,
      recipient: payment.recipient,
      network: payment.network,
      txHash: verification.txHash,
    },
    timestamp: Date.now(),
  })
}

export { X402_DATA_SERVICES }
import { create402Challenge, X402_DATA_SERVICES } from '@/lib/x402'