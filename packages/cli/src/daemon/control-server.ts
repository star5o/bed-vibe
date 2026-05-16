import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

export interface ControlServerOptions {
  onSessionStart: (data: {
    sessionId: string
    transcriptPath?: string
    cwd?: string
    model?: string
    pid?: number
  }) => void
  onStopRequested: () => void
}

export class ControlServer {
  private server: ReturnType<typeof createServer>
  private _port = 0
  private _token: string

  constructor(private opts: ControlServerOptions) {
    this._token = randomUUID()
    this.server = createServer((req, res) => this.handleRequest(req, res))
  }

  get port(): number { return this._port }
  get token(): string { return this._token }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address()
        if (addr && typeof addr === 'object') {
          this._port = addr.port
        }
        resolve()
      })
    })
  }

  stop(): void {
    this.server.close()
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const token = req.headers['x-token'] as string
    if (token !== this._token && req.url !== '/health') {
      res.writeHead(401)
      res.end('unauthorized')
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, pid: process.pid, uptime: process.uptime() }))
      return
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, pid: process.pid, uptime: process.uptime() }))
      return
    }

    if (req.method === 'POST' && req.url === '/stop') {
      res.writeHead(200)
      res.end('stopping')
      this.opts.onStopRequested()
      return
    }

    if (req.method === 'POST' && req.url === '/hook/session-start') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          this.opts.onSessionStart({
            sessionId: data.session_id,
            transcriptPath: data.transcript_path,
            cwd: data.cwd,
            model: data.model,
            pid: data._pid,
          })
          res.writeHead(200)
          res.end('ok')
        } catch {
          res.writeHead(400)
          res.end('bad request')
        }
      })
      return
    }

    res.writeHead(404)
    res.end('not found')
  }
}
