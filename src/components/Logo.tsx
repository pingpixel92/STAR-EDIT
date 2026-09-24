// STAR EDIT logo — original mark: star + play fusion
export function LogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#7c5cf6" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="15" fill="#0d0d18" stroke="url(#lg)" strokeWidth="2.5" />
      <path d="M32 12l4.7 12.2L50 26l-10 8.2 3.2 13-11.2-7.2L20.8 47 24 34 14 26l13.3-1.8z" fill="url(#lg)" />
      <path d="M28.5 30.5v13l11-6.5z" fill="#fff" opacity="0.95" />
    </svg>
  )
}

export function LogoWord({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <LogoMark size={compact ? 28 : 34} className="drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]" />
      <span className="font-extrabold tracking-tight text-[17px] leading-none">
        <span className="text-white">STAR</span>
        <span className="text-gradient"> EDIT</span>
      </span>
    </span>
  )
}
