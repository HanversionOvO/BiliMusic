import { useState } from 'react'
import { X, Trash2, GripVertical, Music, Play, ListStart, ListChecks, CheckSquare, Square } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import type { Track } from '@/types'

export default function PlayQueue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = usePlayer()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (!open) return null

  const queue = player.queue
  const currentId = player.currentTrack?.id
  // 当前曲目不可被选中移除
  const selectableIds = queue.filter(t => t.id !== currentId).map(t => t.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  const exitSelect = () => { setSelecting(false); setSelected(new Set()) }

  const toggleSelectMode = () => {
    if (selecting) exitSelect()
    else setSelecting(true)
  }

  const toggleSelect = (id: string) => {
    if (id === currentId) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(selectableIds))
  }

  const removeSelected = () => {
    if (selected.size === 0) return
    player.removeMultipleFromQueue([...selected])
    exitSelect()
  }

  // ===== 拖拽排序 =====
  const onDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      player.moveInQueue(dragIndex, toIndex)
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <>
      {/* 点击遮罩关闭 */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />

      {/* 面板 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 84,
          width: 384,
          maxHeight: '60vh',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--glass-bg-heavy)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 'var(--space-md)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span className="text-body" style={{ fontWeight: 600 }}>播放队列</span>
          <span className="text-caption" style={{ color: 'var(--color-muted)' }}>{queue.length} 首</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconButton
              icon={<ListChecks size={16} />}
              title={selecting ? '退出多选' : '多选'}
              active={selecting}
              disabled={queue.length === 0}
              onClick={toggleSelectMode}
            />
            <IconButton
              icon={<Trash2 size={16} />}
              title="清空队列"
              disabled={queue.length === 0}
              onClick={() => { player.clearQueue(); exitSelect() }}
            />
            <IconButton icon={<X size={16} />} title="关闭" onClick={onClose} />
          </div>
        </div>

        {/* 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-xs) 0' }}>
          {queue.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', color: 'var(--color-muted)', gap: 8 }}>
              <Music size={32} strokeWidth={1} />
              <span className="text-caption">队列为空</span>
            </div>
          ) : (
            queue.map((track, index) => (
              <QueueRow
                key={track.id}
                track={track}
                isCurrent={track.id === currentId}
                isPlaying={track.id === currentId && player.isPlaying}
                selecting={selecting}
                selected={selected.has(track.id)}
                isDragOver={overIndex === index && dragIndex !== null && dragIndex !== index}
                onPlay={() => player.play(track)}
                onSelect={() => toggleSelect(track.id)}
                onPlayNext={() => player.playNext(track)}
                onRemove={() => player.removeFromQueue(track.id)}
                onDragStart={() => setDragIndex(index)}
                onDragOver={() => setOverIndex(index)}
                onDrop={() => onDrop(index)}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              />
            ))
          )}
        </div>

        {/* 多选底栏 */}
        {selecting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={toggleSelectAll}
              disabled={selectableIds.length === 0}
              style={textBtnStyle(selectableIds.length === 0)}
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
            <span className="text-caption" style={{ color: 'var(--color-muted)' }}>已选 {selected.size} 项</span>
            <button
              onClick={removeSelected}
              disabled={selected.size === 0}
              style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                background: selected.size === 0 ? 'var(--color-border)' : 'var(--color-destructive)',
                color: selected.size === 0 ? 'var(--color-muted)' : '#fff',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Trash2 size={14} /> 移除所选
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function QueueRow({
  track, isCurrent, isPlaying, selecting, selected, isDragOver,
  onPlay, onSelect, onPlayNext, onRemove, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  track: Track
  isCurrent: boolean
  isPlaying: boolean
  selecting: boolean
  selected: boolean
  isDragOver: boolean
  onPlay: () => void
  onSelect: () => void
  onPlayNext: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      draggable={!selecting}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      onClick={selecting ? onSelect : onPlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '6px var(--space-md)',
        cursor: 'pointer',
        background: hover || selected ? 'var(--color-primary-light)' : 'transparent',
        borderTop: isDragOver ? '2px solid var(--color-accent)' : '2px solid transparent',
        transition: 'background var(--duration-fast)',
      }}
    >
      {/* 左：多选框 / 拖拽手柄 */}
      {selecting ? (
        <span style={{ flexShrink: 0, color: 'var(--color-primary)', display: 'flex', opacity: isCurrent ? 0.3 : 1, cursor: isCurrent ? 'not-allowed' : 'pointer' }}>
          {selected ? <CheckSquare size={18} /> : <Square size={18} style={{ color: 'var(--color-muted)' }} />}
        </span>
      ) : (
        <span
          style={{ flexShrink: 0, color: 'var(--color-muted)', display: 'flex', cursor: 'grab', opacity: hover ? 1 : 0.4 }}
          title="拖拽调整顺序"
        >
          <GripVertical size={16} />
        </span>
      )}

      {/* 封面 */}
      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        {track.coverUrl ? (
          <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={14} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
        {isPlaying && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={14} style={{ color: '#fff' }} fill="#fff" />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body" style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artist}
        </div>
      </div>

      {/* 右：行内操作（非多选时显示，hover 行加亮） */}
      {!selecting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: hover ? 1 : 0.55, transition: 'opacity var(--duration-fast)' }}>
          {!isCurrent && (
            <IconButton
              icon={<ListStart size={15} />}
              title="下一首播放"
              onClick={(e) => { e?.stopPropagation(); onPlayNext() }}
            />
          )}
          {!isCurrent && (
            <IconButton
              icon={<Trash2 size={15} />}
              title="移除"
              onClick={(e) => { e?.stopPropagation(); onRemove() }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function IconButton({ icon, title, active = false, disabled = false, onClick }: {
  icon: React.ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick: (e?: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: active ? 'var(--color-primary-light)' : 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--color-border)' : active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
        padding: 5,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        transition: 'color var(--duration-fast), background var(--duration-fast)',
      }}
      onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.color = 'var(--color-primary)' }}
      onMouseLeave={(e) => { if (!disabled && !active) e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
    >
      {icon}
    </button>
  )
}

function textBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-muted)' : 'var(--color-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    padding: 0,
  }
}
