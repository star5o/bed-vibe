import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Writable } from 'node:stream'

export interface SDKMessage {
  type: string
  [key: string]: unknown
}

export type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string }

interface RemoteSessionOptions {
  cwd: string
  sessionId: string | null
  hookSettingsPath: string
  onMessage: (msg: SDKMessage) => void
  onPermissionRequest: (toolName: string, input: unknown, requestId: string) => void
  onPermissionCancel: (requestId: string) => void
  onExit: () => void
  signal: AbortSignal
}

export class RemoteSession {
  private process: ChildProcess | null = null
  private stdin: Writable | null = null
  private pendingPermissions = new Map<string, (result: PermissionResult) => void>()
  private opts: RemoteSessionOptions
  private promptQueue: string[] = []
  private waitingForPrompt: ((msg: string | null) => void) | null = null
  private started = false

  constructor(opts: RemoteSessionOptions) {
    this.opts = opts
  }

  async start(): Promise<void> {
    const args = [
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--permission-prompt-tool', 'stdio',
      '--settings', this.opts.hookSettingsPath,
    ]

    if (this.opts.sessionId) {
      args.push('--resume', this.opts.sessionId)
    }

    const child = spawn('claude', args, {
      cwd: this.opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DISABLE_AUTOUPDATER: '1' },
    })

    this.process = child
    this.stdin = child.stdin
    this.started = true

    const rl = createInterface({ input: child.stdout })

    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line)
        this.handleMessage(msg)
      } catch {}
    })

    child.on('close', () => {
      this.started = false
      this.rejectPendingPermissions()
      this.opts.onExit()
    })

    child.on('error', () => {
      this.started = false
      this.opts.onExit()
    })

    this.opts.signal.addEventListener('abort', () => {
      this.interrupt()
    })
  }

  sendPrompt(text: string): void {
    if (this.waitingForPrompt) {
      const resolve = this.waitingForPrompt
      this.waitingForPrompt = null
      resolve(text)
    } else {
      this.promptQueue.push(text)
    }
  }

  resolvePermission(requestId: string, result: PermissionResult): void {
    const resolve = this.pendingPermissions.get(requestId)
    if (resolve) {
      this.pendingPermissions.delete(requestId)
      resolve(result)
    }
  }

  interrupt(): void {
    if (!this.stdin || !this.started) return
    const request = {
      request_id: Math.random().toString(36).slice(2),
      type: 'control_request',
      request: { subtype: 'interrupt' },
    }
    this.stdin.write(JSON.stringify(request) + '\n')
  }

  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
    }
  }

  get isRunning(): boolean {
    return this.started
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'control_request') {
      this.handleControlRequest(msg)
      return
    }
    if (msg.type === 'control_cancel_request') {
      this.opts.onPermissionCancel(msg.request_id)
      const resolve = this.pendingPermissions.get(msg.request_id)
      if (resolve) {
        this.pendingPermissions.delete(msg.request_id)
      }
      return
    }
    if (msg.type === 'control_response') {
      return
    }

    // Regular SDK message — forward
    this.opts.onMessage(msg)

    // If it's a result message, the turn is done — feed next prompt
    if (msg.type === 'result') {
      this.feedNextPrompt()
    }
  }

  private handleControlRequest(msg: any): void {
    if (msg.request?.subtype === 'can_use_tool') {
      const requestId = msg.request_id
      const toolName = msg.request.tool_name
      const input = msg.request.input

      this.opts.onPermissionRequest(toolName, input, requestId)

      this.pendingPermissions.set(requestId, (result) => {
        if (!this.stdin || !this.started) return
        const response = {
          type: 'control_response',
          response: {
            subtype: 'success',
            request_id: requestId,
            response: result,
          },
        }
        this.stdin.write(JSON.stringify(response) + '\n')
      })
    }
  }

  private feedNextPrompt(): void {
    if (this.promptQueue.length > 0) {
      const text = this.promptQueue.shift()!
      this.writeUserMessage(text)
    }
    // Otherwise wait — next sendPrompt() call will trigger writeUserMessage
  }

  private writeUserMessage(text: string): void {
    if (!this.stdin || !this.started) return
    const msg = {
      type: 'user',
      message: { role: 'user', content: text },
    }
    this.stdin.write(JSON.stringify(msg) + '\n')
  }

  private rejectPendingPermissions(): void {
    for (const [, resolve] of this.pendingPermissions) {
      resolve({ behavior: 'deny', message: 'Session ended' })
    }
    this.pendingPermissions.clear()
  }
}
