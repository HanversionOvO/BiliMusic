import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from 'react'
import type { Track, RepeatMode } from '@/types'
import { extractAudio, extractAudioPart } from '@/services/api'
import type { PartAudioSource, TrackSource } from '@/services/bilibiliApi'
import { locatePlaybackPosition, timelineDuration } from '@/utils/playbackTimeline'
import { addRecentTrack, toggleFavoriteTrack, loadFavoriteTracks } from '@/utils/storage'
import { useAppSettings } from '@/hooks/useAppSettings'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isShuffled: boolean
  queue: Track[]
  loadingAudio: boolean
}

interface PlayerActions {
  play: (track: Track) => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  setIsMuted: (m: boolean) => void
  setRepeatMode: (m: RepeatMode) => void
  setIsShuffled: (s: boolean) => void
  addToQueue: (track: Track) => void
  addTracksToQueue: (tracks: Track[]) => void
  removeFromQueue: (trackId: string) => void
  removeMultipleFromQueue: (trackIds: string[]) => void
  moveInQueue: (fromIndex: number, toIndex: number) => void
  playNow: (track: Track) => void
  playNext: (track: Track) => void
  clearQueue: () => void
  toggleLike: (trackId: string) => void
  playAll: (tracks: Track[]) => void
  playFromQueue: (index: number) => void
}

interface PlayerProgress {
  progress: number
  duration: number
  setProgress: (p: number) => void
}

type PlayerContext = PlayerState & PlayerActions

interface PersistedPlayerState {
  currentTrack: Track | null
  queue: Track[]
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isShuffled: boolean
  wasPlaying: boolean
  currentIndex: number
}

const PlayerContext = createContext<PlayerContext | null>(null)
const PlayerProgressContext = createContext<PlayerProgress | null>(null)
const PLAYER_STATE_KEY = 'bilimusic_player_state'

function loadPersistedPlayerState(): PersistedPlayerState {
  const fallbackVolume = localStorage.getItem('bilimusic_volume')
  const fallback: PersistedPlayerState = {
    currentTrack: null,
    queue: [],
    progress: 0,
    duration: 0,
    volume: fallbackVolume ? parseInt(fallbackVolume) : 80,
    isMuted: false,
    repeatMode: 'none',
    isShuffled: false,
    wasPlaying: false,
    currentIndex: -1,
  }

  try {
    const raw = localStorage.getItem(PLAYER_STATE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerState>
    const queue = Array.isArray(parsed.queue) ? parsed.queue : []
    return {
      ...fallback,
      ...parsed,
      currentTrack: parsed.currentTrack || null,
      queue,
      progress: Math.max(0, Number(parsed.progress || 0)),
      duration: Math.max(0, Number(parsed.duration || 0)),
      volume: Math.min(100, Math.max(0, Number(parsed.volume ?? fallback.volume))),
      currentIndex: Number.isFinite(parsed.currentIndex) ? Number(parsed.currentIndex) : -1,
      repeatMode: parsed.repeatMode === 'one' || parsed.repeatMode === 'all' ? parsed.repeatMode : 'none',
    }
  } catch {
    return fallback
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shouldIgnoreSpaceShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tagName = target.tagName.toLowerCase()
  if (['input', 'textarea', 'select', 'button'].includes(tagName)) return true
  const role = target.getAttribute('role')
  return Boolean(role && ['button', 'textbox', 'searchbox', 'slider', 'switch', 'combobox'].includes(role))
}

function getArtworkType(url: string): string | undefined {
  if (/\.webp($|\?)/i.test(url)) return 'image/webp'
  if (/\.png($|\?)/i.test(url)) return 'image/png'
  if (/\.(jpe?g)($|\?)/i.test(url)) return 'image/jpeg'
  return undefined
}

function setMediaSessionAction(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler)
  } catch {
    // Some Chromium/Electron platform builds expose only part of the action set.
  }
}

