import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Compass,
  Clock,
  Heart,
  Download,
  ListMusic,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react'

interface TabItem {
  icon: LucideIcon
  label: string
  path: string
  exact?: boolean
}

const tabs: TabItem[] = [
  { icon: Compass, label: '推荐', path: '/recommend' },
  { icon: Search, label: '搜索', path: '/search' },
  { icon: Clock, label: '最近', path: '/recent' },
  { icon: Heart, label: '喜欢', path: '/favorites' },
  { icon: ListMusic, label: '歌单', path: '/playlists', exact: true },
  { icon: Settings, label: '设置', path: '/settings' },
]

export default function TabBar() {
  return (
    <nav
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--player-bg)',
        backdropFilter: 'blur(30px) saturate(155%)',
        WebkitBackdropFilter: 'blur(30px) saturate(155%)',
        borderTop: '1px solid var(--player-border)',
        color: 'var(--player-text)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 50,
        fontFamily:
          "'SF Pro Display', '-apple-system', BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      }}
    >
      {tabs.map(({ icon: Icon, label, path, exact }) => (
        <NavLink
          key={path}
          to={path}
          end={exact}
          style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.92 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '7px 0 6px',
                color: isActive ? 'var(--color-primary)' : 'var(--player-subtle-text)',
                cursor: 'pointer',
              }}
            >
              <Icon
                size={21}
                strokeWidth={isActive ? 2.3 : 2}
                style={{ display: 'flex' }}
                fill={isActive && label === '喜欢' ? 'currentColor' : 'none'}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 650 : 500,
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
              <motion.div
                animate={{
                  opacity: isActive ? 1 : 0,
                  scaleX: isActive ? 1 : 0.4,
                }}
                transition={{ duration: 0.25 }}
                style={{
                  width: 16,
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--color-primary)',
                  position: 'relative',
                  top: -1,
                }}
              />
            </motion.div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
