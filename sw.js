// Service Worker de APARCH — permite que la app funcione sin internet
// una vez que se abrió al menos una vez con conexión.
const CACHE_NAME = 'aparch-cache-v1';
const ARCHIVOS_A_CACHEAR = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Al instalar: guardar una copia de todo lo necesario para que la app cargue sin internet.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARCHIVOS_A_CACHEAR).catch((err) => {
        console.warn('APARCH SW: no se pudo cachear todo (revisa conexión):', err);
      });
    })
  );
  self.skipWaiting();
});

// Al activar: limpiar versiones de caché antiguas.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: intentar la red primero (para tener siempre la versión más nueva si hay
// internet); si falla (sin conexión), usar la copia guardada — así funciona offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        // Actualizar la copia guardada con la versión fresca de la red
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() => {
        // Sin internet: usar lo que ya tengamos guardado
        return caches.match(event.request).then((respuestaCache) => {
          if (respuestaCache) return respuestaCache;
          // Si piden la página principal y no hay nada guardado, mostrar el index cacheado
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
