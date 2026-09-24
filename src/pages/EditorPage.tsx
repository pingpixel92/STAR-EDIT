import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Undo2, Redo2, Download, Settings, History, ChevronLeft, Save, Loader2, Check,
  Scissors, Copy, Trash2, Image as ImageIcon, Play as PlayIcon, BookOpen, HelpCircle,
} from 'lucide-react'
import { LogoWord } from '../components/Logo'
import { navigate } from '../App'
import { useI18n } from '../lib/i18n'
import { useEditor } from '../lib/store'
import { PlaybackController } from '../engine/playback'
import type { AssetView } from '../engine/renderer'
import MediaPanel from '../components/editor/MediaPanel'
import PreviewPanel from '../components/editor/PreviewPanel'
import Timeline from '../components/editor/Timeline'
import AIPanel from '../components/editor/AIPanel'
import InspectorPanel from '../components/editor/InspectorPanel'
import ExportDialog from '../components/editor/ExportDialog'
import SettingsDialog from '../components/editor/SettingsDialog'
import VersionsDialog from '../components/editor/VersionsDialog'
import Tour from '../components/editor/Tour'

const Ctx = createContext<{ controller: PlaybackController | null }>({ controller: null })
export const useEditorCtx = () => useContext(Ctx)

type PanelTab = 'media' | 'ai' | 'inspector'
type MobileView = 'preview' | 'media' | 'timeline' | 'ai'

