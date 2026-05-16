import { Hono } from 'hono'
import { getDb } from '../db'
import { isMachineOnline } from '../ws'
import type { AppEnv } from '../types'
import type { MachineInfo } from '@bed-vibe/shared'

const machines = new Hono<AppEnv>()

machines.get('/', (c) => {
  const userId = c.get('userId') as string
  const db = getDb()

  const rows = db.query<any, [string]>(
    `SELECT id, name, hostname, last_seen_at, created_at
     FROM machines WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId)

  const list: MachineInfo[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    hostname: r.hostname ?? undefined,
    online: isMachineOnline(r.id),
    lastSeenAt: r.last_seen_at ?? undefined,
    createdAt: r.created_at,
  }))

  return c.json({ machines: list })
})

machines.post('/', async (c) => {
  const userId = c.get('userId') as string
  const { name } = await c.req.json<{ name: string }>()

  if (!name || name.length < 1) {
    return c.json({ error: 'name required' }, 400)
  }

  const db = getDb()
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const now = Date.now()

  db.run(
    `INSERT INTO machines (id, user_id, name, token, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, name, token, now]
  )

  const machine: MachineInfo = { id, name, createdAt: now }
  return c.json({ machine, token })
})

machines.patch('/:id', async (c) => {
  const userId = c.get('userId') as string
  const machineId = c.req.param('id')
  const { name } = await c.req.json<{ name?: string }>()

  const db = getDb()
  const existing = db.query<{ id: string }, [string, string]>(
    `SELECT id FROM machines WHERE id = ? AND user_id = ?`
  ).get(machineId, userId)

  if (!existing) {
    return c.json({ error: 'not found' }, 404)
  }

  if (name) {
    db.run(`UPDATE machines SET name = ? WHERE id = ?`, [name, machineId])
  }

  return c.json({ ok: true })
})

machines.delete('/:id', (c) => {
  const userId = c.get('userId') as string
  const machineId = c.req.param('id')

  const db = getDb()
  const existing = db.query<{ id: string }, [string, string]>(
    `SELECT id FROM machines WHERE id = ? AND user_id = ?`
  ).get(machineId, userId)

  if (!existing) {
    return c.json({ error: 'not found' }, 404)
  }

  db.run(`DELETE FROM machines WHERE id = ?`, [machineId])
  return c.json({ ok: true })
})

export default machines
