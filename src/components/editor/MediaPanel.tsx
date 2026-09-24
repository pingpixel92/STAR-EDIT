import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Music, Film, Image as ImageIcon, Mic2, Plus, BookOpen, Zap, Waves } from 'lucide-react'
import { useEditor } from '../../lib/store'
import * as db from '../../lib/db'
import { ACCEPTED, analyzeAudio, analyzeImage, analyzeReference, analyzeVideo, typeOf } from '../../engine/mediaAnalysis'
import { detectBeats } from '../../engine/beats'
import type { MediaAsset } from '../../lib/types'
import { formatBytes, formatTime, uid } from '../../lib/utils'
import { Spinner } from '../ui'
import { useI18n } from '../../lib/i18n'

export function useMediaImport() {
  const store = useEditor()
  const [progressName, setProgressName] = useState<string | null>(null)

  const importFiles = async (files: FileList | File[] | null, asReference = false) => {
    const projectId = store.project?.id
    if (!projectId || !files) return
    for (const file of Array.from(files)) {
      const type = typeOf(file)
      if (!type) {
        alert(`Unsupported file: ${file.name}`)
        continue
      }
      setProgressName(file.name)
      const id = uid('med')
      await db.putBlob(id, file)
      const meta: MediaAsset = {
        id, projectId, name: file.name, type,
        mimeType: file.type || '', size: file.size,
        role: asReference ? 'reference' : 'media',
        createdAt: Date.now(),
      }
      store.setAssetAnalyzed(id, true)
      try {
        if (type === 'image') Object.assign(meta, await analyzeImage(file))
        else if (type === 'video') {
          Object.assign(meta, await analyzeVideo(file))
          if (asReference && meta.duration && meta.duration > 1) {
            const ra = await analyzeReference(file, meta.duration)
            if (ra) meta.analysis = ra
          }
        } else Object.assign(meta, await analyzeAudio(file))
      } catch {
        // analysis failed — asset still usable; never fake results
      }
      await db.putMedia(meta)
      useEditor.getState().addAssets([meta], new Map([[id, file]]))
      store.setAssetAnalyzed(id, false)
      setProgressName(null)

      // auto beat detection for music
      if (type === 'audio' && !asReference) {
        store.setAssetAnalyzed(id + ':beats', true)
        try {
          const bm = await detectBeats(file)
          if (bm && (bm.bpm > 0 || bm.beats.length)) {
            useEditor.getState().setBeatMap({ ...bm, mediaId: id })
          }
        } finally {
          store.setAssetAnalyzed(id + ':beats', false)
        }
      }
    }
  }

  return { importFiles, progressName }
}

