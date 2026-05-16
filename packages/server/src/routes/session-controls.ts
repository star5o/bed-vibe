import { Hono } from 'hono'
import { getDb } from '../db'
import { sendToCli } from '../ws'
import { userOwnsSession } from '../ownership'
import { broadcastSse } from '../sse'
import type { AppEnv } from '../types'

const sessionControls = new Hono<AppEnv>()

sessionControls.post('/:id/model', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const { model } = await c.req.json<{ model: string }>()
  if (!model) return c.json({ error: 'model required' }, 400)

  const db = getDb()
  db.run(`UPDATE sessions SET model = ?, updated_at = ? WHERE id = ?`, [model, Date.now(), sessionId])
  sendToCli(sessionId, { t: 'set-model', sid: sessionId, model })

  return c.json({ ok: true })
})

sessionControls.post('/:id/effort', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const { effort } = await c.req.json<{ effort: string }>()
  if (!effort) return c.json({ error: 'effort required' }, 400)

  const db = getDb()
  db.run(`UPDATE sessions SET effort = ?, updated_at = ? WHERE id = ?`, [effort, Date.now(), sessionId])
  sendToCli(sessionId, { t: 'set-effort', sid: sessionId, effort })

  return c.json({ ok: true })
})

sessionControls.post('/:id/permission-mode', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const { mode } = await c.req.json<{ mode: string }>()
  if (!mode) return c.json({ error: 'mode required' }, 400)

  const db = getDb()
  db.run(`UPDATE sessions SET permission_mode = ?, updated_at = ? WHERE id = ?`, [mode, Date.now(), sessionId])
  sendToCli(sessionId, { t: 'set-perm-mode', sid: sessionId, mode })

  return c.json({ ok: true })
})

sessionControls.post('/:id/command', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const { command } = await c.req.json<{ command: string }>()
  if (!command) return c.json({ error: 'command required' }, 400)

  sendToCli(sessionId, { t: 'slash-cmd', sid: sessionId, command })
  return c.json({ ok: true })
})

sessionControls.get('/:id/usage', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const db = getDb()
  const row = db.query<any, [string]>(
    `SELECT total_input_tokens, total_output_tokens, total_cost
     FROM sessions WHERE id = ?`
  ).get(sessionId)

  if (!row) return c.json({ error: 'not found' }, 404)

  return c.json({
    inputTokens: row.total_input_tokens ?? 0,
    outputTokens: row.total_output_tokens ?? 0,
    totalCost: row.total_cost ?? 0,
  })
})

sessionControls.post('/:id/archive', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const db = getDb()
  const now = Date.now()
  db.run(`UPDATE sessions SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?`, [now, now, sessionId])

  broadcastSse({ type: 'session.update', sid: sessionId, status: 'archived', thinking: false })
  return c.json({ ok: true })
})

sessionControls.delete('/:id', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) return c.json({ error: 'not found' }, 404)

  const db = getDb()
  db.run(`DELETE FROM messages WHERE session_id = ?`, [sessionId])
  db.run(`DELETE FROM permissions WHERE session_id = ?`, [sessionId])
  db.run(`DELETE FROM usage WHERE session_id = ?`, [sessionId])
  db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId])

  return c.json({ ok: true })
})

export default sessionControls