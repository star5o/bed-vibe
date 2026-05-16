import { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { apiFetch, clearToken } from '@/api/client'
import { useSse } from '@/hooks/useSse'
import { useTheme } from '@/providers/ThemeProvider'
import { useI18n } from '@/i18n'
import type { SessionInfo, MachineInfo } from '@bed-vibe/shared'
import { Monitor, Moon, Sun, Settings, LogOut, Plus, Search, Copy, Check } from 'lucide-react'

type StatusTab = 'active' | 'inactive' | 'archived' | 'all'

export default function Sessions() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [machines, setMachines] = useState<MachineInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [showNewSession, setShowNewSession] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadSessions = () => {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('status', tab)
    if (search) params.set('q', search)
    apiFetch(`/api/sessions?${params}`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions); setLoading(false) })
  }

  useEffect(() => { loadSessions() }, [tab, search])
  useEffect(() => {
    apiFetch('/api/machines').then(r => r.json()).then(d => setMachines(d.machines))
  }, [])

  useSse({
    onSessionUpdate: (sid, status, thinking) => {
      setSessions(prev => prev.map(s =>
        s.id === sid ? { ...s, status, thinking } : s
      ))
    },
  })

  const getDisplayName = (s: SessionInfo) => {
    if (s.name) return s.name
    const parts = s.cwd.split('/')
    return parts[parts.length - 1] || s.cwd
  }

  const getStatusColor = (s: SessionInfo) => {
    if (s.status === 'inactive' || s.status === 'archived') return 'bg-[var(--text-tertiary)]'
    if (s.thinking) return 'bg-[var(--warning)] animate-pulse'
    return 'bg-[var(--success)]'
  }

  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setTheme(next)
  }

  const copyResumeCmd = (s: SessionInfo) => {
    const cmd = `cd ${s.cwd} && claude --resume ${s.id}`
    navigator.clipboard.writeText(cmd)
    setCopiedId(s.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const onlineMachines = machines.filter(m => m.online)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('sessions.title')}</h1>
          <div className="flex items-center gap-1">
            <button onClick={cycleTheme} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]" title={`Theme: ${theme}`}>
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link to="/machines" className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              <Monitor size={18} />
            </Link>
            <Link to="/settings" className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              <Settings size={18} />
            </Link>
            <button onClick={() => { clearToken(); navigate({ to: '/login' }) }} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Search + New Session */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('sessions.search')}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
            />
          </div>
          {onlineMachines.length > 0 && (
            <button
              onClick={() => setShowNewSession(true)}
              className="px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium text-white flex items-center gap-1.5"
            >
              <Plus size={16} /> {t('sessions.new')}
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
          {(['all', 'active', 'inactive', 'archived'] as StatusTab[]).map(tab_key => (
            <button
              key={tab_key}
              onClick={() => setTab(tab_key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === tab_key
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t(`sessions.${tab_key}` as any)}
            </button>
          ))}
        </div>

        {/* Session List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-[var(--text-tertiary)] py-12">
            {t('sessions.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="relative group">
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: s.id }}
                  className="block p-4 rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(s)}`} />
                        <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {getDisplayName(s)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {s.source === 'remote' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            {t('sessions.remote')}
                          </span>
                        )}
                        {s.machineName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                            {s.machineName}
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {s.agent}{s.model ? ` · ${s.model}` : ''}
                        </span>
                        {(s.totalCost ?? 0) > 0 && (
                          <span className="text-[10px] text-[var(--text-tertiary)]">
                            ${s.totalCost!.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)] shrink-0">
                      {formatTime(s.updatedAt)}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); copyResumeCmd(s) }}
                  className="absolute top-3 right-12 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-all"
                  title="Copy resume command"
                >
                  {copiedId === s.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Dialog */}
      {showNewSession && (
        <NewSessionDialog
          machines={onlineMachines}
          onClose={() => setShowNewSession(false)}
          onCreated={(sid) => { setShowNewSession(false); navigate({ to: '/sessions/$sessionId', params: { sessionId: sid } }) }}
        />
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`
  return `${Math.floor(diff / 86400_000)}d`
}

function NewSessionDialog({ machines, onClose, onCreated }: {
  machines: MachineInfo[]
  onClose: () => void
  onCreated: (sid: string) => void
}) {
  const [machineId, setMachineId] = useState(machines[0]?.id ?? '')
  const [cwd, setCwd] = useState('')
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [pathValid, setPathValid] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const checkPath = async () => {
    if (!cwd || !machineId) return
    const res = await apiFetch(`/api/machines/${machineId}/check-path`, {
      method: 'POST',
      body: JSON.stringify({ path: cwd }),
    })
    const data = await res.json()
    setPathValid(data.exists && data.isDir)
  }

  const handleSubmit = async () => {
    if (!cwd || !machineId) return
    setSubmitting(true)
    setError('')
    const res = await apiFetch('/api/sessions/spawn', {
      method: 'POST',
      body: JSON.stringify({ machineId, cwd, model: model || undefined, prompt: prompt || undefined }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.sessionId) {
      onCreated(data.sessionId)
    } else {
      setError(data.error || 'Failed to spawn session')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">New Session</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Machine</label>
            <select
              value={machineId}
              onChange={e => setMachineId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)]"
            >
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Working Directory</label>
            <div className="flex gap-2">
              <input
                value={cwd}
                onChange={e => { setCwd(e.target.value); setPathValid(null) }}
                onBlur={checkPath}
                placeholder="/path/to/project"
                className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] font-mono"
              />
              {pathValid === true && <span className="self-center text-green-400 text-sm">✓</span>}
              {pathValid === false && <span className="self-center text-red-400 text-sm">✗</span>}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Model (optional)</label>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="claude-sonnet-4-6"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Initial Prompt (optional)</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="What should Claude do?"
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] resize-none"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 bg-[var(--bg-tertiary)] rounded-xl text-sm text-[var(--text-secondary)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!cwd || !machineId || submitting}
            className="flex-1 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 rounded-xl text-sm font-medium text-white"
          >
            {submitting ? 'Spawning...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

