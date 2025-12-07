const CACHE_NAME = 'miner-app-v12';
    const ASSETS = [
      './index.html',
      './admin.html',
      './style.css',
      './manifest.json',
      './BTC.png',
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
      // 1. API Requests: Network Only (Don't cache)
      if (e.request.url.includes('/api/')) {
        e.respondWith(
          fetch(e.request).catch(() => {
             return new Response(JSON.stringify({ error: 'Network Error' }), { 
                 headers: { 'Content-Type': 'application/json' }
             });
          })
        );
        return;
      }

      // 2. Static Assets: Stale-While-Revalidate (Serve cache, then update)
      e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
          const fetchPromise = fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
               const clonedResponse = networkResponse.clone();
               caches.open(CACHE_NAME).then((cache) => {
                 cache.put(e.request, clonedResponse);
               });
            }
            return networkResponse;
          }).catch(() => {
             // Network failed, nothing to do (we have cache or will fail)
          });

          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
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

    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'MAINTENANCE_MODE_CHANGED') {
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'RELOAD_PAGE' });
                });
            });
        }
    });