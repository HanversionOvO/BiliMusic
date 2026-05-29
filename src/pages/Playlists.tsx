import { ListMusic, Play, Trash2, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
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

export default function Playlists() {
  const player = usePlayer()
  const queue = player.queue
  const heroImage = player.currentTrack?.coverUrl || queue[0]?.coverUrl

  return (
    <MusicPageShell>
      <MusicHero
        eyebrow="Up Next"
        title="播放列表"
        subtitle={queue.length ? `队列中共有 ${queue.length} 首，按你的播放节奏继续前进。` : '搜索歌曲并添加到播放列表，构建接下来要听的队列。'}
        image={heroImage}
        tone="purple"
        action={queue.length > 0 && (
          <>
            <ActionButton onClick={() => player.playFromQueue(0)}>
              <Play size={17} fill="currentColor" />
              播放全部
            </ActionButton>
            <ActionButton onClick={player.clearQueue} tone="subtle">
              <Trash2 size={16} />
              清空
            </ActionButton>
          </>
        )}
      />

      {queue.length === 0 ? (
        <EmptyLibrary icon={defaultIconFor('queue')} title="队列为空" subtitle="把搜索结果加入播放列表后，会在这里看到接下来播放的内容。" />
      ) : (
        <MusicSection title={player.currentTrack ? `正在播放: ${player.currentTrack.title}` : '队列'} icon={<ListMusic size={22} />}>
          <TrackList>
            {queue.map((track, index) => {
              const isCurrent = player.currentTrack?.id === track.id
              return (
                <TrackListRow
                  key={track.id + String(index)}
                  track={track}
                  index={index + 1}
                  isCurrent={isCurrent}
                  isPlaying={player.isPlaying}
                  onPlay={() => player.playFromQueue(index)}
                  extra={(
                    <button className="am-icon-button" onClick={(e) => { e.stopPropagation(); player.removeFromQueue(track.id) }} title="移出播放列表">
                      <X size={16} />
                    </button>
                  )}
                />
              )
            })}
          </TrackList>
        </MusicSection>
      )}
    </MusicPageShell>
  )
}
