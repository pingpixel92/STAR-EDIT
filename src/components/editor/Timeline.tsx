import { useEffect, useRef, useState } from 'react'
import { Magnet, ZoomIn, ZoomOut, Scissors, Trash2, Copy } from 'lucide-react'
import { useEditor } from '../../lib/store'
import { useEditorCtx } from '../../pages/EditorPage'
import { formatTime, uid } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { Clip, Track } from '../../lib/types'

type DragMode = 'move' | 'resize-l' | 'resize-r'

interface DragState {
  clipId: string
  trackId: string
  mode: DragMode
  startX: number
  orig: { start: number; duration: number; inPoint: number }
}

export default function Timeline({ splitAtPlayhead }: { splitAtPlayhead: () => void }) {
  const { t } = useI18n()
  const store = useEditor()
  const scrollRef = useRef<HTMLDivElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  const pps = store.zoom
  const p = store.project
  const beats = p?.beatMap?.beats ?? []
  const drops = p?.beatMap?.drops ?? []
  const width = Math.max(600, (p?.duration ?? 10) * pps + 120)

  const timeAt = (clientX: number): number => {
    const lane = laneRef.current
    if (!lane) return 0
    const rect = lane.getBoundingClientRect()
    const x = clientX - rect.left
    return Math.max(0, x / pps)
  }

  const snapTime = (t: number, excludeClip?: string): number => {
    if (!store.snap) return t
    const candidates: number[] = [0, store.time]
    for (const b of beats) candidates.push(b)
    for (const tr of p?.tracks ?? []) {
      for (const c of tr.clips) {
        if (c.id === excludeClip) continue
        candidates.push(c.start, c.start + c.duration)
      }
    }
    const thresh = 8 / pps
    let best = t
    let bestD = thresh
    for (const c of candidates) {
      const d = Math.abs(c - t)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return Math.max(0, best)
  }

  // ---- pointer interactions ----
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dt = (e.clientX - d.startX) / pps
      const s = useEditor.getState()
      s.mutate(
        (draft) => {
          const tr = draft.tracks.find((x) => x.id === d.trackId)
          const clip = tr?.clips.find((c) => c.id === d.clipId)
          if (!clip) return
          if (d.mode === 'move') {
            const ns = Math.max(0, d.orig.start + dt)
            clip.start = snapTime(ns, clip.id)
          } else if (d.mode === 'resize-r') {
            const nd = Math.max(0.15, d.orig.duration + dt)
            const endCandidate = clip.start + nd
            const snappedEnd = snapTime(endCandidate, clip.id)
            clip.duration = Math.max(0.15, (Math.abs(snappedEnd - endCandidate) < 8 / pps ? snappedEnd : endCandidate) - clip.start)
            // respect source length for video/audio assets
            const asset = store.assets.find((a) => a.id === clip.mediaId)
            if (asset && (clip.kind === 'video' || clip.kind === 'audio') && asset.duration) {
              const maxDur = (asset.duration - clip.inPoint) / clip.speed
              clip.duration = Math.min(clip.duration, Math.max(0.15, maxDur))
            }
          } else {
            const ns = snapTime(Math.max(0, d.orig.start + dt), clip.id)
            const delta = ns - d.orig.start
            const nd = d.orig.duration - delta
            if (nd >= 0.15) {
              const inDelta = delta * clip.speed
              const asset = store.assets.find((a) => a.id === clip.mediaId)
              const minIn = clip.kind === 'image' || clip.kind === 'text' || clip.kind === 'placeholder' ? -1e9 : 0
              if (d.orig.inPoint + inDelta >= minIn) {
                clip.start = ns
                clip.duration = nd
                clip.inPoint = d.orig.inPoint + inDelta
              }
            }
          }
        },
        { history: false }
      )
    }
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null
        setDragging(false)
        // one history entry per drag
        const s = useEditor.getState()
        const project = s.project
        if (project) s.mutate(() => {}, { history: true })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pps, store.assets, store.snap, store.project])

  const startDrag = (e: React.PointerEvent, clip: Clip, track: Track, mode: DragMode) => {
    e.stopPropagation()
    store.select([clip.id])
    dragRef.current = {
      clipId: clip.id,
      trackId: track.id,
      mode,
      startX: e.clientX,
      orig: { start: clip.start, duration: clip.duration, inPoint: clip.inPoint },
    }
    setDragging(true)
  }

  const seekFromRuler = (e: React.PointerEvent) => {
    const t = timeAt(e.clientX)
    useEditor.getState().setTime(t)
    controller?.seek(t)
  }

  const { controller } = useEditorCtx()

  if (!p) return null

  const tracks = p.tracks
  const trackIcon = (kind: Track['kind']) => (kind === 'video' ? '🎬' : kind === 'audio' ? '🎵' : '🅣')

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-white/6 px-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t('ed.timeline')}</span>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <TBtn icon={ZoomOut} label="Zoom out" onClick={() => store.setZoom(store.zoom / 1.35)} />
        <TBtn icon={ZoomIn} label="Zoom in" onClick={() => store.setZoom(store.zoom * 1.35)} />
        <button
          className={`btn-icon h-7 w-7 ${store.snap ? '!border-star-500/50 !text-star-300' : ''}`}
          onClick={() => store.setSnap(!store.snap)}
          title={t('ed.snap')}
          aria-label={t('ed.snap')}
        >
          <Magnet size={13} />
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <TBtn icon={Scissors} label={t('ed.split')} onClick={splitAtPlayhead} />
        <TBtn icon={Copy} label={t('ed.dup')} onClick={() => {
          store.mutate((d) => {
            for (const tr of d.tracks) {
              const dups = tr.clips.filter((c) => store.selection.includes(c.id)).map((c) => ({ ...c, id: uid('clip'), start: c.start + c.duration }))
              tr.clips.push(...dups)
            }
          })
        }} disabled={!store.selection.length} />
        <TBtn icon={Trash2} label={t('ed.delete')} onClick={() => {
          store.mutate((d) => {
            for (const tr of d.tracks) tr.clips = tr.clips.filter((c) => !store.selection.includes(c.id))
          })
          useEditor.setState({ selection: [] })
        }} disabled={!store.selection.length} danger />
        <div className="ms-auto flex items-center gap-2 text-[10px] text-zinc-500">
          {p.beatMap && <span className="chip !border-star-500/30">{p.beatMap.bpm} BPM</span>}
          <span className="tabular-nums">{formatTime(p.duration)}</span>
        </div>
      </div>

      {/* scroll area */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width }}>
          {/* ruler */}
          <div
            className="sticky top-0 z-20 h-7 cursor-pointer border-b border-white/8 bg-ink-900/95 backdrop-blur"
            onPointerDown={seekFromRuler}
          >
            <div ref={laneRef} className="relative h-full">
              {rulerTicks(p.duration, pps).map((tt) => (
                <div key={tt} className="absolute top-0 h-full" style={{ left: tt * pps }}>
                  <div className="h-2 w-px bg-white/20" />
                  <span className="absolute top-2 start-1 text-[9px] tabular-nums text-zinc-500">{formatTime(tt)}</span>
                </div>
              ))}
              {beats.map((b, i) => (
                <div key={`b${i}`} className="absolute bottom-0 h-2.5 w-px bg-star-400/60" style={{ left: b * pps }} />
              ))}
              {drops.map((b, i) => (
                <div key={`d${i}`} className="absolute bottom-0 h-3.5 w-[2px] bg-red-400/80" style={{ left: b * pps }} />
              ))}
            </div>
          </div>

          {/* tracks */}
          <div className="relative pb-4">
            {tracks.map((tr) => (
              <div key={tr.id} className="flex border-b border-white/4">
                <div className="sticky start-0 z-10 flex w-24 shrink-0 flex-col justify-center bg-ink-900/95 px-2 py-1.5 backdrop-blur">
                  <span className="text-[11px] font-semibold text-zinc-300">
                    {trackIcon(tr.kind)} {tr.name}
                  </span>
                  <span className="text-[9px] text-zinc-600">{tr.clips.length} clips</span>
                </div>
                <div
                  className="relative h-14 flex-1"
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      store.select([])
                      seekFromRuler(e)
                    }
                  }}
                >
                  {tr.kind !== 'video' && <div className="pointer-events-none absolute inset-0 bg-black/25" />}
                  {tr.clips.map((c) => {
                    const selected = store.selection.includes(c.id)
                    return (
                      <div
                        key={c.id}
                        className={`group absolute inset-y-1 overflow-hidden rounded-md border transition-shadow ${selected ? 'border-star-400 shadow-glow-sm z-10' : 'border-white/15 hover:border-white/35'}`}
                        style={{
                          left: c.start * pps,
                          width: Math.max(6, c.duration * pps),
                          background:
                            c.kind === 'audio'
                              ? 'linear-gradient(180deg, rgba(96,165,250,0.28), rgba(59,130,246,0.14))'
                              : c.kind === 'text'
                                ? 'linear-gradient(180deg, rgba(167,139,250,0.3), rgba(124,58,237,0.15))'
                                : '#151525',
                        }}
                        onPointerDown={(e) => startDrag(e, c, tr, 'move')}
                      >
                        {c.kind !== 'audio' && c.kind !== 'text' && c.mediaId && store.blobs.has(c.mediaId) && (
                          <ThumbClip mediaId={c.mediaId} />
                        )}
                        {c.kind === 'audio' && c.mediaId && (
                          <WaveClip mediaId={c.mediaId} />
                        )}
                        <span className="pointer-events-none absolute inset-x-1 bottom-0.5 truncate text-[9px] font-medium text-white/75">
                          {c.kind === 'text' ? c.text?.content || 'Text' : c.name}
                        </span>
                        {c.transitionIn.style !== 'none' && (
                          <span className="pointer-events-none absolute start-0 top-0 h-full w-2.5 bg-gradient-to-r from-white/35 to-transparent" />
                        )}
                        {/* resize handles */}
                        <div
                          className="absolute inset-y-0 start-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/30"
                          onPointerDown={(e) => startDrag(e, c, tr, 'resize-l')}
                        />
                        <div
                          className="absolute inset-y-0 end-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/30"
                          onPointerDown={(e) => startDrag(e, c, tr, 'resize-r')}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* playhead */}
            <div className="pointer-events-none absolute inset-y-0 z-30" style={{ left: 96 + store.time * pps }}>
              <div className="h-full w-px bg-star-400 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
              <div className="absolute -top-0 -start-[5px] h-2.5 w-2.5 rotate-45 rounded-[2px] bg-star-400" />
            </div>
          </div>
        </div>
      </div>
      {dragging && <div className="pointer-events-none fixed inset-0 z-50 cursor-grabbing" />}
    </div>
  )
}

function TBtn({ icon: Icon, label, onClick, disabled, danger }: { icon: typeof Scissors; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      className={`btn-icon h-7 w-7 ${danger ? 'hover:!border-red-500/40 hover:!text-red-400' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <Icon size={13} />
    </button>
  )
}

function ThumbClip({ mediaId }: { mediaId: string }) {
  const asset = useEditor((s) => s.assets.find((a) => a.id === mediaId))
  if (!asset?.thumb) return null
  return (
    <div
      className="absolute inset-0 opacity-80"
      style={{ backgroundImage: `url(${asset.thumb})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' }}
    />
  )
}

function WaveClip({ mediaId }: { mediaId: string }) {
  const asset = useEditor((s) => s.assets.find((a) => a.id === mediaId))
  if (!asset?.peaks?.length) return null
  const n = 60
  const step = Math.max(1, Math.floor(asset.peaks.length / n))
  const pts: number[] = []
  for (let i = 0; i < n; i++) pts.push(asset.peaks[i * step] ?? 0)
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${n} 10`}>
      {pts.map((v, i) => (
        <rect key={i} x={i} y={5 - v * 4.4} width={0.8} height={Math.max(0.4, v * 8.8)} fill="rgba(147,197,253,0.85)" />
      ))}
    </svg>
  )
}

function rulerTicks(duration: number, pps: number): number[] {
  const targets = [0.5, 1, 2, 5, 10, 15, 30, 60]
  const stepSec = targets.find((s) => s * pps >= 64) ?? 60
  const out: number[] = []
  for (let t = 0; t <= duration + 0.01; t += stepSec) out.push(Math.round(t * 10) / 10)
  return out
}
