import { useEffect, useState, useCallback } from 'react'
import { Flame, Loader2, Play, RefreshCw, Sparkles } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { getMusicCenterRank, getNewSongs, type MusicSong } from '@/services/api'
import { isMobilePlatform } from '@/hooks/useIsMobile'
import type { Track } from '@/types'
import {
  ActionButton,
  EmptyLibrary,
  FeaturedGrid,
  FeaturedTrackCard,
  MusicHero,
  MusicPageShell,
  MusicSection,
  TrackList,
  TrackListRow,
} from '@/components/AppleMusicPage'

function songToTrack(s: MusicSong): Track {
  return {
    id: s.bvid,
    title: s.title,
    artist: s.artist,
    coverUrl: s.coverUrl,
    duration: 0,
    videoUrl: `https://www.bilibili.com/video/${s.bvid}`,
    bvid: s.bvid,
    aid: s.aid,
    cid: s.cid,
    playCount: 0,
    isLiked: false,
  }
}

export default function Recommend() {
  const [rankSongs, setRankSongs] = useState<MusicSong[]>([])
  const [newSongs, setNewSongs] = useState<MusicSong[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const player = usePlayer()

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    let ok = false
    try {
      const rank = await getMusicCenterRank(30)
      setRankSongs(rank)
      ok = ok || rank.length > 0
    } catch {
      // 单区块失败不影响另一个。
    }
    try {
      const fresh = await getNewSongs()
      setNewSongs(fresh)
      ok = ok || fresh.length > 0
    } catch {
      // ignore
    }
    if (!ok) setError('加载失败')
    setLoading(false)
  }

  const handlePlay = useCallback((song: MusicSong) => {
    player.playNow(songToTrack(song))
  }, [player])

  const handlePlayAll = useCallback((songs: MusicSong[]) => {
    if (songs.length === 0) return
    player.playAll(songs.slice(0, 30).map(songToTrack))
  }, [player])

  const heroSong = rankSongs[0] || newSongs[0]
  const featured = newSongs.slice(0, 3)
  const rankList = rankSongs.slice(0, 18)
  const mobile = isMobilePlatform()

  return (
    <MusicPageShell>
      {!mobile && (
        <MusicHero
          eyebrow="For You"
          title="推荐"
          subtitle="来自 B站音乐中心的热歌与新歌，用更接近 Apple Music 的方式呈现。"
          image={heroSong?.coverUrl}
          tone="red"
          action={(
            <ActionButton onClick={() => handlePlayAll(rankSongs.length ? rankSongs : newSongs)} disabled={loading || (!rankSongs.length && !newSongs.length)}>
              <Play size={17} fill="currentColor" />
              播放推荐
            </ActionButton>
          )}
        />
      )}

      {loading ? (
        <div className="am-loading"><Loader2 size={30} className="spin" /></div>
      ) : error ? (
        <EmptyLibrary icon={<RefreshCw size={38} />} title="加载失败" subtitle={error} />
      ) : mobile ? (
        <MusicSection
          title="热歌榜"
          icon={<Flame size={22} />}
          action={(
            <ActionButton onClick={() => handlePlayAll(rankSongs)} disabled={loading || !rankSongs.length}>
              <Play size={15} fill="currentColor" />
              播放推荐
            </ActionButton>
          )}
        >
          <TrackList>
            {rankList.map((song, index) => {
              const track = songToTrack(song)
              return (
                <TrackListRow
                  key={song.bvid}
                  track={track}
                  index={index + 1}
                  isCurrent={player.currentTrack?.id === song.bvid}
                  isPlaying={player.isPlaying}
                  onPlay={() => handlePlay(song)}
                />
              )
            })}
          </TrackList>
        </MusicSection>
      ) : (
        <>
          <MusicSection title="新歌速递" icon={<Sparkles size={22} />}>
            <FeaturedGrid>
              {featured.map((song, index) => {
                const track = songToTrack(song)
                return (
                  <FeaturedTrackCard
                    key={song.bvid}
                    track={{ ...track, playCount: 0 }}
                    index={index + 1}
                    isCurrent={player.currentTrack?.id === song.bvid}
                    onPlay={() => handlePlay(song)}
                  />
                )
              })}
            </FeaturedGrid>
          </MusicSection>

          <MusicSection title="热歌榜" icon={<Flame size={22} />}>
            <TrackList>
              {rankList.map((song, index) => {
                const track = songToTrack(song)
                return (
                  <TrackListRow
                    key={song.bvid}
                    track={track}
                    index={index + 1}
                    isCurrent={player.currentTrack?.id === song.bvid}
                    isPlaying={player.isPlaying}
                    onPlay={() => handlePlay(song)}
                  />
                )
              })}
            </TrackList>
          </MusicSection>
        </>
      )}
    </MusicPageShell>
  )
}
