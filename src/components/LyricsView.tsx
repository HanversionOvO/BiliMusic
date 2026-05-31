import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { LyricLine } from '@/services/lyrics'

interface LyricsViewProps {
  lines: LyricLine[]
  currentTime: number
  synced: boolean
  onSeek: (time: number) => void
}

// 二分：返回最后一个 time <= t 的下标
function activeIndexFor(lines: LyricLine[], t: number): number {
  let lo = 0
  let hi = lines.length - 1
  let res = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      res = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return res
}

export default function LyricsView({ lines, currentTime, synced, onSeek }: LyricsViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const userScrollingRef = useRef(false)
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [showScrollbar, setShowScrollbar] = useState(false)

  const active = synced ? activeIndexFor(lines, currentTime) : -1
  const posIndex = Math.max(active, 0)

  const scrollActiveLineIntoView = () => {
    const vp = viewportRef.current
    const el = lineRefs.current[posIndex]
    if (!vp || !el) return
    const nextTop = el.offsetTop + el.offsetHeight / 2 - vp.clientHeight / 2
    vp.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }

  // 当前行变化 → 自动滚动到视口中间；用户手动滚动时短暂让出控制权。
  useLayoutEffect(() => {
    if (!synced) return
    if (userScrollingRef.current) return
    scrollActiveLineIntoView()
  }, [posIndex, lines, synced])

  useEffect(() => {
    if (!synced) return
    const recompute = () => scrollActiveLineIntoView()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [posIndex, synced])

  useEffect(() => {
    return () => {
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current)
    }
  }, [])

  const markUserScrolling = () => {
    userScrollingRef.current = true
    setShowScrollbar(true)
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current)
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false
      setShowScrollbar(false)
    }, 2600)
  }

  const fade = 'linear-gradient(to bottom, transparent 0%, #000 13%, #000 84%, transparent 100%)'

  // 无时间戳：静态可滚动列表
  if (!synced) {
    return (
      <div
        className={`lyrics-scroll ${showScrollbar ? 'is-scrolling' : ''}`}
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          maskImage: fade,
          WebkitMaskImage: fade,
          padding: '12% 4px',
        }}
      >
        {lines.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: Math.min(i * 0.018, 0.22) }}
            style={{
              fontSize: 'clamp(1.2rem, 1.6vw, 1.7rem)',
              fontWeight: 720,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.72)',
              margin: '0 0 6px',
            }}
          >
            {l.text}
          </motion.p>
        ))}
      </div>
    )
  }

  // 同步：spring 弹动居中 + 级联高亮
  return (
    <div
      ref={viewportRef}
      className={`lyrics-scroll ${showScrollbar ? 'is-scrolling' : ''}`}
      onWheel={markUserScrolling}
      onTouchMove={markUserScrolling}
      style={{
        position: 'relative',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        style={{ padding: '36% 0' }}
      >
        {lines.map((l, i) => {
          const isActive = i === active
          const dist = Math.abs(i - posIndex)
          const isNear = dist === 1
          return (
            <motion.div
              key={i}
              ref={(el) => { lineRefs.current[i] = el }}
              onClick={() => onSeek(l.time)}
              animate={{
                opacity: isActive ? 1 : isNear ? 0.46 : 0.22,
                scale: isActive ? 1.075 : isNear ? 1.015 : 0.985,
                x: isActive ? 14 : isNear ? 4 : 0,
                filter: isActive ? 'blur(0px)' : isNear ? 'blur(0.5px)' : 'blur(1.5px)',
              }}
              transition={{
                type: 'spring',
                stiffness: 150,
                damping: 24,
                delay: Math.min(dist * 0.025, 0.18),
              }}
              style={{
                transformOrigin: 'left center',
                cursor: 'pointer',
                color: '#fff',
                fontSize: 'clamp(1.46rem, 2.4vw, 2.42rem)',
                fontWeight: 820,
                lineHeight: 1.38,
                padding: '10px 8px',
                margin: 0,
                textShadow: isActive ? '0 8px 34px rgba(0,0,0,0.44), 0 0 26px rgba(255,255,255,0.1)' : 'none',
              }}
            >
              {l.text}
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
