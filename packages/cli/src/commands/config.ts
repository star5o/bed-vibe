import chalk from 'chalk'
import { saveConfig } from '../config.js'

export function configCommand(args: string[]): void {
  let server: string | undefined
  let token: string | undefined

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--server' || args[i] === '-s') && args[i + 1]) {
      server = args[++i]
    } else if ((args[i] === '--token' || args[i] === '-t' || args[i] === '--machine-token') && args[i + 1]) {
      token = args[++i]
    }
  }

  if (!server || !token) {
    console.error(chalk.red('Usage:') + ' bv config --server <url> --token <machine-token>')
    process.exit(1)
  }

  saveConfig({ serverUrl: server, machineToken: token })
  console.log(chalk.green('Config saved') + chalk.gray(' → ~/.bed-vibe/config.json'))
}
