// Edit engine — applies validated EditPlans to the real timeline. Every action truly mutates tracks.
import type {
  BeatMap, Clip, EditPlan, MediaAsset, PlanAction, Project, StyleId, Track, TransitionStyle,
} from '../lib/types'
import { clamp, uid } from '../lib/utils'
import { STYLES } from './styles'

export interface ApplyContext {
  assets: MediaAsset[]
  selection: string[]
  time: number
}

export interface ApplyResult {
  log: string[]
  error?: string
}

function videoTrack(p: Project): Track {
  return p.tracks.find((t) => t.kind === 'video') ?? p.tracks[0]
}
function audioTrack(p: Project): Track | undefined {
  return p.tracks.find((t) => t.kind === 'audio')
}
function textTrack(p: Project): Track {
  let t = p.tracks.find((x) => x.kind === 'text')
  if (!t) {
    t = { id: uid('trt'), kind: 'text', name: 'Text & Captions', clips: [], muted: false, hidden: false }
    p.tracks.push(t)
  }
  return t
}

function sortClips(t: Track) {
  t.clips.sort((a, b) => a.start - b.start)
}

function makeImageClip(trackId: string, a: MediaAsset, start: number, duration: number): Clip {
  return {
    id: uid('clip'), trackId, kind: 'image', mediaId: a.id, name: a.name,
    start, duration, inPoint: 0, speed: 1, volume: 0, muted: true,
    fadeIn: 0, fadeOut: 0, motion: { type: 'kenburns', intensity: 0.6 },
    effects: [], colorGrade: 'none', transitionIn: { style: 'none', duration: 0 }, opacity: 1,
  }
}

function makeAudioClip(trackId: string, a: MediaAsset, start: number, duration: number): Clip {
  return {
    id: uid('clip'), trackId, kind: 'audio', mediaId: a.id, name: a.name,
    start, duration, inPoint: 0, speed: 1, volume: 0.9, muted: false,
    fadeIn: 0.15, fadeOut: 1.1, motion: { type: 'none', intensity: 0 },
    effects: [], colorGrade: 'none', transitionIn: { style: 'none', duration: 0 }, opacity: 1,
  }
}

function makeTextClip(trackId: string, start: number, duration: number, text: Partial<Clip['text']> & { content: string }): Clip {
  return {
    id: uid('clip'), trackId, kind: 'text', name: text.content.slice(0, 24),
    start, duration, inPoint: 0, speed: 1, volume: 0, muted: true,
    fadeIn: 0, fadeOut: 0, motion: { type: 'none', intensity: 0 },
    effects: [], colorGrade: 'none', transitionIn: { style: 'none', duration: 0 }, opacity: 1,
    text: {
      content: text.content,
      size: text.size ?? 9,
      weight: text.weight ?? 800,
      color: text.color ?? '#ffffff',
      accent: text.accent ?? '#a78bfa',
      align: text.align ?? 'center',
      x: text.x ?? 0.5,
      y: text.y ?? 0.5,
      font: text.font ?? 'Inter',
      stroke: text.stroke ?? true,
      bg: text.bg ?? null,
      anim: text.anim ?? 'fade',
      glow: text.glow ?? true,
      rtl: text.rtl,
    },
  }
}

