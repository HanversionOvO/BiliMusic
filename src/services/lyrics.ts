/**
 * 歌词服务（渲染层）
 *
 * 数据源：OIAPI QQ Music Lyric。主进程负责跨域请求，本层负责：
 * B站视频标题清洗 → 关键词候选 → QQ音乐候选评分 → LRC 解析 → 缓存 → 手动纠正。
 */

import type { Track } from '@/types'
import { getBilibiliSubtitleLyric, type BilibiliSubtitleLyric } from '@/services/bilibiliApi'

export interface LyricLine {
  time: number
  text: string
}

export interface LyricResult {
  lines: LyricLine[]
  synced: boolean
  instrumental: boolean
  trackName: string
  artistName: string
  sourceId: string
}

export interface LyricCandidate {
  id: string
  songId: string | number
  mid: string
  trackName: string
  artistName: string
  albumName: string
  duration: number
  image: string
}

type RawOiapiSong = Awaited<ReturnType<NonNullable<typeof window.electronAPI>['lyricsApi']['search']>>[number]

function bridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.lyricsApi : undefined
}

async function oiSearch(keyword: string, limit = 10): Promise<LyricCandidate[]> {
  const api = bridge()
  if (!api) return []
  try {
    const rows = await api.search(keyword, 1, limit)
    return rows.map(normalizeCandidate).filter(Boolean) as LyricCandidate[]
  } catch {
    return []
  }
}

async function oiGetLyric(id: string | number): Promise<string> {
  const api = bridge()
  if (!api) return ''
  try {
    const data = await api.get(id, 'lrc')
    return data?.content || data?.conteng || ''
  } catch {
    return ''
  }
}

function normalizeCandidate(item: RawOiapiSong): LyricCandidate | null {
  if (!item?.name || !item.id) return null
  return {
    id: String(item.id),
    songId: item.id,
    mid: item.mid || '',
    trackName: item.name || '',
    artistName: Array.isArray(item.singer) ? item.singer.join(' / ') : '',
    albumName: item.album || '',
    duration: Number(item.duration) || 0,
    image: item.image || '',
  }
}

// ===== B站标题清洗 / 查询候选构造 =====

const NOISE = /(official|lyrics?|audio|video|m\/?v|hd|4k|8k|live|cover|remix|remaster|reimagined|suno|feat\.?|ft\.?|prod\.?|demo|hi-?res|ost|bgm|歌词|动态歌词|高音质|无损|纯享|完整版|官方|现场|翻唱|翻自|改编|原唱|伴奏|钢琴版|弹唱|直播|街唱|试听|修复|重制|超清|字幕|珍藏|节目|片段|合集|歌单|循环|精选|盘点|排行|榜单|小时|分钟|首|教学|讲解)/i
const CJK_NOISE = /(官方版|官方MV|官方音频|官方|现场版|现场|完整版|纯享版|纯享|高音质|无损音质|无损|动态歌词|歌词版|超清|修复版|高清修复|重制版|中日字幕|双语字幕|字幕|试听|伴奏|钢琴版|翻唱|翻自|改编|原唱|纯音乐|直播弹唱|弹唱|街唱|男声|女声|原调|弱混|珍藏|教学|讲解|课程|合集|歌单|循环|精选|盘点|排行榜|榜单|一小时|小时|分钟|首|后台播放|附下载地址|下载地址)/g
const LATIN_NOISE = /\b(official|lyrics?|audio|video|m\/?v|mv|hd|4k|8k|live|cover|remix|remaster(?:ed)?|reimagined|suno|hi-?res|ost|bgm)\b/gi
const SEP = /[-–—_|/\\·•～~「」『』"'`*:：，,;；]/g
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu
const CJK_QUOTE = /[《<]([^》>]+)[》>]/g

function uniqPush(list: string[], value: string) {
  const v = value.replace(/\s+/g, ' ').trim()
  if (v.length >= 2 && !list.some(x => norm(x) === norm(v))) list.push(v)
}

function cleanSeg(raw: string): string {
  if (!raw) return ''
  let s = raw.normalize('NFKC')
  s = s.replace(/#[^\s#]+/g, ' ')
  // 分P标题常以“0002. 歌名”开头，编号不是歌曲关键词。
  s = s.replace(/^\s*\d{1,4}\s*[.．、:：-]\s*/, ' ')
  s = s.replace(EMOJI, ' ')
  s = s.replace(/[!！?？.。]+/g, ' ')
  s = s.replace(CJK_NOISE, ' ')
  s = s.replace(LATIN_NOISE, ' ')
  s = s.replace(/\b\d+\s*(?:首|小时|分钟|mins?|hours?)\b/gi, ' ')
  s = s.replace(SEP, ' ')
  return s.replace(/\s+/g, ' ').trim()
}

export function cleanTitle(raw: string): string {
  if (!raw) return ''
  let s = raw.normalize('NFKC')
  s = s.replace(CJK_QUOTE, ' $1 ')
  s = s.replace(/[【[(（]([^】\])）]*)[】\])）]/g, (_m, inner: string) => (NOISE.test(inner) ? ' ' : ` ${inner} `))
  return cleanSeg(s) || raw.trim().slice(0, 40)
}

