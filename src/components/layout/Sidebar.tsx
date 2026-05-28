import { NavLink } from 'react-router-dom'
import {
  Home,
  Compass,
  Clock,
  Heart,
  ListMusic,
  Download,
  Settings,
  Search,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { icon: Home, label: '发现', path: '/discover' },
  { icon: Search, label: '搜索', path: '/search' },
  { icon: Compass, label: '推荐', path: '/recommend' },
  { icon: Clock, label: '最近播放', path: '/recent' },
  { icon: Heart, label: '我喜欢', path: '/favorites' },
  { icon: ListMusic, label: '歌单', path: '/playlists' },
  { icon: Download, label: '本地下载', path: '/downloads' },
]

export default function Sidebar() {
  const { isLoggedIn, username, avatar, setShowLogin } = useAuth()

  return (
    <nav
      style={{
        width: 200,
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
      } as React.CSSProperties}
    >
      {/* User section */}
      <div
        onClick={() => !isLoggedIn && setShowLogin(true)}
        style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: isLoggedIn ? 'default' : 'pointer',
          transition: 'background var(--duration-fast)',
        }}
        onMouseEnter={(e) => {
          if (!isLoggedIn) e.currentTarget.style.background = 'rgba(251,114,153,0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            background: isLoggedIn && avatar ? undefined : isLoggedIn ? 'var(--color-primary)' : 'var(--color-primary-light)',
            border: '2px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isLoggedIn ? '#fff' : 'var(--color-primary)',
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {isLoggedIn && avatar ? (
            <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            isLoggedIn ? username.charAt(0) : '?'
          )}
        </div>
        <div>
          <div className="text-body" style={{ color: 'var(--color-foreground)' }}>
            {username}
          </div>
          <div
            className="text-caption"
            style={{
              color: isLoggedIn ? 'var(--color-primary)' : 'var(--color-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isLoggedIn && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
            )}
            {isLoggedIn ? '已登录' : '点击登录'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: 'var(--space-sm) 0', flex: 1 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 var(--space-md)',
              height: 40,
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
              background: isActive ? 'var(--color-primary-light)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
              transition: 'all var(--duration-fast) var(--easing-default)',
              cursor: 'pointer',
            } as React.CSSProperties)}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'rgba(251,114,153,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <item.icon size={20} strokeWidth={1.5} />
            <span className="text-body">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Settings */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-sm) 0',
        }}
      >
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 var(--space-md)',
            height: 40,
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
            background: isActive ? 'var(--color-primary-light)' : 'transparent',
            borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
            transition: 'all var(--duration-fast) var(--easing-default)',
            cursor: 'pointer',
          } as React.CSSProperties)}
        >
          <Settings size={20} strokeWidth={1.5} />
          <span className="text-body">设置</span>
        </NavLink>
      </div>
    </nav>
  )
}
