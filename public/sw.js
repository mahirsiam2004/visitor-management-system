/**
 * SecureEntry Service Worker
 * Strategy:
 *  - App shell (CSS, JS bundles) → Cache First
 *  - /api/cron/* → Network Only (never cache)
 *  - Today's active passes (/api/offline/passes) → fetched at SW activate + every 5 min
 *  - Check-in/out POST requests while offline → queued in IndexedDB, replayed on reconnect
 */

const CACHE_NAME      = 'secureentry-v1'
const OFFLINE_PASSES  = 'secureentry-passes-v1'
const OFFLINE_QUEUE   = 'secureentry-queue-v1'

const SHELL_URLS = [
  '/',
  '/dashboard/security',
  '/dashboard/security/quick-entry',
  '/offline',
]

// ── Install: pre-cache app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        console.warn('[SW] Shell cache failed (some may be dynamic):', err.message)
      })
    ).then(() => self.skipWaiting())
  )
})

// ── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== OFFLINE_PASSES)
          .map((n) => caches.delete(n))
      )
    ).then(() => {
      self.clients.claim()
      fetchAndCachePasses()  // prime the offline pass cache
    })
  )
})

// ── Fetch handler ────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache cron or auth routes
  if (url.pathname.startsWith('/api/cron') || url.pathname.startsWith('/auth')) return

  // Offline pass-lookup: serve from cache
  if (url.pathname === '/api/offline/passes') {
    event.respondWith(
      caches.open(OFFLINE_PASSES).then((cache) =>
        cache.match(event.request).then((cached) => cached ?? fetch(event.request))
      )
    )
    return
  }

  // Check-in / check-out POST: queue when offline
  if (event.request.method === 'POST' && url.pathname.includes('/checkin')) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        await queueOfflineRequest(event.request.clone())
        return new Response(
          JSON.stringify({ queued: true, message: 'Offline — entry queued for sync' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    return
  }

  // Navigation: serve shell or offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/offline') ?? caches.match('/')
      )
    )
    return
  }

  // Static assets: cache first
  if (url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then(
          (cached) => cached ?? fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
        )
      )
    )
    return
  }
})

// ── Background sync ──────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-entries') {
    event.waitUntil(replayOfflineQueue())
  }
})

// ── Periodic background sync ─────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-passes') {
    event.waitUntil(fetchAndCachePasses())
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────

async function fetchAndCachePasses() {
  try {
    const res = await fetch('/api/offline/passes')
    if (!res.ok) return
    const cache = await caches.open(OFFLINE_PASSES)
    await cache.put('/api/offline/passes', res)
    console.log('[SW] Active passes cached for offline use')
  } catch {
    // silently fail when offline
  }
}

async function queueOfflineRequest(req) {
  const db = await openDB()
  const body = await req.text()
  const tx = db.transaction(OFFLINE_QUEUE, 'readwrite')
  tx.objectStore(OFFLINE_QUEUE).add({
    url:     req.url,
    method:  req.method,
    headers: Object.fromEntries(req.headers.entries()),
    body,
    ts:      Date.now(),
  })
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

async function replayOfflineQueue() {
  const db = await openDB()
  const tx = db.transaction(OFFLINE_QUEUE, 'readwrite')
  const store = tx.objectStore(OFFLINE_QUEUE)
  const all = await new Promise((res, rej) => {
    const req = store.getAll()
    req.onsuccess = () => res(req.result)
    req.onerror = rej
  })

  let synced = 0
  for (const entry of all) {
    try {
      const res = await fetch(entry.url, {
        method:  entry.method,
        headers: entry.headers,
        body:    entry.body,
      })
      if (res.ok) {
        store.delete(entry.id)
        synced++
      }
    } catch {
      // keep in queue for next sync
    }
  }

  if (synced > 0) {
    self.clients.matchAll().then((clients) =>
      clients.forEach((c) => c.postMessage({ type: 'SYNC_DONE', count: synced }))
    )
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('secureentry-offline', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE)) {
        const store = db.createObjectStore(OFFLINE_QUEUE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('ts', 'ts')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
