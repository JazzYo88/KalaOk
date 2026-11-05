// 最簡單的 Service Worker：只為了讓手機可以「加到主畫面」，不快取任何東西（永遠拿最新版）
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
