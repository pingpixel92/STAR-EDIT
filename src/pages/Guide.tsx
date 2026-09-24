// /guide — full user manual, 4 languages, honest & practical
import { useState } from 'react'
import { ArrowRight, BookOpen, Check, ChevronDown, Copy, Keyboard, LifeBuoy, ListOrdered, MessageSquare, Music, Play, Scissors, Sparkles, Upload } from 'lucide-react'
import { LogoWord } from '../components/Logo'
import { navigate } from '../App'
import { LANGS, useI18n, type Lang } from '../lib/i18n'

interface GuideContent {
  title: string
  sub: string
  cta: string
  stepsTitle: string
  steps: { t: string; d: string }[]
  cmdTitle: string
  cmdSub: string
  commands: string[]
  panelsTitle: string
  panels: { t: string; d: string }[]
  beatTitle: string
  beat: string[]
  exportTitle: string
  exportTips: string[]
  trTitle: string
  tr: { q: string; a: string }[]
}

const EN: GuideContent = {
  title: 'How to use STAR EDIT',
  sub: 'From photos and a song to a finished video in about two minutes. This guide covers everything — the 5-step workflow, the commands the AI really understands, and every panel in the editor.',
  cta: 'Create a project',
  stepsTitle: 'Quick start — 5 steps',
  steps: [
    { t: 'Create a project', d: 'Click "New Project", give it a name and pick the aspect ratio: 9:16 for TikTok/Reels/Shorts, 16:9 for YouTube, 1:1 or 4:5 for Instagram posts. 30 fps is right for almost everything.' },
    { t: 'Upload your media', d: 'In the Media panel (left side), drop in 5–20 photos or a few video clips, plus one music track (MP3/WAV). The moment your music lands, STAR EDIT analyzes it and shows a beat map: detected BPM, beat count and an honest confidence score.' },
    { t: 'Describe the edit', d: 'Click the command bar above the preview and type what you want, e.g. "Make a 15 second cinematic football edit, sync every cut to the beat, title \"MATCH DAY\"". Press Enter. You can also type directly into the STAR AI chat panel on the right.' },
    { t: 'Tweak anything', d: 'The AI edits the real timeline — you will see clips appear and move. Select any clip to fine-tune motion, effects, color grade, transitions, speed, volume and text in the Inspector. Drag clips, trim edges, split with S, undo with Ctrl+Z. Every AI run also creates a version you can restore from the Versions dialog.' },
    { t: 'Export & download', d: 'Press Export, choose resolution (720p–1440p), format and quality. The video renders in real time — a 15s edit takes ~15s — then downloads automatically as MP4 (or WebM if your browser cannot produce MP4).' },
  ],
  cmdTitle: 'Commands the AI actually understands',
  cmdSub: 'Mix and match these. The local engine reads plain English and Persian; the optional provider (Settings → AI provider) understands richer phrasing. If a command cannot be mapped to a real operation, STAR AI says so instead of faking something.',
  commands: [
    'Make a 15 second cinematic football edit, sync every cut to the beat, title "MATCH DAY"',
    'Turn these photos into a 20 second emotional reel with slow zooms',
    'Make it darker and add dramatic zooms',
    'Sync the cuts to the beat',
    'Add bold captions "STAR EDIT"',
    'Add a lower third "by STAR EDIT"',
    'Keep only the best 20 seconds',
    'Remove the first 3 seconds',
    'Make it faster / slow motion',
    'Flash transitions',
    'Black and white / vintage / vibrant look',
    'Set volume to 80% and fade out',
    'Create a 9:16 version',
    'Like the reference video',
    'Convert the song to text — synced lyric captions',
    'Match the music to my video',
    'Convert to TikTok format (smart reframe keeps the subject)',
    'Add a title "GOAL" with font Anton',
    'Add a speed ramp',
    'Add cinematic bars / light leak',
    'Add an outro end card',
  ],
  panelsTitle: 'Know the editor',
  panels: [
    { t: 'Media (left panel)', d: 'Drop zone for photos, videos and music. Each thumbnail is clickable — it adds that asset to the timeline. The beat map card shows your analyzed music: BPM, beat count, confidence and drops (red marks), plus the “Lyrics → synced captions” button that transcribes vocals on-device. "Add reference video" imports a clip that is only measured for pacing and tone — it is never copied into your edit.' },
    { t: 'Command bar + Preview (center)', d: 'The bar above the canvas is the fastest way to give orders. The canvas plays your real timeline; click it to play/pause. Under it: jump-to-start and play/pause plus the time counter.' },
    { t: 'Timeline (bottom)', d: 'Three tracks: Video, Music, Text & Captions. Drag clips to move them, drag the edges to trim, use the magnet button to snap to beats, zoom with the +/− buttons. The purple line is the playhead. S splits clips at the playhead.' },
    { t: 'STAR AI chat (right)', d: 'A chat view of the same engine. It lists exactly what it did after every command ("Synced 9 cuts to detected beats (110 BPM, confidence 71%)") so you always know what changed — and you can undo it.' },
    { t: 'Inspector (right tab)', d: 'Select a clip and fine-tune it: motion type and intensity (Ken Burns, zooms, pans, punch), 12 real effects (incl. cinematic bars and light leak), 9 color grades, transition style and length, opacity, audio, playback speed, Reframe (smart focal crop or blurred pad for aspect conversion, with manual focal sliders) and text properties — including any Google Font or your own uploaded font file.' },
    { t: 'Export / Versions / Settings (top right)', d: 'Export renders a real file. Versions stores a snapshot after every AI edit — restore any of them. Settings holds language (English, فارسی, Русский, 中文), the optional AI provider, storage usage and keyboard shortcuts.' },
  ],
  beatTitle: 'Beat sync — how it works',
  beat: [
    'Upload one music track. Analysis starts automatically: STAR EDIT detects onsets (energy jumps), estimates BPM by autocorrelation and finds drops (strong energy hits).',
    'The beat map card shows the result with a confidence percentage. Below ~55% the map is marked "approximate" — trust it less for tight sync.',
    'Ask "sync every cut to the beat" (or build a new edit with beat sync) — cut boundaries move onto detected beats and the strongest photo lands on the first drop.',
    'You can always re-snap later with the magnet tool or the "Sync the cuts to the beat" command. Beat detection is approximate by nature — it is honest about that.',
  ],
  exportTitle: 'Exporting without surprises',
  exportTips: [
    'Rendering happens in real time in your browser: a 20s timeline needs ~20s. Keep the tab visible or rendering may pause.',
    'MP4 is offered when the browser supports it (Chrome/Edge usually do). Otherwise you get high-quality WebM — every platform accepts it; convert locally if you truly need MP4.',
    'Export resolution is independent of your project canvas — the renderer scales your media to fit. 1080p is the sweet spot; 1440p works but takes more memory.',
    'Draft/Standard/High only change the bitrate (file size vs. crispness). For social media, 1080p Standard is perfect.',
    'Nothing is uploaded during export — the file is built on your device and saved by your browser directly.',
  ],
  trTitle: 'Troubleshooting',
  tr: [
    { q: 'I gave a vague command — will it refuse?', a: 'No. If your sentence has no exact operation, STAR AI says so, then applies an honest "professional polish pass" (movement + grade + smoother transitions) instead of doing nothing — one Ctrl+Z takes it back if that is not what you meant.' },
    { q: 'The lyric captions are missing or wrong', a: 'Transcription is real Whisper speech recognition running in your browser: the first run downloads a ~40–80 MB model (cached afterwards), and it needs a few seconds per minute of audio. Instrumental or very noisy tracks may produce few or no lines — that is reported honestly, never faked.' },
    { q: 'I converted 16:9 to 9:16 and the subject was cut', a: 'Every aspect change now applies smart reframe: the crop follows the analyzed subject, or pick “Blurred pad” in the Inspector → Reframe for the full-frame-with-blur-bars look. Fine-tune with the Focal X/Y sliders.' },
    { q: 'Export produced a WebM but I want MP4', a: 'Your browser cannot encode MP4 in-browser (common on Safari/Linux). Chrome and Edge usually can. WebM plays everywhere modern — WhatsApp, Instagram and editors all accept it.' },
    { q: 'Playback stutters with big videos', a: 'Video clips are decoded live. Use shorter/smaller source clips, or close other tabs. Photos always play smoothly.' },
    { q: 'Beat detection looks wrong', a: 'Quiet or live-recorded music is hard to analyze. The confidence % tells you how much to trust it. You can still sync manually with the magnet tool.' },
    { q: 'I lost my project', a: 'Projects live in the browser\'s IndexedDB under this site. Do not clear site data / "Clear browsing data" for this origin, or projects and media are gone. Use Export JSON on the Projects page to back up the timeline structure.' },
    { q: 'Persian text in titles renders oddly', a: 'Titles auto-detect RTL text. If a mixed string looks off, keep the title purely Persian or purely Latin.' },
  ],
}

