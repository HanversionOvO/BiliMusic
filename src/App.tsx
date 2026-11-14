import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAutoSync } from '@/hooks/useAutoSync'
import { isMobilePlatform } from '@/hooks/useIsMobile'
import { PlayerProvider } from '@/contexts/PlayerContext'
import { NowPlayingProvider } from '@/contexts/NowPlayingContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AddToPlaylistProvider } from '@/contexts/AddToPlaylistContext'
import LoginDialog from '@/components/LoginDialog'
import MainLayout from '@/components/layout/MainLayout'
import Discover from '@/pages/Discover'
import SearchPage from '@/pages/Search'
import Recommend from '@/pages/Recommend'
import Recent from '@/pages/Recent'
import Favorites from '@/pages/Favorites'
import Playlists from '@/pages/Playlists'
import Downloads from '@/pages/Downloads'
import Settings from '@/pages/Settings'

function GlobalLoginDialog() {
  const { showLogin, setShowLogin, checkLogin } = useAuth()
  if (!showLogin) return null
  return (
    <LoginDialog
      onClose={() => setShowLogin(false)}
      onSuccess={() => {
        setShowLogin(false)
        checkLogin()
      }}
    />
  )
}

export default function App() {
  // 渲染层成功挂载后回报主进程：确认当前（可能是 OTA 热补丁的）渲染包可用，避免下次启动误回滚
  useEffect(() => {
    window.electronAPI?.notifyRendererReady?.()
  }, [])

  // 云同步自动触发（启动 + 改动防抖 + 周期）
  useAutoSync()

  const mobile = isMobilePlatform()

  return (
    <AuthProvider>
      <PlayerProvider>
        <NowPlayingProvider>
          <AddToPlaylistProvider>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={mobile ? <Navigate to="/recommend" replace /> : <Discover />} />
                <Route path="/discover" element={mobile ? <Navigate to="/recommend" replace /> : <Discover />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/recommend" element={<Recommend />} />
                <Route path="/recent" element={<Recent />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlists/:playlistId" element={<Playlists />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
            <GlobalLoginDialog />
          </AddToPlaylistProvider>
        </NowPlayingProvider>
      </PlayerProvider>
    </AuthProvider>
  )
}
