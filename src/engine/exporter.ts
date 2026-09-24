// Real export — MediaRecorder captures an actually-rendered canvas + Web Audio graph
import type { Project } from '../lib/types'
import { clamp } from '../lib/utils'
import { renderFrame, type RenderEnv } from './renderer'
import { scheduleAudio, stopSources, syncVideoEls } from './playback'

export interface ExportOptions {
  width: number
  height: number
  fps: 24 | 30 | 60
  quality: 'draft' | 'standard' | 'high'
  mimeType: string
}

export interface RecorderFormat {
  mime: string
  label: string
}

export function supportedFormats(): RecorderFormat[] {
  if (typeof MediaRecorder === 'undefined') return []
  const candidates: RecorderFormat[] = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', label: 'MP4' },
    { mime: 'video/mp4', label: 'MP4 (alt)' },
    { mime: 'video/webm;codecs=vp9,opus', label: 'WebM (VP9)' },
    { mime: 'video/webm;codecs=vp8,opus', label: 'WebM (VP8)' },
    { mime: 'video/webm', label: 'WebM' },
  ]
  return candidates.filter((c) => {
    try {
      return MediaRecorder.isTypeSupported(c.mime)
    } catch {
      return false
    }
  })
}

const BITRATE: Record<ExportOptions['quality'], number> = {
  draft: 2_800_000,
  standard: 7_000_000,
  high: 14_000_000,
}

export interface ExportEvents {
  onStage: (stage: 'preparing' | 'rendering' | 'encoding' | 'done', pct: number) => void
}

export interface CancelToken {
  cancelled: boolean
}

export async function exportVideo(
  project: Project,
  env: RenderEnv,
  buffers: Map<string, AudioBuffer>,
  opts: ExportOptions,
  ev: ExportEvents,
  token?: CancelToken
): Promise<{ blob: Blob; mimeType: string; elapsed: number }> {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not supported in this browser')
  ev.onStage('preparing', 0)
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const c2d = canvas.getContext('2d', { alpha: false })
  if (!c2d) throw new Error('Canvas 2D unavailable')
  const stream = canvas.captureStream(opts.fps)

  // audio graph
  let ac: AudioContext | null = null
  const hasAudio = project.tracks.some(
    (tr) => tr.kind !== 'text' && !tr.muted && tr.clips.some((c) => !c.muted && c.volume > 0 && (c.kind === 'audio' || c.kind === 'video'))
  )
  const sources: AudioBufferSourceNode[] = []
  if (hasAudio) {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ac = new AC()
    await ac.resume().catch(() => {})
    const dest = ac.createMediaStreamDestination()
    scheduleAudio(ac, dest, project, buffers, 0, sources, 0.18)
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t)
  }

  const bitrate = Math.round(BITRATE[opts.quality] * clamp((opts.width * opts.height) / (1920 * 1080), 0.25, 2.2))
  const rec = new MediaRecorder(stream, {
    mimeType: opts.mimeType,
    videoBitsPerSecond: bitrate,
    audioBitsPerSecond: 192_000,
  })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data)
  }
  const stopped = new Promise<void>((res) => {
    rec.onstop = () => res()
  })

  const videos = new Map<string, HTMLVideoElement>()
  const D = 0.2 // start delay so audio schedule aligns with first frame
  const startAt = performance.now() / 1000 + D
  rec.start(400)
  ev.onStage('rendering', 0)
  const drawStart = startAt
  await new Promise<void>((resolve) => {
    const step = () => {
      const now = performance.now() / 1000
      if (token?.cancelled) {
        resolve()
        return
      }
      const t = now - drawStart
      const tt = clamp(t, 0, project.duration)
      syncVideoEls(project, videos, tt, t >= 0 && t < project.duration)
      renderFrame(c2d, opts.width, opts.height, project, tt, env)
      ev.onStage('rendering', clamp(tt / project.duration, 0, 1))
      if (t >= project.duration) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  ev.onStage('encoding', 1)
  await new Promise((r) => setTimeout(r, 250))
  rec.stop()
  await stopped
  stopSources(sources)
  for (const el of videos.values()) el.pause()
  void ac?.close()
  if (token?.cancelled) throw new Error('cancelled')
  ev.onStage('done', 1)
  const blob = new Blob(chunks, { type: opts.mimeType.split(';')[0] })
  if (!blob.size) throw new Error('Encoder produced an empty file')
  return { blob, mimeType: opts.mimeType, elapsed: 0 }
}