export default function MediaPanel() {
  const store = useEditor()
  const { t } = useI18n()
  const { importFiles, progressName } = useMediaImport()
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)

  const addAssetToTimeline = (a: MediaAsset) => {
    const p = store.project
    if (!p) return
    store.mutate((d) => {
      const vt = d.tracks.find((x) => x.kind === 'video')!
      if (a.type === 'audio') {
        const at = d.tracks.find((x) => x.kind === 'audio')
        if (at) {
          const end = at.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
          at.clips.push({
            id: uid('clip'), trackId: at.id, kind: 'audio', mediaId: a.id, name: a.name,
            start: 0, duration: Math.min(a.duration ?? 10, 600), inPoint: 0, speed: 1,
            volume: 0.9, muted: false, fadeIn: 0.15, fadeOut: 1.1,
            motion: { type: 'none', intensity: 0 }, effects: [], colorGrade: 'none',
            transitionIn: { style: 'none', duration: 0 }, opacity: 1,
          })
          void end
        }
        return
      }
      const end = vt.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      const dur = a.type === 'image' ? Math.max(1.5, Math.min(a.duration ?? 2.5, 4)) : a.duration ?? 3
      vt.clips.push({
        id: uid('clip'), trackId: vt.id, kind: a.type, mediaId: a.id, name: a.name,
        start: end, duration: dur, inPoint: 0, speed: 1,
        volume: a.type === 'video' ? 0.85 : 0, muted: a.type === 'image',
        fadeIn: 0, fadeOut: 0, motion: a.type === 'image' ? { type: 'kenburns', intensity: 0.55 } : { type: 'none', intensity: 0 },
        effects: [], colorGrade: 'none', transitionIn: { style: 'none', duration: 0 }, opacity: 1,
      })
    })
  }

  const addAllPhotos = () => {
    const images = store.assets.filter((a) => a.type === 'image')
    if (!images.length) return
    store.mutate((d) => {
      const vt = d.tracks.find((x) => x.kind === 'video')!
      let end = vt.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      for (const a of images) {
        vt.clips.push({
          id: uid('clip'), trackId: vt.id, kind: 'image', mediaId: a.id, name: a.name,
          start: end, duration: 2.4, inPoint: 0, speed: 1, volume: 0, muted: true,
          fadeIn: 0, fadeOut: 0, motion: { type: 'kenburns', intensity: 0.55 },
          effects: [], colorGrade: 'none', transitionIn: { style: 'none', duration: 0 }, opacity: 1,
        })
        end += 2.4
      }
    })
  }

  const beat = store.project?.beatMap
  const audioAsset = store.assets.find((a) => a.type === 'audio')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* dropzone */}
      <div className="p-3">
        <div
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all ${drag ? 'border-star-500 bg-star-500/10' : 'border-white/12 bg-white/[0.02] hover:border-white/25'}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void importFiles(e.dataTransfer.files)
          }}
        >
          <Upload size={22} className="text-star-400" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-200">{t('ed.dropTitle')}</p>
          <p className="text-[11px] text-zinc-500">{t('ed.dropOr')}</p>
          <button className="btn-ghost mt-3 !px-3 !py-1.5 !text-[12px]" onClick={() => inputRef.current?.click()}>
            <Plus size={13} /> {t('ed.import')}
          </button>
          <button
            className="btn-ghost mt-1.5 !px-3 !py-1 !text-[11px] !text-zinc-400"
            onClick={() => refInputRef.current?.click()}
            title={t('ed.referenceHint')}
          >
            <BookOpen size={12} /> {t('ed.addRef')}
          </button>
          <p className="mt-2 text-[9.5px] leading-relaxed text-zinc-600">MP4 · MOV · WebM · PNG · JPG · GIF · MP3 · WAV · M4A</p>
          <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => { void importFiles(e.target.files); e.currentTarget.value = '' }} />
          <input ref={refInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm" className="hidden" onChange={(e) => { void importFiles(e.target.files, true); e.currentTarget.value = '' }} />
          {progressName && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-ink-950/85 backdrop-blur-sm">
              <Spinner size={20} />
              <span className="max-w-[80%] truncate text-[11px] text-zinc-400">{t('ed.analyzing')} {progressName}</span>
            </div>
          )}
        </div>
      </div>

      {/* beat map card */}
      {audioAsset && (
        <div className="mx-3 mb-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-200">
            <Waves size={13} className="text-star-400" /> {t('ed.beatMap')}
            {store.analyzing[`${audioAsset.id}:beats`] && <Spinner size={12} />}
          </div>
          {beat ? (
            <>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="chip !border-star-500/30 !text-star-300">{beat.bpm} BPM</span>
                <span>{beat.beats.length} beats</span>
                <span>conf {Math.round(beat.confidence * 100)}%</span>
              </div>
              {beat.approximate && <p className="mt-1 text-[10px] text-amber-400/80">{t('ed.beatApprox')}</p>}
              <div className="mt-2 flex h-8 items-end gap-[1.5px] overflow-hidden rounded bg-black/30 px-1 py-1">
                {(audioAsset.peaks ?? []).slice(0, 120).map((v, i) => (
                  <span
                    key={i}
                    className={`w-full rounded-sm ${beat.drops.some((d) => Math.abs(d - (i / 120) * (audioAsset.duration ?? 0)) < 0.35) ? 'bg-red-400/80' : 'bg-star-400/60'}`}
                    style={{ height: `${Math.max(8, v * 100)}%` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-500">{t('ed.noBeats')}</p>
          )}
        </div>
      )}

      {/* actions */}
      {store.assets.some((a) => a.type === 'image') && (
        <div className="px-3 pb-2">
          <button className="btn-ghost w-full !py-1.5 !text-[12px]" onClick={addAllPhotos}>
            <Zap size={13} className="text-star-400" /> {t('ed.addAllPhotos')}
          </button>
        </div>
      )}

      {/* asset grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {store.assets.length === 0 ? (
          <p className="mt-6 px-2 text-center text-[12px] leading-relaxed text-zinc-600">
            {t('ed.empty')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {store.assets.map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-lg border border-white/8 bg-ink-850">
                <button className="block w-full" onClick={() => addAssetToTimeline(a)} title="Click to add to timeline">
                  <div className="flex aspect-[4/3] items-center justify-center bg-black/40">
                    {a.thumb ? (
                      <img src={a.thumb} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : a.type === 'audio' ? (
                      <Music size={22} className="text-star-400" />
                    ) : a.type === 'video' ? (
                      <Film size={22} className="text-zinc-500" />
                    ) : (
                      <ImageIcon size={22} className="text-zinc-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-1 text-start">
                    <span className="truncate text-[10px] text-zinc-300">{a.name}</span>
                  </div>
                </button>
                <div className="absolute start-1 top-1 flex gap-1">
                  <span className="chip !px-1 !py-0 !text-[8.5px] !bg-black/70">
                    {a.type === 'audio' ? <Mic2 size={8} /> : a.type === 'video' ? <Film size={8} /> : <ImageIcon size={8} />}
                    {a.duration ? formatTime(a.duration) : a.type.toUpperCase()}
                  </span>
                  {a.role === 'reference' && <span className="chip !px-1 !py-0 !text-[8.5px] !border-amber-500/40 !text-amber-300 !bg-black/70">REF</span>}
                </div>
                {store.analyzing[a.id] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Spinner size={16} /></div>
                )}
                <button
                  className="absolute end-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-black/70 text-red-400 hover:bg-black group-hover:flex"
                  onClick={() => void store.removeAsset(a.id)}
                  title="Remove"
                >
                  <Trash2 size={11} />
                </button>
                {a.analysis && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-0.5 text-[8.5px] text-zinc-300">
                    ref: ~{a.analysis.avgShotDuration.toFixed(1)}s/shot · {a.analysis.cuts} cuts
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {store.assets.length > 0 && (
          <p className="mt-3 text-center text-[10px] text-zinc-600">
            {t('ed.total')} {formatBytes(store.assets.reduce((n, a) => n + a.size, 0))} — {t('ed.storedLocal')}
          </p>
        )}
      </div>
    </div>
  )
}
