import chalk from 'chalk'
import { isDaemonRunning } from '../daemon/pid.js'
import { loadConfig } from '../config.js'

export async function statusCommand(): Promise<void> {
  const config = loadConfig()
  const info = isDaemonRunning()

  console.log(chalk.bold('Bed-Vibe'))
  console.log()

  if (!config) {
    console.log(chalk.yellow('  Not configured.') + chalk.gray(' Run: bv config --server <url> --token <token>'))
    return
  }

  console.log(`  Server: ${chalk.cyan(config.serverUrl)}`)
  console.log(`  Token:  ${chalk.gray(config.machineToken.slice(0, 8) + '...')}`)
  console.log()

  if (!info) {
    console.log(`  Daemon: ${chalk.red('stopped')}`)
    console.log(chalk.gray('  Run: bv start'))
    return
  }

  console.log(`  Daemon: ${chalk.green('running')}`)
  console.log(`  PID:    ${info.pid}`)
  console.log(`  Port:   ${info.port}`)
  console.log(`  Uptime: ${formatUptime(Date.now() - info.startedAt)}`)

  // Try to get more info from control server
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/status`, {
      headers: { 'x-token': info.token },
    })
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      if (data.sessions) {
        console.log(`  Sessions: ${data.sessions}`)
      }
    }
  } catch {
    // Control server not responding
  }
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
