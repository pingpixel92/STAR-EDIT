// Small shared UI kit
import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('glass-strong relative z-10 w-full rounded-2xl shadow-card', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
          <h3 className="text-sm font-bold tracking-wide text-white">{title}</h3>
          <button className="btn-icon h-8 w-8" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  )
}

export function Slider({
  value, min, max, step, onChange, onCommit, label, format,
}: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void
  /** called ONCE before the first change of a gesture — captures the pre-change undo snapshot */
  onCommit?: () => void
  label: string; format?: (v: number) => string
}) {
  const armed = useRef(false)
  const arm = () => {
    if (!armed.current) {
      armed.current = true
      onCommit?.()
    }
  }
  const disarm = () => {
    armed.current = false
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-300">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerDown={arm}
        onPointerUp={disarm}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) arm()
        }}
        onBlur={disarm}
        aria-label={label}
      />
    </div>
  )
}

export function Select<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="space-y-1">
      {label && <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>}
      <select className="field" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-white/20 border-t-star-400', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="loading"
    />
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-gradient-to-r from-star-500 to-pulse-500 transition-[width] duration-150"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-gradient-to-r from-star-500 to-pulse-500' : 'bg-white/12'
      )}
    >
      <span
        className={cn(
          'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        )}
        style={{ width: 18, height: 18 }}
      />
      {label && <span className="ms-2 text-xs text-zinc-300">{label}</span>}
    </button>
  )
}
