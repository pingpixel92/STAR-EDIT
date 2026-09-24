import type { EffectType, GradeId, MotionType, TransitionStyle } from '../../lib/types'
import { EFFECT_LABELS, GRADES, MOTIONS, TRANSITIONS } from '../../lib/types'

export const EFFECTS_OPTS: { value: EffectType; label: string }[] = (
  Object.keys(EFFECT_LABELS) as EffectType[]
).map((k) => ({ value: k, label: EFFECT_LABELS[k] }))

export const GRADE_OPTS: { value: GradeId; label: string }[] = GRADES.map((g) => ({
  value: g,
  label: g === 'none' ? 'None' : g === 'orangeTeal' ? 'Orange & Teal' : g === 'bw' ? 'Black & White' : g.charAt(0).toUpperCase() + g.slice(1),
}))

export const MOTION_OPTS: { value: MotionType; label: string }[] = MOTIONS.map((m) => ({
  value: m,
  label: m === 'none' ? 'None' : m === 'kenburns' ? 'Ken Burns' : m === 'punch' ? 'Punch in' : m === 'zoomIn' ? 'Zoom in' : m === 'zoomOut' ? 'Zoom out' : m === 'panLeft' ? 'Pan left' : m === 'panRight' ? 'Pan right' : m === 'panUp' ? 'Pan up' : 'Pan down',
}))

export const TRANSITION_OPTS: { value: TransitionStyle; label: string }[] = TRANSITIONS.map((tr) => ({
  value: tr,
  label: tr === 'none' ? 'None' : tr === 'blurIn' ? 'Blur fade' : tr.charAt(0).toUpperCase() + tr.slice(1),
}))
