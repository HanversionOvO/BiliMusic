import { motion } from 'framer-motion'
import { Clock, Heart, Music, Play, Trash2 } from 'lucide-react'
import TrackActions from '@/components/TrackActions'
import type { Track } from '@/types'

export function MusicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="am-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function MusicHero({
  eyebrow,
  title,
  subtitle,
  action,
  image,
  tone = 'pink',
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: React.ReactNode
  image?: string
  tone?: 'pink' | 'blue' | 'purple' | 'red'
}) {
  return (
    <section className={`am-hero am-hero--${tone}`}>
      {image && <div className="am-hero__image" style={{ backgroundImage: `url(${image})` }} />}
      <div className="am-hero__grain" />
      <div className="am-hero__blob am-hero__blob--a" />
      <div className="am-hero__blob am-hero__blob--b" />
      <div className="am-hero__content">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
        {action && <div className="am-hero__action">{action}</div>}
      </div>
    </section>
  )
}

export function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'primary' | 'subtle' | 'danger'
}) {
  return (
    <motion.button
      type="button"
      className={`am-action am-action--${tone}`}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
    >
      {children}
    </motion.button>
  )
}

export function MusicSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="am-section">
      <div className="am-section__head">
        {icon && <span>{icon}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function FeaturedGrid({ children }: { children: React.ReactNode }) {
  return <div className="am-featured-grid">{children}</div>
}

export function FeaturedTrackCard({
  track,
  isCurrent,
  onPlay,
  index,
}: {
  track: Track
  isCurrent?: boolean
  onPlay: () => void
  index?: number
}) {
  return (
    <motion.article
      className={`am-feature-card ${isCurrent ? 'is-current' : ''}`}
      onClick={onPlay}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.22 }}
    >
      <div className="am-feature-card__cover">
        {track.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" /> : <CoverFallback />}
        <div className="am-feature-card__shade">
          <span><Play size={24} fill="currentColor" /></span>
        </div>
        {index !== undefined && <b>{String(index).padStart(2, '0')}</b>}
        {track.duration > 0 && <small>{formatDuration(track.duration)}</small>}
      </div>
      <div className="am-feature-card__body">
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist} · {formatCount(track.playCount || 0)}播放</p>
        </div>
        <TrackActions track={track} size={16} />
      </div>
    </motion.article>
  )
}

export function TrackList({ children }: { children: React.ReactNode }) {
  return <div className="am-track-list">{children}</div>
}

export function TrackListRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  extra,
}: {
  track: Track
  index?: number
  isCurrent?: boolean
  isPlaying?: boolean
  onPlay: () => void
  extra?: React.ReactNode
}) {
  return (
    <motion.div
      className={`am-track-row ${isCurrent ? 'is-current' : ''}`}
      onClick={onPlay}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18 }}
    >
      {index !== undefined && (
        <span className="am-track-row__index">
          {isCurrent && isPlaying ? <Equalizer /> : index}
        </span>
      )}
      <div className="am-track-row__cover">
        {track.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" /> : <CoverFallback />}
        <span><Play size={16} fill="currentColor" /></span>
      </div>
      <div className="am-track-row__main">
        <h3>{track.title}</h3>
        <p>{track.artist}</p>
      </div>
      <span className="am-track-row__duration">{formatDuration(track.duration)}</span>
      <div className="am-track-row__actions">
        {extra || <TrackActions track={track} size={15} />}
      </div>
    </motion.div>
  )
}

export function EmptyLibrary({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <motion.div
      className="am-empty"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div>{icon || <Music size={38} />}</div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </motion.div>
  )
}

export function defaultIconFor(kind: 'recent' | 'favorites' | 'queue') {
  if (kind === 'recent') return <Clock size={40} />
  if (kind === 'favorites') return <Heart size={40} />
  return <Music size={40} />
}

function CoverFallback() {
  return <div className="am-cover-fallback"><Music size={20} /></div>
}

function Equalizer() {
  return (
    <span className="am-eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

export { Trash2 }
