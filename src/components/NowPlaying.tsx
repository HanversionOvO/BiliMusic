import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Heart, Volume2, VolumeX, Search, Music, Loader2, Maximize2, Minimize2, X,
} from 'lucide-react'
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext'
import { useNowPlaying } from '@/contexts/NowPlayingContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useLyrics } from '@/hooks/useLyrics'
import PlayerSlider from '@/components/PlayerSlider'
import LyricsView from '@/components/LyricsView'
import type { LyricCandidate } from '@/services/lyrics'

const sliderTheme = {
  ['--track-bg']: 'rgba(255,255,255,0.18)',
  ['--track-fill']: '#ffffff',
  ['--track-thumb']: '#ffffff',
} as React.CSSProperties

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.75 } as const
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function NowPlaying() {
  const player = usePlayer()
  const { progress, duration: liveDuration, setProgress } = usePlayerProgress()
  const { expanded, close } = useNowPlaying()
  const { settings } = useAppSettings()
  const track = player.currentTrack
  const lyrics = useLyrics(track, expanded && settings.showLyrics)
  const duration = liveDuration || track?.duration || 0
  const [fullscreen, setFullscreen] = useState(false)

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

  return (
    <AnimatePresence>
      {expanded && track && (
        <motion.div
          key="now-playing"
          className="now-playing"
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
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

          <header className="now-playing-top" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
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
                  key={track.id}
                  layoutId="np-cover"
                  className="now-playing-cover"
                  src={track.coverUrl}
                  alt={track.title}
                  initial={{ opacity: 0, scale: 0.96, rotateX: 4 }}
                  animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                  transition={spring}
                />
              </div>

              <div className="now-playing-meta">
                <div className="now-playing-title-block">
                  <motion.h1 layoutId="np-title" transition={spring}>{track.title}</motion.h1>
                  <motion.p layoutId="np-artist" transition={spring}>{track.artist}</motion.p>
                </div>
                <motion.button
                  type="button"
                  className={`now-playing-heart ${track.isLiked ? 'is-liked' : ''}`}
                  onClick={() => player.toggleLike(track.id)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  title="喜欢"
                >
                  <Heart size={22} fill={track.isLiked ? 'currentColor' : 'none'} />
                </motion.button>
              </div>

              <div className="now-playing-progress" style={sliderTheme}>
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

              <div className="now-playing-controls">
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
              </div>

              <div className="now-playing-volume" style={sliderTheme}>
                <button type="button" onClick={() => player.setIsMuted(!player.isMuted)}>
                  {player.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <PlayerSlider
                  ariaLabel="音量"
                  value={player.isMuted ? 0 : player.volume}
                  max={100}
                  step={5}
                  onChange={(v) => { player.setVolume(Math.round(v)); if (player.isMuted && v > 0) player.setIsMuted(false) }}
                  variant="volume"
                />
              </div>
            </motion.section>

            <motion.section
              className="now-playing-lyrics-card"
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.16 }}
            >
              {settings.showLyrics ? (
                <LyricsPanel lyrics={lyrics} track={track} onSeek={setProgress} currentTime={progress} />
              ) : (
                <Centered>
                  <Music size={42} strokeWidth={1.25} />
                  <strong>歌词显示已关闭</strong>
                  <span>可以在设置中重新开启歌词显示</span>
                </Centered>
              )}
            </motion.section>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LyricsPanel({
  lyrics, track, onSeek, currentTime,
}: {
  lyrics: ReturnType<typeof useLyrics>
  track: { title: string; artist: string }
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

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
