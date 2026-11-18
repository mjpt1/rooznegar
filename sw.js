const CACHE = 'rooznegar-v28';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'features.js', 'v2.js', 'v3.js', 'v4.js', 'v5.js', 'v6.js', 'v7.js', 'v8.js', 'v9.js', 'v10.js', 'v11.js', 'v12.js', 'v13.js', 'i18n.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network-first so updates show immediately — but a slow connection never keeps the app blank:
  // after 3 s the saved copy is used (the network answer still refreshes the cache for next time)
  const net = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; });
  const cached = () => caches.match(e.request, { ignoreSearch: true });
  e.respondWith(new Promise(res => {
    let done = false; const give = r => { if (!done && r) { done = true; res(r); } };
    const t = setTimeout(() => cached().then(give), 3000);
    net.then(r => { clearTimeout(t); give(r); }).catch(() => { clearTimeout(t); cached().then(r => r ? give(r) : give(Response.error())); });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tag = e.notification.data?.tag || '', act = e.action; // '', 'done', 'snooze'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) {
      list[0].postMessage(act ? { type: act, tag } : { type: 'open' });
      return act ? null : list[0].focus();
    }
    return self.clients.openWindow(act ? `./?act=${act}&tag=${encodeURIComponent(tag)}` : './');
  }));
});
// Web Push: the server sends an empty push; we fetch what is due and show it.
// (iOS requires that every push shows a notification, so we always show at least one.)
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch('push/pending.php', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }), cache: 'no-store' });
        items = (await r.json()).items || [];
      }
    } catch (err) { }
    if (!items.length) {
      // nothing new (already shown): iOS still wants a notification for every push, so show one and remove it at once
      await self.registration.showNotification('روزنگار', { tag: 'rooz-empty', silent: true });
      for (const n of await self.registration.getNotifications({ tag: 'rooz-empty' })) n.close();
      return;
    }
    for (const it of items) {
      await self.registration.showNotification(it.title, {
        body: it.body, tag: it.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { tag: it.tag },
        vibrate: [200, 100, 200], requireInteraction: true,
        actions: it.tag && it.tag.includes('|') ? [{ action: 'done', title: '✓ انجام شد' }, { action: 'snooze', title: '⏰ بعداً' }] : []
      });
    }
  })());
});
