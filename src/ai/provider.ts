// Optional AI provider — any OpenAI-compatible chat completions endpoint (BYO key, stored locally only)
import type { EditPlan, PlanAction } from '../lib/types'

export interface AIConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
  model: string
}

export const DEFAULT_AI: AIConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
}

const ALLOWED = new Set([
  'setDuration', 'setAspect', 'buildPhotoEdit', 'setStyle', 'beatSync', 'addZooms', 'setColorGrade',
  'setSpeed', 'trimStart', 'keepBest', 'removeAudio', 'addCaptions', 'addTitle', 'addLowerThird',
  'addCounter', 'setTransition', 'removeClip', 'addMovement', 'reduceEffects', 'setVolume', 'fadeOut',
  'applyReferencePacing', 'fitToMusic', 'autoReframe', 'speedRamp', 'addOutro', 'addEffect', 'autoLyrics',
])

const ASPECTS = new Set(['9:16', '16:9', '1:1', '4:5', '21:9'])
const GRADES = new Set(['none', 'cinematic', 'orangeTeal', 'warm', 'cold', 'dark', 'bw', 'vintage', 'vibrant', 'muted'])
const STYLES = new Set(['cinematic', 'fast', 'hype', 'emotional', 'minimal', 'dark', 'energetic', 'vlog', 'sports', 'travel', 'gaming', 'fashion', 'luxury', 'beatsync'])
const TRANSITIONS = new Set(['none', 'dissolve', 'flash', 'whip', 'slide', 'blurIn'])
const EFFECTS = new Set(['vignette', 'shake', 'glow', 'rgbSplit', 'brightness', 'contrast', 'saturation', 'hue', 'blur', 'grain', 'letterbox', 'lightLeak'])

/** Validate & sanitize an LLM-produced plan. Unknown/broken actions are dropped. */
export function validatePlan(raw: unknown): EditPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const actions = (raw as { actions?: unknown[] }).actions
  if (!Array.isArray(actions)) return null
  const clean: PlanAction[] = []
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue
    const o = a as Record<string, unknown>
    const type = String(o.type)
    if (!ALLOWED.has(type)) continue
    switch (type) {
      case 'setDuration':
        if (typeof o.seconds === 'number') clean.push({ type: 'setDuration', seconds: o.seconds })
        break
      case 'setAspect':
        if (typeof o.aspect === 'string' && ASPECTS.has(o.aspect)) clean.push({ type: 'setAspect', aspect: o.aspect as '9:16' })
        break
      case 'buildPhotoEdit':
        clean.push({
          type: 'buildPhotoEdit',
          duration: typeof o.duration === 'number' ? o.duration : undefined,
          style: typeof o.style === 'string' && STYLES.has(o.style) ? (o.style as 'cinematic') : undefined,
          beatSync: typeof o.beatSync === 'boolean' ? o.beatSync : undefined,
          title: typeof o.title === 'string' ? o.title.slice(0, 48) : undefined,
        })
        break
      case 'setStyle':
        if (typeof o.style === 'string' && STYLES.has(o.style)) clean.push({ type: 'setStyle', style: o.style as 'cinematic' })
        break
      case 'beatSync':
        clean.push({ type: 'beatSync', enabled: !!o.enabled })
        break
      case 'addZooms':
      case 'addMovement':
        clean.push({ type, intensity: clampNum(o.intensity, 0.05, 1, 0.6) } as PlanAction)
        break
      case 'setColorGrade':
        if (typeof o.grade === 'string' && GRADES.has(o.grade)) clean.push({ type: 'setColorGrade', grade: o.grade as 'cinematic' })
        break
      case 'setSpeed':
        clean.push({ type: 'setSpeed', speed: clampNum(o.speed, 0.25, 3, 1) } as PlanAction)
        break
      case 'trimStart':
        clean.push({ type: 'trimStart', seconds: clampNum(o.seconds, 0.1, 120, 2) } as PlanAction)
        break
      case 'keepBest':
        clean.push({ type: 'keepBest', seconds: clampNum(o.seconds, 2, 300, 20) } as PlanAction)
        break
      case 'removeAudio':
        clean.push({ type: 'removeAudio' })
        break
      case 'addCaptions':
        clean.push({ type: 'addCaptions', text: typeof o.text === 'string' ? o.text.slice(0, 400) : undefined, font: typeof o.font === 'string' ? o.font.slice(0, 40) : undefined })
        break
      case 'addTitle':
      case 'addLowerThird':
        if (typeof o.text === 'string' && o.text.trim()) clean.push({ type, text: o.text.slice(0, 48), font: typeof o.font === 'string' ? o.font.slice(0, 40) : undefined } as PlanAction)
        break
      case 'addCounter':
        clean.push({ type: 'addCounter', from: 0, to: clampNum(o.to, 1, 100000, 10) } as PlanAction)
        break
      case 'setTransition':
        if (typeof o.style === 'string' && TRANSITIONS.has(o.style))
          clean.push({ type: 'setTransition', style: o.style as 'flash', duration: clampNum(o.duration, 0.08, 1.2, 0.3) } as PlanAction)
        break
      case 'removeClip':
        if (typeof o.index === 'number') clean.push({ type: 'removeClip', index: Math.max(0, Math.floor(o.index)) })
        break
      case 'reduceEffects':
        clean.push({ type: 'reduceEffects' })
        break
      case 'setVolume':
        clean.push({ type: 'setVolume', volume: clampNum(o.volume, 0, 1.5, 0.8) } as PlanAction)
        break
      case 'fadeOut':
        clean.push({ type: 'fadeOut', seconds: clampNum(o.seconds, 0.1, 6, 1.5) } as PlanAction)
        break
      case 'applyReferencePacing':
        clean.push({ type: 'applyReferencePacing' })
        break
      case 'fitToMusic':
        clean.push({ type: 'fitToMusic' })
        break
      case 'autoReframe':
        clean.push({ type: 'autoReframe', fill: o.fill === 'blur' ? 'blur' : 'crop' })
        break
      case 'speedRamp':
        clean.push({ type: 'speedRamp', slow: clampNum(o.slow, 0.3, 0.9, 0.5), fast: clampNum(o.fast, 1.1, 2.5, 1.5) })
        break
      case 'addOutro':
        clean.push({ type: 'addOutro', text: typeof o.text === 'string' ? o.text.slice(0, 48) : undefined })
        break
      case 'addEffect':
        if (typeof o.effect === 'string' && EFFECTS.has(o.effect))
          clean.push({ type: 'addEffect', effect: o.effect as 'vignette', intensity: clampNum(o.intensity, 0.05, 1, 0.5) })
        break
      case 'autoLyrics':
        clean.push({ type: 'autoLyrics', quality: o.quality === 'best' ? 'best' : 'fast', language: typeof o.language === 'string' ? o.language.slice(0, 12) : undefined })
        break
    }
  }
  if (!clean.length) return null
  return { actions: clean, note: typeof (raw as { note?: string }).note === 'string' ? (raw as { note: string }).note.slice(0, 300) : undefined }
}

