// Central editor state — Zustand with undo/redo, versions, persistence
import { create } from 'zustand'
import type { ChatMessage, MediaAsset, Project, Track, BeatMap, Version } from './types'
import * as db from './db'
import { deepClone, uid } from './utils'

interface Snapshot {
  tracks: Track[]
  duration: number
  beatMap?: BeatMap
}

export interface EditorState {
  project: Project | null
  assets: MediaAsset[]
  blobs: Map<string, Blob>
  selection: string[]
  time: number
  playing: boolean
  zoom: number
  snap: boolean
  chat: ChatMessage[]
  saveState: 'idle' | 'saving' | 'saved'
  analyzing: Record<string, boolean>
  past: Snapshot[]
  future: Snapshot[]

  newProject: (init: { name: string; aspect: Project['aspect']; fps: 24 | 30 | 60 }) => Promise<Project>
  loadProject: (id: string) => Promise<void>
  closeProject: () => void
  reloadAssets: () => Promise<void>

  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  setZoom: (z: number) => void
  setSnap: (s: boolean) => void
  select: (ids: string[], additive?: boolean) => void

  commit: () => void
  undo: () => void
  redo: () => void

  mutate: (fn: (p: Project) => void, opts?: { history?: boolean }) => void
  setBeatMap: (bm: BeatMap) => void
  setAssetAnalyzed: (id: string, v: boolean) => void

  addAssets: (a: MediaAsset[], blobs: Map<string, Blob>) => void
  removeAsset: (id: string) => Promise<void>

  addVersion: (label: string) => void
  restoreVersion: (id: string) => void

  addChat: (m: ChatMessage) => void
  patchChat: (id: string, patch: Partial<ChatMessage>) => void
}

