'use strict';

const cachePrefix = 'todayis-mobile-';
const cacheName = cachePrefix + 'v1';
const assets = [
  'mobile.html', 'mobile.css', 'mobile.js', 'mobile.webmanifest',
  'newtab.css', 'newtab.js', 'bookmarks.js', 'weather.js',
  'icons/glass.svg', 'icons/mobile-192.png', 'icons/mobile-512.png',
  'wallpapers/horizon.svg', 'wallpapers/aurora.svg'
];
const urls = new Set(assets.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...urls])));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.mode === 'navigate') url.search = '';
  if (request.method !== 'GET' || !urls.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(url.href)) || fetch(request);
  })());
});
