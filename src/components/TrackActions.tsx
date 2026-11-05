import { ListStart, Plus, Check, Download, Loader2 } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import AddToPlaylistButton from '@/components/AddToPlaylistButton'
import { useDownloads } from '@/hooks/useDownloads'
import { downloadTrack } from '@/utils/downloads'
import type { Track } from '@/types'

/**
 * 歌曲行内操作：下一首播放 / 加入播放列表 / 下载
 *
 * 点击歌曲本身 = 立即播放（playNow）；这些按钮才执行队列追加/插入/下载逻辑。
 * 外层 stopPropagation，避免触发所在行/卡片的点击播放。
 */
export default function TrackActions({ track, size = 16 }: { track: Track; size?: number }) {
  const player = usePlayer()
  const queued = player.queue.some(t => t.id === track.id)

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <ActionButton
        title="下一首播放"
        onClick={() => player.playNext(track)}
        icon={<ListStart size={size} />}
      />
      <ActionButton
        title={queued ? '已在播放列表' : '加入播放列表'}
        onClick={() => player.addToQueue(track)}
        icon={queued ? <Check size={size} /> : <Plus size={size} />}
        color={queued ? 'var(--color-muted)' : undefined}
      />
      <DownloadTrackButton track={track} size={size} />
      <AddToPlaylistButton track={track} size={size} />
    </div>
  )
}

/**
 * 单曲下载按钮：下载中（转圈）/ 已下载（对勾）/ 可下载或失败重试。
 * 独立导出供自定义 extra 操作区的页面（收藏、歌单）复用。
 */
export function DownloadTrackButton({ track, size = 16 }: { track: Track; size?: number }) {
  const downloads = useDownloads()
  const download = downloads.find(d => d.trackId === track.id)

  if (download?.status === 'downloading') {
    return (
      <ActionButton
        title="下载中…"
        onClick={() => {}}
        icon={<Loader2 size={size} className="spin" />}
        color="var(--color-muted)"
      />
    )
  }
  if (download?.status === 'completed') {
    return (
      <ActionButton
        title="已下载"
        onClick={() => {}}
        icon={<Check size={size} />}
        color="var(--color-muted)"
      />
    )
  }
  return (
    <ActionButton
      title={download?.status === 'failed' ? `下载失败（${download.error || '未知错误'}），点击重试` : '下载到本地'}
      onClick={() => void downloadTrack(track)}
      icon={<Download size={size} />}
    />
  )
}

function ActionButton({ title, onClick, icon, color }: {
  title: string
  onClick: () => void
  icon: React.ReactNode
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="track-action-button"
      style={{ color: color || undefined }}
    >
      {icon}
    </button>
  )
}
