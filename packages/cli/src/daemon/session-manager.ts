import { existsSync, statSync } from 'node:fs'
import { SessionScanner } from '../session-scanner.js'
import { RemoteSession, type PermissionResult, type SDKMessage } from '../remote-session.js'
import { WsClient } from '../ws-client.js'
import type { ServerToCli } from '@bed-vibe/shared'

export interface ManagedSession {
  id: string
  mode: 'observing' | 'remote'
  cwd: string
  model?: string
  scanner?: SessionScanner
  remote?: RemoteSession
  localPid?: number
}

export interface SessionManagerOptions {
  ws: WsClient
  hookSettingsPath?: string
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>()
  private ws: WsClient

  constructor(opts: SessionManagerOptions) {
    this.ws = opts.ws
  }

  getSessions(): ManagedSession[] {
    return [...this.sessions.values()]
  }

  getSession(sid: string): ManagedSession | undefined {
    return this.sessions.get(sid)
  }

  observeSession(id: string, transcriptPath: string, cwd: string, model?: string, pid?: number): void {
    if (this.sessions.has(id)) return

    const session: ManagedSession = { id, mode: 'observing', cwd, model, localPid: pid }

    const scanner = new SessionScanner({
      onMessages: (messages) => {
        if (messages.length === 1) {
          this.ws.send({ t: 'msg', sid: id, content: messages[0] })
        } else if (messages.length > 1) {
          this.ws.send({ t: 'msg.batch', sid: id, messages })
        }
      },
      onStatus: (status) => {
        this.ws.send({ t: 'session.status', sid: id, status: status as 'thinking' | 'idle' | 'tool_running' })
      },
    })

    if (transcriptPath) {
      scanner.setSession(transcriptPath)
    }

    session.scanner = scanner
    this.sessions.set(id, session)

    this.ws.send({
      t: 'session.start',
      sid: id,
      agent: 'claude',
      cwd,
      model,
      source: 'local',
      pid,
    })
  }

  async switchToRemote(sid: string, initialPrompt?: string): Promise<void> {
    const session = this.sessions.get(sid)
    if (!session) return

    // Stop scanner
    if (session.scanner) {
      await session.scanner.stop()
      session.scanner = undefined
    }

    // Kill local claude process if we have its PID
    if (session.localPid) {
      try { process.kill(session.localPid, 'SIGTERM') } catch {}
      session.localPid = undefined
    }

    session.mode = 'remote'

    const remote = new RemoteSession({
      cwd: session.cwd,
      sessionId: sid,
      hookSettingsPath: '',
      signal: new AbortController().signal,
      onMessage: (msg: SDKMessage) => {
        this.ws.send({ t: 'msg', sid, content: msg })
        if (msg.type === 'result') {
          this.ws.send({ t: 'session.status', sid, status: 'idle' })
          const usage = msg.usage as Record<string, number> | undefined
          if (usage) {
            this.ws.send({
              t: 'usage',
              sid,
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              cacheRead: usage.cache_read_input_tokens || 0,
              cacheWrite: usage.cache_creation_input_tokens || 0,
              cost: usage.cost_usd || 0,
            })
          }
        } else if (msg.type === 'assistant') {
          this.ws.send({ t: 'session.status', sid, status: 'thinking' })
        }
      },
      onPermissionRequest: (tool, input, requestId) => {
        this.ws.send({ t: 'perm.req', sid, id: requestId, tool, input })
      },
      onPermissionCancel: () => {},
      onExit: () => {
        session.mode = 'observing'
        session.remote = undefined
        this.ws.send({ t: 'session.status', sid, status: 'idle' })
      },
    })

    session.remote = remote
    await remote.start()

    if (initialPrompt) {
      remote.sendPrompt(initialPrompt)
    }
  }

