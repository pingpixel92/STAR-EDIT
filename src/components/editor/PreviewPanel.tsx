import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, Mic, Sparkles, Square } from 'lucide-react'
import { useEditor } from '../../lib/store'
import { useEditorCtx } from '../../pages/EditorPage'
import { runAICommand } from '../../ai/runCommand'
import { formatTime } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'

const EXAMPLES = [
  'Make a 15 second cinematic football edit, sync every cut to the beat',
  'Turn these photos into a 20 second emotional reel with slow zooms',
  'Make it darker and more dramatic, add strong zooms on the drop',
  'Add bold white captions and a title saying "STAR EDIT"',
  'Keep only the best 20 seconds and make it 9:16',
  'Sync the cuts harder to the beat',
]

export default function PreviewPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const store = useEditor()
  const { controller } = useEditorCtx()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)
  const [phIdx, setPhIdx] = useState(0)
  const [listening, setListening] = useState(false)
  const [hasSTT, setHasSTT] = useState(false)
  const recRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    controller?.setCanvas(canvasRef.current)
    const id = setInterval(() => setPhIdx((i) => (i + 1) % EXAMPLES.length), 3800)
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    setHasSTT(!!SR)
    return () => {
      clearInterval(id)
      controller?.setCanvas(null)
    }
  }, [controller])

  // redraw still frame when timeline mutates while paused
  useEffect(() => {
    if (!store.playing) {
      const id = setTimeout(() => controller?.draw(), 60)
      return () => clearTimeout(id)
    }
  }, [store.project, store.time, store.playing, controller])

  const send = async () => {
    if (!cmd.trim() || busy) return
    const text = cmd
    setCmd('')
    setBusy(true)
    try {
      await runAICommand(text)
    } finally {
      setBusy(false)
    }
  }

  const toggleMic = async () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = document.documentElement.lang === 'fa' ? 'fa-IR' : 'en-US'
    rec.interimResults = false
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = e.results[0]?.[0]?.transcript
      if (transcript) setCmd(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const p = store.project
  if (!p) return null

  return (
    <div className="flex h-full min-h-0 w-full max-w-[560px] flex-col items-center gap-3">
      {/* AI COMMAND BAR */}
      <div className="glass flex w-full items-center gap-2 rounded-2xl p-2 shadow-card">
        <Sparkles size={16} className="ms-1.5 shrink-0 text-star-400" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={`${t('ed.cmdPlaceholder')}  ·  ${EXAMPLES[phIdx].slice(0, 44)}…`}
          aria-label={t('ed.cmdPlaceholder')}
        />
        <button
          className={`btn-icon h-8 w-8 shrink-0 ${listening ? '!border-star-500 !text-star-300' : ''}`}
          onClick={() => void toggleMic()}
          disabled={!hasSTT}
          title={hasSTT ? t('ed.mic') : t('ed.micOff')}
          aria-label={t('ed.mic')}
        >
          <Mic size={14} />
        </button>
        <button className="btn-accent shrink-0 !rounded-xl !px-3.5 !py-1.5 !text-[12px]" disabled={busy || !cmd.trim()} onClick={() => void send()}>
          {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkles size={13} />}
          {t('ed.generate')}
        </button>
      </div>

      {/* CANVAS */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          onClick={() => store.setPlaying(!store.playing)}
          className="max-h-full max-w-full cursor-pointer rounded-xl border border-white/10 bg-black object-contain shadow-card"
          aria-label="Video preview"
        />
        {p.beatMap && (
          <div className="absolute start-2 top-2 flex items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur">
            <Square size={8} className="text-star-400" /> {p.beatMap.bpm} BPM · {Math.round(p.beatMap.confidence * 100)}%
          </div>
        )}
      </div>

      {/* TRANSPORT */}
      <div className="flex w-full items-center justify-center gap-3">
        <button className="btn-icon" onClick={() => controller?.seek(0)} aria-label="Start">
          <SkipBack size={15} />
        </button>
        <button className="btn-accent !h-10 !w-10 !rounded-full !p-0" onClick={() => store.setPlaying(!store.playing)} aria-label={store.playing ? 'Pause' : 'Play'}>
          {store.playing ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
        </button>
        <span className="min-w-[86px] text-center text-[12px] font-semibold tabular-nums text-zinc-400">
          {formatTime(store.time, true)} / {formatTime(p.duration)}
        </span>
      </div>
    </div>
  )
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
