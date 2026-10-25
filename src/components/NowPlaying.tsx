import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Heart, Volume2, VolumeX, Search, Music, Loader2, Maximize2, Minimize2, X, MessageCircle, ExternalLink, ThumbsUp, RefreshCw,
} from 'lucide-react'
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext'
import { useNowPlaying } from '@/contexts/NowPlayingContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useLyrics } from '@/hooks/useLyrics'
import PlayerSlider from '@/components/PlayerSlider'
import LyricsView from '@/components/LyricsView'
import type { LyricCandidate, LyricSource } from '@/services/lyrics'
import { getVideoComments, type VideoComment } from '@/services/api'

const sliderTheme = {
  ['--track-bg']: 'rgba(255,255,255,0.18)',
  ['--track-fill']: '#ffffff',
  ['--track-thumb']: '#ffffff',
} as React.CSSProperties

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.75 } as const
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties
const commentPageSize = 20

export default function NowPlaying() {
  const navigate = useNavigate()
  const player = usePlayer()
  const { progress, duration: liveDuration, setProgress } = usePlayerProgress()
  const { expanded, close } = useNowPlaying()
  const { settings, setAppSettings } = useAppSettings()
  const track = player.currentTrack
  const lyrics = useLyrics(track, expanded && settings.showLyrics, settings.lyricsSource)
  const duration = liveDuration > 0
    ? liveDuration
    : track?.pageCid
      ? (track.duration || 0)
      : 0
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsStatus, setCommentsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [comments, setComments] = useState<VideoComment[]>([])
  const [commentsPage, setCommentsPage] = useState(1)
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [commentsError, setCommentsError] = useState('')
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, close])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.isFullscreen?.().then(setFullscreen).catch(() => {})
    return api.onFullscreenChange?.(setFullscreen)
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (api?.platform !== 'openharmony') return
    api.setWindowButtonVisibility?.(!expanded)
    return () => api.setWindowButtonVisibility?.(true)
  }, [expanded])

  const toggleFullscreen = () => {
    window.electronAPI?.toggleFullscreen?.()
    window.electronAPI?.isFullscreen?.()
      .then(setFullscreen)
      .catch(() => {})
    window.setTimeout(() => {
      window.electronAPI?.isFullscreen?.()
        .then(setFullscreen)
        .catch(() => {})
    }, 180)
  }

  const closeToTray = () => {
    window.electronAPI?.close()
  }

  const openArtistSpace = () => {
    if (!track?.artist.trim()) return
    close()
    navigate('/search', { state: { openArtist: track.artist } })
  }

  const openSourceVideo = () => {
    if (!track?.bvid) return
    window.electronAPI?.openExternal?.(`https://www.bilibili.com/video/${track.bvid}`)
  }

  const loadComments = useCallback(async (page = 1) => {
    if (!track?.bvid && !track?.aid) return
    if (page === 1) {
      setCommentsStatus('loading')
      setCommentsError('')
    } else {
      setCommentsLoadingMore(true)
    }

    try {
      const data = await getVideoComments({ bvid: track.bvid, aid: track.aid }, page, commentPageSize)
      setComments((prev) => page === 1 ? data.items : [...prev, ...data.items])
      setCommentsTotal(data.total)
      setCommentsPage(page)
      setCommentsStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : '评论加载失败'
      setCommentsError(message)
      setCommentsStatus('error')
    } finally {
      setCommentsLoadingMore(false)
    }
  }, [track?.aid, track?.bvid])

  const toggleComments = () => {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)
    if (nextOpen && commentsStatus === 'idle') {
      void loadComments(1)
    }
  }

  useEffect(() => {
    if (!expanded || !fullscreen) {
      setControlsVisible(true)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const revealControls = () => {
      setControlsVisible(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setControlsVisible(false), 5000)
    }

    revealControls()
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart', 'touchmove']
    events.forEach(event => window.addEventListener(event, revealControls, { passive: true }))
    return () => {
      if (timer) clearTimeout(timer)
      events.forEach(event => window.removeEventListener(event, revealControls))
    }
  }, [expanded, fullscreen])

  useEffect(() => {
    setCommentsOpen(false)
    setCommentsStatus('idle')
    setComments([])
    setCommentsPage(1)
    setCommentsTotal(0)
    setCommentsError('')
    setCommentsLoadingMore(false)
  }, [track?.id])

  return (
    <AnimatePresence>
      {expanded && track && (
        <motion.div
          key="now-playing"
          className={`now-playing ${fullscreen ? 'is-fullscreen' : ''} ${fullscreen && !controlsVisible ? 'is-immersive-idle' : ''}`}
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="now-playing-smoke" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="now-playing-bg">
            {track.coverUrl && (
              <>
                <motion.div
                  className="now-playing-bg__cover"
                  style={{ backgroundImage: `url(${track.coverUrl})` }}
                  initial={{ opacity: 0, scale: 1.12 }}
                  animate={{ opacity: 0.72, scale: [1.16, 1.25, 1.18] }}
                  transition={{ opacity: { duration: 0.8 }, scale: { duration: 22, repeat: Infinity, ease: 'easeInOut' } }}
                />
                <motion.div
                  className="now-playing-bg__disc"
                  style={{ backgroundImage: `url(${track.coverUrl})` }}
                  animate={{ rotate: player.isPlaying ? 360 : 0 }}
                  transition={{ duration: 34, repeat: player.isPlaying ? Infinity : 0, ease: 'linear' }}
                />
              </>
            )}
          </div>

          <header className="now-playing-top now-playing-ui now-playing-ui--top" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <motion.button
              type="button"
              className="now-playing-close"
              onClick={close}
              title="收起 (Esc)"
              style={noDrag}
              whileHover={{ y: 1, backgroundColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.92 }}
            >
              <ChevronDown size={21} />
            </motion.button>
            <div className="now-playing-top__actions" style={noDrag}>
              <motion.button
                type="button"
                className="now-playing-close"
                onClick={openSourceVideo}
                title="在浏览器中打开视频"
                whileHover={{ y: 1, backgroundColor: 'rgba(255,255,255,0.18)' }}
                whileTap={{ scale: 0.92 }}
              >
                <ExternalLink size={18} />
              </motion.button>
              <motion.button
                type="button"
                className="now-playing-close"
                onClick={toggleFullscreen}
                title={fullscreen ? '退出全屏' : '全屏'}
                whileHover={{ y: 1, backgroundColor: 'rgba(255,255,255,0.18)' }}
                whileTap={{ scale: 0.92 }}
              >
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </motion.button>
              <motion.button
                type="button"
                className="now-playing-close"
                onClick={closeToTray}
                title="关闭到托盘"
                whileHover={{ y: 1, backgroundColor: 'rgba(255,255,255,0.18)' }}
                whileTap={{ scale: 0.92 }}
              >
                <X size={19} />
              </motion.button>
            </div>
          </header>

          <main className="now-playing-main">
            <motion.section
              className="now-playing-left"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.08 }}
            >
              <div className="now-playing-cover-wrap">
                <motion.div
                  className="now-playing-cover-glow"
                  animate={{ opacity: player.isPlaying ? [0.35, 0.72, 0.4] : 0.26 }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.img
                  layoutId="np-cover"
                  className="now-playing-cover"
                  src={track.coverUrl}
                  alt={track.title}
                  loading="eager"
                  decoding="sync"
                  draggable={false}
                  initial={false}
                  animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                  transition={spring}
                />
              </div>

              <div className="now-playing-meta">
                <div className="now-playing-title-block">
                  <motion.h1 layoutId="np-title" transition={spring}>{track.title}</motion.h1>
                  <motion.button
                    type="button"
                    className="now-playing-artist-link"
                    layoutId="np-artist"
                    transition={spring}
                    onClick={openArtistSpace}
                    title={`查看 ${track.artist} 的个人空间`}
                  >
                    {track.artist}
                  </motion.button>
                </div>
                <motion.button
                  type="button"
                  className={`now-playing-heart now-playing-ui ${track.isLiked ? 'is-liked' : ''}`}
                  onClick={() => player.toggleLike(track.id)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  title="喜欢"
                >
                  <Heart size={22} fill={track.isLiked ? 'currentColor' : 'none'} />
                </motion.button>
              </div>

              <div className="now-playing-progress now-playing-ui" style={sliderTheme}>
                <PlayerSlider
                  ariaLabel="播放进度"
                  value={progress}
                  max={duration}
                  onChange={setProgress}
                  disabled={duration <= 0}
                  formatValue={formatTime}
                  variant="progress"
                />
                <div className="now-playing-time">
                  <span>{formatTime(progress)}</span>
                  <span>-{formatTime(Math.max(duration - progress, 0))}</span>
                </div>
              </div>

              <div className="now-playing-controls now-playing-ui now-playing-ui--controls">
                <div className="now-playing-volume-popover" style={sliderTheme}>
                  <motion.button
                    type="button"
                    className="now-playing-volume-trigger"
                    onClick={() => player.setIsMuted(!player.isMuted)}
                    title={player.isMuted ? '取消静音' : '静音'}
                    whileHover={{ scale: 1.08, y: -1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {player.isMuted || player.volume <= 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </motion.button>
                  <div className="now-playing-volume-panel">
                    <PlayerSlider
                      ariaLabel="音量"
                      value={player.isMuted ? 0 : player.volume}
                      max={100}
                      step={5}
                      onChange={(v) => { player.setVolume(Math.round(v)); if (player.isMuted && v > 0) player.setIsMuted(false) }}
                      variant="volume"
                    />
                  </div>
                </div>
                <div className="now-playing-control-cluster">
                  <RoundIcon active={player.isShuffled} onClick={() => player.setIsShuffled(!player.isShuffled)} title="随机播放">
                    <Shuffle size={20} />
                  </RoundIcon>
                  <RoundIcon onClick={player.prev} title="上一首">
                    <SkipBack size={27} />
                  </RoundIcon>
                  <motion.button
                    type="button"
                    className="now-playing-play"
                    onClick={player.togglePlay}
                    disabled={player.loadingAudio}
                    whileHover={{ scale: player.loadingAudio ? 1 : 1.045 }}
                    whileTap={{ scale: player.loadingAudio ? 1 : 0.94 }}
                  >
                    {player.loadingAudio
                      ? <Loader2 size={27} className="spin" />
                      : player.isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 3 }} />}
                  </motion.button>
                  <RoundIcon onClick={player.next} title="下一首">
                    <SkipForward size={27} />
                  </RoundIcon>
                  <RoundIcon
                    active={player.repeatMode !== 'none'}
                    onClick={() => {
                      const modes = ['none', 'all', 'one'] as const
                      player.setRepeatMode(modes[(modes.indexOf(player.repeatMode) + 1) % 3])
                    }}
                    title="循环模式"
                  >
                    <span className="now-playing-repeat">
                      <Repeat size={20} />
                      {player.repeatMode === 'one' && <span>1</span>}
                    </span>
                  </RoundIcon>
                  <RoundIcon active={commentsOpen} onClick={toggleComments} title="查看评论">
                    <MessageCircle size={20} />
                  </RoundIcon>
                </div>
              </div>
            </motion.section>

            <motion.section
              className="now-playing-lyrics-card"
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.16 }}
            >
              {settings.showLyrics ? (
                <LyricsPanel
                  lyrics={lyrics}
                  track={track}
                  source={settings.lyricsSource}
                  onSourceChange={(lyricsSource) => setAppSettings({ lyricsSource })}
                  onSeek={setProgress}
                  currentTime={progress}
                />
              ) : (
                <Centered>
                  <Music size={42} strokeWidth={1.25} />
                  <strong>歌词显示已关闭</strong>
                  <span>可以在设置中重新开启歌词显示</span>
                </Centered>
              )}
            </motion.section>
          </main>

          <AnimatePresence>
            {commentsOpen && (
              <CommentsPanel
                comments={comments}
                status={commentsStatus}
                error={commentsError}
                total={commentsTotal}
                coverUrl={track.coverUrl}
                hasMore={comments.length > 0 && comments.length < commentsTotal}
                loadingMore={commentsLoadingMore}
                onClose={() => setCommentsOpen(false)}
                onRetry={() => loadComments(1)}
                onLoadMore={() => loadComments(commentsPage + 1)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CommentsPanel({
  comments,
  status,
  error,
  total,
  coverUrl,
  hasMore,
  loadingMore,
  onClose,
  onRetry,
  onLoadMore,
}: {
  comments: VideoComment[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  total: number
  coverUrl: string
  hasMore: boolean
  loadingMore: boolean
  onClose: () => void
  onRetry: () => void
  onLoadMore: () => void
}) {
  return (
    <motion.aside
      className="now-playing-comments"
      style={{ '--comment-cover': coverUrl ? `url(${coverUrl})` : 'none' } as React.CSSProperties}
      initial={{ opacity: 0, x: 42, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 42, scale: 0.985 }}
      transition={spring}
    >
      <div className="now-playing-comments__aura" aria-hidden="true" />
      <div className="now-playing-comments__head">
        <div>
          <span><MessageCircle size={17} />评论</span>
          <small>{total > 0 ? `${formatCount(total)} 条互动` : '正在读取 Bilibili 评论'}</small>
        </div>
        <button type="button" onClick={onClose} title="关闭评论">
          <X size={18} />
        </button>
      </div>

      <div className="now-playing-comments__body">
        {status === 'loading' && (
          <Centered>
            <Loader2 size={28} className="spin" />
            <span>正在加载评论...</span>
          </Centered>
        )}

        {status === 'error' && (
          <Centered>
            <MessageCircle size={42} strokeWidth={1.25} />
            <strong>评论加载失败</strong>
            <span>{error || '稍后再试一次'}</span>
            <button type="button" onClick={onRetry}><RefreshCw size={14} /> 重新加载</button>
          </Centered>
        )}

        {status === 'ready' && comments.length === 0 && (
          <Centered>
            <MessageCircle size={42} strokeWidth={1.25} />
            <strong>暂无评论</strong>
            <span>这个视频下还没有可展示的评论</span>
          </Centered>
        )}

        {status === 'ready' && comments.length > 0 && (
          <div className="now-playing-comments__list">
            {comments.map((comment) => (
              <article key={comment.id} className="now-playing-comment">
                {comment.avatar
                  ? <img src={comment.avatar} alt="" />
                  : <div className="now-playing-comment__avatar">{comment.author.slice(0, 1).toUpperCase()}</div>}
                <div className="now-playing-comment__content">
                  <div className="now-playing-comment__meta">
                    <strong>{comment.author}</strong>
                    <span>{formatCommentTime(comment.createdAt)}</span>
                  </div>
                  <p>{comment.message}</p>
                  <div className="now-playing-comment__stats">
                    <span><ThumbsUp size={13} />{formatCount(comment.like)}</span>
                    {comment.replyCount > 0 && <span>{formatCount(comment.replyCount)} 条回复</span>}
                  </div>
                </div>
              </article>
            ))}

            {hasMore && (
              <button type="button" className="now-playing-comments__more" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 size={15} className="spin" /> : <MessageCircle size={15} />}
                {loadingMore ? '加载中...' : '加载更多评论'}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.aside>
  )
}

function LyricsPanel({
  lyrics, track, source, onSourceChange, onSeek, currentTime,
}: {
  lyrics: ReturnType<typeof useLyrics>
  track: { title: string; artist: string }
  source: LyricSource
  onSourceChange: (source: LyricSource) => void
  onSeek: (t: number) => void
  currentTime: number
}) {
  const { status, result, search, choose, retry } = lyrics
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LyricCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [choosingId, setChoosingId] = useState<string | null>(null)

  const openSearch = () => {
    setQuery(`${track.title} ${track.artist}`.trim())
    setResults([])
    setSearchOpen(true)
  }

  const doSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    const r = await search(query)
    setResults(r)
    setSearching(false)
  }

  const pick = async (record: LyricCandidate) => {
    setChoosingId(record.id)
    await choose(record)
    setChoosingId(null)
    setSearchOpen(false)
  }

  return (
    <div className="lyrics-panel">
      <div className="lyrics-panel__toolbar">
        <label className="lyrics-source-picker">
          <span>歌词来源</span>
          <span className="lyrics-source-select">
            <select
              value={source}
              onChange={(event) => onSourceChange(event.target.value as LyricSource)}
              aria-label="歌词来源"
            >
              <option value="auto">自动</option>
              <option value="remote">QQ Music</option>
              <option value="bilibili">Bilibili AI 字幕</option>
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </span>
        </label>
      </div>
      <div className="lyrics-panel__body">
        {status === 'loading' && (
          <Centered>
            <Loader2 size={28} className="spin" />
            <span>匹配歌词中...</span>
          </Centered>
        )}
        {status === 'empty' && (
          <Centered>
            <Music size={42} strokeWidth={1.25} />
            <strong>暂无歌词</strong>
            <span>这首歌在歌词库里还没有匹配到</span>
            <button type="button" onClick={openSearch}><Search size={14} /> 手动搜索歌词</button>
          </Centered>
        )}
        {(status === 'ok' || status === 'unsynced') && result && (
          <>
            {status === 'unsynced' && <div className="lyrics-panel__hint">该版本无逐行时间轴，按普通歌词显示</div>}
            <LyricsView lines={result.lines} currentTime={currentTime} synced={result.synced} onSeek={onSeek} />
          </>
        )}
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="lyrics-drawer"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.985 }}
            transition={spring}
          >
            <div className="lyrics-drawer__head">
              <span>手动匹配歌词</span>
              <button type="button" onClick={() => setSearchOpen(false)}><X size={18} /></button>
            </div>
            <div className="lyrics-drawer__search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
                placeholder="歌名 歌手"
                autoFocus
              />
              <button type="button" onClick={doSearch} disabled={searching}>
                {searching ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
                搜索
              </button>
            </div>
            <div className="lyrics-drawer__list">
              {results.length === 0 && !searching && <div className="lyrics-drawer__empty">输入歌名或歌手后搜索</div>}
              {results.map((r) => (
                <button key={r.id} type="button" className="lyrics-candidate" onClick={() => pick(r)} disabled={choosingId === r.id}>
                  <span>
                    <strong>{r.trackName}</strong>
                    <small>{r.artistName} · {r.albumName || 'QQ Music'} · {formatTime(r.duration)}</small>
                  </span>
                  {choosingId === r.id ? <Loader2 size={16} className="spin" /> : <span>选择</span>}
                </button>
              ))}
            </div>
            <button type="button" className="lyrics-drawer__retry" onClick={() => { retry(); setSearchOpen(false) }}>
              重新自动匹配
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RoundIcon({ children, active, onClick, title }: { children: ReactNode; active?: boolean; onClick: () => void; title: string }) {
  return (
    <motion.button
      type="button"
      className={`now-playing-round ${active ? 'is-active' : ''}`}
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.08, y: -1 }}
      whileTap={{ scale: 0.9 }}
    >
      {children}
    </motion.button>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="lyrics-centered">{children}</div>
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`
  return n.toString()
}

function formatCommentTime(seconds: number): string {
  if (!seconds) return ''
  const date = new Date(seconds * 1000)
  const now = Date.now()
  const diff = Math.max(0, now - date.getTime())
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
