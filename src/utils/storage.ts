import type { Track } from '@/types'

const RECENT_KEY = 'bilimusic_recent'
const FAVORITES_KEY = 'bilimusic_favorites'

export function loadRecentTracks(): Track[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveRecentTracks(tracks: Track[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(tracks.slice(0, 50)))
  } catch { /* ignore */ }
}

export function addRecentTrack(track: Track) {
  const recent = loadRecentTracks().filter(t => t.id !== track.id)
  recent.unshift({ ...track, isLiked: track.isLiked })
  saveRecentTracks(recent)
}

export function loadFavoriteTracks(): Track[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveFavoriteTracks(tracks: Track[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(tracks))
  } catch { /* ignore */ }
}

export function toggleFavoriteTrack(track: Track): Track[] {
  const favs = loadFavoriteTracks()
  const idx = favs.findIndex(t => t.id === track.id)
  if (idx >= 0) {
    favs.splice(idx, 1)
  } else {
    favs.unshift({ ...track, isLiked: true })
  }
  saveFavoriteTracks(favs)
  return favs
}
