import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getLoginStatus, getUserInfo, logout as apiLogout } from '@/services/api'

const STORAGE_KEY = 'bilimusic_user'

interface AuthState {
  isLoggedIn: boolean
  username: string
  avatar: string
  loading: boolean
}

interface AuthActions {
  checkLogin: () => Promise<void>
  logout: () => Promise<void>
  showLogin: boolean
  setShowLogin: (open: boolean) => void
}

type AuthContext = AuthState & AuthActions

const AuthContext = createContext<AuthContext | null>(null)

function loadCachedUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as { username: string; avatar: string }
  } catch { /* ignore */ }
  return null
}

function saveCachedUser(username: string, avatar: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, avatar }))
  } catch { /* ignore */ }
}

function clearCachedUser() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = loadCachedUser()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState(cached?.username || '未登录')
  const [avatar, setAvatar] = useState(cached?.avatar || '')
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  const checkLogin = useCallback(async () => {
    try {
      const status = await getLoginStatus()
      setIsLoggedIn(status.isLoggedIn)
      if (status.isLoggedIn) {
        const info = await getUserInfo()
        setUsername(info.uname)
        setAvatar(info.face)
        saveCachedUser(info.uname, info.face)
      } else {
        clearCachedUser()
        setUsername('未登录')
        setAvatar('')
      }
    } catch {
      setIsLoggedIn(false)
      clearCachedUser()
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch { /* Electron 环境才能登出 */ }
    setIsLoggedIn(false)
    setUsername('未登录')
    setAvatar('')
    clearCachedUser()
  }, [])

  useEffect(() => {
    checkLogin()
  }, [checkLogin])

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        username,
        avatar,
        loading,
        checkLogin,
        logout,
        showLogin,
        setShowLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContext {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
