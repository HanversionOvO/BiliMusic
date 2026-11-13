import { useCallback, useRef, useState } from 'react'

// 触摸设备：滑条命中区扩大并阻止事件冒泡（误触切歌修复）
const isTouchDevice = typeof window !== 'undefined'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export interface PlayerSliderProps {
  ariaLabel: string
  value: number
  max: number
  onChange: (value: number) => void
  min?: number
  step?: number
  width?: number | string
  disabled?: boolean
  formatValue?: (value: number) => string
  variant: 'progress' | 'volume'
}

/**
 * 可拖拽进度/音量条。从 PlayerBar 抽出共享，供底部播放栏与歌词页复用。
 */
export default function PlayerSlider({
  ariaLabel,
  value,
  max,
  onChange,
  min = 0,
  step,
  width = '100%',
  disabled = false,
  formatValue,
  variant,
}: PlayerSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const pointerIdRef = useRef<number | null>(null)
  const draftRef = useRef<number | null>(null)
  const [draftValue, setDraftValue] = useState<number | null>(null)
  const safeMax = Math.max(max, min)
  const valueRange = safeMax - min
  const clampedValue = clamp(draftValue ?? value, min, safeMax)
  const percent = valueRange > 0 ? ((clampedValue - min) / valueRange) * 100 : 0
  const isActive = isHovered || isDragging
  const keyboardStep = step ?? Math.max(valueRange / 100, 1)

  const updateFromClientX = useCallback((clientX: number) => {
    if (disabled || valueRange <= 0) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const nextPercent = clamp((clientX - rect.left) / rect.width, 0, 1)
    const nextValue = min + nextPercent * valueRange
    draftRef.current = nextValue
    if (variant === 'progress') setDraftValue(nextValue)
    else onChange(nextValue)
  }, [disabled, min, onChange, valueRange, variant])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    event.stopPropagation()
    pointerIdRef.current = null
    // 进度只在松手时提交；取消触摸或失去捕获时保留原播放位置。
    if (event.type === 'pointerup' && !disabled && variant === 'progress') {
      const rect = trackRef.current?.getBoundingClientRect()
      const target = rect && rect.width > 0
        ? min + clamp((event.clientX - rect.left) / rect.width, 0, 1) * valueRange
        : draftRef.current
      if (target !== null) onChange(target)
    }
    draftRef.current = null
    setDraftValue(null)
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [disabled, min, onChange, valueRange, variant])

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(clampedValue)}
      aria-valuetext={formatValue ? formatValue(clampedValue) : String(Math.round(clampedValue))}
      aria-disabled={disabled || undefined}
      data-slider={variant}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled || pointerIdRef.current !== null || event.button !== 0) return
        // 阻止触摸事件冒泡到歌曲行/封面等可点区域（移动端误触切歌）
        event.stopPropagation()
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerIdRef.current = event.pointerId
        setIsDragging(true)
        updateFromClientX(event.clientX)
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current === event.pointerId) {
          event.stopPropagation()
          updateFromClientX(event.clientX)
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(event) => {
        if (disabled) return

        if (event.key === 'Home') {
          event.preventDefault()
          onChange(min)
          return
        }

        if (event.key === 'End') {
          event.preventDefault()
          onChange(safeMax)
          return
        }

        const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -1
            : 0

        if (direction !== 0) {
          event.preventDefault()
          onChange(clamp(clampedValue + direction * keyboardStep, min, safeMax))
        }
      }}
      style={{
        flex: width === '100%' ? 1 : undefined,
        width,
        height: 20,
        // 触摸设备命中区上下扩展（视觉不变）：::before 撑开可点区域
        ...(isTouchDevice ? { height: 44, margin: '-12px 0' } : {}),
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.75 : 1,
        touchAction: 'none',
        outline: 'none',
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: isActive ? 6 : 4,
          transform: 'translateY(-50%)',
          background: 'var(--track-bg, var(--color-border))',
          borderRadius: 'var(--radius-full)',
          transition: 'height var(--duration-fast)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          height: isActive ? 6 : 4,
          width: `${percent}%`,
          transform: 'translateY(-50%)',
          background: 'var(--track-fill, var(--color-accent))',
          borderRadius: 'var(--radius-full)',
          transition: isDragging
            ? 'height var(--duration-fast)'
            : 'width 200ms linear, height var(--duration-fast)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${percent}%`,
          top: '50%',
          width: 12,
          height: 12,
          borderRadius: 'var(--radius-full)',
          background: 'var(--track-thumb, var(--color-on-accent))',
          border: '2px solid var(--track-fill, var(--color-accent))',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
          opacity: isActive && !disabled ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${isActive ? 1 : 0.7})`,
          transition: 'opacity var(--duration-fast), transform var(--duration-fast)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
