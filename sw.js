    const CACHE_NAME = 'miner-app-v9';
    const ASSETS = [
      './indexApp.html',
      './Admin.html',
      './style.css',
      './sync-manager.js',
      './manifest.json',
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
      'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap'
    ];

    self. addEventListener('install', (e) => {
      e.waitUntil(
        caches.open(CACHE_NAME). then((cache) => {
          return cache.addAll(ASSETS). catch(err => {
            console.log('Some assets failed to cache:', err);
            // Continue even if some assets fail
            return cache.addAll(ASSETS. filter(url => ! url.includes('fonts. googleapis')));
          });
        })
      );
      self.skipWaiting();
    });

    self.addEventListener('fetch', (e) => {
      e.respondWith(
        caches.match(e.request). then((response) => {
          return response || fetch(e.request). then((response) => {
            if (! response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, clonedResponse);
            });
            return response;
          }). catch(() => {
            // Return cached version or offline page
            return caches.match(e.request).then(r => r || new Response('Offline'));
          });
        })
      );
    });

    self.addEventListener('activate', (e) => {
      e.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
              }
            })
          );
        })
      );
      self.clients.claim();
    });