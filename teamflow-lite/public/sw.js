const CACHE_VERSION = 'teamflow-pwa-v2';
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const at = path => `${BASE_PATH}${path}`;
const APP_SHELL = ['/', '/styles.css', '/enhancements.css', '/app.js', '/enhancements.js', '/pwa.js', '/pwa.css', '/manifest.webmanifest', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'].map(at);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(at('/api/'))) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: '\u5f53\u524d\u79bb\u7ebf\uff0c\u6570\u636e\u64cd\u4f5c\u9700\u8981\u8fde\u63a5\u7f51\u7edc' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { const copy = response.clone(); caches.open(CACHE_VERSION).then(cache => cache.put(at('/'), copy)); return response; }).catch(async () => (await caches.match(at('/'))) || caches.match(at('/offline.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => { if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone())); return response; }).catch(() => cached);
    return cached || network;
  }));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const data = event.data.payload || {};
    self.registration.showNotification(data.title || 'TeamFlow', { body: data.body || '', icon: at('/icons/icon-192.png'), badge: at('/icons/favicon-32.png'), tag: data.tag || 'teamflow-reminder', renotify: false, data: { url: data.url || at('/#tracking') } });
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'TeamFlow', { body: data.body || '\u4f60\u6709\u65b0\u7684\u5f85\u8ddf\u8fdb\u4e8b\u9879', icon: at('/icons/icon-192.png'), badge: at('/icons/favicon-32.png'), tag: data.tag || 'teamflow-push', data: { url: data.url || at('/#tracking') } }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || at('/#tracking');
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
