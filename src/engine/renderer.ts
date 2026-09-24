// Canvas frame renderer — real effects, transitions, Ken Burns motion, text & captions
import type { Clip, EffectSpec, Project, TextProps, Track } from '../lib/types'
import type { MediaAsset } from '../lib/types'
import { clamp, easeIO, easeO } from '../lib/utils'

export interface AssetView {
  meta: MediaAsset
  url: string
  img?: HTMLImageElement
  el?: HTMLVideoElement
}

export interface RenderEnv {
  assets: Map<string, AssetView>
  starLogo?: HTMLImageElement | null
}

export function gradeFilter(g?: string): string {
  switch (g) {
    case 'cinematic': return 'contrast(1.1) saturate(0.92) brightness(0.97)'
    case 'orangeTeal': return 'contrast(1.14) saturate(1.2) hue-rotate(-8deg)'
    case 'warm': return 'sepia(0.22) saturate(1.12) brightness(1.02)'
    case 'cold': return 'hue-rotate(14deg) saturate(0.92) brightness(1.03)'
    case 'dark': return 'brightness(0.8) contrast(1.18) saturate(0.95)'
    case 'bw': return 'grayscale(1) contrast(1.12)'
    case 'vintage': return 'sepia(0.42) contrast(0.96) saturate(0.85) brightness(1.02)'
    case 'vibrant': return 'saturate(1.42) contrast(1.06)'
    case 'muted': return 'saturate(0.72) contrast(0.96) brightness(1.03)'
    default: return ''
  }
}

function effectFilter(effects: EffectSpec[]): string {
  const parts: string[] = []
  for (const e of effects) {
    const i = clamp(e.intensity, 0, 1)
    switch (e.type) {
      case 'brightness': parts.push(`brightness(${(1 + i * 0.5).toFixed(3)})`); break
      case 'contrast': parts.push(`contrast(${(1 + i * 0.5).toFixed(3)})`); break
      case 'saturation': parts.push(`saturate(${(1 + i * 1.2).toFixed(3)})`); break
      case 'hue': parts.push(`hue-rotate(${Math.round(i * 160)}deg)`); break
      case 'blur': parts.push(`blur(${(i * 10).toFixed(2)}px)`); break
      default: break
    }
  }
  return parts.join(' ')
}

export function clipFilter(clip: Clip, extraBlur?: number): string {
  const parts = [gradeFilter(clip.colorGrade), effectFilter(clip.effects)]
  if (extraBlur && extraBlur > 0.05) parts.push(`blur(${extraBlur.toFixed(2)}px)`)
  return parts.filter(Boolean).join(' ') || 'none'
}

export function motionAt(clip: Clip, t: number): { scale: number; dx: number; dy: number; rot: number } {
  const m = clip.motion
  const dur = Math.max(clip.duration, 0.001)
  const p = clamp((t - clip.start) / dur, 0, 1)
  const k = clamp(m.intensity, 0, 1)
  const e = easeIO(p)
  switch (m.type) {
    case 'zoomIn': return { scale: 1 + 0.3 * k * e, dx: 0, dy: 0, rot: 0 }
    case 'zoomOut': return { scale: 1 + 0.3 * k * (1 - e), dx: 0, dy: 0, rot: 0 }
    case 'panLeft': return { scale: 1 + 0.14 * k, dx: (0.5 - e) * 0.1 * k, dy: 0, rot: 0 }
    case 'panRight': return { scale: 1 + 0.14 * k, dx: (e - 0.5) * 0.1 * k, dy: 0, rot: 0 }
    case 'panUp': return { scale: 1 + 0.14 * k, dx: 0, dy: (e - 0.5) * 0.1 * k, rot: 0 }
    case 'panDown': return { scale: 1 + 0.14 * k, dx: 0, dy: (0.5 - e) * 0.1 * k, rot: 0 }
    case 'kenburns': return { scale: 1 + (0.08 + 0.26 * k) * e, dx: (e - 0.3) * 0.06 * k, dy: (0.3 - e) * 0.05 * k, rot: (e - 0.5) * 0.012 * k }
    case 'punch': {
      const punch = Math.pow(1 - clamp(p * 5, 0, 1), 2)
      return { scale: 1 + 0.32 * k * punch + 0.06 * k * e, dx: 0, dy: 0, rot: 0 }
    }
    default: return { scale: 1, dx: 0, dy: 0, rot: 0 }
  }
}

