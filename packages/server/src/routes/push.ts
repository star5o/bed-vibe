import { Hono } from 'hono'
import { getDb } from '../db'
import { config } from '../config'
import type { AppEnv } from '../types'

const push = new Hono<AppEnv>()

push.get('/vapid-key', (c) => {
  const publicKey = config.vapidPublicKey
  if (!publicKey) {
    return c.json({ error: 'push not configured' }, 503)
  }
  return c.json({ publicKey })
})

push.post('/subscribe', async (c) => {
  const userId = c.get('userId') as string
  const { endpoint, keys } = await c.req.json<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  }>()

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ error: 'invalid subscription' }, 400)
  }

  const db = getDb()
  const id = crypto.randomUUID()
  const now = Date.now()

  db.run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?, auth = ?, user_id = ?`,
    [id, userId, endpoint, keys.p256dh, keys.auth, now, keys.p256dh, keys.auth, userId]
  )

  return c.json({ ok: true })
})

push.post('/unsubscribe', async (c) => {
  const userId = c.get('userId') as string
  const { endpoint } = await c.req.json<{ endpoint: string }>()

  if (!endpoint) return c.json({ error: 'endpoint required' }, 400)

  const db = getDb()
  db.run(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`, [endpoint, userId])

  return c.json({ ok: true })
})

export default push