function quotedTitles(raw: string): string[] {
  const out: string[] = []
  const normalized = raw.normalize('NFKC')
  for (const match of normalized.matchAll(CJK_QUOTE)) {
    uniqPush(out, cleanSeg(match[1]))
  }
  return out
}

function stripQuoted(raw: string): string {
  return raw.normalize('NFKC').replace(CJK_QUOTE, ' ')
}

function compactKeywordParts(raw: string): string[] {
  const out: string[] = []
  const normalized = raw.normalize('NFKC')
  const parts = normalized
    .replace(CJK_QUOTE, ' $1 ')
    .split(/[【】[\]()（）]|[-–—_|/\\·•～~「」『』"'`*:：，,;；]/)
  for (const part of parts) uniqPush(out, cleanSeg(part))
  return out.filter(part => !NOISE.test(part))
}

function queryCandidates(raw: string): string[] {
  const cands: string[] = []
  const quotes = quotedTitles(raw)
  const context = cleanSeg(stripQuoted(raw))

  for (const title of quotes) {
    uniqPush(cands, title)
    if (context) uniqPush(cands, `${title} ${context}`)
  }

  for (const part of compactKeywordParts(raw)) uniqPush(cands, part)
  uniqPush(cands, cleanTitle(raw))

  const compact = cleanTitle(raw).split(' ').filter(token => token.length > 1 && !NOISE.test(token))
  for (const token of compact) uniqPush(cands, token)

  return cands
    .filter(candidate => !/^(av|bv)[\da-z]+$/i.test(candidate))
    .slice(0, 8)
}

// ===== LRC 解析 =====

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const META_LINE = /^(ti|ar|al|by|offset|kana|tool|length):/i

export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = []
  for (const rawLine of lrc.split('\n')) {
    TIME_TAG.lastIndex = 0
    const times: number[] = []
    let m: RegExpExecArray | null
    while ((m = TIME_TAG.exec(rawLine)) !== null) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0
      times.push(min * 60 + sec + frac)
    }
    if (!times.length) continue
    const text = rawLine.replace(TIME_TAG, '').trim()
    if (!text || META_LINE.test(text)) continue
    for (const t of times) out.push({ time: t, text })
  }
  return out.sort((a, b) => a.time - b.time)
}

function plainToLines(plain: string): LyricLine[] {
  return plain
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !META_LINE.test(t.replace(/^\[[^\]]+]/, '')))
    .map((text) => ({ time: -1, text }))
}

// ===== 相似度 / 候选排序 =====

