import type { Playlist, Tombstone, Track } from '@/types'
import {
  loadFavoriteTombstones,
  loadFavoriteTracks,
  loadPlaylistTombstones,
  loadPlaylists,
  saveFavoriteTombstones,
  saveFavoriteTracks,
  savePlaylistTombstones,
  savePlaylists,
} from './storage'

const SYNC_FILE = 'sync.json'
const DEVICE_ID_KEY = 'bilimusic_device_id'
const LAST_SYNC_KEY = 'bilimusic_last_sync'
const EPOCH = '1970-01-01T00:00:00.000Z'

export const SYNC_STATE_EVENT = 'bilimusic:sync-state'
export const WEBDAV_CONFIGURED_EVENT = 'bilimusic:webdav-configured'

export interface SyncPayload {
  app: 'biliMusic'
  type: 'sync'
  version: 1
  deviceId: string
  syncedAt: string
  playlists: Playlist[]
  playlistTombstones: Tombstone[]
  favorites: Track[]
  favoriteTombstones: Tombstone[]
}

export interface SyncResult {
  ok: boolean
  message: string
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `dev_${Date.now()}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getLastSync(): string {
  return localStorage.getItem(LAST_SYNC_KEY) || ''
}
function setLastSync(at: string): void {
  localStorage.setItem(LAST_SYNC_KEY, at)
  window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT))
}

// 墓碑合并：同 id 取较晚的 deletedAt
function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const map = new Map<string, string>()
  for (const t of [...a, ...b]) {
    const prev = map.get(t.id)
    if (!prev || t.deletedAt > prev) map.set(t.id, t.deletedAt)
  }
  return [...map.entries()].map(([id, deletedAt]) => ({ id, deletedAt }))
}

// 通用双向合并：按 id 取版本时间戳较新者；墓碑晚于版本则删除胜出；存活项的墓碑被剪除。
// ISO 8601 字符串可直接字典序比较时间先后。
function mergeItems<T>(
  local: T[],
  remote: T[],
  localTombs: Tombstone[],
  remoteTombs: Tombstone[],
  getId: (t: T) => string,
  getVersion: (t: T) => string,
): { items: T[]; tombstones: Tombstone[] } {
  const tombs = mergeTombstones(localTombs, remoteTombs)
  const tombById = new Map(tombs.map((t) => [t.id, t.deletedAt]))

  const byId = new Map<string, T>()
  for (const item of [...local, ...remote]) {
    const id = getId(item)
    const existing = byId.get(id)
    if (!existing || getVersion(item) > getVersion(existing)) byId.set(id, item)
  }

  const items: T[] = []
  const survivingIds = new Set<string>()
  for (const item of byId.values()) {
    const id = getId(item)
    const deletedAt = tombById.get(id)
    if (deletedAt && deletedAt >= getVersion(item)) continue // 删除胜出
    items.push(item)
    survivingIds.add(id)
  }
  const tombstones = tombs.filter((t) => !survivingIds.has(t.id)) // 已被更新版本取代的墓碑剪除
  return { items, tombstones }
}

function parsePayload(content: string | null): Partial<SyncPayload> | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as Partial<SyncPayload>
    if (!Array.isArray(parsed.playlists) && !Array.isArray(parsed.favorites)) return null
    return parsed
  } catch {
    return null
  }
}

function buildPayload(
  playlists: Playlist[],
  playlistTombstones: Tombstone[],
  favorites: Track[],
  favoriteTombstones: Tombstone[],
): SyncPayload {
  return {
    app: 'biliMusic',
    type: 'sync',
    version: 1,
    deviceId: getDeviceId(),
    syncedAt: new Date().toISOString(),
    playlists,
    playlistTombstones,
    favorites,
    favoriteTombstones,
  }
}

let syncing = false

// 双向同步：拉远端 → 与本地合并 → 写本地 → 推回远端（ETag 乐观并发，412 冲突重拉重并）
export async function runSync(): Promise<SyncResult> {
  const api = window.electronAPI
  if (!api?.webdavGet || !api?.webdavPut) return { ok: false, message: '当前环境不支持同步' }
  if (syncing) return { ok: false, message: '同步进行中' }
  syncing = true
  window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT))
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remoteRes = await api.webdavGet(SYNC_FILE)
      if (!remoteRes.ok) return { ok: false, message: remoteRes.message || '拉取远端失败' }
      const remote = parsePayload(remoteRes.content)

      const pl = mergeItems(
        loadPlaylists(),
        remote?.playlists ?? [],
        loadPlaylistTombstones(),
        remote?.playlistTombstones ?? [],
        (p) => p.id,
        (p) => p.updatedAt,
      )
      const fav = mergeItems(
        loadFavoriteTracks(),
        remote?.favorites ?? [],
        loadFavoriteTombstones(),
        remote?.favoriteTombstones ?? [],
        (t) => t.id,
        (t) => t.metadataUpdatedAt || t.likedAt || EPOCH,
      )

      savePlaylists(pl.items)
      savePlaylistTombstones(pl.tombstones)
      saveFavoriteTracks(fav.items)
      saveFavoriteTombstones(fav.tombstones)

      const payload = buildPayload(pl.items, pl.tombstones, fav.items, fav.tombstones)
      const putRes = await api.webdavPut(SYNC_FILE, JSON.stringify(payload), remoteRes.etag || undefined)
      if (putRes.ok) {
        setLastSync(payload.syncedAt)
        return { ok: true, message: '同步完成' }
      }
      if (putRes.status !== 412) return { ok: false, message: putRes.message || '上传失败' }
      // 412：远端被他端并发改动 → 重新拉取再合并
    }
    return { ok: false, message: '远端持续变更，请稍后重试' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    syncing = false
    window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT))
  }
}

// 强制上传：本地覆盖远端（首台设备初始化 / 以本地为准）
export async function forceUpload(): Promise<SyncResult> {
  const api = window.electronAPI
  if (!api?.webdavPut) return { ok: false, message: '当前环境不支持同步' }
  try {
    const payload = buildPayload(
      loadPlaylists(),
      loadPlaylistTombstones(),
      loadFavoriteTracks(),
      loadFavoriteTombstones(),
    )
    const res = await api.webdavPut(SYNC_FILE, JSON.stringify(payload))
    if (!res.ok) return { ok: false, message: res.message || '上传失败' }
    setLastSync(payload.syncedAt)
    return { ok: true, message: '已上传到云端' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

// 强制下载：远端覆盖本地（新设备 / 以云端为准）
export async function forceDownload(): Promise<SyncResult> {
  const api = window.electronAPI
  if (!api?.webdavGet) return { ok: false, message: '当前环境不支持同步' }
  try {
    const res = await api.webdavGet(SYNC_FILE)
    if (!res.ok) return { ok: false, message: res.message || '拉取失败' }
    const remote = parsePayload(res.content)
    if (!remote) return { ok: false, message: '云端暂无同步数据' }
    savePlaylists(remote.playlists ?? [])
    savePlaylistTombstones(remote.playlistTombstones ?? [])
    saveFavoriteTracks(remote.favorites ?? [])
    saveFavoriteTombstones(remote.favoriteTombstones ?? [])
    setLastSync(new Date().toISOString())
    return { ok: true, message: '已从云端覆盖本地' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export function isSyncing(): boolean {
  return syncing
}
