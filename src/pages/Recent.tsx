import { useState, useCallback } from 'react'
import { Clock, Play, Trash2 } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { loadRecentTracks, saveRecentTracks } from '@/utils/storage'
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

export default function Recent() {
  const [tracks, setTracks] = useState<Track[]>(() => loadRecentTracks())
  const player = usePlayer()

  const handleClear = useCallback(() => {
    saveRecentTracks([])
    setTracks([])
  }, [])

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) player.playAll(tracks)
  }, [tracks, player])

  const heroImage = tracks[0]?.coverUrl

  return (
    <MusicPageShell>
      <MusicHero
        eyebrow="Recently Played"
        title="最近播放"
        subtitle={tracks.length ? `继续回到刚刚听过的 ${tracks.length} 首音乐。` : '播放歌曲后，最近听过的内容会在这里聚合。'}
        image={heroImage}
        tone="blue"
        action={tracks.length > 0 && (
          <>
            <ActionButton onClick={handlePlayAll}>
              <Play size={17} fill="currentColor" />
              播放全部
            </ActionButton>
            <ActionButton onClick={handleClear} tone="subtle">
              <Trash2 size={16} />
              清空
            </ActionButton>
          </>
        )}
      />

      {tracks.length === 0 ? (
        <EmptyLibrary icon={defaultIconFor('recent')} title="暂无播放记录" subtitle="播放歌曲后将在此显示。" />
      ) : (
        <MusicSection title="播放记录" icon={<Clock size={22} />}>
          <TrackList>
            {tracks.map((track, index) => (
              <TrackListRow
                key={track.id + String(index)}
                track={track}
                index={index + 1}
                isCurrent={player.currentTrack?.id === track.id}
                isPlaying={player.isPlaying}
                onPlay={() => player.playNow(track)}
              />
            ))}
          </TrackList>
        </MusicSection>
      )}
    </MusicPageShell>
  )
}
