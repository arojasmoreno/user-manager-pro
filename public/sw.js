/*
 * Service worker de Doc Manager.
 *
 * Estrategia conservadora para no romper la app:
 *  - Navegaciones y assets del armazón: red primero, con caché de respaldo, así
 *    siempre se sirve la última versión publicada y sólo se cae a caché sin
 *    conexión.
 *  - Documentos PDF: se cachean al abrirlos (runtime) y se sirven desde caché
 *    si los ya vistos, para poder consultar el último en planta sin cobertura.
 */

const APP_SHELL = 'doc-manager-shell-v1';
const PDF_CACHE = 'doc-manager-pdf-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_SHELL));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_SHELL && k !== PDF_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Sólo gestionamos peticiones del mismo origen y PDFs explícitos; el resto
  // (Convex, IA, fuentes) va directo a la red sin tocar la caché.
  const isPdf =
    request.destination === 'document' && /\.pdf(\?|#|$)/i.test(url.pathname);

  if (isPdf) {
    event.respondWith(
      caches.open(PDF_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Se revalida en segundo plano para actualizar sin bloquear la vista.
          event.waitUntil(
            fetch(request)
              .then((res) => res.ok && cache.put(request, res.clone()))
              .catch(() => {}),
          );
          return cached;
        }
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Resto de recursos del mismo origen: red primero, caché de respaldo.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(APP_SHELL)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Sin respuesta ni caché: para navegaciones, la app (SPA) se sirve en
        // la raíz para que el enrutador del cliente haga su trabajo.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return new Response('Sin conexión', { status: 503 });
      }),
  );
});
