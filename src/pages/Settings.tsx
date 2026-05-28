import { Sun, Moon, Monitor, LogOut, LogIn } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/contexts/AuthContext'
import type { ThemeMode } from '@/types'

export default function Settings() {
  const { mode, setMode } = useTheme()
  const { isLoggedIn, username, avatar, logout, setShowLogin } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
      <h1 className="text-h1">设置</h1>

      {/* Appearance */}
      <SettingsGroup title="外观">
        <SettingsRow label="主题模式">
          <RadioGroup
            options={[
              { value: 'light' as ThemeMode, label: '浅色', icon: <Sun size={14} /> },
              { value: 'dark' as ThemeMode, label: '深色', icon: <Moon size={14} /> },
              { value: 'system' as ThemeMode, label: '跟随系统', icon: <Monitor size={14} /> },
            ]}
            value={mode}
            onChange={setMode}
          />
        </SettingsRow>
        <SettingsRow label="侧边栏">
          <RadioGroup
            options={[
              { value: 'expanded', label: '展开' },
              { value: 'collapsed', label: '折叠' },
              { value: 'auto', label: '自动' },
            ]}
            value="auto"
            onChange={() => {}}
          />
        </SettingsRow>
      </SettingsGroup>

      {/* Playback */}
      <SettingsGroup title="播放">
        <SettingsRow label="音质">
          <select
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              fontSize: 'var(--text-caption)',
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              width: 120,
            }}
          >
            <option>标准</option>
            <option>高品质</option>
            <option>无损</option>
          </select>
        </SettingsRow>
        <SettingsRow label="自动播放" description="播放结束时自动播放推荐">
          <ToggleSwitch checked={true} onChange={() => {}} />
        </SettingsRow>
        <SettingsRow label="歌词显示" description="自动显示歌词">
          <ToggleSwitch checked={true} onChange={() => {}} />
        </SettingsRow>
      </SettingsGroup>

      {/* Downloads */}
      <SettingsGroup title="下载">
        <SettingsRow label="下载目录">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-caption" style={{ color: 'var(--color-muted-foreground)' }}>
              D:\Music\biliMusic
            </span>
            <button
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-foreground)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              更改
            </button>
          </div>
        </SettingsRow>
        <SettingsRow label="下载音质">
          <select
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              fontSize: 'var(--text-caption)',
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              width: 120,
            }}
          >
            <option>高品质</option>
            <option>标准</option>
            <option>无损</option>
          </select>
        </SettingsRow>
      </SettingsGroup>

      {/* Account */}
      <SettingsGroup title="账号">
        <SettingsRow label="BiliBili 账号">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLoggedIn && avatar && (
              <img
                src={avatar}
                alt=""
                style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)' }}
              />
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: isLoggedIn ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
            >
              {isLoggedIn ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
                  {username}
                </>
              ) : (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-muted)', display: 'inline-block' }} />
                  未登录
                </>
              )}
            </span>
            {isLoggedIn ? (
              <button
                onClick={logout}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  border: '1px solid var(--color-destructive)',
                  color: 'var(--color-destructive)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background var(--duration-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-destructive)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-destructive)' }}
              >
                <LogOut size={12} />
                退出登录
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background var(--duration-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary)' }}
              >
                <LogIn size={12} />
                扫码登录
              </button>
            )}
          </div>
        </SettingsRow>
      </SettingsGroup>

      {/* About */}
      <SettingsGroup title="关于">
        <SettingsRow label="版本">
          <span className="text-caption" style={{ color: 'var(--color-muted)' }}>
            biliMusic v1.0.0
          </span>
        </SettingsRow>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-foreground)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            检查更新
          </button>
          <button
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-foreground)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            开源许可
          </button>
        </div>
      </SettingsGroup>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="glass-panel"
      style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
    >
      <span className="text-overline" style={{ color: 'var(--color-muted)' }}>
        {title}
      </span>
      {children}
    </div>
  )
}

function SettingsRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: description ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-lg)',
      }}
    >
      <div>
        <div className="text-body">{label}</div>
        {description && (
          <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px',
            border: 'none',
            background: value === opt.value ? 'var(--color-primary)' : 'transparent',
            color: value === opt.value ? 'var(--color-on-primary)' : 'var(--color-foreground)',
            fontSize: 'var(--text-caption)',
            fontWeight: value === opt.value ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all var(--duration-fast) var(--easing-default)',
          }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 'var(--radius-full)',
        background: checked ? 'var(--color-primary)' : 'var(--color-border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background var(--duration-normal) var(--easing-default)',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 'var(--radius-full)',
          background: checked ? '#fff' : 'var(--color-muted)',
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          transition: 'left var(--duration-normal) var(--easing-default), background var(--duration-normal)',
        }}
      />
    </button>
  )
}