interface DrawOpts {
  alpha?: number
  offsetX?: number
  offsetY?: number
  blur?: number
  skipOverlays?: boolean
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    const x = cx + Math.cos(ang) * rad
    const y = cy + Math.sin(ang) * rad
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawMediaSource(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  clip: Clip, t: number, env: RenderEnv, o: DrawOpts = {}
) {
  const av = clip.mediaId ? env.assets.get(clip.mediaId) : undefined
  const localT = clamp(t, clip.start, clip.start + Math.max(clip.duration - 0.001, 0.001))
  ctx.save()
  ctx.globalAlpha = clamp(o.alpha ?? clip.opacity ?? 1, 0, 1)
  ctx.filter = clipFilter(clip, o.blur)
  const shake = clip.effects.find((e) => e.type === 'shake')
  let sx = 0, sy = 0
  if (shake) {
    const s = shake.intensity
    sx = (Math.sin(t * 31.7) * 9 + Math.sin(t * 57.3) * 4) * s * (W / 1080) * 8
    sy = (Math.cos(t * 41.1) * 8 + Math.sin(t * 47.7) * 3) * s * (W / 1080) * 8
  }
  const { scale, dx, dy, rot } = motionAt(clip, localT)
  ctx.translate(W / 2 + sx + dx * W + (o.offsetX ?? 0), H / 2 + sy + dy * H + (o.offsetY ?? 0))
  if (rot) ctx.rotate(rot)
  ctx.scale(scale, scale)
  const has = av && (av.img || (av.el && av.el.readyState >= 2))
  if (has) {
    const src: CanvasImageSource = av.img ?? av.el!
    const sw = av.img ? av.img.naturalWidth : av.el!.videoWidth
    const sh = av.img ? av.img.naturalHeight : av.el!.videoHeight
    if (sw && sh) {
      const cover = Math.max(W / sw, H / sh) * 1.03
      const dw = sw * cover, dh = sh * cover
      try { ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh) } catch { /* frame not ready */ }
    }
  } else {
    // placeholder surface
    const g = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2)
    g.addColorStop(0, clip.color ?? '#141428')
    g.addColorStop(1, '#0a0a14')
    ctx.fillStyle = g
    ctx.fillRect(-W / 2, -H / 2, W, H)
  }
  ctx.restore()
  if (o.skipOverlays) return
  // RGB split (chromatic aberration approximation)
  const rgb = clip.effects.find((e) => e.type === 'rgbSplit')
  if (rgb) {
    const off = 3 + rgb.intensity * 16
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.34 * rgb.intensity + 0.08
    ctx.filter = 'sepia(1) hue-rotate(-50deg) saturate(6)'
    drawAgain(ctx, W, H, clip, t, env, -off, 0)
    ctx.filter = 'sepia(1) hue-rotate(140deg) saturate(6)'
    drawAgain(ctx, W, H, clip, t, env, off, 0)
    ctx.restore()
  }
}

function drawAgain(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  clip: Clip, t: number, env: RenderEnv, ox: number, oy: number
) {
  const av = clip.mediaId ? env.assets.get(clip.mediaId) : undefined
  if (!av || !(av.img || (av.el && av.el.readyState >= 2))) return
  const localT = clamp(t, clip.start, clip.start + Math.max(clip.duration - 0.001, 0.001))
  const { scale, dx, dy, rot } = motionAt(clip, localT)
  ctx.save()
  ctx.translate(W / 2 + dx * W + ox, H / 2 + dy * H + oy)
  if (rot) ctx.rotate(rot)
  ctx.scale(scale, scale)
  const src: CanvasImageSource = av.img ?? av.el!
  const sw = av.img ? av.img.naturalWidth : av.el!.videoWidth
  const sh = av.img ? av.img.naturalHeight : av.el!.videoHeight
  const cover = Math.max(W / sw, H / sh) * 1.03
  try { ctx.drawImage(src, -(sw * cover) / 2, -(sh * cover) / 2, sw * cover, sh * cover) } catch { /* noop */ }
  ctx.restore()
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${clamp(0.6 * intensity, 0, 0.85)})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function grain(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number, t: number) {
  ctx.save()
  ctx.globalAlpha = 0.05 * intensity
  const step = Math.max(2, Math.round(W / 240))
  const seed = Math.floor(t * 24)
  for (let y = 0; y < H; y += step) {
    for (let x = (seed % 2) * step; x < W; x += step * 2) {
      if (((x * 7 + y * 13 + seed) % 11) < 3) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, y, step * 0.6, step * 0.6)
      }
    }
  }
  ctx.restore()
}

