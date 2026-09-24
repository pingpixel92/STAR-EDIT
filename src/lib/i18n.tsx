// Lightweight i18n with RTL support — EN / FA / RU / ZH
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { kvGet, kvSet } from './db'

export type Lang = 'en' | 'fa' | 'ru' | 'zh'

const en = {
  'app.name': 'STAR EDIT',
  'app.tagline': 'You describe the edit. STAR EDIT creates it.',
  'nav.home': 'Home', 'nav.projects': 'Projects', 'nav.create': 'Create', 'nav.templates': 'Templates', 'nav.settings': 'Settings',
  'hero.title1': 'Your footage.', 'hero.title2': 'Your idea.', 'hero.title3': 'AI does the edit.',
  'hero.sub': 'Turn photos, videos and music into cinematic edits by simply telling STAR EDIT what you want.',
  'hero.cta': 'Start Creating', 'hero.how': 'See How It Works', 'hero.badge': 'Free · Runs in your browser · No upload to servers',
  'how.title': 'How it works', 'how.s1t': 'Upload', 'how.s1d': 'Drop in your photos, videos and music.',
  'how.s2t': 'Describe', 'how.s2d': 'Tell STAR AI exactly what you want.', 'how.s3t': 'Create', 'how.s3d': 'STAR EDIT builds the timeline.',
  'how.s4t': 'Export', 'how.s4d': 'Download your finished video.',
  'feat.title': 'AI features', 'feat.sub': 'A real local editing engine — every operation actually changes the timeline.',
  'demo.title': 'Interactive demo', 'demo.sub': 'Pick a style and watch the local engine build a real timeline in your browser.',
  'tpl.title': 'Starter templates', 'tpl.sub': 'Templates generate real timelines from your media.',
  'pricing.title': 'Simple pricing', 'pricing.free': 'Free forever',
  'pricing.f1': 'Unlimited local projects', 'pricing.f2': 'Local editing engine', 'pricing.f3': 'Photo-to-video generation',
  'pricing.f4': 'Beat synchronization', 'pricing.f5': 'Effects, transitions & color grades', 'pricing.f6': '1080p export where the browser allows',
  'pricing.note': 'Advanced AI understanding is optional: connect your own OpenAI-compatible provider in Settings. Nothing is faked — if a feature is unavailable, STAR EDIT says so.',
  'cta.title': 'Create your first edit', 'cta.sub': 'No account. No server. Your media never leaves your device.',
  'footer.rights': 'All processing happens locally in your browser.',
  'projects.title': 'Your projects', 'projects.new': 'New Project', 'projects.empty': 'No projects yet — create your first edit.',
  'projects.open': 'Open', 'projects.rename': 'Rename', 'projects.duplicate': 'Duplicate', 'projects.delete': 'Delete',
  'projects.exportJson': 'Export JSON', 'projects.importJson': 'Import JSON', 'projects.local': 'Local Project',
  'np.title': 'Create project', 'np.name': 'Project name', 'np.aspect': 'Aspect ratio', 'np.fps': 'Frame rate', 'np.create': 'Create',
  'ed.undo': 'Undo', 'ed.redo': 'Redo', 'ed.versions': 'Versions', 'ed.export': 'Export', 'ed.save': 'Saved locally',
  'ed.media': 'Media', 'ed.preview': 'Preview', 'ed.timeline': 'Timeline', 'ed.ai': 'STAR AI', 'ed.inspector': 'Inspector',
  'ed.drop': 'Drop your media here', 'ed.or': 'or choose files', 'ed.device': 'Import from device',
  'ed.supported': 'MP4 · MOV · WebM · PNG · JPG · GIF · MP3 · WAV · M4A',
  'ed.addAll': 'Add all photos', 'ed.reference': 'Reference', 'ed.referenceHint': 'Reference video: used only for pacing/style analysis, never copied.',
  'ed.analyzing': 'Analyzing…', 'ed.noMedia': 'No media yet. Upload photos and music, then describe your edit.',
  'ed.cmdPlaceholder': 'Tell STAR EDIT what you want to create…',
  'ed.generate': 'Generate Edit', 'ed.send': 'Send', 'ed.mic': 'Speak', 'ed.micOff': 'Speech recognition is not available in this browser.',
  'ed.thinking': 'Analyzing your timeline…', 'ed.beatBadge': 'Beat map', 'ed.bpm': 'BPM',
  'ed.split': 'Split at playhead', 'ed.delete': 'Delete', 'ed.dup': 'Duplicate', 'ed.snap': 'Snap to beats', 'ed.zoom': 'Zoom',
  'ed.motion': 'Motion', 'ed.effects': 'Effects', 'ed.grade': 'Color grade', 'ed.transition': 'Transition in',
  'ed.speed': 'Speed', 'ed.volume': 'Volume', 'ed.fades': 'Fades', 'ed.text': 'Text', 'ed.opacity': 'Opacity',
  'ed.audio': 'Audio', 'ed.timing': 'Timing', 'ed.start': 'Start', 'ed.duration': 'Duration',
  'ex.title': 'Export video', 'ex.res': 'Resolution', 'ex.fps': 'FPS', 'ex.fmt': 'Format', 'ex.q': 'Quality',
  'ex.start': 'Export Video', 'ex.realtime': 'Export renders in real time (~ the length of your timeline). Keep this tab visible.',
  'ex.stages': 'Preparing timeline|Rendering video|Encoding|Finalizing|Complete',
  'ex.done': 'Export complete', 'ex.download': 'Download', 'ex.cancel': 'Cancel', 'ex.close': 'Close',
  'ex.unsupported': 'Your browser does not support in-browser recording. Try Chrome or Edge.',
  'st.title': 'Settings', 'st.appearance': 'Appearance', 'st.lang': 'Language', 'st.defaults': 'Defaults',
  'st.ai': 'AI provider (optional)', 'st.aiHint': 'Connect any OpenAI-compatible API to enhance command understanding. Keys stay in your browser storage and are never sent anywhere except your chosen endpoint.',
  'st.baseUrl': 'Base URL', 'st.model': 'Model', 'st.apiKey': 'API key', 'st.test': 'Test', 'st.enabled': 'Enabled',
  'st.storage': 'Local storage', 'st.clear': 'Clear all data', 'st.shortcuts': 'Keyboard shortcuts', 'st.about': 'About',
  'st.testOk': 'Provider reachable', 'st.testFail': 'Connection failed', 'st.confirmClear': 'Delete ALL local projects and media?',
  'v.title': 'Version history', 'v.restore': 'Restore', 'v.empty': 'No versions yet — every AI edit creates one.',
  'common.close': 'Close', 'common.save': 'Save', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm',
  'ai.localBadge': 'Local engine', 'ai.providerBadge': 'Provider',
  'chat.welcome': 'I build real timelines from plain language. Try: “Make a 15 second cinematic football edit with fast cuts and beat sync.”',
  'chat.noIntent': 'I could not map that to a concrete editing operation. Try commands like: beat sync, cinematic, faster, darker, add zooms, 15 seconds, add title “STAR”, captions, remove audio.',
}
const fa: Partial<Record<keyof typeof en, string>> = {
  'app.tagline': 'شما ادیت رو توصیف می‌کنید. استار ادیت می‌سازدش.',
  'nav.home': 'خانه', 'nav.projects': 'پروژه‌ها', 'nav.create': 'ساخت', 'nav.templates': 'قالب‌ها', 'nav.settings': 'تنظیمات',
  'hero.title1': 'فایل‌های شما.', 'hero.title2': 'ایده‌ی شما.', 'hero.title3': 'هوش مصنوعی ادیت می‌کند.',
  'hero.sub': 'عکس، ویدیو و موسیقی‌ات را به ادیت سینمایی تبدیل کن؛ فقط کافیست به STAR EDIT بگویی چه می‌خواهی.',
  'hero.cta': 'شروع ساخت', 'hero.how': 'چطور کار می‌کند؟', 'hero.badge': 'رایگان · داخل مرورگر شما · بدون آپلود به سرور',
  'how.title': 'چطور کار می‌کند', 'how.s1t': 'آپلود', 'how.s1d': 'عکس‌ها، ویدیوها و موسیقی‌ات را بگذار.',
  'how.s2t': 'توصیف', 'how.s2d': 'دقیق بگو STAR AI چه می‌خواهی.', 'how.s3t': 'ساخت', 'how.s3d': 'استار ادیت تایم‌لاین را می‌سازد.',
  'how.s4t': 'خروجی', 'how.s4d': 'ویدیوی نهایی را دانلود کن.',
  'feat.title': 'قابلیت‌های هوش مصنوعی', 'feat.sub': 'موتور ادیت واقعی محلی — هر عملیات واقعاً تایم‌لاین را تغییر می‌دهد.',
  'demo.title': 'دموی تعاملی', 'demo.sub': 'یک سبک انتخاب کن و ببین موتور محلی چطور در مرورگرِ شما تایم‌لاین واقعی می‌سازد.',
  'tpl.title': 'قالب‌های آماده', 'tpl.sub': 'قالب‌ها از مدیای شما تایم‌لاین واقعی می‌سازند.',
  'pricing.title': 'قیمت‌گذاری ساده', 'pricing.free': 'برای همیشه رایگان',
  'pricing.f1': 'پروژه‌های محلی نامحدود', 'pricing.f2': 'موتور ادیت محلی', 'pricing.f3': 'تبدیل عکس به ویدیو',
  'pricing.f4': 'همگام‌سازی با بیت', 'pricing.f5': 'افکت، ترنزیشن و رنگ‌بندی', 'pricing.f6': 'خروجی 1080p در صورت پشتیبانی مرورگر',
  'pricing.note': 'درک پیشرفته‌ی هوش مصنوعی اختیاری است: در تنظیمات، سرویسِ سازگار با OpenAI خودت را وصل کن. هیچ چیزی جعل نمی‌شود — اگر قابلیتی در دسترس نباشد، STAR EDIT صادقانه می‌گوید.',
  'cta.title': 'اولین ادیتت را بساز', 'cta.sub': 'بدون ثبت‌نام. بدون سرور. مدیای شما هرگز دستگاهتان را ترک نمی‌کند.',
  'footer.rights': 'تمام پردازش‌ها محلی و داخل مرورگر شما انجام می‌شود.',
  'projects.title': 'پروژه‌های شما', 'projects.new': 'پروژه جدید', 'projects.empty': 'هنوز پروژه‌ای نداری — اولین ادیتت را بساز.',
  'projects.open': 'باز کردن', 'projects.rename': 'تغییر نام', 'projects.duplicate': 'کپی', 'projects.delete': 'حذف',
  'projects.exportJson': 'خروجی JSON', 'projects.importJson': 'ورود JSON', 'projects.local': 'پروژه محلی',
  'np.title': 'ساخت پروژه', 'np.name': 'نام پروژه', 'np.aspect': 'نسبت تصویر', 'np.fps': 'فریم‌ریت', 'np.create': 'ساخت',
  'ed.undo': 'واگرد', 'ed.redo': 'ازنو', 'ed.versions': 'نسخه‌ها', 'ed.export': 'خروجی', 'ed.save': 'ذخیره شد',
  'ed.media': 'مدیا', 'ed.preview': 'پیش‌نمایش', 'ed.timeline': 'تایم‌لاین', 'ed.ai': 'STAR AI', 'ed.inspector': 'اینسپکتور',
  'ed.drop': 'مدیای خود را اینجا رها کنید', 'ed.or': 'یا انتخاب فایل', 'ed.device': 'وارد کردن از دستگاه',
  'ed.supported': 'MP4 · MOV · WebM · PNG · JPG · GIF · MP3 · WAV · M4A',
  'ed.addAll': 'افزودن همه‌ی عکس‌ها', 'ed.reference': 'مرجع', 'ed.referenceHint': 'ویدیوی مرجع: فقط برای تحلیل ریتم و سبک استفاده می‌شود، هرگز کپی نمی‌شود.',
  'ed.analyzing': 'در حال تحلیل…', 'ed.noMedia': 'هنوز مدیایی نیست. عکس و موسیقی آپلود کن و بعد ادیت را توصیف کن.',
  'ed.cmdPlaceholder': 'بگو STAR EDIT چه چیزی بسازد…',
  'ed.generate': 'ساخت ادیت', 'ed.send': 'ارسال', 'ed.mic': 'گفتار', 'ed.micOff': 'تشخیص گفتار در این مرورگر موجود نیست.',
  'ed.thinking': 'در حال تحلیل تایم‌لاین شما…', 'ed.beatBadge': 'نقشه‌ی بیت', 'ed.bpm': 'بیت بر دقیقه',
  'ed.split': 'برش در نشانگر', 'ed.delete': 'حذف', 'ed.dup': 'کپی', 'ed.snap': 'چسبیدن به بیت‌ها', 'ed.zoom': 'بزرگ‌نمایی',
  'ed.motion': 'حرکت', 'ed.effects': 'افکت‌ها', 'ed.grade': 'رنگ‌بندی', 'ed.transition': 'ترنزیشن ورودی',
  'ed.speed': 'سرعت', 'ed.volume': 'صدا', 'ed.fades': 'محو شدن', 'ed.text': 'متن', 'ed.opacity': 'شفافیت',
  'ed.audio': 'صدا', 'ed.timing': 'زمان‌بندی', 'ed.start': 'شروع', 'ed.duration': 'مدت',
  'ex.title': 'خروجی ویدیو', 'ex.res': 'رزولوشن', 'ex.fps': 'FPS', 'ex.fmt': 'فرمت', 'ex.q': 'کیفیت',
  'ex.start': 'ساخت خروجی', 'ex.realtime': 'خروجی به‌صورت بلادرنگ ساخته می‌شود (~به طول تایم‌لاین شما). این تب را باز نگه دارید.',
  'ex.done': 'خروجی کامل شد', 'ex.download': 'دانلود', 'ex.cancel': 'لغو', 'ex.close': 'بستن',
  'ex.unsupported': 'مرورگر شما از ضبط داخلی پشتیبانی نمی‌کند. کروم یا اج را امتحان کنید.',
  'st.title': 'تنظیمات', 'st.appearance': 'ظاهر', 'st.lang': 'زبان', 'st.defaults': 'پیش‌فرض‌ها',
  'st.ai': 'سرویس هوش مصنوعی (اختیاری)', 'st.aiHint': 'هر API سازگار با OpenAI را وصل کن تا درک دستورها بهتر شود. کلید فقط در مرورگر شما می‌ماند.',
  'st.baseUrl': 'آدرس پایه', 'st.model': 'مدل', 'st.apiKey': 'کلید API', 'st.test': 'تست', 'st.enabled': 'فعال',
  'st.storage': 'حافظه‌ی محلی', 'st.clear': 'پاک کردن همه‌ی داده‌ها', 'st.shortcuts': 'میان‌برهای کیبورد', 'st.about': 'درباره',
  'st.testOk': 'سرویس در دسترس است', 'st.testFail': 'اتصال ناموفق', 'st.confirmClear': 'همه‌ی پروژه‌ها و مدیاها حذف شود؟',
  'v.title': 'تاریخچه‌ی نسخه‌ها', 'v.restore': 'بازگردانی', 'v.empty': 'هنوز نسخه‌ای نیست — هر ادیت AI یک نسخه می‌سازد.',
  'common.close': 'بستن', 'common.save': 'ذخیره', 'common.cancel': 'لغو', 'common.confirm': 'تأیید',
  'ai.localBadge': 'موتور محلی', 'ai.providerBadge': 'سرویس',
  'chat.welcome': 'من از زبان ساده، تایم‌لاین واقعی می‌سازم. امتحان کن: «یک ادیت سینمایی فوتبالی ۱۵ ثانیه‌ای با برش سریع و سینک بیت بساز.»',
  'chat.noIntent': 'نتوانستم این را به یک عملیات ادیت مشخص تبدیل کنم. مثلاً بگو: سینک بیت، سینمایی، سریع‌تر، تیره‌تر، زوم اضافه کن، ۱۵ ثانیه، عنوان «استار»، زیرنویس، حذف صدا.',
}
const ru: Partial<Record<keyof typeof en, string>> = {
  'app.tagline': 'Вы описываете монтаж. STAR EDIT создаёт его.',
  'nav.home': 'Главная', 'nav.projects': 'Проекты', 'nav.create': 'Создать', 'nav.templates': 'Шаблоны', 'nav.settings': 'Настройки',
  'hero.title1': 'Ваши кадры.', 'hero.title2': 'Ваша идея.', 'hero.title3': 'ИИ монтирует.',
  'hero.sub': 'Превратите фото, видео и музыку в кинематографичный монтаж — просто скажите STAR EDIT, что вы хотите.',
  'hero.cta': 'Начать', 'hero.how': 'Как это работает',
  'how.title': 'Как это работает', 'how.s1t': 'Загрузка', 'how.s1d': 'Добавьте фото, видео и музыку.',
  'how.s2t': 'Опишите', 'how.s2d': 'Скажите STAR AI, что нужно.', 'how.s3t': 'Создание', 'how.s3d': 'STAR EDIT строит таймлайн.',
  'how.s4t': 'Экспорт', 'how.s4d': 'Скачайте готовое видео.',
  'feat.title': 'Возможности ИИ', 'demo.title': 'Интерактивное демо',
  'pricing.title': 'Простые цены', 'pricing.free': 'Бесплатно навсегда',
  'cta.title': 'Создайте первый монтаж', 'cta.sub': 'Без аккаунта. Без сервера. Медиа не покидает устройство.',
  'projects.title': 'Ваши проекты', 'projects.new': 'Новый проект',
  'ed.media': 'Медиа', 'ed.preview': 'Просмотр', 'ed.timeline': 'Таймлайн', 'ed.ai': 'STAR AI', 'ed.inspector': 'Инспектор',
  'ed.drop': 'Перетащите медиа сюда', 'ed.or': 'или выберите файлы', 'ed.device': 'Импорт с устройства',
  'ed.generate': 'Создать монтаж', 'ex.title': 'Экспорт видео', 'ex.start': 'Экспортировать', 'st.title': 'Настройки', 'st.lang': 'Язык',
  'chat.welcome': 'Я строю реальные таймлайны из простого языка. Попробуйте: «Сделай 15-секундный кинематографичный монтаж с бит-синком.»',
}
const zh: Partial<Record<keyof typeof en, string>> = {
  'app.tagline': '你描述剪辑，STAR EDIT 来实现。',
  'nav.home': '首页', 'nav.projects': '项目', 'nav.create': '创建', 'nav.templates': '模板', 'nav.settings': '设置',
  'hero.title1': '你的素材。', 'hero.title2': '你的想法。', 'hero.title3': 'AI 来剪辑。',
  'hero.sub': '只需告诉 STAR EDIT 你想要什么，即可把照片、视频和音乐变成电影级剪辑。',
  'hero.cta': '开始创作', 'hero.how': '工作原理',
  'how.title': '工作原理', 'how.s1t': '上传', 'how.s1d': '放入照片、视频和音乐。',
  'how.s2t': '描述', 'how.s2d': '告诉 STAR AI 你想要的效果。', 'how.s3t': '生成', 'how.s3d': 'STAR EDIT 构建时间线。',
  'how.s4t': '导出', 'how.s4d': '下载成品视频。',
  'feat.title': 'AI 功能', 'demo.title': '交互演示',
  'pricing.title': '简单定价', 'pricing.free': '永久免费',
  'cta.title': '创建你的第一个剪辑', 'cta.sub': '无需账号。无需服务器。素材永不离开设备。',
  'projects.title': '你的项目', 'projects.new': '新建项目',
  'ed.media': '媒体', 'ed.preview': '预览', 'ed.timeline': '时间线', 'ed.ai': 'STAR AI', 'ed.inspector': '检查器',
  'ed.drop': '将媒体拖到这里', 'ed.or': '或选择文件', 'ed.device': '从设备导入',
  'ed.generate': '生成剪辑', 'ex.title': '导出视频', 'ex.start': '开始导出', 'st.title': '设置', 'st.lang': '语言',
  'chat.welcome': '我用自然语言构建真实时间线。试试：“做一个15秒电影感的足球混剪，卡点节拍。”',
}

