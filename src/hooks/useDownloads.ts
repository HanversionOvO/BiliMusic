import { useSyncExternalStore } from 'react'
import { DOWNLOADS_CHANGED_EVENT, loadDownloads, type DownloadItem } from '@/utils/downloads'

let cache: DownloadItem[] = loadDownloads()

function subscribe(onChange: () => void) {
  const handler = () => {
    cache = loadDownloads()
    onChange()
  }
  window.addEventListener(DOWNLOADS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, handler)
}

export function useDownloads(): DownloadItem[] {
  return useSyncExternalStore(subscribe, () => cache)
}
