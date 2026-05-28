import { Routes, Route } from 'react-router-dom'
import { PlayerProvider } from '@/contexts/PlayerContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
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
  return (
    <AuthProvider>
      <PlayerProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Discover />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        <GlobalLoginDialog />
      </PlayerProvider>
    </AuthProvider>
  )
}
