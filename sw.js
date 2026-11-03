/* TRIPA — Service Worker : coquille applicative hors-ligne.
 * - Fichiers statiques : cache-d'abord (l'app s'ouvre hors-ligne).
 * - API /api/* : réseau-toujours ; en cas d'échec, renvoie une erreur 'hors-ligne'
 *   pour que l'interface affiche un bandeau dédié (pas de données périmées silencieuses). */
const CACHE = 'tripa-v5';
const SHELL = [
  './index.html', './register.html', './dashboard.html', './entity.html',
  './admin-management.html', './settings.html', './profile.html', './help.html', './activity.html',
  './css/app.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-maskable.svg',
  './js/api.js', './js/utils.js', './js/prefs.js', './js/auth.js', './js/entity.js', './js/lucide.js', './js/chart.js',
  './js/admin-management.js', './js/settings.js', './js/profile.js', './js/help.js', './js/activity.js', './js/pwa.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.includes('/api/')) {
    e.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ data: null, error: { message: 'Hors-ligne.', status: 0 } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  if (url.origin !== location.origin) return; // requête externe : laissée au navigateur (aucune désormais, tout est local)

  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
