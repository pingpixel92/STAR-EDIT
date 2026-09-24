// Local media analysis — thumbnails, dimensions, waveforms, dominant colors, reference-video pacing
import type { GradeId, MediaAsset, ReferenceAnalysis } from '../lib/types'

export const ACCEPTED = '.mp4,.mov,.webm,.png,.jpg,.jpeg,.gif,.mp3,.wav,.m4a,.ogg,.aac,.flac'
export const ACCEPT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'image/png', 'image/jpeg', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/flac']

export function typeOf(file: File): 'image' | 'video' | 'audio' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext)) return 'audio'
  return null
}

function canvas2d(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d', { willReadFrequently: true })! }
}

function thumbDataUrl(source: CanvasImageSource, sw: number, sh: number, maxH = 360): string | undefined {
  if (!sw || !sh) return undefined
  const scale = Math.min(1, maxH / sh)
  const w = Math.max(2, Math.round(sw * scale))
  const h = Math.max(2, Math.round(sh * scale))
  const { c, ctx } = canvas2d(w, h)
  ctx.drawImage(source, 0, 0, w, h)
  try {
    return c.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  }
}

export function dominantColors(source: CanvasImageSource, sw: number, sh: number): string[] {
  try {
    const { ctx } = canvas2d(24, 24)
    ctx.drawImage(source, 0, 0, 24, 24)
    const d = ctx.getImageData(0, 0, 24, 24).data
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>()
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      e.n++; e.r += r; e.g += g; e.b += b
      buckets.set(key, e)
    }
    return [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map((e) => `#${[e.r, e.g, e.b].map((v) => Math.round(v / e.n).toString(16).padStart(2, '0')).join('')}`)
  } catch {
    return []
  }
}

export async function analyzeImage(file: Blob): Promise<Partial<MediaAsset>> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const thumb = thumbDataUrl(img, img.naturalWidth, img.naturalHeight)
    const colors = dominantColors(img, img.naturalWidth, img.naturalHeight)
    return { width: img.naturalWidth, height: img.naturalHeight, thumb, colors, analyzed: true } as Partial<MediaAsset>
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function analyzeVideo(file: Blob): Promise<Partial<MediaAsset>> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.muted = true
  v.src = url
  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => rej(new Error('Cannot decode video'))
      setTimeout(() => rej(new Error('Video metadata timeout')), 15000)
    })
    const duration = isFinite(v.duration) ? v.duration : 0
    // seek to 1s (or 10%) for thumbnail
    await new Promise<void>((res) => {
      const target = Math.min(Math.max(0.4, duration * 0.1), Math.max(0, duration - 0.1))
      v.onseeked = () => res()
      v.currentTime = target
      setTimeout(res, 4000)
    })
    const thumb = thumbDataUrl(v, v.videoWidth, v.videoHeight)
    const colors = dominantColors(v, v.videoWidth, v.videoHeight)
    return { width: v.videoWidth, height: v.videoHeight, duration, thumb, colors } as Partial<MediaAsset>
  } finally {
    v.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

export async function decodeAudioBlob(file: Blob): Promise<AudioBuffer | null> {
  try {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    const buf = await ac.decodeAudioData(await file.arrayBuffer())
    void ac.close()
    return buf
  } catch {
    return null
  }
}

export function peaksFromBuffer(buf: AudioBuffer, buckets = 480): number[] {
  const ch = buf.getChannelData(0)
  const size = Math.max(1, Math.floor(ch.length / buckets))
  const peaks: number[] = []
  let max = 0.0001
  for (let i = 0; i < buckets; i++) {
    let peak = 0
    const start = i * size
    for (let j = 0; j < size && start + j < ch.length; j += 4) {
      const v = Math.abs(ch[start + j])
      if (v > peak) peak = v
    }
    peaks.push(peak)
    if (peak > max) max = peak
  }
  return peaks.map((p) => p / max)
}

export async function analyzeAudio(file: Blob): Promise<Partial<MediaAsset>> {
  const buf = await decodeAudioBlob(file)
  if (!buf) return { duration: 0, peaks: [] }
  return { duration: buf.duration, peaks: peaksFromBuffer(buf) }
}

// ---------- Reference video pacing analysis (approximate, local) ----------
export async function analyzeReference(file: Blob, duration: number): Promise<ReferenceAnalysis | null> {
  try {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    v.src = url
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => rej(new Error('bad video'))
      setTimeout(() => rej(new Error('timeout')), 15000)
    })
    const N = 20
    const samples: { gray: Float32Array; sat: number; bright: number }[] = []
    const S = 48
    for (let i = 0; i < N; i++) {
      const t = (duration * i) / N
      await new Promise<void>((res) => {
        const fn = () => {
          v.onseeked = null
          res()
        }
        v.onseeked = fn
        v.currentTime = Math.min(Math.max(0.05, t), Math.max(0.05, duration - 0.05))
        setTimeout(res, 3000)
      })
      const { ctx } = canvas2d(S, S)
      ctx.drawImage(v, 0, 0, S, S)
      const d = ctx.getImageData(0, 0, S, S).data
      const gray = new Float32Array(S * S)
      let sat = 0, bright = 0
      for (let p = 0; p < S * S; p++) {
        const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]
        gray[p] = 0.299 * r + 0.587 * g + 0.114 * b
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        sat += mx === 0 ? 0 : (mx - mn) / mx
        bright += (r + g + b) / 3
      }
      sat /= S * S
      bright /= S * S
      samples.push({ gray, sat, bright })
    }
    URL.revokeObjectURL(url)
    // scene cuts: mean abs diff between consecutive samples
    let cuts = 0
    const diffs: number[] = []
    for (let i = 1; i < samples.length; i++) {
      let diff = 0
      for (let p = 0; p < S * S; p++) diff += Math.abs(samples[i].gray[p] - samples[i - 1].gray[p])
      diff /= S * S * 255
      diffs.push(diff)
    }
    const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const thr = Math.max(0.06, meanDiff * 1.9)
    for (const d of diffs) if (d > thr) cuts++
    const avgShotDuration = duration / Math.max(cuts, 1)
    const brightness = samples.reduce((a, s) => a + s.bright, 0) / samples.length / 255
    const saturation = samples.reduce((a, s) => a + s.sat, 0) / samples.length
    let suggestedGrade: GradeId = 'none'
    if (saturation < 0.12) suggestedGrade = 'bw'
    else if (brightness < 0.32) suggestedGrade = 'dark'
    else if (saturation > 0.42 && brightness > 0.5) suggestedGrade = 'vibrant'
    else if (brightness < 0.45) suggestedGrade = 'cinematic'
    return {
      avgShotDuration: Math.max(0.4, Math.min(avgShotDuration, 8)),
      cuts,
      samples: N,
      aspect: v.videoWidth && v.videoHeight ? `${v.videoWidth}:${v.videoHeight}` : '?',
      brightness,
      saturation,
      suggestedGrade,
      suggestedCut: Math.max(0.4, Math.min(avgShotDuration, 8)),
    }
  } catch {
    return null
  }
}
