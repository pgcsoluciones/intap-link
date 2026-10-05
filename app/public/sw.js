const CACHE_NAME = 'kawvo-shell-v3'
const SHELL = ['/admin/free/home?source=pwa', '/manifest.webmanifest', '/kawvo-icon.svg']
const AGENDA_PREF_CACHE = 'kawvo-agenda-preferences-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== AGENDA_PREF_CACHE).map((key) => caches.delete(key))))
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


self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'kawvo:agenda-sound') return
  const value = ['agenda', 'soft', 'pulse', 'silent'].includes(String(data.value || '')) ? String(data.value) : 'agenda'
  event.waitUntil(
    caches.open(AGENDA_PREF_CACHE).then((cache) => cache.put('/__kawvo/agenda-sound', new Response(value))).catch(() => undefined),
  )
})

async function agendaSoundPreference() {
  try {
    const cache = await caches.open(AGENDA_PREF_CACHE)
    const response = await cache.match('/__kawvo/agenda-sound')
    return response ? await response.text() : 'agenda'
  } catch {
    return 'agenda'
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {}
    try { payload = event.data ? event.data.json() : {} } catch {
      try { payload = { body: event.data ? event.data.text() : '' } } catch { payload = {} }
    }
    const preference = await agendaSoundPreference()
    const silent = preference === 'silent'
    const unread = Number(payload.unread_count || 1)
    try {
      if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
        await self.navigator.setAppBadge(Math.max(1, unread))
      }
    } catch {}
    if (silent) {
      try {
        if (self.navigator && typeof self.navigator.vibrate === 'function') self.navigator.vibrate([160, 80, 160])
      } catch {}
    }
    await self.registration.showNotification(String(payload.title || 'Nueva solicitud de agenda'), {
      body: String(payload.body || 'Tienes una nueva solicitud.'),
      icon: '/kawvo-icon-192.png',
      badge: '/kawvo-icon-192.png',
      tag: String(payload.tag || 'kawvo-agenda'),
      renotify: true,
      silent,
      data: { url: String(payload.url || '/admin/free/home?source=pwa') },
    })
  })())
})
