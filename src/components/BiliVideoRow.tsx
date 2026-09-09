import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ListMusic, Loader2, Music, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getVideoDetail, type VideoInfo } from '@/services/api'
import { usePlayer } from '@/contexts/PlayerContext'
import { useAddToPlaylist } from '@/contexts/AddToPlaylistContext'
import TrackActions from '@/components/TrackActions'
import { videoInfoToTrack, videoPageToTrack } from '@/utils/biliTrack'
import type { Track } from '@/types'

const detailCache = new Map<string, Promise<VideoInfo>>()

function loadDetail(bvid: string): Promise<VideoInfo> {
  const cached = detailCache.get(bvid)
  if (cached) return cached
  const request = getVideoDetail(bvid).catch((error) => {
    detailCache.delete(bvid)
    throw error
  })
  detailCache.set(bvid, request)
  return request
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export default function BiliVideoRow({ track, subtitle, durationText }: {
  track: Track
  subtitle: string
  durationText?: string
}) {
  const player = usePlayer()
  const { openAddTracksToPlaylist } = useAddToPlaylist()
  const [detail, setDetail] = useState<VideoInfo | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parts = useMemo(
    () => detail?.pages?.map((page) => videoPageToTrack(detail, page)) || [],
    [detail],
  )
  const primaryTrack = detail ? videoInfoToTrack(detail) : track
  const isCurrent = player.currentTrack?.id === primaryTrack.id

  const toggleParts = async (event: React.MouseEvent) => {
    event.stopPropagation()
    if (detail) {
      setExpanded(value => !value)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await loadDetail(track.bvid)
      setDetail(data)
      setExpanded(true)
    } catch (e: any) {
      setError(e?.message || '分P加载失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bili-video-group ${expanded ? 'is-expanded' : ''}`}>
      <motion.div
        className={`apple-search-row video-row ${isCurrent ? 'is-current' : ''}`}
        onClick={() => player.playNow(primaryTrack)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.995 }}
        transition={{ duration: 0.18 }}
      >
        <div className="apple-search-cover">
          {track.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" /> : <div className="apple-search-cover__fallback"><Music size={20} /></div>}
          <div className="apple-search-cover__play"><Play size={18} fill="currentColor" /></div>
        </div>
        <div className="apple-search-row__main">
          <div className="apple-search-row__title">{track.title}</div>
          <div className="apple-search-row__meta">
            {subtitle}{detail && (detail.pageCount || parts.length) > 1 ? ` · ${detail.pageCount || parts.length}P` : ''}
          </div>
          {error && <div className="bili-video-error">{error}，请点击右侧重试</div>}
        </div>
        {durationText && <span className="apple-search-duration">{durationText}</span>}
        <div className="apple-search-actions"><TrackActions track={primaryTrack} /></div>
        <button
          type="button"
          className={`bili-parts-toggle ${expanded ? 'is-expanded' : ''}`}
          onClick={toggleParts}
          title="查看分P"
          aria-expanded={expanded}
        >
          {loading ? <Loader2 size={17} className="spin" /> : <ChevronDown size={17} />}
        </button>
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && parts.length > 0 && (
          <motion.div
            className="bili-parts-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="bili-parts-toolbar">
              <span><ListMusic size={15} /> {parts.length} 首歌曲</span>
              <div>
                <button type="button" onClick={() => player.playAll(parts)}><Play size={14} fill="currentColor" />播放全部</button>
                <button type="button" onClick={() => player.addTracksToQueue(parts)}><Plus size={14} />加入队列</button>
                <button type="button" onClick={() => openAddTracksToPlaylist(parts)}><ListMusic size={14} />加入歌单</button>
              </div>
            </div>
            {parts.map((part, index) => (
              <div
                key={part.id}
                className={`bili-part-row ${player.currentTrack?.id === part.id ? 'is-current' : ''}`}
                onClick={() => player.playNow(part)}
              >
                <span className="bili-part-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="bili-part-title">{part.title}</span>
                <span className="bili-part-duration">{formatDuration(part.duration)}</span>
                <TrackActions track={part} size={15} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
