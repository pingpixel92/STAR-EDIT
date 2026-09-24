import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Sparkles, Music, Scissors, Wand2, Captions, Image as ImageIcon,
  Download, Upload, Play, Check, Copy, ChevronDown, BookOpen, Layers,
} from 'lucide-react'
import { LogoWord } from '../components/Logo'
import { HeroEditorMock, DemoSection } from '../components/landing/EngineDemo'
import { navigate } from '../App'
import { useI18n } from '../lib/i18n'

const FEATURES = [
  { icon: Music, big: true, t: 'feat.b1t', d: 'feat.b1d' },
  { icon: ImageIcon, big: true, t: 'feat.b2t', d: 'feat.b2d' },
  { icon: Scissors, t: 'feat.b3t', d: 'feat.b3d' },
  { icon: Wand2, t: 'feat.b4t', d: 'feat.b4d' },
  { icon: Layers, t: 'feat.b5t', d: 'feat.b5d' },
  { icon: Captions, t: 'feat.b6t', d: 'feat.b6d' },
  { icon: BookOpen, t: 'feat.b7t', d: 'feat.b7d' },
  { icon: Download, t: 'feat.b8t', d: 'feat.b8d' },
]

const COMMANDS = ['cmd.c1', 'cmd.c2', 'cmd.c3', 'cmd.c4', 'cmd.c5', 'cmd.c6']

