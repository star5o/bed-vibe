import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import chalk from 'chalk'
import { isDaemonRunning } from '../daemon/pid.js'

export async function startCommand(): Promise<void> {
  const existing = isDaemonRunning()
  if (existing) {
    console.log(chalk.yellow('Daemon already running') + chalk.gray(` (pid=${existing.pid}, port=${existing.port})`))
    return
  }

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const daemonScript = join(__dirname, '..', 'daemon', 'index.js')

  const child = spawn(process.execPath, [daemonScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, BV_DAEMON: '1' },
  })
  child.unref()

  // Wait for PID file to appear
  const startTime = Date.now()
  while (Date.now() - startTime < 5000) {
    await new Promise((r) => setTimeout(r, 200))
    const info = isDaemonRunning()
    if (info) {
      console.log(chalk.green('Daemon started') + chalk.gray(` (pid=${info.pid}, port=${info.port})`))
      return
    }
  }

  console.error(chalk.red('Failed to start daemon (timeout)'))
  process.exit(1)
}
