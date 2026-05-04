'use client'

import { useState, useCallback, useEffect } from 'react'
import { AgentPipeline, type AgentMessage } from '@/agents/pipeline'
import { connectWallet, sendETH, getAccountInfo, type WalletConnection } from '@/lib/coinbase'
import { isConfigured, signInDemo } from '@/lib/firebase'
import { saveRun, getRecentRuns, type PipelineRun } from '@/lib/firestore'

const pipeline = new AgentPipeline()

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [txResult, setTxResult] = useState<{
    txHash: string
    from: string
    to: string
    amount: string
    fee: string
    explorerUrl: string
  } | null>(null)
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // Auth on mount
  useEffect(() => {
    if (isConfigured) {
      signInDemo().then((u) => setUserId(u.uid)).catch(() => setUserId('demo-user'))
    } else {
      setUserId('demo-user')
    }
  }, [])

  // Load recent runs
  useEffect(() => {
    if (userId) {
      getRecentRuns(userId, 5).then(setRecentRuns).catch(() => {})
    }
  }, [userId])

  const handleConnect = useCallback(async () => {
    try {
      const w = await connectWallet()
      setWallet(w)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    }
  }, [])

  const handleRun = useCallback(async () => {
    if (!input.trim() || isRunning) return

    setIsRunning(true)
    setMessages([])
    setTxResult(null)
    setError(null)

    try {
      const { action, params, analysis, riskResult } = await pipeline.run(input, (role, thought) => {
        setMessages((prev) => [
          ...prev,
          { role, content: thought, timestamp: Date.now() },
        ])
      })

      // If it's a send action and wallet is connected, execute real transaction
      if (action === 'send_remittance' && wallet) {
        setMessages((prev) => [
          ...prev,
          { role: 'execution', content: 'Awaiting wallet signature...', timestamp: Date.now() },
        ])
        const result = await sendETH(
          params.toAddress as `0x${string}`,
          `${params.amount}`
        )
        setTxResult({
          txHash: result.txHash,
          from: result.fromAddress,
          to: result.toAddress,
          amount: result.amount,
          fee: result.fee,
          explorerUrl: result.explorerUrl,
        })
        setMessages((prev) => [
          ...prev,
          { role: 'execution', content: `✅ Confirmed on Base Sepolia! Tx: ${result.txHash.slice(0, 12)}...`, timestamp: Date.now() },
        ])
      } else if (action === 'send_remittance' && !wallet) {
        setMessages((prev) => [
          ...prev,
          { role: 'execution', content: '⚠️ Connect wallet to execute real transactions. Showing simulated result.', timestamp: Date.now() },
        ])
      }

      // Save to Firestore
      if (userId && isConfigured) {
        await saveRun(userId, input, messages, null, 'completed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        { role: 'execution' as const, content: `❌ Error: ${msg}`, timestamp: Date.now() },
      ])
    } finally {
      setIsRunning(false)
      if (userId) {
        getRecentRuns(userId, 5).then(setRecentRuns).catch(() => {})
      }
    }
  }, [input, isRunning, userId, wallet, messages])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'director':
        return 'text-blue-400 border-blue-400/30 bg-blue-400/5'
      case 'quant':
        return 'text-green-400 border-green-400/30 bg-green-400/5'
      case 'risk':
        return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5'
      case 'execution':
        return 'text-purple-400 border-purple-400/30 bg-purple-400/5'
      default:
        return 'text-red-400 border-red-400/30 bg-red-400/5'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'director':
        return '📋 Director'
      case 'quant':
        return '📊 Quant'
      case 'risk':
        return '⚖️ Risk'
      case 'execution':
        return '🚀 Execution'
      default:
        return '⚠️ Error'
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'director':
        return 'Parses natural language into structured on-chain actions'
      case 'quant':
        return 'Analyzes Base network conditions — gas, congestion, fees'
      case 'risk':
        return 'Validates thresholds, addresses, and safety conditions'
      case 'execution':
        return 'Broadcasts transaction via Coinbase Wallet on Base'
      default:
        return ''
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Agent Studio
            </h1>
            <p className="text-sm text-slate-500">
              EasyA Consensus Miami · Coinbase + AWS Agentic Track
            </p>
          </div>
          <div className="flex items-center gap-3">
            {wallet ? (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium font-mono">
                {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
              </span>
            ) : (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-colors"
              >
                Connect Wallet
              </button>
            )}
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
              Base Sepolia
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-3 tracking-tight">
            AI agents that reason, act,{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              and show their work
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Multi-agent pipeline on Base — Director, Quant, Risk, and Execution
            stages visualized live with real on-chain transactions via Coinbase Wallet.
          </p>
        </div>

        {/* Pipeline Steps (always visible) */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {['director', 'quant', 'risk', 'execution'].map((role) => {
            const isActive = isRunning && messages.some((m) => m.role === role) && !messages.some((m) => m.role === role && messages.indexOf(m) < messages.length - 1 && messages[messages.length - 1]?.role !== role)
            const isDone = messages.some((m) => m.role === role)
            return (
              <div
                key={role}
                className={`rounded-xl border p-4 transition-all duration-300 ${
                  isDone
                    ? getRoleColor(role)
                    : isActive
                      ? 'border-white/30 bg-white/5 scale-[1.02]'
                      : 'border-slate-700 bg-slate-800/30'
                }`}
              >
                <div className="text-lg mb-1">{getRoleLabel(role).split(' ')[0]}</div>
                <div className="text-sm font-semibold mb-1">
                  {getRoleLabel(role).split(' ')[1]}
                </div>
                <div className="text-xs text-slate-500">{getRoleDescription(role)}</div>
                <div className="mt-2 text-xs">
                  {isDone ? '✅' : isActive ? '⏳' : '—'}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">
              Enter a rule
            </h3>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Send 0.001 ETH to Brazil if the fee is under $1"
              className="w-full h-32 bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isRunning}
            />
            <div className="mt-3 flex gap-2 flex-wrap">
              {['Send 0.001 ETH to Brazil', 'Send 0.01 ETH to Mexico', 'Check my balance'].map((example) => (
                <button
                  key={example}
                  onClick={() => setInput(example)}
                  disabled={isRunning}
                  className="px-3 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-600/50 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
            <button
              onClick={handleRun}
              disabled={!input.trim() || isRunning}
              className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">◌</span>
                  Agent reasoning…
                </span>
              ) : (
                'Run Agent Pipeline'
              )}
            </button>
          </div>

          {/* Pipeline Viz */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">
              Agent reasoning
            </h3>
            {messages.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <p>Pipeline steps will appear here</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-sm ${getRoleColor(msg.role)}`}
                  >
                    <span className="font-semibold">
                      {getRoleLabel(msg.role)}
                    </span>
                    <span className="text-slate-300 ml-2">{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-500/10 rounded-2xl border border-red-500/30 p-4 text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Result Panel */}
        {txResult && (
          <div className="mt-8 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-green-400">
                ✅ Transaction Confirmed on Base
              </h3>
              <a
                href={txResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline"
              >
                View on BaseScan →
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">TX HASH</p>
                <p className="font-mono text-green-300 text-xs">
                  {txResult.txHash.slice(0, 16)}…
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">AMOUNT</p>
                <p className="text-white font-semibold">{txResult.amount} ETH</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">FEE</p>
                <p className="text-white">{txResult.fee} ETH</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">RECIPIENT</p>
                <p className="font-mono text-slate-300 text-xs">
                  {txResult.to.slice(0, 10)}…{txResult.to.slice(-6)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-300 mb-3">
              Recent Runs
            </h3>
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 text-sm"
                >
                  <span className="text-slate-400 truncate max-w-[200px]">
                    {run.input}
                  </span>
                  <span
                    className={
                      run.status === 'completed'
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-600 text-sm">
          <p>Agent Studio · EasyA Consensus Miami 2026 · Coinbase + AWS Agentic Track</p>
          <p className="mt-1">Franklin Bryant IV · Solo · Built in 72 hours</p>
        </div>
      </div>
    </main>
  )
}