import { Heart, Music } from 'lucide-react'
import { useState, useCallback } from 'react'
import { usePlayer } from '@/contexts/PlayerContext'
import { loadFavoriteTracks, saveFavoriteTracks } from '@/utils/storage'
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="text-h1">我喜欢</h1>
        {tracks.length > 0 && (
          <button onClick={handlePlayAll} style={{ padding: '8px 18px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            播放全部
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <Heart size={48} strokeWidth={1} />
          <p className="text-h3" style={{ marginTop: 16 }}>暂无收藏</p>
          <p className="text-caption" style={{ marginTop: 4 }}>点击歌曲旁的心形按钮收藏</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tracks.map((track, i) => (
            <div key={track.id + String(i)} onClick={() => player.play(track)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '10px var(--space-md)', cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'background var(--duration-fast)', background: player.currentTrack?.id === track.id ? 'var(--color-primary-light)' : undefined }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
              onMouseLeave={e => { if (player.currentTrack?.id !== track.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
                {track.coverUrl ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> :
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} style={{ color: 'var(--color-muted)' }} /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                <div className="text-caption" style={{ color: 'var(--color-muted)' }}>{track.artist}</div>
              </div>
              <span className="text-caption" style={{ color: 'var(--color-muted)', marginRight: 8 }}>{fmt(track.duration)}</span>
              <button onClick={e => { e.stopPropagation(); handleRemove(track.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-destructive)', padding: 4 }}>
                <Heart size={14} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(s: number): string {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`
}
