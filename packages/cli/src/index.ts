import chalk from 'chalk'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  // If running as daemon process
  if (process.env.BV_DAEMON === '1') {
    const { runDaemon } = await import('./daemon/index.js')
    return runDaemon()
  }

  switch (command) {
    case 'init':
      const { initCommand } = await import('./commands/init.js')
      return initCommand(args.slice(1))

    case 'start':
      const { startCommand } = await import('./commands/start.js')
      return startCommand()

    case 'stop':
      const { stopCommand } = await import('./commands/stop.js')
      return stopCommand()

    case 'status':
      const { statusCommand } = await import('./commands/status.js')
      return statusCommand()

    case 'config':
      const { configCommand } = await import('./commands/config.js')
      return configCommand(args.slice(1))

    case '--help':
    case '-h':
    case 'help':
      return printHelp()

    case '--version':
    case '-V':
      console.log('bed-vibe 0.3.0')
      return

    default:
      printHelp()
      return
  }
}

function printHelp() {
  console.log(`
${chalk.bold('bv')} — Bed-Vibe: Claude Code on your phone

${chalk.bold('Usage:')}
  bv init <server-url>  Pair this machine with the server
  bv start              Start the daemon (background service)
  bv stop               Stop the daemon
  bv status             Show daemon status and connection info
  bv config             Configure server connection manually

${chalk.bold('Quick Start:')}
  bv init http://your-server:31001
  bv start

${chalk.bold('How it works:')}
  Once the daemon is running, use ${chalk.cyan('claude')} as normal.
  The daemon auto-detects sessions and bridges them to your phone.
`)
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err.message)
  process.exit(1)
})
