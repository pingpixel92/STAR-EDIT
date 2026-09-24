import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Film, X } from 'lucide-react'
import { Modal, Progress, Select } from '../ui'
import { useI18n } from '../../lib/i18n'
import { useEditor } from '../../lib/store'
import { useEditorCtx } from '../../pages/EditorPage'
import { supportedFormats, exportVideo, type CancelToken } from '../../engine/exporter'
import { downloadBlob, formatBytes, formatTime } from '../../lib/utils'
import { aspectOf } from '../../lib/utils'

type Stage = 'idle' | 'preparing' | 'rendering' | 'encoding' | 'done' | 'error'

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const store = useEditor()
  const { controller } = useEditorCtx()
  const formats = useMemo(() => (open ? supportedFormats() : []), [open])
  const [fmtIdx, setFmtIdx] = useState(0)
  const [resH, setResH] = useState(1080)
  const [fps, setFps] = useState<24 | 30 | 60>(30)
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard')
  const [stage, setStage] = useState<Stage>('idle')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ url: string; size: number; ext: string } | null>(null)
  const cancelRef = useRef<CancelToken | null>(null)

  const p = store.project
  const aspect = p ? aspectOf(p.aspect) : 9 / 16

  useEffect(() => {
    if (open) {
      setStage('idle')
      setPct(0)
      setErr('')
      setResult(null)
      setFmtIdx(0)
      // stop playback during export
      store.setPlaying(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const width = Math.round((resH * aspect) / 2) * 2

  const start = async () => {
    if (!p || !controller) return
    const fmt = formats[fmtIdx]
    if (!fmt) {
      setErr(t('ex.unsupported'))
      setStage('error')
      return
    }
    setStage('preparing')
    setPct(0)
    setErr('')
    setResult(null)
    const token: CancelToken = { cancelled: false }
    cancelRef.current = token
    try {
      const { blob } = await exportVideo(
        p,
        controller.env,
        controller.buffers,
        { width, height: resH, fps, quality, mimeType: fmt.mime },
        {
          onStage: (s, v) => {
            if (s === 'preparing') setStage('preparing')
            else if (s === 'rendering') {
              setStage('rendering')
              setPct(v)
            }
          },
        },
        token
      )
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(blob)
      setResult({ url, size: blob.size, ext })
      setStage('done')
      downloadBlob(blob, `${p.name.replace(/\s+/g, '_')}.${ext}`)
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') {
        setStage('idle')
      } else {
        setErr(e instanceof Error ? e.message : 'Export failed')
        setStage('error')
      }
    }
  }

  const busy = stage === 'preparing' || stage === 'rendering' || stage === 'encoding'
  const stageLabel =
    stage === 'preparing' ? t('ex.stages').split('|')[0]
    : stage === 'rendering' ? t('ex.stages').split('|')[1]
    : stage === 'encoding' ? t('ex.stages').split('|')[2]
    : stage === 'done' ? t('ex.done') : ''

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={t('ex.title')} wide>
      {stage === 'done' && result ? (
        <div className="space-y-4 text-center">
          <Film size={40} className="mx-auto text-star-400" />
          <h3 className="text-lg font-extrabold">{t('ex.done')}</h3>
          <p dir="ltr" className="text-[12px] text-zinc-500">
            {formatBytes(result.size)} · {width}×{resH} · {result.ext.toUpperCase()} — file downloaded automatically
          </p>
          <video src={result.url} controls className="mx-auto max-h-[300px] rounded-xl border border-white/10" />
          <div className="flex justify-center gap-2">
            <a className="btn-accent" href={result.url} download={`${p?.name ?? 'star-edit'}.${result.ext}`}>
              <Download size={15} /> {t('ex.download')}
            </a>
            <button className="btn-ghost" onClick={onClose}>{t('ex.close')}</button>
          </div>
        </div>
      ) : busy ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between text-[13px] font-semibold">
            <span>{stageLabel}…</span>
            <span className="tabular-nums text-star-300">{Math.round(pct * 100)}%</span>
          </div>
          <Progress value={pct} />
          <p className="text-[11.5px] leading-relaxed text-zinc-500">{t('ex.realtime')}</p>
          <button
            className="btn-ghost w-full !border-red-500/30 !text-red-400"
            onClick={() => {
              if (cancelRef.current) cancelRef.current.cancelled = true
              setStage('idle')
            }}
          >
            <X size={14} /> {t('ex.cancel')}
          </button>
        </div>
      ) : stage === 'error' ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12.5px] text-red-200">{err}</p>
          <button className="btn-ghost w-full" onClick={() => setStage('idle')}>{t('common.close')}</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('ex.res')}
              value={String(resH)}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p' },
                { value: '1440', label: '1440p' },
              ]}
              onChange={(v) => setResH(parseInt(v, 10))}
            />
            <Select
              label={t('ex.fps')}
              value={String(fps)}
              options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]}
              onChange={(v) => setFps(parseInt(v, 10) as 24 | 30 | 60)}
            />
          </div>
          {formats.length > 0 ? (
            <Select
              label={t('ex.fmt')}
              value={String(fmtIdx)}
              options={formats.map((f, i) => ({ value: String(i), label: f.label }))}
              onChange={(v) => setFmtIdx(parseInt(v, 10))}
            />
          ) : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[12px] text-amber-200">{t('ex.unsupported')}</p>
          )}
          <Select
            label={t('ex.q')}
            value={quality}
            options={[
              { value: 'draft', label: 'Draft (~3 Mbps)' },
              { value: 'standard', label: 'Standard (~7 Mbps)' },
              { value: 'high', label: 'High (~14 Mbps)' },
            ]}
            onChange={(v) => setQuality(v as 'draft' | 'standard' | 'high')}
          />
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-zinc-400">
            <p>{t('ex.realtime')}</p>
            <p className="mt-1.5">{t('ex.info').replace('{d}', formatTime(p?.duration ?? 0))}</p>
          </div>
          <button className="btn-accent w-full !py-3" disabled={!formats.length} onClick={() => void start()}>
            <Download size={16} /> {t('ex.start')}
          </button>
        </div>
      )}
    </Modal>
  )
}