const FA: GuideContent = {
  title: 'آموزش استفاده از STAR EDIT',
  sub: 'از عکس و موسیقی تا ویدیوی آماده در حدود دو دقیقه. این راهنما همه‌چیز را پوشش می‌دهد: گردش‌کار ۵ مرحله‌ای، دستورهایی که هوش مصنوعی واقعاً می‌فهمد، و معرفی تمام پنل‌های ادیتور.',
  cta: 'ساخت پروژه',
  stepsTitle: 'شروع سریع — ۵ مرحله',
  steps: [
    { t: 'پروژه بساز', d: 'روی «پروژه جدید» بزن، یک اسم بنویس و نسبت تصویر را انتخاب کن: ۹:۱۶ برای تیک‌تاک/ریلز/شورتز، ۱۶:۹ برای یوتیوب، ۱:۱ یا ۴:۵ برای پست اینستاگرام. فریم‌ریت ۳۰ تقریباً برای همه‌چیز مناسب است.' },
    { t: 'مدیایت را آپلود کن', d: 'در پنل مدیا (سمت چپ) بین ۵ تا ۲۰ عکس یا چند کلیپ ویدیویی به‌همراه یک موسیقی (MP3/WAV) رها کن. به محض ورود موسیقی، STAR EDIT آن را تحلیل می‌کند و نقشه‌ی بیت را نشان می‌دهد: BPM شناسایی‌شده، تعداد بیت‌ها و درصد اطمینان صادقانه.' },
    { t: 'ادیت را توصیف کن', d: 'روی نوار فرمان بالای پیش‌نمایش بزن و بنویس چه می‌خواهی؛ مثلاً: «یک ادیت سینمایی فوتبالی ۱۵ ثانیه‌ای بساز، هر برش روی بیت باشد، عنوان MATCH DAY». اینتر بزن. می‌توانی مستقیم در چت STAR AI سمت راست هم تایپ کنی.' },
    { t: 'هر چه می‌خواهی دست‌کاری کن', d: 'هوش مصنوعی تایم‌لاین واقعی را ویرایش می‌کند — کلیپ‌ها را می‌بینی که ساخته و جابه‌جا می‌شوند. هر کلیپ را انتخاب کن تا در اینسپکتور حرکت، افکت، رنگ‌بندی، ترنزیشن، سرعت، صدا و متنش را دقیق تنظیم کنی. با S برش بزن، با Ctrl+Z واگرد کن. هر اجرای AI هم یک نسخه می‌سازد که از پنجره‌ی نسخه‌ها قابل بازگردانی است.' },
    { t: 'خروجی بگیر و دانلود کن', d: 'خروجی را بزن، رزولوشن (720p تا 1440p)، فرمت و کیفیت را انتخاب کن. ویدیو بلادرنگ رندر می‌شود — ادیت ۱۵ ثانیه‌ای حدود ۱۵ ثانیه — و بعد خودکار به‌صورت MP4 (یا WebM اگر مرورگر MP4 نداد) دانلود می‌شود.' },
  ],
  cmdTitle: 'دستورهایی که هوش مصنوعی واقعاً می‌فهمد',
  cmdSub: 'این‌ها را با هم ترکیب کن. موتور محلی، انگلیسی و فارسیِ ساده را می‌خواند؛ سرویس اختیاری (تنظیمات ← سرویس AI) جمله‌های غنی‌تر را هم می‌فهمد. اگر دستور به عملیات واقعی تبدیل نشود، STAR AI همان را صادقانه می‌گوید و چیزی را جعل نمی‌کند.',
  commands: [
    'یک ادیت سینمایی فوتبالی ۱۵ ثانیه‌ای بساز، هر برش روی بیت باشد، عنوان «MATCH DAY»',
    'این عکس‌ها را به یک ریل احساسی ۲۰ ثانیه‌ای با زوم آهسته تبدیل کن',
    'تیره‌ترش کن و زوم‌های دراماتیک اضافه کن',
    'برش‌ها را روی بیت سینک کن',
    'کپشن بولد «STAR EDIT» اضافه کن',
    'لوئر ثرد «ساخته شده با STAR EDIT» اضافه کن',
    'فقط بهترین ۲۰ ثانیه را نگه دار',
    '۳ ثانیه‌ی اول را حذف کن',
    'سریع‌ترش کن / اسلوموشن کن',
    'ترنزیشن فلاش',
    'سیاه‌وسفید / نوستالژی / پررنگ',
    'صدا را ۸۰٪ کن و در انتها محو کن',
    'نسخه‌ی ۹:۱۶ بساز',
    'مثل ویدیوی مرجع',
    'آهنگ رو تبدیل به متن کن — کپشن همزمان با خواننده',
    'آهنگ رو به ویدیو مچ کن',
    'تبدیل به فرمت تیک‌تاک (قاب‌بندی هوشمند که سوژه نمی‌افتد)',
    'عنوان «گل» با فونت لاله‌زار اضافه کن',
    'اسپید رمپ اضافه کن (تند و کند)',
    'نوار سینمایی / نشت نور اضافه کن',
    'اوترو (کارت پایان) اضافه کن',
  ],
  panelsTitle: 'با ادیتور آشنا شو',
  panels: [
    { t: 'مدیا (پنل چپ)', d: 'محل رها کردن عکس، ویدیو و موسیقی. هر تصویر بندانگشتی کلیک‌پذیر است — همان فایل را به تایم‌لاین اضافه می‌کند. کارت نقشه‌ی بیت موسیقی تحلیل‌شده را نشان می‌دهد: BPM، تعداد بیت، اطمینان و دراپ‌ها (نشان‌های قرمز) و دکمه‌ی «متن آهنگ → کپشن همزمان» که خواننده را روی خود دستگاه تبدیل به متن می‌کند. «افزودن ویدیوی مرجع» کلیپی را وارد می‌کند که فقط برای سنجش ریتم و رنگ اندازه‌گیری می‌شود — هرگز داخل ادیت شما کپی نمی‌شود.' },
    { t: 'نوار فرمان + پیش‌نمایش (وسط)', d: 'نوار بالای بوم سریع‌ترین راه فرمان دادن است. بوم، تایم‌لاین واقعی شما را پخش می‌کند؛ برای پخش/توقف رویش کلیک کن. زیرش: پرش به ابتدا، پخش/توقف و شمارنده‌ی زمان.' },
    { t: 'تایم‌لاین (پایین)', d: 'سه ترک: Video، Music و Text & Captions. کلیپ‌ها را بکش تا جابه‌جا شوند، لبه‌ها را بکش تا برش بخورند، با دکمه‌ی آهن‌ربا به بیت‌ها بچسبان و با +/− زوم کن. خط بنفش، نشانگر پخش است. کلید S در محل نشانگر برش می‌زند.' },
    { t: 'چت STAR AI (راست)', d: 'همان موتور، با چهره‌ی چت. بعد از هر دستور دقیقاً می‌گوید چه کرد («۹ برش روی بیت‌های شناسایی‌شده سینک شد (۱۱۰ BPM، اطمینان ۷۱٪)») تا همیشه بدانی چه چیزی عوض شده — و بتوانی واگرد کنی.' },
    { t: 'اینسپکتور (تب راست)', d: 'کلیپ را انتخاب و دقیق تنظیم کن: نوع و شدت حرکت (Ken Burns، زوم، پن، پانچ)، ۱۲ افکت واقعی (نوار سینمایی و نشت نور هم اضافه شد)، ۹ رنگ‌بندی، سبک و طول ترنزیشن، شفافیت، صدا، سرعت پخش، قاب‌بندی هوشمند (برش روی سوژه یا پس‌زمینه‌ی بلور برای تبدیل نسبت تصویر، با اسلایدر فوکوس دستی) و ویژگی‌های متن — با هر فونت گوگل یا فونت آپلودی خودت.' },
    { t: 'خروجی / نسخه‌ها / تنظیمات (بالا راست)', d: 'خروجی، یک فایل واقعی می‌سازد. نسخه‌ها بعد از هر ادیت AI یک اسنپ‌شات ذخیره می‌کنند — هر کدام را می‌توانی بازگردانی کنی. تنظیمات شامل زبان (English، فارسی، Русский، 中文)، سرویس اختیاری AI، مصرف حافظه و میان‌برهای کیبورد است.' },
  ],
  beatTitle: 'سینک بیت — چطور کار می‌کند',
  beat: [
    'یک موسیقی آپلود کن. تحلیل خودکار شروع می‌شود: STAR EDIT بیت‌ها (جهش‌های انرژی) را پیدا می‌کند، BPM را با همبستگی خودکار تخمین می‌زند و دراپ‌ها (ضربه‌های قوی انرژی) را می‌یابد.',
    'کارت نقشه‌ی بیت نتیجه را با درصد اطمینان نشان می‌دهد. زیر ~۵۵٪ نقشه «تقریبی» علامت می‌خورد — برای سینک دقیق کمتر به آن اعتماد کن.',
    'بگو «هر برش روی بیت باشد» (یا هنگام ساخت ادیت، سینک بیت بخواه) — مرز برش‌ها روی بیت‌های شناسایی‌شده می‌نشیند و قوی‌ترین عکس روی اولین دراپ قرار می‌گیرد.',
    'هر وقت خواستی می‌توانی دوباره با ابزار آهن‌ربا یا دستور «برش‌ها را روی بیت سینک کن» تراز کنی. تشخیص بیت ذاتاً تقریبی است — و همین را صادقانه می‌گوید.',
  ],
  exportTitle: 'خروجی گرفتن، بدون سورپرایز',
  exportTips: [
    'رندر در مرورگر و بلادرنگ انجام می‌شود: تایم‌لاین ۲۰ ثانیه‌ای حدود ۲۰ ثانیه وقت می‌خواهد. تب را باز نگه دار وگرنه رندر ممکن است متوقف شود.',
    'وقتی مرورگر پشتیبانی کند MP4 ارائه می‌شود (کروم/اج معمولاً می‌دهند). وگرنه WebM باکیفیت می‌گیری — همه‌ی پلتفرم‌های مدرن می‌پذیرند.',
    'رزولوشن خروجی مستقل از بوم پروژه است — رندرر مدیا را برای پر کردن کادر مقیاس می‌کند. 1080p نقطه‌ی تعادل است؛ 1440p هم جواب می‌دهد ولی حافظه‌ی بیشتری می‌خواهد.',
    'Draft/Standard/High فقط بیت‌ریت را عوض می‌کنند (حجم فایل در برابر وضوح). برای شبکه‌های اجتماعی، 1080p با Standard عالی است.',
    'در زمان خروجی هیچ چیزی آپلود نمی‌شود — فایل روی دستگاه شما ساخته و مستقیم توسط مرورگر ذخیره می‌شود.',
  ],
  trTitle: 'رفع اشکال',
  tr: [
    { q: 'اگر دستورم مبهم باشد رد می‌کند؟', a: 'نه. اگر جمله‌ات عملیات دقیقی نداشته باشد، STAR AI همین را صادقانه می‌گوید و به‌جای هیچ‌کاری نکردن، یک «پولیش حرفه‌ای» واقعی اعمال می‌کند (حرکت + رنگ‌بندی + ترنزیشن نرم‌تر) — اگر منظورت این نبود با یک Ctrl+Z برمی‌گردد.' },
    { q: 'کپشن‌های متن آهنگ نیامد یا غلط است', a: 'تبدیل متن، تشخیص گفتار واقعی Whisper است که داخل مرورگر اجرا می‌شود: بار اول مدل حدود ۴۰ تا ۸۰ مگابایت دانلود می‌شود (بعدش کش می‌ماند) و برای هر دقیقه صدا چند ثانیه وقت می‌خواهد. آهنگ بی‌کلام یا خیلی شلوغ ممکن است خط کم یا هیچی ندهد — این صادقانه گزارش می‌شود، هرگز جعل نمی‌شود.' },
    { q: '۱۶:۹ را به ۹:۱۶ تبدیل کردم و سوژه افتاد', a: 'حالا هر تغییر نسبت تصویر، خودکار قاب‌بندی هوشمند اعمال می‌کند: برش دنبال سوژه‌ی تشخیص‌داده‌شده می‌رود، یا در اینسپکتور → قاب‌بندی، «پس‌زمینه‌ی بلور» را انتخاب کن تا کل کادر با نوار بلور دیده شود. با اسلایدرهای فوکوس X/Y هم می‌توانی دقیق تنظیم کنی.' },
    { q: 'خروجی WebM شد ولی MP4 می‌خواهم', a: 'مرورگرت در حال حاضر نمی‌تواند MP4 انکود کند (در سافاری/لینوکس رایج است). کروم و اج معمولاً می‌توانند. WebM در همه‌جای مدرن پخش می‌شود — واتساپ، اینستاگرام و ادیتورها همه می‌پذیرند.' },
    { q: 'پخش با ویدیوهای بزرگ پرش دارد', a: 'کلیپ‌های ویدیویی زنده دیکد می‌شوند. از کلیپ‌های کوتاه‌تر/سبک‌تر استفاده کن یا تب‌های دیگر را ببند. عکس‌ها همیشه روان پخش می‌شوند.' },
    { q: 'تشخیص بیت به‌نظر غلط است', a: 'موسیقی بی‌ضرب یا ضبط‌شده‌ی زنده سخت تحلیل می‌شود. درصد اطمینان می‌گوید چقدر اعتماد کنی. همیشه می‌توانی با آهن‌ربا دستی تراز کنی.' },
    { q: 'پروژه‌ام را گم کردم', a: 'پروژه‌ها در IndexedDB مرورگر و مخصوص همین سایت ذخیره می‌شوند. «پاک کردن داده‌های سایت» را برای این دامنه اجرا نکن وگرنه پروژه‌ها و مدیا از بین می‌روند. از صفحه‌ی پروژه‌ها با «خروجی JSON» از ساختار تایم‌لاین بکاپ بگیر.' },
    { q: 'متن فارسی در عنوان‌ها عجیب رندر می‌شود', a: 'عنوان‌ها متن RTL را خودکار تشخیص می‌دهند. اگر رشته‌ی ترکیبی بد دیده شد، عنوان را تمام‌فارسی یا تمام‌انگلیسی نگه دار.' },
  ],
}

