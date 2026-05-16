import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const configDir = join(homedir(), '.bed-vibe')
const configPath = join(configDir, 'config.json')

export interface CliConfig {
  serverUrl: string
  machineToken: string
}

export function ensureConfigDir(): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
}

export function loadConfig(): CliConfig | null {
  if (!existsSync(configPath)) return null
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (raw.token && !raw.machineToken) {
      raw.machineToken = raw.token
    }
    if (!raw.serverUrl || !raw.machineToken) return null
    return { serverUrl: raw.serverUrl, machineToken: raw.machineToken }
  } catch {
    return null
  }
}

export function saveConfig(config: CliConfig): void {
  ensureConfigDir()
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
}
