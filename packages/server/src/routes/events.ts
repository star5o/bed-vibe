import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { getDb } from '../db'
import { addSseClient, removeSseClient } from '../sse'
import { getUserMachineIds } from '../ownership'
import type { AppEnv } from '../types'
import type { SseEvent } from '@bed-vibe/shared'

const events = new Hono<AppEnv>()

events.get('/', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.query('sessionId')
  const lastEventId = Number(c.req.header('Last-Event-ID') ?? c.req.query('lastEventId') ?? 0)

  const machineIds = getUserMachineIds(userId)

  return streamSSE(c, async (stream) => {
    const clientId = crypto.randomUUID()

    addSseClient({
      id: clientId,
      userId,
      sessionFilter: sessionId,
      send: (event, data, id) => {
        stream.writeSSE({ event, data, id }).catch(() => {})
      },
      close: () => stream.close(),
    })

    // Replay missed messages using global autoincrement id
    if (lastEventId > 0 && machineIds.length > 0) {
      const db = getDb()
      const placeholders = machineIds.map(() => '?').join(',')

      let query = `SELECT m.id, m.seq, m.source, m.content, m.session_id, m.local_id
                   FROM messages m
                   JOIN sessions s ON m.session_id = s.id
                   WHERE m.id > ? AND s.machine_id IN (${placeholders})`
      const params: any[] = [lastEventId, ...machineIds]

      if (sessionId) {
        query += ` AND m.session_id = ?`
        params.push(sessionId)
      }
      query += ` ORDER BY m.id ASC LIMIT 500`

      const rows = db.query<any, any[]>(query).all(...params)
      for (const r of rows) {
        const event: SseEvent = {
          type: 'msg',
          sid: r.session_id,
          seq: r.seq,
          source: r.source,
          content: JSON.parse(r.content),
          localId: r.local_id ?? undefined,
        }
        await stream.writeSSE({
          event: 'msg',
          data: JSON.stringify(event),
          id: r.id.toString(),
        })
      }

      // Replay pending permissions
      if (sessionId) {
        const pendingPerms = db.query<any, [string]>(
          `SELECT id, session_id, tool, input FROM permissions
           WHERE session_id = ? AND status = 'pending'`
        ).all(sessionId)
        for (const p of pendingPerms) {
          const event: SseEvent = {
            type: 'perm.req',
            sid: p.session_id,
            seq: 0,
            id: p.id,
            tool: p.tool,
            input: p.input ? JSON.parse(p.input) : null,
          }
          await stream.writeSSE({
            event: 'perm.req',
            data: JSON.stringify(event),
          })
        }
      }
    }

    stream.onAbort(() => {
      removeSseClient(clientId)
    })

    await new Promise(() => {})
  })
})

export default events
