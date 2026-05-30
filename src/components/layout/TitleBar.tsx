import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import appIcon from '@/assets/icon.png'

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.isMaximized?.().then(setMaximized).catch(() => {})
    return api.onMaximizedChange?.(setMaximized)
  }, [])

  return (
    <div className="app-titlebar">
      <div className="app-titlebar__brand">
        <img src={appIcon} alt="" className="app-titlebar__logo" draggable={false} />
        BiliMusic
      </div>

      <div className="app-titlebar__controls">
        <WindowButton icon={<Minus size={14} />} action="minimize" label="最小化" />
        <WindowButton icon={maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />} action="maximize" label={maximized ? '还原窗口' : '最大化'} />
        <WindowButton icon={<X size={15} />} action="close" label="关闭" isClose />
      </div>
    </div>
  )
}

function WindowButton({
  icon,
  action,
  label,
  isClose = false,
}: {
  icon: React.ReactNode
  action: 'minimize' | 'maximize' | 'close'
  label: string
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
      type="button"
      aria-label={label}
      title={label}
      className={`app-window-button ${isClose ? 'app-window-button--close' : ''}`}
      onClick={handleClick}
    >
      {icon}
    </button>
  )
}
