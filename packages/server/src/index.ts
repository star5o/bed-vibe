import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config'
import { getDb } from './db'
import { verifyJwt } from './auth'
import { getWsHandlers, sendToCli } from './ws'
import { userOwnsSession } from './ownership'
import type { AppEnv } from './types'
import authRoute from './routes/auth'
import usersRoute from './routes/users'
import machinesRoute from './routes/machines'
import machineActionsRoute from './routes/machine-actions'
import sessionsRoute from './routes/sessions'
import messagesRoute from './routes/messages'
import permissionsRoute from './routes/permissions'
import sessionControlsRoute from './routes/session-controls'
import spawnRoute from './routes/spawn'
import pushRoute from './routes/push'
import adminRoute from './routes/admin'
import pairingRoute from './routes/pairing'
import eventsRoute from './routes/events'

const app = new Hono<AppEnv>()

app.use('*', cors())

// JWT auth middleware for API routes (except /api/auth and /api/pairing unauthenticated endpoints)
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth')) return next()
  if (c.req.path.startsWith('/api/pairing/request')) return next()
  if (c.req.path.startsWith('/api/pairing/status')) return next()

  const queryToken = new URL(c.req.url).searchParams.get('token')
  const authHeader = c.req.header('Authorization')

  let token: string | null = null
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (queryToken) {
    token = queryToken
  }

  if (!token) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  c.set('userId', payload.sub)
  c.set('userRole', payload.role)
  return next()
})

// API routes
app.route('/api/auth', authRoute)
app.route('/api/users', usersRoute)
app.route('/api/machines', machinesRoute)
app.route('/api/machines', machineActionsRoute)
app.route('/api/sessions', sessionsRoute)
app.route('/api/sessions', messagesRoute)
app.route('/api/sessions', permissionsRoute)
app.route('/api/sessions', sessionControlsRoute)
app.route('/api/sessions/spawn', spawnRoute)
app.route('/api/push', pushRoute)
app.route('/api/admin', adminRoute)
app.route('/api/pairing', pairingRoute)
app.route('/api/events', eventsRoute)

// Abort endpoint
app.post('/api/sessions/:id/abort', (c) => {
  const userId = c.get('userId')
  const sessionId = c.req.param('id')
  if (!userOwnsSession(userId, sessionId)) {
    return c.json({ error: 'not found' }, 404)
  }
  sendToCli(sessionId, { t: 'abort', sid: sessionId })
  return c.json({ ok: true })
})

// Initialize
getDb()

// Static file serving
const __dirname = dirname(fileURLToPath(import.meta.url))
const publicRoot = resolve(__dirname, '../public')

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

function getMimeType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'))
  return mimeTypes[ext] ?? 'application/octet-stream'
}

async function serveStaticFile(pathname: string): Promise<Response | null> {
  const safePath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(publicRoot, safePath.slice(1))

  if (!filePath.startsWith(publicRoot)) return null

  const file = Bun.file(filePath)
  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': getMimeType(filePath) },
    })
  }
  return null
}

const server = Bun.serve({
  port: config.port,
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, { data: { authenticated: false } })
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    if (url.pathname.startsWith('/api')) {
      return app.fetch(req, { ip: server.requestIP(req) })
    }

    const staticResponse = await serveStaticFile(url.pathname)
    if (staticResponse) return staticResponse

    const indexFile = Bun.file(resolve(publicRoot, 'index.html'))
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    return new Response('Not Found', { status: 404 })
  },
  websocket: getWsHandlers(),
})

console.log(`
  Bed-Vibe Server running on port ${config.port}
  WebSocket: ws://localhost:${config.port}/ws
  API: http://localhost:${config.port}/api
`)
