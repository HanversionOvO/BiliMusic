import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import PlayerBar from './PlayerBar'
import TabBar from './TabBar'
import NowPlaying from '@/components/NowPlaying'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function MainLayout() {
  const isMobile = useIsMobile()
  const location = useLocation()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
      }}
    >
      {!isMobile && <TitleBar />}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!isMobile && <Sidebar />}

        <main
          key={isMobile ? location.pathname : undefined}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--color-background)',
            padding: isMobile ? '8px 16px 8px' : 'var(--space-lg) var(--space-xl)',
          }}
        >
          <Outlet />
        </main>
      </div>

      {isMobile ? (
        <>
          <PlayerBar />
          <TabBar />
        </>
      ) : (
        <PlayerBar />
      )}
      <NowPlaying />
    </div>
  )
}
