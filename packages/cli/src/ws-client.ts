import WebSocket from 'ws'
import type { CliToServer, ServerToCli } from '@bed-vibe/shared'

interface WsClientOptions {
  url: string
  token: string
  onMessage: (msg: ServerToCli) => void
  onConnected: () => void
  onDisconnected: () => void
}

export class WsClient {
  private ws: WebSocket | null = null
  private opts: WsClientOptions
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private shouldReconnect = true
  private authenticated = false
  private messageQueue: CliToServer[] = []

  constructor(opts: WsClientOptions) {
    this.opts = opts
  }

  connect(): void {
    this.shouldReconnect = true
    this.doConnect()
  }

  private doConnect(): void {
    const wsUrl = this.opts.url.replace(/^http/, 'ws') + '/ws'
    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', () => {
      this.reconnectDelay = 1000
      this.ws!.send(JSON.stringify({ machineToken: this.opts.token }))
    })

    this.ws.on('message', (data) => {
      const text = data.toString()
      let msg: any
      try {
        msg = JSON.parse(text)
      } catch {
        return
      }

      if (!this.authenticated) {
        if (msg.ok) {
          this.authenticated = true
          this.opts.onConnected()
          this.flushQueue()
        } else if (msg.error) {
          console.error(`[bed-vibe] Auth failed: ${msg.error}`)
          this.shouldReconnect = false
          this.ws?.close()
        }
        return
      }

      this.opts.onMessage(msg as ServerToCli)
    })

    this.ws.on('close', () => {
      this.authenticated = false
      this.opts.onDisconnected()
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      if ((err as any).code !== 'ECONNREFUSED') {
        console.error(`[bed-vibe] WS error: ${err.message}`)
      }
    })
  }

  send(msg: CliToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify(msg))
    } else {
      this.messageQueue.push(msg)
    }
  }

  close(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.ws?.close()
  }

  get connected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!
      this.send(msg)
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
      this.doConnect()
    }, this.reconnectDelay)
  }
}
