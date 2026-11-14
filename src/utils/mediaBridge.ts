/**
 * Android 媒体服务桥（Capacitor）
 *
 * - syncState：把当前曲目/播放态推给原生 MediaPlaybackService（更新通知栏）。
 * - bilimusic:media-command 事件：通知栏按钮命令（play/pause/next/prev）回传。
 *
 * 仅 Android WebView 环境生效；Electron/浏览器为空实现。
 */

export const MEDIA_COMMAND_EVENT = 'bilimusic:media-command'
const MEDIA_SEEK_EVENT = 'bilimusic:media-seek'

function isAndroidWeb(): boolean {
  return /Android/i.test(navigator.userAgent) && !window.electronAPI && Boolean((window as any).Capacitor)
}

export function onMediaCommand(handler: (command: 'play' | 'pause' | 'next' | 'prev') => void): () => void {
  const listener = (e: Event) => {
    const cmd = (e as CustomEvent<string>).detail
    if (cmd === 'play' || cmd === 'pause' || cmd === 'next' || cmd === 'prev') handler(cmd)
  }
  window.addEventListener(MEDIA_COMMAND_EVENT, listener)
  return () => window.removeEventListener(MEDIA_COMMAND_EVENT, listener)
}

export function onMediaSeek(handler: (position: number) => void): () => void {
  const listener = (event: Event) => {
    const position = (event as CustomEvent<unknown>).detail
    if (typeof position === 'number' && Number.isFinite(position)) handler(Math.max(0, position))
  }
  window.addEventListener(MEDIA_SEEK_EVENT, listener)
  return () => window.removeEventListener(MEDIA_SEEK_EVENT, listener)
}

export async function syncMediaState(state: {
  title: string
  artist: string
  coverUrl: string
  playing: boolean
  position: number
  duration: number
}): Promise<void> {
  if (!isAndroidWeb()) return
  try {
    const Capacitor = (window as any).Capacitor
    await Capacitor?.Plugins?.MediaBridge?.syncState?.(state)
  } catch {
    // 通知不可用（如用户禁用通知权限）时静默降级，不影响播放
  }
}

export async function stopMediaService(): Promise<void> {
  if (!isAndroidWeb()) return
  try {
    const Capacitor = (window as any).Capacitor
    await Capacitor?.Plugins?.MediaBridge?.stop?.()
  } catch { /* ignore */ }
}
