import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'

const LABEL = 'com.bed-vibe.daemon'

function getPlistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)
}

function getBvPath(): string {
  try {
    return execSync('which bv', { encoding: 'utf-8' }).trim()
  } catch {
    // Fallback: resolve from current package
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      const bin = join(dir, 'bin', 'bv.js')
      if (existsSync(bin)) return bin
      dir = dirname(dir)
    }
    return 'bv'
  }
}

function generatePlist(bvPath: string): string {
  const nodePath = process.execPath
  const logDir = join(homedir(), '.bed-vibe')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${bvPath}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${logDir}/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/launchd.log</string>
</dict>
</plist>`
}

export async function installCommand(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.error(chalk.red('bv install currently only supports macOS (launchd)'))
    console.log(chalk.gray('For Linux, add "bv start" to your crontab or systemd service'))
    process.exit(1)
  }

  const plistPath = getPlistPath()
  const bvPath = getBvPath()

  // Ensure LaunchAgents dir exists
  const agentsDir = dirname(plistPath)
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true })
  }

  const plist = generatePlist(bvPath)
  writeFileSync(plistPath, plist)

  // Load the service
  try {
    execSync(`launchctl unload ${plistPath} 2>/dev/null`, { stdio: 'ignore' })
  } catch {}
  execSync(`launchctl load ${plistPath}`)

  console.log(chalk.green('Installed as login service'))
  console.log(chalk.gray(`  Plist: ${plistPath}`))
  console.log(chalk.gray('  Daemon will auto-start on login'))
}

export async function uninstallCommand(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.error(chalk.red('bv uninstall currently only supports macOS'))
    process.exit(1)
  }

  const plistPath = getPlistPath()

  if (!existsSync(plistPath)) {
    console.log(chalk.yellow('Service not installed'))
    return
  }

  try {
    execSync(`launchctl unload ${plistPath}`, { stdio: 'ignore' })
  } catch {}

  unlinkSync(plistPath)
  console.log(chalk.green('Service uninstalled'))
}
