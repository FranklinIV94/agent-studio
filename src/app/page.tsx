'use client'

import { useState, useCallback } from 'react'
import { AgentPipeline, type ExecutionResult } from '@/agents/pipeline'

const pipeline = new AgentPipeline()

interface PipelineMessage {
  role: string
  content: string
  timestamp: number
}

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<PipelineMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)

  const handleRun = useCallback(async () => {
    if (!input.trim() || isRunning) return
    
    setIsRunning(true)
    setMessages([])
    setResult(null)
    
    try {
      const execResult = await pipeline.run(input, (role, thought) => {
        setMessages(prev => [...prev, { role, content: thought, timestamp: Date.now() }])
      })
      setResult(execResult)
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: err instanceof Error ? err.message : 'Unknown error', 
        timestamp: Date.now() 
      }])
    } finally {
      setIsRunning(false)
    }
  }, [input, isRunning])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'director': return 'text-blue-400'
      case 'quant': return 'text-green-400'
      case 'risk': return 'text-yellow-400'
      case 'execution': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'director': return '📋 Director'
      case 'quant': return '📊 Quant'
      case 'risk': return '⚖️ Risk'
      case 'execution': return '🚀 Execution'
      default: return role
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Agent Studio
            </h1>
            <p className="text-sm text-slate-400">EasyA Miami × Ripple Track</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
              ● LIVE
            </span>
            <span className="text-xs text-slate-500">72h Sprint</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-lg text-slate-400 mb-2">Franklin Bryant IV · Solo</p>
          <h2 className="text-4xl font-bold mb-4">
            AI agents that reason, act, <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              and show their work
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Multi-agent pipeline on the XRP Ledger — Director, Quant, Risk, and Execution 
            stages visualized live, with real on-chain transactions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">Enter a rule</h3>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Send $50 USDC to Brazil if the fee is under $1"
              className="w-full h-32 bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isRunning}
            />
            <button
              onClick={handleRun}
              disabled={!input.trim() || isRunning}
              className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">◌</span>
                  Agent reasoning...
                </span>
              ) : (
                'Run Agent Pipeline'
              )}
            </button>
          </div>

          {/* Pipeline Viz */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">Pipeline visualization</h3>
            
            {messages.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <p>Agent pipeline will appear here</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className={`font-semibold ${getRoleColor(msg.role)} min-w-[80px]`}>
                      {getRoleLabel(msg.role)}
                    </span>
                    <span className="text-slate-300">{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Result Panel */}
        {result && (
          <div className="mt-8 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-green-400">✅ Transaction Confirmed</h3>
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline"
              >
                View on XRPL Explorer →
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">TX HASH</p>
                <p className="font-mono text-green-300 text-xs">{result.txHash.slice(0, 12)}...</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">AMOUNT</p>
                <p className="text-white font-semibold">${result.amount}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">FEE</p>
                <p className="text-white">${result.fee.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">RECIPIENT</p>
                <p className="font-mono text-slate-300 text-xs">{result.toAddress.slice(0, 12)}...</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Agent Studio · EasyA Consensus Miami 2026 · Ripple Track</p>
          <p className="mt-1">Franklin Bryant IV · Solo · Built in 72 hours</p>
        </div>
      </div>
    </main>
  )
}