const RU: GuideContent = {
  title: 'Как пользоваться STAR EDIT',
  sub: 'От фото и музыки до готового видео — примерно за две минуты. Гид охватывает всё: рабочий процесс из 5 шагов, команды, которые ИИ реально понимает, и все панели редактора.',
  cta: 'Создать проект',
  stepsTitle: 'Быстрый старт — 5 шагов',
  steps: [
    { t: 'Создайте проект', d: 'Нажмите «Новый проект», введите имя и выберите соотношение сторон: 9:16 для TikTok/Reels/Shorts, 16:9 для YouTube, 1:1 или 4:5 для постов Instagram. 30 fps подходит почти всегда.' },
    { t: 'Загрузите медиа', d: 'В панели «Медиа» (слева) добавьте 5–20 фото или несколько видеоклипов и одну музыку (MP3/WAV). Как только музыка загружена, STAR EDIT анализирует её и показывает карту битов: BPM, число битов и честную оценку уверенности.' },
    { t: 'Опишите монтаж', d: 'Нажмите на командную строку над превью и напишите, что хотите, например: «Сделай 15-секундный кинематографичный футбольный монтаж, каждая склейка на бите, титул MATCH DAY». Нажмите Enter. Можно писать и прямо в чат STAR AI справа.' },
    { t: 'Подправьте что угодно', d: 'ИИ правит настоящий таймлайн — вы видите, как клипы появляются и двигаются. Выделите клип и настройте движение, эффекты, цвет, переходы, скорость, громкость и текст в Инспекторе. Перетаскивайте клипы, подрезайте края, режьте клавишей S, отменяйте Ctrl+Z. Каждая ИИ-правка создаёт версию — её можно восстановить в диалоге «Версии».' },
    { t: 'Экспортируйте и скачайте', d: 'Нажмите «Экспорт», выберите разрешение (720p–1440p), формат и качество. Видео рендерится в реальном времени — 15-секундный монтаж занимает ~15 секунд — и автоматически скачивается как MP4 (или WebM, если браузер не умеет MP4).' },
  ],
  cmdTitle: 'Команды, которые ИИ реально понимает',
  cmdSub: 'Комбинируйте их. Локальный движок читает простой английский и фарси; опциональный провайдер (Настройки → ИИ-провайдер) понимает более свободные формулировки. Если команду нельзя превратить в реальную операцию, STAR AI честно так и скажет.',
  commands: [
    'Сделай 15-секундный кинематографичный футбольный монтаж, каждая склейка на бите, титул «MATCH DAY»',
    'Преврати эти фото в 20-секундный эмоциональный рилс с медленными зумами',
    'Сделай темнее и добавь драматичные зумы',
    'Синхронизируй склейки с битом',
    'Добавь жирные субтитры «STAR EDIT»',
    'Добавь lower third «made with STAR EDIT»',
    'Оставь только лучшие 20 секунд',
    'Удали первые 3 секунды',
    'Сделай быстрее / слоу-мо',
    'Вспышки-переходы',
    'Чёрно-белый / винтаж / яркий вид',
    'Громкость 80% и затухание в конце',
    'Сделай версию 9:16',
    'Как в референс-видео',
    'Преобразуй песню в текст — синхронные субтитры',
    'Подгони музыку под моё видео',
    'Конвертируй в TikTok (умный рефрейм сохранит объект)',
    'Добавь титул «GOAL» шрифтом Anton',
    'Добавь speed ramp (замедление и ускорение)',
    'Добавь кинематографичные полосы / light leak',
    'Добавь аутро (конечную карточку)',
  ],
  panelsTitle: 'Устройство редактора',
  panels: [
    { t: 'Медиа (левая панель)', d: 'Зона перетаскивания фото, видео и музыки. Каждый эскиз кликабелен — добавляет файл на таймлайн. Карта битов показывает анализ музыки: BPM, число битов, уверенность, дропы (красные метки) и кнопку «Текст песни → синхро-субтитры» — распознавание вокала прямо на устройстве. «Добавить референс-видео» импортирует клип, который только измеряется для темпа и тона — он никогда не копируется в монтаж.' },
    { t: 'Командная строка + превью (центр)', d: 'Строка над холстом — самый быстрый способ отдавать приказы. Холст проигрывает ваш реальный таймлайн; клик — пуск/пауза. Под ним: переход в начало, пуск/пауза и счётчик времени.' },
    { t: 'Таймлайн (снизу)', d: 'Три дорожки: Video, Music, Text & Captions. Перетаскивайте клипы, тяните края для подрезки, магнит — привязка к битам, +/− — масштаб. Фиолетовая линия — плейхед. S режет клипы на плейхеде.' },
    { t: 'Чат STAR AI (справа)', d: 'Тот же движок в виде чата. После каждой команды он перечисляет, что именно сделал («9 склеек синхронизированы с битами (110 BPM, уверенность 71%)») — вы всегда видите изменения и можете их отменить.' },
    { t: 'Инспектор (правая вкладка)', d: 'Выделите клип и настройте: тип и интенсивность движения (Ken Burns, зумы, панорамы, панч), 12 реальных эффектов (включая кинополосы и light leak), 9 цветокоррекций, стиль и длину перехода, непрозрачность, аудио, скорость, рефрейм (умный кроп по объекту или размытый фон для смены формата, с ручными ползунками фокуса) и свойства текста — с любым шрифтом Google или вашим собственным файлом шрифта.' },
    { t: 'Экспорт / Версии / Настройки (справа вверху)', d: 'Экспорт создаёт реальный файл. Версии хранят снапшот после каждой ИИ-правки — любой можно восстановить. В настройках: язык (English, فارси, Русский, 中文), опциональный ИИ-провайдер, хранилище и горячие клавиши.' },
  ],
  beatTitle: 'Бит-синк — как это работает',
  beat: [
    'Загрузите одну музыку. Анализ запускается автоматически: STAR EDIT находит онсеты (скачки энергии), оценивает BPM автокорреляцией и находит дропы (сильные удары).',
    'Карта битов показывает результат с процентом уверенности. Ниже ~55% карта помечена как «приблизительная» — доверяйте ей меньше.',
    'Скажите «синхронизируй склейки с битом» (или соберите новый монтаж с бит-синком) — границы склеек встанут на биты, а самое сильное фото попадёт на первый дроп.',
    'Позже можно перевыровнять магнитом или командой «Синхронизируй склейки с битом». Определение битов по природе приблизительно — и мы честно об этом говорим.',
  ],
  exportTitle: 'Экспорт без сюрпризов',
  exportTips: [
    'Рендер идёт в реальном времени в браузере: таймлайн 20 секунд требует ~20 секунд. Держите вкладку видимой, иначе рендер может приостановиться.',
    'MP4 предлагается, если браузер умеет (Chrome/Edge обычно умеют). Иначе — качественный WebM: его принимают все современные платформы.',
    'Разрешение экспорта не зависит от холста проекта — рендерер масштабирует медиа. 1080p — золотая середина; 1440p тоже работает, но требует больше памяти.',
    'Draft/Standard/High меняют только битрейт (размер файла против чёткости). Для соцсетей идеален 1080p Standard.',
    'Во время экспорта ничего не загружается в сеть — файл собирается на устройстве и сохраняется браузером напрямую.',
  ],
  trTitle: 'Решение проблем',
  tr: [
    { q: 'Если команда расплывчатая — откажет?', a: 'Нет. Если во фразе нет точной операции, STAR AI честно так и скажет — и вместо бездействия применит честный «профессиональный полиш» (движение + цвет + более плавные переходы). Не то? Один Ctrl+Z возвращает всё назад.' },
    { q: 'Субтитры песни не появились или неверные', a: 'Распознавание — настоящий Whisper в вашем браузере: при первом запуске скачивается модель ~40–80 МБ (потом кэшируется), и на минуту аудио уходит несколько секунд. Инструменталы и очень шумные треки могут дать мало строк — это честно сообщается, а не выдумывается.' },
    { q: 'После 16:9 → 9:16 объект обрезался', a: 'Теперь каждая смена формата применяет умный рефрейм: кроп следует за распознанным объектом, или выберите «Размытый фон» в Инспекторе → Рефрейм, чтобы видеть весь кадр с размытыми полями. Точная настройка — ползунки Фокус X/Y.' },
    { q: 'Экспорт дал WebM, а нужен MP4', a: 'Ваш браузер не умеет кодировать MP4 (часто в Safari/Linux). Chrome и Edge обычно умеют. WebM воспроизводится везде современно.' },
    { q: 'Воспроизведение дёргается на больших видео', a: 'Видеоклипы декодируются вживую. Используйте более короткие/лёгкие исходники или закройте другие вкладки. Фото всегда играют плавно.' },
    { q: 'Определение битов выглядит неверным', a: 'Тихую или «живую» музыку анализировать трудно. Процент уверенности показывает степень доверия. Всегда можно выровнять вручную магнитом.' },
    { q: 'Я потерял проект', a: 'Проекты живут в IndexedDB браузера для этого сайта. Не очищайте данные сайта для этого домена — иначе проекты и медиа пропадут. Делайте «Экспорт JSON» на странице проектов для резервной копии структуры.' },
    { q: 'Персидский текст в титрах отображается странно', a: 'Титры сами распознают RTL-текст. Если смешанная строка выглядит плохо, держите титул полностью персидским или полностью латинским.' },
  ],
}

