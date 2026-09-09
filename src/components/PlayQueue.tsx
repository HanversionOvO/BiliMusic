import { memo, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Trash2,
  GripVertical,
  Music,
  Play,
  ListStart,
  ListChecks,
  ListPlus,
  Check,
} from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { useAddToPlaylist } from '@/contexts/AddToPlaylistContext'
import type { Track } from '@/types'
import { trackCreditLine } from '@/utils/trackMetadata'

function PlayQueue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = usePlayer()
  const { openAddToPlaylist } = useAddToPlaylist()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const queue = player.queue
  const currentId = player.currentTrack?.id
  const selectableIds = queue.filter(t => t.id !== currentId).map(t => t.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  const exitSelect = () => {
    setSelecting(false)
    setSelected(new Set())
  }

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

  const onDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      player.moveInQueue(dragIndex, toIndex)
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'transparent',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: 24,
              bottom: 96,
              width: 396,
              maxHeight: '65vh',
              zIndex: 61,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 18,
              background: 'var(--queue-bg)',
              backdropFilter: 'blur(8px) saturate(120%)',
              WebkitBackdropFilter: 'blur(8px) saturate(120%)',
              border: '1px solid var(--queue-border)',
              boxShadow: 'var(--queue-shadow)',
              overflow: 'hidden',
              contain: 'layout paint style',
              willChange: 'transform, opacity',
              color: 'var(--queue-text)',
              fontFamily:
                "'SF Pro Display', '-apple-system', BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
            } as CSSProperties}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '15px 16px 14px 18px',
                borderBottom: '1px solid var(--queue-divider)',
                background: 'var(--queue-header-bg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--queue-text)' }}>
                  播放队列
                </span>
                <span
                  style={{
                    color: 'var(--queue-text-3)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {queue.length} 首歌曲
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconButton
                  title={selecting ? '退出多选' : '多选'}
                  active={selecting}
                  disabled={queue.length === 0}
                  onClick={toggleSelectMode}
                >
                  <ListChecks size={17} />
                </IconButton>
                <IconButton
                  title="清空队列"
                  disabled={queue.length === 0}
                  danger
                  onClick={() => {
                    player.clearQueue()
                    exitSelect()
                  }}
                >
                  <Trash2 size={17} />
                </IconButton>
                <div style={{ width: 1, height: 16, background: 'var(--queue-divider)', margin: '0 3px' }} />
                <IconButton title="关闭" onClick={onClose}>
                  <X size={19} />
                </IconButton>
              </div>
            </div>

            <div
              className="sidebar-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 8,
              }}
            >
              {queue.length === 0 ? (
                <EmptyQueue />
              ) : (
                <div>
                  {queue.map((track, index) => (
                    <div key={track.id} className="play-queue-row-shell">
                      <QueueRow
                        track={track}
                        isCurrent={track.id === currentId}
                        isPlaying={track.id === currentId && player.isPlaying}
                        selecting={selecting}
                        selected={selected.has(track.id)}
                        isDragOver={overIndex === index && dragIndex !== null && dragIndex !== index}
                        onPlay={() => player.play(track)}
                        onSelect={() => toggleSelect(track.id)}
                        onPlayNext={() => player.playNext(track)}
                        onAddToPlaylist={() => openAddToPlaylist(track)}
                        onRemove={() => player.removeFromQueue(track.id)}
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={() => setOverIndex(index)}
                        onDrop={() => onDrop(index)}
                        onDragEnd={() => {
                          setDragIndex(null)
                          setOverIndex(null)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {selecting && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '11px 18px',
                    borderTop: '1px solid var(--queue-divider)',
                    background: 'var(--queue-footer-bg)',
                    overflow: 'hidden',
                  }}
                >
                  <TextButton onClick={toggleSelectAll} disabled={selectableIds.length === 0}>
                    {allSelected ? '取消全选' : '全选'}
                  </TextButton>
                  <span
                    style={{
                      color: 'var(--queue-text-3)',
                      fontSize: 12,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    已选 {selected.size} 项
                  </span>
                  <motion.button
                    type="button"
                    onClick={removeSelected}
                    disabled={selected.size === 0}
                    whileTap={selected.size === 0 ? undefined : { scale: 0.95 }}
                    style={{
                      height: 30,
                      padding: '0 14px',
                      border: 'none',
                      borderRadius: 999,
                      background: selected.size === 0 ? 'var(--queue-row-active)' : '#ff375f',
                      color: selected.size === 0 ? 'var(--queue-text-4)' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: selected.size === 0 ? 'none' : '0 10px 24px rgba(255, 55, 95, 0.22)',
                    }}
                  >
                    <Trash2 size={15} /> 移除
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default memo(PlayQueue)

function QueueRow({
  track,
  isCurrent,
  isPlaying,
  selecting,
  selected,
  isDragOver,
  onPlay,
  onSelect,
  onPlayNext,
  onAddToPlaylist,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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
  onAddToPlaylist: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <motion.div
      draggable={!selecting}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
      onClick={selecting ? onSelect : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileHover={{ backgroundColor: selected || isCurrent ? 'var(--queue-row-hover-strong)' : 'var(--queue-row-hover)' }}
      transition={{ duration: 0.16 }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 58,
        padding: '8px 8px 8px 9px',
        borderRadius: isDragOver ? 7 : 10,
        background: selected || isCurrent ? 'var(--queue-row-active)' : 'transparent',
        borderTop: isDragOver ? '2px solid #ff375f' : '2px solid transparent',
        cursor: selecting ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {selecting ? (
          <SelectionBox selected={selected} disabled={isCurrent} />
        ) : isCurrent ? (
          <Equalizer active={isPlaying} />
        ) : (
          <motion.span
            animate={{ opacity: hover ? 1 : 0, x: hover ? 0 : -2 }}
            transition={{ duration: 0.16 }}
            style={{ color: 'var(--queue-text-3)', display: 'flex', cursor: 'grab' }}
            title="拖拽调整顺序"
          >
            <GripVertical size={16} />
          </motion.span>
        )}
      </div>

      <div
        onClick={(event) => {
          if (selecting) return
          event.stopPropagation()
          onPlay()
        }}
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          background: 'var(--queue-cover-bg)',
          border: '1px solid var(--queue-cover-border)',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(0, 0, 0, 0.2)',
        }}
      >
        {track.coverUrl ? (
          <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={16} style={{ color: 'var(--queue-text-3)' }} />
          </div>
        )}
        <motion.div
          animate={{ opacity: hover ? 1 : 0 }}
          transition={{ duration: 0.16 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!isCurrent && <Play size={16} fill="currentColor" style={{ color: '#fff', marginLeft: 1 }} />}
        </motion.div>
      </div>

      <div
        onClick={(event) => {
          if (selecting) return
          event.stopPropagation()
          onPlay()
        }}
        style={{ flex: 1, minWidth: 0, paddingRight: 4, cursor: 'pointer' }}
      >
        <div
          style={{
            color: isCurrent ? '#ff4f7a' : 'var(--queue-text)',
            fontSize: 13,
            fontWeight: isCurrent ? 700 : 600,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 160ms ease',
          }}
        >
          {track.title}
        </div>
        <div
          style={{
            marginTop: 4,
            color: hover ? 'var(--queue-text-2)' : 'var(--queue-text-3)',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 160ms ease',
          }}
        >
          {trackCreditLine(track)}
        </div>
      </div>

      <AnimatePresence>
        {!selecting && hover && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.16 }}
            style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
          >
            <IconButton
              title="添加至歌单"
              onClick={(e) => {
                e.stopPropagation()
                onAddToPlaylist()
              }}
            >
              <ListPlus size={16} />
            </IconButton>
            {!isCurrent && (
              <IconButton
                title="下一首播放"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayNext()
                }}
              >
                <ListStart size={16} />
              </IconButton>
            )}
            <IconButton
              title="从队列移除"
              danger
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Equalizer({ active }: { active: boolean }) {
  const bars = [
    { duration: 0.78, values: ['4px', '13px', '5px'] },
    { duration: 0.92, values: ['11px', '4px', '12px'] },
    { duration: 0.68, values: ['6px', '14px', '6px'] },
  ]

  return (
    <div style={{ height: 16, display: 'flex', alignItems: 'end', gap: 2 }}>
      {bars.map((bar, index) => (
        <motion.span
          key={index}
          animate={active ? { height: bar.values } : { height: '5px' }}
          transition={{ repeat: active ? Infinity : 0, duration: bar.duration, ease: 'easeInOut' }}
          style={{
            width: 3,
            borderRadius: 999,
            background: '#ff375f',
            boxShadow: '0 0 10px rgba(255, 55, 95, 0.65)',
          }}
        />
      ))}
    </div>
  )
}

function SelectionBox({ selected, disabled }: { selected: boolean; disabled: boolean }) {
  return (
    <motion.span
      animate={{
        backgroundColor: selected ? '#ff375f' : 'var(--queue-selbox-bg)',
        borderColor: selected ? '#ff375f' : 'var(--queue-selbox-border)',
      }}
      style={{
        width: 16,
        height: 16,
        borderRadius: 5,
        border: '1px solid var(--queue-selbox-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {selected && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
    </motion.span>
  )
}

function EmptyQueue() {
  return (
    <div
      style={{
        minHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--queue-text-3)',
      }}
    >
      <Music size={38} strokeWidth={1.2} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>队列为空</span>
    </div>
  )
}

function IconButton({
  children,
  title,
  active = false,
  disabled = false,
  danger = false,
  onClick,
}: {
  children: ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  danger?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const activeColor = danger ? '#ff453a' : '#ff375f'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      whileHover={disabled ? undefined : {
        backgroundColor: danger ? 'rgba(255, 69, 58, 0.13)' : 'var(--queue-row-hover-strong)',
        color: danger ? '#ff6961' : 'var(--queue-text)',
      }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.16 }}
      style={{
        width: 30,
        height: 30,
        padding: 0,
        borderRadius: 9,
        border: 'none',
        background: active ? 'rgba(255, 55, 95, 0.12)' : 'transparent',
        color: disabled ? 'var(--queue-text-4)' : active ? activeColor : 'var(--queue-icon)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </motion.button>
  )
}

function TextButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 0,
        background: 'none',
        border: 'none',
        color: disabled ? 'var(--queue-text-4)' : '#ff4f7a',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
