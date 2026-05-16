import type { SseEvent } from '@bed-vibe/shared'
import { config } from './config'
import { getDb } from './db'

interface SseClient {
  id: string
  userId: string
  sessionFilter?: string
  send: (event: string, data: string, id?: string) => void
  close: () => void
}

const clients = new Map<string, SseClient>()
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

// Cache session → userId mapping to avoid repeated DB lookups during broadcast
const sessionOwnerCache = new Map<string, string>()

function getSessionOwner(sessionId: string): string | null {
  const cached = sessionOwnerCache.get(sessionId)
  if (cached) return cached

  const db = getDb()
  const row = db.query<{ user_id: string }, [string]>(
    `SELECT m.user_id FROM sessions s
     JOIN machines m ON s.machine_id = m.id
     WHERE s.id = ?`
  ).get(sessionId)

  if (row) {
    sessionOwnerCache.set(sessionId, row.user_id)
    return row.user_id
  }
  return null
}

export function invalidateSessionOwnerCache(sessionId: string): void {
  sessionOwnerCache.delete(sessionId)
}

export function addSseClient(client: SseClient): void {
  clients.set(client.id, client)
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(sendHeartbeat, config.sseHeartbeatMs)
  }
}

export function removeSseClient(id: string): void {
  clients.delete(id)
  if (clients.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export function broadcastSse(event: SseEvent, seq?: number): void {
  const eventType = event.type
  const data = JSON.stringify(event)
  const id = seq?.toString()

  const sid = 'sid' in event ? event.sid : undefined
  const ownerId = sid ? getSessionOwner(sid) : undefined

  for (const client of clients.values()) {
    // Filter by user ownership
    if (ownerId && client.userId !== ownerId) continue

    // Filter by session if client subscribed to a specific session
    if (client.sessionFilter && sid && sid !== client.sessionFilter) continue

    client.send(eventType, data, id)
  }
}

function sendHeartbeat(): void {
  const data = JSON.stringify({ type: 'heartbeat', ts: Date.now() })
  for (const client of clients.values()) {
    client.send('heartbeat', data)
  }
}

export function getSseClientCount(): number {
  return clients.size
}
