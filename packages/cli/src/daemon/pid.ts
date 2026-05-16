import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { configDir, ensureConfigDir } from '../config.js'

export interface DaemonInfo {
  pid: number
  port: number
  token: string
  startedAt: number
}

const pidPath = join(configDir, 'daemon.json')

export function writeDaemonInfo(info: DaemonInfo): void {
  ensureConfigDir()
  writeFileSync(pidPath, JSON.stringify(info, null, 2), { mode: 0o600 })
}

export function readDaemonInfo(): DaemonInfo | null {
  if (!existsSync(pidPath)) return null
  try {
    return JSON.parse(readFileSync(pidPath, 'utf-8'))
  } catch {
    return null
  }
}

export function removeDaemonInfo(): void {
  if (existsSync(pidPath)) unlinkSync(pidPath)
}

export function isDaemonRunning(): DaemonInfo | null {
  const info = readDaemonInfo()
  if (!info) return null
  try {
    process.kill(info.pid, 0)
    return info
  } catch {
    removeDaemonInfo()
    return null
  }
}
