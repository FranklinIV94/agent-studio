# Agent Studio — Agentic Finance on Base

> Multi-agent AI pipeline for autonomous commerce. Director parses intent, Quant analyzes markets, Risk validates via AWS Bedrock Nova Pro, Execution settles x402 payments on Base.

**Live:** [agent-studio-fawn.vercel.app](https://agent-studio-fawn.vercel.app)

## Overview

Agent Studio is a multi-agent AI pipeline that reasons, acts, and shows its work. Each agent thinks out loud with LLM reasoning, validates conditions, and executes real transactions on Base via Coinbase Smart Wallet.

Built for the **Coinbase + AWS Agentic Track** at Consensus 2026 Miami.

## How It Works

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Director  │───▶│  Quant   │───▶│   Risk   │───▶│Execution │
│  (LLM)   │    │ (Market) │    │(Bedrock) │    │  (x402)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
  Parses intent  Analyzes markets  Validates risk  Settles payment
  with reasoning  on Base Sepolia  via Nova Pro    on Base Sepolia
```

1. **Director** — Parses user intent with LLM reasoning
2. **Quant** — Analyzes market conditions on Base
3. **Risk** — Validates via AWS Bedrock Nova Pro
4. **Execution** — Settles x402 payments on-chain

## Architecture

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS
- **Animations:** Framer Motion (spring physics, AnimatePresence)
- **Wallet:** Coinbase Smart Wallet via Wagmi + Viem
- **Backend:** AWS Lambda (API Gateway + Bedrock)
- **Chain:** Base Sepolia (x402 protocol)
- **State:** Firebase Firestore
- **AI:** DeepSeek + OpenAI (reasoning), AWS Bedrock Nova Pro (risk)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local
# Fill in your keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

- `POST /api/run` — Execute the full agent pipeline
- `GET /api/x402/data` — x402 service catalog
- `POST /api/x402/pay` — x402 payment settlement

## x402 Integration

Agent Studio implements the x402 (HTTP 402) protocol for micropayments on Base:

- Market Data: $0.01 per request
- Fraud Risk: $0.02 per request
- Sanctions Screen: $0.05 per request
- Credit Bureau: $0.10 per request

## Consensus 2026

This project was built in 72 hours for Consensus 2026 Miami.

**Submission:** [consensus-submission.vercel.app](https://consensus-submission.vercel.app)  
**Paired with:** [AgentPay Solana](https://agentpay-solana.vercel.app) — human approval layer

## License

MIT