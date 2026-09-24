import { useEffect, useRef, useState } from 'react'
import { Check, AlertTriangle, Sparkles, Cpu, Cloud } from 'lucide-react'
import { useEditor } from '../../lib/store'
import { runAICommand } from '../../ai/runCommand'
import { kvGet } from '../../lib/db'
import type { AIConfig } from '../../ai/provider'
import { uid } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'

const QUICK = [
  'Make a 15s cinematic football edit with beat sync',
  'Make it darker + dramatic zooms',
  'Sync the cuts to the beat',
  'Add captions "STAR EDIT"',
  'Keep only the best 20 seconds',
  'Create a 9:16 version',
]

export default function AIPanel() {
  const { t } = useI18n()
  const chat = useEditor((s) => s.chat)
  const assets = useEditor((s) => s.assets)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [provider, setProvider] = useState<AIConfig | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    kvGet<AIConfig>('aiConfig').then((c) => {
      if (c) setProvider(c)
    })
  }, [chat.length])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat])

  const send = async (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || busy) return
    if (!assets.length && !useEditor.getState().project?.tracks.some((tr) => tr.clips.length)) {
      useEditor.getState().addChat({
        id: uid('m'), role: 'assistant', at: Date.now(),
        text: 'Your timeline is empty and no media is uploaded yet. Add photos / videos / music in the Media panel first — then I can build a real edit.',
      })
      return
    }
    setInput('')
    setBusy(true)
    try {
      await runAICommand(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* provider badge */}
      <div className="flex items-center gap-2 border-b border-white/6 px-3 py-2 text-[11px] text-zinc-500">
        {provider?.enabled && provider.apiKey ? (
          <span className="chip !border-emerald-500/30 !text-emerald-300"><Cloud size={10} /> Provider: {provider.model}</span>
        ) : (
          <span className="chip !border-star-500/30 !text-star-300"><Cpu size={10} /> {t('ai.localBadge')}</span>
        )}
        <span className="ms-auto text-[10px]">real operations only</span>
      </div>

      {/* messages */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {chat.length === 0 && (
          <div className="glass rounded-xl p-3.5 text-[12.5px] leading-relaxed text-zinc-300">
            <span className="mb-1.5 flex items-center gap-1.5 font-bold text-star-300"><Sparkles size={12} /> STAR AI</span>
            {t('chat.welcome')}
          </div>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ms-8 rounded-xl rounded-tr-sm bg-gradient-to-br from-star-600/35 to-pulse-600/20 px-3 py-2 text-[12.5px] text-zinc-100">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`me-2 rounded-xl rounded-tl-sm border px-3 py-2.5 text-[12.5px] leading-relaxed ${m.error ? 'border-red-500/30 bg-red-500/8 text-red-200' : 'border-white/8 bg-white/[0.04] text-zinc-200'}`}>
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.ops && m.ops.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.ops.map((op, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-emerald-300/90">
                      <Check size={12} className="mt-0.5 shrink-0" /> {op}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}
        {busy && (
          <div className="me-2 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-star-400/30 border-t-star-400" />
            {t('ed.thinking')}
          </div>
        )}
      </div>

      {/* quick chips */}
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {QUICK.map((q) => (
          <button key={q} className="chip shrink-0 whitespace-nowrap hover:border-star-500/50 hover:text-white" onClick={() => void send(q)}>
            {q.length > 34 ? q.slice(0, 34) + '…' : q}
          </button>
        ))}
      </div>

      {/* input */}
      <div className="border-t border-white/6 p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="field max-h-28 min-h-[38px] flex-1 resize-none"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={t('ed.cmdPlaceholder')}
            aria-label={t('ed.send')}
          />
          <button className="btn-accent !px-3 !py-2" disabled={busy || !input.trim()} onClick={() => void send()} aria-label={t('ed.send')}>
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : '→'}
          </button>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-600">
          <AlertTriangle size={9} /> Every reported operation is actually applied — with undo & version snapshots.
        </p>
      </div>
    </div>
  )
}