// ---------- Photo → Video builder ----------
export function buildPhotoEdit(
  p: Project,
  assets: MediaAsset[],
  opts: { duration?: number; style?: StyleId; beatSync?: boolean; title?: string }
): ApplyResult {
  const log: string[] = []
  const style = STYLES[opts.style ?? 'cinematic']
  const images = assets.filter((a) => a.type === 'image')
  const videos = assets.filter((a) => a.type === 'video' && a.role !== 'reference')
  const music = assets.find((a) => a.type === 'audio')
  const beatMap = p.beatMap && music && p.beatMap.mediaId === music.id ? p.beatMap : undefined
  const useBeats = (opts.beatSync ?? style.beatSnap) && !!beatMap && beatMap.beats.length > 4 && !!music

  if (!images.length && !videos.length) {
    return { log: [], error: 'No photos or videos found. Upload media first, then ask me to build the edit.' }
  }

  let total = opts.duration ?? (music?.duration ? Math.min(music.duration, 60) : Math.max(6, (images.length + videos.length) * style.cut))
  total = clamp(total, 2, 600)

  // cut boundaries
  const cuts: number[] = [0]
  if (useBeats && beatMap) {
    const beatSec = 60 / beatMap.bpm
    const step = Math.max(1, Math.round(style.cut / beatSec))
    const beats = beatMap.beats.filter((b) => b > 0.12 && b < total - 0.3)
    for (let i = 0; i < beats.length; i += step) {
      const t = beats[i]
      if (t - cuts[cuts.length - 1] >= 0.4) cuts.push(t)
    }
    log.push(`Synced ${cuts.length - 1} cuts to detected beats (${beatMap.bpm} BPM, confidence ${Math.round(beatMap.confidence * 100)}%)${beatMap.approximate ? ' — approximate' : ''}`)
  } else {
    if (opts.beatSync && !beatMap) log.push('Beat sync requested but no analyzed music found — used style-based pacing instead.')
    for (let t = style.cut; t < total - 0.35; t += style.cut) cuts.push(Math.round(t * 100) / 100)
    log.push(`Cut every ${style.cut}s (${style.label} pacing)`)
  }

  // segments
  const segs: { start: number; end: number }[] = []
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i]
    const end = i + 1 < cuts.length ? cuts[i + 1] : total
    if (end - start >= 0.28) segs.push({ start, end: Math.min(end, total) })
  }

  // media pool: images first, videos interleaved; cycle if fewer assets than segments
  const pool = [...images, ...videos]
  // best (highest resolution) asset goes to first drop
  const drop = p.beatMap?.drops?.[0]
  if (drop && segs.some((s) => s.start <= drop && s.end > drop)) {
    const best = [...images].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0]
    if (best && pool[0] !== best) {
      const idx = pool.indexOf(best)
      if (idx > 0) {
        pool.splice(idx, 1)
        pool.unshift(best)
        log.push('Placed the strongest photo on the first beat drop')
      }
    }
  }

  // rebuild video track
  const vt = videoTrack(p)
  vt.clips = []
  segs.forEach((seg, i) => {
    const a = pool[i % pool.length]
    const dur = seg.end - seg.start
    if (a.type === 'image') {
      const c = makeImageClip(vt.id, a, seg.start, dur)
      c.motion = { type: style.motions[i % style.motions.length], intensity: style.zoom }
      c.colorGrade = style.grade
      if (style.shake > 0) c.effects.push({ type: 'shake', intensity: style.shake })
      if (i > 0) c.transitionIn = { ...style.transition }
      vt.clips.push(c)
    } else {
      const c = makeImageClip(vt.id, a, seg.start, dur)
      c.kind = 'video'
      c.muted = true // original video audio muted in generated edits (music drives it)
      c.motion = { type: style.punch && i % 2 === 0 ? 'punch' : style.motions[i % style.motions.length], intensity: style.zoom }
      c.colorGrade = style.grade
      if (style.shake > 0) c.effects.push({ type: 'shake', intensity: style.shake })
      if (i > 0) c.transitionIn = { ...style.transition }
      vt.clips.push(c)
    }
  })
  sortClips(vt)

  // music
  const at = audioTrack(p)
  if (at) {
    at.clips = []
    if (music) {
      const mc = makeAudioClip(at.id, music, 0, total)
      at.clips.push(mc)
    }
  }

  // title
  const tt = textTrack(p)
  tt.clips = tt.clips.filter((c) => c.kind !== 'text' || !c.name.startsWith('__title'))
  if (opts.title) {
    const tc = makeTextClip(tt.id, 0, Math.min(2.8, total * 0.3), {
      content: opts.title, size: 11, weight: 900, anim: 'pop', y: 0.46,
    })
    tc.name = '__title:' + opts.title
    tt.clips.push(tc)
    log.push(`Added title “${opts.title}”`)
  }

  p.duration = total
  log.push(`Built ${segs.length} clips across ${total.toFixed(1)}s in ${style.label} style`)
  return { log }
}

// ---------- Keep best window (highest audio energy) ----------
function keepBestWindow(p: Project, seconds: number, assets: MediaAsset[]): { start: number; end: number } | null {
  const music = assets.find((a) => a.type === 'audio')
  const total = p.duration
  const win = Math.min(seconds, total)
  if (!music?.peaks?.length) {
    const start = Math.max(0, (total - win) / 2)
    return { start, end: start + win }
  }
  const buckets = music.peaks.length
  const perSec = buckets / Math.max(music.duration ?? total, 0.1)
  const w0 = Math.round((total - win) * perSec)
  let bestStart = 0, bestSum = -1
  for (let s = 0; s <= total - win; s += 0.25) {
    const i0 = clamp(Math.round(s * perSec), 0, buckets - 1)
    const i1 = clamp(Math.round((s + win) * perSec), i0 + 1, buckets)
    let sum = 0
    for (let i = i0; i < i1; i++) sum += music.peaks[i]
    if (sum > bestSum) {
      bestSum = sum
      bestStart = s
    }
    void w0
  }
  return { start: bestStart, end: bestStart + win }
}

