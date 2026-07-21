const APP_CACHE = "atsubetsu-bus-app-v10";
const DATA_CACHE = "atsubetsu-bus-data-v10";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/baby.png",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/splash-1170x2532.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_CACHE, DATA_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.endsWith("/data/timetable.json")) {
    event.respondWith(networkFirstTimetable(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstTimetable(request) {
  const cache = await caches.open(DATA_CACHE);
  const canonicalUrl = new URL("./data/timetable.json", self.registration.scope).href;
  const canonicalRequest = new Request(canonicalUrl);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      await cache.put(canonicalRequest, response.clone());
    }
    return response;
  } catch (error) {
    return (
      (await cache.match(canonicalRequest)) ||
      new Response(
        JSON.stringify({
          metadata: {
            name: "時刻表",
            version: "offline-empty",
            updatedAt: "",
            sourceNote: "オフラインで、保存済みの時刻表がありません。"
          },
          routes: []
        }),
        {
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }
      )
    );
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const cache = await caches.open(APP_CACHE);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || refresh;
}
