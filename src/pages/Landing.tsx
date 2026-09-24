import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Sparkles, Music, Scissors, Wand2, Captions, Shapes, Image as ImageIcon,
  Gauge, Download, Upload, Play, Zap, Heart, Star, Check, Languages,
} from 'lucide-react'
import { LogoWord } from '../components/Logo'
import { navigate } from '../App'
import { useI18n } from '../lib/i18n'
import { makeDemoImageSet, PALETTES } from '../lib/assets'
import { renderFrame, type AssetView, type RenderEnv } from '../engine/renderer'
import { STYLES } from '../engine/styles'
import { buildPhotoEdit } from '../engine/editEngine'
import { TEMPLATES } from '../engine/templates'
import type { AspectId, MediaAsset, Project } from '../lib/types'
import { REDUCED_MOTION, uid } from '../lib/utils'

// ---------- Reusable mini player that runs the REAL render engine ----------
function EngineCanvas({ env, project, playing = true, className = '' }: { env: RenderEnv; project: Project; playing?: boolean; className?: string }) {
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
  return <canvas ref={ref} className={className} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14 }} />
}

async function buildDemoProject(styleKey: keyof typeof PALETTES, styleId: keyof typeof STYLES, withTitle: boolean): Promise<{ env: RenderEnv; project: Project }> {
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

// ---------- Hero mini editor (always cinematic) ----------
function HeroPreview() {
  const [demo, setDemo] = useState<{ env: RenderEnv; project: Project } | null>(null)
  useEffect(() => {
    let alive = true
    buildDemoProject('star', 'cinematic', true).then((d) => alive && setDemo(d))
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="glass relative mx-auto w-full max-w-[290px] overflow-hidden rounded-3xl p-3 shadow-card">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ms-auto text-[10px] font-medium text-zinc-500">STAR EDIT · preview</span>
      </div>
      <div className="relative">
        {demo ? (
          <EngineCanvas env={demo.env} project={demo.project} />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl bg-ink-900">
            <Star className="star-pulse text-star-500" size={42} />
          </div>
        )}
        {/* fake timeline overlay bars — decorative */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-1.5 rounded-lg bg-black/55 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <Scissors size={10} className="text-star-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-star-500 to-pulse-500"
                animate={{ width: ['12%', '88%', '12%'] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
          <div className="flex items-end gap-[3px]">
            {Array.from({ length: 34 }).map((_, i) => (
              <motion.span
                key={i}
                className="w-full rounded-sm bg-star-400/70"
                animate={{ height: [4, 6 + ((i * 13) % 14), 4] }}
                transition={{ duration: 1.6 + (i % 5) * 0.22, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Interactive demo (real engine, real styles) ----------
function DemoSection() {
  const { t } = useI18n()
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
      <motion.h2 initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center text-3xl font-extrabold sm:text-4xl">
        {t('demo.title')}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        {t('demo.sub')}
      </motion.p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {picks.map((p) => (
          <button
            key={p.label}
            onClick={() => build(p)}
            className={`btn-ghost ${demo?.key === p.label ? 'border-star-500/60 text-white shadow-glow-sm' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-[300px]">
        {demo ? (
          <EngineCanvas key={demo.key} env={demo.env} project={demo.project} playing={!busy} />
        ) : (
          <div className="aspect-[9/16] w-full animate-pulse rounded-xl bg-ink-850" />
        )}
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Rendered locally by the STAR EDIT engine — {demo ? STYLES[picks.find((x) => x.label === demo.key)?.style ?? 'cinematic'].desc : '…'}
        </p>
      </div>
    </div>
  )
}

// ---------- Landing ----------
const FEATURES = [
  { icon: Music, k: 'Beat Sync', d: 'Real BPM + onset detection from your music; cuts land on detected beats.' },
  { icon: Scissors, k: 'Smart Cuts', d: 'Style-driven cut frequency that actually re-times the timeline.' },
  { icon: Wand2, k: 'Cinematic Effects', d: 'Zooms, shakes, flash, whip pans, vignette, RGB split — all real canvas effects.' },
  { icon: Captions, k: 'Captions', d: 'Styled, animated caption cards (karaoke word-by-word supported).' },
  { icon: Shapes, k: 'Motion Graphics', d: 'Title cards, lower thirds, animated counters, logo reveal.' },
  { icon: Gauge, k: 'Reference Styles', d: 'Upload a reference clip — measured pacing and tones guide the edit.' },
  { icon: ImageIcon, k: 'Photo-to-Video', d: 'Photos + song → beat-synced edit with Ken Burns motion in one command.' },
  { icon: Zap, k: 'AI Pacing', d: '14 editing styles, from Emotional to Hype — each changes real parameters.' },
]

export default function Landing() {
  const { t } = useI18n()
  const pipeline = useMemo(
    () => [
      { icon: Upload, label: 'Media' },
      { icon: Sparkles, label: 'STAR AI' },
      { icon: Scissors, label: 'Timeline' },
      { icon: Download, label: 'Video' },
    ],
    []
  )
  return (
    <div className="min-h-screen bg-ink-950">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="section-pad flex h-16 items-center justify-between">
          <LogoWord />
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#how" className="transition-colors hover:text-white">{t('nav.home')}</a>
            <a href="#features" className="transition-colors hover:text-white">{t('feat.title')}</a>
            <a href="#demo" className="transition-colors hover:text-white">{t('demo.title')}</a>
            <a href="#pricing" className="transition-colors hover:text-white">$0</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/projects')} className="btn-ghost hidden sm:inline-flex">
              {t('nav.projects')}
            </button>
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-4 !py-2">
              {t('hero.cta')} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="aurora relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="section-pad relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="chip mb-5">
              <Sparkles size={12} className="text-star-400" /> {t('hero.badge')}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
              {t('hero.title1')}
              <br />
              {t('hero.title2')}
              <br />
              <span className="text-gradient">{t('hero.title3')}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5 max-w-lg text-[15px] leading-relaxed text-zinc-400">
              {t('hero.sub')}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-7 !py-3 !text-[15px]">
                {t('hero.cta')} <ArrowRight size={17} />
              </button>
              <a href="#how" className="btn-ghost !px-6 !py-3">{t('hero.how')}</a>
            </motion.div>
            {/* pipeline */}
            <div className="mt-10 flex items-center gap-2 text-xs text-zinc-500">
              {pipeline.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
                    <s.icon size={13} className="text-star-400" /> {s.label}
                  </span>
                  {i < pipeline.length - 1 && <ArrowRight size={12} className="text-zinc-600" />}
                </div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="animate-float-y">
            <HeroPreview />
          </motion.div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="section-pad py-20">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">{t('how.title')}</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', icon: Upload, t: t('how.s1t'), d: t('how.s1d') },
            { n: '02', icon: Sparkles, t: t('how.s2t'), d: t('how.s2d') },
            { n: '03', icon: Scissors, t: t('how.s3t'), d: t('how.s3d') },
            { n: '04', icon: Download, t: t('how.s4t'), d: t('how.s4d') },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <s.icon size={22} className="text-star-400" />
                <span className="text-2xl font-black text-white/10">{s.n}</span>
              </div>
              <h3 className="mt-4 font-bold">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="aurora border-y border-white/5 py-20">
        <div className="section-pad">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">{t('feat.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{t('feat.sub')}</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.k}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.07 }}
                className="group glass rounded-2xl p-6 transition-all hover:border-star-500/40 hover:shadow-glow-sm"
              >
                <div className="inline-flex rounded-xl bg-gradient-to-br from-star-500/20 to-pulse-500/10 p-2.5 group-hover:shadow-glow-sm">
                  <f.icon size={20} className="text-star-300" />
                </div>
                <h3 className="mt-4 font-bold">{f.k}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <div id="demo">
        <DemoSection />
      </div>

      {/* TEMPLATES */}
      <section className="section-pad py-14">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">{t('tpl.title')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{t('tpl.sub')}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TEMPLATES.slice(0, 10).map((tpl) => (
            <div key={tpl.id} className="glass rounded-xl p-4 text-center transition-transform hover:-translate-y-0.5">
              <div className="text-2xl">{tpl.emoji}</div>
              <div className="mt-2 text-[13px] font-bold">{tpl.name}</div>
              <div className="mt-1 text-[11px] text-zinc-500">{tpl.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-pad py-20">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">{t('pricing.title')}</h2>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass mx-auto mt-10 max-w-lg rounded-3xl p-8 shadow-card">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xl font-extrabold">FREE</h3>
            <div className="text-right">
              <span className="text-4xl font-black text-gradient">$0</span>
              <div className="text-[11px] text-zinc-500">{t('pricing.free')}</div>
            </div>
          </div>
          <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
            {[t('pricing.f1'), t('pricing.f2'), t('pricing.f3'), t('pricing.f4'), t('pricing.f5'), t('pricing.f6')].map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check size={16} className="mt-0.5 shrink-0 text-star-400" /> {f}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[12px] leading-relaxed text-zinc-400">
            {t('pricing.note')}
          </p>
          <button onClick={() => navigate('/projects?new=1')} className="btn-accent mt-6 w-full !py-3">
            {t('hero.cta')}
          </button>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="aurora border-t border-white/5 py-20">
        <div className="section-pad text-center">
          <Star className="star-pulse mx-auto text-star-500" size={40} />
          <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">{t('cta.title')}</h2>
          <p className="mt-3 text-sm text-zinc-400">{t('cta.sub')}</p>
          <button onClick={() => navigate('/projects?new=1')} className="btn-accent mt-8 !px-8 !py-3.5 !text-[15px]">
            {t('hero.cta')} <Play size={16} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8">
        <div className="section-pad flex flex-col items-center justify-between gap-4 sm:flex-row">
          <LogoWord compact />
          <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
            <Heart size={12} className="text-star-400" /> {t('footer.rights')}
          </p>
          <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white">
            <Languages size={13} /> EN / فا / RU / 中文
          </button>
        </div>
      </footer>
    </div>
  )
}
