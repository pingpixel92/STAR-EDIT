// Edit engine — applies validated EditPlans to the real timeline. Every action truly mutates tracks.
// v1.2: professional builder (drop-aware pacing, asset scoring, smart in-points, motion variety),
//       fitToMusic, autoReframe, speedRamp, addOutro, font-aware text, lyric captions.
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

const FPS = 30
const PUNCHY: StyleId[] = ['hype', 'fast', 'sports', 'gaming', 'beatsync', 'energetic']

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

const q = (t: number) => Math.round(t * FPS) / FPS

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

const isRtlText = (s: string) => /[\u0600-\u06FF]/.test(s)

// ---------- Professional Photo → Video builder ----------
interface BuildOpts { duration?: number; style?: StyleId; beatSync?: boolean; title?: string; fitMusic?: boolean }

export function buildPhotoEdit(p: Project, assets: MediaAsset[], opts: BuildOpts): ApplyResult {
  const log: string[] = []
  const style = STYLES[opts.style ?? 'cinematic']
  const images = assets.filter((a) => a.type === 'image')
  const videos = assets.filter((a) => a.type === 'video' && a.role !== 'reference')
  // prefer the track that actually has the analyzed beat map (matches the Media panel card)
  const music = assets.find((a) => a.type === 'audio' && a.id === p.beatMap?.mediaId) ?? assets.find((a) => a.type === 'audio')
  const beatMap: BeatMap | undefined = p.beatMap && music && p.beatMap.mediaId === music.id ? p.beatMap : undefined
  const useBeats = (opts.beatSync ?? style.beatSnap) && !!beatMap && beatMap.beats.length > 4 && !!music

  if (!images.length && !videos.length) {
    return { log: [], error: 'No photos or videos found. Upload media first, then ask me to build the edit.' }
  }

  // total duration: explicit > full song (true music match) > fallback pacing
  let total = opts.duration ?? (music?.duration ? Math.min(music.duration, 240) : Math.max(6, (images.length + videos.length) * style.cut))
  total = clamp(total, 2, 600)

  // ---- 1) drop-aware cut grid (frame-quantized = clean cuts) ----
  const cuts: number[] = [0]
  if (useBeats && beatMap) {
    const beatSec = 60 / beatMap.bpm
    const baseStep = Math.max(1, Math.round(style.cut / beatSec))
    const halfBeat = PUNCHY.includes(style.id) && beatSec > 0.72 // allow 8th-note cutting on slower tracks
    const beats = beatMap.beats.filter((b) => b > 0.14 && b < total - 0.26)
    const drops = beatMap.drops ?? []
    let sinceLast = 0
    let prev = beats[0] ?? 0
    for (const b of beats) {
      sinceLast += (b - prev) / beatSec
      prev = b
      const nearDrop = drops.some((d) => Math.abs(b - d) < 2 * beatSec)
      const need = nearDrop ? (halfBeat ? 0.5 : 1) : baseStep
      if (sinceLast >= need - 0.02) {
        const t = q(b)
        if (t - cuts[cuts.length - 1] >= 0.3) {
          cuts.push(t)
          sinceLast = 0
        }
      }
    }
    // drop the final cut if it would leave a stub
    if (cuts.length > 1 && total - cuts[cuts.length - 1] < 0.45) cuts.pop()
    log.push(`Beat-locked cut plan: ${cuts.length - 1} cuts on the detected grid (${beatMap.bpm} BPM, confidence ${Math.round(beatMap.confidence * 100)}%)${beatMap.approximate ? ' — approximate' : ''}`)
    if (drops.length) log.push(`Drop emphasis: faster cutting around ${Math.min(drops.length, 6)} detected drop${drops.length > 1 ? 's' : ''}`)
  } else {
    if (opts.beatSync && !beatMap) log.push('Beat sync requested but no analyzed music found — used style-based pacing instead.')
    for (let t = style.cut; t < total - 0.35; t += style.cut) cuts.push(q(t))
    if (cuts.length > 1 && total - cuts[cuts.length - 1] < 0.45) cuts.pop()
    log.push(`Cut every ${style.cut}s (${style.label} pacing)`)
  }

  // ---- 2) segments ----
  const segs: { start: number; end: number }[] = []
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i]
    const end = i + 1 < cuts.length ? cuts[i + 1] : total
    if (end - start >= 0.3) segs.push({ start, end: Math.min(end, total) })
  }

  // ---- 3) asset pool: interleaved, strongest first, no consecutive repeats ----
  const imgScore = (a: MediaAsset) => Math.sqrt((a.width ?? 1) * (a.height ?? 1)) + (a.colors?.length ?? 0) * 40
  const vidScore = (a: MediaAsset) => Math.sqrt((a.width ?? 1) * (a.height ?? 1))
  const imgs = [...images].sort((a, b) => imgScore(b) - imgScore(a))
  const vids = [...videos].sort((a, b) => vidScore(b) - vidScore(a))
  const pool: MediaAsset[] = []
  let ii = 0, vv = 0
  while (ii < imgs.length || vv < vids.length) {
    if (ii < imgs.length) pool.push(imgs[ii++])
    if (vv < vids.length) pool.push(vids[vv++])
  }
  if (!pool.length) return { log: [], error: 'No usable media found.' }

  // strongest asset lands on the first detected drop
  const drop = beatMap?.drops?.[0]
  const dropSeg = drop != null ? segs.findIndex((s) => s.start <= drop && s.end > drop) : -1

  const assign: (MediaAsset | null)[] = segs.map(() => null)
  let ptr = 0
  let lastId = ''
  for (let i = 0; i < segs.length; i++) {
    let cand = pool[ptr % pool.length]
    if (cand.id === lastId && pool.length > 1) {
      ptr++
      cand = pool[ptr % pool.length]
    }
    assign[i] = cand
    lastId = cand.id
    ptr++
  }
  if (dropSeg > 0) {
    const best = pool[0]
    if (assign[dropSeg]?.id !== best.id && assign[dropSeg - 1]?.id !== best.id) {
      const cur = assign[dropSeg]
      assign[dropSeg] = best
      const origIdx = assign.findIndex((x, j) => x?.id === best.id && j !== dropSeg)
      if (origIdx >= 0) assign[origIdx] = cur
      log.push('Placed the strongest media on the first drop')
    }
  }

  // ---- 4) build clips: smart in-points, motion variety, drop emphasis ----
  const vt = videoTrack(p)
  vt.clips = []
  const usedIn = new Map<string, number[]>()
  const pickCount = new Map<string, number>()
  let lastMotion = ''
  let dropCuts = 0

  segs.forEach((seg, i) => {
    const a = assign[i]!
    const dur = seg.end - seg.start
    const isDropCut = drop != null && Math.abs(seg.start - drop) < 0.35
    if (isDropCut) dropCuts++
    const c = makeImageClip(vt.id, a, seg.start, dur)
    if (a.type === 'video') {
      c.kind = 'video'
      c.muted = true // music drives generated edits
      const srcDur = a.duration ?? 3
      const need = dur * 1
      if (srcDur >= need + 0.05) {
        // smart in-point: strongest tracked subject moment, else golden-ratio stagger
        const used = usedIn.get(a.id) ?? []
        let chosen = -1
        if (a.subject && a.subject.length >= 3) {
          const cands = [...a.subject].sort((x, y) => y.v - x.v)
          for (const s of cands) {
            const st = clamp(s.t - need / 2, 0, srcDur - need)
            if (!used.some((u) => Math.abs(u - st) < Math.max(0.5, need * 0.7))) { chosen = st; break }
          }
        }
        if (chosen < 0) {
          const n = pickCount.get(a.id) ?? 0
          chosen = ((n * 0.618) % 1) * Math.max(0, srcDur - need)
          pickCount.set(a.id, n + 1)
        }
        usedIn.set(a.id, [...(usedIn.get(a.id) ?? []), chosen])
        c.inPoint = Math.round(chosen * 100) / 100
      } else if (srcDur > 0.4) {
        // source shorter than the slot: gentle slow-motion fills it honestly
        c.speed = clamp(srcDur / need, 0.5, 1)
        c.inPoint = 0
      }
    }
    // motion: never repeat the previous one; punch on drop cuts
    let m = style.motions[i % style.motions.length]
    if (m === lastMotion) m = style.motions[(i + 1) % style.motions.length]
    if (isDropCut && style.punch) m = 'punch'
    lastMotion = m
    c.motion = { type: m, intensity: clamp(style.zoom + (isDropCut ? 0.15 : 0), 0.1, 1) }
    c.colorGrade = style.grade
    if (style.shake > 0) c.effects.push({ type: 'shake', intensity: style.shake })
    if (style.id === 'cinematic' || style.id === 'luxury' || style.id === 'dark') {
      c.effects.push({ type: 'letterbox', intensity: 0.5 })
    }
    if ((style.id === 'fashion' || style.id === 'emotional') && i % 3 === 1) {
      c.effects.push({ type: 'lightLeak', intensity: 0.35 })
    }
    if (i > 0) {
      const trDur = isDropCut && PUNCHY.includes(style.id) ? 0.12 : Math.min(style.transition.duration, dur * 0.45)
      c.transitionIn = { style: isDropCut && PUNCHY.includes(style.id) ? 'flash' : style.transition.style, duration: Math.max(0.08, trDur) }
    }
    vt.clips.push(c)
  })
  sortClips(vt)
  if (dropCuts) log.push(`Punch-ins + flash cuts on ${dropCuts} drop moment${dropCuts > 1 ? 's' : ''}`)
  const vidCount = vt.clips.filter((c) => c.kind === 'video').length
  if (vidCount) log.push(`Smart in-points on ${vidCount} video segment${vidCount > 1 ? 's' : ''} — the strongest moments, not just frame 0`)

  // ---- 5) music ----
  const at = audioTrack(p)
  if (at) {
    at.clips = []
    if (music) {
      const mc = makeAudioClip(at.id, music, 0, total)
      mc.fadeOut = Math.min(1.6, total * 0.08)
      at.clips.push(mc)
      if (opts.fitMusic || (!opts.duration && music.duration && music.duration <= 240)) {
        log.push(`Matched the timeline to the song: ${total.toFixed(1)}s${opts.duration ? '' : ' (full track)'}`)
      }
    }
  }

  // ---- 6) title ----
  const tt = textTrack(p)
  tt.clips = tt.clips.filter((c) => c.kind !== 'text' || !c.name.startsWith('__title'))
  if (opts.title) {
    const rtl = isRtlText(opts.title)
    const tc = makeTextClip(tt.id, 0, Math.min(2.8, total * 0.3), {
      content: opts.title, size: 11, weight: 900, anim: 'pop', y: 0.46,
      font: rtl ? 'Lalezar' : 'Anton',
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
  }
  return { start: bestStart, end: bestStart + win }
}

function trimToWindow(p: Project, start: number, end: number, log: string[]) {
  for (const tr of p.tracks) {
    for (const c of tr.clips) {
      const cEnd = c.start + c.duration
      if (c.kind === 'audio' && c.mediaId) {
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

// ---------- fitToMusic: make the song and the timeline truly match ----------
function fitToMusic(p: Project, assets: MediaAsset[], log: string[]) {
  const music = assets.find((a) => a.type === 'audio' && a.id === p.beatMap?.mediaId) ?? assets.find((a) => a.type === 'audio')
  if (!music?.duration || music.duration < 2) {
    log.push('No music to match — upload a song first and I will lock the timeline to it.')
    return
  }
  const M = music.duration
  const vt = videoTrack(p)
  sortClips(vt)
  const T = vt.clips.length ? vt.clips[vt.clips.length - 1].start + vt.clips[vt.clips.length - 1].duration : p.duration
  const at = audioTrack(p)
  if (!at) return

  if (M >= T - 0.25) {
    // song is longer → loop / extend the music across the whole timeline
    at.clips = []
    let s = 0, k = 0
    while (s < T - 0.05) {
      const dur = Math.min(M - 0, T - s)
      const c = makeAudioClip(at.id, music, s, dur)
      c.inPoint = 0
      if (k > 0) c.fadeIn = 0.04
      c.fadeOut = k === 0 && dur >= M - 0.1 ? Math.min(1.6, dur * 0.08) : 0.9
      at.clips.push(c)
      s += M
      k++
    }
    log.push(`Music matched to the ${T.toFixed(1)}s timeline${k > 1 ? ` — track looped ×${k}` : ''}`)
  } else {
    // timeline is longer than the song → tighten the edit to the song length
    const scale = M / T
    const bm = p.beatMap && p.beatMap.mediaId === music.id ? p.beatMap : undefined
    const allImages = vt.clips.length > 0 && vt.clips.every((c) => c.kind === 'image')
    if (allImages && bm && bm.beats.length > 4) {
      // rebuild image pacing on the beat grid, preserving asset order
      const order = vt.clips.map((c) => c.mediaId)
      const beatSec = 60 / bm.bpm
      const step = Math.max(1, Math.round((T / Math.max(vt.clips.length, 1)) / beatSec))
      const cuts: number[] = [0]
      for (const b of bm.beats) {
        const t = q(b)
        if (t > cuts[cuts.length - 1] + Math.max(0.3, step * beatSec * 0.85) && t < M - 0.3) cuts.push(t)
      }
      const segs: { start: number; end: number }[] = []
      for (let i = 0; i < cuts.length; i++) {
        const start = cuts[i]
        const end = i + 1 < cuts.length ? cuts[i + 1] : M
        if (end - start >= 0.3) segs.push({ start, end })
      }
      vt.clips = segs.map((seg, i) => {
        const mid = order[i % Math.max(order.length, 1)]!
        const c = makeImageClip(vt.id, assets.find((a) => a.id === mid)!, seg.start, seg.end - seg.start)
        c.motion = { type: 'kenburns', intensity: 0.55 }
        if (i > 0) c.transitionIn = { style: 'dissolve', duration: 0.3 }
        return c
      })
      log.push(`Re-cut ${segs.length} photos onto the beat grid so the edit ends with the song (${M.toFixed(1)}s)`)
    } else {
      let t = 0
      for (const c of vt.clips) {
        const nd = Math.max(0.2, c.duration * scale)
        c.start = t
        c.duration = nd
        t += nd
      }
      vt.clips = vt.clips.filter((c) => c.duration > 0.15)
      log.push(`Tightened the edit to the song: ${T.toFixed(1)}s → ${M.toFixed(1)}s`)
    }
    at.clips = [makeAudioClip(at.id, music, 0, M)]
    at.clips[0].fadeOut = Math.min(1.6, M * 0.08)
  }
  // final safety: text clips beyond the music end are pulled in
  const textT = textTrack(p)
  for (const c of textT.clips) {
    if (c.start >= p.duration) c.start = Math.max(0, p.duration - c.duration - 0.1)
  }
}

// ---------- autoReframe: YouTube 16:9 → TikTok/Reels 9:16 without losing the subject ----------
function autoReframe(p: Project, fill: 'crop' | 'blur', assets: MediaAsset[], log: string[]) {
  const canvasAspect = p.width / p.height
  let n = 0
  for (const tr of p.tracks) {
    if (tr.kind !== 'video') continue
    for (const c of tr.clips) {
      if (c.kind !== 'image' && c.kind !== 'video') continue
      const a = assets.find((x) => x.id === c.mediaId)
      if (!a?.width || !a?.height) continue
      const aa = a.width / a.height
      if (Math.abs(aa - canvasAspect) / canvasAspect < 0.1) continue // already fits the canvas
      c.fill = fill
      n++
    }
  }
  log.push(
    n
      ? `Smart reframe on ${n} clip${n > 1 ? 's' : ''} for ${p.aspect} — ${fill === 'blur' ? 'blurred pad keeps the whole frame visible (CapCut style)' : 'focal crop follows the tracked subject, nothing important gets cut off'}`
      : `All clips already match the ${p.aspect} canvas — nothing to reframe.`
  )
}

// ---------- speedRamp: slow → normal → fast inside each video clip ----------
function speedRamp(p: Project, slow: number, fast: number, assets: MediaAsset[], log: string[]) {
  const vt = videoTrack(p)
  const targets = vt.clips.filter((c) => c.kind === 'video' && c.duration >= 1.3)
  if (!targets.length) {
    log.push('Speed ramp needs video clips (≥1.3s). Photos use Ken Burns motion instead.')
    return
  }
  let made = 0
  for (const c of targets) {
    const media = assets.find((x) => x.id === c.mediaId)
    const srcAvail = Math.max(c.duration * c.speed, (media?.duration ?? 0) - c.inPoint) // real source head-room
    const d1 = Math.min(0.8, c.duration * 0.3)
    const d2 = Math.min(0.5, c.duration * 0.22)
    const d3 = c.duration - d1 - d2
    if (d3 < 0.25) continue
    const src1 = d1 * slow, src2 = d2, src3 = d3 * fast
    if (src1 + src2 + src3 > srcAvail + 0.02) continue // not enough source head-room — skip honestly
    const base = { ...c, effects: [...c.effects], motion: { ...c.motion } }
    const p1: Clip = { ...base, id: uid('clip'), start: c.start, duration: d1, speed: slow, transitionIn: c.transitionIn }
    const p2: Clip = { ...base, id: uid('clip'), start: c.start + d1, duration: d2, speed: 1, inPoint: c.inPoint + src1, transitionIn: { style: 'none', duration: 0 } }
    const p3: Clip = { ...base, id: uid('clip'), start: c.start + d1 + d2, duration: d3, speed: fast, inPoint: c.inPoint + src1 + src2, transitionIn: { style: 'none', duration: 0 } }
    vt.clips = vt.clips.flatMap((x) => (x.id === c.id ? [p1, p2, p3] : [x]))
    made++
  }
  sortClips(vt)
  log.push(made ? `Speed ramp on ${made} clip${made > 1 ? 's' : ''}: ${slow}× → 1× → ${fast}× (source-continuous, no jumps)` : 'No clips had enough source head-room for a ramp.')
}

// ---------- addOutro: branded end card ----------
function addOutro(p: Project, text: string | undefined, log: string[]) {
  const vt = videoTrack(p)
  const start = p.duration
  const c: Clip = {
    id: uid('clip'), trackId: vt.id, kind: 'logo', name: 'outro',
    start, duration: 2.4, inPoint: 0, speed: 1, volume: 0, muted: true,
    fadeIn: 0, fadeOut: 0, motion: { type: 'none', intensity: 0 },
    effects: [], colorGrade: 'none', transitionIn: { style: 'blurIn', duration: 0.5 }, opacity: 1,
    text: { content: text ?? p.name, size: 4, weight: 800, color: '#ffffff', align: 'center', x: 0.5, y: 0.62, font: 'Inter', stroke: false, bg: null, anim: 'fade', glow: false, rtl: text ? isRtlText(text) : false },
  }
  vt.clips.push(c)
  // fade music under the outro
  for (const tr of p.tracks) {
    if (tr.kind !== 'audio') continue
    for (const a of tr.clips) if (a.start + a.duration >= start - 0.1) a.fadeOut = Math.min(2.2, a.fadeOut + 1.4)
  }
  log.push(`Added an outro end card (“${text ?? p.name}”) with music fade-out`)
}

// ---------- lyric caption cards from real transcription ----------
export function applyLyricCaptions(p: Project, lines: { text: string; start: number; end: number }[], style: string, font?: string): string[] {
  const log: string[] = []
  const tt = textTrack(p)
  tt.clips = tt.clips.filter((c) => !c.name.startsWith('__lyr'))
  const limit = Math.max(1, p.duration) // captions may never extend the timeline
  let n = 0
  let dropped = 0
  for (const ln of lines) {
    const start = clamp(ln.start, 0, limit)
    const end = clamp(ln.end, 0, limit)
    if (end - start < 0.4) { dropped++; continue } // fully outside the edit (hallucinated tail etc.)
    const rtl = isRtlText(ln.text)
    const c = makeTextClip(tt.id, start, end - start, {
      content: ln.text,
      size: style === 'karaoke' ? 6.8 : 6,
      weight: 900,
      y: style === 'karaoke' ? 0.78 : 0.84,
      anim: style === 'karaoke' ? 'karaoke' : 'pop',
      font: font ?? (rtl ? 'Vazirmatn' : 'Poppins'),
      bg: style === 'neon' ? null : { opacity: 0.32 },
      glow: style !== 'bold',
      stroke: true,
      color: '#ffffff',
      accent: '#c4b5fd',
    })
    c.text!.rtl = rtl
    c.name = `__lyr:${n}`
    tt.clips.push(c)
    n++
  }
  log.push(`Added ${n} lyric caption cards from real audio transcription (synced to the song)${dropped ? ` — ${dropped} line${dropped > 1 ? 's' : ''} outside the edit dropped` : ''}`)
  return log
}

// ---------- Apply a full plan ----------
export function applyPlan(p: Project, plan: EditPlan, ctx: ApplyContext): ApplyResult {
  const log: string[] = []
  for (const action of plan.actions) {
    if (action.type === 'autoLyrics') continue // handled asynchronously by runCommand
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
      const prevAspect = p.aspect
      p.aspect = a.aspect
      ;[p.width, p.height] = dims[a.aspect]
      log.push(`Changed canvas to ${a.aspect} (${p.width}×${p.height}) — export will use it`)
      // smart reframe kicks in automatically when media is wider/taller than the new canvas
      if (prevAspect !== a.aspect) autoReframe(p, 'crop', ctx.assets, log)
      return null
    }
    case 'fitToMusic': {
      fitToMusic(p, ctx.assets, log)
      return null
    }
    case 'autoReframe': {
      autoReframe(p, a.fill ?? 'crop', ctx.assets, log)
      return null
    }
    case 'speedRamp': {
      const slow = clamp(a.slow ?? 0.5, 0.3, 0.9)
      const fast = clamp(a.fast ?? 1.5, 1.1, 2.5)
      speedRamp(p, slow, fast, ctx.assets, log)
      return null
    }
    case 'addOutro': {
      addOutro(p, a.text, log)
      return null
    }
    case 'addEffect': {
      const intensity = clamp(a.intensity ?? 0.5, 0.05, 1)
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'video') continue
        for (const c of tr.clips) {
          if (c.kind === 'text' || c.kind === 'logo') continue
          if (!c.effects.some((e) => e.type === a.effect)) c.effects.push({ type: a.effect, intensity })
          n++
        }
      }
      log.push(`Applied ${a.effect} (${Math.round(intensity * 100)}%) to ${n} clips`)
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
      return null
    }
    case 'fadeOut': {
      let n = 0
      for (const tr of p.tracks) {
        if (tr.kind !== 'audio') continue
        for (const c of tr.clips) { c.fadeOut = clamp(a.seconds, 0.1, 6); n++ }
      }
      log.push(`Audio fades out over ${a.seconds}s at the end`)
      return null
    }
    case 'addCaptions': {
      const tt = textTrack(p)
      const raw = (a.text ?? '').trim()
      if (!raw) {
        log.push('Captions need text — or say “convert the song to text / lyrics” and I will transcribe the vocals into synced captions.')
        return null
      }
      const karaoke = a.style === 'karaoke'
      const neon = a.style === 'neon'
      const rtl = isRtlText(raw)
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
          content: chunk, size: 6.5, weight: 900, y: 0.84,
          anim: karaoke ? 'karaoke' : 'pop',
          glow: neon || karaoke,
          bg: neon ? null : { opacity: 0.35 },
          align: 'center',
          font: a.font ?? (rtl ? 'Vazirmatn' : 'Poppins'),
        })
        c.text!.rtl = rtl
        tt.clips.push(c)
        idx++
      }
      log.push(`Added ${chunkCount} caption cards${karaoke ? ' (karaoke word-by-word)' : neon ? ' (neon glow)' : ' (bold pill style)'}`)
      return null
    }
    case 'addTitle': {
      const tt = textTrack(p)
      tt.clips = tt.clips.filter((c) => !c.name.startsWith('__title'))
      const rtl = isRtlText(a.text)
      const c = makeTextClip(tt.id, 0, Math.min(3, p.duration * 0.35), {
        content: a.text, size: 11, weight: 900, anim: 'pop', y: 0.46,
        font: a.font ?? (rtl ? 'Lalezar' : 'Anton'),
      })
      c.name = '__title:' + a.text
      tt.clips.push(c)
      log.push(`Added cinematic title “${a.text}”`)
      return null
    }
    case 'addLowerThird': {
      const tt = textTrack(p)
      const rtl = isRtlText(a.text)
      const c = makeTextClip(tt.id, Math.min(0.5, p.duration * 0.1), Math.min(3.5, p.duration), {
        content: a.text, size: 4.6, weight: 700, anim: 'slideUp', x: rtl ? 0.91 : 0.09, y: 0.86, align: rtl ? 'right' : 'left', glow: false,
        font: a.font ?? (rtl ? 'Vazirmatn' : 'Inter'),
      })
      c.text!.rtl = rtl
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
          c.effects = c.effects.filter((e) => e.type === 'vignette' || e.type === 'letterbox')
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
