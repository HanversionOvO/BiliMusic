import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div
      style={{
        height: 36,
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 16,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 14,
          color: 'var(--color-primary)',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        biliMusic
      </span>

      <div
        style={{
          position: 'absolute',
          right: 0,
          display: 'flex',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <WindowButton icon={<Minus size={14} />} action="minimize" />
        <WindowButton icon={<Square size={12} />} action="maximize" />
        <WindowButton icon={<X size={14} />} action="close" isClose />
      </div>
    </div>
  )
}

function WindowButton({
  icon,
  action,
  isClose = false,
}: {
  icon: React.ReactNode
  action: 'minimize' | 'maximize' | 'close'
  isClose?: boolean
}) {
  const handleClick = () => {
    const api = window.electronAPI
    if (!api) return
    if (action === 'minimize') api.minimize()
    else if (action === 'maximize') api.maximize()
    else if (action === 'close') api.close()
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: 46,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-muted)',
        cursor: 'pointer',
        transition: 'all var(--duration-fast) var(--easing-default)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isClose
          ? 'var(--color-destructive)'
          : 'var(--color-border)'
        if (isClose) e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-muted)'
      }}
    >
      {icon}
    </button>
  )
}