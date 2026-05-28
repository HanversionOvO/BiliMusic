import { Clock, Trash2, Music } from 'lucide-react'
import { useState, useCallback } from 'react'
import { usePlayer } from '@/contexts/PlayerContext'
import { loadRecentTracks, saveRecentTracks } from '@/utils/storage'
import type { Track } from '@/types'

export default function Recent() {
  const [tracks, setTracks] = useState<Track[]>(() => loadRecentTracks())
  const player = usePlayer()

  const handleClear = useCallback(() => {
    saveRecentTracks([])
    setTracks([])
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="text-h1">最近播放</h1>
        {tracks.length > 0 && (
          <button onClick={handleClear} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
            <Trash2 size={14} /> 清空
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <Empty icon={<Clock size={48} strokeWidth={1} />} text="暂无播放记录" sub="播放歌曲后将在此显示" />
      ) : (
        <TrackList tracks={tracks} player={player} />
      )}
    </div>
  )
}

function Empty({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
      {icon}
      <p className="text-h3" style={{ marginTop: 16 }}>{text}</p>
      <p className="text-caption" style={{ marginTop: 4 }}>{sub}</p>
    </div>
  )
}

function TrackList({ tracks, player }: { tracks: Track[]; player: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {tracks.map((track, i) => (
        <div key={track.id + String(i)} onClick={() => player.play(track)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '10px var(--space-md)', cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'background var(--duration-fast)', background: player.currentTrack?.id === track.id ? 'var(--color-primary-light)' : undefined }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
          onMouseLeave={e => { if (player.currentTrack?.id !== track.id) e.currentTarget.style.background = 'transparent' }}
        >
          <Cover pic={track.coverUrl} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
            <div className="text-caption" style={{ color: 'var(--color-muted)' }}>{track.artist}</div>
          </div>
          <span className="text-caption" style={{ color: 'var(--color-muted)' }}>{fmt(track.duration)}</span>
        </div>
      ))}
    </div>
  )
}

function Cover({ pic }: { pic?: string }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
      {pic ? <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> :
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} style={{ color: 'var(--color-muted)' }} /></div>}
    </div>
  )
}

function fmt(s: number): string {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`
}
