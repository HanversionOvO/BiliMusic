import type { Track } from '@/types'

// 只解析标题中明确标注的歌手信息；模糊的“名称 - 名称”不猜测，避免再次把 UP 主等信息误当歌手。
export function inferArtistFromTitle(rawTitle: string): string {
  const title = rawTitle.replace(/<[^>]+>/g, '').trim()
  const patterns = [
    /(?:歌手|演唱|原唱|artist|singer)\s*[:：]\s*([^|｜/【】\[\]（）()]{1,40})/i,
    /(?:cover(?:ed)?\s+by|翻唱)\s*[:：]?\s*([^|｜/【】\[\]（）()]{1,40})/i,
    /^([^《》]{1,30})\s*[·•]\s*《[^》]+》/,
  ]
  for (const pattern of patterns) {
    const match = title.match(pattern)?.[1]?.trim()
    if (match) return match.replace(/[，,。.!！?？\s]+$/, '')
  }
  return ''
}

export function trackArtistLabel(track: Pick<Track, 'artist'>): string {
  return track.artist?.trim() || '歌手未知'
}

export function trackCreditLine(track: Pick<Track, 'artist' | 'album' | 'uploaderName'>): string {
  const parts = [trackArtistLabel(track)]
  if (track.album?.trim()) parts.push(track.album.trim())
  if (track.uploaderName?.trim()) parts.push(`UP：${track.uploaderName.trim()}`)
  return parts.join(' · ')
}
