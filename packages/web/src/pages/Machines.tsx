import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { apiFetch } from '@/api/client'
import { useI18n } from '@/i18n'
import type { MachineInfo } from '@bed-vibe/shared'
import { ArrowLeft, Plus, Trash2, Copy, Check, Link2 } from 'lucide-react'

export default function Machines() {
  const { t } = useI18n()
  const [machines, setMachines] = useState<MachineInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showPair, setShowPair] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [pairCode, setPairCode] = useState('')
  const [pairName, setPairName] = useState('')
  const [manualName, setManualName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/machines').then(r => r.json()).then(d => {
      setMachines(d.machines)
      setLoading(false)
    })
  }, [])

  const pairMachine = async () => {
    if (!pairCode.trim() || !pairName.trim()) return
    setSubmitting(true)
    setError('')
    const res = await apiFetch('/api/pairing/complete', {
      method: 'POST',
      body: JSON.stringify({ code: pairCode.trim(), name: pairName.trim() }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) {
      setShowPair(false)
      setPairCode('')
      setPairName('')
      apiFetch('/api/machines').then(r => r.json()).then(d => setMachines(d.machines))
    } else {
      setError(data.error || 'Pairing failed')
    }
  }

  const addManual = async () => {
    const name = manualName.trim()
    if (!name) return
    setSubmitting(true)
    const res = await apiFetch('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setMachines(prev => [...prev, data.machine])
    setNewToken(data.token)
    setManualName('')
    setSubmitting(false)
  }

  const deleteMachine = async (id: string) => {
    if (!confirm(t('machines.deleteConfirm'))) return
    await apiFetch(`/api/machines/${id}`, { method: 'DELETE' })
    setMachines(prev => prev.filter(m => m.id !== id))
  }

  const copyToken = () => {
    navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/sessions" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('machines.title')}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Action buttons */}
        {!showPair && !showManual && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPair(true)}
              className="flex-1 p-4 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Link2 size={16} /> {t('machines.pair')}
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="p-4 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--text-tertiary)] text-[var(--text-tertiary)] transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {/* Pair dialog */}
        {showPair && (
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
            <p className="text-xs text-[var(--text-secondary)]">{t('machines.pairDesc')}</p>
            <input
              value={pairCode}
              onChange={e => setPairCode(e.target.value.toUpperCase())}
              placeholder={t('machines.pairCodePlaceholder')}
              maxLength={6}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] font-mono text-center text-lg tracking-widest"
              autoFocus
            />
            <input
              value={pairName}
              onChange={e => setPairName(e.target.value)}
              placeholder={t('machines.name')}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={pairMachine}
                disabled={!pairCode.trim() || !pairName.trim() || submitting}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? t('common.loading') : t('common.confirm')}
              </button>
              <button
                onClick={() => { setShowPair(false); setError('') }}
                className="px-4 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Manual add */}
        {showManual && (
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
            <input
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder={t('machines.name')}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addManual() }}
            />
            <div className="flex gap-2">
              <button
                onClick={addManual}
                disabled={!manualName.trim() || submitting}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? t('common.loading') : t('newSession.create')}
              </button>
              <button
                onClick={() => { setShowManual(false); setNewToken('') }}
                className="px-4 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>

            {newToken && (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/50 space-y-2">
                <p className="text-xs text-emerald-400 font-medium">{t('machines.tokenHint')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] px-3 py-2 rounded-lg break-all">
                    {newToken}
                  </code>
                  <button onClick={copyToken} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Machine list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : machines.length === 0 ? (
          <p className="text-center text-[var(--text-tertiary)] py-8 text-sm">
            {t('sessions.empty')}
          </p>
        ) : (
          machines.map(m => (
            <div key={m.id} className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${m.online ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'}`} />
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{m.name}</p>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {m.online ? t('machines.online') : t('machines.offline')}
                  </span>
                </div>
                {m.hostname && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-4">{m.hostname}</p>
                )}
              </div>
              <button
                onClick={() => deleteMachine(m.id)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
