// Playback controller — canvas preview + Web Audio scheduling + video element sync
import type { Project } from '../lib/types'
import { clamp } from '../lib/utils'
import { renderFrame, type AssetView, type RenderEnv } from './renderer'

export function activeClipsAt(project: Project, t: number) {
  const out: { clipIndex: number; trackKind: string }[] = []
  project.tracks.forEach((tr) => {
    tr.clips.forEach((c, i) => {
      if (t >= c.start && t < c.start + c.duration) out.push({ clipIndex: i, trackKind: tr.kind })
    })
  })
  return out
}

/** Keep HTMLVideoElements in sync with the playhead (shared by preview & export). */
export function syncVideoEls(
  project: Project,
  pool: Map<string, HTMLVideoElement>,
  t: number,
  playing: boolean
) {
  for (const tr of project.tracks) {
    if (tr.kind !== 'video' || tr.hidden) continue
    for (const clip of tr.clips) {
      if (!clip.mediaId || (clip.kind !== 'video')) continue
      let el = pool.get(clip.mediaId)
      if (!el) {
        el = document.createElement('video')
        el.muted = true
        el.playsInline = true
        el.preload = 'auto'
        el.crossOrigin = 'anonymous'
        pool.set(clip.mediaId, el)
      }
      const active = playing && t >= clip.start && t < clip.start + clip.duration
      if (!active) {
        if (!el.paused) el.pause()
        continue
      }
      const srcTime = clip.inPoint + (t - clip.start) * clip.speed
      el.playbackRate = clamp(clip.speed, 0.0625, 16)
      if (el.paused) {
        try {
          if (Math.abs(el.currentTime - srcTime) > 0.12) el.currentTime = Math.max(0, srcTime)
          void el.play()
        } catch { /* noop */ }
      } else if (Math.abs(el.currentTime - srcTime) > 0.28) {
        el.currentTime = Math.max(0, srcTime)
      }
    }
  }
}

/** Schedule every audible clip (music + unmuted video audio) from `fromT` onward. */
export function scheduleAudio(
  ac: AudioContext,
  dest: AudioNode,
  project: Project,
  buffers: Map<string, AudioBuffer>,
  fromT: number,
  sourcesOut: AudioBufferSourceNode[],
  delay = 0.08
) {
  const now = ac.currentTime + delay
  for (const tr of project.tracks) {
    if (tr.kind === 'text' || tr.muted) continue
    for (const clip of tr.clips) {
      if (clip.muted || clip.volume <= 0) continue
      if (clip.kind !== 'audio' && clip.kind !== 'video') continue
      const buf = clip.mediaId ? buffers.get(clip.mediaId) : undefined
      if (!buf) continue
      const tEnd = clip.start + clip.duration
      if (tEnd <= fromT + 0.005) continue
      const audibleFrom = Math.max(clip.start, fromT)
      const when = now + Math.max(0, clip.start - fromT)
      const offset = clip.inPoint + Math.max(0, fromT - clip.start) * clip.speed
      const playDur = (tEnd - audibleFrom) * clip.speed
      if (playDur <= 0.01 || offset >= buf.duration) continue
      try {
        const src = ac.createBufferSource()
        src.buffer = buf
        src.playbackRate.value = clamp(clip.speed, 0.0625, 16)
        const g = ac.createGain()
        const vol = clamp(clip.volume, 0, 2)
        const envEnd = when + playDur
        g.gain.setValueAtTime(0.0001, when)
        if (clip.fadeIn > 0.01) {
          g.gain.setValueAtTime(0.0001, when)
          g.gain.linearRampToValueAtTime(vol, when + Math.min(clip.fadeIn, playDur))
        } else {
          g.gain.setValueAtTime(vol, when)
        }
        if (clip.fadeOut > 0.01) {
          const foStart = Math.max(when, envEnd - Math.min(clip.fadeOut, playDur))
          g.gain.setValueAtTime(vol, foStart)
          g.gain.linearRampToValueAtTime(0.0001, envEnd)
        }
        src.connect(g)
        g.connect(dest)
        src.start(when, clamp(offset, 0, Math.max(0, buf.duration - 0.01)), playDur)
        sourcesOut.push(src)
      } catch { /* scheduling race — skip clip */ }
    }
  }
}

export function stopSources(sources: AudioBufferSourceNode[]) {
  for (const s of sources) {
    try { s.stop() } catch { /* already stopped */ }
  }
  sources.length = 0
}

export class PlaybackController {
  project: Project | null = null
  env: RenderEnv = { assets: new Map() }
  time = 0
  playing = false
  audioCtx: AudioContext | null = null
  buffers = new Map<string, AudioBuffer>()
  videoPool = new Map<string, HTMLVideoElement>()
  onTime?: (t: number) => void
  onEnd?: () => void
  private canvas: HTMLCanvasElement | null = null
  private c2d: CanvasRenderingContext2D | null = null
  private raf = 0
  private t0 = 0
  private sources: AudioBufferSourceNode[] = []
  private maxDim = 720

  setCanvas(c: HTMLCanvasElement | null) {
    this.canvas = c
    this.c2d = c?.getContext('2d', { alpha: false }) ?? null
  }
  setProject(p: Project | null) {
    this.project = p
  }
  setMaxDim(d: number) {
    this.maxDim = d
  }

  async attachAsset(av: AssetView) {
    this.env.assets.set(av.meta.id, av)
    if ((av.meta.type === 'audio' || av.meta.type === 'video') && !this.buffers.has(av.meta.id)) {
      if (!this.audioCtx) {
        const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.audioCtx = new AC()
      }
      try {
        const ab = await (await fetch(av.url)).arrayBuffer()
        const buf = await this.audioCtx.decodeAudioData(ab)
        this.buffers.set(av.meta.id, buf)
      } catch {
        // honest degradation: no decoded audio for this asset
      }
    }
  }

  play() {
    if (!this.project || this.playing) return
    if (this.time >= this.project.duration - 0.02) this.time = 0
    void this.audioCtx?.resume()
    this.playing = true
    this.t0 = performance.now() / 1000 - this.time
    if (this.audioCtx) scheduleAudio(this.audioCtx, this.audioCtx.destination, this.project, this.buffers, this.time, this.sources)
    this.raf = requestAnimationFrame(this.loop)
  }

  pause() {
    this.playing = false
    cancelAnimationFrame(this.raf)
    stopSources(this.sources)
    for (const el of this.videoPool.values()) el.pause()
  }

  seek(t: number) {
    const was = this.playing
    if (was) this.pause()
    this.time = clamp(t, 0, this.project?.duration ?? 0)
    syncVideoEls(this.project!, this.videoPool, this.time, false)
    this.draw()
    this.onTime?.(this.time)
    if (was) this.play()
  }

  private loop = () => {
    if (!this.playing || !this.project) return
    const t = performance.now() / 1000 - this.t0
    if (t >= this.project.duration) {
      this.time = this.project.duration
      this.draw()
      this.onTime?.(this.time)
      this.pause()
      this.onEnd?.()
      return
    }
    this.time = t
    syncVideoEls(this.project, this.videoPool, t, true)
    this.draw()
    this.onTime?.(t)
    this.raf = requestAnimationFrame(this.loop)
  }

  draw() {
    if (!this.canvas || !this.c2d || !this.project) return
    const a = this.project.width / this.project.height
    let w: number, h: number
    if (a >= 1) {
      w = this.maxDim
      h = Math.round(w / a)
    } else {
      h = this.maxDim
      w = Math.round(h * a)
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    renderFrame(this.c2d, w, h, this.project, this.time, this.env)
  }
}
