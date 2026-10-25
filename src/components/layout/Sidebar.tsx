import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home,
  Compass,
  Clock,
  Heart,
  ListMusic,
  Download,
  Settings,
  Search,
  User,
  ChevronRight,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import { createPlaylist, loadPlaylists, PLAYLISTS_CHANGED_EVENT } from '@/utils/storage'
import type { Playlist } from '@/types'

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
}

const menuGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Bili Music',
    items: [
      { icon: Home, label: '发现', path: '/discover' },
      { icon: Compass, label: '推荐', path: '/recommend' },
    ],
  },
  {
    title: '资料库',
    items: [
      { icon: Clock, label: '最近播放', path: '/recent' },
      { icon: Heart, label: '我喜欢', path: '/favorites' },
      { icon: Download, label: '本地下载', path: '/downloads' },
    ],
  },
  {
    title: '播放列表',
    items: [
      { icon: ListMusic, label: '所有歌单', path: '/playlists' },
    ],
  },
]

const spring = {
  type: 'spring',
  stiffness: 430,
  damping: 34,
  mass: 0.7,
} as const

export default function Sidebar() {
  const { isLoggedIn, username, avatar, setShowLogin } = useAuth()
  const { settings } = useAppSettings()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists())
  const [creating, setCreating] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1100)
  const collapsed = settings.sidebarState === 'collapsed' || (settings.sidebarState === 'auto' && isNarrow)

  useEffect(() => {
    const sync = () => setPlaylists(loadPlaylists())
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const syncWidth = () => setIsNarrow(window.innerWidth < 1100)
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  const handleCreatePlaylist = (input: { name: string; description?: string }) => {
    const playlist = createPlaylist(input)
    setPlaylists(loadPlaylists())
    setCreating(false)
    navigate(`/playlists/${playlist.id}`)
  }

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: collapsed ? 78 : 244,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(28px) saturate(150%)',
          WebkitBackdropFilter: 'blur(28px) saturate(150%)',
          borderRight: '1px solid var(--sidebar-border)',
          boxShadow: 'var(--sidebar-shadow)',
          color: 'var(--sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
          fontFamily:
            "'SF Pro Display', '-apple-system', BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          transition: 'width var(--duration-normal) var(--easing-decelerate)',
        } as React.CSSProperties}
      >
      <div
        style={{
          height: 14,
          flexShrink: 0,
        }}
      />

      <div style={{ padding: '0 14px 14px' }}>
        <NavLink to="/search" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <motion.div
              whileHover={{ backgroundColor: 'var(--sidebar-hover)' }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.18 }}
              style={{
                height: 32,
                borderRadius: 7,
                background: isActive ? 'var(--sidebar-active-bg)' : 'var(--sidebar-search-bg)',
                border: '1px solid var(--sidebar-control-border)',
                boxShadow: isActive ? 'var(--sidebar-active-shadow)' : 'var(--sidebar-control-shadow)',
                color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 8,
                padding: '0 11px',
                cursor: 'pointer',
              }}
            >
              <Search size={15} strokeWidth={2.2} style={{ color: isActive ? 'var(--color-primary)' : 'var(--sidebar-subtle-text)' }} />
              {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1 }}>搜索</span>}
            </motion.div>
          )}
        </NavLink>
      </div>

      <div
        className="sidebar-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 10px 14px',
        }}
      >
        {menuGroups.map((group, groupIndex) => (
          <motion.section
            key={group.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + groupIndex * 0.05, duration: 0.3 }}
            style={{
              marginBottom: 20,
            }}
          >
            <div className={`sidebar-group-title ${collapsed ? 'is-collapsed' : ''}`}>
              {!collapsed && <span>{group.title}</span>}
              {group.title === '播放列表' && (
                <motion.button
                  type="button"
                  aria-label="新建歌单"
                  title="新建歌单"
                  className="sidebar-create-playlist"
                  onClick={() => setCreating(true)}
                  whileHover={{ scale: 1.08, backgroundColor: 'var(--sidebar-hover)' }}
                  whileTap={{ scale: 0.92 }}
                >
                  <Plus size={14} />
                </motion.button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map((item) => (
                <SidebarLink key={item.path} item={item} collapsed={collapsed} />
              ))}
              {group.title === '播放列表' && playlists.map((playlist) => (
                <SidebarLink
                  key={playlist.id}
                  item={{ icon: ListMusic, label: playlist.name, path: `/playlists/${playlist.id}` }}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <div
        style={{
          padding: '10px',
          borderTop: '1px solid var(--sidebar-border)',
          background: 'var(--sidebar-footer-bg)',
          boxShadow: 'var(--sidebar-footer-shadow)',
        }}
      >
        <SidebarLink item={{ icon: Settings, label: '设置', path: '/settings' }} compact collapsed={collapsed} />

        <motion.button
          type="button"
          onClick={() => !isLoggedIn && setShowLogin(true)}
          whileHover={{ backgroundColor: 'var(--sidebar-hover)' }}
          whileTap={{ scale: isLoggedIn ? 1 : 0.985 }}
          transition={{ duration: 0.18 }}
          style={{
            width: '100%',
            marginTop: 6,
            padding: 8,
            border: 'none',
            borderRadius: 13,
            background: 'transparent',
            color: 'var(--sidebar-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            cursor: isLoggedIn ? 'default' : 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: avatar && isLoggedIn
                ? 'var(--sidebar-avatar-bg)'
                : 'linear-gradient(135deg, rgba(255, 55, 95, 0.36), var(--sidebar-avatar-bg))',
              border: '1px solid var(--sidebar-control-border)',
              boxShadow: 'var(--sidebar-avatar-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {avatar && isLoggedIn ? (
              <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={18} strokeWidth={2.1} style={{ color: 'var(--sidebar-muted-text)' }} />
            )}
          </div>

          {!collapsed && <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: 'var(--sidebar-text)',
                fontSize: 13,
                fontWeight: 650,
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoggedIn ? username : '未登录'}
            </div>
            <div
              style={{
                marginTop: 3,
                color: 'var(--sidebar-subtle-text)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isLoggedIn && (
                <motion.span
                  animate={{
                    scale: [1, 1.45, 1],
                    opacity: [0.75, 1, 0.75],
                  }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#30d158',
                    boxShadow: '0 0 12px rgba(48, 209, 88, 0.65)',
                    display: 'inline-block',
                  }}
                />
              )}
              {isLoggedIn ? '在线' : '点击登录账号'}
            </div>
          </div>}

          {!collapsed && <ChevronRight
            size={15}
            strokeWidth={2.2}
            style={{
              color: 'var(--sidebar-faint-text)',
              flexShrink: 0,
            }}
          />}
        </motion.button>
      </div>
      </motion.nav>

      <AnimatePresence>
        {creating && (
          <CreatePlaylistDialog
            onClose={() => setCreating(false)}
            onCreate={handleCreatePlaylist}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function CreatePlaylistDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: { name: string; description?: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const trimmedName = name.trim()

  const submit = () => {
    if (!trimmedName) return
    onCreate({ name: trimmedName, description })
  }

  return (
    <motion.div
      className="playlist-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={onClose}
    >
      <motion.div
        className="playlist-dialog"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="playlist-dialog__head">
          <div>
            <p>New Playlist</p>
            <h2>新建歌单</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <label className="playlist-field">
          <span>歌单名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="例如：深夜循环"
            autoFocus
          />
        </label>

        <label className="playlist-field">
          <span>描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="可选，写一点这个歌单的氛围"
            rows={3}
          />
        </label>

        <div className="playlist-dialog__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={submit} disabled={!trimmedName}>创建</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SidebarLink({ item, compact = false, collapsed = false }: { item: NavItem; compact?: boolean; collapsed?: boolean }) {
  const Icon = item.icon
  const { pathname } = useLocation()

  return (
    <NavLink to={item.path} style={{ textDecoration: 'none' }}>
      {() => {
        const selected = item.path === '/discover'
          ? pathname === '/' || pathname === '/discover'
          : pathname === item.path

        return (
          <motion.div
            whileHover={{
              backgroundColor: selected ? 'var(--sidebar-active-bg)' : 'var(--sidebar-hover)',
              x: selected ? 0 : 2,
            }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.18 }}
            style={{
              height: compact ? 36 : 34,
              borderRadius: 8,
              color: selected ? 'var(--sidebar-text)' : 'var(--sidebar-muted-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              padding: '0 10px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: selected ? 650 : 500,
              lineHeight: 1,
            }}
          >
            {selected && (
              <motion.div
                layoutId="sidebar-active-pill"
                transition={spring}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'var(--sidebar-active-pill)',
                  boxShadow: 'var(--sidebar-active-shadow)',
                }}
              />
            )}

            {selected && (
              <motion.span
                layoutId="sidebar-active-rail"
                transition={spring}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 7,
                  bottom: 7,
                  width: 3,
                  borderRadius: 3,
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 14px rgba(255, 55, 95, 0.8)',
                }}
              />
            )}

            <motion.span
              animate={{
                color: selected ? 'var(--color-primary)' : 'var(--sidebar-subtle-text)',
                scale: selected ? 1.04 : 1,
              }}
              transition={spring}
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
              }}
            >
              <Icon size={18} strokeWidth={selected ? 2.35 : 2} />
            </motion.span>

            {!collapsed && <span
              style={{
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>}
          </motion.div>
        )
      }}
    </NavLink>
  )
}
