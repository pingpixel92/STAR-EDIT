// Local deterministic NLP — maps natural language (EN + FA) to validated EditPlans.
// Honest by design: every produced action is a real editing operation.
import type { EditPlan, GradeId, PlanAction, StyleId, TransitionStyle } from '../lib/types'
import { normalizeDigits } from '../lib/utils'

interface Ctx {
  hasImages: boolean
  hasVideos: boolean
  hasMusic: boolean
  bpm?: number
  duration: number
}

const STYLE_WORDS: Record<StyleId, string[]> = {
  cinematic: ['cinematic', 'movie', 'film', 'sienma', 'سینمایی', 'فیلمی'],
  fast: ['fast', 'quick', 'سریع', 'تند'],
  hype: ['hype', 'aggressive', 'hyped', 'هایپ', 'تهاجمی'],
  emotional: ['emotional', 'sad', 'love', 'احساسی', 'عاشقانه', 'غمگین'],
  minimal: ['minimal', 'clean', 'simple', 'مینیمال', 'ساده', 'تمیز'],
  dark: ['dark', 'moody', 'تیره', 'تاریک', 'گودیک'],
  energetic: ['energetic', 'energy', 'پرانرژی', 'انرژی'],
  vlog: ['vlog', 'ولاگ'],
  sports: ['sport', 'sports', 'football', 'soccer', 'فوتبال', 'ورزشی', 'فوتبالی'],
  travel: ['travel', 'trip', 'سفر', 'مسافرت', 'تراول'],
  gaming: ['gaming', 'game', 'gamer', 'گیم', 'بازی', 'گیمینگ'],
  fashion: ['fashion', 'style', 'مد', 'فشن'],
  luxury: ['luxury', 'lux', 'لاکچری', 'لوکس'],
  beatsync: ['beat sync', 'beatsync', 'on beat', 'sync to the beat', 'سینک بیت', 'روی بیت', 'همگام با بیت'],
}

const GRADE_WORDS: [GradeId, string[]][] = [
  ['dark', ['darker', 'dark look', 'تیره‌تر', 'تاریک‌تر', 'مودار']],
  ['bw', ['black and white', 'b&w', 'monochrome', 'سیاه و سفید', 'سیاهسفید']],
  ['vintage', ['vintage', 'retro', 'قدیمی', 'نوستالژی', 'وینتیج']],
  ['vibrant', ['vibrant', 'colorful', 'more color', 'پررنگ', 'زنده‌تر', 'رنگارنگ']],
  ['warm', ['warm', 'گرم']],
  ['cold', ['cold', 'cooler', 'سرد', 'سردتر']],
  ['cinematic', ['cinematic look', 'film look', 'سینمایی']],
  ['muted', ['muted', 'desaturated', 'کم‌رنگ', 'ملایم']],
]

function has(re: RegExp, s: string): boolean {
  return re.test(s)
}

function firstNumber(s: string): number | null {
  const m = normalizeDigits(s).match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

function durationSeconds(s: string): number | null {
  const t = normalizeDigits(s)
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec|secs|second|seconds|ثانیه)/)
  if (m) return parseFloat(m[1])
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:m\b|min|minute|minutes|دقیقه)/)
  if (m) return parseFloat(m[1]) * 60
  return null
}

function extractQuoted(s: string): string | null {
  const m = s.match(/["“”'«]([^"“”'»]{1,48})["“”'»]/)
  if (m) return m[1].trim()
  const en = s.match(/(?:title|titled|saying|text|عنوان|متن)\s+(?:of\s+)?([A-Za-z\u0600-\u06FF][A-Za-z0-9 \u0600-\u06FF!?.-]{1,40})$/i)
  if (en) return en[1].trim()
  return null
}

export interface ParseResult {
  plan: EditPlan
  matched: string[]
}

