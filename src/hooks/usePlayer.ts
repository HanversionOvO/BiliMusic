import { useState, useCallback } from 'react'
import type { Track, RepeatMode } from '@/types'

export function usePlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none')
  const [isShuffled, setIsShuffled] = useState(false)
  const [queue, setQueue] = useState<Track[]>([])

  const play = useCallback((track: Track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    if (!currentTrack) return
    setIsPlaying(prev => !prev)
  }, [currentTrack])

  const next = useCallback(() => {
    if (queue.length === 0) return
    const idx = queue.findIndex(t => t.id === currentTrack?.id)
    const nextIdx = idx + 1 < queue.length ? idx + 1 : 0
    setCurrentTrack(queue[nextIdx])
    setIsPlaying(true)
  }, [currentTrack, queue])

  const prev = useCallback(() => {
    if (queue.length === 0) return
    const idx = queue.findIndex(t => t.id === currentTrack?.id)
    const prevIdx = idx - 1 >= 0 ? idx - 1 : queue.length - 1
    setCurrentTrack(queue[prevIdx])
    setIsPlaying(true)
  }, [currentTrack, queue])

  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => [...prev, track])
  }, [])

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => prev.filter(t => t.id !== trackId))
  }, [])

  const toggleLike = useCallback((trackId: string) => {
    if (currentTrack?.id === trackId) {
      setCurrentTrack(prev => prev ? { ...prev, isLiked: !prev.isLiked } : null)
    }
  }, [currentTrack])

  return {
    currentTrack,
    isPlaying,
    progress,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    queue,
    play,
    pause,
    togglePlay,
    next,
    prev,
    setProgress,
    setVolume,
    setIsMuted,
    setRepeatMode,
    setIsShuffled,
    addToQueue,
    removeFromQueue,
    toggleLike,
  }
}