const CACHE='carecard-shell-v1';
const SHELL=['/','/index.html','/style.css','/design.css','/auth.bundle.js','/organizer.js','/app.js','/voice.js','/motion.js','/scanner.js','/ai.js','/pwa.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/vendor/zxing-0.23.0.min.js','/fonts/nunito-latin-800-normal.woff2','/fonts/nunito-latin-900-normal.woff2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('carecard-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.search||!SHELL.includes(url.pathname))return;
 // Cache only known static shell files. Never cache auth or journal responses.
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));
});
