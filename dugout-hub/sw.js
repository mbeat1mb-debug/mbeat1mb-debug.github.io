// Dugout Hub offline helper: the app opens instantly and works with no signal.
// The page itself is always fetched fresh when there's internet (so updates show right away), with the saved copy as backup.
// Game files carry a version in their name, so a saved copy is never out of date.
const CACHE = 'dugout-894dc21c2e';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './player.glb',
  './fonts/barlow-latin-400-normal.woff2', './fonts/barlow-latin-500-normal.woff2', './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2', './fonts/barlow-condensed-latin-800-normal.woff2', './fonts/yellowtail-latin-400-normal.woff2',
  './derby3d.js?v=e44a05ad23'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('dugout-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;          // the hub's data (Supabase) always goes straight to the internet
  const page = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html');
  if (page) {   // fresh page when online, saved page when not (or when the signal is too slow)
    e.respondWith((async () => { const c = await caches.open(CACHE);
      try { const net = await Promise.race([fetch(r, { cache: 'no-store' }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
        if (net && net.ok) { c.put('./index.html', net.clone()); return net; } throw new Error('bad'); }
      catch (err) { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); } })());
    return;
  }
  // everything else: saved copy first, then the internet (and save it for next time)
  e.respondWith((async () => { const c = await caches.open(CACHE), hit = await c.match(r);
    if (hit) return hit;
    try { const net = await fetch(r); if (net && net.ok && !u.pathname.includes('/pose/')) c.put(r, net.clone()); return net; } catch (err) { return Response.error(); } })());
});