function norm(s: string): string {
  return (s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  if (s.length === 1) { set.add(s); return set }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

function dice(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.86
  const ba = bigrams(na)
  const bb = bigrams(nb)
  let inter = 0
  for (const g of ba) if (bb.has(g)) inter++
  return (2 * inter) / (ba.size + bb.size)
}

function normIncludes(haystack: string, needle: string): boolean {
  const h = norm(haystack)
  const n = norm(needle)
  return n.length >= 2 && h.includes(n)
}

function scoreCandidate(c: LyricCandidate, ctx: { rawTitle: string; clean: string; duration: number; quoted: string[] }): number {
  const quotedScore = Math.max(0, ...ctx.quoted.map(q => dice(c.trackName, q)))
  let score = 0
  score += normIncludes(ctx.rawTitle, c.trackName) ? 360 : dice(c.trackName, ctx.clean) * 180
  score += normIncludes(ctx.rawTitle, c.artistName) ? 280 : 0
  score += quotedScore * 300
  score += c.albumName && normIncludes(ctx.rawTitle, c.albumName) ? 40 : 0

  if (ctx.duration > 0 && c.duration > 0) {
    const diff = Math.abs(ctx.duration - c.duration)
    if (diff <= 4) score += 130
    else if (diff <= 10) score += 85
    else if (diff <= 25) score += 35
    else score -= Math.min(diff, 240) * 1.25
    if (ctx.duration > 900 && c.duration < 600) score -= 360
  }

  if (/伴奏|karaoke|instrumental/i.test(c.trackName) && !/伴奏|karaoke|instrumental/i.test(ctx.rawTitle)) score -= 120
  if (/翻唱|cover/i.test(c.trackName) && !/翻唱|cover/i.test(ctx.rawTitle)) score -= 80
  return score
}

function lyricMatchTitle(track: Track): string {
  // 分P的 part 才是实际歌曲名；完整 title 还包含合集标题和 P 序号，不能直接用于 QQ 搜索。
  if (track.pagePart?.trim()) return track.pagePart.trim()
  // 兼容已经持久化的旧分P队列，它们没有 pagePart 字段。
  const match = track.title.match(/(?:^|·)\s*P\d+\s*·\s*(.+)$/i)
  return match?.[1]?.trim() || track.title
}

async function searchBestCandidate(track: Track): Promise<LyricCandidate | null> {
  const matchTitle = lyricMatchTitle(track)
  const queries = queryCandidates(matchTitle)
  if (!queries.length) return null

  const seen = new Map<string, LyricCandidate>()
  for (const q of queries) {
    const rows = await oiSearch(q, 10)
    for (const row of rows) if (!seen.has(row.id)) seen.set(row.id, row)
    if (seen.size >= 24) break
  }

  const ctx = {
    rawTitle: matchTitle,
    clean: cleanTitle(matchTitle),
    duration: track.duration || 0,
    quoted: quotedTitles(matchTitle),
  }

  const best = [...seen.values()]
    .map(candidate => ({ candidate, score: scoreCandidate(candidate, ctx) }))
    .sort((a, b) => b.score - a.score)[0]

  if (!best) return null
  if (best.score < 120 && !normIncludes(matchTitle, best.candidate.trackName)) return null
  return best.candidate
}

function lyricToResult(candidate: LyricCandidate, content: string): LyricResult | null {
  const syncedLines = parseLrc(content)
  const lines = syncedLines.length ? syncedLines : plainToLines(content)
  if (!lines.length) return null
  return {
    lines,
    synced: syncedLines.length > 0,
    instrumental: false,
    trackName: candidate.trackName,
    artistName: candidate.artistName,
    sourceId: String(candidate.songId),
  }
}

// ===== 缓存 =====

// QQ 匹配规则按分P标题修正后，使用新版本缓存，避免复用旧的错误歌曲映射。
const CACHE_KEY = 'bilimusic_lyrics_v3'
const BILIBILI_CACHE_KEY = 'bilimusic_lyrics_bilibili_v2'
const MISS_TTL = 24 * 60 * 60 * 1000

type CacheEntry =
  | { status: 'ok'; result: LyricResult }
  | { status: 'miss'; ts: number }

function readCache(key = CACHE_KEY): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

function writeCache(map: Record<string, CacheEntry>, key = CACHE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // 配额满等情况忽略。
  }
}

function cacheOk(trackId: string, result: LyricResult, key = CACHE_KEY): void {
  const map = readCache(key)
  map[trackId] = { status: 'ok', result }
  writeCache(map, key)
}

function cacheMiss(trackId: string, key = CACHE_KEY): void {
  const map = readCache(key)
  map[trackId] = { status: 'miss', ts: Date.now() }
  writeCache(map, key)
}

function bilibiliCacheId(track: Track): string {
  const cid = track.pageCid ?? (track.page !== undefined ? track.cid : undefined)
  return `${track.bvid || track.id}:${cid || 'default'}`
}

export function clearLyricCache(trackId: string): void {
  for (const key of [CACHE_KEY, BILIBILI_CACHE_KEY]) {
    const map = readCache(key)
    for (const id of Object.keys(map)) {
      if (id === trackId || id.startsWith(`${trackId}:`)) delete map[id]
    }
    writeCache(map, key)
  }
}

function bilibiliLyricToResult(data: BilibiliSubtitleLyric): LyricResult | null {
  if (!data.lines.length) return null
  return {
    lines: data.lines,
    synced: true,
    instrumental: false,
    trackName: 'Bilibili AI 字幕',
    artistName: data.language || 'Bilibili',
    sourceId: `bilibili:${data.subtitleId}`,
  }
}

export type LyricSource = 'auto' | 'remote' | 'bilibili'

async function loadBilibiliLyric(track: Track): Promise<LyricResult | null> {
  const cacheId = bilibiliCacheId(track)
  const entry = readCache(BILIBILI_CACHE_KEY)[cacheId]
  if (entry?.status === 'ok') return entry.result
  if (entry?.status === 'miss' && Date.now() - entry.ts < MISS_TTL) return null

  try {
    const cid = track.pageCid ?? (track.page !== undefined ? track.cid : undefined)
    const subtitle = await getBilibiliSubtitleLyric(track.bvid, cid)
    const result = subtitle ? bilibiliLyricToResult(subtitle) : null
    if (result) {
      cacheOk(cacheId, result, BILIBILI_CACHE_KEY)
      return result
    }
    cacheMiss(cacheId, BILIBILI_CACHE_KEY)
  } catch {
    // 网络、登录或 CDN 暂时失败不应写入 miss，避免阻塞后续真实重试。
  }
  return null
}

function remoteCacheId(track: Track): string {
  return `${track.id}:qq`
}

async function loadRemoteLyric(track: Track): Promise<LyricResult | null> {
  const cacheId = remoteCacheId(track)
  const entry = readCache(CACHE_KEY)[cacheId]
  if (entry?.status === 'ok') return entry.result
  if (entry?.status === 'miss' && Date.now() - entry.ts < MISS_TTL) return null

  const candidate = await searchBestCandidate(track)
  if (!candidate) {
    cacheMiss(cacheId, CACHE_KEY)
    return null
  }

  const content = await oiGetLyric(candidate.songId)
  const result = lyricToResult(candidate, content)
  if (!result) {
    cacheMiss(cacheId, CACHE_KEY)
    return null
  }

  cacheOk(cacheId, result, CACHE_KEY)
  return result
}

export async function getLyricForTrack(track: Track, source: LyricSource = 'auto'): Promise<LyricResult | null> {
  if (source === 'auto') {
    // 自动模式优先 QQ Music，查不到时再使用视频自身时间轴的 Bilibili AI 字幕。
    return (await loadRemoteLyric(track)) || loadBilibiliLyric(track)
  }
  if (source === 'bilibili') return loadBilibiliLyric(track)
  return loadRemoteLyric(track)
}

export async function searchLyricCandidates(query: string): Promise<LyricCandidate[]> {
  const q = cleanTitle(query.trim())
  if (!q) return []
  return oiSearch(q, 20)
}

export async function chooseLyricCandidate(trackId: string, record: LyricCandidate): Promise<LyricResult | null> {
  const content = await oiGetLyric(record.songId)
  const result = lyricToResult(record, content)
  if (result) cacheOk(`${trackId}:qq`, result)
  return result
}
