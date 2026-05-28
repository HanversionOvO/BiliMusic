import { useEffect, useState, useCallback } from 'react'
import { Play, Music, Loader2, TrendingUp, Disc3 } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { getMusicRanking, extractAudio, type VideoInfo } from '@/services/api'
import type { Track } from '@/types'

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

  const handlePlayAll = useCallback(async () => {
    if (tracks.length === 0) return
    const playlist: Track[] = tracks.slice(0, 8).map((v) => ({
      id: v.bvid,
      title: v.title,
      artist: v.ownerName,
      coverUrl: v.pic,
      duration: v.duration,
      videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
      bvid: v.bvid,
      playCount: v.stat?.view || 0,
      isLiked: false,
    }))
    player.playAll(playlist)
  }, [tracks, player])

  const handlePlayOne = useCallback(async (video: VideoInfo) => {
    try {
      const trackSource = await extractAudio(video.bvid)
      const track: Track = {
        id: trackSource.bvid,
        title: trackSource.title,
        artist: trackSource.artist,
        coverUrl: trackSource.coverUrl,
        duration: trackSource.duration,
        videoUrl: `https://www.bilibili.com/video/${trackSource.bvid}`,
        bvid: trackSource.bvid,
        playCount: 0,
        isLiked: false,
      }
      player.play(track)
    } catch {
      const track: Track = {
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
      player.play(track)
    }
  }, [player])

  const featured = tracks.slice(0, 3)
  const list = tracks.slice(3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>
      {/* Hero Banner */}
      <div
        style={{
          height: 200,
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(251,114,153,0.45) 0%, rgba(136,71,255,0.35) 50%, rgba(0,174,236,0.3) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-2xl)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
          发现音乐
        </h1>
        <p style={{ fontSize: 'var(--text-body)', opacity: 0.8, marginBottom: 'var(--space-md)' }}>
          B站音乐区排行榜 · 发现好音乐
        </p>
        <button
          onClick={handlePlayAll}
          disabled={loading || tracks.length === 0}
          style={{
            padding: '10px 28px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            width: 'fit-content',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--text-body)',
            fontFamily: 'var(--font-body)',
            transition: 'background var(--duration-fast)',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
        >
          <Play size={16} fill="#fff" />
          播放全部
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <p className="text-body">{error}</p>
          <button
            onClick={loadMusicRanking}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)' }}
          >
            重试
          </button>
        </div>
      ) : (
        <>
          {/* Featured Picks — 横向大卡片 */}
          <Section title="精选推荐" icon={<TrendingUp size={18} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
              {featured.map((video) => (
                <FeaturedCard
                  key={video.bvid}
                  video={video}
                  isCurrent={player.currentTrack?.id === video.bvid}
                  onPlay={() => handlePlayOne(video)}
                />
              ))}
            </div>
          </Section>

          {/* Track List — 音乐列表 */}
          <Section title="排行榜" icon={<Disc3 size={18} />}>
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              {list.map((video, index) => (
                <TrackRow
                  key={video.bvid}
                  video={video}
                  index={featured.length + index + 1}
                  isCurrent={player.currentTrack?.id === video.bvid}
                  onPlay={() => handlePlayOne(video)}
                />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ===== 精选大卡片 =====
function FeaturedCard({ video, isCurrent, onPlay }: { video: VideoInfo; isCurrent: boolean; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        transition: 'transform var(--duration-fast), box-shadow var(--duration-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ aspectRatio: '16/9', background: 'var(--color-border)', position: 'relative', overflow: 'hidden' }}>
        {video.pic ? (
          <img src={video.pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={28} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity var(--duration-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={20} style={{ color: '#fff' }} fill="#fff" />
          </div>
        </div>
        {video.duration > 0 && (
          <span style={{ position: 'absolute', bottom: 8, right: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11 }}>
            {formatDuration(video.duration)}
          </span>
        )}
      </div>
      <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <div
          className="text-body"
          style={{
            fontWeight: isCurrent ? 600 : 500,
            color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {video.title}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 2 }}>
          {video.ownerName} · {formatCount(video.stat?.view || 0)}播放
        </div>
      </div>
    </div>
  )
}

// ===== 排行榜行 =====
function TrackRow({ video, index, isCurrent, onPlay }: { video: VideoInfo; index: number; isCurrent: boolean; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-sm) var(--space-md)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast)',
        borderBottom: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* 序号 */}
      <span
        style={{
          width: 28,
          textAlign: 'center',
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: index <= 3 ? 'var(--color-primary)' : 'var(--color-muted)',
          flexShrink: 0,
        }}
      >
        {index}
      </span>

      {/* 封面 */}
      <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
        {video.pic ? (
          <img src={video.pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={16} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="text-body"
          style={{
            fontWeight: isCurrent ? 600 : 400,
            color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {video.title}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 1 }}>
          {video.ownerName}
        </div>
      </div>

      {/* 时长 */}
      <span className="text-caption" style={{ color: 'var(--color-muted)', flexShrink: 0 }}>
        {formatDuration(video.duration)}
      </span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
        {icon && <span style={{ color: 'var(--color-primary)' }}>{icon}</span>}
        <h2 className="text-h2" style={{ margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}