function drawTextClip(ctx: CanvasRenderingContext2D, W: number, H: number, clip: Clip, t: number) {
  const tp: TextProps | undefined = clip.text
  if (!tp) return
  const p = clamp((t - clip.start) / Math.max(clip.duration, 0.001), 0, 1)
  let content = tp.content
  if (tp.countTo != null) {
    const val = Math.round(tp.countTo * easeO(p))
    content = `${tp.content ? tp.content + ' ' : ''}${val.toLocaleString('en-US')}`
  }
  const size = (tp.size / 100) * H
  const envIn = easeO(clamp(p / 0.12, 0, 1))
  const envOut = easeO(clamp((1 - p) / 0.12, 0, 1))
  let alpha = Math.min(envIn, envOut)
  if (tp.anim === 'none') alpha = Math.min(clamp(p / 0.05, 0, 1), clamp((1 - p) / 0.05, 0, 1))
  let ty = 0, sc = 1
  if (tp.anim === 'slideUp') ty = (1 - easeO(clamp(p / 0.2, 0, 1))) * H * 0.06
  if (tp.anim === 'pop') {
    const q = clamp(p / 0.18, 0, 1)
    sc = 0.82 + 0.18 * easeO(q)
  }
  if (tp.anim === 'typewriter') {
    const chars = Math.ceil(clamp(p / 0.6, 0, 1) * content.length)
    content = content.slice(0, chars)
  }
  ctx.save()
  ctx.globalAlpha = clamp(alpha, 0, 1)
  ctx.translate(tp.x * W, tp.y * H + ty)
  ctx.scale(sc, sc)
  ctx.textAlign = tp.align
  ctx.textBaseline = 'middle'
  if (tp.rtl) ctx.direction = 'rtl'
  ctx.font = `${tp.weight} ${size}px "${tp.font}", "Vazirmatn", "Inter", sans-serif`
  const words = content.split(' ')
  const spaceW = ctx.measureText(' ').width
  const lineW = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + spaceW * (words.length - 1)
  // background pill
  if (tp.bg) {
    const padX = size * 0.45, padY = size * 0.28
    const bx = tp.align === 'center' ? -lineW / 2 - padX : tp.align === 'right' ? -lineW - padX : -padX
    ctx.fillStyle = `rgba(0,0,0,${tp.bg.opacity})`
    ctx.beginPath()
    const rx = bx, ry = -size * 0.62 - padY, rw = lineW + padX * 2, rh = size * 1.24 + padY * 2, rr = size * 0.24
    ctx.moveTo(rx + rr, ry)
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr)
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr)
    ctx.arcTo(rx, ry + rh, rx, ry, rr)
    ctx.arcTo(rx, ry, rx + rw, ry, rr)
    ctx.closePath()
    ctx.fill()
  }
  const karaoke = tp.anim === 'karaoke'
  let x = tp.align === 'center' ? -lineW / 2 : tp.align === 'right' ? -lineW : 0
  if (tp.glow) {
    ctx.shadowColor = 'rgba(139,92,246,0.85)'
    ctx.shadowBlur = size * 0.45
  }
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width
    const active = karaoke && p >= i / words.length
    const prevActive = karaoke && p >= (i + 1) / words.length
    if (tp.stroke) {
      ctx.lineWidth = Math.max(2, size * 0.09)
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'
      ctx.lineJoin = 'round'
      ctx.strokeText(w, x, 0)
    }
    ctx.fillStyle = karaoke ? (prevActive ? tp.color : active ? tp.accent ?? '#a78bfa' : 'rgba(255,255,255,0.55)') : tp.color
    ctx.fillText(w, x, 0)
    x += ww + spaceW
  })
  ctx.restore()
}