const FAQS = [
  ['faq.q1', 'faq.a1'],
  ['faq.q2', 'faq.a2'],
  ['faq.q3', 'faq.a3'],
  ['faq.q4', 'faq.a4'],
  ['faq.q5', 'faq.a5'],
]

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function Landing() {
  const { t, lang, setLang } = useI18n()
  const [copied, setCopied] = useState<string | null>(null)

  const copyCmd = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(t(cmd))
      setCopied(cmd)
      setTimeout(() => setCopied((c) => (c === cmd ? null : c)), 1600)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {/* ---------------- NAV ---------------- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="section-pad flex h-16 items-center justify-between">
          <LogoWord />
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#how" className="transition-colors hover:text-white">{t('how.title')}</a>
            <a href="#features" className="transition-colors hover:text-white">{t('feat.title')}</a>
            <a href="#commands" className="transition-colors hover:text-white">{t('cmd.nav')}</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/guide')} className="btn-ghost hidden !px-3 !py-2 !text-[13px] sm:inline-flex">
              <BookOpen size={14} /> {t('nav.guide')}
            </button>
            <button onClick={() => navigate('/projects')} className="btn-ghost hidden !px-3 !py-2 !text-[13px] md:inline-flex">
              {t('nav.projects')}
            </button>
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-4 !py-2 !text-[13px]">
              {t('hero.cta')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- HERO ---------------- */}
      <section className="aurora relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="section-pad relative grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="chip mb-5">
              <Sparkles size={11} className="text-star-400" /> {t('hero.badge')}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="max-w-xl text-4xl font-extrabold leading-[1.06] tracking-[-0.02em] sm:text-[3.4rem]"
            >
              {t('hero.title1')} {t('hero.title2')}
              <br />
              <span className="text-gradient">{t('hero.title3')}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-5 max-w-lg text-[15px] leading-relaxed text-zinc-400"
            >
              {t('hero.sub')}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button onClick={() => navigate('/projects?new=1')} className="btn-accent !rounded-lg !px-6 !py-3 !text-[15px]">
                {t('hero.cta')} <ArrowRight size={16} />
              </button>
              <a href="#how" className="btn-ghost !rounded-lg !px-5 !py-3">{t('hero.how')}</a>
            </motion.div>
            {/* real numbers, tabular-nums */}
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex max-w-lg items-stretch gap-0 text-center"
            >
              {[
                ['14', t('hero.n1')],
                ['10', t('hero.n2')],
                ['5', t('hero.n3')],
                ['0', t('hero.n4')],
              ].map(([n, label], i) => (
                <div key={label} className={`flex-1 px-3 ${i > 0 ? 'border-s border-white/8' : ''} first:ps-0 last:pe-0`}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="tnum text-2xl font-extrabold text-white">{n}</dd>
                  <dd className="mt-1 text-[10.5px] leading-tight text-zinc-500">{label}</dd>
                </div>
              ))}
            </motion.dl>
          </div>
          <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
            <HeroEditorMock />
          </motion.div>
        </div>
      </section>

      {/* ---------------- HOW ---------------- */}
      <section id="how" className="section-pad py-20">
        <Reveal>
          <p className="eyebrow text-center">{t('how.title')}</p>
          <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">{t('app.tagline')}</h2>
        </Reveal>
        <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '1', icon: Upload, t: t('how.s1t'), d: t('how.s1d') },
            { n: '2', icon: Sparkles, t: t('how.s2t'), d: t('how.s2d') },
            { n: '3', icon: Scissors, t: t('how.s3t'), d: t('how.s3d') },
            { n: '4', icon: Download, t: t('how.s4t'), d: t('how.s4d') },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <div className="glass relative h-full rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-star-500/25 bg-star-500/10">
                    <s.icon size={15} className="text-star-300" />
                  </span>
                  <span className="tnum text-[11px] font-bold text-zinc-600">STEP {s.n}/4</span>
                </div>
                <h3 className="mt-4 text-[15px] font-bold">{s.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- FEATURES (bento) ---------------- */}
      <section id="features" className="aurora border-y border-white/5 py-20">
        <div className="section-pad">
          <Reveal>
            <p className="eyebrow text-center">{t('feat.title')}</p>
            <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">{t('feat.sub')}</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 4) * 0.05} className={f.big ? 'md:col-span-2' : ''}>
                <div className="group glass h-full rounded-2xl p-5 transition-colors hover:border-white/15">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <f.icon size={14} className="text-star-300" />
                    </span>
                    <h3 className="text-[14.5px] font-bold">{t(f.t)}</h3>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">{t(f.d)}</p>
                  {f.big && (
                    <div className="mt-4">
                      {i === 0 ? (
                        /* beat viz */
                        <div className="flex h-12 items-end gap-[3px] overflow-hidden rounded-lg border border-white/6 bg-black/40 px-2 py-2">
                          {Array.from({ length: 56 }).map((_, k) => {
                            const beat = k % 8 === 0
                            return (
                              <span
                                key={k}
                                className={`w-full rounded-[1px] ${beat ? 'bg-star-400/90' : 'bg-sky-400/40'}`}
                                style={{ height: `${beat ? 100 : 22 + ((k * 17) % 40)}%` }}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        /* filmstrip */
                        <div className="flex gap-1.5 overflow-hidden rounded-lg border border-white/6 bg-black/40 p-2">
                          {Array.from({ length: 7 }).map((_, k) => (
                            <div
                              key={k}
                              className="h-12 flex-1 rounded-[3px]"
                              style={{
                                background: `linear-gradient(${140 + k * 24}deg, hsl(${250 + k * 14} 45% ${16 + (k % 3) * 6}%), hsl(${270 + k * 10} 40% 10%))`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- COMMANDS ---------------- */}
      <section id="commands" className="section-pad py-20">
        <Reveal>
          <p className="eyebrow text-center">{t('nav.guide')} · STAR AI</p>
          <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">{t('cmd.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{t('cmd.sub')}</p>
        </Reveal>
        <div className="mx-auto mt-10 max-w-2xl space-y-2">
          {COMMANDS.map((c, i) => (
            <Reveal key={c} delay={i * 0.04}>
              <div className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]">
                <span className="tnum hidden w-6 shrink-0 text-[11px] font-bold text-zinc-600 sm:block">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-200">“{t(c)}”</span>
                <button
                  onClick={() => void copyCmd(c)}
                  className="btn-ghost shrink-0 !rounded-lg !px-2.5 !py-1.5 !text-[11px]"
                  title={t('cmd.copy')}
                >
                  {copied === c ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied === c ? t('cmd.copied') : t('cmd.copy')}
                </button>
                <button
                  onClick={() => navigate('/projects?new=1')}
                  className="btn-accent shrink-0 !rounded-lg !px-3 !py-1.5 !text-[11px]"
                  title={t('cmd.try')}
                >
                  {t('cmd.try')} <ArrowRight size={11} />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- DEMO (real engine) ---------------- */}
      <div id="demo" className="border-y border-white/5 bg-ink-900/30">
        <DemoSection title={t('demo.title')} sub={t('demo.sub')} />
      </div>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="section-pad py-20">
        <Reveal>
          <p className="eyebrow text-center">FAQ</p>
          <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">{t('faq.title')}</h2>
        </Reveal>
        <div className="mx-auto mt-10 max-w-2xl space-y-2">
          {FAQS.map(([q, a], i) => (
            <Reveal key={q} delay={i * 0.03}>
              <details className="group rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5 open:border-white/15 open:bg-white/[0.05]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden">
                  {t(q)}
                  <ChevronDown size={15} className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">{t(a)}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section id="pricing" className="section-pad pb-20">
        <Reveal>
          <p className="eyebrow text-center">{t('pricing.title')}</p>
          <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">$0</h2>
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-lg">
          <div className="glass rounded-2xl p-7 shadow-card">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-extrabold tracking-tight">FREE</h3>
              <div className="text-end">
                <span className="tnum text-3xl font-extrabold text-white">$0</span>
                <div className="text-[11px] text-zinc-500">{t('pricing.free')}</div>
              </div>
            </div>
            <div className="hairline my-5" />
            <ul className="space-y-2.5 text-[13.5px] text-zinc-300">
              {[t('pricing.f1'), t('pricing.f2'), t('pricing.f3'), t('pricing.f4'), t('pricing.f5'), t('pricing.f6')].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={15} className="mt-0.5 shrink-0 text-star-400" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-[12px] leading-relaxed text-zinc-400">
              {t('pricing.note')}
            </p>
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent mt-6 w-full !py-3">
              {t('hero.cta')} <ArrowRight size={15} />
            </button>
          </div>
        </Reveal>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="aurora border-t border-white/5 py-20">
        <div className="section-pad text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t('cta.title')}</h2>
          <p className="mt-3 text-sm text-zinc-400">{t('cta.sub')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-7 !py-3 !text-[15px]">
              {t('hero.cta')} <Play size={15} />
            </button>
            <button onClick={() => navigate('/guide')} className="btn-ghost !px-5 !py-3">
              <BookOpen size={15} /> {t('nav.guide')}
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="border-t border-white/5 py-8">
        <div className="section-pad flex flex-col items-center justify-between gap-4 text-[12px] text-zinc-500 sm:flex-row">
          <LogoWord compact />
          <p className="text-center sm:text-start">{t('footer.rights')}</p>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/guide')} className="transition-colors hover:text-white">{t('nav.guide')}</button>
            <select
              className="field !w-auto !py-1 !text-[11px]"
              value={lang}
              onChange={(e) => setLang(e.target.value as 'en' | 'fa' | 'ru' | 'zh')}
              aria-label={t('st.lang')}
            >
              <option value="en" className="bg-ink-900">English</option>
              <option value="fa" className="bg-ink-900">فارسی</option>
              <option value="ru" className="bg-ink-900">Русский</option>
              <option value="zh" className="bg-ink-900">中文</option>
            </select>
            <span className="tnum text-zinc-600">v1.1</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
