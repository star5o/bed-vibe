import { loadConfig } from '../config.js'
import { WsClient } from '../ws-client.js'
import { ControlServer } from './control-server.js'
import { SessionManager } from './session-manager.js'
import { installGlobalHooks, uninstallGlobalHooks } from './hook-installer.js'
import { writeDaemonInfo, removeDaemonInfo } from './pid.js'
import type { ServerToCli } from '@bed-vibe/shared'

export async function runDaemon(): Promise<void> {
  const config = loadConfig()
  if (!config) {
    console.error('Not configured. Run: bv config --server <url> --token <token>')
    process.exit(1)
  }

  let shutdownRequested = false

  // 1. Start control server
  const controlServer = new ControlServer({
    onSessionStart: ({ sessionId, transcriptPath, cwd, model, pid }) => {
      if (sessionId && transcriptPath) {
        sessionManager.observeSession(sessionId, transcriptPath, cwd || process.cwd(), model, pid)
      }
    },
    onStopRequested: () => {
      shutdownRequested = true
      shutdown()
    },
  })

  await controlServer.start()

  // 2. Write PID file
  writeDaemonInfo({
    pid: process.pid,
    port: controlServer.port,
    token: controlServer.token,
    startedAt: Date.now(),
  })

  // 3. Install global hooks
  installGlobalHooks(controlServer.port, controlServer.token)

  // 4. Connect to server via WebSocket
  const ws = new WsClient({
    url: config.serverUrl,
    token: config.machineToken,
    onConnected: () => {
      console.log(`[bed-vibe] Connected to ${config.serverUrl}`)
    },
    onDisconnected: () => {
      console.log('[bed-vibe] Disconnected, reconnecting...')
    },
    onMessage: (msg: ServerToCli) => {
      sessionManager.handleServerMessage(msg)
    },
  })
  ws.connect()

  // 5. Initialize session manager
  const sessionManager = new SessionManager({ ws })

  // 6. Handle signals
  async function shutdown() {
    if (shutdownRequested) return
    shutdownRequested = true

    console.log('[bed-vibe] Shutting down...')
    await sessionManager.shutdown()
    uninstallGlobalHooks()
    ws.close()
    controlServer.stop()
    removeDaemonInfo()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log(`[bed-vibe] Daemon started (pid=${process.pid}, port=${controlServer.port})`)

  // Keep alive
  setInterval(() => {}, 60_000)
}
