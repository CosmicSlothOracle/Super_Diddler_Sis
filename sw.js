// Service Worker for PWA - Cache-first strategy for static assets
const CACHE_NAME = "beatfighter-v1";
const CRITICAL_ASSETS = [
  "/",
  "/index.html",
  "/js/main.js",
  "/js/game-state.js",
  "/js/input-handler.js",
  "/js/physics.js",
  "/js/renderer.js",
  "/js/webgl-renderer.js",
  "/js/game-assets.js",
  "/js/audio-system.js",
  "/js/movement-system.js",
  "/js/attack-system.js",
  "/js/character-catalog.js",
  "/js/attack-catalog.js",
  "/js/input-binding-catalog.js",
  "/js/ui-components.js",
  "/js/particle-system.js",
  "/js/npc-controller.js",
  "/js/ultimeter-manager.js",
  "/js/dance-spot-manager.js",
  "/js/dance-catalog.js",
  "/js/tutorial-system.js",
  "/js/tutorial-modal.js",
  "/js/tutorial-messages.js",
  "/js/metronome.js",
  "/js/audio-device-manager.js",
  "/js/performance-monitor.js",
  "/js/analytics-config.js",
  "/js/analytics-client.js",
  "/js/mobile-controls.js",
  "/assets/ui/mobile-controls.css",
  "/data/characters.json",
  "/data/stages.json",
  "/assets/icon_128x128.png",
  "/assets/icon_256x256.png",
];

// Install: Cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CRITICAL_ASSETS).catch((err) => {
          console.warn("[SW] Failed to cache some assets:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for static assets, network-first for game data
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Cache-first for static assets (js, css, images, audio)
  if (
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/levels/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|ogg|wav|json|css)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML and API calls
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.pathname === "/") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
