import { useEffect, useState } from 'react'
import { Trash2, ShieldCheck, Keyboard, Info, BookOpen } from 'lucide-react'
import { Modal, Field, Toggle, Spinner } from '../ui'
import { useI18n, LANGS, type Lang } from '../../lib/i18n'
import { kvGet, kvSet, storageEstimate } from '../../lib/db'
import { testProvider, DEFAULT_AI, type AIConfig } from '../../ai/provider'
import { formatBytes } from '../../lib/utils'
import { navigate } from '../../App'
import type { AspectId } from '../../lib/types'

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useI18n()
  const [ai, setAi] = useState<AIConfig>(DEFAULT_AI)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | boolean>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [defaults, setDefaults] = useState<{ aspect: AspectId; fps: 24 | 30 | 60 }>({ aspect: '9:16', fps: 30 })

  useEffect(() => {
    if (!open) return
    kvGet<AIConfig>('aiConfig').then((c) => c && setAi(c))
    kvGet<{ aspect: AspectId; fps: 24 | 30 | 60 }>('defaults').then((d) => d && setDefaults(d))
    void storageEstimate().then(setStorage)
  }, [open])

  const saveAi = (next: AIConfig) => {
    setAi(next)
    void kvSet('aiConfig', next)
  }
  const saveDefaults = (next: { aspect: AspectId; fps: 24 | 30 | 60 }) => {
    setDefaults(next)
    void kvSet('defaults', next)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('st.title')} wide>
      <div className="space-y-6">
        {/* language */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Info size={12} /> {t('st.lang')}
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id as Lang)}
                className={`rounded-lg border py-2 text-[12px] font-semibold transition-all ${lang === l.id ? 'border-star-500 bg-star-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-zinc-600">Persian (فارسی) switches the interface to full RTL.</p>
        </section>

        {/* AI provider */}
        <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t('st.ai')}</h4>
            <Toggle checked={ai.enabled} onChange={(v) => saveAi({ ...ai, enabled: v })} />
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">{t('st.aiHint')}</p>
          <div className="grid gap-2.5">
            <Field label={t('st.baseUrl')}>
              <input className="field" value={ai.baseUrl} onChange={(e) => saveAi({ ...ai, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" dir="ltr" />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={t('st.model')}>
                <input className="field" value={ai.model} onChange={(e) => saveAi({ ...ai, model: e.target.value })} placeholder="gpt-4o-mini" dir="ltr" />
              </Field>
              <Field label={t('st.apiKey')}>
                <input className="field" type="password" value={ai.apiKey} onChange={(e) => saveAi({ ...ai, apiKey: e.target.value })} placeholder="sk-…" dir="ltr" />
              </Field>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost !px-3 !py-1.5 !text-[12px]"
              disabled={testing || !ai.baseUrl}
              onClick={async () => {
                setTesting(true)
                setTestResult(await testProvider(ai))
                setTesting(false)
              }}
            >
              {testing ? <Spinner size={12} /> : null} {t('st.test')}
            </button>
            {testResult === true && <span className="text-[11.5px] text-emerald-400">{t('st.testOk')}</span>}
            {testResult === false && <span className="text-[11.5px] text-red-400">{t('st.testFail')}</span>}
          </div>
        </section>

        {/* storage */}
        <section className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t('st.storage')}</h4>
          {storage && (
            <p className="text-[12px] text-zinc-400">
              {formatBytes(storage.usage)} used of {formatBytes(storage.quota)} available
            </p>
          )}
          <button
            className="btn-ghost !border-red-500/30 !py-2 !text-[12px] !text-red-400"
            onClick={async () => {
              if (!confirm(t('st.confirmClear'))) return
              const dbs = await indexedDB.databases()
              void dbs
              indexedDB.deleteDatabase('star-edit-db')
              setTimeout(() => window.location.reload(), 300)
            }}
          >
            <Trash2 size={13} /> {t('st.clear')}
          </button>
        </section>

        {/* shortcuts */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Keyboard size={12} /> {t('st.shortcuts')}
          </h4>
          <div className="grid grid-cols-2 gap-1.5 text-[11.5px] text-zinc-400">
            <span><kbd className="chip">Space</kbd> play / pause</span>
            <span><kbd className="chip">S</kbd> split at playhead</span>
            <span><kbd className="chip">Del</kbd> delete selection</span>
            <span><kbd className="chip">Ctrl+D</kbd> duplicate</span>
            <span><kbd className="chip">Ctrl+Z</kbd> undo</span>
            <span><kbd className="chip">Ctrl+⇧+Z</kbd> redo</span>
            <span><kbd className="chip">←/→</kbd> step frame</span>
            <span><kbd className="chip">⇧+←/→</kbd> step second</span>
          </div>
          <button
            className="btn-ghost mt-1 w-full !py-2 !text-[12px]"
            onClick={() => {
              onClose()
              navigate('/guide')
            }}
          >
            <BookOpen size={13} /> {t('nav.guide')}
          </button>
        </section>

        {/* privacy */}
        <section className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-[11.5px] leading-relaxed text-zinc-400">
            Your media never leaves this device. Projects, blobs and keys live in your browser's IndexedDB. The optional AI provider is called directly from your browser with your own key.
          </p>
        </section>

        <p className="text-center text-[10.5px] text-zinc-600">
          STAR EDIT v1.1 — free, browser-side AI video editing. Built with React, Canvas, Web Audio & MediaRecorder.
        </p>
      </div>
    </Modal>
  )
}