const snap = (p: Project): Snapshot => ({
  tracks: deepClone(p.tracks),
  duration: p.duration,
  beatMap: p.beatMap ? deepClone(p.beatMap) : undefined,
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(get: () => EditorState, set: (s: Partial<EditorState>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ saveState: 'saving' })
  saveTimer = setTimeout(async () => {
    const p = get().project
    if (p) {
      await db.putProject(p)
      set({ saveState: 'saved' })
      setTimeout(() => {
        if (get().saveState === 'saved') set({ saveState: 'idle' })
      }, 1800)
    }
  }, 650)
}

export function recomputeDuration(p: Project): number {
  let d = 0
  for (const tr of p.tracks) for (const c of tr.clips) d = Math.max(d, c.start + c.duration)
  return Math.max(d, 0.5)
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  assets: [],
  blobs: new Map(),
  selection: [],
  time: 0,
  playing: false,
  zoom: 68,
  snap: true,
  chat: [],
  saveState: 'idle',
  analyzing: {},
  past: [],
  future: [],

  async newProject(init) {
    const now = Date.now()
    const project: Project = {
      id: uid('prj'),
      name: init.name || 'Untitled Edit',
      aspect: init.aspect,
      width: 1080,
      height: 1920,
      fps: init.fps,
      tracks: [
        { id: uid('trv'), kind: 'video', name: 'Video', clips: [], muted: false, hidden: false },
        { id: uid('tra'), kind: 'audio', name: 'Music', clips: [], muted: false, hidden: false },
        { id: uid('trt'), kind: 'text', name: 'Text & Captions', clips: [], muted: false, hidden: false },
      ],
      duration: 5,
      versions: [],
      createdAt: now,
      updatedAt: now,
    }
    const dims = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], '21:9': [1920, 822] }[init.aspect]
    project.width = dims[0]
    project.height = dims[1]
    await db.putProject(project)
    set({ project, assets: [], blobs: new Map(), selection: [], time: 0, chat: [], past: [], future: [] })
    return project
  },

  async loadProject(id) {
    const p = await db.getProject(id)
    if (!p) return
    const assets = await db.mediaForProject(id)
    const blobs = new Map<string, Blob>()
    await Promise.all(
      assets.map(async (a) => {
        const b = await db.getBlob(a.id)
        if (b) blobs.set(a.id, b)
      })
    )
    set({
      project: p,
      assets,
      blobs,
      selection: [],
      time: 0,
      playing: false,
      chat: [],
      past: [],
      future: [],
    })
  },

  closeProject() {
    set({ project: null, assets: [], blobs: new Map(), selection: [], time: 0, playing: false, chat: [], past: [], future: [] })
  },

  async reloadAssets() {
    const p = get().project
    if (!p) return
    const assets = await db.mediaForProject(p.id)
    const blobs = new Map(get().blobs)
    for (const a of assets) {
      if (!blobs.has(a.id)) {
        const b = await db.getBlob(a.id)
        if (b) blobs.set(a.id, b)
      }
    }
    set({ assets, blobs })
  },

  setTime: (t) => set({ time: t }),
  setPlaying: (p) => set({ playing: p }),
  setZoom: (z) => set({ zoom: Math.min(240, Math.max(18, z)) }),
  setSnap: (s) => set({ snap: s }),
  select(ids, additive) {
    if (additive) {
      const cur = new Set(get().selection)
      for (const i of ids) cur.has(i) ? cur.delete(i) : cur.add(i)
      set({ selection: [...cur] })
    } else set({ selection: ids })
  },

  commit() {
    const p = get().project
    if (!p) return
    const past = [...get().past, snap(p)].slice(-60)
    set({ past, future: [] })
  },

  undo() {
    const p = get().project
    const past = get().past
    if (!p || past.length === 0) return
    const prev = past[past.length - 1]
    const future = [...get().future, snap(p)].slice(-60)
    set({ project: { ...p, tracks: prev.tracks, duration: prev.duration, beatMap: prev.beatMap, updatedAt: Date.now() }, past: past.slice(0, -1), future })
    scheduleSave(get, set)
  },

  redo() {
    const p = get().project
    const future = get().future
    if (!p || future.length === 0) return
    const next = future[future.length - 1]
    const past = [...get().past, snap(p)].slice(-60)
    set({ project: { ...p, tracks: next.tracks, duration: next.duration, beatMap: next.beatMap, updatedAt: Date.now() }, past, future: future.slice(0, -1) })
    scheduleSave(get, set)
  },

  mutate(fn, opts) {
    const p = get().project
    if (!p) return
    if (opts?.history !== false) {
      const past = [...get().past, snap(p)].slice(-60)
      set({ past, future: [] })
    }
    const draft = deepClone(p)
    fn(draft)
    draft.duration = recomputeDuration(draft)
    draft.updatedAt = Date.now()
    set({ project: draft })
    scheduleSave(get, set)
  },

  setBeatMap(bm) {
    get().mutate((p) => {
      p.beatMap = bm
    }, { history: false })
  },

  setAssetAnalyzed(id, v) {
    set((s) => ({ analyzing: { ...s.analyzing, [id]: v } }))
  },

  addAssets(assets, blobs) {
    set((s) => {
      const merged = new Map(s.blobs)
      blobs.forEach((v, k) => merged.set(k, v))
      const existing = new Set(s.assets.map((a) => a.id))
      return { assets: [...s.assets, ...assets.filter((a) => !existing.has(a.id))], blobs: merged }
    })
  },

  async removeAsset(id) {
    const p = get().project
    if (p) {
      get().mutate((d) => {
        for (const tr of d.tracks) tr.clips = tr.clips.filter((c) => c.mediaId !== id)
        if (d.beatMap?.mediaId === id) delete d.beatMap
      })
    }
    set((s) => {
      const blobs = new Map(s.blobs)
      blobs.delete(id)
      return { assets: s.assets.filter((a) => a.id !== id), blobs }
    })
    await db.deleteMedia(id)
  },

  addVersion(label) {
    const p = get().project
    if (!p) return
    const v: Version = { id: uid('ver'), label, at: Date.now(), tracks: deepClone(p.tracks), duration: p.duration }
    get().mutate((d) => {
      d.versions = [...d.versions, v].slice(-24)
    }, { history: false })
  },

  restoreVersion(id) {
    const p = get().project
    if (!p) return
    const v = p.versions.find((x) => x.id === id)
    if (!v) return
    get().commit()
    get().mutate((d) => {
      d.tracks = deepClone(v.tracks)
      d.duration = v.duration
    }, { history: false })
  },

  addChat(m) {
    set((s) => ({ chat: [...s.chat, m].slice(-80) }))
  },

  patchChat(id, patch) {
    set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  },
}))
