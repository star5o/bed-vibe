import { Hono } from 'hono'
import { getDb } from '../db'
import { broadcastSse } from '../sse'
import { sendToCli } from '../ws'
import { userOwnsSession } from '../ownership'
import type { AppEnv } from '../types'
import type { PermissionRecord } from '@bed-vibe/shared'

const permissions = new Hono<AppEnv>()

permissions.get('/:sessionId/permissions', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('sessionId')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const status = c.req.query('status')

  const db = getDb()
  let query = `SELECT id, session_id, tool, input, status, created_at, resolved_at
               FROM permissions WHERE session_id = ?`
  const params: any[] = [sessionId]

  if (status) {
    query += ` AND status = ?`
    params.push(status)
  }
  query += ` ORDER BY created_at DESC`

  const rows = db.query<any, any[]>(query).all(...params)

  const perms: PermissionRecord[] = rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    tool: r.tool,
    input: r.input ? JSON.parse(r.input) : null,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? undefined,
  }))

  return c.json({ permissions: perms })
})

permissions.post('/:sessionId/permissions/:reqId/approve', async (c) => {
  return resolvePermission(c, true)
})

permissions.post('/:sessionId/permissions/:reqId/deny', async (c) => {
  return resolvePermission(c, false)
})

async function resolvePermission(c: any, approved: boolean) {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('sessionId')
  const reqId = c.req.param('reqId')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const mode = body.mode
  const allowTools = body.allowTools

  const db = getDb()
  const now = Date.now()
  const decision = JSON.stringify({ approved, mode, allowTools })

  const existing = db.query<{ id: string }, [string, string]>(
    `SELECT id FROM permissions WHERE id=? AND session_id=? AND status='pending'`
  ).get(reqId, sessionId)

  if (!existing) {
    return c.json({ error: 'not found or already resolved' }, 404)
  }

  db.run(
    `UPDATE permissions SET status=?, decision=?, resolved_at=?
     WHERE id=? AND session_id=? AND status='pending'`,
    [approved ? 'approved' : 'denied', decision, now, reqId, sessionId]
  )

  // Send to CLI
  sendToCli(sessionId, {
    t: 'perm.res',
    sid: sessionId,
    id: reqId,
    approved,
    mode,
    allowTools,
  })

  // Broadcast resolution to web clients
  broadcastSse({
    type: 'perm.resolved',
    sid: sessionId,
    id: reqId,
    approved,
  })

  return c.json({ ok: true })
}

export default permissions