function trimToWindow(p: Project, start: number, end: number, log: string[]) {
  for (const tr of p.tracks) {
    for (const c of tr.clips) {
      const cEnd = c.start + c.duration
      if (c.kind === 'audio' && c.mediaId) {
        // music keeps playing through the window: shift inPoint
        const newStart = Math.max(c.start, start - 0)
        void newStart
        c.inPoint += Math.max(0, start - c.start) * c.speed
        const newEnd = Math.min(cEnd, end)
        c.start = Math.max(0, start)
        c.duration = Math.max(0.2, newEnd - start)
        continue
      }
      const nStart = Math.max(c.start, start)
      const nEnd = Math.min(cEnd, end)
      if (nEnd - nStart < 0.12) {
        c.duration = 0
        continue
      }
      c.inPoint += (nStart - c.start) * c.speed
      c.duration = nEnd - nStart
      c.start = nStart - start
    }
    tr.clips = tr.clips.filter((c) => c.duration > 0.1)
    sortClips(tr)
  }
  p.duration = end - start
  log.push(`Kept the strongest ${Math.round(end - start)}s window (audio-energy based${start > 0 ? ', window offset ' + start.toFixed(1) + 's' : ''})`)
}

// ---------- Beat re-snap of existing boundaries ----------
function resnapToBeats(p: Project, log: string[]) {
  const bm: BeatMap | undefined = p.beatMap
  if (!bm || bm.beats.length < 4) {
    log.push('No beat map available — upload music and let me analyze it first.')
    return
  }
  const vt = videoTrack(p)
  sortClips(vt)
  let moved = 0
  for (let i = 1; i < vt.clips.length; i++) {
    const b = bm.beats.reduce((best, x) => (Math.abs(x - vt.clips[i].start) < Math.abs(best - vt.clips[i].start) ? x : best), bm.beats[0])
    if (Math.abs(b - vt.clips[i].start) < 0.45 && Math.abs(b - vt.clips[i].start) > 0.016) {
      const delta = b - vt.clips[i].start
      const prev = vt.clips[i - 1]
      prev.duration = Math.max(0.2, prev.duration + delta)
      vt.clips[i].start = b
      vt.clips[i].duration = Math.max(0.2, vt.clips[i].duration - delta)
      moved++
    }
  }
  log.push(`Re-snapped ${moved} cuts to beats (${bm.bpm} BPM)`)
}

// ---------- Apply a full plan ----------
export function applyPlan(p: Project, plan: EditPlan, ctx: ApplyContext): ApplyResult {
  const log: string[] = []
  for (const action of plan.actions) {
    const r = applyAction(p, action, ctx, log)
    if (r) return r
  }
  return { log }
}

