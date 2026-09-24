// Locally generated placeholder visuals (used by the landing demo & empty timelines — honest, no stock assets)
export const PALETTES: Record<string, [string, string, string]> = {
  football: ['#1a0b00', '#7c3a00', '#ff8a00'],
  cinematic: ['#02121a', '#0b4a5c', '#ff7a45'],
  travel: ['#04202b', '#0e6e7e', '#ffd37a'],
  gaming: ['#0b0620', '#4318a8', '#22d3ee'],
  fashion: ['#0a0a0a', '#3a3a3a', '#e5e5e5'],
  star: ['#0a0616', '#3b1d7a', '#8b5cf6'],
}

export function makeGradientImage(paletteKey: keyof typeof PALETTES, w = 720, h = 1280, variant = 0): Promise<Blob> {
  const [dark, mid, accent] = PALETTES[paletteKey] ?? PALETTES.star
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, dark)
  g.addColorStop(0.55, mid)
  g.addColorStop(1, dark)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // soft accent orbs — deterministic per variant
  for (let i = 0; i < 4; i++) {
    const seed = (variant + 1) * 97 * (i + 3)
    const x = ((seed * 37) % w)
    const y = ((seed * 53) % h)
    const r = (Math.min(w, h) / 3.4) * (0.5 + ((seed % 50) / 100))
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, accent + (i % 2 ? '55' : '33'))
    rg.addColorStop(1, '#00000000')
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85))
}

export async function makeDemoImageSet(paletteKey: keyof typeof PALETTES, count = 6): Promise<Blob[]> {
  const out: Blob[] = []
  for (let i = 0; i < count; i++) out.push(await makeGradientImage(paletteKey, 720, 1280, i))
  return out
}
