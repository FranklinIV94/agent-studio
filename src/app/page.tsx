'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Wallet, Zap, ShieldCheck, Send, ChevronRight, ExternalLink, Activity, ArrowRight, Cpu, Coins } from 'lucide-react'
import type { AgentMessage } from '@/agents/pipeline'
import { useAccount, useConnect, useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'
import { isConfigured, signInDemo } from '@/lib/firebase'
import { saveRun, getRecentRuns, type PipelineRun } from '@/lib/firestore'
import { chain, DEMO_ADDRESSES } from '@/lib/coinbase'

const AGENTS = [
  { id: 'director' as const, label: 'Director', icon: Zap, color: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', desc: 'LLM-powered intent parsing' },
  { id: 'quant' as const, label: 'Quant', icon: Activity, color: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', desc: 'AI market analysis on Base' },
  { id: 'risk' as const, label: 'Risk', icon: ShieldCheck, color: 'from-amber-500 to-orange-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', desc: 'LLM risk reasoning & validation' },
  { id: 'execution' as const, label: 'Execution', icon: Send, color: 'from-purple-500 to-pink-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', desc: 'Coinbase Smart Wallet on Base' },
] as const

type AgentRole = typeof AGENTS[number]['id']

const smooth = { type: 'spring' as const, stiffness: 300, damping: 25 }
const snappy = { type: 'spring' as const, stiffness: 500, damping: 30 }

function AgentNode({ agent, status, reasoning }: { agent: typeof AGENTS[number]; status: 'idle' | 'active' | 'done'; reasoning?: string }) {
  const Icon = agent.icon
  return (
    <motion.div layout transition={smooth} className={`relative rounded-2xl border p-4 transition-colors ${status === 'done' ? `${agent.bg} ${agent.border}` : status === 'active' ? 'border-white/20 bg-white/5' : 'border-slate-800 bg-slate-900/50'}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${agent.color} shadow-lg flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white text-sm">{agent.label}</h4>
            {status === 'done' && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={snappy} className="text-emerald-400 text-sm">✓</motion.span>}
            {status === 'active' && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{agent.desc}</p>
          {reasoning && status === 'done' && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{reasoning}</p>}
        </div>
      </div>
    </motion.div>
  )
}

function PipelineConnector() {
  return <div className="flex justify-center py-0.5"><motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={smooth} className="w-px h-4 bg-gradient-to-b from-slate-700 to-slate-800 origin-top" /></div>
}

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txResult, setTxResult] = useState<{ txHash: string; from: string; to: string; amount: string; fee: string; explorerUrl: string } | null>(null)
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { sendTransactionAsync } = useSendTransaction()

  useEffect(() => { if (isConfigured) signInDemo().then(u => setUserId(u.uid)).catch(() => setUserId('demo-user')); else setUserId('demo-user') }, [])
  useEffect(() => { if (userId) getRecentRuns(userId, 5).then(setRecentRuns).catch(() => {}) }, [userId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleConnect = useCallback(async () => {
    try {
      const connector = connectors[0]
      if (connector) await connectAsync({ connector })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    }
  }, [connectAsync, connectors])

  const handleRun = useCallback(async () => {
    if (!input.trim() || isRunning) return
    setIsRunning(true); setMessages([]); setTxResult(null); setError(null)

    try {
      const response = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, userId }) })
      const data = await response.json()
      if (data.steps) setMessages(data.steps)
      if (!data.success) { setError(data.error || 'Pipeline failed'); return }

      if (data.action === 'send_remittance' && isConnected && address) {
        setMessages(prev => [...prev, { role: 'execution', content: 'Awaiting wallet signature via Coinbase Smart Wallet…', timestamp: Date.now() }])
        const amount = (data.params.amount as number) || 0.001
        const toAddress = data.params.toAddress as `0x${string}`
        const hash = await sendTransactionAsync({ to: toAddress, value: parseEther(amount.toString()) })
        setTxResult({ txHash: hash, from: address, to: toAddress, amount: `${amount} ETH`, fee: '~0.00002', explorerUrl: `https://sepolia.basescan.org/tx/${hash}` })
        setMessages(prev => [...prev, { role: 'execution', content: `✅ Confirmed on Base! Tx: ${hash.slice(0, 12)}…`, timestamp: Date.now() }])
      } else if (data.action === 'send_remittance' && !isConnected) {
        setMessages(prev => [...prev, { role: 'execution', content: '⚠️ Connect Coinbase Smart Wallet to execute real on-chain transactions.', timestamp: Date.now() }])
        setMessages(prev => [...prev, { role: 'execution', content: `Pipeline approved: ${(data.params.amount as number) || 0.001} ETH → ${(data.params.toAddress as string)?.slice(0, 10)}…`, timestamp: Date.now() }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setMessages(prev => [...prev, { role: 'execution', content: `❌ ${msg}`, timestamp: Date.now() }])
    } finally {
      setIsRunning(false)
      if (userId) getRecentRuns(userId, 5).then(setRecentRuns).catch(() => {})
    }
  }, [input, isRunning, userId, isConnected, address, sendTransactionAsync])

  const getAgentStatus = (roleId: AgentRole): 'idle' | 'active' | 'done' => {
    const hasMsg = messages.some(m => m.role === roleId)
    const isLastMsg = messages.length > 0 && messages[messages.length - 1]?.role === roleId
    if (hasMsg && !isLastMsg) return 'done'
    if (isLastMsg && isRunning) return 'active'
    if (hasMsg && !isRunning) return 'done'
    return 'idle'
  }

  const getAgentReasoning = (roleId: AgentRole): string | undefined => {
    const msgs = messages.filter(m => m.role === roleId)
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].content.length > 20) return msgs[i].content }
    return undefined
  }

  const getMsgStyle = (role: string) => { const agent = AGENTS.find(a => a.id === role); if (agent) return `${agent.bg} ${agent.border} ${agent.text}`; return 'bg-red-500/10 border-red-500/30 text-red-400' }
  const getMsgLabel = (role: string) => { const agent = AGENTS.find(a => a.id === role); return agent?.label || 'Error' }

  return (
    <main className="min-h-screen bg-[#0A0B0F] text-white">
      <header className="border-b border-white/5 bg-[#0A0B0F]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20"><Zap className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-lg font-bold tracking-tight">Agent Studio</h1><p className="text-[11px] text-slate-500 tracking-wide uppercase">Coinbase + AWS · Agentic Track</p></div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-emerald-400">{address.slice(0, 6)}…{address.slice(-4)}</span>
              </motion.div>
            ) : (
              <button onClick={handleConnect} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 rounded-xl text-sm font-semibold transition-opacity">
                <Coins className="w-4 h-4" /> Smart Wallet
              </button>
            )}
            <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-400 font-mono">BASE</span>
            <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400 font-mono">AWS BEDROCK</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={smooth} className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-400 mb-4">
            <Cpu className="w-3 h-3" /> AI-Powered Agents · Real On-Chain Execution
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            AI agents that reason, act,<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">and show their work</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Each agent <span className="text-blue-400">thinks out loud</span> with LLM reasoning, validates conditions, and executes <span className="text-purple-400">real transactions</span> on Base via Coinbase Smart Wallet. No black boxes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
          <div className="lg:col-span-5">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...smooth, delay: 0.1 }}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Agent Pipeline</h3>
              <div className="space-y-0">
                {AGENTS.map((agent, i) => (<div key={agent.id}><AgentNode agent={agent} status={getAgentStatus(agent.id)} reasoning={getAgentReasoning(agent.id)} />{i < AGENTS.length - 1 && <PipelineConnector />}</div>))}
              </div>
              <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <Cpu className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Powered by GPT-4o-mini + AWS Bedrock Nova Pro · Base Sepolia · Coinbase Smart Wallet</span>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...smooth, delay: 0.2 }} className="bg-[#12131A] rounded-2xl border border-white/5 p-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Instruction</h3>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }} placeholder="e.g. Send 0.001 ETH to Brazil if the fee is under $1" className="w-full h-28 bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-mono text-sm" disabled={isRunning} />
              <div className="mt-3 flex gap-2 flex-wrap">
                {['Send 0.001 ETH to Brazil', 'Send 0.01 ETH to Mexico', 'Check my balance'].map(ex => (<button key={ex} onClick={() => setInput(ex)} disabled={isRunning} className="px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40">{ex}</button>))}
              </div>
              <button onClick={handleRun} disabled={!input.trim() || isRunning} className="mt-4 w-full py-3.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isRunning ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />Agents reasoning…</>) : (<>Run Pipeline <ChevronRight className="w-4 h-4" /></>)}
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...smooth, delay: 0.3 }} className="bg-[#12131A] rounded-2xl border border-white/5 p-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Reasoning Stream</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence mode="popLayout">
                  {messages.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-32 flex items-center justify-center">
                      <div className="text-center"><p className="text-slate-600 text-sm">No activity yet</p><p className="text-slate-700 text-xs mt-1">Enter an instruction to start the AI pipeline</p></div>
                    </motion.div>
                  ) : (
                    messages.map((msg, i) => (
                      <motion.div key={`${msg.timestamp}-${i}`} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={snappy} className={`rounded-xl border p-3 ${getMsgStyle(msg.role)}`}>
                        <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{getMsgLabel(msg.role)}</span><ArrowRight className="w-3 h-3 opacity-30" /></div>
                        <p className="text-xs leading-relaxed">{msg.content}</p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </motion.div>

            <AnimatePresence>{error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</motion.div>}</AnimatePresence>

            <AnimatePresence>{txResult && (
              <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={smooth} className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400" /><h3 className="font-bold text-emerald-400">Transaction Confirmed on Base</h3></div>
                  <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">BaseScan <ExternalLink className="w-3 h-3" /></a>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[{ label: 'TX HASH', value: txResult.txHash.slice(0, 10) + '…' }, { label: 'AMOUNT', value: txResult.amount }, { label: 'FEE', value: `${txResult.fee} ETH` }, { label: 'TO', value: txResult.to.slice(0, 8) + '…' + txResult.to.slice(-4) }].map(item => (
                    <div key={item.label}><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.label}</p><p className="font-mono text-sm text-white">{item.value}</p></div>
                  ))}
                </div>
              </motion.div>
            )}</AnimatePresence>
          </div>
        </div>

        <div className="border-t border-white/5 py-8 text-center">
          <p className="text-xs text-slate-600">Agent Studio · EasyA Consensus Miami 2026 · Coinbase + AWS Agentic Track</p>
          <p className="text-xs text-slate-700 mt-1">Franklin Bryant IV · Solo · Built in 72 hours</p>
        </div>
      </div>
    </main>
  )
}