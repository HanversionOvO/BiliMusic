interface BiliApi {
  search: (keyword: string, page?: number, pageSize?: number) => Promise<any>
  videoDetail: (bvid: string) => Promise<any>
  playUrl: (bvid: string, cid: number) => Promise<any>
  nav: () => Promise<any>
  popular: (ps?: number, pn?: number) => Promise<any>
  recommend: (ps?: number) => Promise<any>
  musicRanking: () => Promise<any>
  favorites: (mid: number) => Promise<any>
  extractAudio: (bvid: string) => Promise<{
    bvid: string
    aid: number
    cid: number
    title: string
    artist: string
    coverUrl: string
    duration: number
    audioUrl: string
    audioQuality: number
    audioMimeType: string
    bandwidth: number
  }>
  downloadAudio: (audioUrl: string, filename: string) => Promise<{
    filePath: string
    size: number
  }>
  qrGenerate: () => Promise<{
    url: string
    qrcodeKey: string
  }>
  qrPoll: (qrcodeKey: string) => Promise<{
    code: number
    status: number
    message: string
    url: string
  }>
  getCookies: () => Promise<{
    isLoggedIn: boolean
    sessdata: string
    biliJct: string
    dedeUserId: string
  }>
  logout: () => Promise<{ success: boolean }>
}

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

interface LyricsApi {
  search: (keyword: string, page?: number, limit?: number) => Promise<OiapiSong[]>
  get: (id: string | number, format?: 'lrc' | 'qrc' | 'ksc') => Promise<OiapiLyricData | null>
}

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void
      maximize: () => void
      close: () => void
      platform: string
      biliApi: BiliApi
      lyricsApi: LyricsApi
    }
  }
}
