import { useEffect, useRef, useState, useCallback } from 'react'
import { getToken } from '@/api/client'
import type { SseEvent } from '@bed-vibe/shared'

interface UseSseOptions {
  sessionId?: string
  onEvent?: (event: SseEvent) => void
  onSessionUpdate?: (sid: string, status: 'active' | 'inactive' | 'archived', thinking: boolean) => void
  onMessage?: (event: SseEvent) => void
  onPermission?: (event: SseEvent) => void
  onMachineStatus?: (machineId: string, online: boolean) => void
}

export function useSse(opts: UseSseOptions) {
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const lastEventIdRef = useRef(0)
  const optsRef = useRef(opts)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  optsRef.current = opts

  useEffect(() => {
    mountedRef.current = true

    function connect() {
      if (!mountedRef.current) return
      const token = getToken()
      if (!token) return

      const params = new URLSearchParams()
      params.set('token', token)
      if (opts.sessionId) params.set('sessionId', opts.sessionId)
      if (lastEventIdRef.current > 0) params.set('lastEventId', lastEventIdRef.current.toString())

      const url = `/api/events?${params.toString()}`
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        if (mountedRef.current) setConnected(true)
      }
      es.onerror = () => {
        setConnected(false)
        es.close()
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }
      }

      const handleEvent = (e: MessageEvent) => {
        try {
          const data: SseEvent = JSON.parse(e.data)
          if (e.lastEventId) {
            const id = Number(e.lastEventId)
            if (id > 0) lastEventIdRef.current = Math.max(lastEventIdRef.current, id)
          }

          optsRef.current.onEvent?.(data)

          if (data.type === 'session.update') {
            optsRef.current.onSessionUpdate?.(data.sid, data.status, data.thinking)
          } else if (data.type === 'msg') {
            optsRef.current.onMessage?.(data)
          } else if (data.type === 'perm.req' || data.type === 'perm.resolved') {
            optsRef.current.onPermission?.(data)
          } else if (data.type === 'machine.status') {
            optsRef.current.onMachineStatus?.(data.machineId, data.online)
          }
        } catch {}
      }

      es.addEventListener('msg', handleEvent)
      es.addEventListener('perm.req', handleEvent)
      es.addEventListener('perm.resolved', handleEvent)
      es.addEventListener('session.update', handleEvent)
      es.addEventListener('usage', handleEvent)
      es.addEventListener('machine.status', handleEvent)
      es.addEventListener('heartbeat', handleEvent)
    }

    connect()

    return () => {
      mountedRef.current = false
      esRef.current?.close()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [opts.sessionId])

  return { connected }
}
