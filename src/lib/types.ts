// STAR EDIT — core data model
export type AspectId = '9:16' | '16:9' | '1:1' | '4:5' | '21:9'
export type StyleId =
  | 'cinematic' | 'fast' | 'hype' | 'emotional' | 'minimal' | 'dark'
  | 'energetic' | 'vlog' | 'sports' | 'travel' | 'gaming' | 'fashion'
  | 'luxury' | 'beatsync'
export type GradeId =
  | 'none' | 'cinematic' | 'orangeTeal' | 'warm' | 'cold' | 'dark'
  | 'bw' | 'vintage' | 'vibrant' | 'muted'
export type EffectType =
  | 'vignette' | 'shake' | 'glow' | 'rgbSplit' | 'brightness'
  | 'contrast' | 'saturation' | 'hue' | 'blur' | 'grain'
  | 'letterbox' | 'lightLeak'
export type MotionType =
  | 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight'
  | 'panUp' | 'panDown' | 'kenburns' | 'punch'
export type TransitionStyle = 'none' | 'dissolve' | 'flash' | 'whip' | 'slide' | 'blurIn'
export type TextAnim = 'none' | 'fade' | 'slideUp' | 'pop' | 'typewriter' | 'karaoke'

export interface EffectSpec { type: EffectType; intensity: number }

export interface TextProps {
  content: string
  size: number // % of frame height
  weight: number
  color: string
  accent?: string
  align: 'left' | 'center' | 'right'
  x: number // 0..1
  y: number // 0..1
  font: string
  stroke: boolean
  bg?: { opacity: number } | null
  anim: TextAnim
  glow: boolean
  countTo?: number
  rtl?: boolean
}

export interface Transition { style: TransitionStyle; duration: number }

export interface Clip {
  id: string
  trackId: string
  kind: 'image' | 'video' | 'audio' | 'text' | 'logo' | 'placeholder'
  mediaId?: string
  name: string
  start: number
  duration: number
  inPoint: number
  speed: number
  volume: number
  muted: boolean
  fadeIn: number
  fadeOut: number
  motion: { type: MotionType; intensity: number }
  effects: EffectSpec[]
  colorGrade: GradeId
  transitionIn: Transition
  opacity: number
  text?: TextProps
  color?: string
  /** Aspect conversion: 'crop' = smart focal crop, 'blur' = blurred pad (CapCut style) */
  fill?: 'crop' | 'blur'
  /** Manual focal point override (0..1). When absent, the analyzed subject is used. */
  focal?: { x: number; y: number }
}

export interface Track {
  id: string
  kind: 'video' | 'audio' | 'text'
  name: string
  clips: Clip[]
  muted: boolean
  hidden: boolean
}

export interface SubjectPoint {
  t: number // seconds in source
  x: number // 0..1
  y: number // 0..1
  v: number // saliency/motion strength 0..1
}

export interface BeatMap {
  mediaId: string
  bpm: number
  confidence: number // 0..1
  beats: number[]
  drops: number[]
  analyzedAt: number
  approximate: boolean
}

export interface Version {
  id: string
  label: string
  at: number
  tracks: Track[]
  duration: number
}

export interface ReferenceAnalysis {
  avgShotDuration: number
  cuts: number
  samples: number
  aspect: string
  brightness: number // 0..1
  saturation: number // 0..1
  suggestedGrade: GradeId
  suggestedCut: number
}

export interface MediaAsset {
  id: string
  projectId: string
  name: string
  type: 'image' | 'video' | 'audio'
  mimeType: string
  size: number
  duration?: number
  width?: number
  height?: number
  thumb?: string
  peaks?: number[]
  colors?: string[]
  role?: 'media' | 'reference'
  analysis?: ReferenceAnalysis
  /** Videos: subject position over time (smart reframe). Photos: single focus point. */
  subject?: SubjectPoint[]
  focus?: { x: number; y: number }
  /** Browser could not decode this file even after conversion attempts — card shows honest warning. */
  decodeFailed?: boolean
  createdAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ops?: string[]
  at: number
  source?: 'local' | 'provider'
  error?: boolean
}

export interface Project {
  id: string
  name: string
  aspect: AspectId
  width: number
  height: number
  fps: 24 | 30 | 60
  tracks: Track[]
  duration: number
  beatMap?: BeatMap
  versions: Version[]
  createdAt: number
  updatedAt: number
}

// ---------- Edit Plan schema ----------
export type PlanAction =
  | { type: 'setDuration'; seconds: number }
  | { type: 'setAspect'; aspect: AspectId }
  | { type: 'buildPhotoEdit'; duration?: number; style?: StyleId; beatSync?: boolean; title?: string }
  | { type: 'setStyle'; style: StyleId }
  | { type: 'beatSync'; enabled: boolean }
  | { type: 'addZooms'; intensity: number }
  | { type: 'setColorGrade'; grade: GradeId }
  | { type: 'setSpeed'; speed: number }
  | { type: 'trimStart'; seconds: number }
  | { type: 'keepBest'; seconds: number }
  | { type: 'removeAudio' }
  | { type: 'addCaptions'; text?: string; style?: string; font?: string }
  | { type: 'addTitle'; text: string; font?: string }
  | { type: 'addLowerThird'; text: string; font?: string }
  | { type: 'addCounter'; from: number; to: number; label?: string }
  | { type: 'setTransition'; style: TransitionStyle; duration?: number }
  | { type: 'removeClip'; index: number }
  | { type: 'addMovement'; intensity: number }
  | { type: 'reduceEffects' }
  | { type: 'setVolume'; volume: number }
  | { type: 'fadeOut'; seconds: number }
  | { type: 'applyReferencePacing' }
  // --- v1.2 professional additions ---
  | { type: 'fitToMusic' }
  | { type: 'autoReframe'; fill?: 'crop' | 'blur' }
  | { type: 'speedRamp'; slow?: number; fast?: number }
  | { type: 'addOutro'; text?: string }
  | { type: 'addEffect'; effect: EffectType; intensity?: number }
  | { type: 'autoLyrics'; language?: string; quality?: 'fast' | 'best' }

export interface EditPlan {
  actions: PlanAction[]
  note?: string
}

export const ASPECTS: Record<AspectId, { w: number; h: number; label: string }> = {
  '9:16': { w: 1080, h: 1920, label: 'TikTok / Reels / Shorts' },
  '16:9': { w: 1920, h: 1080, label: 'YouTube' },
  '1:1': { w: 1080, h: 1080, label: 'Instagram Post' },
  '4:5': { w: 1080, h: 1350, label: 'Portrait Feed' },
  '21:9': { w: 1920, h: 822, label: 'Cinematic' },
}

export const EFFECT_LABELS: Record<EffectType, string> = {
  vignette: 'Vignette',
  shake: 'Shake',
  glow: 'Glow',
  rgbSplit: 'RGB Split',
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  hue: 'Hue Shift',
  blur: 'Blur',
  grain: 'Grain',
  letterbox: 'Cinematic Bars',
  lightLeak: 'Light Leak',
}

export const GRADES: GradeId[] = [
  'none', 'cinematic', 'orangeTeal', 'warm', 'cold', 'dark', 'bw', 'vintage', 'vibrant', 'muted',
]

export const TRANSITIONS: TransitionStyle[] = ['none', 'dissolve', 'flash', 'whip', 'slide', 'blurIn']

export const MOTIONS: MotionType[] = [
  'none', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown', 'kenburns', 'punch',
]
