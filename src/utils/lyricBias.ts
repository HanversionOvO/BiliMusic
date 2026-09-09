import type { Track } from '@/types'
import { readStoredItem, writeStoredItem } from '@/utils/persistentStorage'
import { getTrackId } from '@/utils/trackIdentity'

const STORAGE_KEY = 'bilimusic_lyric_bias_v1'
const MAX_BIAS_SECONDS = 10

type LyricBiasMap = Record<string, number>

function readBiasMap(): LyricBiasMap {
  try {
    const parsed = JSON.parse(readStoredItem(STORAGE_KEY) || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as LyricBiasMap
      : {}
  } catch {
    return {}
  }
}

function normalizeBias(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.max(-MAX_BIAS_SECONDS, Math.min(MAX_BIAS_SECONDS, value)) * 10) / 10
}

export function getLyricBias(track: Track): number {
  return normalizeBias(Number(readBiasMap()[getTrackId(track)] || 0))
}

export function setLyricBias(track: Track, value: number): number {
  const id = getTrackId(track)
  const next = normalizeBias(value)
  const map = readBiasMap()

  if (next === 0) delete map[id]
  else map[id] = next

  writeStoredItem(STORAGE_KEY, JSON.stringify(map))
  return next
}
