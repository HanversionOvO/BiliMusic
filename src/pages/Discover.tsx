import { useEffect, useState, useCallback } from 'react'
import { Disc3, Loader2, Play, RefreshCw, TrendingUp } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { getMusicRanking, type VideoInfo } from '@/services/api'
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

function videoToTrack(video: VideoInfo): Track {
  return {
    id: video.bvid,
    title: video.title,
    artist: video.ownerName,
    coverUrl: video.pic,
    duration: video.duration,
    videoUrl: `https://www.bilibili.com/video/${video.bvid}`,
    bvid: video.bvid,
    playCount: video.stat?.view || 0,
    isLiked: false,
  }
}

export default function Discover() {
  const [tracks, setTracks] = useState<VideoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const player = usePlayer()

  useEffect(() => {
    loadMusicRanking()
  }, [])

  async function loadMusicRanking() {
    setLoading(true)
    setError(null)
    try {
      const data = await getMusicRanking()
      setTracks(data)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = useCallback(() => {
    const playlist = tracks.slice(0, 12).map(videoToTrack)
    if (playlist.length > 0) player.playAll(playlist)
  }, [tracks, player])

  const handlePlayOne = useCallback((video: VideoInfo) => {
    player.playNow(videoToTrack(video))
  }, [player])

  const featured = tracks.slice(0, 3)
  const list = tracks.slice(3)
  const heroImage = featured[0]?.pic

  return (
    <MusicPageShell>
      <MusicHero
        eyebrow="B站音乐区排行榜"
        title="发现新声音"
        subtitle="精选热门音乐投稿，用 Apple Music 式的节奏探索今天值得播放的内容。"
        image={heroImage}
        tone="pink"
        action={(
          <ActionButton onClick={handlePlayAll} disabled={loading || tracks.length === 0}>
            <Play size={17} fill="currentColor" />
            播放全部
          </ActionButton>
        )}
      />

      {loading ? (
        <div className="am-loading"><Loader2 size={30} className="spin" /></div>
      ) : error ? (
        <EmptyLibrary
          icon={<RefreshCw size={38} />}
          title="加载失败"
          subtitle={error}
        />
      ) : (
        <>
          <MusicSection title="精选推荐" icon={<TrendingUp size={22} />}>
            <FeaturedGrid>
              {featured.map((video, index) => {
                const track = videoToTrack(video)
                return (
                  <FeaturedTrackCard
                    key={video.bvid}
                    track={track}
                    index={index + 1}
                    isCurrent={player.currentTrack?.id === video.bvid}
                    onPlay={() => handlePlayOne(video)}
                  />
                )
              })}
            </FeaturedGrid>
          </MusicSection>

          <MusicSection title="热门排行榜" icon={<Disc3 size={22} />}>
            <TrackList>
              {list.map((video, index) => {
                const track = videoToTrack(video)
                return (
                  <TrackListRow
                    key={video.bvid}
                    track={track}
                    index={featured.length + index + 1}
                    isCurrent={player.currentTrack?.id === video.bvid}
                    isPlaying={player.isPlaying}
                    onPlay={() => handlePlayOne(video)}
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