const DICTS: Record<Lang, Partial<Record<string, string>>> = { en, fa, ru, zh }
export const LANGS: { id: Lang; label: string; rtl: boolean }[] = [
  { id: 'en', label: 'English', rtl: false },
  { id: 'fa', label: 'فارسی', rtl: true },
  { id: 'ru', label: 'Русский', rtl: false },
  { id: 'zh', label: '中文', rtl: false },
]

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof en | string) => string; rtl: boolean }
const Ctx = createContext<I18nCtx>({ lang: 'en', setLang: () => {}, t: (k) => String(k), rtl: false })

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  useEffect(() => {
    kvGet<Lang>('lang').then((l) => {
      if (l && LANGS.some((x) => x.id === l)) setLangState(l)
      else if (navigator.language?.startsWith('fa')) setLangState('fa')
    })
  }, [])
  useEffect(() => {
    const rtl = LANGS.find((l) => l.id === lang)?.rtl ?? false
    document.documentElement.lang = lang
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
  }, [lang])
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      rtl: LANGS.find((l) => l.id === lang)?.rtl ?? false,
      setLang: (l) => {
        setLangState(l)
        void kvSet('lang', l)
      },
      t: (k) => DICTS[lang]?.[k as string] ?? en[k as keyof typeof en] ?? String(k),
    }),
    [lang]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
