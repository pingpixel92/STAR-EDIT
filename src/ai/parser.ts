// Local deterministic NLP v2 — maps natural language (EN + FA) to validated EditPlans.
// Honest by design: every produced action is a real editing operation.
// v2: char/digit normalization, fuzzy keyword matching, new pro intents,
//     and a never-refuse fallback that turns any edit-ish prompt into a real plan.
import type { EditPlan, EffectType, GradeId, PlanAction, StyleId, TransitionStyle } from '../lib/types'
import { normalizeDigits } from '../lib/utils'
import { findFontByName } from '../lib/fonts'

export interface Ctx {
  hasImages: boolean
  hasVideos: boolean
  hasMusic: boolean
  bpm?: number
  duration: number
  clips: number // total clips currently on the timeline
}

// ---------- normalization ----------
export function normText(input: string): string {
  return normalizeDigits(input.toLowerCase())
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا') // alef variants — dictionary words are written with plain alef
    .replace(/ۀ|ة/g, 'ه')
    .replace(/[‌‍‬‍]/g, '') // ZWNJ & friends — folded, dictionaries are written folded too
    .replace(/\s+/g, ' ')
    .trim()
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (Math.abs(m - n) > 2) return 3
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

/** Substring match with typo tolerance (fuzzy for latin words ≥ 4 chars). */
function hit(s: string, word: string): boolean {
  if (s.includes(word)) return true
  if (!/^[a-z]/.test(word) || word.length < 4) return false
  const tol = word.length >= 7 ? 2 : 1
  return s.split(' ').some((w) => lev(w, word) <= tol)
}

const has = (re: RegExp, s: string) => re.test(s)

// ---------- dictionaries (written ZWNJ-folded) ----------
const STYLE_WORDS: Record<StyleId, string[]> = {
  cinematic: ['cinematic', 'movie', 'film look', 'sienma', 'سی نما', 'سینمایی', 'فیلمی'],
  fast: ['fast', 'quick cuts', 'سریع', 'تند'],
  hype: ['hype', 'aggressive', 'hyped', 'خفن', 'هایپ', 'تهاجمی'],
  emotional: ['emotional', 'sad', 'love story', 'احساسی', 'عاشقانه', 'غمگین', 'غم'],
  minimal: ['minimal', 'clean look', 'simple', 'مینیمال', 'ساده', 'تمیز', 'ارام'],
  dark: ['dark', 'moody', 'تیره', 'تاریک', 'گودیک', 'مودار'],
  energetic: ['energetic', 'energy', 'پرانرژی', 'انرژی'],
  vlog: ['vlog', 'ولاگ'],
  sports: ['sport', 'sports', 'football', 'soccer', 'فوتبال', 'ورزشی', 'فوتبالی'],
  travel: ['travel', 'trip', 'سفر', 'مسافرت', 'تراول'],
  gaming: ['gaming', 'game', 'gamer', 'گیم', 'بازی', 'گیمینگ'],
  fashion: ['fashion', 'style look', 'مد', 'فشن'],
  luxury: ['luxury', 'lux', 'لاکچری', 'لوکس'],
  beatsync: ['beat sync', 'beatsync', 'on beat', 'sync to the beat', 'سینک بیت', 'روی بیت', 'همگام با بیت', 'کات روی بیت'],
}

const GRADE_WORDS: [GradeId, string[]][] = [
  ['dark', ['darker', 'dark look', 'تیره تر', 'تاریک تر', 'مودار']],
  ['bw', ['black and white', 'b&w', 'black & white', 'monochrome', 'سیاه و سفید', 'سیاهسفید', 'سیاه سفید']],
  ['vintage', ['vintage', 'retro', 'قدیمی', 'نوستالژی', 'وینتیج']],
  ['vibrant', ['vibrant', 'colorful', 'more color', 'پررنگ', 'زنده تر', 'رنگارنگ', 'شاد']],
  ['warm', ['warm', 'گرم']],
  ['cold', ['cold', 'cooler', 'سرد', 'سردتر']],
  ['cinematic', ['cinematic look', 'film look', 'سینمایی']],
  ['muted', ['muted', 'desaturated', 'کم رنگ', 'ملایم']],
]

const EFFECT_WORDS: [EffectType, string[]][] = [
  ['letterbox', ['letterbox', 'cinematic bars', 'black bars', 'نوار سینمایی', 'نوارهای سیاه', 'نوار سیاه']],
  ['lightLeak', ['light leak', 'له لیک', 'نشت نور', 'نور گرم']],
  ['glow', ['glow', 'درخشش', 'هاله']],
  ['grain', ['grain', 'film grain', 'گرین', 'دانه فیلم']],
  ['vignette', ['vignette', 'وینیت']],
  ['rgbSplit', ['rgb', 'chromatic']],
  ['shake', ['shake', 'لرزش']],
]

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

function extractQuoted(original: string): string | null {
  const m = original.match(/["“”'«]([^"“”'»]{1,48})["“”'»]/)
  if (m) return m[1].trim()
  const en = original.match(/(?:title|titled|saying|text|عنوان|متن)\s+(?:of\s+)?([A-Za-z\u0600-\u06FF][A-Za-z0-9 \u0600-\u06FF!?.-]{1,40})$/i)
  if (en) return en[1].trim()
  return null
}

function extractFont(original: string): string | undefined {
  const m = original.match(/(?:font|فونت)\s+([A-Za-z\u0600-\u06FF][A-Za-z0-9 \u0600-\u06FF]{1,20})/i)
  if (!m) return undefined
  return findFontByName(m[1]) ?? undefined
}

export interface ParseResult {
  plan: EditPlan
  matched: string[]
  fallback?: boolean
}

const BUILD_RE = /\b(make|build|create|edit|generate|montage|بساز|ساخت|ادیت|montaz|مونتاژ|درست کن|ایجاد)\b/

export function parseCommand(input: string, ctx: Ctx): ParseResult | null {
  const original = input.trim()
  const s = normText(original)
  if (!s) return null
  const actions: PlanAction[] = []
  const matched: string[] = []

  // ---- lyrics / transcription (async flow) ----
  if (
    hit(s, 'lyrics') || hit(s, 'lyric') || hit(s, 'transcribe') || hit(s, 'transcription') ||
    /متن اهنگ|متن ترانه|ترانه رو|زیرنویس خودکار|کپشن اهنگ|اهنگ رو متن|تبدیل به متن|متن کن اهنگ|اهنگ رو تبدیل|متن synchronization|lyrics to text|song to text|caption the song|song text/.test(s)
  ) {
    const best = has(/best|high quality|بهترین کیفیت|کیفیت بالا/, s)
    actions.push({ type: 'autoLyrics', quality: best ? 'best' : 'fast', language: undefined })
    matched.push('auto lyrics (real transcription)')
  }

  // ---- fit / match music ----
  if (
    hit(s, 'match the music') || hit(s, 'match the song') || hit(s, 'fit the music') || hit(s, 'fit to the music') ||
    hit(s, 'match audio') || /مچ کن|اهنگ رو مچ|با اهنگ مچ|اهنگ و ویدیو|هماهنگ کن با اهنگ|باهم بیان|بهم بچسبن|جور کن با|هماهنگ باشه|سینک با اهنگ/.test(s)
  ) {
    actions.push({ type: 'fitToMusic' })
    matched.push('fit timeline ↔ music')
  }

  // ---- target duration ----
  const dur = durationSeconds(s)
  const wantsBuild = has(BUILD_RE, s) || /بساز|ادیت/.test(s)

  // ---- aspect ratio ----
  const wantsBlurFill = has(/blur (pad|background|bars)|پس زمینه بلور|بلور شده/, s)
  if (has(/tiktok|reels?\b|shorts?|9:16|تیک تاک|تیکتاک|ریلز|شورت/, s) || /عمودی|پرتره برای/.test(s)) {
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
  // explicit reframe / crop request (works even without an aspect word)
  if (
    hit(s, 'reframe') || hit(s, 'crop') || /کراپ|کادر بندی|کادرش کن|برش برای/.test(s) ||
    (actions.some((x) => x.type === 'setAspect') && (hit(s, 'convert') || /تبدیل کن/.test(s)))
  ) {
    actions.push({ type: 'autoReframe', fill: wantsBlurFill ? 'blur' : 'crop' })
    matched.push(wantsBlurFill ? 'smart reframe (blur pad)' : 'smart reframe (focal crop)')
  }

  // ---- style ----
  let style: StyleId | null = null
  for (const [id, words] of Object.entries(STYLE_WORDS) as [StyleId, string[]][]) {
    if (words.some((w) => hit(s, w))) {
      style = id
      break
    }
  }
  if (style) matched.push(`style: ${style}`)

  // ---- full build request ----
  if (wantsBuild && (ctx.hasImages || ctx.hasVideos) && (dur || style || has(/photo|photos|slideshow|عکس|عکسها|اسلاید/, s) || actions.length)) {
    const title = extractQuoted(original)
    actions.unshift({
      type: 'buildPhotoEdit',
      duration: dur ?? undefined,
      style: style ?? 'cinematic',
      beatSync: has(/beat|بیت|ریتم|سینک/, s),
      title: title ?? undefined,
    })
    matched.push('build photo edit')
  } else if (dur && !actions.length) {
    actions.push({ type: 'setDuration', seconds: dur })
    matched.push(`duration ${dur}s`)
  }

  // ---- color grade ----
  for (const [grade, words] of GRADE_WORDS) {
    if (words.some((w) => hit(s, w))) {
      actions.push({ type: 'setColorGrade', grade })
      matched.push(`grade: ${grade}`)
      break
    }
  }

  // ---- beat sync ----
  if (has(/beat|بیت|ریتم|سینک|sync/, s) && !actions.some((a) => a.type === 'buildPhotoEdit' || a.type === 'fitToMusic' || a.type === 'autoLyrics')) {
    if (ctx.hasMusic) {
      actions.push({ type: 'beatSync', enabled: true })
      matched.push('re-snap cuts to beats')
    }
  }

  // ---- zoom / movement ----
  if (has(/zoom|ken ?burns|زوم|کن ?برن/, s)) {
    const strong = has(/dramatic|hard|strong|heavy|شدید|قوی|سنگین/, s) ? 0.9 : 0.6
    actions.push({ type: 'addZooms', intensity: strong })
    matched.push('add zooms')
  }
  if (has(/more movement|add movement|حرکت بیشتر|حرکت اضاف/, s)) {
    actions.push({ type: 'addMovement', intensity: 0.25 })
    matched.push('more movement')
  }

  // ---- speed ----
  if (has(/slow ?motion|slower|اسلوموشن|اسلومیشن|اهسته تر|کندتر/, s)) {
    actions.push({ type: 'setSpeed', speed: 0.6 })
    matched.push('slower')
  } else if (has(/make it faster|speed up|faster pace|سریعتر|تندتر/, s)) {
    actions.push({ type: 'setSpeed', speed: 1.35 })
    matched.push('faster')
  }

  // ---- speed ramp ----
  if (hit(s, 'speed ramp') || hit(s, 'ramp') || /اسپید رمپ|رمپ سرعت|تند و کند|سرعت متغیر/.test(s)) {
    actions.push({ type: 'speedRamp' })
    matched.push('speed ramp (slow→fast)')
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

  // ---- effects ----
  for (const [fx, words] of EFFECT_WORDS) {
    if (words.some((w) => hit(s, w))) {
      actions.push({ type: 'addEffect', effect: fx, intensity: 0.5 })
      matched.push(`effect: ${fx}`)
      break
    }
  }

  // ---- captions ----
  if (has(/captions?|subtitles?|کپشن|زیرنویس/, s) && !actions.some((a) => a.type === 'autoLyrics')) {
    const text = extractQuoted(original) ?? undefined
    const font = extractFont(original)
    actions.push({ type: 'addCaptions', text, style: has(/bold|بولد|ضخیم/, s) ? 'bold' : has(/karaoke|کاراوکه|کادکی|کراوکه/, s) ? 'karaoke' : has(/neon|نئون/, s) ? 'neon' : undefined, font })
    matched.push('captions')
  }

  // ---- title / lower third / outro ----
  const titleText = extractQuoted(original)
  const font = extractFont(original)
  if (has(/\btitle\b|عنوان|تیتر/, s) && titleText) {
    actions.push({ type: 'addTitle', text: titleText, font })
    matched.push('title')
  }
  if (has(/lower ?third|لوئر ?ثرد|نام نویس/, s) && titleText) {
    actions.push({ type: 'addLowerThird', text: titleText, font })
    matched.push('lower third')
  }
  if (hit(s, 'outro') || hit(s, 'end card') || /اوترو|پایان بندی|اند کارد/.test(s)) {
    actions.push({ type: 'addOutro', text: titleText ?? undefined })
    matched.push('outro end card')
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
  } else if (has(/boring (beginning|start)|شروع خسته کننده|اول کسل/, s)) {
    actions.push({ type: 'trimStart', seconds: 2 })
    matched.push('trim boring start (first 2s)')
  }
  // "cut it well / clean cuts" → re-snap + rebuild pacing on the beat grid
  if (
    has(/clean (cuts?|editing)|cut (it|them) (clean|better|well)|better cuts|precise cuts?/,
      s) || /کات تمیز|خوب کات|درست کات|کات بزن|برش تمیز|کاتهای تمیز/.test(s)
  ) {
    if (ctx.hasMusic && !actions.some((x) => x.type === 'fitToMusic' || x.type === 'beatSync')) {
      actions.push({ type: 'fitToMusic' })
      matched.push('clean beat-locked re-cut')
    } else if (!actions.some((x) => x.type === 'fitToMusic')) {
      actions.push({ type: 'beatSync', enabled: true })
      matched.push('re-snap cuts')
    }
  }

  // ---- remove clip N ----
  const rm = normalizeDigits(s).match(/(?:remove|delete|حذف)\s*(?:the\s*)?(?:photo|clip|clip number|عکس)?\s*#?(\d{1,2})/)
  if (rm && has(/remove|delete|حذف/, s) && has(/photo|clip|عکس|کلیپ/, s)) {
    actions.push({ type: 'removeClip', index: parseInt(rm[1], 10) - 1 })
    matched.push(`remove clip #${rm[1]}`)
  }

  // ---- reduce effects ----
  if (has(/reduce|less effects|fewer effects|toned? down|کمتر|ساده تر|افکت کمتر/, s) && !has(/movement/, s)) {
    actions.push({ type: 'reduceEffects' })
    matched.push('reduce effects')
  }

  // ---- reference ----
  if (has(/like the reference|like reference|reference video|مثل ویدیوی مرجع|مرجع/, s)) {
    actions.push({ type: 'applyReferencePacing' })
    matched.push('apply reference pacing')
  }

  if (actions.length) return { plan: { actions }, matched }

  // ---------- fallback: never refuse an editing request ----------
  return fallbackPlan(s, original, ctx)
}

const CHAT_ONLY = /^(hi|hello|hey|yo|salam|سلام|درود|مرسی|ممنون|دمت گرم|thanks|thank you|ok|اوکی|خوب|عالی)[!. ]*$/

function fallbackPlan(s: string, original: string, ctx: Ctx): ParseResult | null {
  if (CHAT_ONLY.test(s)) return null
  // nothing to edit at all
  if (!ctx.hasImages && !ctx.hasVideos && ctx.clips === 0) return null

  const matched: string[] = ['pro polish pass (best interpretation of your request)']
  const actions: PlanAction[] = []
  const title = extractQuoted(original)

  if (ctx.clips === 0 && (ctx.hasImages || ctx.hasVideos)) {
    // empty timeline → build the full edit with a mood-guessed style
    let style: StyleId = 'cinematic'
    if (/غم|sad|احساسی|عاشقانه/.test(s)) style = 'emotional'
    else if (/تاریک|تیره|dark/.test(s)) style = 'dark'
    else if (/فوتبال|sport|ورزش/.test(s)) style = 'sports'
    else if (/گیم|game/.test(s)) style = 'gaming'
    else if (/سریع|fast|خفن|هیجان|hype/.test(s)) style = 'hype'
    actions.push({ type: 'buildPhotoEdit', style, beatSync: ctx.hasMusic, title: title ?? undefined })
    matched.push(`empty timeline → professional ${style} build`)
  } else {
    // timeline exists → a real professional polish pass, explained honestly
    actions.push({ type: 'addZooms', intensity: 0.55 })
    let grade: GradeId | null = null
    for (const [g, words] of GRADE_WORDS) {
      if (words.some((w) => hit(s, w))) { grade = g; break }
    }
    if (!grade) grade = /غم|sad|احساسی/.test(s) ? 'warm' : /تاریک|dark/.test(s) ? 'dark' : 'cinematic'
    actions.push({ type: 'setColorGrade', grade })
    if (ctx.hasMusic && ctx.bpm) actions.push({ type: 'beatSync', enabled: true })
    actions.push({ type: 'setTransition', style: /سریع|fast|انرژی/.test(s) ? 'whip' : 'dissolve', duration: 0.3 })
    if (title) actions.push({ type: 'addTitle', text: title })
    matched.push(`movement + ${grade} grade + smoother transitions`)
  }
  return { plan: { actions }, matched, fallback: true }
}

function clampT(d: number): number {
  return Math.min(1.2, Math.max(0.08, d))
}
