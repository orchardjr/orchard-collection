const CACHE='orchard-brand-v1';
const ASSETS=['/','/index.html','/styles.css','/app.js','/config.js','/brand.css','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/logo-mark.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>event.respondWith(fetch(event.request).catch(()=>caches.match(event.request))));

// mobile-nav-hotfix-v3.1.1
