const BUILD="4.2.3";
self.addEventListener("install",event=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.map(name=>caches.delete(name)));
    await self.registration.unregister();
    const clientsList=await self.clients.matchAll({type:"window"});
    clientsList.forEach(client=>client.navigate(client.url));
  })());
});
self.addEventListener("fetch",()=>{});