function applyAction(p: Project, a: PlanAction, ctx: ApplyContext, log: string[]): ApplyResult | null {
  switch (a.type) {
    case 'buildPhotoEdit': {
      const r = buildPhotoEdit(p, ctx.assets, { duration: a.duration, style: a.style, beatSync: a.beatSync, title: a.title })
      log.push(...r.log)
      return r.error ? { log, error: r.error } : null
    }
    case 'setDuration': {
      const target = clamp(a.seconds, 1, 600)
      const images = ctx.assets.filter((x) => x.type === 'image')
      if (images.length && videoTrack(p).clips.some((c) => c.kind === 'image')) {
        const r = buildPhotoEdit(p, ctx.assets, { duration: target })
        log.push(...r.log)
      } else {
        const scale = target / p.duration
        for (const tr of p.tracks) {
          for (const c of tr.clips) {
            c.duration *= scale
          }
        }
        p.duration = target
        log.push(`Stretched timeline to ${target}s`)
      }
      return null
    }
    case 'setAspect': {
      const dims: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], '21:9': [1920, 822] }
      p.aspect = a.aspect
      ;[p.width, p.height] = dims[a.aspect]
      log.push(`Changed canvas to ${a.aspect} (${p.width}×${p.height}) — export will use it`)
      return null
    }
    case 'setStyle': {
      const st = STYLES[a.style]
      const vt = videoTrack(p)
      let n = 0
      for (const c of vt.clips) {
        if (c.kind === 'text' || c.kind === 'logo') continue
        c.colorGrade = st.grade
        if (c.motion.type !== 'none') c.motion.intensity = st.zoom
        if (st.shake > 0 && !c.effects.some((e) => e.type === 'shake')) c.effects.push({ type: 'shake', intensity: st.shake })
        if (c.transitionIn.style !== 'none') c.transitionIn = { ...st.transition }
        n++
      }
      log.push(`Restyled ${n} clips with ${st.label}: ${st.desc}`)
      return null
    }
    case 'beatSync': {
      if (a.enabled) resnapToBeats(p, log)
      else log.push('Beat sync disabled for future builds.')
      return null
    }
    case 'addZooms': {
      const motions = ['zoomIn', 'zoomOut', 'kenburns', 'panRight', 'panLeft']
      let n = 0
      const vt = videoTrack(p)
      vt.clips.forEach((c, i) => {
        if (c.kind === 'text' || c.kind === 'logo') return
        if (c.motion.type === 'none' || a.intensity > 0) {
          c.motion = { type: motions[i % motions.length] as Clip['motion']['type'], intensity: clamp(a.intensity, 0.1, 1) }
          n++
        }
      })
      log.push(`Added movement (zoom/pan intensity ${Math.round(a.intensity * 100)}%) to ${n} clips`)
      return null
    }
    case 'setColorGrade': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'video') continue
        for (const c of tr.clips) {
          c.colorGrade = a.grade
          n++
        }
      }
      log.push(`Applied ${a.grade} color grade to ${n} clips`)
      return null
    }
    case 'setSpeed': {
      const speed = clamp(a.speed, 0.25, 3)
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind === 'text') continue
        for (const c of tr.clips) {
          const srcDur = c.duration * c.speed
          c.speed = speed
          c.duration = srcDur / speed
          n++
        }
      }
      log.push(`Set playback speed to ${speed}× on ${n} clips`)
      return null
    }
    case 'trimStart': {
      const s = clamp(a.seconds, 0.1, Math.max(0.2, p.duration - 0.5))
      for (const tr of p.tracks) {
        for (const c of tr.clips) {
          const cEnd = c.start + c.duration
          const nStart = Math.max(c.start, s)
          if (cEnd - nStart < 0.12) { c.duration = 0; continue }
          c.inPoint += (nStart - c.start) * c.speed
          c.duration = cEnd - nStart
          c.start = nStart - s
        }
        tr.clips = tr.clips.filter((c) => c.duration > 0.1)
        sortClips(tr)
      }
      p.duration = Math.max(0.5, p.duration - s)
      log.push(`Trimmed the first ${s.toFixed(1)}s`)
      return null
    }
    case 'keepBest': {
      const win = keepBestWindow(p, clamp(a.seconds, 2, 300), ctx.assets)
      if (win) trimToWindow(p, win.start, win.end, log)
      return null
    }
    case 'removeAudio': {
      let n = 0
      const at = audioTrack(p)
      if (at) n = at.clips.length
      for (const tr of p.tracks) for (const c of tr.clips) if (c.kind === 'video') c.muted = true
      if (at) at.clips = []
      log.push(`Removed original audio (${n} music clip(s) cleared, video audio muted)`)
      return null
    }
    case 'setVolume': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'audio') continue
        for (const c of tr.clips) { c.volume = clamp(a.volume, 0, 1.5); n++ }
      }
      log.push(`Set music volume to ${Math.round(a.volume * 100)}%`)
      void n
      return null
    }
    case 'fadeOut': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'audio') continue
        for (const c of tr.clips) { c.fadeOut = clamp(a.seconds, 0.1, 6); n++ }
      }
      log.push(`Audio fades out over ${a.seconds}s at the end`)
      void n
      return null
    }
    case 'addCaptions': {
      const tt = textTrack(p)
      const raw = (a.text ?? '').trim()
      if (!raw) {
        log.push('Captions need text — auto speech transcription is not available offline in this browser. Tell me the exact caption text, e.g. captions "STAR EDIT".')
        return null
      }
      const words = raw.split(/\s+/)
      const chunkCount = Math.min(words.length, Math.max(2, Math.floor(p.duration / 2.6)))
      const per = Math.ceil(words.length / chunkCount)
      tt.clips = tt.clips.filter((c) => c.name.startsWith('__title'))
      let idx = 0
      for (let i = 0; i < words.length; i += per) {
        const chunk = words.slice(i, i + per).join(' ')
        const start = (p.duration / chunkCount) * idx
        const dur = p.duration / chunkCount
        const c = makeTextClip(tt.id, start, dur * 0.92, {
          content: chunk, size: 6.5, weight: 800, y: 0.84, anim: 'pop', stroke: true,
          bg: { opacity: 0.35 }, align: 'center',
        })
        c.text!.rtl = /[\u0600-\u06FF]/.test(chunk)
        tt.clips.push(c)
        idx++
      }
      log.push(`Added ${chunkCount} bold caption cards (word-wrap style, manual text — no fake transcription)`)
      return null
    }
    case 'addTitle': {
      const tt = textTrack(p)
      tt.clips = tt.clips.filter((c) => !c.name.startsWith('__title'))
      const c = makeTextClip(tt.id, 0, Math.min(3, p.duration * 0.35), { content: a.text, size: 11, weight: 900, anim: 'pop', y: 0.46 })
      c.name = '__title:' + a.text
      tt.clips.push(c)
      log.push(`Added cinematic title “${a.text}”`)
      return null
    }
    case 'addLowerThird': {
      const tt = textTrack(p)
      const c = makeTextClip(tt.id, Math.min(0.5, p.duration * 0.1), Math.min(3.5, p.duration), {
        content: a.text, size: 4.6, weight: 700, anim: 'slideUp', x: 0.09, y: 0.86, align: 'left', glow: false,
      })
      c.text!.rtl = /[\u0600-\u06FF]/.test(a.text)
      tt.clips.push(c)
      log.push(`Added lower third “${a.text}”`)
      return null
    }
    case 'addCounter': {
      const tt = textTrack(p)
      const start = clamp(p.duration * 0.6, 0, p.duration - 1.5)
      const c = makeTextClip(tt.id, start, Math.min(3, p.duration - start), {
        content: a.label ?? '', size: 14, weight: 900, anim: 'none', y: 0.5, countTo: a.to,
      })
      tt.clips.push(c)
      log.push(`Added animated counter to ${a.to}`)
      return null
    }
    case 'setTransition': {
      const st: TransitionStyle = a.style
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'video') continue
        tr.clips.forEach((c, i) => {
          if (i === 0) return
          c.transitionIn = { style: st, duration: clamp(a.duration ?? 0.3, 0.08, 1.2) }
          n++
        })
      }
      log.push(`Set ${st} transitions on ${n} clip boundaries`)
      return null
    }
    case 'removeClip': {
      const all: Clip[] = []
      for (const tr of p.tracks) for (const c of tr.clips) all.push(c)
      all.sort((x, y) => x.start - y.start)
      const target = all[clamp(a.index, 0, all.length - 1)]
      if (!target) {
        log.push('That clip does not exist.')
        return null
      }
      for (const tr of p.tracks) tr.clips = tr.clips.filter((c) => c.id !== target.id)
      log.push(`Removed clip #${a.index + 1} (${target.name})`)
      return null
    }
    case 'addMovement': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'video') continue
        for (const c of tr.clips) {
          if (c.motion.type === 'none') c.motion.type = 'kenburns'
          c.motion.intensity = clamp(c.motion.intensity + a.intensity, 0.1, 1)
          n++
        }
      }
      log.push(`Increased movement on ${n} clips (+${Math.round(a.intensity * 100)}%)`)
      return null
    }
    case 'reduceEffects': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'video') continue
        for (const c of tr.clips) {
          c.effects = c.effects.filter((e) => e.type === 'vignette')
          if (c.transitionIn.style !== 'none' && (c.transitionIn.style === 'flash' || c.transitionIn.style === 'whip')) {
            c.transitionIn = { style: 'dissolve', duration: 0.3 }
          }
          c.motion.intensity = Math.max(0.2, c.motion.intensity * 0.6)
          n++
        }
      }
      log.push(`Reduced effects on ${n} clips — cleaner, calmer look`)
      return null
    }
    case 'applyReferencePacing': {
      const ref = ctx.assets.find((x) => x.role === 'reference' && x.analysis)
      if (!ref?.analysis) {
        log.push('No analyzed reference video found. Upload one in Media (marked Reference) and wait for analysis.')
        return null
      }
      const ra = ref.analysis
      const vt = videoTrack(p)
      let t = 0
      for (const c of vt.clips) {
        c.start = t
        c.duration = Math.min(ra.suggestedCut, Math.max(0.2, p.duration - t))
        c.colorGrade = ra.suggestedGrade
        t += ra.suggestedCut
        if (t >= p.duration) break
      }
      vt.clips = vt.clips.filter((c) => c.duration > 0.15)
      log.push(`Applied reference pacing: ~${ra.suggestedCut.toFixed(2)}s average shot (${ra.cuts} cuts measured across ${ra.samples} samples), grade ${ra.suggestedGrade}`)
      return null
    }
    default:
      log.push('Unknown action skipped.')
      return null
  }
}
