import type { PermissionRecord } from '@bed-vibe/shared'
import { useI18n } from '@/i18n'

interface Props {
  permission: PermissionRecord
  onDecide: (id: string, approved: boolean) => void
}

export default function PermissionCard({ permission, onDecide }: Props) {
  const { t } = useI18n()
  const input = typeof permission.input === 'object'
    ? JSON.stringify(permission.input, null, 2)
    : String(permission.input ?? '')

  return (
    <div className="border border-amber-800/50 bg-amber-950/20 rounded-[20px] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-amber-400">{t('perm.title')}</span>
      </div>
      <div>
        <p className="text-sm font-mono text-[var(--text-primary)]">{permission.tool}</p>
        {input && (
          <pre className="mt-2 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-3 rounded-[12px] overflow-x-auto max-h-40 leading-relaxed">
            {input.slice(0, 2000)}
          </pre>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onDecide(permission.id, true)}
          className="flex-1 py-2.5 bg-emerald-800/50 hover:bg-emerald-700/50 rounded-[12px] text-sm font-medium text-emerald-300 transition-colors"
        >
          {t('perm.approve')}
        </button>
        <button
          onClick={() => onDecide(permission.id, false)}
          className="flex-1 py-2.5 bg-red-800/30 hover:bg-red-700/40 rounded-[12px] text-sm font-medium text-red-300 transition-colors"
        >
          {t('perm.deny')}
        </button>
      </div>
    </div>
  )
}
