import { useState, useCallback } from 'react'
import { Heart, Play, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { loadFavoriteTracks, saveFavoriteTracks } from '@/utils/storage'
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

export default function Favorites() {
  const [tracks, setTracks] = useState<Track[]>(() => loadFavoriteTracks())
  const player = usePlayer()

  const handleRemove = useCallback((trackId: string) => {
    const updated = tracks.filter(t => t.id !== trackId)
    saveFavoriteTracks(updated)
    setTracks(updated)
  }, [tracks])

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) player.playAll(tracks)
  }, [tracks, player])

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
                isCurrent={player.currentTrack?.id === track.id}
                isPlaying={player.isPlaying}
                onPlay={() => player.playNow(track)}
                extra={(
                  <button className="am-icon-danger" onClick={(e) => { e.stopPropagation(); handleRemove(track.id) }} title="取消收藏">
                    <X size={16} />
                  </button>
                )}
              />
            ))}
          </TrackList>
        </MusicSection>
      )}
    </MusicPageShell>
  )
}
