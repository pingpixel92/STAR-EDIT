// Editing style presets — each style genuinely changes cut frequency, transitions, motion, grade
import type { GradeId, MotionType, StyleId, TransitionStyle } from '../lib/types'

export interface StyleDef {
  id: StyleId
  label: string
  cut: number // seconds between cuts
  transition: { style: TransitionStyle; duration: number }
  zoom: number
  shake: number
  grade: GradeId
  motions: MotionType[]
  punch: boolean
  beatSnap: boolean
  desc: string
}

export const STYLES: Record<StyleId, StyleDef> = {
  cinematic: { id: 'cinematic', label: 'Cinematic', cut: 2.6, transition: { style: 'dissolve', duration: 0.5 }, zoom: 0.6, shake: 0, grade: 'cinematic', motions: ['kenburns', 'zoomIn', 'panRight', 'zoomOut'], punch: false, beatSnap: false, desc: 'Slow Burns · Dissolves · Orange-Teal' },
  fast: { id: 'fast', label: 'Fast', cut: 0.9, transition: { style: 'flash', duration: 0.16 }, zoom: 0.8, shake: 0.15, grade: 'vibrant', motions: ['zoomIn', 'punch', 'panLeft', 'zoomOut'], punch: true, beatSnap: true, desc: 'Quick cuts · Flash · Punchy' },
  hype: { id: 'hype', label: 'Hype', cut: 0.55, transition: { style: 'whip', duration: 0.18 }, zoom: 1, shake: 0.35, grade: 'vibrant', motions: ['punch', 'zoomIn', 'zoomOut'], punch: true, beatSnap: true, desc: 'Whip pans · Shake · Hard drops' },
  emotional: { id: 'emotional', label: 'Emotional', cut: 3.2, transition: { style: 'dissolve', duration: 0.85 }, zoom: 0.4, shake: 0, grade: 'warm', motions: ['kenburns', 'panUp', 'zoomOut'], punch: false, beatSnap: false, desc: 'Gentle pans · Long dissolves · Warm' },
  minimal: { id: 'minimal', label: 'Minimal', cut: 3.5, transition: { style: 'dissolve', duration: 0.35 }, zoom: 0.3, shake: 0, grade: 'muted', motions: ['zoomIn', 'zoomOut'], punch: false, beatSnap: false, desc: 'Clean · Calm · Muted colors' },
  dark: { id: 'dark', label: 'Dark', cut: 1.8, transition: { style: 'blurIn', duration: 0.45 }, zoom: 0.5, shake: 0.08, grade: 'dark', motions: ['kenburns', 'zoomIn', 'panDown'], punch: false, beatSnap: true, desc: 'Moody · Vignette · Blur fades' },
  energetic: { id: 'energetic', label: 'Energetic', cut: 1.1, transition: { style: 'slide', duration: 0.3 }, zoom: 0.7, shake: 0.2, grade: 'vibrant', motions: ['zoomIn', 'panRight', 'punch'], punch: true, beatSnap: true, desc: 'Slides · Zooms · Movement' },
  vlog: { id: 'vlog', label: 'Vlog', cut: 2.2, transition: { style: 'dissolve', duration: 0.25 }, zoom: 0.35, shake: 0.05, grade: 'warm', motions: ['zoomIn', 'panLeft'], punch: false, beatSnap: false, desc: 'Natural · Friendly · Soft' },
  sports: { id: 'sports', label: 'Sports / Football', cut: 0.75, transition: { style: 'whip', duration: 0.15 }, zoom: 0.9, shake: 0.3, grade: 'orangeTeal', motions: ['punch', 'zoomIn', 'panRight'], punch: true, beatSnap: true, desc: 'Whips · Punch-ins · Orange & Teal' },
  travel: { id: 'travel', label: 'Travel', cut: 1.6, transition: { style: 'slide', duration: 0.35 }, zoom: 0.55, shake: 0.05, grade: 'warm', motions: ['kenburns', 'panRight', 'panUp', 'zoomOut'], punch: false, beatSnap: false, desc: 'Slides · Pans · Warm tones' },
  gaming: { id: 'gaming', label: 'Gaming', cut: 0.6, transition: { style: 'flash', duration: 0.14 }, zoom: 0.85, shake: 0.4, grade: 'cold', motions: ['punch', 'zoomOut', 'zoomIn'], punch: true, beatSnap: true, desc: 'Flashes · Shakes · Cold grade' },
  fashion: { id: 'fashion', label: 'Fashion', cut: 1.3, transition: { style: 'dissolve', duration: 0.3 }, zoom: 0.6, shake: 0, grade: 'bw', motions: ['zoomIn', 'panUp', 'punch'], punch: true, beatSnap: true, desc: 'B&W · Chic punch-ins' },
  luxury: { id: 'luxury', label: 'Luxury', cut: 2.4, transition: { style: 'blurIn', duration: 0.6 }, zoom: 0.45, shake: 0, grade: 'muted', motions: ['kenburns', 'zoomOut', 'panLeft'], punch: false, beatSnap: false, desc: 'Slow reveals · Elegant blur' },
  beatsync: { id: 'beatsync', label: 'Beat Sync', cut: 0.8, transition: { style: 'flash', duration: 0.15 }, zoom: 0.9, shake: 0.25, grade: 'vibrant', motions: ['punch', 'zoomIn', 'zoomOut'], punch: true, beatSnap: true, desc: 'Every cut lands on a detected beat' },
}

export const STYLE_LIST = Object.values(STYLES)
