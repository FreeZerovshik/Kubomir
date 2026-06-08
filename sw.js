/* Кубомир — service worker: network-first с офлайн-фолбэком из кэша.
   ignoreSearch, чтобы cache-buster ?t=… не ломал офлайн. */
const CACHE = "cubeworld-v1";
const ASSETS = [
  "./", "./index.html", "./css/style.css",
  "./js/engine.js", "./js/world.js", "./js/items.js", "./js/entities.js", "./js/scenes.js", "./js/main.js",
  "./manifest.webmanifest", "./icons/icon.svg",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match("./index.html")))
  );
});
