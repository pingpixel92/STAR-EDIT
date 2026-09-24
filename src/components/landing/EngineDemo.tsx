// Real-engine demo widgets for the landing page — the SAME renderer the editor uses
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors, Sparkles } from 'lucide-react'
import { makeDemoImageSet, PALETTES } from '../../lib/assets'
import { renderFrame, type AssetView, type RenderEnv } from '../../engine/renderer'
import { STYLES } from '../../engine/styles'
import { buildPhotoEdit } from '../../engine/editEngine'
import type { MediaAsset, Project } from '../../lib/types'
import { REDUCED_MOTION, uid } from '../../lib/utils'

export function EngineCanvas({ env, project, playing = true, className = '' }: { env: RenderEnv; project: Project; playing?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const a = project.width / project.height
    const h = 420
    canvas.width = Math.round(h * a)
    canvas.height = h
    if (!playing || REDUCED_MOTION()) {
      renderFrame(ctx, canvas.width, canvas.height, project, 0.6, env)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % project.duration
      renderFrame(ctx, canvas.width, canvas.height, project, t, env)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [env, project, playing])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: 'auto', display: 'block' }} />
}

export async function buildDemoProject(styleKey: keyof typeof PALETTES, styleId: keyof typeof STYLES, withTitle: boolean): Promise<{ env: RenderEnv; project: Project }> {
  const blobs = await makeDemoImageSet(styleKey, 6)
  const assets: MediaAsset[] = blobs.map((b, i) => ({
    id: uid('da'), projectId: 'demo', name: `demo-${i + 1}.jpg`, type: 'image', mimeType: 'image/jpeg',
    size: b.size, width: 720, height: 1280, createdAt: Date.now() + i,
  }))
  const env: RenderEnv = { assets: new Map() }
  await Promise.all(
    blobs.map(async (b, i) => {
      const url = URL.createObjectURL(b)
      const img = new Image()
      img.src = url
      await img.decode().catch(() => {})
      env.assets.set(assets[i].id, { meta: assets[i], url, img })
    })
  )
  const project: Project = {
    id: 'demo', name: 'Demo', aspect: '9:16', width: 1080, height: 1920, fps: 30,
    tracks: [
      { id: uid('t'), kind: 'video', name: 'Video', clips: [], muted: false, hidden: false },
      { id: uid('t'), kind: 'audio', name: 'Music', clips: [], muted: false, hidden: false },
      { id: uid('t'), kind: 'text', name: 'Text', clips: [], muted: false, hidden: false },
    ],
    duration: 8, versions: [], createdAt: Date.now(), updatedAt: Date.now(),
  }
  buildPhotoEdit(project, assets, {
    duration: 8,
    style: STYLES[styleId] ? styleId : 'cinematic',
    beatSync: false,
    title: withTitle ? 'STAR EDIT' : undefined,
  })
  return { env, project }
}

/** Hero visual — a believable editor window running the real engine */
export function HeroEditorMock() {
  const [demo, setDemo] = useState<{ env: RenderEnv; project: Project } | null>(null)
  useEffect(() => {
    let alive = true
    buildDemoProject('star', 'cinematic', true).then((d) => alive && setDemo(d))
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      {/* editor window */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-card">
        {/* window chrome */}
        <div className="flex h-9 items-center gap-2 border-b border-white/6 bg-ink-850 px-3">
          <span className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="ms-2 truncate text-[10px] font-medium text-zinc-500">STAR EDIT — my-first-edit</span>
          <span className="ms-auto rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">1080×1920</span>
        </div>
        {/* command bar */}
        <div className="flex items-center gap-2 border-b border-white/6 px-3 py-2">
          <Sparkles size={12} className="shrink-0 text-star-400" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
            Make a 15s cinematic football edit, sync every cut to the beat
          </span>
          <span className="shrink-0 rounded bg-star-500/15 px-1.5 py-0.5 text-[9px] font-bold text-star-300">⏎</span>
        </div>
        {/* preview */}
        <div className="bg-black">
          {demo ? (
            <EngineCanvas env={demo.env} project={demo.project} />
          ) : (
            <div className="aspect-[9/16] w-full animate-pulse bg-ink-900" />
          )}
        </div>
        {/* timeline strip — mirrors the real clip layout produced by buildPhotoEdit */}
        <div className="space-y-1 border-t border-white/6 bg-ink-850 px-2 py-2">
          <div className="flex items-center gap-1">
            <Scissors size={8} className="shrink-0 text-zinc-600" />
            <div className="flex h-3.5 flex-1 gap-[2px] overflow-hidden">
              {Array.from({ length: Math.max(3, demo?.project.tracks[0].clips.length ?? 4) }).map((_, i) => (
                <span
                  key={i}
                  className="h-full rounded-[2px] bg-gradient-to-b from-zinc-500/70 to-zinc-600/50"
                  style={{ flexGrow: 1 + ((i * 7) % 3) }}
                />
              ))}
            </div>
          </div>
          <div className="flex h-3.5 items-end gap-[2px] ps-4">
            {Array.from({ length: 42 }).map((_, i) => (
              <motion.span
                key={i}
                className="w-full rounded-[1px] bg-sky-400/50"
                animate={REDUCED_MOTION() ? undefined : { height: [3, 3 + ((i * 11) % 9), 3] }}
                transition={{ duration: 1.4 + (i % 5) * 0.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </div>
      {/* status pill under the window */}
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-white/8 bg-ink-900/80 px-3 py-1.5 text-[10.5px] text-zinc-400 shadow-card backdrop-blur">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Rendered locally by the STAR EDIT engine — the real renderer, not a video
      </div>
    </div>
  )
}

/** Interactive style switcher demo — real engine, real styles */
export function DemoSection({ title, sub }: { title: string; sub: string }) {
  const [demo, setDemo] = useState<{ env: RenderEnv; project: Project; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const picks: { key: keyof typeof PALETTES; style: keyof typeof STYLES; label: string }[] = [
    { key: 'cinematic', style: 'cinematic', label: 'Cinematic' },
    { key: 'football', style: 'sports', label: 'Football' },
    { key: 'travel', style: 'travel', label: 'Travel' },
    { key: 'gaming', style: 'gaming', label: 'Gaming' },
    { key: 'fashion', style: 'fashion', label: 'Fashion' },
  ]
  const build = async (p: (typeof picks)[number]) => {
    setBusy(true)
    try {
      const d = await buildDemoProject(p.key, p.style, true)
      setDemo({ ...d, key: p.label })
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    build(picks[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="section-pad py-20">
      <h2 className="text-center text-2xl font-extrabold sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{sub}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {picks.map((p) => (
          <button
            key={p.label}
            onClick={() => build(p)}
            className={`btn-ghost !rounded-full !px-4 !py-1.5 !text-[12px] ${demo?.key === p.label ? '!border-star-500/60 !text-white' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-[280px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
          {demo ? (
            <EngineCanvas key={demo.key} env={demo.env} project={demo.project} playing={!busy} />
          ) : (
            <div className="aspect-[9/16] w-full animate-pulse bg-ink-850" />
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          {demo ? STYLES[picks.find((x) => x.label === demo.key)?.style ?? 'cinematic'].desc : '…'}
        </p>
      </div>
    </div>
  )
}
