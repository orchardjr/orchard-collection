const CACHE='orchard-production-v4-0-4-photo-card-fix';
const ASSETS=['/','/index.html','/styles.css','/app.js','/config.js','/brand.css','/manifest.webmanifest','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/logo-mark.svg','/src/services/production.js'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('/index.html'))));
});
