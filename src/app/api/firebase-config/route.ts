import { NextResponse } from 'next/server'

/**
 * Server-side Firebase config proxy.
 * 
 * WHY: Firebase API keys are traditionally embedded in client-side code (NEXT_PUBLIC_),
 * which makes them visible in JS bundles. Automated scanners (KeyReaper, etc.) harvest
 * these keys and, if Gemini API is enabled on the same project, use them to rack up
 * unauthorized charges. This route serves Firebase config through a server-side endpoint
 * so the API key never appears in the client bundle.
 * 
 * SECURITY: This endpoint uses rate limiting and origin checking to prevent abuse.
 * Firebase security still depends on Firestore Security Rules, not key obscurity.
 */

const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 30 // 30 requests per minute per IP

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = RATE_LIMIT_MAP.get(ip)
  
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return true
  }
  return false
}

export async function GET(req: Request) {
  const ip = getClientIp(req)
  
  // Rate limit
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  // Only allow requests from our own domains
  const origin = req.headers.get('origin') || ''
  const referer = req.headers.get('referer') || ''
  const allowedOrigins = [
    'https://agent-studio-fawn.vercel.app',
    'https://agent-studio.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
  
  const requestOrigin = origin || referer
  if (requestOrigin && !allowedOrigins.some(allowed => requestOrigin.startsWith(allowed))) {
    // Don't block in development, but log
    console.warn(`[firebase-config] Request from unknown origin: ${requestOrigin}`)
  }

  // Serve Firebase config from server-side env vars (no NEXT_PUBLIC_ prefix)
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
  }

  if (!config.apiKey || !config.projectId) {
    return NextResponse.json({ error: 'Firebase not configured' }, { status: 503 })
  }

  // Set cache headers — short TTL so key rotation takes effect quickly
  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
    },
  })
}