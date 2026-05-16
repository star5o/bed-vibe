import { Hono } from 'hono'
import { getDb } from '../db'
import type { AppEnv } from '../types'

interface PendingPairing {
  code: string
  hostname: string
  createdAt: number
  machineToken?: string
  machineName?: string
  userId?: string
}

const pendingPairings = new Map<string, PendingPairing>()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function cleanExpired() {
  const now = Date.now()
  for (const [code, p] of pendingPairings) {
    if (now - p.createdAt > 5 * 60 * 1000) {
      pendingPairings.delete(code)
    }
  }
}

const pairing = new Hono<AppEnv>()

// CLI calls this (no auth required) to get a pairing code
pairing.post('/request', async (c) => {
  cleanExpired()

  const { hostname } = await c.req.json<{ hostname?: string }>().catch(() => ({ hostname: undefined }))

  let code: string
  do {
    code = generateCode()
  } while (pendingPairings.has(code))

  pendingPairings.set(code, {
    code,
    hostname: hostname || 'unknown',
    createdAt: Date.now(),
  })

  return c.json({ code, expiresIn: 300 })
})

// CLI polls this (no auth required) to check if pairing is complete
pairing.get('/status/:code', (c) => {
  const code = c.req.param('code').toUpperCase()
  const entry = pendingPairings.get(code)

  if (!entry) {
    return c.json({ status: 'expired' })
  }

  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    pendingPairings.delete(code)
    return c.json({ status: 'expired' })
  }

  if (entry.machineToken) {
    pendingPairings.delete(code)
    return c.json({ status: 'paired', token: entry.machineToken })
  }

  return c.json({ status: 'pending' })
})

// Web calls this (auth required) to complete pairing
pairing.post('/complete', async (c) => {
  const userId = c.get('userId') as string
  const { code, name } = await c.req.json<{ code: string; name: string }>()

  if (!code || !name) {
    return c.json({ error: 'code and name required' }, 400)
  }

  const upperCode = code.toUpperCase()
  const entry = pendingPairings.get(upperCode)

  if (!entry) {
    return c.json({ error: 'invalid or expired code' }, 404)
  }

  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    pendingPairings.delete(upperCode)
    return c.json({ error: 'code expired' }, 410)
  }

  const db = getDb()
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const now = Date.now()

  db.run(
    `INSERT INTO machines (id, user_id, name, token, hostname, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, name, token, entry.hostname, now]
  )

  // Store token so CLI can pick it up on next poll
  entry.machineToken = token
  entry.machineName = name
  entry.userId = userId

  return c.json({ ok: true, machineId: id })
})

export default pairing
