// First-run guided tour for the editor — 5 steps, 4 languages, shown once (kv 'tourDone')
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, Download, Image as ImageIcon, MessageSquare, Scissors, Sparkles } from 'lucide-react'
import { useI18n, type Lang } from '../../lib/i18n'
import { kvGet, kvSet } from '../../lib/db'

interface Step {
  t: string
  d: string
  icon: 'media' | 'cmd' | 'timeline' | 'export'
}

const CONTENT: Record<Lang, { title: string; skip: string; back: string; next: string; start: string; steps: Step[] }> = {
  en: {
    title: 'Welcome to STAR EDIT',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    start: 'Start editing',
    steps: [
      { icon: 'media', t: '1 · Upload media', d: 'Use the Media panel on the left: drop photos / video clips and one music track. Your music is analyzed automatically — BPM, beats and drops appear in the beat map card.' },
      { icon: 'cmd', t: '2 · Describe your edit', d: 'Type what you want in the command bar above the preview (or in the STAR AI chat): "Make a 15 second cinematic football edit, sync every cut to the beat". The AI builds the real timeline.' },
      { icon: 'timeline', t: '3 · Tweak anything', d: 'Every AI change lands on the actual timeline — drag clips, trim edges, split with S, and fine-tune motion, effects, grades and text in the Inspector. Ctrl+Z undoes anything.' },
      { icon: 'export', t: '4 · Export for real', d: 'Press Export: the video renders in real time (a 15s edit ≈ 15s) and downloads as MP4 or WebM. Nothing is faked — the progress bar is the real render.' },
    ],
  },
  fa: {
    title: 'به STAR EDIT خوش آمدی',
    skip: 'رد شدن',
    back: 'قبلی',
    next: 'بعدی',
    start: 'شروع ادیت',
    steps: [
      { icon: 'media', t: '۱ · مدیا را آپلود کن', d: 'از پنل مدیا در سمت چپ استفاده کن: عکس/کلیپ ویدیویی و یک موسیقی رها کن. موسیقی‌ات خودکار تحلیل می‌شود — BPM، بیت‌ها و دراپ‌ها در کارت نقشه‌ی بیت ظاهر می‌شوند.' },
      { icon: 'cmd', t: '۲ · ادیت را توصیف کن', d: 'در نوار فرمان بالای پیش‌نمایش (یا در چت STAR AI) بنویس چه می‌خواهی: «یک ادیت سینمایی فوتبالی ۱۵ ثانیه‌ای بساز، هر برش روی بیت باشد». هوش مصنوعی تایم‌لاین واقعی را می‌سازد.' },
      { icon: 'timeline', t: '۳ · هر چه می‌خواهی تنظیم کن', d: 'هر تغییر AI روی تایم‌لاین واقعی می‌نشیند — کلیپ‌ها را بکش، لبه‌ها را کوتاه کن، با S برش بزن و در اینسپکتور حرکت، افکت، رنگ و متن را دقیق کن. با Ctrl+Z همه‌چیز قابل واگرد است.' },
      { icon: 'export', t: '۴ · خروجی واقعی بگیر', d: 'خروجی را بزن: ویدیو بلادرنگ رندر می‌شود (ادیت ۱۵ ثانیه‌ای ≈ ۱۵ ثانیه) و به‌صورت MP4 یا WebM دانلود می‌شود. هیچ چیزی جعلی نیست — نوار پیشرفت، رندر واقعی است.' },
    ],
  },
  ru: {
    title: 'Добро пожаловать в STAR EDIT',
    skip: 'Пропустить',
    back: 'Назад',
    next: 'Далее',
    start: 'Начать монтаж',
    steps: [
      { icon: 'media', t: '1 · Загрузите медиа', d: 'Используйте панель «Медиа» слева: добавьте фото/видео и одну музыку. Музыка анализируется автоматически — BPM, биты и дропы появятся в карте битов.' },
      { icon: 'cmd', t: '2 · Опишите монтаж', d: 'Напишите в командной строке над превью (или в чате STAR AI): «Сделай 15-секундный кинематографичный футбольный монтаж, каждая склейка на бите». ИИ соберёт настоящий таймлайн.' },
      { icon: 'timeline', t: '3 · Подправьте что угодно', d: 'Каждое изменение ИИ попадает на реальный таймлайн — двигайте клипы, подрезайте края, режьте клавишей S, настраивайте движение, эффекты, цвет и текст в Инспекторе. Ctrl+Z отменяет всё.' },
      { icon: 'export', t: '4 · Реальный экспорт', d: 'Нажмите «Экспорт»: видео рендерится в реальном времени (15-секундный монтаж ≈ 15 секунд) и скачивается как MP4 или WebM. Ничего не подделывается — прогресс это настоящий рендер.' },
    ],
  },
  zh: {
    title: '欢迎使用 STAR EDIT',
    skip: '跳过',
    back: '上一步',
    next: '下一步',
    start: '开始剪辑',
    steps: [
      { icon: 'media', t: '1 · 上传素材', d: '使用左侧媒体面板：拖入照片/视频和一首音乐。音乐会自动分析——BPM、节拍和 drop 会出现在节拍图卡片中。' },
      { icon: 'cmd', t: '2 · 描述你的剪辑', d: '在预览上方的命令栏（或 STAR AI 聊天）输入你想要的效果：“做一个15秒电影感足球混剪，每个剪切都卡在节拍上”。AI 会构建真实时间线。' },
      { icon: 'timeline', t: '3 · 随意微调', d: 'AI 的每次修改都落在真实时间线上——拖动片段、拖边裁剪、按 S 剪切，在检查器里调整运动、特效、调色和文字。Ctrl+Z 可撤销一切。' },
      { icon: 'export', t: '4 · 真实导出', d: '点击导出：视频实时渲染（15 秒剪辑 ≈ 15 秒）并下载为 MP4 或 WebM。没有造假——进度条就是真实渲染。' },
    ],
  },
}

