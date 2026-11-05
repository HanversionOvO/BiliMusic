import { useEffect } from 'react'
import { Download, FolderOpen, HardDrive, Loader2, Music, RotateCw, Trash2, WifiOff } from 'lucide-react'
import {
  ActionButton,
  EmptyLibrary,
  MusicHero,
  MusicPageShell,
  MusicSection,
  TrackList,
  TrackListRow,
} from '@/components/AppleMusicPage'
import { usePlayer } from '@/contexts/PlayerContext'
import { useDownloads } from '@/hooks/useDownloads'
import { deleteLocalAudio, openLocalDir } from '@/services/api'
import { loadAppSettings } from '@/utils/storage'
import { downloadTrack, formatDownloadSize, removeDownload, syncDownloadsWithDisk, type DownloadItem } from '@/utils/downloads'
import type { Track } from '@/types'

function toTrack(item: DownloadItem): Track {
  return {
    id: item.trackId,
    title: item.title,
    artist: item.artist,
    coverUrl: item.coverUrl,
    duration: item.duration,
    videoUrl: '',
    bvid: item.bvid,
    playCount: 0,
    isLiked: false,
  }
}

// 移除下载条目：已完成的连同本地文件一起删除
async function handleRemoveDownload(item: DownloadItem) {
  if (item.status === 'completed' && item.filePath) {
    await deleteLocalAudio(item.filePath)
  }
  removeDownload(item.id)
}

export default function Downloads() {
  const player = usePlayer()
  const downloads = useDownloads()
  const completed = downloads.filter(d => d.status === 'completed')
  const downloading = downloads.filter(d => d.status === 'downloading')
  const totalSize = completed.reduce((sum, d) => sum + (d.size || 0), 0)

  // 进入页面时与磁盘同步：清理已在文件管理器中被删除的条目
  useEffect(() => { void syncDownloadsWithDisk() }, [])

  const openDir = async () => {
    const result = await openLocalDir(loadAppSettings().downloadDir)
    if (!result.ok) window.alert(result.error || '无法打开下载目录')
  }

  return (
    <MusicPageShell>
      <MusicHero
        eyebrow="Downloads"
        title="本地下载"
        subtitle="离线音乐会整齐地收在这里，像 Apple Music 资料库一样干净。"
        tone="blue"
        action={(
          <ActionButton tone="subtle" onClick={openDir}>
            <FolderOpen size={16} />
            打开目录
          </ActionButton>
        )}
      />

      <div className="download-dashboard">
        <DownloadMetric icon={<Download size={19} />} label="已下载" value={`${completed.length} 首`} />
        <DownloadMetric icon={<HardDrive size={19} />} label="占用空间" value={formatDownloadSize(totalSize)} />
        <DownloadMetric
          icon={<WifiOff size={19} />}
          label="下载中"
          value={downloading.length > 0 ? `${downloading.length} 首` : '空闲'}
        />
      </div>

      <MusicSection title="下载列表" icon={<Music size={22} />}>
        {downloads.length === 0 ? (
          <div className="download-empty-shell">
            <EmptyLibrary
              icon={<Download size={40} />}
              title="还没有本地音乐"
              subtitle="在歌曲行点击下载按钮，完成后会显示在这里。"
            />
          </div>
        ) : (
          <TrackList>
            {downloads.map((item, index) => (
              <TrackListRow
                key={item.id}
                track={toTrack(item)}
                index={index + 1}
                isCurrent={player.currentTrack?.id === item.trackId}
                isPlaying={player.isPlaying}
                onPlay={() => player.playNow(toTrack(item))}
                extra={(
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ color: 'var(--color-muted)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.status === 'downloading' && <Loader2 size={14} className="spin" style={{ verticalAlign: '-2px', marginRight: 4 }} />}
                      {item.status === 'completed' && formatDownloadSize(item.size)}
                      {item.status === 'failed' && (item.error || '下载失败')}
                    </span>
                    {item.status === 'failed' && (
                      <button
                        className="track-action-button"
                        title="重试下载"
                        onClick={() => { removeDownload(item.id); void downloadTrack(toTrack(item)) }}
                      >
                        <RotateCw size={15} />
                      </button>
                    )}
                    <button
                      className="track-action-button"
                      title="删除下载（含本地文件）"
                      onClick={() => void handleRemoveDownload(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              />
            ))}
          </TrackList>
        )}
      </MusicSection>
    </MusicPageShell>
  )
}

function DownloadMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <article className="download-metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  )
}
