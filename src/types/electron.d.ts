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

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void
      maximize: () => void
      close: () => void
      platform: string
      biliApi: BiliApi
    }
  }
}