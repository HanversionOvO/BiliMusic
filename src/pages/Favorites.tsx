import { useState, useCallback, useEffect } from 'react'
import { Heart, Pencil, Play, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import AddToPlaylistButton from '@/components/AddToPlaylistButton'
import TrackMetadataDialog from '@/components/TrackMetadataDialog'
import {
  loadFavoriteTracks,
  removeFavoriteTrack,
  updateFavoriteTrackMetadata,
  FAVORITES_CHANGED_EVENT,
  type FavoriteMetadataPatch,
} from '@/utils/storage'
import {
  ActionButton,
  EmptyLibrary,
  MusicHero,
  MusicPageShell,
  MusicSection,
  TrackList,
  TrackListRow,
  defaultIconFor,
} from '@/components/AppleMusicPage'
import type { Track } from '@/types'
import { isSameTrack } from '@/utils/trackIdentity'

export default function Favorites() {
  const [tracks, setTracks] = useState<Track[]>(() => loadFavoriteTracks())
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const player = usePlayer()

  useEffect(() => {
    const refresh = () => setTracks(loadFavoriteTracks())
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh)
  }, [])

  const handleRemove = useCallback((trackId: string) => {
    setTracks(removeFavoriteTrack(trackId)) // 记墓碑，确保同步不复活
  }, [])

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) player.playAll(tracks)
  }, [tracks, player])

  const handleMetadataSave = useCallback((patch: FavoriteMetadataPatch) => {
    if (!editingTrack) return
    const updated = updateFavoriteTrackMetadata(editingTrack.id, patch)
    if (updated) {
      setTracks(loadFavoriteTracks())
      player.updateTrackMetadata(updated)
    }
    setEditingTrack(null)
  }, [editingTrack, player])

  const heroImage = tracks[0]?.coverUrl

  return (
    <MusicPageShell>
      <MusicHero
        eyebrow="Favorites"
        title="我喜欢"
        subtitle={tracks.length ? `收藏的 ${tracks.length} 首歌曲都在这里。` : '点击歌曲旁的心形按钮收藏喜欢的音乐。'}
        image={heroImage}
        tone="red"
        action={tracks.length > 0 && (
          <ActionButton onClick={handlePlayAll}>
            <Play size={17} fill="currentColor" />
            播放全部
          </ActionButton>
        )}
      />

      {tracks.length === 0 ? (
        <EmptyLibrary icon={defaultIconFor('favorites')} title="暂无收藏" subtitle="喜欢的歌曲会以更精致的列表在这里出现。" />
      ) : (
        <MusicSection title="收藏曲目" icon={<Heart size={22} />}>
          <TrackList>
            {tracks.map((track, index) => (
              <TrackListRow
                key={track.id + String(index)}
                track={track}
                index={index + 1}
                isCurrent={isSameTrack(player.currentTrack, track)}
                isPlaying={player.isPlaying}
                onPlay={() => player.playNow(track)}
                extra={(
                  <div className="am-extra-actions">
                    <AddToPlaylistButton track={track} size={15} />
                    <button className="am-icon-button" onClick={(e) => { e.stopPropagation(); setEditingTrack(track) }} title="编辑歌曲信息">
                      <Pencil size={15} />
                    </button>
                    <button className="am-icon-danger" onClick={(e) => { e.stopPropagation(); handleRemove(track.id) }} title="取消收藏">
                      <X size={16} />
                    </button>
                  </div>
                )}
              />
            ))}
          </TrackList>
        </MusicSection>
      )}
      <TrackMetadataDialog
        track={editingTrack}
        onClose={() => setEditingTrack(null)}
        onSave={handleMetadataSave}
      />
    </MusicPageShell>
  )
}
