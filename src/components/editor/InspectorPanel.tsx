import { Trash2 } from 'lucide-react'
import { useEditor } from '../../lib/store'
import { Field, Select, Slider, Toggle } from '../ui'
import { EFFECTS_OPTS, GRADE_OPTS, MOTION_OPTS, TRANSITION_OPTS } from './inspectorOptions'
import type { Clip, EffectSpec, EffectType } from '../../lib/types'
import { useEffect } from 'react'
import { useI18n } from '../../lib/i18n'

export default function InspectorPanel() {
  const { t } = useI18n()
  const store = useEditor()
  const sel = store.selection
  const p = store.project
  const clip: Clip | undefined = p?.tracks.flatMap((tr) => tr.clips).find((c) => c.id === sel[0])

  useEffect(() => {
    // redraw preview when inspector edits land
    if (!store.playing) {
      const id = setTimeout(() => window.dispatchEvent(new CustomEvent('star-redraw')), 40)
      return () => clearTimeout(id)
    }
  }, [clip, store.playing])

  if (!clip || !p) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[12.5px] leading-relaxed text-zinc-600">
        {t('ed.selectClip')}
      </div>
    )
  }

  const patch = (fn: (c: Clip) => void) => {
    store.mutate((d) => {
      for (const tr of d.tracks) {
        const c = tr.clips.find((x) => x.id === clip.id)
        if (c) fn(c)
      }
    }, { history: false })
  }
  const commit = () => {
    const s = useEditor.getState()
    const project = s.project
    if (project) s.mutate(() => {}, { history: true })
  }

  const isVisual = clip.kind === 'image' || clip.kind === 'video' || clip.kind === 'placeholder'
  const isAudible = clip.kind === 'audio' || clip.kind === 'video'

  const addEffect = (type: EffectType) => {
    commit()
    patch((c) => {
      if (!c.effects.some((e) => e.type === type)) c.effects.push({ type, intensity: 0.5 } as EffectSpec)
    })
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="truncate text-[13px] font-bold text-zinc-200">{clip.kind === 'text' ? clip.text?.content || 'Text' : clip.name}</h3>
        <span className="chip">{clip.kind}</span>
      </div>

      {/* timing */}
      <section className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.timing')}</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('ins.start')}>
            <input
              className="field !py-1.5" type="number" step={0.1} min={0}
              value={Number(clip.start.toFixed(2))}
              onFocus={commit}
              onChange={(e) => patch((c) => (c.start = Math.max(0, parseFloat(e.target.value) || 0)))}
            />
          </Field>
          <Field label={t('ins.dur')}>
            <input
              className="field !py-1.5" type="number" step={0.1} min={0.15}
              value={Number(clip.duration.toFixed(2))}
              onFocus={commit}
              onChange={(e) => patch((c) => (c.duration = Math.max(0.15, parseFloat(e.target.value) || 0.15)))}
            />
          </Field>
        </div>
      </section>

      {/* motion */}
      {isVisual && (
        <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.motion')}</h4>
          <Select
            label={t('ins.type')} value={clip.motion.type} options={MOTION_OPTS}
            onChange={(v) => {
              commit()
              patch((c) => (c.motion.type = v))
            }}
          />
          <Slider
            label={t('ins.intensity')} min={0.05} max={1} step={0.05} value={clip.motion.intensity}
            onChange={(v) => patch((c) => (c.motion.intensity = v))}
            onCommit={commit}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </section>
      )}

      {/* effects */}
      {isVisual && (
        <section className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.effects')}</h4>
          {clip.effects.map((e, i) => (
            <div key={e.type} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] text-zinc-300">{EFFECTS_OPTS.find((o) => o.value === e.type)?.label ?? e.type}</span>
              <input
                type="range" min={0.05} max={1} step={0.05} value={e.intensity}
                onPointerDown={commit}
                onChange={(ev) => patch((c) => (c.effects[i].intensity = parseFloat(ev.target.value)))}
                className="flex-1"
                aria-label={e.type}
              />
              <button
                className="btn-icon h-6 w-6 hover:!border-red-500/40 hover:!text-red-400"
                onClick={() => { commit(); patch((c) => c.effects.splice(i, 1)) }}
                aria-label={`Remove ${e.type}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <Select
            label={t('ins.addEffect')} value={''}
            options={[{ value: '', label: t('ins.choose') }, ...EFFECTS_OPTS.filter((o) => !clip.effects.some((e) => e.type === o.value))]}
            onChange={(v) => v && addEffect(v)}
          />
        </section>
      )}

      {/* grade + transition + opacity */}
      {isVisual && (
        <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.look')}</h4>
          <Select label={t('ins.grade')} value={clip.colorGrade} options={GRADE_OPTS} onChange={(v) => { commit(); patch((c) => (c.colorGrade = v)) }} />
          <Select
            label={t('ins.transIn')} value={clip.transitionIn.style} options={TRANSITION_OPTS}
            onChange={(v) => { commit(); patch((c) => (c.transitionIn.style = v)) }}
          />
          {clip.transitionIn.style !== 'none' && (
            <Slider
              label={t('ins.transLen')} min={0.08} max={1.2} step={0.02} value={clip.transitionIn.duration}
              onChange={(v) => patch((c) => (c.transitionIn.duration = v))}
              onCommit={commit}
              format={(v) => `${v.toFixed(2)}s`}
            />
          )}
          <Slider
            label={t('ins.opacity')} min={0.1} max={1} step={0.05} value={clip.opacity}
            onChange={(v) => patch((c) => (c.opacity = v))}
            onCommit={commit}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </section>
      )}

      {/* audio */}
      {isAudible && (
        <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.audio')}</h4>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">{t('ins.muted')}</span>
            <Toggle checked={clip.muted} onChange={(v) => { commit(); patch((c) => (c.muted = v)) }} />
          </div>
          <Slider
            label={t('ins.volume')} min={0} max={1.5} step={0.05} value={clip.volume}
            onChange={(v) => patch((c) => (c.volume = v))}
            onCommit={commit}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label={t('ins.fadeIn')} min={0} max={4} step={0.1} value={clip.fadeIn}
            onChange={(v) => patch((c) => (c.fadeIn = v))}
            onCommit={commit}
            format={(v) => `${v.toFixed(1)}s`}
          />
          <Slider
            label={t('ins.fadeOut')} min={0} max={6} step={0.1} value={clip.fadeOut}
            onChange={(v) => patch((c) => (c.fadeOut = v))}
            onCommit={commit}
            format={(v) => `${v.toFixed(1)}s`}
          />
        </section>
      )}

      {/* speed */}
      {(clip.kind === 'video' || clip.kind === 'audio') && (
        <section className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.speed')}</h4>
          <Slider
            label={t('ins.rate')} min={0.25} max={3} step={0.05} value={clip.speed}
            onChange={(v) => {
              const old = clip.speed
              patch((c) => {
                const srcDur = c.duration * old
                c.speed = v
                c.duration = srcDur / v
              })
            }}
            onCommit={commit}
            format={(v) => `${v.toFixed(2)}×`}
          />
        </section>
      )}

      {/* text */}
      {clip.kind === 'text' && clip.text && (
        <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('ins.text')}</h4>
          <Field label={t('ins.content')}>
            <textarea
              className="field min-h-[60px]" value={clip.text.content}
              onFocus={commit}
              onChange={(e) => patch((c) => { if (c.text) c.text.content = e.target.value })}
            />
          </Field>
          <Slider label={t('ins.size')} min={3} max={22} step={0.5} value={clip.text.size} onChange={(v) => patch((c) => { if (c.text) c.text.size = v })} onCommit={commit} format={(v) => `${v}%`} />
          <div className="grid grid-cols-2 gap-2">
            <Slider label={t('ins.x')} min={0.05} max={0.95} step={0.01} value={clip.text.x} onChange={(v) => patch((c) => { if (c.text) c.text.x = v })} onCommit={commit} />
            <Slider label={t('ins.y')} min={0.05} max={0.95} step={0.01} value={clip.text.y} onChange={(v) => patch((c) => { if (c.text) c.text.y = v })} onCommit={commit} />
          </div>
          <Select
            label={t('ins.anim')} value={clip.text.anim}
            options={[
              { value: 'none', label: 'None' }, { value: 'fade', label: 'Fade' }, { value: 'slideUp', label: 'Slide up' },
              { value: 'pop', label: 'Pop' }, { value: 'typewriter', label: 'Typewriter' }, { value: 'karaoke', label: 'Karaoke (word-by-word)' },
            ]}
            onChange={(v) => { commit(); patch((c) => { if (c.text) c.text.anim = v }) }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">{t('ins.stroke')}</span>
            <Toggle checked={clip.text.stroke} onChange={(v) => { commit(); patch((c) => { if (c.text) c.text.stroke = v }) }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">{t('ins.glow')}</span>
            <Toggle checked={clip.text.glow} onChange={(v) => { commit(); patch((c) => { if (c.text) c.text.glow = v }) }} />
          </div>
        </section>
      )}

      {/* danger */}
      <button
        className="btn-ghost w-full !border-red-500/30 !py-2 !text-[12px] !text-red-400"
        onClick={() => {
          store.mutate((d) => {
            for (const tr of d.tracks) tr.clips = tr.clips.filter((c) => c.id !== clip.id)
          })
          useEditor.setState({ selection: [] })
        }}
      >
        <Trash2 size={13} /> {t('ins.delete')}
      </button>
    </div>
  )
}
