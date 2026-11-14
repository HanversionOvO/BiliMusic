import { useEffect } from 'react'
import { isSyncing, isSyncSupported, runSync, WEBDAV_CONFIGURED_EVENT } from '@/utils/sync'
import { webdavGetConfig } from '@/utils/webdavWeb'
import { FAVORITES_CHANGED_EVENT, PLAYLISTS_CHANGED_EVENT } from '@/utils/storage'

const DEBOUNCE = 5000
const PERIODIC = 15 * 60 * 1000
const STARTUP_DELAY = 3000

// 自动同步：启动一次 + 歌单/收藏改动防抖 + 周期兜底。仅在已配置 WebDAV 时启用。
// 防回环关键：同步自身写入会触发 CHANGED 事件，isSyncing() 时一律忽略，否则无限循环。
export function useAutoSync(): void {
  useEffect(() => {
    if (!isSyncSupported()) return

    let configured = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let periodicTimer: ReturnType<typeof setInterval> | null = null

    const sync = () => {
      if (configured && !isSyncing()) void runSync()
    }
    const onChange = () => {
      if (!configured || isSyncing()) return // 忽略同步自身写入触发的变更
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(sync, DEBOUNCE)
    }
    const enable = () => {
      if (configured) return
      configured = true
      setTimeout(sync, STARTUP_DELAY) // 启动后延迟同步，避开启动高峰
      if (!periodicTimer) periodicTimer = setInterval(sync, PERIODIC)
    }

    // Electron：主进程查询；WebView（Android）：localStorage 查询
    const api = window.electronAPI
    if (api?.getWebdavConfig) {
      api.getWebdavConfig().then((c) => {
        if (c?.configured) enable()
      })
    } else {
      if (webdavGetConfig().configured) enable()
    }

    window.addEventListener(PLAYLISTS_CHANGED_EVENT, onChange)
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChange)
    window.addEventListener(WEBDAV_CONFIGURED_EVENT, enable) // Settings 保存配置后实时启用

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (periodicTimer) clearInterval(periodicTimer)
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, onChange)
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onChange)
      window.removeEventListener(WEBDAV_CONFIGURED_EVENT, enable)
    }
  }, [])
}