const ZH: GuideContent = {
  title: 'STAR EDIT 使用教程',
  sub: '从照片和音乐到成品视频，大约两分钟。本指南涵盖所有内容：5 步工作流、AI 真正听得懂的命令，以及编辑器的每个面板。',
  cta: '创建项目',
  stepsTitle: '快速上手 — 5 步',
  steps: [
    { t: '创建项目', d: '点击「新建项目」，输入名称并选择画面比例：9:16 用于 TikTok/Reels/Shorts，16:9 用于 YouTube，1:1 或 4:5 用于 Instagram 帖子。帧率选 30 几乎万能。' },
    { t: '上传素材', d: '在媒体面板（左侧）拖入 5–20 张照片或几个视频片段，再加一首音乐（MP3/WAV）。音乐一进来，STAR EDIT 立即分析并显示节拍图：检测到的 BPM、节拍数和诚实的置信度。' },
    { t: '描述剪辑', d: '点击预览上方的命令栏，输入你想要的效果，例如“做一个15秒电影感足球混剪，每个剪切都卡在节拍上，标题 MATCH DAY”，回车。也可以直接在右侧的 STAR AI 聊天面板输入。' },
    { t: '随意微调', d: 'AI 修改的是真实时间线——你能看到片段被创建和移动。选中任意片段，在检查器里微调运动、特效、调色、转场、速度、音量和文字。拖动片段、拖边裁剪、按 S 剪切、Ctrl+Z 撤销。每次 AI 操作都会生成一个版本，可在版本面板恢复。' },
    { t: '导出并下载', d: '点击导出，选择分辨率（720p–1440p）、格式和画质。视频实时渲染——15 秒的剪辑约需 15 秒——然后自动下载为 MP4（浏览器不支持时为 WebM）。' },
  ],
  cmdTitle: 'AI 真正听得懂的命令',
  cmdSub: '自由组合它们。本地引擎能读简单的英文和波斯语；可选服务商（设置 → AI 服务）能理解更自由的表述。如果命令无法映射为真实操作，STAR AI 会如实告诉你，而不是造假。',
  commands: [
    '做一个15秒电影感足球混剪，每个剪切都卡在节拍上，标题“MATCH DAY”',
    '把这些照片变成20秒慢缩放的抒情短视频',
    '调暗一些，加戏剧性缩放',
    '把剪切点同步到节拍',
    '加白色粗体字幕“STAR EDIT”',
    '加下三分之一条“made with STAR EDIT”',
    '只保留最好的20秒',
    '删掉前3秒',
    '加快速度 / 慢动作',
    '闪白转场',
    '黑白 / 复古 / 鲜艳风格',
    '音量80%，结尾淡出',
    '做一个9:16版本',
    '参考视频那样',
    '把歌曲转成文字 — 同步歌词字幕',
    '让音乐和我的视频对齐',
    '转换成抖音竖屏（智能重构图保住主体）',
    '用 Anton 字体加标题“GOAL”',
    '加速度坡道（时快时慢）',
    '加电影黑边 / 光晕漏光',
    '加片尾卡片（outro）',
  ],
  panelsTitle: '认识编辑器',
  panels: [
    { t: '媒体（左面板）', d: '照片、视频和音乐的拖放区。每个缩略图都可以点击——把该素材加到时间线。节拍图卡片显示音乐分析结果：BPM、节拍数、置信度、drop（红色标记），以及“歌词 → 同步字幕”按钮——在设备本机转录人声。“添加参考视频”导入的片段只会被测量节奏和色调——绝不会复制进你的剪辑。' },
    { t: '命令栏 + 预览（中间）', d: '画布上方的命令栏是下指令最快的方式。画布播放你的真实时间线；点击播放/暂停。下方是回到开头、播放/暂停按钮和时间计数。' },
    { t: '时间线（底部）', d: '三条轨道：Video、Music、Text & Captions。拖动片段移动，拖边缘裁剪，磁铁按钮吸附到节拍，+/− 缩放。紫线是播放头。S 键在播放头处剪切。' },
    { t: 'STAR AI 聊天（右侧）', d: '同一引擎的聊天视图。每条命令后它都会列出具体做了什么（“9 个剪切同步到节拍（110 BPM，置信度 71%）”）——你始终知道改了什么，并且可以撤销。' },
    { t: '检查器（右侧标签）', d: '选中片段后可微调：运动类型与强度（Ken Burns、缩放、平移、冲拳）、12 种真实特效（含电影黑边与漏光）、9 种调色、转场样式与时长、不透明度、音频、播放速度、智能重构图（主体跟随裁剪或模糊背景填充，可手动焦点滑块）和文字属性——支持任意 Google 字体或上传自己的字体文件。' },
    { t: '导出 / 版本 / 设置（右上）', d: '导出生成真实文件。版本在每次 AI 剪辑后保存快照——可恢复任意版本。设置包含语言（English、فارسی、Русский、中文）、可选 AI 服务、存储用量和键盘快捷键。' },
  ],
  beatTitle: '节拍卡点 — 工作原理',
  beat: [
    '上传一首音乐，分析自动开始：STAR EDIT 检测 onset（能量跳变）、用自相关估计 BPM，并找出 drop（强能量点）。',
    '节拍图卡片显示结果和置信度百分比。低于约 55% 时标记为“近似”—— tight sync 时要少信它。',
    '说“把剪切点同步到节拍”（或构建带卡点的新剪辑）——剪切边界落在检测到的节拍上，最强照片放在第一个 drop。',
    '之后随时可以用磁铁工具或“把剪切点同步到节拍”命令重新对齐。节拍检测本质上是近似的——我们如实标注。',
  ],
  exportTitle: '导出，没有意外',
  exportTips: [
    '渲染在浏览器里实时进行：20 秒的时间线约需 20 秒。保持标签页可见，否则渲染可能暂停。',
    '浏览器支持时提供 MP4（Chrome/Edge 通常支持）。否则得到高质量 WebM——所有主流平台都接受。',
    '导出分辨率与项目画布无关——渲染器会缩放素材以适配。1080p 是最佳平衡；1440p 也可行但更吃内存。',
    'Draft/Standard/High 只改变码率（文件大小 vs 清晰度）。社交媒体用 1080p Standard 就很好。',
    '导出过程中不会上传任何内容——文件在你的设备上生成，由浏览器直接保存。',
  ],
  trTitle: '疑难解答',
  tr: [
    { q: '命令说得模糊会被拒绝吗？', a: '不会。如果句子里没有明确的剪辑操作，STAR AI 会如实说明，然后诚实地执行一次“专业抛光”（运动 + 调色 + 更顺滑的转场）而不是什么都不做——不是你的意思就 Ctrl+Z 撤销。' },
    { q: '歌词字幕没出现或不对', a: '转录是在浏览器里运行的真实 Whisper 语音识别：首次使用下载约 40–80MB 模型（之后有缓存），每分钟音频需要几秒钟。纯音乐或非常嘈杂的曲目可能得到很少行——这会如实报告，绝不造假。' },
    { q: '16:9 转 9:16 后主体被切掉了', a: '现在每次改画幅都会自动应用智能重构图：裁剪跟随识别到的主体，或在检查器 → 智能重构图里选择“模糊背景填充”以完整显示画面加模糊边。可用焦点 X/Y 滑块精调。' },
    { q: '导出是 WebM，我想要 MP4', a: '你的浏览器无法在浏览器内编码 MP4（Safari/Linux 常见）。Chrome 和 Edge 通常可以。WebM 在所有现代平台都能播放。' },
    { q: '大视频播放卡顿', a: '视频片段是实时解码的。使用更短/更小的源片段，或关闭其他标签页。照片始终流畅。' },
    { q: '节拍检测看起来不对', a: '安静或现场录制的音乐很难分析。置信度百分比告诉你可信程度。随时可以用磁铁工具手动对齐。' },
    { q: '我的项目丢了', a: '项目保存在本站点对应的浏览器 IndexedDB 中。不要清除本站点的站点数据，否则项目和媒体会丢失。可在项目页用“导出 JSON”备份时间线结构。' },
    { q: '标题里的波斯语显示异常', a: '标题会自动识别 RTL 文本。如果混合字符串显示不佳，让标题保持纯波斯语或纯拉丁文。' },
  ],
}

