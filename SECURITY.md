# Security Incident — May 25, 2026

## What Happened
Google Cloud project `gen-lang-client-0002947545` ("Default Gemini Project") was suspended for credential hijacking. A Firebase API key (`AIzaSyADJGjYY...`) was exposed in the client-side JS bundle via `NEXT_PUBLIC_FIREBASE_API_KEY`. When Gemini API was enabled on the same project, the key silently gained Gemini access. Automated scanners harvested it from the Vercel deployment.

## Fix Applied
- Removed `NEXT_PUBLIC_` prefix from all Firebase env vars in `.env.local`
- Created `/api/firebase-config` server-side API route to serve Firebase config
- Updated `firebase.ts` to fetch config from API route instead of embedding in client bundle
- Firebase config is now served with rate limiting (30 req/min/IP), origin checking, and short cache TTL
- Added clear warning comments in `.env.local` about never using `NEXT_PUBLIC_` for API keys

## Rules Going Forward
1. **NEVER** use `NEXT_PUBLIC_` prefix for any key that bills per usage (Gemini, OpenAI, AWS, etc.)
2. **NEVER** use `NEXT_PUBLIC_` for Firebase API keys — use the `/api/firebase-config` proxy instead
3. Contract addresses and public endpoints (x402, AWS API Gateway URLs) are safe to expose
4. All billing-sensitive keys must go through server-side API routes
5. Set billing caps ($50) on all Google Cloud projects with automatic disable

## References
- Truffle Security disclosure (Feb 2026): 2,863 keys with silent Gemini access
- CloudSEK research (Apr 2026): 32 keys across 22 apps with 500M+ installs
- Appeal letter: `Prospyr/GCP-Suspension-Appeal-2026-05-25.md`