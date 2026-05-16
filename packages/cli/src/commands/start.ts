import { spawn } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import chalk from 'chalk'
import { isDaemonRunning } from '../daemon/pid.js'

function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  return dirname(fileURLToPath(import.meta.url))
}

export async function startCommand(): Promise<void> {
  const existing = isDaemonRunning()
  if (existing) {
    console.log(chalk.yellow('Daemon already running') + chalk.gray(` (pid=${existing.pid}, port=${existing.port})`))
    return
  }

  const pkgRoot = findPackageRoot()
  const daemonScript = resolve(pkgRoot, 'dist', 'index.js')

  if (!existsSync(daemonScript)) {
    console.error(chalk.red(`Daemon script not found: ${daemonScript}`))
    process.exit(1)
  }

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
