import { Hono } from 'hono'
import { getDb } from '../db'
import { hashPassword, verifyPassword } from '../auth'
import type { AppEnv } from '../types'
import type { UserInfo } from '@bed-vibe/shared'

const users = new Hono<AppEnv>()

users.get('/me', (c) => {
  const userId = c.get('userId') as string
  const db = getDb()

  const row = db.query<any, [string]>(
    `SELECT id, username, display_name, is_admin, created_at FROM users WHERE id = ?`
  ).get(userId)

  if (!row) {
    return c.json({ error: 'not found' }, 404)
  }

  const user: UserInfo = {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? undefined,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  }

  return c.json({ user })
})

users.patch('/me', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{
    displayName?: string
    currentPassword?: string
    newPassword?: string
  }>()

  const db = getDb()

  if (body.displayName !== undefined) {
    db.run(`UPDATE users SET display_name = ? WHERE id = ?`, [body.displayName, userId])
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return c.json({ error: 'current password required' }, 400)
    }
    if (body.newPassword.length < 6) {
      return c.json({ error: 'new password must be 6+ chars' }, 400)
    }

    const user = db.query<{ password_hash: string }, [string]>(
      `SELECT password_hash FROM users WHERE id = ?`
    ).get(userId)

    if (!user) return c.json({ error: 'not found' }, 404)

    const valid = await verifyPassword(body.currentPassword, user.password_hash)
    if (!valid) {
      return c.json({ error: 'current password incorrect' }, 401)
    }

    const newHash = await hashPassword(body.newPassword)
    db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId])
  }

  return c.json({ ok: true })
})

export default users
