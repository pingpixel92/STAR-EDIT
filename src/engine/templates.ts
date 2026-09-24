// Starter templates — each generates a real timeline from the user's media (or honest placeholders)
import type { MediaAsset, StyleId } from '../lib/types'

export interface TemplateDef {
  id: string
  name: string
  emoji: string
  style: StyleId
  duration: number
  beatSync: boolean
  title?: string
  captions?: string
  desc: string
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'football', name: 'Football Edit', emoji: '⚽', style: 'sports', duration: 15, beatSync: true, title: 'MATCH DAY', desc: 'Whip cuts, punch-ins, orange & teal' },
  { id: 'memories', name: 'Cinematic Memories', emoji: '🎬', style: 'cinematic', duration: 20, beatSync: false, desc: 'Slow Ken Burns, dissolves, film grade' },
  { id: 'travel', name: 'Travel Reel', emoji: '🌍', style: 'travel', duration: 18, beatSync: true, title: 'ADVENTURE', desc: 'Slides & pans, warm tones' },
  { id: 'birthday', name: 'Birthday', emoji: '🎂', style: 'energetic', duration: 12, beatSync: true, title: 'HAPPY BIRTHDAY', desc: 'Bright, fast, celebratory' },
  { id: 'gaming', name: 'Gaming Montage', emoji: '🎮', style: 'gaming', duration: 14, beatSync: true, desc: 'Flash cuts, shake, cold grade' },
  { id: 'slideshow', name: 'Photo Slideshow', emoji: '🖼️', style: 'minimal', duration: 16, beatSync: false, desc: 'Clean and calm presentation' },
  { id: 'fashion', name: 'Fashion Reel', emoji: '👗', style: 'fashion', duration: 12, beatSync: true, desc: 'B&W chic with punch-ins' },
  { id: 'car', name: 'Car Edit', emoji: '🚗', style: 'hype', duration: 13, beatSync: true, title: 'NIGHT DRIVE', desc: 'Aggressive whips and shake' },
  { id: 'anime', name: 'Anime-style Pacing', emoji: '⚡', style: 'beatsync', duration: 12, beatSync: true, desc: 'Every cut on the beat' },
  { id: 'visualizer', name: 'Music Visualizer', emoji: '🎵', style: 'beatsync', duration: 20, beatSync: true, title: 'NOW PLAYING', desc: 'Beat-driven photo pulses' },
]

export function templateAssetsAvailable(assets: MediaAsset[]): { images: number; music: boolean } {
  return {
    images: assets.filter((a) => a.type === 'image').length,
    music: assets.some((a) => a.type === 'audio'),
  }
}
