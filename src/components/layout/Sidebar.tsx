import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

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

  return (
    <motion.nav
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: 244,
        background:
          'linear-gradient(180deg, rgba(25, 25, 28, 0.84) 0%, rgba(12, 12, 14, 0.9) 100%)',
        backdropFilter: 'blur(28px) saturate(150%)',
        WebkitBackdropFilter: 'blur(28px) saturate(150%)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '18px 0 42px rgba(0, 0, 0, 0.14), inset -1px 0 rgba(255, 255, 255, 0.04)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        fontFamily:
          "'SF Pro Display', '-apple-system', BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.14)' }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.18 }}
              style={{
                height: 32,
                borderRadius: 7,
                background: isActive ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isActive ? '0 8px 24px rgba(251, 55, 97, 0.14)' : 'inset 0 1px rgba(255, 255, 255, 0.06)',
                color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.64)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 11px',
                cursor: 'pointer',
              }}
            >
              <Search size={15} strokeWidth={2.2} style={{ color: isActive ? '#ff375f' : 'rgba(255, 255, 255, 0.45)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1 }}>搜索</span>
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
            <div
              style={{
                padding: '0 10px 7px',
                color: 'rgba(255, 255, 255, 0.43)',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: 0.3,
              }}
            >
              {group.title}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map((item) => (
                <SidebarLink key={item.path} item={item} />
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <div
        style={{
          padding: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.06))',
          boxShadow: '0 -12px 32px rgba(0, 0, 0, 0.18)',
        }}
      >
        <SidebarLink item={{ icon: Settings, label: '设置', path: '/settings' }} compact />

        <motion.button
          type="button"
          onClick={() => !isLoggedIn && setShowLogin(true)}
          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          whileTap={{ scale: isLoggedIn ? 1 : 0.985 }}
          transition={{ duration: 0.18 }}
          style={{
            width: '100%',
            marginTop: 6,
            padding: 8,
            border: 'none',
            borderRadius: 13,
            background: 'transparent',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
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
                ? 'rgba(255, 255, 255, 0.08)'
                : 'linear-gradient(135deg, rgba(255, 55, 95, 0.42), rgba(255, 255, 255, 0.1))',
              border: '1px solid rgba(255, 255, 255, 0.13)',
              boxShadow: 'inset 0 1px rgba(255, 255, 255, 0.18), 0 8px 20px rgba(0, 0, 0, 0.2)',
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
              <User size={18} strokeWidth={2.1} style={{ color: 'rgba(255, 255, 255, 0.74)' }} />
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.94)',
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
                color: 'rgba(255, 255, 255, 0.46)',
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
          </div>

          <ChevronRight
            size={15}
            strokeWidth={2.2}
            style={{
              color: 'rgba(255, 255, 255, 0.28)',
              flexShrink: 0,
            }}
          />
        </motion.button>
      </div>
    </motion.nav>
  )
}

function SidebarLink({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const Icon = item.icon
  const { pathname } = useLocation()

  return (
    <NavLink to={item.path} style={{ textDecoration: 'none' }}>
      {({ isActive }) => {
        const selected = isActive || (item.path === '/discover' && pathname === '/')

        return (
          <motion.div
            whileHover={{
              backgroundColor: selected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              x: selected ? 0 : 2,
            }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.18 }}
            style={{
              height: compact ? 36 : 34,
              borderRadius: 8,
              color: selected ? '#fff' : 'rgba(255, 255, 255, 0.68)',
              display: 'flex',
              alignItems: 'center',
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
                  background:
                    'linear-gradient(90deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.1))',
                  boxShadow:
                    'inset 0 1px rgba(255, 255, 255, 0.12), 0 10px 24px rgba(0, 0, 0, 0.16)',
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
                  background: '#ff375f',
                  boxShadow: '0 0 14px rgba(255, 55, 95, 0.8)',
                }}
              />
            )}

            <motion.span
              animate={{
                color: selected ? '#ff375f' : 'rgba(255, 255, 255, 0.42)',
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

            <span
              style={{
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </motion.div>
        )
      }}
    </NavLink>
  )
}
