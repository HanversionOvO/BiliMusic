import { AnimatePresence, motion } from 'framer-motion'
import { Check, Music, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { addTracksToPlaylist, loadPlaylists, PLAYLISTS_CHANGED_EVENT } from '@/utils/storage'
import { trackCreditLine } from '@/utils/trackMetadata'
import { isSameTrack } from '@/utils/trackIdentity'
import type { Playlist, Track } from '@/types'

interface AddToPlaylistContextValue {
  openAddToPlaylist: (track: Track) => void
  openAddTracksToPlaylist: (tracks: Track[]) => void
}

const AddToPlaylistContext = createContext<AddToPlaylistContextValue | null>(null)

export function AddToPlaylistProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([])
  const track = tracks[0] || null
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists())
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setPlaylists(loadPlaylists())
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const close = useCallback(() => {
    setTracks([])
    setAddedId(null)
  }, [])

  const openAddToPlaylist = useCallback((nextTrack: Track) => {
    setPlaylists(loadPlaylists())
    setAddedId(null)
    setTracks([nextTrack])
  }, [])

  const openAddTracksToPlaylist = useCallback((nextTracks: Track[]) => {
    if (nextTracks.length === 0) return
    setPlaylists(loadPlaylists())
    setAddedId(null)
    setTracks(nextTracks)
  }, [])

  const choose = useCallback((playlist: Playlist) => {
    if (!track) return
    addTracksToPlaylist(playlist.id, tracks)
    setAddedId(playlist.id)
    setTimeout(close, 520)
  }, [close, track, tracks])

  return (
    <AddToPlaylistContext.Provider value={{ openAddToPlaylist, openAddTracksToPlaylist }}>
      {children}
      <AnimatePresence>
        {track && (
          <motion.div
            className="add-playlist-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={close}
          >
            <motion.div
              className="add-playlist-popover"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="add-playlist-popover__head">
                <div>
                  <p>Add to Playlist</p>
                  <h3>添加至歌单</h3>
                </div>
                <button type="button" onClick={close} aria-label="关闭">
                  <X size={17} />
                </button>
              </div>

              <div className="add-playlist-track">
                <div>{track.coverUrl ? <img src={track.coverUrl} alt="" /> : <Music size={20} />}</div>
                <span>
                  <strong>{tracks.length > 1 ? `${track.parentTitle || '分P视频'}（${tracks.length} 首）` : track.title}</strong>
                  <small>{trackCreditLine(track)}</small>
                </span>
              </div>

              <div className="add-playlist-list">
                {playlists.length === 0 ? (
                  <div className="add-playlist-empty">还没有歌单，请先在侧边栏新建歌单。</div>
                ) : playlists.map((playlist) => {
                  const already = tracks.every(item => playlist.tracks.some(t => isSameTrack(t, item)))
                  const justAdded = addedId === playlist.id
                  return (
                    <button key={playlist.id} type="button" onClick={() => choose(playlist)}>
                      <span>
                        <strong>{playlist.name}</strong>
                        <small>{playlist.tracks.length} 首歌曲</small>
                      </span>
                      {(already || justAdded) && <Check size={16} />}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AddToPlaylistContext.Provider>
  )
}

export function useAddToPlaylist() {
  const ctx = useContext(AddToPlaylistContext)
  if (!ctx) throw new Error('useAddToPlaylist must be used within AddToPlaylistProvider')
  return ctx
}
