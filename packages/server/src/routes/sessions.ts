import { Hono } from 'hono'
import { getDb } from '../db'
import { getUserMachineIds, userOwnsSession } from '../ownership'
import { isMachineOnline } from '../ws'
import type { AppEnv } from '../types'
import type { SessionInfo } from '@bed-vibe/shared'

const sessions = new Hono<AppEnv>()

sessions.get('/', (c) => {
  const userId = c.get('userId') as string
  const machineFilter = c.req.query('machineId')
  const statusFilter = c.req.query('status')
  const search = c.req.query('q')
  const db = getDb()

  const machineIds = getUserMachineIds(userId)
  if (machineIds.length === 0) {
    return c.json({ sessions: [] })
  }

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (machineFilter && machineIds.includes(machineFilter)) {
    conditions.push('s.machine_id = ?')
    params.push(machineFilter)
  } else {
    const placeholders = machineIds.map(() => '?').join(',')
    conditions.push(`s.machine_id IN (${placeholders})`)
    params.push(...machineIds)
  }

  if (statusFilter && ['active', 'inactive', 'archived'].includes(statusFilter)) {
    conditions.push('s.status = ?')
    params.push(statusFilter)
  } else {
    conditions.push("s.status != 'archived'")
  }

  if (search) {
    conditions.push('(s.cwd LIKE ? OR s.name LIKE ? OR s.id LIKE ?)')
    const like = `%${search}%`
    params.push(like, like, like)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const query = `SELECT s.id, s.agent, s.cwd, s.model, s.name, s.status, s.thinking,
                        s.machine_id, s.effort, s.permission_mode, s.source,
                        s.total_input_tokens, s.total_output_tokens, s.total_cost,
                        s.created_at, s.updated_at, m.name as machine_name
                 FROM sessions s
                 LEFT JOIN machines m ON s.machine_id = m.id
                 ${where}
                 ORDER BY s.updated_at DESC
                 LIMIT 100`

  const rows = db.query<any, (string | number)[]>(query).all(...params)

  const list: SessionInfo[] = rows.map((r: any) => ({
    id: r.id,
    agent: r.agent,
    cwd: r.cwd,
    model: r.model ?? undefined,
    effort: r.effort ?? undefined,
    permissionMode: r.permission_mode ?? undefined,
    name: r.name ?? undefined,
    machineId: r.machine_id ?? undefined,
    machineName: r.machine_name ?? undefined,
    status: r.status,
    thinking: r.thinking === 1,
    source: r.source ?? 'local',
    totalInputTokens: r.total_input_tokens ?? 0,
    totalOutputTokens: r.total_output_tokens ?? 0,
    totalCost: r.total_cost ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return c.json({ sessions: list })
})

sessions.get('/:id', (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const db = getDb()
  const r = db.query<any, [string]>(
    `SELECT s.id, s.agent, s.cwd, s.model, s.name, s.status, s.thinking,
            s.machine_id, s.effort, s.permission_mode, s.source,
            s.total_input_tokens, s.total_output_tokens, s.total_cost,
            s.created_at, s.updated_at, m.name as machine_name
     FROM sessions s
     LEFT JOIN machines m ON s.machine_id = m.id
     WHERE s.id = ?`
  ).get(sessionId)

  if (!r) return c.json({ error: 'not found' }, 404)

  const session: SessionInfo = {
    id: r.id,
    agent: r.agent,
    cwd: r.cwd,
    model: r.model ?? undefined,
    effort: r.effort ?? undefined,
    permissionMode: r.permission_mode ?? undefined,
    name: r.name ?? undefined,
    machineId: r.machine_id ?? undefined,
    machineName: r.machine_name ?? undefined,
    status: r.status,
    thinking: r.thinking === 1,
    source: r.source ?? 'local',
    totalInputTokens: r.total_input_tokens ?? 0,
    totalOutputTokens: r.total_output_tokens ?? 0,
    totalCost: r.total_cost ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }

  return c.json(session)
})

sessions.patch('/:id', async (c) => {
  const userId = c.get('userId') as string
  const sessionId = c.req.param('id')

  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }

  const { name } = await c.req.json<{ name?: string }>()
  if (name !== undefined) {
    const db = getDb()
    db.run(`UPDATE sessions SET name = ? WHERE id = ?`, [name || null, sessionId])
  }

  return c.json({ ok: true })
})

export default sessions
