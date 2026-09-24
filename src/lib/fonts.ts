// Font manager — any Google Font on demand (incl. Persian), plus custom uploaded fonts.
// Fonts are loaded lazily so canvas preview & export always draw with the real glyphs.
import { kvGet, kvSet } from './db'

export interface FontDef {
  family: string
  group: 'Persian / Arabic' | 'Display' | 'Sans' | 'Serif' | 'Mono' | 'Custom'
  weights?: string // css2 wght axis, default 400;700;900
}

export const FONT_CATALOG: FontDef[] = [
  // Persian / Arabic script
  { family: 'Vazirmatn', group: 'Persian / Arabic', weights: '100..900' },
  { family: 'Lalezar', group: 'Persian / Arabic' },
  { family: 'Markazi Text', group: 'Persian / Arabic' },
  { family: 'Amiri', group: 'Persian / Arabic', weights: '400;700' },
  { family: 'Cairo', group: 'Persian / Arabic', weights: '200..900' },
  { family: 'Noto Naskh Arabic', group: 'Persian / Arabic' },
  { family: 'Noto Kufi Arabic', group: 'Persian / Arabic', weights: '100..900' },
  // Display / titles
  { family: 'Anton', group: 'Display' },
  { family: 'Bebas Neue', group: 'Display' },
  { family: 'Oswald', group: 'Display', weights: '200..700' },
  { family: 'Archivo Black', group: 'Display' },
  { family: 'Righteous', group: 'Display' },
  { family: 'Cinzel', group: 'Display', weights: '400..900' },
  { family: 'Rubik Mono One', group: 'Display' },
  { family: 'Bungee', group: 'Display' },
  { family: 'Alfa Slab One', group: 'Display' },
  // Sans
  { family: 'Inter', group: 'Sans', weights: '100..900' },
  { family: 'Montserrat', group: 'Sans', weights: '100..900' },
  { family: 'Poppins', group: 'Sans', weights: '300;400;600;700;800;900' },
  { family: 'Rubik', group: 'Sans', weights: '300..900' },
  { family: 'Nunito', group: 'Sans', weights: '200..1000' },
  { family: 'Space Grotesk', group: 'Sans', weights: '300..700' },
  { family: 'Manrope', group: 'Sans', weights: '200..800' },
  { family: 'Outfit', group: 'Sans', weights: '100..900' },
  // Serif
  { family: 'Playfair Display', group: 'Serif', weights: '400..900' },
  { family: 'Merriweather', group: 'Serif', weights: '300;400;700;900' },
  { family: 'Lora', group: 'Serif', weights: '400..700' },
  { family: 'DM Serif Display', group: 'Serif' },
  // Mono
  { family: 'JetBrains Mono', group: 'Mono', weights: '100..800' },
  { family: 'Space Mono', group: 'Mono', weights: '400;700' },
]

const loaded = new Set<string>()
let customFonts: { family: string; data: ArrayBuffer }[] | null = null

function injectGoogleFont(f: FontDef) {
  const id = `gf-${f.family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  const w = f.weights ?? '400;700;900'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${w}&display=swap`
  document.head.appendChild(link)
}

/** Make sure a font is really available to canvas rendering (preview + export). */
export async function ensureFont(family: string): Promise<boolean> {
  if (!family) return false
  const def = FONT_CATALOG.find((f) => f.family.toLowerCase() === family.toLowerCase())
  try {
    if (def) {
      if (!loaded.has(def.family)) {
        injectGoogleFont(def)
        loaded.add(def.family)
      }
      await Promise.race([
        Promise.all([
          document.fonts.load(`900 48px "${def.family}"`),
          document.fonts.load(`700 48px "${def.family}"`),
          document.fonts.load(`400 48px "${def.family}"`),
        ]),
        new Promise((r) => setTimeout(r, 3500)),
      ])
      return (
        document.fonts.check(`900 48px "${def.family}"`) ||
        document.fonts.check(`700 48px "${def.family}"`) ||
        document.fonts.check(`400 48px "${def.family}"`)
      )
    }
    // custom uploaded font — already registered via FontFace
    await Promise.race([document.fonts.load(`900 48px "${family}"`), new Promise((r) => setTimeout(r, 1500))])
    return document.fonts.check(`900 48px "${family}"`) || document.fonts.check(`400 48px "${family}"`)
  } catch {
    return false
  }
}

export function isCustomFont(family: string): boolean {
  return !FONT_CATALOG.some((f) => f.family.toLowerCase() === family.toLowerCase())
}

export async function registerCustomFont(family: string, data: ArrayBuffer): Promise<void> {
  const face = new FontFace(family, data)
  await face.load()
  document.fonts.add(face)
  if (!customFonts) await restoreCustomFonts()
  customFonts = [...(customFonts ?? []), { family, data }]
  const safe = (customFonts ?? []).slice(-24) // cap storage
  customFonts = safe
  await kvSet('customFonts', safe)
}

export async function restoreCustomFonts(): Promise<void> {
  try {
    const list = await kvGet<{ family: string; data: ArrayBuffer }[]>('customFonts')
    if (!list) return
    customFonts = list
    for (const f of list) {
      try {
        const face = new FontFace(f.family, f.data)
        await face.load()
        document.fonts.add(face)
      } catch { /* skip broken entry */ }
    }
  } catch { /* first run */ }
}

export function allFontFamilies(): { family: string; group: FontDef['group'] }[] {
  const out = FONT_CATALOG.map((f) => ({ family: f.family, group: f.group }))
  for (const f of customFonts ?? []) out.push({ family: f.family, group: 'Custom' })
  return out
}

/** Fuzzy font-name lookup for AI commands ("font anton", "فونت وزیر"). */
export function findFontByName(q: string): string | null {
  const s = q.toLowerCase().replace(/font|فونت/g, '').trim()
  if (!s) return null
  const all = allFontFamilies()
  const exact = all.find((f) => f.family.toLowerCase() === s)
  if (exact) return exact.family
  const partial = all.find((f) => f.family.toLowerCase().includes(s) || s.includes(f.family.toLowerCase().split(' ')[0]))
  if (partial) return partial.family
  // levenshtein ≤ 2 on family words
  let best: { f: string; d: number } | null = null
  for (const f of all) {
    const d = lev(s, f.family.toLowerCase())
    if (!best || d < best.d) best = { f: f.family, d }
  }
  return best && best.d <= 2 ? best.f : null
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}
