// Real in-browser vocal transcription — Whisper via transformers.js (lazy CDN import, cached by the browser).
// Honest by design: if the model can't load or no vocals are found, we say so — never fake lyrics.
export interface LyricLine {
  text: string
  start: number
  end: number
}

export interface LyricsProgress {
  stage: 'loading' | 'transcribing'
  pct: number // 0..1 (best-effort)
  note?: string
}

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'

type ProgressCb = (p: LyricsProgress) => void

interface AsrPipelineLike {
  (audio: Float32Array, opts: Record<string, unknown>): Promise<{
    text: string
    chunks?: { text: string; timestamp: [number, number | null] }[]
  }>
}

let asrPromise: Promise<AsrPipelineLike> | null = null

async function loadASR(quality: 'fast' | 'best', onProgress: ProgressCb): Promise<AsrPipelineLike> {
  if (!asrPromise) {
    asrPromise = (async () => {
      const mod: Record<string, unknown> = await import(/* @vite-ignore */ TRANSFORMERS_URL)
      // force model downloads from the HF hub — local-model probing would hit our SPA
      // fallback and "succeed" with HTML, breaking the pipeline
      const env = mod.env as { allowLocalModels?: boolean; remoteHost?: string; useBrowserCache?: boolean } | undefined
      if (env) {
        env.allowLocalModels = false
        env.remoteHost = 'https://huggingface.co/'
        env.useBrowserCache = true
      }
      const pipeline = mod.pipeline as (
        task: string,
        model: string,
        opts: Record<string, unknown>
      ) => Promise<AsrPipelineLike>
      const model = quality === 'best' ? 'Xenova/whisper-base' : 'Xenova/whisper-tiny'
      // aggregate download progress across model files
      const totals = new Map<string, { loaded: number; total: number }>()
      return pipeline('automatic-speech-recognition', model, {
        quantized: true,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress' && p.file && p.total) {
            totals.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
            let loaded = 0, total = 0
            for (const v of totals.values()) { loaded += v.loaded; total += v.total }
            onProgress({ stage: 'loading', pct: total ? loaded / total : 0 })
          }
        },
      })
    })().catch((e) => {
      asrPromise = null // allow retry on next attempt
      throw e
    })
  }
  return asrPromise
}

/** Decode → mono → 16 kHz → vocal-band shaped audio for Whisper. */
async function prepareAudio(blob: Blob): Promise<Float32Array> {
  const AC: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ac = new AC()
  let buf: AudioBuffer
  try {
    buf = await ac.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void ac.close()
  }
  const mono = new Float32Array(buf.length)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < buf.length; i++) mono[i] += d[i] / buf.numberOfChannels
  }
  // resample to 16 kHz + vocal emphasis (high-pass, presence lift, gentle compression)
  const SRC_RATE = buf.sampleRate
  const srcBuf = ac.createBuffer(1, buf.length, SRC_RATE)
  srcBuf.copyToChannel(mono, 0)
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000)
  const src = off.createBufferSource()
  src.buffer = srcBuf
  const hp = off.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 85
  const presence = off.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2400
  presence.Q.value = 0.9
  presence.gain.value = 4
  const lp = off.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 7200
  const comp = off.createDynamicsCompressor()
  comp.threshold.value = -26
  comp.ratio.value = 4
  comp.attack.value = 0.005
  comp.release.value = 0.2
  src.connect(hp)
  hp.connect(presence)
  presence.connect(lp)
  lp.connect(comp)
  comp.connect(off.destination)
  src.start(0)
  const rendered = await off.startRendering()
  const out = rendered.getChannelData(0)
  // normalize peak → 0.92 (quiet vocal tracks are the #1 whisper failure)
  let peak = 0.0001
  for (let i = 0; i < out.length; i++) { const v = Math.abs(out[i]); if (v > peak) peak = v }
  const g = 0.92 / peak
  if (g < 4 || g > 0.05) for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * g))
  return out
}

function rmsAt(audio: Float32Array, start: number, end: number): number {
  const i0 = Math.max(0, Math.floor(start * 16000))
  const i1 = Math.min(audio.length, Math.ceil(end * 16000))
  let sum = 0
  const n = Math.max(1, i1 - i0)
  for (let i = i0; i < i1; i += 2) sum += audio[i] * audio[i]
  return Math.sqrt(sum / (n / 2))
}

const HALLUCINATIONS = /^(thank you\.?|thanks for watching!?|subscribe!?|\[music\]|\(music\)|music\.?|\[applause\]|\[inaudible\]|…+|\.\.+)$/i

function cleanText(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

function hasLetters(t: string): boolean {
  return /[\p{L}\p{N}]/u.test(t)
}

function splitLong(line: LyricLine, maxWords = 7): LyricLine[] {
  const words = line.text.split(' ')
  if (words.length <= maxWords || line.end - line.start < 1.2) return [line]
  const parts = Math.ceil(words.length / maxWords)
  const dur = (line.end - line.start) / parts
  const out: LyricLine[] = []
  for (let i = 0; i < parts; i++) {
    out.push({ text: words.slice(i * maxWords, (i + 1) * maxWords).join(' '), start: line.start + dur * i, end: line.start + dur * (i + 1) })
  }
  return out
}

export async function transcribeLyrics(
  blob: Blob,
  opts: { quality?: 'fast' | 'best'; language?: string },
  onProgress: ProgressCb
): Promise<LyricLine[]> {
  onProgress({ stage: 'loading', pct: 0, note: 'first run downloads the model, then it is cached' })
  const asr = await loadASR(opts.quality ?? 'fast', onProgress)
  onProgress({ stage: 'transcribing', pct: 0.05 })
  const audio = await prepareAudio(blob)
  if (audio.length < 16000 * 2) throw new Error('Audio is too short to transcribe')

  // language: full names required by Whisper tokenizer; omit = auto-detect
  const langMap: Record<string, string> = { en: 'english', fa: 'persian', ru: 'russian', zh: 'chinese' }
  const language = opts.language ? (langMap[opts.language] ?? opts.language) : undefined

  const runOpts: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    task: 'transcribe',
  }
  if (language) runOpts.language = language

  const out = await asr(audio, runOpts)
  const chunks = out.chunks ?? (out.text ? [{ text: out.text, timestamp: [0, audio.length / 16000] as [number, number | null] }] : [])
  const lines: LyricLine[] = []
  for (const c of chunks) {
    const text = cleanText(c.text ?? '')
    if (!text || !hasLetters(text) || HALLUCINATIONS.test(text)) continue
    const start = c.timestamp?.[0]
    let end = c.timestamp?.[1]
    if (start == null) continue
    if (end == null || end <= start) end = start + Math.max(1.2, text.split(' ').length * 0.38)
    // silence check — drop whispers of noise (honest output)
    if (rmsAt(audio, start, Math.min(end, start + 2)) < 0.004) continue
    for (const s of splitLong({ text, start, end })) lines.push(s)
    if (lines.length >= 220) break
  }
  if (!lines.length) throw new Error('No clear vocals found in this audio — the song may be instrumental or too noisy.')
  return lines
}