const CONTENT: Record<Lang, GuideContent> = { en: EN, fa: FA, ru: RU, zh: ZH }

const ICONS = [Upload, MessageSquare, Sparkles, Scissors, Play]

export default function Guide() {
  const { t, lang, setLang } = useI18n()
  const c = CONTENT[lang] ?? EN
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(cmd)
      setTimeout(() => setCopied((v) => (v === cmd ? null : v)), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/85 backdrop-blur-xl">
        <div className="section-pad flex h-14 items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-white">
            <ArrowRight size={15} className="rtl:rotate-180" /> {t('nav.home')}
          </button>
          <div className="flex items-center gap-2">
            <select
              className="field !w-auto !py-1.5 !text-[12px]"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t('st.lang')}
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id} className="bg-ink-900">{l.label}</option>
              ))}
            </select>
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-4 !py-2 !text-[13px]">
              {c.cta} <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </header>

      <main className="section-pad pb-24">
        {/* hero */}
        <div className="aurora -mx-5 px-5 py-14 text-center sm:-mx-8 sm:px-8">
          <div className="mx-auto flex w-fit items-center gap-2.5">
            <LogoWord compact />
            <span className="chip">{t('nav.guide')}</span>
          </div>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-relaxed text-zinc-400">{c.sub}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate('/projects?new=1')} className="btn-accent !px-6 !py-2.5">{c.cta} <ArrowRight size={14} className="rtl:rotate-180" /></button>
            <a href="#quickstart" className="btn-ghost !px-5 !py-2.5"><ListOrdered size={15} /> {c.stepsTitle}</a>
          </div>
        </div>

        {/* quick start */}
        <section id="quickstart" className="scroll-mt-20 pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><ListOrdered size={18} className="text-star-400" /> {c.stepsTitle}</h2>
          <ol className="mt-6 space-y-3">
            {c.steps.map((s, i) => {
              const Icon = ICONS[i % ICONS.length]
              return (
                <li key={i} className="glass flex gap-4 rounded-2xl p-5">
                  <div className="flex flex-col items-center">
                    <span className="tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-star-500/25 bg-star-500/10 text-[13px] font-extrabold text-star-300">
                      {i + 1}
                    </span>
                    {i < c.steps.length - 1 && <span className="mt-2 w-px flex-1 bg-white/8" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold"><Icon size={15} className="shrink-0 text-zinc-500" /> {s.t}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{s.d}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* commands */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><MessageSquare size={18} className="text-star-400" /> {c.cmdTitle}</h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">{c.cmdSub}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {c.commands.map((cmd) => (
              <div key={cmd} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-200" title={cmd}>“{cmd}”</span>
                <button onClick={() => void copy(cmd)} className="btn-ghost shrink-0 !rounded-lg !p-2" title={t('cmd.copy')} aria-label={t('cmd.copy')}>
                  {copied === cmd ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* panels */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Scissors size={18} className="text-star-400" /> {c.panelsTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {c.panels.map((p) => (
              <div key={p.t} className="glass rounded-2xl p-5">
                <h3 className="text-[14px] font-bold text-zinc-100">{p.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* beat sync */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Music size={18} className="text-star-400" /> {c.beatTitle}</h2>
          <ul className="mt-6 space-y-2.5">
            {c.beat.map((b, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-zinc-300">
                <Sparkles size={14} className="mt-1 shrink-0 text-star-400" /> {b}
              </li>
            ))}
          </ul>
        </section>

        {/* export */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Play size={17} className="text-star-400" /> {c.exportTitle}</h2>
          <ul className="mt-6 space-y-2.5">
            {c.exportTips.map((e, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-zinc-300">
                <Check size={14} className="mt-1 shrink-0 text-emerald-400" /> {e}
              </li>
            ))}
          </ul>
        </section>

        {/* shortcuts */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Keyboard size={18} className="text-star-400" /> {t('st.shortcuts')}</h2>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Space', 'play / pause'],
              ['S', 'split at playhead'],
              ['Del', 'delete selection'],
              ['Ctrl+D', 'duplicate'],
              ['Ctrl+Z', 'undo'],
              ['Ctrl+⇧+Z', 'redo'],
              ['←/→', 'step frame'],
              ['⇧+←/→', 'step second'],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] text-zinc-300">
                <kbd className="kbd">{k}</kbd> {d}
              </div>
            ))}
          </div>
        </section>

        {/* troubleshooting */}
        <section className="pt-14">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><LifeBuoy size={18} className="text-star-400" /> {c.trTitle}</h2>
          <div className="mt-6 space-y-2">
            {c.tr.map((x) => (
              <details key={x.q} className="group rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5 open:border-white/15">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden">
                  {x.q}
                  <ChevronDown size={15} className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">{x.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* bottom CTA */}
        <div className="aurora mt-16 rounded-3xl border border-white/8 p-10 text-center">
          <BookOpen size={26} className="mx-auto text-star-400" />
          <h2 className="mt-4 text-2xl font-extrabold">{c.cta}</h2>
          <p className="mt-2 text-[13px] text-zinc-400">{t('cta.sub')}</p>
          <button onClick={() => navigate('/projects?new=1')} className="btn-accent mt-6 !px-7 !py-3">
            {t('hero.cta')} <ArrowRight size={15} className="rtl:rotate-180" />
          </button>
        </div>
      </main>
    </div>
  )
}
