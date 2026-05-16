import { env } from 'bun'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

function resolveJwtSecret(dataDir: string): string {
  if (env.RV_JWT_SECRET) return env.RV_JWT_SECRET

  const secretPath = `${dataDir}/.jwt-secret`
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (existsSync(secretPath)) {
    return readFileSync(secretPath, 'utf-8').trim()
  }
  const secret = crypto.randomUUID()
  writeFileSync(secretPath, secret, { mode: 0o600 })
  return secret
}

const dataDir = env.RV_DATA_DIR ?? './data'

export const config = {
  port: Number(env.RV_PORT ?? 3000),
  dataDir,
  get dbPath() {
    return `${this.dataDir}/bed-vibe.db`
  },
  get tokenPath() {
    return `${this.dataDir}/.token`
  },
  jwtSecret: resolveJwtSecret(dataDir),
  vapidPublicKey: env.RV_VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: env.RV_VAPID_PRIVATE_KEY ?? '',
  vapidEmail: env.RV_VAPID_EMAIL ?? 'mailto:admin@example.com',
  sessionTimeoutMs: 5 * 60 * 1000,
  wsHeartbeatMs: 30_000,
  sseHeartbeatMs: 15_000,
}