function clampNum(v: unknown, a: number, b: number, d: number): number {
  const n = typeof v === 'number' && isFinite(v) ? v : d
  return Math.min(b, Math.max(a, n))
}

export async function planWithProvider(cfg: AIConfig, userText: string, projectContext: string): Promise<EditPlan> {
  const system = `You are STAR EDIT's planning engine. Convert the user's video editing request into a JSON edit plan.
Respond with ONLY JSON: {"actions":[...]} — no prose.
Available action types (use exact fields):
{"type":"setDuration","seconds":number}
{"type":"setAspect","aspect":"9:16"|"16:9"|"1:1"|"4:5"|"21:9"}
{"type":"buildPhotoEdit","duration":number,"style":"cinematic|fast|hype|emotional|minimal|dark|energetic|vlog|sports|travel|gaming|fashion|luxury|beatsync","beatSync":boolean,"title":string}
{"type":"setStyle","style":...} {"type":"beatSync","enabled":boolean}
{"type":"addZooms","intensity":0-1} {"type":"setColorGrade","grade":"none|cinematic|orangeTeal|warm|cold|dark|bw|vintage|vibrant|muted"}
{"type":"setSpeed","speed":number} {"type":"trimStart","seconds":n} {"type":"keepBest","seconds":n}
{"type":"removeAudio"} {"type":"addCaptions","text":string} {"type":"addTitle","text":string} {"type":"addLowerThird","text":string}
{"type":"addCounter","to":number} {"type":"setTransition","style":"dissolve|flash|whip|slide|blurIn","duration":n}
{"type":"removeClip","index":0-based} {"type":"addMovement","intensity":0-1} {"type":"reduceEffects"}
{"type":"setVolume","volume":0-1.5} {"type":"fadeOut","seconds":n} {"type":"applyReferencePacing"}
{"type":"fitToMusic"} {"type":"autoReframe","fill":"crop"|"blur"} {"type":"speedRamp","slow":0.3-0.9,"fast":1.1-2.5}
{"type":"addOutro","text":string} {"type":"addEffect","effect":"vignette|shake|glow|rgbSplit|brightness|contrast|saturation|hue|blur|grain|letterbox|lightLeak","intensity":0-1}
{"type":"autoLyrics","quality":"fast"|"best"}
Project context (JSON): ${projectContext}
Prefer buildPhotoEdit when the user describes a new edit and media exists. For vertical aspect changes, add autoReframe after setAspect. Never invent other action types.`

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    throw new Error(`Provider responded ${res.status}`)
  }
  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  const jsonStr = content.replace(/```json|```/g, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Provider returned invalid JSON')
  }
  const plan = validatePlan(parsed)
  if (!plan) throw new Error('Provider plan contained no valid actions')
  return plan
}

export async function testProvider(cfg: AIConfig): Promise<boolean> {
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    })
    return res.ok
  } catch {
    return false
  }
}