export function parseCommand(input: string, ctx: Ctx): ParseResult | null {
  const s = normalizeDigits(input.toLowerCase().trim())
  if (!s) return null
  const actions: PlanAction[] = []
  const matched: string[] = []

  // undo / redo handled by UI layer, not here

  // ---- target duration ----
  const dur = durationSeconds(s)
  const wantsBuild = has(/\b(make|build|create|edit|generate|بساز|ساخت|ادیت کن|درست کن|ایجاد)\b/, s) || has(/بساز|ادیت/, s)

  // ---- aspect ratio ----
  if (has(/tiktok|reels?\b|shorts?|9:16|تیک تاک|ریلز|شورت/, s) || has(/عمودی|پرتره برای/, s)) {
    actions.push({ type: 'setAspect', aspect: '9:16' })
    matched.push('aspect 9:16')
  } else if (has(/youtube|16:9|یوتیوب|افقی/, s)) {
    actions.push({ type: 'setAspect', aspect: '16:9' })
    matched.push('aspect 16:9')
  } else if (has(/square|1:1|مربع/, s)) {
    actions.push({ type: 'setAspect', aspect: '1:1' })
    matched.push('aspect 1:1')
  } else if (has(/21:9|anamorphic|سینمااسکوپ/, s)) {
    actions.push({ type: 'setAspect', aspect: '21:9' })
    matched.push('aspect 21:9')
  }

  // ---- style ----
  let style: StyleId | null = null
  for (const [id, words] of Object.entries(STYLE_WORDS) as [StyleId, string[]][]) {
    if (words.some((w) => s.includes(w))) {
      style = id
      break
    }
  }
  if (style) matched.push(`style: ${style}`)

  // ---- full build request ----
  if (wantsBuild && (ctx.hasImages || ctx.hasVideos) && (dur || style || has(/photo|photos|slideshow|عکس|عکس‌ها|اسلاید/, s) || actions.length)) {
    const title = extractQuoted(input)
    actions.unshift({
      type: 'buildPhotoEdit',
      duration: dur ?? undefined,
      style: style ?? 'cinematic',
      beatSync: has(/beat|sync|بیت|ریتم|سینک/, s),
      title: title ?? undefined,
    })
    matched.push('build photo edit')
  } else if (dur && !actions.length) {
    actions.push({ type: 'setDuration', seconds: dur })
    matched.push(`duration ${dur}s`)
  }

  // ---- color grade ----
  for (const [grade, words] of GRADE_WORDS) {
    if (words.some((w) => s.includes(w))) {
      actions.push({ type: 'setColorGrade', grade })
      matched.push(`grade: ${grade}`)
      break
    }
  }

  // ---- beat sync ----
  if (has(/beat|بیت|ریتم|سینک|sync/, s) && !actions.some((a) => a.type === 'buildPhotoEdit')) {
    if (ctx.hasMusic) {
      actions.push({ type: 'beatSync', enabled: true })
      matched.push('re-snap cuts to beats')
    }
  }

  // ---- zoom / movement ----
  if (has(/zoom|ken ?burns|زوم|کن ?برن/, s)) {
    const strong = has(/dramatic|hard|strong|قیف|قوی|دINGTON/, s) ? 0.9 : 0.6
    actions.push({ type: 'addZooms', intensity: strong })
    matched.push('add zooms')
  }
  if (has(/more movement|add movement|حرکت بیشتر|حرکت اضاف/, s)) {
    actions.push({ type: 'addMovement', intensity: 0.25 })
    matched.push('more movement')
  }

  // ---- speed ----
  if (has(/slow ?motion|slower|اسلوموشن|آهسته‌تر|کندتر/, s)) {
    actions.push({ type: 'setSpeed', speed: 0.6 })
    matched.push('slower')
  } else if (has(/\bmake it faster\b|speed up|faster pace|سریع‌تر|تندتر/, s)) {
    actions.push({ type: 'setSpeed', speed: 1.35 })
    matched.push('faster')
  }

  // ---- transitions ----
  if (has(/transition|ترنزیشن|گذر/, s)) {
    let st: TransitionStyle = 'dissolve'
    if (has(/flash|فلاش|فلش/, s)) st = 'flash'
    else if (has(/whip|ویپ/, s)) st = 'whip'
    else if (has(/blur|بلور|محو/, s)) st = 'blurIn'
    else if (has(/slide|اسلاید/, s)) st = 'slide'
    const d = firstNumber(s.split(/transition|ترنزیشن/)[1] ?? '') ?? undefined
    actions.push({ type: 'setTransition', style: st, duration: d ? clampT(d) : undefined })
    matched.push(`transitions: ${st}`)
  }

  // ---- beat drop emphasis ----
  if (has(/drop|دراپ|ضربه/, s) && has(/hard|hit|strong|قوی|سنگین/, s)) {
    actions.push({ type: 'setTransition', style: 'flash', duration: 0.18 })
    actions.push({ type: 'addZooms', intensity: 0.95 })
    matched.push('harder drops')
  }

  // ---- captions ----
  if (has(/captions?|subtitles?|کپشن|زیرنویس/, s)) {
    const text = extractQuoted(input) ?? undefined
    actions.push({ type: 'addCaptions', text, style: has(/bold|بولد|ضخیم/, s) ? 'bold' : undefined })
    matched.push('captions')
  }

  // ---- title / lower third ----
  const titleText = extractQuoted(input)
  if (has(/\btitle\b|عنوان|تیتر/, s) && titleText) {
    actions.push({ type: 'addTitle', text: titleText })
    matched.push('title')
  }
  if (has(/lower ?third|لوئر ?ثرد|نام نویس/, s) && titleText) {
    actions.push({ type: 'addLowerThird', text: titleText })
    matched.push('lower third')
  }

  // ---- audio ----
  if (has(/remove (the )?(original )?audio|mute (the )?(original )?(audio|video)|no audio|حذف صدا|بی ?صدا|صدای اصلی رو حذف/, s)) {
    actions.push({ type: 'removeAudio' })
    matched.push('remove original audio')
  }
  const vol = s.match(/(?:volume|صدا).{0,12}?(\d{1,3})\s*%/)
  if (vol) {
    actions.push({ type: 'setVolume', volume: Math.min(150, parseInt(vol[1], 10)) / 100 })
    matched.push(`volume ${vol[1]}%`)
  }
  if (has(/fade ?out|محو بشه|فید اوت/, s)) {
    actions.push({ type: 'fadeOut', seconds: firstNumber(s) ?? 1.5 })
    matched.push('fade out')
  }

  // ---- trimming ----
  const trimStart = normalizeDigits(s).match(/(?:remove|cut|delete|skip|حذف کن|برش)\s*(?:the\s*)?(?:first|اولین|اول)\s*(\d+(?:\.\d+)?)\s*(?:s\b|sec|seconds|ثانیه)/)
  if (trimStart) {
    actions.push({ type: 'trimStart', seconds: parseFloat(trimStart[1]) })
    matched.push(`trim first ${trimStart[1]}s`)
  }
  const keepBest = normalizeDigits(s).match(/(?:keep (?:only )?(?:the )?best|بهترین بخش|بهترین قسمت).{0,16}?(\d+(?:\.\d+)?)\s*(?:s\b|sec|seconds|ثانیه)?/)
  if (keepBest && has(/best|بهترین/, s)) {
    actions.push({ type: 'keepBest', seconds: parseFloat(keepBest[1]) || 20 })
    matched.push(`keep best ${keepBest[1] || 20}s`)
  } else if (has(/boring (beginning|start)|شروع خسته‌کننده|اول کسل/, s)) {
    actions.push({ type: 'trimStart', seconds: 2 })
    matched.push('trim boring start (first 2s)')
  }

  // ---- remove clip N ----
  const rm = normalizeDigits(s).match(/(?:remove|delete|حذف)\s*(?:the\s*)?(?:photo|clip|clip number|عکس)?\s*#?(\d{1,2})/)
  if (rm && has(/remove|delete|حذف/, s) && has(/photo|clip|عکس|کلیپ/, s)) {
    actions.push({ type: 'removeClip', index: parseInt(rm[1], 10) - 1 })
    matched.push(`remove clip #${rm[1]}`)
  }

  // ---- reduce effects ----
  if (has(/reduce|less effects|fewer effects|toned? down|کمتر|ساده‌تر|افکت کمتر/, s) && !has(/movement/, s)) {
    actions.push({ type: 'reduceEffects' })
    matched.push('reduce effects')
  }

  // ---- reference ----
  if (has(/like the reference|like reference|reference video|مثل ویدیوی مرجع|مرجع/, s)) {
    actions.push({ type: 'applyReferencePacing' })
    matched.push('apply reference pacing')
  }

  if (!actions.length) return null
  return { plan: { actions }, matched }
}

function clampT(d: number): number {
  return Math.min(1.2, Math.max(0.08, d))
}
