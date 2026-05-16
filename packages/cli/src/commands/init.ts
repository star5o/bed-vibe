import chalk from 'chalk'
import { hostname } from 'node:os'
import { saveConfig } from '../config.js'

export async function initCommand(args: string[]): Promise<void> {
  const serverUrl = args[0]
  if (!serverUrl) {
    console.error(chalk.red('Usage: bv init <server-url>'))
    console.error(chalk.gray('  Example: bv init http://38.76.221.34:31001'))
    process.exit(1)
  }

  const url = serverUrl.replace(/\/$/, '')

  // Request a pairing code
  console.log(chalk.gray(`Connecting to ${url}...`))

  let code: string
  try {
    const res = await fetch(`${url}/api/pairing/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname: hostname() }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as any
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    const data = await res.json() as { code: string }
    code = data.code
  } catch (err: any) {
    console.error(chalk.red(`Failed to connect: ${err.message}`))
    process.exit(1)
  }

  console.log()
  console.log(chalk.bold('  配对码 / Pairing Code:'))
  console.log()
  console.log(chalk.cyan.bold(`    ${code}`))
  console.log()
  console.log(chalk.gray('  请在 Web 端「添加机器」中输入此配对码'))
  console.log(chalk.gray('  Enter this code in the web dashboard under "Add Machine"'))
  console.log(chalk.gray(`  有效期 5 分钟 / Expires in 5 minutes`))
  console.log()

  // Poll for completion
  const startTime = Date.now()
  const pollInterval = 2000

  while (Date.now() - startTime < 5 * 60 * 1000) {
    await new Promise(r => setTimeout(r, pollInterval))

    try {
      const res = await fetch(`${url}/api/pairing/status/${code}`)
      const data = await res.json() as { status: string; token?: string }

      if (data.status === 'paired' && data.token) {
        saveConfig({ serverUrl: url, machineToken: data.token })
        console.log(chalk.green('✓ 配对成功！/ Paired successfully!'))
        console.log(chalk.gray(`  Token saved. Run ${chalk.cyan('bv start')} to start the daemon.`))
        return
      }

      if (data.status === 'expired') {
        console.error(chalk.red('配对码已过期 / Pairing code expired'))
        process.exit(1)
      }
    } catch {
      // Network error, keep polling
    }
  }

  console.error(chalk.red('超时 / Timed out waiting for pairing'))
  process.exit(1)
}
