import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

async function purgeLegacyManifestCacheEntries() {
  if (!('caches' in window) || !window.localStorage) return

  const cleanupKey = 'syududu.manifest-cache-cleanup.v2'
  if (localStorage.getItem(cleanupKey) === 'done') return

  try {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName)
        const requests = await cache.keys()
        await Promise.all(
          requests
            .filter((request) => request.url.includes('manifest.webmanifest'))
            .map((request) => cache.delete(request)),
        )
      }),
    )

    localStorage.setItem(cleanupKey, 'done')
  } catch (error) {
    console.warn('Legacy cache cleanup skipped', error)
  }
}

void purgeLegacyManifestCacheEntries()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