function drawLogoClip(ctx: CanvasRenderingContext2D, W: number, H: number, clip: Clip, t: number) {
  const p = clamp((t - clip.start) / Math.max(clip.duration, 0.001), 0, 1)
  const alpha = Math.min(easeO(clamp(p / 0.25, 0, 1)), easeO(clamp((1 - p) / 0.25, 0, 1)))
  const scale = 0.7 + 0.3 * easeO(p)
  const r = H * 0.085 * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(W / 2, H * 0.42)
  // glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3)
  glow.addColorStop(0, 'rgba(139,92,246,0.55)')
  glow.addColorStop(1, 'rgba(139,92,246,0)')
  ctx.fillStyle = glow
  ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6)
  const grad = ctx.createLinearGradient(-r, -r, r, r)
  grad.addColorStop(0, '#a78bfa')
  grad.addColorStop(1, '#60a5fa')
  ctx.fillStyle = grad
  starPath(ctx, 0, 0, r)
  ctx.fill()
  // play triangle
  ctx.fillStyle = '#0a0a12'
  ctx.beginPath()
  ctx.moveTo(-r * 0.22, -r * 0.34)
  ctx.lineTo(r * 0.34, 0)
  ctx.lineTo(-r * 0.22, r * 0.34)
  ctx.closePath()
  ctx.fill()
  if (clip.text?.content) {
    ctx.font = `800 ${H * 0.045}px "Inter", "Vazirmatn", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(139,92,246,0.8)'
    ctx.shadowBlur = 24
    ctx.fillText(clip.text.content, 0, H * 0.09)
  }
  ctx.restore()
}

function drawClipFull(ctx: CanvasRenderingContext2D, W: number, H: number, clip: Clip, t: number, env: RenderEnv, o: DrawOpts = {}) {
  if (clip.kind === 'text') return drawTextClip(ctx, W, H, clip, t)
  if (clip.kind === 'logo') return drawLogoClip(ctx, W, H, clip, t)
  drawMediaSource(ctx, W, H, clip, t, env, o)
  if (!o.skipOverlays) {
    const vg = clip.effects.find((e) => e.type === 'vignette')
    if (vg) vignette(ctx, W, H, vg.intensity)
    const gr = clip.effects.find((e) => e.type === 'grain')
    if (gr) grain(ctx, W, H, gr.intensity, t)
  }
}

function renderVideoTrack(ctx: CanvasRenderingContext2D, W: number, H: number, track: Track, t: number, env: RenderEnv) {
  const clips = [...track.clips].sort((a, b) => a.start - b.start)
  const idx = clips.findIndex((c) => t >= c.start - 1e-6 && t < c.start + c.duration)
  if (idx < 0) return
  const clip = clips[idx]
  const trIn = clip.transitionIn
  const prev = idx > 0 ? clips[idx - 1] : null
  const inTransition = trIn && trIn.style !== 'none' && trIn.duration > 0 && prev && t < clip.start + trIn.duration
  if (inTransition && prev) {
    const p = clamp((t - clip.start) / Math.max(trIn.duration, 0.001), 0, 1)
    const e = easeIO(p)
    switch (trIn.style) {
      case 'dissolve': {
        drawClipFull(ctx, W, H, prev, t, env, { skipOverlays: true })
        drawClipFull(ctx, W, H, clip, t, env, { alpha: e })
        break
      }
      case 'flash': {
        drawClipFull(ctx, W, H, clip, t, env)
        ctx.save()
        ctx.globalAlpha = (1 - e) * 0.92
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
        break
      }
      case 'whip': {
        drawClipFull(ctx, W, H, prev, t, env, { offsetX: -e * W * 1.15, blur: 7 * e, skipOverlays: true })
        drawClipFull(ctx, W, H, clip, t, env, { offsetX: (1 - e) * W * 1.15, blur: 7 * (1 - e) })
        break
      }
      case 'slide': {
        drawClipFull(ctx, W, H, prev, t, env, { offsetX: -e * W * 0.4, skipOverlays: true })
        drawClipFull(ctx, W, H, clip, t, env, { offsetX: (1 - e) * W * 0.4 })
        break
      }
      case 'blurIn': {
        drawClipFull(ctx, W, H, prev, t, env, { skipOverlays: true })
        drawClipFull(ctx, W, H, clip, t, env, { alpha: e, blur: (1 - e) * 18 })
        break
      }
      default: drawClipFull(ctx, W, H, clip, t, env)
    }
  } else {
    drawClipFull(ctx, W, H, clip, t, env)
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  project: Project, t: number, env: RenderEnv
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 0, W, H)
  for (const track of project.tracks) {
    if (track.kind === 'video' && !track.hidden) renderVideoTrack(ctx, W, H, track, t, env)
  }
  for (const track of project.tracks) {
    if (track.kind !== 'text' || track.hidden) continue
    const clip = track.clips.find((c) => t >= c.start && t < c.start + c.duration)
    if (clip) drawClipFull(ctx, W, H, clip, t, env)
  }
  ctx.filter = 'none'
  ctx.globalAlpha = 1
}
