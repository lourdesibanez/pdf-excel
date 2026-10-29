// Service worker: guarda la app en el teléfono para que funcione sin internet.
// Estrategia: responde desde la caché y, si hay conexión, la actualiza en segundo plano
// (una versión nueva publicada se ve en la siguiente apertura de la app).
const CACHE = "cpe-a-excel-v1";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/extractor.js",
  "./js/excel.js",
  "./js/store.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
  "./vendor/exceljs.min.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (ev) => {
  const { request } = ev;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  const clave = request.mode === "navigate" ? "./index.html" : request;
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(clave, { ignoreSearch: true });
    const red = fetch(request)
      .then((resp) => {
        if (resp.ok) cache.put(clave, resp.clone());
        return resp;
      });
    if (guardado) {
      ev.waitUntil(red.catch(() => {}));
      return guardado;
    }
    return red;
  })());
});
