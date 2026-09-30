const CACHE_NAME = 'kawvo-shell-v2'
const SHELL = ['/admin/free/home?source=pwa', '/manifest.webmanifest', '/kawvo-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Authentication/API responses are always network-only and are never cached.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/admin/free/home?source=pwa').then((cached) => cached || Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
      }
      return response
    })),
  )
})


self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = String(event.notification?.data?.url || '/admin/free/home?source=pwa')
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          try {
            const url = new URL(client.url)
            if (url.origin === self.location.origin) {
              client.navigate(target).catch(() => undefined)
              return client.focus()
            }
          } catch {}
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined
    }),
  )
})
