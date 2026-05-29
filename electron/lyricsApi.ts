import { ipcMain, net } from 'electron'

/**
 * 歌词服务层（OIAPI QQ Music Lyric）
 *
 * 主进程负责跨域请求，渲染层负责标题清洗、候选排序、LRC 解析与缓存。
 * 接口文档：https://www.oiapi.net/doc/id/121.html
 */

const OIAPI_QQ_LYRIC = 'https://www.oiapi.net/api/QQMusicLyric'

export interface OiapiSong {
  name: string
  singer: string[]
  album: string
  mid: string
  id: string | number
  album_mid: string
  duration: number
  image: string
}

export interface OiapiLyricData {
  content?: string
  conteng?: string
  base64?: string
  cache?: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

async function fetchJson(url: string): Promise<any | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const resp = await net.fetch(url, { signal: ctrl.signal })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function registerLyricsApiHandlers() {
  ipcMain.handle('lyrics:search', async (_event, keyword: string, page = 1, limit = 10): Promise<OiapiSong[]> => {
    const q = String(keyword || '').trim()
    if (!q) return []

    const url = new URL(OIAPI_QQ_LYRIC)
    url.searchParams.set('keyword', q)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('type', 'json')

    const json = await fetchJson(url.toString())
    const data = json?.data
    if (!Array.isArray(data)) return []
    return data.filter((item): item is OiapiSong => isObject(item) && typeof item.name === 'string')
  })

  ipcMain.handle('lyrics:get', async (_event, id: string | number, format = 'lrc'): Promise<OiapiLyricData | null> => {
    const songId = String(id || '').trim()
    if (!songId) return null

    const url = new URL(OIAPI_QQ_LYRIC)
    url.searchParams.set('id', songId)
    url.searchParams.set('format', format)
    url.searchParams.set('type', 'json')

    const json = await fetchJson(url.toString())
    if (!json || json.code !== 1) return null
    if (typeof json.data === 'string') return { content: json.data }
    if (isObject(json.data)) return json.data as OiapiLyricData
    if (typeof json.message === 'string' && json.message.includes('[')) return { content: json.message }
    return null
  })
}
