/**
 * biliMusic BiliBili API 服务层
 *
 * 已验证的 API 接口，通过浏览器 Cookie 认证访问 B 站接口
 */

const BILI_API = 'https://api.bilibili.com'

// B站图片地址统一转 https：http:// 的 hdslb 图在渲染进程会加载失败
// （大量 https 连接建立后同主机 cleartext 请求冲突），// 协议相对地址同样补全
export function toHttpsUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return `https://${url.slice(7)}`
  return url
}

interface BiliFetchOptions {
  credentials?: RequestCredentials
  params?: Record<string, string | number>
}

async function biliFetch<T>(path: string, options: BiliFetchOptions = {}): Promise<T> {
  const { credentials = 'include', params } = options
  const url = new URL(`${BILI_API}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  }

  const resp = await fetch(url.toString(), {
    credentials,
    headers: {
      Referer: 'https://www.bilibili.com',
    },
  })

  const data = await resp.json()
  if (data.code !== 0) {
    throw new BiliApiError(data.code, data.message, path)
  }
  return data.data as T
}

class BiliApiError extends Error {
  code: number
  path: string
  constructor(code: number, message: string, path: string) {
    super(`BiliBili API Error [${code}]: ${message} (${path})`)
    this.code = code
    this.path = path
  }
}

// ===== WBI 签名 =====
//
// B 站部分接口（搜索等）要求 WBI 签名：在请求参数中追加 wts + w_rid。
// w_rid = md5(按字典序排序的 query + mixinKey)。mixinKey 由 nav 接口返回的
// img_key/sub_key 经固定置换表重排得到。渲染进程无 node crypto，故内联 MD5。

// 纯 JS MD5（ASCII 输入，hex 输出）— 已对照 node crypto 校验
function md5(str: string): string {
  const rol = (x: number, c: number): number => (x << c) | (x >>> (32 - c))
  const add = (x: number, y: number): number => {
    const x4 = x & 0x40000000, y4 = y & 0x40000000, x8 = x & 0x80000000, y8 = y & 0x80000000
    const r = (x & 0x3fffffff) + (y & 0x3fffffff)
    if (x4 & y4) return r ^ 0x80000000 ^ x8 ^ y8
    if (x4 | y4) return (r & 0x40000000) ? (r ^ 0xc0000000 ^ x8 ^ y8) : (r ^ 0x40000000 ^ x8 ^ y8)
    return r ^ x8 ^ y8
  }
  const F = (x: number, y: number, z: number): number => (x & y) | (~x & z)
  const G = (x: number, y: number, z: number): number => (x & z) | (y & ~z)
  const H = (x: number, y: number, z: number): number => x ^ y ^ z
  const I = (x: number, y: number, z: number): number => y ^ (x | ~z)
  const FF = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => add(rol(add(a, add(add(F(b, c, d), x), t)), s), b)
  const GG = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => add(rol(add(a, add(add(G(b, c, d), x), t)), s), b)
  const HH = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => add(rol(add(a, add(add(H(b, c, d), x), t)), s), b)
  const II = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => add(rol(add(a, add(add(I(b, c, d), x), t)), s), b)
  const toWords = (s: string): number[] => {
    const len = s.length
    const nWords = (((len + 8 - ((len + 8) % 64)) / 64) + 1) * 16
    const w = new Array(nWords - 1).fill(0)
    let b = 0
    while (b < len) { w[(b - (b % 4)) / 4] |= (s.charCodeAt(b) & 0xff) << ((b % 4) * 8); b++ }
    w[(b - (b % 4)) / 4] |= 0x80 << ((b % 4) * 8)
    w[nWords - 2] = len << 3
    w[nWords - 1] = len >>> 29
    return w
  }
  const toHex = (n: number): string => {
    let s = ''
    for (let i = 0; i <= 3; i++) { const byte = (n >>> (i * 8)) & 255; s += ('0' + byte.toString(16)).slice(-2) }
    return s
  }
  const x = toWords(str)
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d
    a = FF(a, b, c, d, x[k], 7, 0xd76aa478); d = FF(d, a, b, c, x[k + 1], 12, 0xe8c7b756); c = FF(c, d, a, b, x[k + 2], 17, 0x242070db); b = FF(b, c, d, a, x[k + 3], 22, 0xc1bdceee)
    a = FF(a, b, c, d, x[k + 4], 7, 0xf57c0faf); d = FF(d, a, b, c, x[k + 5], 12, 0x4787c62a); c = FF(c, d, a, b, x[k + 6], 17, 0xa8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xfd469501)
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098d8); d = FF(d, a, b, c, x[k + 9], 12, 0x8b44f7af); c = FF(c, d, a, b, x[k + 10], 17, 0xffff5bb1); b = FF(b, c, d, a, x[k + 11], 22, 0x895cd7be)
    a = FF(a, b, c, d, x[k + 12], 7, 0x6b901122); d = FF(d, a, b, c, x[k + 13], 12, 0xfd987193); c = FF(c, d, a, b, x[k + 14], 17, 0xa679438e); b = FF(b, c, d, a, x[k + 15], 22, 0x49b40821)
    a = GG(a, b, c, d, x[k + 1], 5, 0xf61e2562); d = GG(d, a, b, c, x[k + 6], 9, 0xc040b340); c = GG(c, d, a, b, x[k + 11], 14, 0x265e5a51); b = GG(b, c, d, a, x[k], 20, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[k + 5], 5, 0xd62f105d); d = GG(d, a, b, c, x[k + 10], 9, 0x02441453); c = GG(c, d, a, b, x[k + 15], 14, 0xd8a1e681); b = GG(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[k + 9], 5, 0x21e1cde6); d = GG(d, a, b, c, x[k + 14], 9, 0xc33707d6); c = GG(c, d, a, b, x[k + 3], 14, 0xf4d50d87); b = GG(b, c, d, a, x[k + 8], 20, 0x455a14ed)
    a = GG(a, b, c, d, x[k + 13], 5, 0xa9e3e905); d = GG(d, a, b, c, x[k + 2], 9, 0xfcefa3f8); c = GG(c, d, a, b, x[k + 7], 14, 0x676f02d9); b = GG(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a)
    a = HH(a, b, c, d, x[k + 5], 4, 0xfffa3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771f681); c = HH(c, d, a, b, x[k + 11], 16, 0x6d9d6122); b = HH(b, c, d, a, x[k + 14], 23, 0xfde5380c)
    a = HH(a, b, c, d, x[k + 1], 4, 0xa4beea44); d = HH(d, a, b, c, x[k + 4], 11, 0x4bdecfa9); c = HH(c, d, a, b, x[k + 7], 16, 0xf6bb4b60); b = HH(b, c, d, a, x[k + 10], 23, 0xbebfbc70)
    a = HH(a, b, c, d, x[k + 13], 4, 0x289b7ec6); d = HH(d, a, b, c, x[k], 11, 0xeaa127fa); c = HH(c, d, a, b, x[k + 3], 16, 0xd4ef3085); b = HH(b, c, d, a, x[k + 6], 23, 0x04881d05)
    a = HH(a, b, c, d, x[k + 9], 4, 0xd9d4d039); d = HH(d, a, b, c, x[k + 12], 11, 0xe6db99e5); c = HH(c, d, a, b, x[k + 15], 16, 0x1fa27cf8); b = HH(b, c, d, a, x[k + 2], 23, 0xc4ac5665)
    a = II(a, b, c, d, x[k], 6, 0xf4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432aff97); c = II(c, d, a, b, x[k + 14], 15, 0xab9423a7); b = II(b, c, d, a, x[k + 5], 21, 0xfc93a039)
    a = II(a, b, c, d, x[k + 12], 6, 0x655b59c3); d = II(d, a, b, c, x[k + 3], 10, 0x8f0ccc92); c = II(c, d, a, b, x[k + 10], 15, 0xffeff47d); b = II(b, c, d, a, x[k + 1], 21, 0x85845dd1)
    a = II(a, b, c, d, x[k + 8], 6, 0x6fa87e4f); d = II(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0); c = II(c, d, a, b, x[k + 6], 15, 0xa3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4e0811a1)
    a = II(a, b, c, d, x[k + 4], 6, 0xf7537e82); d = II(d, a, b, c, x[k + 11], 10, 0xbd3af235); c = II(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb); b = II(b, c, d, a, x[k + 9], 21, 0xeb86d391)
    a = add(a, AA); b = add(b, BB); c = add(c, CC); d = add(d, DD)
  }
  return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase()
}

// img_key + sub_key 的固定置换表
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
]

function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join('').slice(0, 32)
}

let wbiKeysCache: { imgKey: string; subKey: string; ts: number } | null = null

// 从 nav 接口取 wbi img_key/sub_key（每日轮换，缓存 6 小时）
async function getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  if (wbiKeysCache && Date.now() - wbiKeysCache.ts < 6 * 3600 * 1000) {
    return { imgKey: wbiKeysCache.imgKey, subKey: wbiKeysCache.subKey }
  }
  // 不能用 biliFetch：未登录时 nav 返回 code -101 会抛错，但 wbi_img 仍有效
  const resp = await fetch(`${BILI_API}/x/web-interface/nav`, {
    credentials: 'include',
    headers: { Referer: 'https://www.bilibili.com' },
  })
  const json = await resp.json()
  const imgUrl: string = json?.data?.wbi_img?.img_url || ''
  const subUrl: string = json?.data?.wbi_img?.sub_url || ''
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1).split('.')[0]
  const subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1).split('.')[0]
  wbiKeysCache = { imgKey, subKey, ts: Date.now() }
  return { imgKey, subKey }
}

// 对参数做 WBI 签名，返回拼好的 query 字符串（含 wts、w_rid）
async function encodeWbi(params: Record<string, string | number>): Promise<string> {
  const { imgKey, subKey } = await getWbiKeys()
  const mixinKey = getMixinKey(imgKey + subKey)
  const signParams: Record<string, string | number> = { ...params, wts: Math.round(Date.now() / 1000) }
  const query = Object.keys(signParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(signParams[k]).replace(/[!'()*]/g, ''))}`)
    .join('&')
  return `${query}&w_rid=${md5(query + mixinKey)}`
}

