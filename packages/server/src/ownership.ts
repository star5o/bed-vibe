import { getDb } from './db'

export function getUserMachineIds(userId: string): string[] {
  const db = getDb()
  const rows = db.query<{ id: string }, [string]>(
    `SELECT id FROM machines WHERE user_id = ?`
  ).all(userId)
  return rows.map(r => r.id)
}

export function userOwnsSession(userId: string, sessionId: string): boolean {
  const db = getDb()
  const row = db.query<{ id: string }, [string, string]>(
    `SELECT s.id FROM sessions s
     JOIN machines m ON s.machine_id = m.id
     WHERE s.id = ? AND m.user_id = ?`
  ).get(sessionId, userId)
  return !!row
}

export function userOwnsMachine(userId: string, machineId: string): boolean {
  const db = getDb()
  const row = db.query<{ id: string }, [string, string]>(
    `SELECT id FROM machines WHERE id = ? AND user_id = ?`
  ).get(machineId, userId)
  return !!row
}
