import { clsx, type ClassValue } from 'clsx'
import { ASPECTS, type AspectId } from './types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

let idCounter = 0
export function uid(prefix = 'id'): string {
  idCounter = (idCounter + 1) % 100000
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}

export function formatTime(s: number, showCs = false): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 10)
  const base = `${m}:${sec.toString().padStart(2, '0')}`
  return showCs ? `${base}.${cs}` : base
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function easeIO(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

export function easeO(p: number): number {
  return 1 - Math.pow(1 - p, 3)
}

export function aspectOf(aspect: AspectId): number {
  const a = ASPECTS[aspect]
  return a.w / a.h
}

export function dimsFor(aspect: AspectId, targetH?: number): { w: number; h: number } {
  const a = ASPECTS[aspect]
  if (!targetH) return { w: a.w, h: a.h }
  const h = targetH
  const w = Math.round((h * a.w) / a.h / 2) * 2
  return { w, h }
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function shuffleStable<T>(arr: T[]): T[] {
  // deterministic reorder for "best first" heuristics
  return [...arr].sort((a, b) => 0)
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export function normalizeDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export const REDUCED_MOTION = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
