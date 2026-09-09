import { memo, useCallback, useEffect, useRef, useState } from 'react'
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

function LyricsView({ lines, currentTime, synced, onSeek }: LyricsViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const userScrollingRef = useRef(false)
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [showScrollbar, setShowScrollbar] = useState(false)

  const active = synced ? activeIndexFor(lines, currentTime) : -1
  const posIndex = Math.max(active, 0)

  const scrollActiveLineIntoView = useCallback(() => {
    const vp = viewportRef.current
    const el = lineRefs.current[posIndex]
    if (!vp || !el) return
    const nextTop = el.offsetTop + el.offsetHeight / 2 - vp.clientHeight / 2
    vp.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [posIndex])

  // 在浏览器完成布局后再测量和滚动，避免在提交阶段同步触发布局计算。
  useEffect(() => {
    if (!synced) return
    if (userScrollingRef.current) return
    const frame = requestAnimationFrame(scrollActiveLineIntoView)
    return () => cancelAnimationFrame(frame)
  }, [scrollActiveLineIntoView, lines, synced])

  useEffect(() => {
    if (!synced) return
    let frame = 0
    const recompute = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(scrollActiveLineIntoView)
    }
    window.addEventListener('resize', recompute)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', recompute)
    }
  }, [scrollActiveLineIntoView, synced])

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

  // 无时间戳：静态可滚动列表
  if (!synced) {
    return (
      <div
        className={`lyrics-scroll ${showScrollbar ? 'is-scrolling' : ''}`}
        style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '12% 4px' }}
      >
        {lines.map((l, i) => (
          <p
            key={i}
            style={{
              fontSize: 'clamp(1.2rem, 1.6vw, 1.7rem)',
              fontWeight: 720,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.72)',
              margin: '0 0 6px',
            }}
          >
            {l.text}
          </p>
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
      }}
    >
      <div className="lyrics-scroll__content" style={{ padding: '36% 0' }}>
        {lines.map((l, i) => {
          const isActive = i === active
          const dist = Math.abs(i - posIndex)
          const isNear = dist === 1
          const stateClass = isActive ? 'is-active' : isNear ? 'is-near' : 'is-distant'
          return (
            <div
              key={i}
              ref={(el) => { lineRefs.current[i] = el }}
              onClick={() => onSeek(l.time)}
              className={`lyrics-line ${stateClass}`}
              style={{
                fontSize: 'clamp(1.46rem, 2.4vw, 2.42rem)',
              }}
            >
              {l.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 播放进度会高频更新；只有跨到下一句歌词时才需要重绘歌词树。
export default memo(LyricsView, (prev, next) => {
  if (prev.lines !== next.lines || prev.synced !== next.synced || prev.onSeek !== next.onSeek) return false
  if (!next.synced) return true
  return activeIndexFor(prev.lines, prev.currentTime) === activeIndexFor(next.lines, next.currentTime)
})
