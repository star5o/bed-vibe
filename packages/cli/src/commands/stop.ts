import chalk from 'chalk'
import { isDaemonRunning, removeDaemonInfo } from '../daemon/pid.js'

export async function stopCommand(): Promise<void> {
  const info = isDaemonRunning()
  if (!info) {
    console.log(chalk.yellow('Daemon is not running'))
    return
  }

  // Try graceful stop via control server
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/stop`, {
      method: 'POST',
      headers: { 'x-token': info.token },
    })
    if (res.ok) {
      // Wait for process to exit
      const startTime = Date.now()
      while (Date.now() - startTime < 3000) {
        await new Promise((r) => setTimeout(r, 200))
        try {
          process.kill(info.pid, 0)
        } catch {
          console.log(chalk.green('Daemon stopped'))
          return
        }
      }
    }
  } catch {
    // Control server not responding, force kill
  }

  // Force kill
  try {
    process.kill(info.pid, 'SIGTERM')
    await new Promise((r) => setTimeout(r, 500))
    console.log(chalk.green('Daemon stopped (forced)'))
  } catch {
    console.log(chalk.yellow('Daemon process already gone'))
  }

  removeDaemonInfo()
}
