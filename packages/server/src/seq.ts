import { getDb } from './db'

const seqCounters = new Map<string, number>()

export function nextSeq(sessionId: string): number {
  const current = seqCounters.get(sessionId) ?? getMaxSeq(sessionId)
  const next = current + 1
  seqCounters.set(sessionId, next)
  return next
}

function getMaxSeq(sessionId: string): number {
  const db = getDb()
  const row = db.query<{ max_seq: number | null }, [string]>(
    'SELECT MAX(seq) as max_seq FROM messages WHERE session_id = ?'
  ).get(sessionId)
  return row?.max_seq ?? 0
}

export function resetSeq(sessionId: string): void {
  seqCounters.delete(sessionId)
}
