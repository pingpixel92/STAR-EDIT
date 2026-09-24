// Beat detection — real onset/BPM analysis via Web Audio (energy flux + autocorrelation)
import type { BeatMap } from '../lib/types'
import { decodeAudioBlob } from './mediaAnalysis'

function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export async function detectBeats(blob: Blob): Promise<Omit<BeatMap, 'mediaId'> | null> {
  const buf = await decodeAudioBlob(blob)
  if (!buf || buf.duration < 3) return null
  const sr = buf.sampleRate
  const n = buf.length
  const chCount = buf.numberOfChannels
  const mono = new Float32Array(n)
  for (let ch = 0; ch < chCount; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < n; i++) mono[i] += d[i] / chCount
  }
  const hop = Math.max(1, Math.round(sr / 100)) // 10 ms
  const frames = Math.floor(n / hop)
  if (frames < 60) return null
  const energy = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const st = f * hop
    for (let j = 0; j < hop; j += 2) {
      const v = mono[st + j]
      sum += v * v
    }
    energy[f] = Math.sqrt(sum / (hop / 2))
  }
  // spectral-flux-like onset envelope (positive energy delta, smoothed)
  const flux = new Float32Array(frames)
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1])
  const sm = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    sm[f] = (flux[Math.max(0, f - 1)] + flux[f] + flux[Math.min(frames - 1, f + 1)]) / 3
  }
  // adaptive threshold over ±0.5s window
  const W = 50
  const onsets: number[] = []
  const onsetStrength: number[] = []
  for (let f = 2; f < frames - 2; f++) {
    const lo = Math.max(0, f - W), hi = Math.min(frames, f + W)
    const local: number[] = []
    for (let k = lo; k < hi; k += 2) local.push(sm[k])
    const thr = median(local) * 1.45 + 0.004
    if (sm[f] > thr && sm[f] >= sm[f - 1] && sm[f] >= sm[f + 1] && sm[f] >= sm[f - 2] && sm[f] >= sm[f + 2]) {
      onsets.push(f * 0.01)
      onsetStrength.push(sm[f])
    }
  }
  if (onsets.length < 6) {
    return { bpm: 0, confidence: 0, beats: [], drops: [], analyzedAt: Date.now(), approximate: true }
  }
  // BPM via autocorrelation of onset envelope, 60..190 BPM
  const minLag = Math.floor(60 / 190 / 0.01) // ≈ 31
  const maxLag = Math.ceil(60 / 60 / 0.01) // 100
  let bestLag = 0, bestScore = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let f = 0; f + lag < frames; f += 2) score += sm[f] * sm[f + lag]
    score /= (frames - lag) / 2
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (!bestLag) return { bpm: 0, confidence: 0, beats: onsets, drops: [], analyzedAt: Date.now(), approximate: true }
  let bpm = 60 / (bestLag * 0.01)
  // fold into 80..160 range
  while (bpm < 80) bpm *= 2
  while (bpm > 160) bpm /= 2
  // phase alignment: choose grid offset among first onsets maximizing flux hits
  const beatSec = 60 / bpm
  let bestOffset = 0, bestHits = -1
  const cand = onsets.slice(0, 24)
  for (const o of cand) {
    let hits = 0
    for (let t = o; t < buf.duration; t += beatSec) {
      const fi = Math.round(t / 0.01)
      if (fi < frames) hits += sm[fi]
    }
    if (hits > bestHits) {
      bestHits = hits
      bestOffset = o % beatSec
    }
  }
  const beats: number[] = []
  for (let t = bestOffset; t < buf.duration - 0.05; t += beatSec) beats.push(Math.round(t * 1000) / 1000)
  // confidence: share of beats that have an onset within 80 ms
  let hitCount = 0
  for (const b of beats) {
    if (onsets.some((o) => Math.abs(o - b) < 0.08)) hitCount++
  }
  const confidence = Math.min(1, (hitCount / Math.max(beats.length, 1)) * 0.7 + Math.min(bestScore * 8, 0.3))
  // drops: strong energy jumps & high energy zones
  const drops: number[] = []
  let maxE = 0.0001
  for (let f = 0; f < frames; f++) maxE = Math.max(maxE, energy[f])
  let lastDrop = -10
  for (let f = W; f < frames; f++) {
    let localAvg = 0
    for (let k = f - W; k < f; k++) localAvg += energy[k]
    localAvg /= W
    if (energy[f] > localAvg * 2.1 && energy[f] > maxE * 0.55 && f * 0.01 - lastDrop > 1.4) {
      drops.push(Math.round(f * 0.01 * 1000) / 1000)
      lastDrop = f * 0.01
    }
  }
  return {
    bpm: Math.round(bpm),
    confidence: Math.round(confidence * 100) / 100,
    beats,
    drops,
    analyzedAt: Date.now(),
    approximate: confidence < 0.55,
  }
}
