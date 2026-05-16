import type { ServerWebSocket } from 'bun'
import type { CliToServer, ServerToCli } from '@bed-vibe/shared'
import { getDb } from './db'
import { nextSeq } from './seq'
import { broadcastSse } from './sse'
import { validateMachineToken } from './auth'
import { config } from './config'

interface WsData {
  authenticated: boolean
  machineId?: string
  userId?: string
}

// Track connections by machineId (one WS per machine/daemon)
const machineConnections = new Map<string, ServerWebSocket<WsData>>()
// Track which sessions belong to which machine
const sessionToMachine = new Map<string, string>()
// RPC pending requests
const pendingRpc = new Map<string, { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> }>()

let pingTimer: ReturnType<typeof setInterval> | null = null

export function getWsHandlers() {
  return {
    open(ws: ServerWebSocket<WsData>) {
      ws.data = { authenticated: false }
    },

    message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
      const text = typeof raw === 'string' ? raw : raw.toString()

      if (!ws.data.authenticated) {
        handleAuth(ws, text)
        return
      }

      let msg: CliToServer
      try {
        msg = JSON.parse(text)
      } catch {
        ws.send(JSON.stringify({ error: 'invalid json' }))
        return
      }

      handleMessage(ws, msg)
    },

    close(ws: ServerWebSocket<WsData>) {
      if (ws.data.machineId) {
        machineConnections.delete(ws.data.machineId)

        // Mark all sessions of this machine for timeout
        for (const [sid, mid] of sessionToMachine) {
          if (mid === ws.data.machineId) {
            scheduleSessionTimeout(sid)
          }
        }

        // Broadcast machine offline
        broadcastSse({ type: 'machine.status', machineId: ws.data.machineId, online: false })
      }

      if (machineConnections.size === 0 && pingTimer) {
        clearInterval(pingTimer)
        pingTimer = null
      }
    },
  }
}

function handleAuth(ws: ServerWebSocket<WsData>, text: string) {
  try {
    const parsed = JSON.parse(text)
    const token = parsed.machineToken ?? parsed.token

    if (!token) {
      ws.send(JSON.stringify({ error: 'token required' }))
      ws.close(4001, 'unauthorized')
      return
    }

    const machine = validateMachineToken(token)
    if (!machine) {
      ws.send(JSON.stringify({ error: 'unauthorized' }))
      ws.close(4001, 'unauthorized')
      return
    }

    ws.data.authenticated = true
    ws.data.machineId = machine.machineId
    ws.data.userId = machine.userId

    // Register machine connection
    machineConnections.set(machine.machineId, ws)

    // Update last_seen_at
    const db = getDb()
    db.run(`UPDATE machines SET last_seen_at = ? WHERE id = ?`, [Date.now(), machine.machineId])

    ws.send(JSON.stringify({ ok: true }))

    // Broadcast machine online
    broadcastSse({ type: 'machine.status', machineId: machine.machineId, online: true })

    if (!pingTimer) {
      pingTimer = setInterval(() => {
        for (const s of machineConnections.values()) {
          s.ping()
        }
      }, config.wsHeartbeatMs)
    }
  } catch {
    ws.send(JSON.stringify({ error: 'invalid auth message' }))
    ws.close(4000, 'bad request')
  }
}

