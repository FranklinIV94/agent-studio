import { db, isConfigured } from './firebase'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import type { AgentMessage, ExecutionResult } from '@/agents/pipeline'

const RUNS_COLLECTION = 'pipeline_runs'

export interface PipelineRun {
  id?: string
  userId: string
  input: string
  messages: AgentMessage[]
  result: ExecutionResult | null
  status: 'running' | 'completed' | 'failed'
  createdAt: Date | ReturnType<typeof serverTimestamp>
}

export async function saveRun(
  userId: string,
  input: string,
  messages: AgentMessage[],
  result: ExecutionResult | null,
  status: 'running' | 'completed' | 'failed'
): Promise<string> {
  if (!isConfigured || !db) return 'demo-run'
  const doc = await addDoc(collection(db, RUNS_COLLECTION), {
    userId,
    input,
    messages,
    result,
    status,
    createdAt: serverTimestamp(),
  })
  return doc.id
}

export async function getRecentRuns(
  userId: string,
  count = 10
): Promise<(PipelineRun & { id: string })[]> {
  if (!isConfigured || !db) return []
  const q = query(
    collection(db, RUNS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(count)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as (PipelineRun & { id: string })[]
}