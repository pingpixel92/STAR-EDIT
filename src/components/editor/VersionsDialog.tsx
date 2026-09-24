import { useEditor } from '../../lib/store'
import { Modal } from '../ui'
import { useI18n } from '../../lib/i18n'
import { formatTime } from '../../lib/utils'

export default function VersionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const store = useEditor()
  const versions = store.project?.versions ?? []
  return (
    <Modal open={open} onClose={onClose} title={t('v.title')}>
      {versions.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-zinc-500">{t('v.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {[...versions].reverse().map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-star-500/30 to-pulse-500/20 text-[12px] font-black text-star-200">
                V{versions.length - i}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-zinc-200">{v.label}</p>
                <p className="text-[10.5px] text-zinc-500">
                  {new Date(v.at).toLocaleString()} · {formatTime(v.duration)}
                </p>
              </div>
              <button
                className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                onClick={() => {
                  store.restoreVersion(v.id)
                  onClose()
                }}
              >
                {t('v.restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
