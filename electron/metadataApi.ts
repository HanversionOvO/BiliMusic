import { ipcMain, net } from 'electron'

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const CACHE_TTL = 12 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 100

interface ItunesTrack {
  trackId?: number
  trackName?: string
  artistName?: string
  collectionId?: number
  collectionName?: string
  artworkUrl100?: string
  trackTimeMillis?: number
  releaseDate?: string
  primaryGenreName?: string
  kind?: string
}

interface ItunesSearchResponse {
  results?: ItunesTrack[]
}

export interface MetadataCandidate {
  source: 'itunes'
  sourceId: string
  title: string
  artist: string
  album: string
  coverUrl: string
  duration: number
  releaseDate: string
  genre: string
  score: number
}

const cache = new Map<string, { expiresAt: number; value: MetadataCandidate[] }>()

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function similarity(left: string, right: string): number {
  const a = Array.from(normalize(left))
  const b = Array.from(normalize(right))
  if (!a.length || !b.length) return 0
  const aText = a.join('')
  const bText = b.join('')
  if (aText === bText) return 1
  if (aText.includes(bText) || bText.includes(aText)) {
    return 0.82 + 0.16 * (Math.min(a.length, b.length) / Math.max(a.length, b.length))
  }
  if (a.length === 1 || b.length === 1) return 0

  const counts = new Map<string, number>()
  for (let index = 0; index < a.length - 1; index++) {
    const pair = `${a[index]}${a[index + 1]}`
    counts.set(pair, (counts.get(pair) || 0) + 1)
  }
  let overlap = 0
  for (let index = 0; index < b.length - 1; index++) {
    const pair = `${b[index]}${b[index + 1]}`
    const count = counts.get(pair) || 0
    if (count > 0) {
      overlap += 1
      counts.set(pair, count - 1)
    }
  }
  return (2 * overlap) / (a.length + b.length - 2)
}

function highResolutionArtwork(url: string): string {
  if (!url) return ''
  return url
    .replace(/^http:/i, 'https:')
    .replace(/\/\d+x\d+bb(?=\.[a-z]+(?:\?|$))/i, '/600x600bb')
}

function versionPenalty(queryTitle: string, candidateTitle: string): number {
  const versionWords = /(live|remix|instrumental|karaoke|remaster|acoustic|伴奏|现场|翻唱|纯音乐|重制)/i
  return versionWords.test(candidateTitle) && !versionWords.test(queryTitle) ? 0.12 : 0
}

function candidateScore(track: ItunesTrack, title: string, artist: string, duration: number): number {
  const titleScore = similarity(title, track.trackName || '')
  const artistScore = similarity(artist, track.artistName || '')
  const hasDuration = duration > 0 && Number(track.trackTimeMillis) > 0
  const durationScore = hasDuration
    ? Math.max(0, 1 - Math.abs(duration - Number(track.trackTimeMillis) / 1000) / 30)
    : 0
  const score = hasDuration
    ? titleScore * 0.55 + artistScore * 0.35 + durationScore * 0.1
    : titleScore * 0.62 + artistScore * 0.38
  return Math.max(0, Math.min(1, score - versionPenalty(title, track.trackName || '')))
}

async function searchItunes(title: string, artist: string, duration: number): Promise<MetadataCandidate[]> {
  const cacheKey = `${normalize(title)}:${normalize(artist)}:${Math.round(duration || 0)}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const url = new URL(ITUNES_SEARCH_URL)
  url.searchParams.set('term', `${title} ${artist}`.trim())
  // The mainland storefront omits many common Chinese releases; the Hong Kong
  // catalog has substantially better Mandarin/Cantonese coverage.
  url.searchParams.set('country', 'HK')
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', 'song')
  url.searchParams.set('limit', '15')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)
  try {
    const response = await net.fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'BiliMusic/1.0.2' },
    })
    if (!response.ok) throw new Error(`iTunes metadata request failed: ${response.status}`)
    const json = await response.json() as ItunesSearchResponse
    const candidates = (json.results || [])
      .filter(item => item.kind === 'song' && item.trackName && item.artistName && item.collectionName)
      .map(item => ({
        source: 'itunes' as const,
        sourceId: `itunes:${item.trackId || item.collectionId || `${item.trackName}:${item.artistName}`}`,
        title: item.trackName || '',
        artist: item.artistName || '',
        album: item.collectionName || '',
        coverUrl: highResolutionArtwork(item.artworkUrl100 || ''),
        duration: Math.round(Number(item.trackTimeMillis || 0) / 1000),
        releaseDate: item.releaseDate || '',
        genre: item.primaryGenreName || '',
        score: candidateScore(item, title, artist, duration),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)

    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, value: candidates })
    return candidates
  } finally {
    clearTimeout(timer)
  }
}

export function registerMetadataApiHandlers(): void {
  ipcMain.handle('metadata:search', async (_event, title: string, artist: string, duration = 0) => {
    const normalizedTitle = String(title || '').trim()
    const normalizedArtist = String(artist || '').trim()
    if (!normalizedTitle || !normalizedArtist) return []
    return searchItunes(normalizedTitle, normalizedArtist, Math.max(0, Number(duration) || 0))
  })
}