function handleMessage(ws: ServerWebSocket<WsData>, msg: CliToServer) {
  const db = getDb()
  const machineId = ws.data.machineId!

  switch (msg.t) {
    case 'session.start': {
      const now = Date.now()
      db.run(
        `INSERT INTO sessions (id, agent, cwd, model, status, machine_id, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status='active', machine_id=?, model=?, source=?, updated_at=?`,
        [msg.sid, msg.agent, msg.cwd, msg.model ?? null, machineId, msg.source ?? 'local', now, now,
         machineId, msg.model ?? null, msg.source ?? 'local', now]
      )
      sessionToMachine.set(msg.sid, machineId)
      clearSessionTimeout(msg.sid)

      broadcastSse({
        type: 'session.update',
        sid: msg.sid,
        status: 'active',
        thinking: false,
      })
      break
    }

    case 'session.end': {
      db.run(
        `UPDATE sessions SET status='inactive', updated_at=? WHERE id=?`,
        [Date.now(), msg.sid]
      )
      sessionToMachine.delete(msg.sid)

      broadcastSse({
        type: 'session.update',
        sid: msg.sid,
        status: 'inactive',
        thinking: false,
      })
      break
    }

    case 'session.status': {
      const thinking = msg.status === 'thinking' || msg.status === 'tool_running' ? 1 : 0
      db.run(
        `UPDATE sessions SET thinking=?, updated_at=? WHERE id=?`,
        [thinking, Date.now(), msg.sid]
      )
      broadcastSse({
        type: 'session.update',
        sid: msg.sid,
        status: 'active',
        thinking: thinking === 1,
      })
      break
    }

    case 'msg': {
      const seq = nextSeq(msg.sid)
      const now = Date.now()
      const source = extractSource(msg.content)
      db.run(
        `INSERT INTO messages (session_id, seq, source, content, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [msg.sid, seq, source, JSON.stringify(msg.content), now]
      )
      db.run(`UPDATE sessions SET updated_at=? WHERE id=?`, [now, msg.sid])

      broadcastSse({
        type: 'msg',
        sid: msg.sid,
        seq,
        source,
        content: msg.content,
      })
      break
    }

    case 'msg.batch': {
      const now = Date.now()
      for (const content of msg.messages) {
        const seq = nextSeq(msg.sid)
        const source = extractSource(content)
        db.run(
          `INSERT INTO messages (session_id, seq, source, content, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [msg.sid, seq, source, JSON.stringify(content), now]
        )

        broadcastSse({
          type: 'msg',
          sid: msg.sid,
          seq,
          source,
          content,
        })
      }
      db.run(`UPDATE sessions SET updated_at=? WHERE id=?`, [now, msg.sid])
      break
    }

    case 'perm.req': {
      const now = Date.now()
      db.run(
        `INSERT OR IGNORE INTO permissions (id, session_id, tool, input, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [msg.id, msg.sid, msg.tool, JSON.stringify(msg.input), now]
      )

      const seq = nextSeq(msg.sid)
      db.run(
        `INSERT INTO messages (session_id, seq, source, content, created_at)
         VALUES (?, ?, 'system', ?, ?)`,
        [msg.sid, seq, JSON.stringify({ type: 'perm.req', id: msg.id, tool: msg.tool, input: msg.input }), now]
      )

      broadcastSse({
        type: 'perm.req',
        sid: msg.sid,
        seq,
        id: msg.id,
        tool: msg.tool,
        input: msg.input,
      })
      break
    }

    case 'perm.ack': {
      db.run(
        `UPDATE permissions SET acked=1 WHERE id=? AND session_id=?`,
        [msg.id, msg.sid]
      )
      break
    }

    case 'rpc.res': {
      const pending = pendingRpc.get(msg.requestId)
      if (pending) {
        clearTimeout(pending.timer)
        pendingRpc.delete(msg.requestId)
        if (msg.error) {
          pending.resolve({ error: msg.error })
        } else {
          pending.resolve(msg.result)
        }
      }
      break
    }

    case 'usage': {
      const now = Date.now()
      db.run(
        `INSERT INTO usage (session_id, input_tokens, output_tokens, cache_read, cache_write, cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [msg.sid, msg.inputTokens, msg.outputTokens, msg.cacheRead, msg.cacheWrite, msg.cost, now]
      )
      db.run(
        `UPDATE sessions SET
           total_input_tokens = total_input_tokens + ?,
           total_output_tokens = total_output_tokens + ?,
           total_cost = total_cost + ?,
           updated_at = ?
         WHERE id = ?`,
        [msg.inputTokens, msg.outputTokens, msg.cost, now, msg.sid]
      )
      broadcastSse({ type: 'usage', sid: msg.sid, inputTokens: msg.inputTokens, outputTokens: msg.outputTokens, cost: msg.cost })
      break
    }

    case 'session.meta': {
      const updates: string[] = []
      const params: (string | number | null)[] = []
      if (msg.model) { updates.push('model = ?'); params.push(msg.model) }
      if (msg.effort) { updates.push('effort = ?'); params.push(msg.effort) }
      if (msg.permissionMode) { updates.push('permission_mode = ?'); params.push(msg.permissionMode) }
      if (updates.length > 0) {
        updates.push('updated_at = ?')
        params.push(Date.now())
        params.push(msg.sid)
        db.run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, params)
      }
      break
    }
  }
}

// Send message to CLI via machine connection
export function sendToCli(sessionId: string, msg: ServerToCli): boolean {
  const machineId = sessionToMachine.get(sessionId)
  if (!machineId) return false
  const ws = machineConnections.get(machineId)
  if (!ws) return false
  ws.send(JSON.stringify(msg))
  return true
}

// Send RPC to a specific machine and wait for response
export function sendRpcToMachine(machineId: string, msg: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
  const ws = machineConnections.get(machineId)
  if (!ws) return Promise.reject(new Error('Machine offline'))

  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRpc.delete(requestId)
      resolve({ error: 'timeout' })
    }, timeoutMs)

    pendingRpc.set(requestId, { resolve, timer })
    ws.send(JSON.stringify({ ...msg, requestId }))
  })
}

export function isMachineOnline(machineId: string): boolean {
  return machineConnections.has(machineId)
}

export function getOnlineMachineIds(): string[] {
  return [...machineConnections.keys()]
}

const sessionTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSessionTimeout(sessionId: string) {
  clearSessionTimeout(sessionId)
  const timer = setTimeout(() => {
    const db = getDb()
    db.run(
      `UPDATE sessions SET status='inactive', updated_at=? WHERE id=? AND status='active'`,
      [Date.now(), sessionId]
    )
    broadcastSse({
      type: 'session.update',
      sid: sessionId,
      status: 'inactive',
      thinking: false,
    })
    sessionTimeouts.delete(sessionId)
  }, config.sessionTimeoutMs)
  sessionTimeouts.set(sessionId, timer)
}

function clearSessionTimeout(sessionId: string) {
  const timer = sessionTimeouts.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    sessionTimeouts.delete(sessionId)
  }
}

function extractSource(content: unknown): 'agent' | 'user' | 'system' {
  if (content && typeof content === 'object' && 'type' in content) {
    const t = (content as any).type
    if (t === 'user') return 'user'
    if (t === 'assistant') return 'agent'
    if (t === 'system' || t === 'summary') return 'system'
  }
  return 'agent'
}