// ===== 用户信息 =====

export interface UserInfo {
  isLogin: boolean
  mid: number
  uname: string
  face: string
  vipType: number
  vipStatus: number
}

export async function getNavInfo(): Promise<UserInfo> {
  return biliFetch('/x/web-interface/nav')
}

// ===== 搜索 =====

export interface SearchResult {
  bvid: string
  aid: number
  title: string
  author: string
  play: number
  video_review: number
  duration: string
  pubdate: number
  pic: string
  tag: string
  description: string
}

export interface SearchResponse {
  seid: string
  page: number
  pagesize: number
  numResults: number
  numPages: number
  result: SearchResult[]
}

export async function searchVideo(
  keyword: string,
  page = 1,
  pageSize = 20,
): Promise<SearchResponse> {
  // 搜索接口需 WBI 签名，且必须发送与签名完全一致的 query（不能经 URL 再编码）
  const query = await encodeWbi({
    search_type: 'video',
    keyword,
    page,
    page_size: pageSize,
  })
  const resp = await fetch(`${BILI_API}/x/web-interface/wbi/search/type?${query}`, {
    credentials: 'include',
    headers: { Referer: 'https://www.bilibili.com' },
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new BiliApiError(data.code, data.message, '/x/web-interface/wbi/search/type')
  }
  return data.data as SearchResponse
}

// ===== 搜索 UP主 =====

export interface UserSearchResult {
  type: string
  mid: number
  uname: string
  usign: string
  fans: number
  videos: number
  upic: string
  level: number
  is_live: number
  official_verify?: { type: number; desc: string }
}

export interface UserSearchResponse {
  numResults: number
  numPages: number
  result: UserSearchResult[]
}

// 搜索 UP主：同一 WBI 搜索接口，search_type=bili_user
export async function searchUser(
  keyword: string,
  page = 1,
  pageSize = 20,
): Promise<UserSearchResponse> {
  const query = await encodeWbi({
    search_type: 'bili_user',
    keyword,
    page,
    page_size: pageSize,
  })
  const resp = await fetch(`${BILI_API}/x/web-interface/wbi/search/type?${query}`, {
    credentials: 'include',
    headers: { Referer: 'https://www.bilibili.com' },
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new BiliApiError(data.code, data.message, '/x/web-interface/wbi/search/type')
  }
  return data.data as UserSearchResponse
}

// ===== UP主 投稿视频 =====

export interface SpaceVideo {
  bvid: string
  aid: number
  title: string
  pic: string
  length: string
  play: number
  created: number
  description: string
  author: string
}

export interface SpaceArcSearchData {
  list: { vlist: SpaceVideo[] }
  page: { pn: number; ps: number; count: number }
}

// UP主 投稿列表：/x/space/wbi/arc/search 同样需 WBI 签名
// 渲染进程（完整 Chromium 指纹 + Cookie）可绕过该接口的 -352 风控
export async function getUserVideos(
  mid: number,
  page = 1,
  pageSize = 30,
  order: 'pubdate' | 'click' = 'pubdate',
): Promise<SpaceArcSearchData> {
  const query = await encodeWbi({ mid, pn: page, ps: pageSize, order, platform: 'web' })
  const resp = await fetch(`${BILI_API}/x/space/wbi/arc/search?${query}`, {
    credentials: 'include',
    headers: { Referer: `https://space.bilibili.com/${mid}/video` },
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new BiliApiError(data.code, data.message, '/x/space/wbi/arc/search')
  }
  return data.data as SpaceArcSearchData
}

// ===== 视频详情 =====

export interface VideoOwner {
  mid: number
  name: string
  face: string
}

export interface VideoStat {
  view: number
  danmaku: number
  like: number
  coin: number
  favorite: number
  share: number
}

export interface VideoPage {
  cid: number
  part: string
  duration: number
}

export interface VideoDetail {
  bvid: string
  aid: number
  title: string
  desc: string
  pic: string
  owner: VideoOwner
  stat: VideoStat
  duration: number
  cid: number
  videos: number
  pages: VideoPage[]
  pubdate: number
}

export async function getVideoDetail(bvid: string): Promise<VideoDetail> {
  return biliFetch('/x/web-interface/view', { params: { bvid } })
}

// ===== 评论 =====

export interface ReplyMember {
  mid: string
  uname: string
  avatar: string
}

export interface ReplyContent {
  message: string
}

export interface ReplyItem {
  rpid: number
  ctime: number
  like: number
  rcount: number
  member: ReplyMember
  content: ReplyContent
}

export interface ReplyPage {
  num: number
  size: number
  count: number
  acount: number
}

export interface ReplyResponse {
  page?: ReplyPage
  replies?: ReplyItem[] | null
}

export async function getVideoComments(
  oid: number,
  page = 1,
  pageSize = 20,
): Promise<ReplyResponse> {
  return biliFetch('/x/v2/reply', {
    params: {
      type: 1,
      oid,
      pn: page,
      ps: pageSize,
      sort: 2,
    },
  })
}

// ===== 音频流 =====

export interface AudioStream {
  id: number
  quality: number
  bandwidth: number
  mimeType: string
  codecid: number
  baseUrl: string
  backupUrl: string[]
}

export interface VideoStream {
  id: number
  quality: number
  bandwidth: number
  mimeType: string
  codecid: number
  baseUrl: string
  backupUrl: string[]
  width: number
  height: number
}

export interface PlayUrlData {
  quality: number
  format: string
  dash: {
    audio: AudioStream[]
    video: VideoStream[]
  }
}

/**
 * 获取视频播放地址（含音频流）
 *
 * fnval=16 请求 DASH 格式，可获得独立音频流
 * qn=0 请求最高画质
 */
export async function getPlayUrl(
  bvid: string,
  cid: number,
): Promise<PlayUrlData> {
  return biliFetch('/x/player/playurl', {
    params: {
      bvid,
      cid,
      qn: 0,
      fnver: 0,
      fnval: 16,
      fourk: 1,
    },
  })
}

/**
 * 获取最高品质的音频流 URL
 *
 * B 站音频流 ID 对照：
 * 30216: 64kbps MP3
 * 30232: 132kbps AAC
 * 30280: 192kbps AAC (高品质)
 * 30250: 杜比全景声
 * 30251: Hi-Res 无损 FLAC
 */
export function getBestAudioUrl(playData: PlayUrlData): string {
  const audioStreams = playData.dash.audio
  if (!audioStreams?.length) throw new Error('No audio stream available')

  // 按带宽降序排序，选择最高品质
  const sorted = [...audioStreams].sort((a, b) => b.bandwidth - a.bandwidth)
  return sorted[0].baseUrl
}

// ===== 热门/推荐 =====

export interface PopularVideo {
  bvid: string
  aid: number
  title: string
  pic: string
  owner: VideoOwner
  stat: VideoStat
  duration: number
}

export async function getPopularVideos(ps = 10, pn = 1): Promise<{ list: PopularVideo[] }> {
  return biliFetch('/x/web-interface/popular', { params: { ps, pn } })
}

export async function getRecommendedVideos(ps = 10): Promise<{ item: PopularVideo[] }> {
  return biliFetch('/x/web-interface/index/top/rcmd', { params: { ps } })
}

// ===== 音乐排行榜 =====

export interface MusicRankingItem {
  bvid: string
  aid: number
  title: string
  pic: string
  owner: VideoOwner
  stat: VideoStat
  duration: number
  cid: number
  pubdate: number
}

export async function getMusicRanking(): Promise<MusicRankingItem[]> {
  return biliFetch<MusicRankingItem[]>('/x/web-interface/ranking/region', { params: { rid: 3, day: 3 } })
}

// ===== 音乐中心 (music.bilibili.com/pc/music-center 同源数据) =====

// 综合榜每项的关联可播放稿件（顶层 bvid 是 music-metadata 伪 id，不可 view）
export interface MusicCenterRelatedArchive {
  aid: string
  bvid: string
  cid: string
  cover: string
  title: string
  duration?: number
}

// 音乐中心曲目（综合榜 / 新歌）
// 新歌：顶层 bvid 即可播放稿件；综合榜：需取 related_archive.bvid
export interface MusicCenterItem {
  music_id: string
  music_title: string
  author: string
  bvid: string
  aid: string
  cid: string
  cover: string
  album?: string
  score?: number
  total_vv?: number
  publish_time?: string
  related_archive?: MusicCenterRelatedArchive
}

// 综合热歌榜（无需 WBI / csrf）
export async function getMusicComprehensiveRank(ps = 30): Promise<MusicCenterItem[]> {
  const data = await biliFetch<{ list: MusicCenterItem[] }>(
    '/x/centralization/interface/music/comprehensive/web/rank',
    { params: { pn: 1, ps } },
  )
  return data.list || []
}

// 新歌速递
export async function getNewMusic(): Promise<MusicCenterItem[]> {
  const data = await biliFetch<{ list: MusicCenterItem[] }>('/x/centralization/interface/new/music')
  return data.list || []
}

// ===== 收藏夹 =====

export interface FavoriteFolder {
  id: number
  title: string
  media_count: number
}

export async function getFavoriteFolders(mid: number): Promise<{ count: number; list: FavoriteFolder[] }> {
  return biliFetch('/x/v3/fav/folder/created/list-all', { params: { up_mid: mid } })
}

// ===== 完整流程：搜索 → 详情 → 音频 =====

export interface TrackSource {
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
}

/**
 * 一键从 B 站视频提取音频源
 *
 * 流程：搜索关键词 → 获取视频详情 → 获取音频流 → 返回 TrackSource
 */
export async function extractAudioFromSearch(
  keyword: string,
  index = 0,
): Promise<TrackSource> {
  const searchResult = await searchVideo(keyword, 1, 10)
  if (!searchResult.result?.length) {
    throw new Error(`未找到相关视频: ${keyword}`)
  }

  const video = searchResult.result[index]
  return extractAudioFromVideo(video.bvid)
}

/**
 * 从指定 BV 号提取音频源
 *
 * fallback：音乐中心曲目的顶层 avid+cid。部分曲目的 bvid 稿件已不存在
 * （/x/web-interface/view 返回 -404），但其音乐原生流可经 avid+cid 直取。
 */
export async function extractAudioFromVideo(
  bvid: string,
  fallback?: { aid?: string | number; cid?: string | number },
  cid?: number,
): Promise<TrackSource> {
  try {
    const detail = await getVideoDetail(bvid)
    // 分P视频：cid 指定要播放的那个分P，否则默认第 1 个分P
    const targetCid = cid || detail.cid
    const playData = await getPlayUrl(bvid, targetCid)
    const audioUrl = getBestAudioUrl(playData)

    const bestAudio = [...playData.dash.audio].sort((a, b) => b.bandwidth - a.bandwidth)[0]

    // 时长用「当前分P」的时长，而非所有分P总时长，避免进度条与实际播放错位
    const targetPage = detail.pages?.find(p => p.cid === targetCid)
    const duration = targetPage?.duration || detail.duration

    return {
      bvid: detail.bvid,
      aid: detail.aid,
      cid: targetCid,
      title: detail.title,
      artist: detail.owner.name,
      coverUrl: toHttpsUrl(detail.pic),
      duration,
      audioUrl,
      audioQuality: bestAudio.quality,
      audioMimeType: bestAudio.mimeType,
    }
  } catch (e) {
    if (fallback?.aid && fallback?.cid) {
      return extractAudioByAvidCid(fallback.aid, fallback.cid, bvid)
    }
    throw e
  }
}

/**
 * 用 avid + cid 直取音频流（bvid 稿件 -404 时的回退）
 *
 * 不经 view 接口，故 title/artist/cover 留空，由调用方保留已有展示信息。
 */
async function extractAudioByAvidCid(
  aid: string | number,
  cid: string | number,
  bvid = '',
): Promise<TrackSource> {
  const playData = await biliFetch<PlayUrlData>('/x/player/playurl', {
    params: { avid: aid, cid, qn: 0, fnver: 0, fnval: 16, fourk: 1 },
  })
  const audioStreams = playData.dash?.audio
  if (!audioStreams?.length) throw new Error('No audio stream available')
  const bestAudio = [...audioStreams].sort((a, b) => b.bandwidth - a.bandwidth)[0]

  return {
    bvid,
    aid: Number(aid) || 0,
    cid: Number(cid) || 0,
    title: '',
    artist: '',
    coverUrl: '',
    duration: 0,
    audioUrl: bestAudio.baseUrl,
    audioQuality: bestAudio.quality,
    audioMimeType: bestAudio.mimeType,
  }
}

// ===== 扫码登录 =====

export interface QrCodeData {
  url: string
  qrcodeKey: string
}

export interface QrPollResult {
  code: number
  status: number
  message: string
  url: string
}

/**
 * 生成扫码登录二维码
 */
export async function generateQrCode(): Promise<QrCodeData> {
  const resp = await fetch(`${BILI_API.replace('api', 'passport')}/x/passport-login/web/qrcode/generate`, {
    credentials: 'include',
    headers: { Referer: 'https://passport.bilibili.com/login' },
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new BiliApiError(data.code, data.message, 'qrGenerate')
  }
  return {
    url: data.data.url,
    qrcodeKey: data.data.qrcode_key,
  }
}

/**
 * 轮询二维码扫描状态
 *
 * status:
 * 86100 = 未扫码
 * 86090 = 已扫码未确认
 * 0     = 登录成功
 */
export async function pollQrCode(qrcodeKey: string): Promise<QrPollResult> {
  const resp = await fetch(
    `${BILI_API.replace('api', 'passport')}/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`,
    {
      credentials: 'include',
      headers: { Referer: 'https://passport.bilibili.com/login' },
    },
  )
  const data = await resp.json()
  // 外层 code 是 API 结果，内层 data.code 才是扫码状态
  return {
    code: data.data?.code ?? data.code,
    status: data.data?.code ?? data.code,
    message: data.data?.message || data.message,
    url: data.data?.url || '',
  }
}
