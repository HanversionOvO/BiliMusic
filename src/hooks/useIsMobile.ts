import { useEffect, useState } from 'react'

function isMobileUA() {
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && !window.electronAPI
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    isMobileUA() ? window.innerWidth < 900 : window.innerWidth < 720,
  )
  useEffect(() => {
    const sync = () => setIsMobile(isMobileUA() ? window.innerWidth < 900 : window.innerWidth < 720)
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  return isMobile
}

export function isMobilePlatform() {
  return isMobileUA()
}
