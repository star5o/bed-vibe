import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { apiFetch } from '@/api/client'
import { useSse } from '@/hooks/useSse'
import { useI18n } from '@/i18n'
import type { MessageRecord, PermissionRecord, SseEvent } from '@bed-vibe/shared'
import PermissionCard from '@/components/PermissionCard'
import MessageBubble from '@/components/MessageBubble'
import { ArrowLeft, Pencil, Square, Copy, Check, ChevronUp } from 'lucide-react'

export default function Chat() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' })
  const { t } = useI18n()
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [pendingPerms, setPendingPerms] = useState<PermissionRecord[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionCwd, setSessionCwd] = useState('')
  const [sessionModel, setSessionModel] = useState('')
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch(`/api/sessions/${sessionId}`).then(r => r.json()).then(d => {
      setSessionName(d.name || '')
      setSessionCwd(d.cwd || '')
      setSessionModel(d.model || '')
      setThinking(d.thinking)
    })
    apiFetch(`/api/sessions/${sessionId}/messages?limit=50`).then(r => r.json()).then(d => {
      setMessages(d.messages)
      setHasOlder(d.hasMore)
    })
    apiFetch(`/api/sessions/${sessionId}/permissions?status=pending`).then(r => r.json()).then(d => {
      setPendingPerms(d.permissions)
    })
    apiFetch(`/api/sessions/${sessionId}/usage`).then(r => r.json()).then(d => {
      setUsage(d)
    })
  }, [sessionId])

  const handleSseEvent = useCallback((event: SseEvent) => {
    if (event.type === 'msg' && event.sid === sessionId) {
      setMessages(prev => {
        if (prev.some(m => m.seq === event.seq)) return prev
        return [...prev, {
          id: 0, sessionId: event.sid, seq: event.seq,
          source: event.source, content: event.content,
          localId: event.localId, createdAt: Date.now(),
        }]
      })
    } else if (event.type === 'perm.req' && event.sid === sessionId) {
      setPendingPerms(prev => {
        if (prev.some(p => p.id === event.id)) return prev
        return [...prev, {
          id: event.id, sessionId: event.sid, tool: event.tool,
          input: event.input, status: 'pending', createdAt: Date.now(),
        }]
      })
    } else if (event.type === 'perm.resolved' && event.sid === sessionId) {
      setPendingPerms(prev => prev.filter(p => p.id !== event.id))
    } else if (event.type === 'session.update' && event.sid === sessionId) {
      setThinking(event.thinking)
    } else if (event.type === 'usage' && event.sid === sessionId) {
      setUsage(prev => ({
        inputTokens: prev.inputTokens + event.inputTokens,
        outputTokens: prev.outputTokens + event.outputTokens,
        totalCost: prev.totalCost + event.cost,
      }))
    }
  }, [sessionId])

  useSse({ sessionId, onEvent: handleSseEvent })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingPerms])

  const loadOlder = async () => {
    if (!hasOlder || loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    const firstSeq = messages[0].seq
    const res = await apiFetch(`/api/sessions/${sessionId}/messages?beforeSeq=${firstSeq}&limit=50`)
    const data = await res.json()
    setMessages(prev => [...data.messages, ...prev])
    setHasOlder(data.hasMore)
    setLoadingOlder(false)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    await apiFetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, localId: crypto.randomUUID(), source: 'web' }),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handlePermission = async (reqId: string, approved: boolean) => {
    await apiFetch(`/api/sessions/${sessionId}/permissions/${reqId}/${approved ? 'approve' : 'deny'}`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  const handleAbort = () => {
    apiFetch(`/api/sessions/${sessionId}/abort`, { method: 'POST' })
  }

  const saveRename = async () => {
    setEditing(false)
    const name = editValue.trim()
    setSessionName(name)
    await apiFetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }

  const copyResumeCmd = () => {
    const cmd = `cd ${sessionCwd} && claude --resume ${sessionId}`
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
    return String(n)
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0">
        <Link to="/sessions" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={saveRename}
              onKeyDown={e => { if (e.key === 'Enter') saveRename() }}
              className="w-full bg-transparent border-b border-[var(--accent)] text-sm font-medium focus:outline-none text-[var(--text-primary)]"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditValue(sessionName); setEditing(true) }}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
            >
              <span className="truncate">{sessionName || t('chat.unnamed')}</span>
              <Pencil size={12} className="shrink-0 opacity-50" />
            </button>
          )}
          {/* Info bar */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-tertiary)]">
            {sessionModel && <span>{sessionModel}</span>}
            {usage.totalCost > 0 && <span>· ${usage.totalCost.toFixed(3)}</span>}
            {(usage.inputTokens + usage.outputTokens) > 0 && (
              <span>· {formatTokens(usage.inputTokens + usage.outputTokens)} {t('chat.tokens')}</span>
            )}
          </div>
        </div>
        {thinking && (
          <span className="text-[11px] px-2 py-0.5 bg-amber-500/10 rounded-full text-[var(--warning)] animate-pulse">
            {t('sessions.thinking')}
          </span>
        )}
        <button onClick={copyResumeCmd} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] transition-colors" title={t('sessions.copyResume')}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button onClick={handleAbort} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors" title={t('chat.interrupt')}>
          <Square size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {hasOlder && (
          <div className="flex justify-center">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-full transition-colors"
            >
              {loadingOlder ? (
                <div className="w-3 h-3 border border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronUp size={14} />
              )}
              {t('chat.loadOlder')}
            </button>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.seq} message={msg} />
        ))}
        {pendingPerms.map(perm => (
          <PermissionCard key={perm.id} permission={perm} onDecide={handlePermission} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-[env(safe-area-inset-bottom,12px)] border-t border-[var(--border)] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl resize-none focus:outline-none focus:border-[var(--accent)] text-sm transition-colors text-[var(--text-primary)]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 rounded-full text-sm font-medium text-white transition-colors"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}