import { Hono } from 'hono'
import { getDb } from '../db'
import { nextSeq } from '../seq'
import { broadcastSse } from '../sse'
import { sendToCli } from '../ws'
import { userOwnsSession } from '../ownership'
import type { AppEnv } from '../types'
import type { MessageRecord } from '@bed-vibe/shared'

const messages = new Hono<AppEnv>()

messages.get('/:sessionId/messages', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('sessionId')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const afterSeq = Number(c.req.query('afterSeq') ?? 0)
  const beforeSeq = c.req.query('beforeSeq')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)

  const db = getDb()
  let rows: any[]

  if (beforeSeq) {
    rows = db.query<any, [string, number, number]>(
      `SELECT id, session_id, seq, source, content, local_id, created_at
       FROM messages WHERE session_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?`
    ).all(sessionId, Number(beforeSeq), limit + 1)
    rows.reverse()
  } else {
    rows = db.query<any, [string, number, number]>(
      `SELECT id, session_id, seq, source, content, local_id, created_at
       FROM messages WHERE session_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?`
    ).all(sessionId, afterSeq, limit + 1)
  }

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)

  const msgs: MessageRecord[] = items.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    seq: r.seq,
    source: r.source,
    content: JSON.parse(r.content),
    localId: r.local_id ?? undefined,
    createdAt: r.created_at,
  }))

  return c.json({ messages: msgs, hasMore })
})

messages.post('/:sessionId/messages', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('sessionId')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const { text, localId, source } = await c.req.json<{
    text: string
    localId: string
    source?: 'web' | 'cli'
  }>()

  const db = getDb()

  if (localId) {
    const existing = db.query<{ id: number }, [string, string]>(
      `SELECT id FROM messages WHERE session_id = ? AND local_id = ?`
    ).get(sessionId, localId)
    if (existing) {
      return c.json({ ok: true, deduplicated: true })
    }
  }

  const seq = nextSeq(sessionId)
  const now = Date.now()
  const content = { type: 'text', text }

  db.run(
    `INSERT INTO messages (session_id, seq, source, content, local_id, created_at)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [sessionId, seq, JSON.stringify(content), localId ?? null, now]
  )
  const { id: msgId } = db.query<{ id: number }, []>('SELECT last_insert_rowid() as id').get()!
  db.run(`UPDATE sessions SET updated_at=? WHERE id=?`, [now, sessionId])

  sendToCli(sessionId, {
    t: 'user.msg',
    sid: sessionId,
    text,
    localId,
    source: source ?? 'web',
  })

  broadcastSse({
    type: 'msg',
    sid: sessionId,
    seq,
    source: 'user',
    content,
    localId,
  }, msgId)

  return c.json({ ok: true, seq })
})

export default messages
