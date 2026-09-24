import { useCallback, useEffect, useState } from 'react'
import { Plus, Film, Trash2, Pencil, Copy, FolderOpen, FileJson, HardDrive, ChevronLeft } from 'lucide-react'
import { LogoWord } from '../components/Logo'
import { Modal, Field, Spinner } from '../components/ui'
import { navigate } from '../App'
import { useI18n } from '../lib/i18n'
import * as db from '../lib/db'
import { useEditor } from '../lib/store'
import { ASPECTS, type AspectId, type Project } from '../lib/types'
import { downloadBlob, formatTime, uid } from '../lib/utils'

function ProjectCard({ p, onAction }: { p: Project; onAction: (a: 'open' | 'rename' | 'duplicate' | 'delete' | 'json') => void }) {
  const { t } = useI18n()
  return (
    <div className="glass group overflow-hidden rounded-2xl transition-all hover:border-star-500/40 hover:shadow-glow-sm">
      <button onClick={() => onAction('open')} className="block w-full text-start" aria-label={p.name}>
        <div className="relative aspect-video w-full overflow-hidden bg-ink-900">
          {p.tracks.some((tr) => tr.clips.some((c) => c.kind === 'image')) ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-star-600/20 to-pulse-600/10">
              <Film size={30} className="text-star-400/70" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-900">
              <Film size={30} className="text-zinc-700" />
            </div>
          )}
          <span className="absolute bottom-2 end-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {formatTime(p.duration)}
          </span>
          <span className="absolute start-2 top-2 chip !bg-black/60">{p.aspect}</span>
        </div>
      </button>
      <div className="p-4">
        <h3 className="truncate text-sm font-bold">{p.name}</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {t('projects.local')} · {new Date(p.updatedAt).toLocaleString()}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <button className="btn-icon" title={t('projects.open')} onClick={() => onAction('open')}><FolderOpen size={14} /></button>
          <button className="btn-icon" title={t('projects.rename')} onClick={() => onAction('rename')}><Pencil size={14} /></button>
          <button className="btn-icon" title={t('projects.duplicate')} onClick={() => onAction('duplicate')}><Copy size={14} /></button>
          <button className="btn-icon" title={t('projects.exportJson')} onClick={() => onAction('json')}><FileJson size={14} /></button>
          <button className="btn-icon ms-auto hover:!border-red-500/40 hover:!text-red-400" title={t('projects.delete')} onClick={() => onAction('delete')}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [rename, setRename] = useState<Project | null>(null)
  const [confirmDel, setConfirmDel] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [aspect, setAspect] = useState<AspectId>('9:16')
  const [fps, setFps] = useState<24 | 30 | 60>(30)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setProjects(await db.allProjects())
  }, [])

  useEffect(() => {
    void refresh()
    if (window.location.hash.includes('new=1')) {
      setNewOpen(true)
      window.location.hash = '/projects'
    }
  }, [refresh])

  const create = async () => {
    setBusy(true)
    try {
      const store = useEditor.getState()
      const p = await store.newProject({ name: name.trim() || 'Untitled Edit', aspect, fps })
      navigate(`/editor/${p.id}`)
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (p: Project) => {
    const copy: Project = JSON.parse(JSON.stringify(p))
    copy.id = uid('prj')
    copy.name = `${p.name} (copy)`
    copy.createdAt = Date.now()
    copy.updatedAt = Date.now()
    copy.versions = []
    await db.putProject(copy)
    void refresh()
  }

  const remove = async (p: Project) => {
    await db.deleteProject(p.id)
    const assets = await db.mediaForProject(p.id)
    for (const a of assets) await db.deleteMedia(a.id)
    void refresh()
  }

  const exportJson = (p: Project) => {
    // Project structure only — media files stay local by design (no huge blobs in JSON)
    const data = {
      format: 'star-edit-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      note: 'Media files are not embedded; re-import media after importing this JSON.',
      project: { ...p, versions: p.versions.map((v) => ({ ...v })) },
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${p.name.replace(/\s+/g, '_')}.staredit.json`)
  }

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (data?.format !== 'star-edit-project' || !data?.project?.id) throw new Error('bad format')
      const p: Project = { ...data.project, id: uid('prj'), name: `${data.project.name} (imported)` }
      await db.putProject(p)
      void refresh()
    } catch {
      alert('Invalid STAR EDIT project file')
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/85 backdrop-blur-xl">
        <div className="section-pad flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="btn-icon" onClick={() => navigate('/')} aria-label="Back"><ChevronLeft size={16} /></button>
            <LogoWord compact />
          </div>
          <div className="flex items-center gap-2">
            <label className="btn-ghost cursor-pointer">
              <FileJson size={15} /> {t('projects.importJson')}
              <input
                type="file" accept=".json" className="hidden"
                onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])}
              />
            </label>
            <button className="btn-accent !px-4 !py-2" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> {t('projects.new')}
            </button>
          </div>
        </div>
      </header>

      <main className="section-pad py-10">
        <h1 className="text-2xl font-extrabold">{t('projects.title')}</h1>
        {projects === null ? (
          <div className="mt-16 flex justify-center"><Spinner size={26} /></div>
        ) : projects.length === 0 ? (
          <div className="glass mt-8 flex flex-col items-center rounded-3xl p-14 text-center">
            <Film size={44} className="text-star-500/60" />
            <p className="mt-4 text-sm text-zinc-400">{t('projects.empty')}</p>
            <button className="btn-accent mt-6" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> {t('projects.new')}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                onAction={(a) => {
                  if (a === 'open') navigate(`/editor/${p.id}`)
                  else if (a === 'rename') { setRename(p); setName(p.name) }
                  else if (a === 'duplicate') void duplicate(p)
                  else if (a === 'json') exportJson(p)
                  else setConfirmDel(p)
                }}
              />
            ))}
          </div>
        )}
        <div className="mt-10 flex items-center gap-2 text-[12px] text-zinc-500">
          <HardDrive size={13} /> Projects are stored locally in your browser (IndexedDB).
        </div>
      </main>

      {/* New project */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('np.title')}>
        <div className="space-y-4">
          <Field label={t('np.name')}>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="My first edit" autoFocus />
          </Field>
          <Field label={t('np.aspect')}>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(ASPECTS) as AspectId[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  className={`rounded-lg border px-1 py-2.5 text-center transition-all ${aspect === a ? 'border-star-500 bg-star-500/15 shadow-glow-sm' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                >
                  <div className="mx-auto mb-1.5 rounded-sm border border-current text-[9px] text-zinc-400" style={{ width: a === '9:16' ? 12 : 20, height: a === '9:16' ? 21 : a === '16:9' ? 12 : a === '21:9' ? 9 : 16 }} />
                  <span className="text-[10px] font-bold">{a}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">{ASPECTS[aspect].label}</p>
          </Field>
          <Field label={t('np.fps')}>
            <div className="grid grid-cols-3 gap-2">
              {([24, 30, 60] as const).map((f) => (
                <button key={f} onClick={() => setFps(f)} className={`rounded-lg border py-2 text-sm font-bold transition-all ${fps === f ? 'border-star-500 bg-star-500/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
          <button className="btn-accent w-full !py-3" disabled={busy} onClick={() => void create()}>
            {busy ? <Spinner /> : <Plus size={16} />} {t('np.create')}
          </button>
        </div>
      </Modal>

      {/* Rename */}
      <Modal open={!!rename} onClose={() => setRename(null)} title={t('projects.rename')}>
        <div className="space-y-4">
          <Field label={t('np.name')}>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn-accent flex-1 !py-2.5"
              onClick={async () => {
                if (rename) {
                  await db.putProject({ ...rename, name: name.trim() || rename.name })
                  void refresh()
                }
                setRename(null)
              }}
            >
              {t('common.save')}
            </button>
            <button className="btn-ghost" onClick={() => setRename(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title={t('projects.delete')}>
        <p className="text-sm text-zinc-300">
          “{confirmDel?.name}” — {t('st.confirmClear') === 'x' ? '' : ''}{t('common.confirm')}?
        </p>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1 !border-red-500/40 !text-red-400" onClick={async () => { if (confirmDel) await remove(confirmDel); setConfirmDel(null) }}>
            {t('projects.delete')}
          </button>
          <button className="btn-ghost flex-1" onClick={() => setConfirmDel(null)}>{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
