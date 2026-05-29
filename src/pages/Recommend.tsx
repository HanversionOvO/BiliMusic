import { useEffect, useState, useCallback } from 'react'
import { Play, Music, Loader2, Sparkles, Flame } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import TrackActions from '@/components/TrackActions'
import { getMusicCenterRank, getNewSongs, type MusicSong } from '@/services/api'
import type { Track } from '@/types'

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
    } catch { /* 单区块失败不影响另一个 */ }
    try {
      const fresh = await getNewSongs()
      setNewSongs(fresh)
      ok = ok || fresh.length > 0
    } catch { /* ignore */ }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>
      <h1 className="text-h1">推荐</h1>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <p className="text-body">{error}</p>
          <button
            onClick={loadAll}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            重试
          </button>
        </div>
      ) : (
        <>
          {/* 综合热歌榜 */}
          <Section
            title="热歌榜"
            icon={<Flame size={18} />}
            action={
              rankSongs.length > 0 ? (
                <button
                  onClick={() => handlePlayAll(rankSongs)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <Play size={14} fill="currentColor" /> 播放全部
                </button>
              ) : undefined
            }
          >
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              {rankSongs.map((song, index) => (
                <SongRow
                  key={song.bvid}
                  song={song}
                  index={index + 1}
                  isCurrent={player.currentTrack?.id === song.bvid}
                  onPlay={() => handlePlay(song)}
                />
              ))}
            </div>
          </Section>

          {/* 新歌速递 */}
          <Section title="新歌速递" icon={<Sparkles size={18} />}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 'var(--space-md)',
              }}
            >
              {newSongs.map((song) => (
                <SongCard
                  key={song.bvid}
                  song={song}
                  isCurrent={player.currentTrack?.id === song.bvid}
                  onPlay={() => handlePlay(song)}
                />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ===== 榜单行 =====
function SongRow({ song, index, isCurrent, onPlay }: { song: MusicSong; index: number; isCurrent: boolean; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
        padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
        transition: 'background var(--duration-fast)',
        borderBottom: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ width: 28, textAlign: 'center', fontSize: 'var(--text-body)', fontWeight: 600, color: index <= 3 ? 'var(--color-primary)' : 'var(--color-muted)', flexShrink: 0 }}>
        {index}
      </span>
      <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        {song.coverUrl ? (
          <img src={song.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={16} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body" style={{ fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {song.title}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {song.artist}{song.album ? ` · ${song.album}` : ''}
        </div>
      </div>
      <TrackActions track={songToTrack(song)} size={15} />
    </div>
  )
}

// ===== 新歌卡片 =====
function SongCard({ song, isCurrent, onPlay }: { song: MusicSong; isCurrent: boolean; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      style={{
        cursor: 'pointer', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        transition: 'transform var(--duration-fast), box-shadow var(--duration-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ aspectRatio: '1/1', background: 'var(--color-border)', position: 'relative', overflow: 'hidden' }}>
        {song.coverUrl ? (
          <img src={song.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={28} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity var(--duration-fast)' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={20} style={{ color: '#fff' }} fill="#fff" />
          </div>
        </div>
        {song.publishTime && (
          <span style={{ position: 'absolute', top: 6, left: 6, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11 }}>
            {song.publishTime}
          </span>
        )}
      </div>
      <div style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-body" style={{ fontWeight: isCurrent ? 600 : 500, color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.title}
          </div>
          <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.artist}
          </div>
        </div>
        <TrackActions track={songToTrack(song)} size={15} />
      </div>
    </div>
  )
}

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
        {icon && <span style={{ color: 'var(--color-primary)' }}>{icon}</span>}
        <h2 className="text-h2" style={{ margin: 0 }}>{title}</h2>
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      {children}
    </section>
  )
}