const ICONS = {
  media: ImageIcon,
  cmd: MessageSquare,
  timeline: Scissors,
  export: Download,
}

export default function Tour() {
  const { lang } = useI18n()
  const c = CONTENT[lang] ?? CONTENT.en
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    kvGet<boolean>('tourDone').then((done) => {
      if (!done) setOpen(true)
    })
    // the toolbar help button re-opens the tour
    const fn = () => {
      setI(0)
      setOpen(true)
    }
    window.addEventListener('star-tour', fn)
    return () => window.removeEventListener('star-tour', fn)
  }, [])

  const close = () => {
    setOpen(false)
    void kvSet('tourDone', true)
  }

  const step = c.steps[i]
  const Icon = ICONS[step.icon]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={c.title}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-star-500/25 bg-star-500/10">
                <Icon size={18} className="text-star-300" />
              </span>
              <h3 className="text-[15px] font-extrabold">{step.t}</h3>
              <span className="tnum ms-auto text-[11px] text-zinc-500">{i + 1}/{c.steps.length}</span>
            </div>
            <p className="mt-3.5 min-h-[72px] text-[13.5px] leading-relaxed text-zinc-300">{step.d}</p>
            <div className="mt-4 flex items-center gap-1.5">
              {c.steps.map((_, k) => (
                <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-star-400' : 'w-1.5 bg-white/15'}`} />
              ))}
              <div className="ms-auto flex items-center gap-2">
                <button className="btn-ghost !px-3 !py-1.5 !text-[12px] !border-transparent !bg-transparent !text-zinc-500 hover:!text-zinc-300" onClick={close}>
                  {c.skip}
                </button>
                {i > 0 && (
                  <button className="btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={() => setI(i - 1)}>
                    <ChevronLeft size={13} className="rtl:rotate-180" /> {c.back}
                  </button>
                )}
                {i < c.steps.length - 1 ? (
                  <button className="btn-accent !px-4 !py-1.5 !text-[12px]" onClick={() => setI(i + 1)}>
                    {c.next} <ArrowRight size={12} className="rtl:rotate-180" />
                  </button>
                ) : (
                  <button className="btn-accent !px-4 !py-1.5 !text-[12px]" onClick={close}>
                    <Sparkles size={12} /> {c.start}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