function clearMediaSessionActions(actions: MediaSessionAction[]): void {
  actions.forEach(action => setMediaSessionAction(action, null))
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  const restoredRef = useRef(loadPersistedPlayerState())
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => restoredRef.current.currentTrack)
  const [isPlaying, setIsPlaying] = useState(() => Boolean(restoredRef.current.currentTrack && restoredRef.current.wasPlaying))
  const [progress, setProgress] = useState(() => restoredRef.current.progress)
  const [duration, setDuration] = useState(() => restoredRef.current.duration)
  const [volume, setVolumeState] = useState(() => restoredRef.current.volume)
  const [isMuted, setIsMuted] = useState(() => restoredRef.current.isMuted)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => restoredRef.current.repeatMode)
  const [isShuffled, setIsShuffled] = useState(() => restoredRef.current.isShuffled)
  const [queue, setQueue] = useState<Track[]>(() => restoredRef.current.queue)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shuffledQueueRef = useRef<Track[]>([])
  const currentIndexRef = useRef(restoredRef.current.currentIndex)
  const shouldAutoplayRef = useRef(Boolean(restoredRef.current.currentTrack && restoredRef.current.wasPlaying))
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const progressRef = useRef(progress)
  const durationRef = useRef(duration)
  const pendingSeekRef = useRef<number | null>(null)
  const sourceRef = useRef<TrackSource | null>(null)
  const partIndexRef = useRef(0)
  const partOffsetRef = useRef(0)
  const partRequestRef = useRef(0)
  const partLoadingRef = useRef(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2000)
  }, [])

  // 初始化 audio 元素
  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume / 100
    audioRef.current = audio

    const onTimeUpdate = () => {
      if (!partLoadingRef.current && pendingSeekRef.current === null && !audio.seeking) {
        setProgress(partOffsetRef.current + audio.currentTime)
      }
    }
    const onDuration = () => {
      if (partLoadingRef.current) return
      const parts = sourceRef.current?.parts
      const nextDuration = parts ? timelineDuration(parts) : audio.duration
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        durationRef.current = nextDuration
        setDuration(nextDuration)
      }
    }
    const onSeekReady = () => {
      if (partLoadingRef.current || pendingSeekRef.current === null || audio.seeking || audio.readyState < 2) return
      pendingSeekRef.current = null
      setProgress(partOffsetRef.current + audio.currentTime)
      // 远端 Range 数据就绪后再检查续播；以最新播放意图为准，尊重等待期间的暂停。
      if (shouldAutoplayRef.current && audio.paused) {
        void audio.play().catch(() => {
          if (audioRef.current === audio && shouldAutoplayRef.current) {
            setIsPlaying(false)
            showToast('跳转后播放失败，请点击播放重试')
          }
        })
      }
    }
    const onEnded = () => { /* handled in playTrack */ }
    const onError = () => {
      if (partLoadingRef.current) return
      console.error('[BiliMusic audio error]', audio.error?.code, audio.error?.message,
        { readyState: audio.readyState, networkState: audio.networkState, currentTime: audio.currentTime })
      pendingSeekRef.current = null
      setLoadingAudio(false)
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('seeked', onSeekReady)
    audio.addEventListener('canplay', onSeekReady)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('seeked', onSeekReady)
      audio.removeEventListener('canplay', onSeekReady)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
    }
  }, [showToast])

  // volume 同步到 audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
      audioRef.current.muted = isMuted
    }
    localStorage.setItem('bilimusic_volume', String(volume))
  }, [volume, isMuted])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  // 合集内换分 P：全局进度不变，音频元素只接收目标分 P 的局部时间。
  // 请求序号防止快速连续跳转、切歌后旧请求覆盖最新音源。
  const loadPart = useCallback(async (partIndex: number, partProgress: number, initialSource?: PartAudioSource) => {
    const source = sourceRef.current
    const audio = audioRef.current
    if (!source || !audio) return
    const request = ++partRequestRef.current
    const parts = source.parts
    const offset = parts ? timelineDuration(parts.slice(0, partIndex)) : 0
    const isCurrent = () => request === partRequestRef.current && sourceRef.current === source
    partLoadingRef.current = true
    pendingSeekRef.current = offset + partProgress
    setProgress(offset + partProgress)
    setLoadingAudio(true)
    audio.pause()
    try {
      const partSource = initialSource || await extractAudioPart(source.bvid, parts?.[partIndex].cid ?? source.cid)
      if (!isCurrent()) return
      partIndexRef.current = partIndex
      partOffsetRef.current = offset
      audio.src = partSource.audioUrl
      audio.currentTime = Math.min(Math.max(partProgress, 0), partSource.duration || partProgress)
      partLoadingRef.current = false
      if (shouldAutoplayRef.current) {
        await audio.play()
        if (isCurrent()) setIsPlaying(shouldAutoplayRef.current && !audio.paused)
      } else {
        setIsPlaying(false)
      }
    } catch (error) {
      if (isCurrent()) {
        console.error('[BiliMusic part load failed]', error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          { partIndex, partProgress, mediaError: audio.error?.code, readyState: audio.readyState, networkState: audio.networkState })
        pendingSeekRef.current = null
        // 等待期间用户主动暂停会取消 play()，这不属于加载失败。
        if (shouldAutoplayRef.current || partLoadingRef.current || audio.error) {
          setIsPlaying(false)
          showToast('音频加载失败，请重试')
        }
        setProgress(partOffsetRef.current + audio.currentTime)
      }
    } finally {
      if (isCurrent()) {
        partLoadingRef.current = false
        setLoadingAudio(false)
      }
    }
  }, [showToast])

  const handleTrackEnd = useCallback(() => {
    if (partLoadingRef.current) return
    const parts = sourceRef.current?.parts
    if (parts && partIndexRef.current + 1 < parts.length) {
      void loadPart(partIndexRef.current + 1, 0)
      return
    }
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    if (!settings.autoPlay && repeatMode !== 'one') {
      setIsPlaying(false)
      return
    }
    if (displayQueue.length === 0) {
      setIsPlaying(false)
      return
    }

    switch (repeatMode) {
      case 'one':
        if (parts) {
          shouldAutoplayRef.current = true
          void loadPart(0, 0)
          return
        }
        if (audioRef.current) {
          audioRef.current.currentTime = 0
          shouldAutoplayRef.current = true
          audioRef.current.play().catch(() => {})
        }
        return
      case 'all': {
        const nextIdx = currentIndexRef.current + 1 >= displayQueue.length
          ? 0 : currentIndexRef.current + 1
        currentIndexRef.current = nextIdx
        shouldAutoplayRef.current = true
        setCurrentTrack(displayQueue[nextIdx])
        setProgress(0)
        setIsPlaying(true)
        return
      }
      default: {
        const nextIdx = currentIndexRef.current + 1
        if (nextIdx >= displayQueue.length) {
          setIsPlaying(false)
          return
        }
        currentIndexRef.current = nextIdx
        shouldAutoplayRef.current = true
        setCurrentTrack(displayQueue[nextIdx])
        setProgress(0)
        setIsPlaying(true)
      }
    }
  }, [isShuffled, queue, repeatMode, settings.autoPlay, loadPart])

  // 当 currentTrack 变化时加载并播放音频
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return

    let cancelled = false
    const audio = audioRef.current
    ++partRequestRef.current
    sourceRef.current = null
    partIndexRef.current = 0
    partOffsetRef.current = 0
    partLoadingRef.current = true
    pendingSeekRef.current = null
    audio.pause()

    async function loadAndPlay() {
      setLoadingAudio(true)
      try {
        const fallback = currentTrack!.aid && currentTrack!.cid
          ? { aid: currentTrack!.aid, cid: currentTrack!.cid }
          : undefined
        const source = await extractAudio(currentTrack!.bvid || currentTrack!.id, fallback)
        if (cancelled) return
        const targetProgress = progress > 0 ? progress : 0
        sourceRef.current = source
        durationRef.current = source.duration
        setDuration(source.duration)
        if (source.parts) {
          const position = locatePlaybackPosition(source.parts, targetProgress)
          await loadPart(position.partIndex, position.partProgress, position.partIndex === 0 ? source : undefined)
        } else {
          await loadPart(0, targetProgress, source)
        }
        if (cancelled) return

        // 更新封面（提取到的可能更高清）
        if (source.coverUrl) {
          setCurrentTrack(prev => prev ? { ...prev, coverUrl: source.coverUrl } : null)
        }
        // 记录最近播放
        addRecentTrack({ ...currentTrack!, coverUrl: source.coverUrl || currentTrack!.coverUrl })
      } catch {
        if (!cancelled) {
          // 降级：直接用原始信息触发 play（无音频源，标记为不可播放）
          setIsPlaying(false)
          setLoadingAudio(false)
          partLoadingRef.current = false
        }
      }
    }

    loadAndPlay()
    return () => {
      cancelled = true
      ++partRequestRef.current
      sourceRef.current = null
      pendingSeekRef.current = null
      partLoadingRef.current = false
    }
  }, [currentTrack?.id, currentTrack?.bvid, loadPart])

  // ended 事件
  useEffect(() => {
    if (!audioRef.current) return
    const handler = () => handleTrackEnd()
    audioRef.current.addEventListener('ended', handler)
    return () => audioRef.current?.removeEventListener('ended', handler)
  }, [handleTrackEnd])

  const play = useCallback((track: Track) => {
    shouldAutoplayRef.current = true
    setCurrentTrack(track)
    setProgress(0)
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    const idx = displayQueue.findIndex(t => t.id === track.id)
    currentIndexRef.current = idx >= 0 ? idx : 0
  }, [isShuffled, queue])

  const pause = useCallback(() => {
    shouldAutoplayRef.current = false
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    if (!currentTrack) return
    if (isPlaying) {
      shouldAutoplayRef.current = false
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      shouldAutoplayRef.current = true
      if (partLoadingRef.current) {
        setIsPlaying(true)
        return
      }
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [currentTrack, isPlaying])

  const next = useCallback(() => {
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    if (displayQueue.length === 0) return
    const nextIdx = currentIndexRef.current + 1 >= displayQueue.length
      ? 0 : currentIndexRef.current + 1
    currentIndexRef.current = nextIdx
    shouldAutoplayRef.current = true
    setCurrentTrack(displayQueue[nextIdx])
    setProgress(0)
    setIsPlaying(true)
  }, [isShuffled, queue])

  const prev = useCallback(() => {
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    if (displayQueue.length === 0) return
    const prevIdx = currentIndexRef.current - 1 < 0
      ? displayQueue.length - 1 : currentIndexRef.current - 1
    currentIndexRef.current = prevIdx
    shouldAutoplayRef.current = true
    setCurrentTrack(displayQueue[prevIdx])
    setProgress(0)
    setIsPlaying(true)
  }, [isShuffled, queue])

  // PlayerSlider 在松手时提交一次，避免拖动中反复中断长音频的 Range 请求。
  const handleSetProgress = useCallback((p: number) => {
    const audio = audioRef.current
    const source = sourceRef.current
    if (!audio || !source || !Number.isFinite(p)) return
    const parts = source.parts
    const max = parts ? timelineDuration(parts) : Number.isFinite(audio.duration) ? audio.duration : durationRef.current
    const target = max > 0 ? Math.min(Math.max(p, 0), max) : Math.max(p, 0)
    const position = parts ? locatePlaybackPosition(parts, target) : { partIndex: 0, partProgress: target }
    if (partLoadingRef.current || position.partIndex !== partIndexRef.current) {
      void loadPart(position.partIndex, position.partProgress)
      return
    }
    pendingSeekRef.current = target
    try {
      audio.currentTime = position.partProgress
      setProgress(target)
      // 保留用户手势内的播放请求；seeked/canplay 会在数据就绪后补偿续播。
      if (shouldAutoplayRef.current) void audio.play().catch(() => {})
    } catch {
      pendingSeekRef.current = null
      showToast('暂时无法跳转，请稍后重试')
    }
  }, [showToast, loadPart])

  const handleSetVolume = useCallback((v: number) => {
    setVolumeState(v)
  }, [])

  const addToQueue = useCallback((track: Track) => {
    const exists = queue.some(t => t.id === track.id)
    setQueue(prev => {
      if (prev.some(t => t.id === track.id)) return prev
      const newQueue = [...prev, track]
      if (!currentTrack) {
        shouldAutoplayRef.current = true
        setCurrentTrack(track)
        currentIndexRef.current = 0
      }
      return newQueue
    })
    showToast(exists ? '已在播放列表中' : '已加入播放列表')
  }, [queue, currentTrack, showToast])

  const addTracksToQueue = useCallback((tracks: Track[]) => {
    setQueue(prev => {
      const existingIds = new Set(prev.map(t => t.id))
      const newTracks = tracks.filter(t => !existingIds.has(t.id))
      const newQueue = [...prev, ...newTracks]
      if (!currentTrack && newQueue.length > 0) {
        shouldAutoplayRef.current = true
        setCurrentTrack(newQueue[0])
        currentIndexRef.current = 0
      }
      return newQueue
    })
  }, [currentTrack])

  // 队列变更后把 currentIndexRef 重新对齐到当前曲目（避免 next/prev 错位）
  const resyncIndex = useCallback((nextQueue: Track[]) => {
    const curId = currentTrack?.id
    if (curId) currentIndexRef.current = nextQueue.findIndex(t => t.id === curId)
  }, [currentTrack])

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => {
      const next = prev.filter(t => t.id !== trackId)
      resyncIndex(next)
      return next
    })
  }, [resyncIndex])

  const removeMultipleFromQueue = useCallback((trackIds: string[]) => {
    const idSet = new Set(trackIds)
    setQueue(prev => {
      const next = prev.filter(t => !idSet.has(t.id))
      resyncIndex(next)
      return next
    })
  }, [resyncIndex])

  // 调整顺序：把 fromIndex 的曲目移动到 toIndex
  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 || fromIndex >= prev.length ||
        toIndex < 0 || toIndex >= prev.length
      ) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      resyncIndex(next)
      return next
    })
  }, [resyncIndex])

  // 立即播放：把曲目置于队列首位并播放（点击歌曲的默认行为）
  const playNow = useCallback((track: Track) => {
    shouldAutoplayRef.current = true
    setQueue(prev => [track, ...prev.filter(t => t.id !== track.id)])
    setCurrentTrack(track)
    setProgress(0)
    currentIndexRef.current = 0
    setIsPlaying(true)
  }, [])

  // 下一首播放：把曲目插入到当前曲目之后（不在队列则新增；无播放则等同立即播放）
  const playNext = useCallback((track: Track) => {
    if (!currentTrack) { playNow(track); return }
    setQueue(prev => {
      const without = prev.filter(t => t.id !== track.id)
      const curIdx = without.findIndex(t => t.id === currentTrack.id)
      const insertAt = curIdx >= 0 ? curIdx + 1 : without.length
      const next = [...without.slice(0, insertAt), track, ...without.slice(insertAt)]
      resyncIndex(next)
      return next
    })
    showToast('已设为下一首播放')
  }, [currentTrack, resyncIndex, showToast, playNow])

  const clearQueue = useCallback(() => {
    shouldAutoplayRef.current = false
    setQueue([])
    setCurrentTrack(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  const toggleLike = useCallback((trackId: string) => {
    const track = queue.find(t => t.id === trackId) || currentTrack
    if (track) {
      toggleFavoriteTrack(track)
    }
    setCurrentTrack(prev => prev && prev.id === trackId ? { ...prev, isLiked: !prev.isLiked } : prev)
    setQueue(prev => prev.map(t => t.id === trackId ? { ...t, isLiked: !t.isLiked } : t))
  }, [queue, currentTrack])

  const playAll = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return
    const favs = loadFavoriteTracks()
    const favIds = new Set(favs.map(t => t.id))
    const synced = tracks.map(t => ({ ...t, isLiked: favIds.has(t.id) }))
    setQueue(synced)
    shouldAutoplayRef.current = true
    setCurrentTrack(synced[0])
    currentIndexRef.current = 0
    setProgress(0)
    setIsPlaying(true)
  }, [])

  const playFromQueue = useCallback((index: number) => {
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    if (index < 0 || index >= displayQueue.length) return
    currentIndexRef.current = index
    shouldAutoplayRef.current = true
    setCurrentTrack(displayQueue[index])
    setProgress(0)
    setIsPlaying(true)
  }, [isShuffled, queue])

  // 更新 shuffledQueueRef
  useEffect(() => {
    shuffledQueueRef.current = isShuffled ? shuffleArray(queue) : queue
  }, [queue, isShuffled])

  useEffect(() => {
    if (!currentTrack) {
      currentIndexRef.current = -1
      return
    }
    const displayQueue = isShuffled ? shuffledQueueRef.current : queue
    const index = displayQueue.findIndex(track => track.id === currentTrack.id)
    currentIndexRef.current = index >= 0 ? index : 0
  }, [currentTrack?.id, isShuffled, queue])

  useEffect(() => {
    try {
      const state: PersistedPlayerState = {
        currentTrack,
        queue,
        progress,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffled,
        wasPlaying: isPlaying,
        currentIndex: currentIndexRef.current,
      }
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state))
    } catch {
      // ignore persistence failures
    }
  }, [currentTrack, duration, isMuted, isPlaying, isShuffled, progress, queue, repeatMode, volume])

  useEffect(() => {
    const pushTrayState = () => window.electronAPI?.updateTrayPlayerState?.({
      hasTrack: Boolean(currentTrack),
      title: currentTrack?.title || '未在播放',
      artist: currentTrack?.artist || '搜索并播放音乐',
      coverUrl: currentTrack?.coverUrl || '',
      isPlaying,
      queueLength: queue.length,
      theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    })
    pushTrayState()
    // 主题切换时重新推送，使托盘面板跟随浅色/深色
    const observer = new MutationObserver(pushTrayState)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [currentTrack?.artist, currentTrack?.coverUrl, currentTrack?.id, currentTrack?.title, isPlaying, queue.length])

  useEffect(() => {
    return window.electronAPI?.onTrayPlayerCommand?.((command) => {
      if (command === 'toggle-play') togglePlay()
      if (command === 'next') next()
      if (command === 'prev') prev()
    })
  }, [next, prev, togglePlay])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'Space' || shouldIgnoreSpaceShortcut(event.target)) return
      event.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    setMediaSessionAction('play', () => {
      if (!isPlaying) togglePlay()
    })
    setMediaSessionAction('pause', () => {
      if (isPlaying) togglePlay()
    })
    setMediaSessionAction('stop', pause)
    setMediaSessionAction('nexttrack', next)
    setMediaSessionAction('previoustrack', prev)
    setMediaSessionAction('seekbackward', (details) => {
      const step = details.seekOffset || 10
      handleSetProgress(Math.max(0, progressRef.current - step))
    })
    setMediaSessionAction('seekforward', (details) => {
      const step = details.seekOffset || 10
      const nextProgress = durationRef.current > 0
        ? Math.min(durationRef.current, progressRef.current + step)
        : progressRef.current + step
      handleSetProgress(nextProgress)
    })
    setMediaSessionAction('seekto', (details) => {
      if (typeof details.seekTime === 'number') handleSetProgress(Math.max(0, details.seekTime))
    })

    return () => clearMediaSessionActions([
      'play',
      'pause',
      'stop',
      'nexttrack',
      'previoustrack',
      'seekbackward',
      'seekforward',
      'seekto',
    ])
  }, [handleSetProgress, isPlaying, next, pause, prev, togglePlay])

  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return

    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }

    const artwork = currentTrack.coverUrl
      ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: getArtworkType(currentTrack.coverUrl) }]
      : undefined

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || '未命名歌曲',
      artist: currentTrack.artist || 'BiliMusic',
      album: 'BiliMusic',
      artwork,
    })
  }, [currentTrack?.artist, currentTrack?.coverUrl, currentTrack?.id, currentTrack?.title])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = currentTrack ? (isPlaying ? 'playing' : 'paused') : 'none'
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(progress, 0), duration),
      })
    } catch {
      // Invalid transient durations/progress values should not affect playback.
    }
  }, [currentTrack, duration, progress])

  // 稳定的播放器值：进度（高频）不在其中，故进度跳动不会改变此引用，
  // usePlayer() 的消费者（列表行等）不会因每秒 4 次的进度更新而重渲染。
  const value = useMemo<PlayerContext>(() => ({
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    queue,
    loadingAudio,
    play,
    pause,
    togglePlay,
    next,
    prev,
    setVolume: handleSetVolume,
    setIsMuted,
    setRepeatMode,
    setIsShuffled,
    addToQueue,
    addTracksToQueue,
    removeFromQueue,
    removeMultipleFromQueue,
    moveInQueue,
    playNow,
    playNext,
    clearQueue,
    toggleLike,
    playAll,
    playFromQueue,
  }), [
    currentTrack, isPlaying, volume, isMuted, repeatMode, isShuffled, queue, loadingAudio,
    play, pause, togglePlay, next, prev, handleSetVolume, setIsMuted, setRepeatMode, setIsShuffled,
    addToQueue, addTracksToQueue, removeFromQueue, removeMultipleFromQueue, moveInQueue,
    playNow, playNext, clearQueue, toggleLike, playAll, playFromQueue,
  ])

  // 进度高频更新（timeupdate ~4Hz）独立成 context，仅 PlayerBar/NowPlaying 订阅
  const progressValue = useMemo<PlayerProgress>(() => ({
    progress,
    duration,
    setProgress: handleSetProgress,
  }), [progress, duration, handleSetProgress])

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progressValue}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 96,
            transform: 'translateX(-50%)',
            zIndex: 80,
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--glass-bg-heavy)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--color-foreground)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          } as React.CSSProperties}
        >
          {toast}
        </div>
      )}
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContext {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}

export function usePlayerProgress(): PlayerProgress {
  const ctx = useContext(PlayerProgressContext)
  if (!ctx) throw new Error('usePlayerProgress must be used within PlayerProvider')
  return ctx
}
