// sw.js - Notificaciones y cache offline de NotebookPG

const CACHE_NAME = 'notebookpg-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (error) {
    data = { body: event.data.text() };
  }
  const title = data.title || 'Nueva Notificación';

  // Configuración adaptada a Chromebook
  const options = {
    body: data.body || '',
    icon: data.icon || './icon.svg',
    badge: data.badge || './icon.svg',
    tag: data.tag || 'general-notification',
    renotify: true,
    data: {
      url: data.url || './',
      type: data.type,
      callId: data.callId
    },
    // Mantener notificación activa en pantalla si es llamada entrante
    requireInteraction: data.type === 'call'
  };

  // Añadir botones interactivos si es una llamada
  if (data.type === 'call') {
    options.actions = [
      { action: 'open', title: '📞 Abrir para responder' }
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Manejar clic en la notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const notificationData = event.notification.data || {};
    const targetUrl = typeof notificationData === 'string'
      ? notificationData
      : (notificationData.url || './');

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus().then(() => {
                      if ('navigate' in client && targetUrl) return client.navigate(targetUrl);
                    });
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
