const HARMONY_PLATFORM = 'openharmony'

function getPersistentApi() {
  const api = window.electronAPI
  if (api?.platform !== HARMONY_PLATFORM) return null
  return api.persistentStorage
}

export function readStoredItem(key: string): string | null {
  const persistent = getPersistentApi()
  if (persistent) {
    const value = persistent.getItem(key)
    if (value !== null) {
      try {
        localStorage.setItem(key, value)
      } catch {
        // LocalStorage may be unavailable or transient on HarmonyOS.
      }
      return value
    }
  }

  try {
    const value = localStorage.getItem(key)
    if (value !== null) {
      persistent?.setItem(key, value)
    }
    return value
  } catch {
    return null
  }
}

export function writeStoredItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Keep the persistent copy as the source of truth when localStorage fails.
  }
  getPersistentApi()?.setItem(key, value)
}

export function removeStoredItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
  getPersistentApi()?.removeItem(key)
}
