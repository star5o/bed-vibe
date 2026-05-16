import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const claudeSettingsPath = join(homedir(), '.claude', 'settings.json')

export function installGlobalHooks(port: number, token: string): void {
  let settings: Record<string, unknown> = {}

  if (existsSync(claudeSettingsPath)) {
    try {
      settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'))
    } catch {
      settings = {}
    }
  }

  const hookCommand = buildHookCommand(port, token)

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>

  hooks['SessionStart'] = [
    {
      matcher: '*',
      hooks: [{ type: 'command', command: hookCommand }],
    },
  ]

  settings.hooks = hooks

  writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2))
}

export function uninstallGlobalHooks(): void {
  if (!existsSync(claudeSettingsPath)) return

  try {
    const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'))
    if (settings.hooks?.SessionStart) {
      const filtered = settings.hooks.SessionStart.filter(
        (h: { hooks?: { command?: string }[] }) =>
          !h.hooks?.some((hh) => hh.command?.includes('bed-vibe-hook'))
      )
      if (filtered.length === 0) {
        delete settings.hooks.SessionStart
      } else {
        settings.hooks.SessionStart = filtered
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks
      }
    }
    writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2))
  } catch {
    // ignore
  }
}

function buildHookCommand(port: number, token: string): string {
  // Inline Node.js script that reads stdin (hook data), adds parent PID, and POSTs to control server
  // The marker 'bed-vibe-hook' is used to identify our hooks for cleanup
  return `node -e "/* bed-vibe-hook */ let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);p._pid=process.ppid;fetch('http://127.0.0.1:${port}/hook/session-start',{method:'POST',headers:{'Content-Type':'application/json','x-token':'${token}'},body:JSON.stringify(p)}).catch(()=>{})}catch(e){}})"`
}
