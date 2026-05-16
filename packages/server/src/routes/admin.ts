import { Hono } from 'hono'
import { getDb } from '../db'
import { getOnlineMachineIds } from '../ws'
import { getSseClientCount } from '../sse'
import type { AppEnv } from '../types'
import type { AdminStats } from '@bed-vibe/shared'

const admin = new Hono<AppEnv>()

admin.use('*', async (c, next) => {
  const role = c.get('userRole')
  if (role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403)
  }
  await next()
})

admin.get('/stats', (c) => {
  const db = getDb()

  const totalUsers = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM users`).get()!.c
  const totalSessions = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM sessions`).get()!.c
  const activeSessions = db.query<{ c: number }, []>(
    `SELECT COUNT(*) as c FROM sessions WHERE status = 'active'`
  ).get()!.c
  const totalMessages = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM messages`).get()!.c
  const machinesTotal = db.query<{ c: number }, []>(`SELECT COUNT(*) as c FROM machines`).get()!.c
  const machinesOnline = getOnlineMachineIds().length

  const stats: AdminStats = {
    totalUsers,
    totalSessions,
    activeSessions,
    totalMessages,
    machinesOnline,
    machinesTotal,
  }

  return c.json(stats)
})

admin.get('/users', (c) => {
  const db = getDb()
  const rows = db.query<any, []>(
    `SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM machines WHERE user_id = u.id) as machine_count,
            (SELECT COUNT(*) FROM sessions s JOIN machines m ON s.machine_id = m.id WHERE m.user_id = u.id) as session_count
     FROM users u ORDER BY u.created_at`
  ).all()

  return c.json({
    users: rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      isAdmin: r.is_admin === 1,
      createdAt: r.created_at,
      machineCount: r.machine_count,
      sessionCount: r.session_count,
    })),
  })
})

export default admin