  async spawnSession(cwd: string, model?: string, prompt?: string): Promise<string | null> {
    let resolvedSid: string | null = null

    const remote = new RemoteSession({
      cwd,
      sessionId: null as unknown as string,
      hookSettingsPath: '',
      signal: new AbortController().signal,
      onMessage: (msg: SDKMessage) => {
        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          const sid = msg.session_id as string
          resolvedSid = sid
          const session: ManagedSession = { id: sid, mode: 'remote', cwd, model, remote }
          this.sessions.set(sid, session)

          this.ws.send({
            t: 'session.start',
            sid,
            agent: 'claude',
            cwd,
            model,
            source: 'remote',
          })
        }

        const sid = this.findSidByRemote(remote)
        if (sid) {
          this.ws.send({ t: 'msg', sid, content: msg })
          if (msg.type === 'result') {
            this.ws.send({ t: 'session.status', sid, status: 'idle' })
          } else if (msg.type === 'assistant') {
            this.ws.send({ t: 'session.status', sid, status: 'thinking' })
          }
        }
      },
      onPermissionRequest: (tool: string, input: unknown, requestId: string) => {
        const sid = this.findSidByRemote(remote)
        if (sid) {
          this.ws.send({ t: 'perm.req', sid, id: requestId, tool, input })
        }
      },
      onPermissionCancel: () => {},
      onExit: () => {
        const sid = this.findSidByRemote(remote)
        if (sid) {
          this.sessions.delete(sid)
          this.ws.send({ t: 'session.end', sid })
        }
      },
    })

    await remote.start()
    if (prompt) {
      remote.sendPrompt(prompt)
    }

    // Wait briefly for session init
    await new Promise((r) => setTimeout(r, 2000))
    return resolvedSid
  }

  handleServerMessage(msg: ServerToCli): void {
    switch (msg.t) {
      case 'user.msg': {
        const session = this.sessions.get(msg.sid)
        if (!session) return
        if (session.mode === 'observing') {
          this.switchToRemote(msg.sid, msg.text)
        } else if (session.remote) {
          session.remote.sendPrompt(msg.text)
        }
        break
      }

      case 'perm.res': {
        const session = this.sessions.get(msg.sid)
        if (session?.remote) {
          const result: PermissionResult = msg.approved
            ? { behavior: 'allow' }
            : { behavior: 'deny', message: 'Denied by user' }
          session.remote.resolvePermission(msg.id, result)
        }
        break
      }

      case 'abort': {
        const session = this.sessions.get(msg.sid)
        if (session?.remote) {
          session.remote.interrupt()
        }
        break
      }

      case 'set-model': {
        const session = this.sessions.get(msg.sid)
        if (session) session.model = msg.model
        // TODO: forward to claude process if supported
        break
      }

      case 'set-effort': {
        const session = this.sessions.get(msg.sid)
        if (session) {
          // TODO: forward to claude process
        }
        break
      }

      case 'slash-cmd': {
        const session = this.sessions.get(msg.sid)
        if (session?.remote) {
          session.remote.sendPrompt(msg.command)
        }
        break
      }

      case 'check-path': {
        const exists = existsSync(msg.path)
        const isDir = exists ? statSync(msg.path).isDirectory() : false
        this.ws.send({ t: 'rpc.res', requestId: msg.requestId, result: { exists, isDir } })
        break
      }

      case 'spawn': {
        this.spawnSession(msg.cwd, msg.model, msg.prompt).then((sid) => {
          this.ws.send({
            t: 'rpc.res',
            requestId: msg.requestId,
            result: sid ? { sessionId: sid } : undefined,
            error: sid ? undefined : 'Failed to spawn session',
          })
        })
        break
      }

      case 'replay': {
        for (const m of msg.messages) {
          this.handleServerMessage(m)
        }
        break
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const [, session] of this.sessions) {
      if (session.scanner) await session.scanner.stop()
      if (session.remote) session.remote.kill()
    }
    this.sessions.clear()
  }

  private findSidByRemote(remote: RemoteSession): string | null {
    for (const [sid, session] of this.sessions) {
      if (session.remote === remote) return sid
    }
    return null
  }
}
