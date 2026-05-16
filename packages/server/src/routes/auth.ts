import { Hono } from 'hono'
import { getDb } from '../db'
import {
  createJwt,
  hashPassword,
  verifyPassword,
  needsSetup,
  isRegistrationEnabled,
} from '../auth'

const auth = new Hono()

auth.get('/status', (c) => {
  return c.json({
    needsSetup: needsSetup(),
    registrationEnabled: isRegistrationEnabled(),
  })
})

auth.post('/register', async (c) => {
  const isSetup = needsSetup()
  if (!isSetup && !isRegistrationEnabled()) {
    return c.json({ error: 'registration disabled' }, 403)
  }

  const { username, password, displayName } = await c.req.json<{
    username: string
    password: string
    displayName?: string
  }>()

  if (!username || !password || username.length < 2 || password.length < 6) {
    return c.json({ error: 'username (2+ chars) and password (6+ chars) required' }, 400)
  }

  const db = getDb()
  const existing = db.query<{ id: string }, [string]>(
    `SELECT id FROM users WHERE username = ?`
  ).get(username)

  if (existing) {
    return c.json({ error: 'username taken' }, 409)
  }

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const isAdmin = isSetup ? 1 : 0
  const now = Date.now()

  db.run(
    `INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username, passwordHash, displayName ?? null, isAdmin, now]
  )

  const role = isAdmin ? 'admin' : 'user'
  const jwt = await createJwt(id, role as 'admin' | 'user')
  return c.json({ jwt })
})

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{
    username: string
    password: string
  }>()

  if (!username || !password) {
    return c.json({ error: 'username and password required' }, 400)
  }

  const db = getDb()
  const user = db.query<{
    id: string
    password_hash: string
    is_admin: number
  }, [string]>(
    `SELECT id, password_hash, is_admin FROM users WHERE username = ?`
  ).get(username)

  if (!user) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  // Upgrade legacy unhashed password to argon2
  if (!user.password_hash.startsWith('$argon2')) {
    const newHash = await hashPassword(password)
    db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, user.id])
  }

  const role = user.is_admin ? 'admin' : 'user'
  const jwt = await createJwt(user.id, role as 'admin' | 'user')
  return c.json({ jwt })
})

export default auth
