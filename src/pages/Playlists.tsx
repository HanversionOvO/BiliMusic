import { Trash2, Play, X, Music } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'

export default function Playlists() {
  const player = usePlayer()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="text-h1">播放列表</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {player.queue.length > 0 && (
            <>
              <button onClick={() => player.playFromQueue(0)}
                style={{ padding: '8px 18px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                <Play size={14} style={{ marginRight: 4, display: 'inline' }} />播放全部
              </button>
              <button onClick={player.clearQueue}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', background: 'transparent', border: '1px solid var(--color-destructive)', color: 'var(--color-destructive)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}>
                <Trash2 size={14} /> 清空
              </button>
            </>
          )}
        </div>
      </div>

      {player.queue.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <Music size={48} strokeWidth={1} />
          <p className="text-h3" style={{ marginTop: 16 }}>队列为空</p>
          <p className="text-caption" style={{ marginTop: 4 }}>搜索歌曲并"添加到播放列表"开始播放</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="text-caption" style={{ color: 'var(--color-muted)', marginBottom: 4 }}>
            共 {player.queue.length} 首
            {player.currentTrack && ` · 正在播放: ${player.currentTrack.title}`}
          </div>
          {player.queue.map((track, i) => {
            const isCurrent = player.currentTrack?.id === track.id
            return (
              <div key={track.id + String(i)}
                onClick={() => player.playFromQueue(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                  padding: '10px var(--space-md)', cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  transition: 'background var(--duration-fast)',
                  background: isCurrent ? 'var(--color-primary-light)' : undefined,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 24, textAlign: 'center', fontWeight: 600, color: isCurrent ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: 'var(--text-body)', flexShrink: 0 }}>
                  {isCurrent && player.isPlaying ? (
                    <span style={{ display: 'inline-flex', gap: 1 }}>
                      <span style={{ width: 2, height: 10, background: 'var(--color-primary)', display: 'inline-block', animation: 'pulse 0.6s infinite alternate' }} />
                      <span style={{ width: 2, height: 10, background: 'var(--color-primary)', display: 'inline-block', animation: 'pulse 0.6s 0.2s infinite alternate' }} />
                      <span style={{ width: 2, height: 10, background: 'var(--color-primary)', display: 'inline-block', animation: 'pulse 0.6s 0.4s infinite alternate' }} />
                    </span>
                  ) : String(i + 1)}
                </span>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
                  {track.coverUrl ? <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> :
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={16} style={{ color: 'var(--color-muted)' }} /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)' }}>
                    {track.title}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--color-muted)' }}>{track.artist}</div>
                </div>
                <span className="text-caption" style={{ color: 'var(--color-muted)', marginRight: 8 }}>{fmt(track.duration)}</span>
                <button onClick={e => { e.stopPropagation(); player.removeFromQueue(track.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

function fmt(s: number): string {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`
}
