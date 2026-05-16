import { readFile } from 'node:fs/promises'

const INTERNAL_EVENT_TYPES = new Set([
  'file-history-snapshot',
  'change',
  'queue-operation',
  'permission-mode',
  'attachment',
])

interface ScannerOptions {
  onMessages: (messages: unknown[]) => void
  onStatus: (status: 'thinking' | 'idle') => void
}

export class SessionScanner {
  private opts: ScannerOptions
  private sessionFile: string | null = null
  private cursor = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(opts: ScannerOptions) {
    this.opts = opts
  }

  setSession(transcriptPath: string): void {
    this.sessionFile = transcriptPath
    this.initCursor().then(() => {
      this.startPolling()
    })
  }

  private async initCursor(): Promise<void> {
    if (!this.sessionFile) return
    try {
      const content = await readFile(this.sessionFile, 'utf-8')
      const lines = content.split('\n').filter(Boolean)
      this.cursor = lines.length
    } catch {
      this.cursor = 0
    }
  }

  private startPolling(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.scan(), 1000)
    this.scan()
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await this.scan()
  }

  private async scan(): Promise<void> {
    if (!this.sessionFile) return

    let content: string
    try {
      content = await readFile(this.sessionFile, 'utf-8')
    } catch {
      return
    }

    const lines = content.split('\n').filter(Boolean)
    if (lines.length <= this.cursor) return

    const newLines = lines.slice(this.cursor)
    this.cursor = lines.length

    const messages: unknown[] = []

    for (const line of newLines) {
      let parsed: any
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }

      if (INTERNAL_EVENT_TYPES.has(parsed.type)) continue

      if (parsed.type === 'assistant') {
        this.opts.onStatus('thinking')
      }

      if (parsed.type === 'user' || parsed.type === 'assistant' || parsed.type === 'system' || parsed.type === 'summary') {
        messages.push(parsed)
      }
    }

    if (messages.length > 0) {
      this.opts.onMessages(messages)
    }

    const lastMsg = messages[messages.length - 1] as any
    if (lastMsg?.type === 'system' && lastMsg?.subtype === 'turn_duration') {
      this.opts.onStatus('idle')
    }
  }
}
