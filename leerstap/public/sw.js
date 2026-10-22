// Leerstap service worker: makes the app installable and opens the shell without a connection.
// Always tries the network first so a new version is used right away; account data (/api/) is never cached.
const CACHE='leerstap-__VERSION__';
const SHELL=['/','/app.js','/style.css','/manifest.webmanifest','/icon.svg','/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
 e.respondWith(fetch(e.request).then(res=>{if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return res;}).catch(()=>caches.match(e.request).then(hit=>hit||(e.request.mode==='navigate'?caches.match('/'):Response.error()))));
});
