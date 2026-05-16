import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { apiFetch } from '@/api/client'
import { useTheme } from '@/providers/ThemeProvider'
import { useI18n, type Locale } from '@/i18n'
import { ArrowLeft, Moon, Sun, Monitor } from 'lucide-react'
import type { UserInfo } from '@bed-vibe/shared'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { t, locale, setLocale } = useI18n()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/users/me').then(r => r.json()).then(setUser)
  }, [])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordMsg(t('auth.loginFailed'))
      return
    }
    setSaving(true)
    setPasswordMsg('')
    const res = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (res.ok) {
      setPasswordMsg('✓')
      setCurrentPassword('')
      setNewPassword('')
    } else {
      const data = await res.json().catch(() => ({}))
      setPasswordMsg(data.error || t('auth.loginFailed'))
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/sessions" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.title')}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Account */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">Account</h2>
          {user && (
            <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <p className="text-sm text-[var(--text-primary)] font-medium">{user.displayName || user.username}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">@{user.username}</p>
            </div>
          )}
        </section>

        {/* Language */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('settings.language')}</h2>
          <div className="flex gap-2">
            {([
              { value: 'zh' as Locale, label: '中文' },
              { value: 'en' as Locale, label: 'English' },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLocale(value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  locale === value
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Theme */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('settings.theme')}</h2>
          <div className="flex gap-2">
            {([
              { value: 'light' as const, icon: Sun, label: t('settings.themeLight') },
              { value: 'dark' as const, icon: Moon, label: t('settings.themeDark') },
              { value: 'system' as const, icon: Monitor, label: t('settings.themeSystem') },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Change password */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('auth.changePassword')}</h2>
          <form onSubmit={changePassword} className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder={t('auth.currentPassword')}
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('auth.newPassword')}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
            {passwordMsg && (
              <p className={`text-xs ${passwordMsg === '✓' ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !currentPassword || !newPassword}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}