function useIsMobile(): boolean {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setM(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return m
}

export default function EditorPage({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const store = useEditor()
  const controller = useMemo(() => new PlaybackController(), [])
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<PanelTab>('ai')
  const [mobileView, setMobileView] = useState<MobileView>('preview')
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const attachedRef = useRef<Set<string>>(new Set())

  // load project
  useEffect(() => {
    let alive = true
    ;(async () => {
      await useEditor.getState().loadProject(projectId)
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
      controller.pause()
      useEditor.getState().closeProject()
    }
  }, [projectId, controller])

  // attach assets (images need Image objects; videos are pooled lazily during sync)
  const assets = store.assets
  const blobs = store.blobs
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const a of assets) {
        if (attachedRef.current.has(a.id)) continue
        const blob = blobs.get(a.id)
        if (!blob) continue
        attachedRef.current.add(a.id)
        const url = URL.createObjectURL(blob)
        const av: AssetView = { meta: a, url }
        if (a.type === 'image') {
          const img = new Image()
          img.src = url
          await img.decode().catch(() => {})
          av.img = img
        }
        if (alive) await controller.attachAsset(av)
      }
    })()
    return () => {
      alive = false
    }
  }, [assets, blobs, controller])

  // controller ↔ store time sync
  useEffect(() => {
    controller.onTime = (time) => useEditor.setState({ time })
    controller.onEnd = () => useEditor.setState({ playing: false })
    return () => {
      controller.onTime = undefined
      controller.onEnd = undefined
    }
  }, [controller])

  useEffect(() => {
    controller.setProject(store.project)
  }, [controller, store.project])

  // push store play state into controller
  useEffect(() => {
    if (store.playing && !controller.playing) controller.play()
    else if (!store.playing && controller.playing) controller.pause()
  }, [store.playing, controller])

  // keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const s = useEditor.getState()
      if (!s.project) return
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') {
        e.preventDefault()
        s.setPlaying(!s.playing)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          e.preventDefault()
          s.mutate((p) => {
            for (const tr of p.tracks) tr.clips = tr.clips.filter((c) => !s.selection.includes(c.id))
          })
          useEditor.setState({ selection: [] })
        }
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        s.undo()
      } else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        s.redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.mutate((p) => {
          for (const tr of p.tracks) {
            const dups = tr.clips.filter((c) => s.selection.includes(c.id)).map((c) => ({ ...c, id: `${c.id}_c${Math.random().toString(36).slice(2, 6)}`, start: c.start + c.duration }))
            tr.clips.push(...dups)
          }
        })
      } else if (e.key.toLowerCase() === 's' && !mod) {
        // plain S splits; Ctrl/Cmd+S is left to the browser
        splitAtPlayhead()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        controller.seek(Math.max(0, s.time - (e.shiftKey ? 1 : 1 / 30)))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        controller.seek(Math.min(s.project.duration, s.time + (e.shiftKey ? 1 : 1 / 30)))
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const splitAtPlayhead = () => {
    const s = useEditor.getState()
    if (!s.project) return
    s.mutate((p) => {
      for (const tr of p.tracks) {
        const target = tr.clips.find((c) => s.time > c.start + 0.05 && s.time < c.start + c.duration - 0.05)
        if (!target) continue
        const leftDur = s.time - target.start
        const right = {
          ...target,
          id: `${target.id}_s${Math.random().toString(36).slice(2, 6)}`,
          start: s.time,
          duration: target.duration - leftDur,
          inPoint: target.inPoint + leftDur * target.speed,
          transitionIn: { style: 'none' as const, duration: 0 },
        }
        target.duration = leftDur
        tr.clips.push(right)
      }
    })
  }

  const dupSelection = () => {
    const s = useEditor.getState()
    s.mutate((p) => {
      for (const tr of p.tracks) {
        const dups = tr.clips.filter((c) => s.selection.includes(c.id)).map((c) => ({ ...c, id: `${c.id}_c${Math.random().toString(36).slice(2, 6)}`, start: c.start + c.duration }))
        tr.clips.push(...dups)
      }
    })
  }

  const delSelection = () => {
    const s = useEditor.getState()
    s.mutate((p) => {
      for (const tr of p.tracks) tr.clips = tr.clips.filter((c) => !s.selection.includes(c.id))
    })
    useEditor.setState({ selection: [] })
  }

  if (!ready || !store.project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="animate-spin text-star-500" size={28} />
          <span className="text-sm">Loading project…</span>
        </div>
      </div>
    )
  }

  const canUndo = store.past.length > 0
  const canRedo = store.future.length > 0

  return (
    <Ctx.Provider value={{ controller }}>
      <div className="flex h-screen flex-col overflow-hidden bg-ink-950">
        {/* TOP BAR */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/6 bg-ink-900/70 px-3 backdrop-blur-xl">
          <button className="btn-icon" onClick={() => navigate('/projects')} aria-label="Back to projects">
            <ChevronLeft size={16} />
          </button>
          <LogoWord compact />
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-zinc-300 sm:block">{store.project.name}</span>
          <span className="hidden items-center gap-1 text-[11px] text-zinc-500 sm:flex">
            {store.saveState === 'saving' ? (
              <><Loader2 size={11} className="animate-spin" /> saving…</>
            ) : store.saveState === 'saved' ? (
              <><Check size={11} className="text-emerald-400" /> {t('ed.save')}</>
            ) : (
              <><Save size={11} /> local</>
            )}
          </span>
          <div className="mx-auto" />
          <button
            className="btn-icon hidden sm:inline-flex"
            onClick={() => window.dispatchEvent(new CustomEvent('star-tour'))}
            title={t('ed.guide')}
            aria-label={t('ed.guide')}
          >
            <HelpCircle size={15} />
          </button>
          <button
            className="btn-icon hidden md:inline-flex"
            onClick={() => navigate('/guide')}
            title={t('nav.guide')}
            aria-label={t('nav.guide')}
          >
            <BookOpen size={15} />
          </button>
          <button className="btn-icon" disabled={!canUndo} onClick={() => store.undo()} title={t('ed.undo')} aria-label={t('ed.undo')}><Undo2 size={15} /></button>
          <button className="btn-icon" disabled={!canRedo} onClick={() => store.redo()} title={t('ed.redo')} aria-label={t('ed.redo')}><Redo2 size={15} /></button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className="btn-icon" onClick={splitAtPlayhead} title={t('ed.split')} aria-label={t('ed.split')}><Scissors size={15} /></button>
          <button className="btn-icon" onClick={dupSelection} disabled={!store.selection.length} title={t('ed.dup')} aria-label={t('ed.dup')}><Copy size={15} /></button>
          <button className="btn-icon hover:!border-red-500/40 hover:!text-red-400" onClick={delSelection} disabled={!store.selection.length} title={t('ed.delete')} aria-label={t('ed.delete')}><Trash2 size={15} /></button>
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <button className="btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={() => setVersionsOpen(true)}>
            <History size={14} /> <span className="hidden sm:inline">{t('ed.versions')}</span>
            <span className="chip !px-1.5">{store.project.versions.length}</span>
          </button>
          <button className="btn-ghost !px-3 !py-1.5" onClick={() => setSettingsOpen(true)} aria-label={t('st.title')}>
            <Settings size={15} />
          </button>
          <button className="btn-accent !px-4 !py-1.5 !text-[13px]" onClick={() => setExportOpen(true)}>
            <Download size={14} /> <span className="hidden sm:inline">{t('ed.export')}</span>
          </button>
        </header>

        {/* DESKTOP WORKSPACE */}
        {!isMobile && (
        <div className="flex min-h-0 flex-1">
          {/* LEFT — media */}
          <aside className="flex w-[290px] shrink-0 flex-col border-e border-white/6 bg-ink-900/40">
            <PanelHeader icon={<ImageIcon size={13} />} label={t('ed.media')} />
            <MediaPanel />
          </aside>

          {/* CENTER — preview + timeline */}
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(124,58,237,0.08),transparent)] p-4">
              <PreviewPanel />
            </div>
            <div className="h-[292px] shrink-0 border-t border-white/6 bg-ink-900/50">
              <Timeline splitAtPlayhead={splitAtPlayhead} />
            </div>
          </main>

          {/* RIGHT — AI / Inspector */}
          <aside className="flex w-[330px] shrink-0 flex-col border-s border-white/6 bg-ink-900/40">
            <div className="flex h-9 shrink-0 items-center gap-1 border-b border-white/6 px-2">
              {(['ai', 'inspector'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${tab === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {k === 'ai' ? t('ed.ai') : t('ed.inspector')}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {tab === 'ai' ? <AIPanel /> : <InspectorPanel />}
            </div>
          </aside>
        </div>
        )}

        {/* MOBILE WORKSPACE */}
        {isMobile && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileView === 'preview' && (
              <div className="flex h-full flex-col items-center justify-center bg-ink-950 p-3">
                <PreviewPanel compact />
              </div>
            )}
            {mobileView === 'media' && <MediaPanel />}
            {mobileView === 'timeline' && <Timeline splitAtPlayhead={splitAtPlayhead} />}
            {mobileView === 'ai' && <AIPanel />}
          </div>
          <nav className="flex h-14 shrink-0 items-center justify-around border-t border-white/8 bg-ink-900/90 backdrop-blur">
            {([
              ['preview', <PlayIcon key="p" size={17} />],
              ['media', <ImageIcon key="m" size={17} />],
              ['timeline', <Scissors key="t" size={17} />],
              ['ai', <SparkleIcon key="a" />],
            ] as [MobileView, React.ReactNode][]).map(([k, icon]) => (
              <button
                key={k}
                onClick={() => setMobileView(k)}
                className={`flex h-10 w-16 items-center justify-center rounded-lg transition-colors ${mobileView === k ? 'bg-star-500/15 text-star-300' : 'text-zinc-500'}`}
                aria-label={k}
              >
                {icon}
              </button>
            ))}
          </nav>
        </div>
        )}

        <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <VersionsDialog open={versionsOpen} onClose={() => setVersionsOpen(false)} />
        <Tour />
      </div>
    </Ctx.Provider>
  )
}

function PanelHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-white/6 px-3 text-[12px] font-semibold text-zinc-300">
      {icon} {label}
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.1 5.6L20 9.7l-4.5 3.6 1.4 5.8L12 16l-4.9 3.1 1.4-5.8L4 9.7l5.9-2.1z" />
    </svg>
  )
}
