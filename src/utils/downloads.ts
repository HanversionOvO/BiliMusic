import type { Track } from '@/types'
import { loadAppSettings } from '@/utils/storage'
import { downloadAudio, existsLocalAudio, extractAudio } from '@/services/api'

export type DownloadStatus = 'downloading' | 'completed' | 'failed'

export interface DownloadItem {
  id: string
  trackId: string
  bvid: string
  title: string
  artist: string
  coverUrl: string
  duration: number
  filePath?: string
  size?: number
  status: DownloadStatus
  error?: string
  createdAt: string
}

const DOWNLOADS_KEY = 'bilimusic_downloads'
export const DOWNLOADS_CHANGED_EVENT = 'bilimusic:downloads-changed'

function notifyChanged() {
  window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT))
}

export function loadDownloads(): DownloadItem[] {
  try {
    const raw = localStorage.getItem(DOWNLOADS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveDownloads(items: DownloadItem[]) {
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items))
    notifyChanged()
  } catch { /* ignore */ }
}

function patchDownload(id: string, patch: Partial<DownloadItem>) {
  saveDownloads(loadDownloads().map(item => item.id === id ? { ...item, ...patch } : item))
}

export function removeDownload(id: string) {
  saveDownloads(loadDownloads().filter(item => item.id !== id))
}

// 与磁盘状态同步：本地文件被外部删除后，清掉对应的已完成记录
export async function syncDownloadsWithDisk(): Promise<void> {
  const items = loadDownloads().filter(item => item.status === 'completed' && item.filePath)
  if (!items.length) return
  const existing = await Promise.all(items.map(item => existsLocalAudio(item.filePath!)))
  const missingIds = new Set(items.filter((_, i) => !existing[i]).map(item => item.id))
  if (missingIds.size) {
    saveDownloads(loadDownloads().filter(item => !missingIds.has(item.id)))
  }
}

export function getDownloadByTrackId(trackId: string): DownloadItem | undefined {
  return loadDownloads().find(item => item.trackId === trackId && item.status !== 'failed')
}

function buildFilename(track: Track): string {
  const clean = (s: string) => s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'untitled'
  return `${clean(track.title)} - ${clean(track.artist)}.m4a`
}

export async function downloadTrack(track: Track): Promise<void> {
  const existing = getDownloadByTrackId(track.id)
  if (existing) return

  const id = `${track.id}_${Date.now()}`
  saveDownloads([{
    id,
    trackId: track.id,
    bvid: track.bvid,
    title: track.title,
    artist: track.artist,
    coverUrl: track.coverUrl,
    duration: track.duration,
    status: 'downloading',
    createdAt: new Date().toISOString(),
  }, ...loadDownloads()])

  try {
    const fallback = track.aid && track.cid ? { aid: track.aid, cid: track.cid } : undefined
    const source = await extractAudio(track.bvid || track.id, fallback)
    const { downloadDir } = loadAppSettings()
    const result = await downloadAudio(source.audioUrl, buildFilename(track), downloadDir)
    patchDownload(id, { status: 'completed', filePath: result.filePath, size: result.size })
  } catch (err) {
    patchDownload(id, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
  }
}

export function formatDownloadSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 渲染进程启动时恢复上次会话遗留的下载状态，避免条目永久卡在「下载中」
{
  const stored = loadDownloads()
  if (stored.some(item => item.status === 'downloading')) {
    saveDownloads(stored.map(item =>
      item.status === 'downloading' ? { ...item, status: 'failed' as const, error: '下载被中断' } : item,
    ))
  }
}
