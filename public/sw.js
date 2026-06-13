// OctoEnergy Service Worker — Phase 6
// Handles: offline cache, push-like Agile rate polling via setInterval

const CACHE_NAME = 'octoenergy-v6'
const OFFLINE_URL = '/offline.html'

const PRECACHE = [
  '/',
  '/offline.html',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Don't intercept Octopus API calls
  if (url.hostname === 'api.octopus.energy') return

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful GET responses for app assets
        if (event.request.method === 'GET' && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached
          // For navigation requests, serve offline page
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }
          return new Response('Offline', { status: 503 })
        })
      )
  )
})

// ── Agile Rate Alert polling ──────────────────────────────────────────────
// The main app posts a message to the SW with the alert config.
// SW polls every 30 min and fires a notification if rate < threshold.

let alertConfig = null  // { enabled, thresholdPence, apiKey, dnoRegion, productCode }
let lastAlertDate = null  // YYYY-MM-DD — avoid re-alerting same day

self.addEventListener('message', event => {
  if (event.data?.type === 'AGILE_ALERT_CONFIG') {
    alertConfig = event.data.payload
  }
})

async function checkAgileRate() {
  if (!alertConfig?.enabled) return
  const { thresholdPence, apiKey, dnoRegion = 'C', productCode = 'AGILE-24-10-01' } = alertConfig

  try {
    const now = new Date()
    // Only check during daytime hours (06:00–23:00 UK)
    const ukHour = parseInt(now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }), 10)
    if (ukHour < 6 || ukHour >= 23) return

    const from = now.toISOString()
    const to = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    const url = `https://api.octopus.energy/v1/products/${productCode}/electricity-tariffs/E-1R-${productCode}-${dnoRegion}/standard-unit-rates/?period_from=${from}&period_to=${to}`

    const res = await fetch(url, {
      headers: apiKey ? { Authorization: 'Basic ' + btoa(apiKey + ':') } : {}
    })
    if (!res.ok) return
    const data = await res.json()
    const rate = data.results?.[0]?.value_inc_vat
    if (rate === undefined) return

    const todayStr = now.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })
    if (rate < thresholdPence && lastAlertDate !== todayStr) {
      lastAlertDate = todayStr
      self.registration.showNotification('OctoEnergy — Low Agile Rate', {
        body: `Rate now ${rate.toFixed(1)}p/kWh — great time to run appliances!`,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'agile-rate-alert',
        renotify: true,
      })
    }
  } catch {
    // Silently ignore network errors
  }
}

// Check every 30 minutes
setInterval(checkAgileRate, 30 * 60 * 1000)
// Also check shortly after SW activates
setTimeout(checkAgileRate, 10 * 1000)
