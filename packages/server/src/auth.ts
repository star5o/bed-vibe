import { SignJWT, jwtVerify } from 'jose'
import { config } from './config'
import { getDb } from './db'

let jwtSecretKey: Uint8Array

function getSecretKey(): Uint8Array {
  if (!jwtSecretKey) {
    jwtSecretKey = new TextEncoder().encode(config.jwtSecret)
  }
  return jwtSecretKey
}

export interface JwtPayload {
  sub: string
  role: 'admin' | 'user'
}

export async function createJwt(userId: string, role: 'admin' | 'user'): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (!payload.sub) return null
    return { sub: payload.sub, role: (payload.role as string) === 'admin' ? 'admin' : 'user' }
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Handle legacy migration: unhashed token stored as password_hash
  if (!hash.startsWith('$argon2')) {
    return password === hash
  }
  return Bun.password.verify(password, hash)
}

export function validateMachineToken(token: string): { machineId: string; userId: string } | null {
  const db = getDb()
  const row = db.query<{ id: string; user_id: string }, [string]>(
    `SELECT id, user_id FROM machines WHERE token = ?`
  ).get(token)
  if (!row) return null
  return { machineId: row.id, userId: row.user_id }
}

export function needsSetup(): boolean {
  const db = getDb()
  const row = db.query<{ count: number }, []>(
    `SELECT COUNT(*) as count FROM users`
  ).get()
  return (row?.count ?? 0) === 0
}

export function isRegistrationEnabled(): boolean {
  const db = getDb()
  const row = db.query<{ value: string }, [string]>(
    `SELECT value FROM settings WHERE key = ?`
  ).get('registration_enabled')
  return row?.value === 'true'
}
