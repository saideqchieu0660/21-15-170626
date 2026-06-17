const CACHE_NAME = 'henosis-root-v4';
const DYNAMIC_CACHE = 'henosis-dynamic-v4';

// 2. ASSET CACHING & VITE HASHES: 
// Baseline assets to cache immediately upon install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Force the new service worker to become the active service worker immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching baseline App Shell...');
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => 
          fetch(asset).then(res => {
            if (res.ok) cache.put(asset, res);
          })
        )
      );
    }).catch(err => console.error("[SW] Cache baseline install error:", err))
  );
});

self.addEventListener('activate', (event) => {
  // 3. CACHE CLEANUP SAFETY:
  event.waitUntil(
    // Take control of all clients immediately without requiring a browser refresh
    self.clients.claim().then(() => {
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that doesn't match our current cache names
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old offline cache version:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      });
    })
  );
});

// Listener for dynamic frontend registration script to pass the correct build manifest assets
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_ASSETS') {
    const assets = event.data.assets;
    if (Array.isArray(assets)) {
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Proactively caching active DOM assets from Vite build...');
        
        // We use fetch manually per asset instead of cache.addAll
        // because if one optional asset fails, cache.addAll will fail the entire batch.
        assets.forEach(asset => {
          cache.match(asset).then(cached => {
            if (!cached) {
               fetch(asset).then(response => {
                 if (response.ok) {
                   cache.put(asset, response);
                 }
               }).catch(e => console.warn(`[SW] Optional proactive asset cache failed for ${asset}:`, e));
            }
          });
        });
      });
    }
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API requests, external Google identity services, and Firebase endpoints
  // We NEVER want to offline-cache raw API requests or mutations
  if (
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identity') ||
    url.protocol === 'chrome-extension:' ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 1. THE NAVIGATE FALLBACK TRAP & 4. STATE ROUNTING REHYDRATION
  // Intercept every SPA direct navigation request (URL typing, F5, subroutes)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network fetch first to ensure they get the freshest deploy when online
          const networkResponse = await fetch(event.request);
          
          if (!networkResponse || (!networkResponse.ok && networkResponse.type !== 'opaque')) {
            throw new Error(`Server returned non-OK status: ${networkResponse?.status}`);
          }
          
          // Optional: Update the cached index.html so it stays fresh
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.warn('[SW] Offline mode detected. SPA fallback triggered for:', url.pathname);
          // Network failed (Offline). Immediately return the cached App Shell (index.html)
          // The frontend react-router will then parse window.location and mount the correct React view!
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match('/index.html');
          
          if (cachedResponse) {
             return cachedResponse;
          }
          // The absolute ultimate fallback incase index.html mapping was lost
          const ultimateFallback = await cache.match('/');
          if (ultimateFallback) {
             return ultimateFallback;
          }
          return new Response('Offline App Shell missing', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain' }});
        }
      })()
    );
    return; // Escape here. A navigation request MUST end here.
  }

  // Handle all other Assets (CSS, JS modules, Images, Fonts) with Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(DYNAMIC_CACHE);
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Only cache successful basic or cors requests to avoid busting quota on opaques
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch((error) => {
          if (!cachedResponse) {
            console.warn(`[SW] Resource completely unavailable offline: ${url.pathname}`);
          }
        });

      // Provide the cached response immediately if it exists, meanwhile revalidate exactly what we need
      const finalResponse = cachedResponse || await fetchPromise;
      if (!finalResponse) {
        return new Response('Offline and resource not found in cache.', { status: 503, statusText: 'Service Unavailable' });
      }
      return finalResponse;
    })()
  );
});

// Background Sync capability to reconnect and upload data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-henosis-data') {
    event.waitUntil(syncOfflineData());
  }
});

function initOfflineDB_SW() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HenosisOfflineDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_sync')) {
        db.createObjectStore('pending_sync', { keyPath: 'id' });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getPendingRequests_SW() {
  const db = await initOfflineDB_SW();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sync'], 'readonly');
    const store = transaction.objectStore('pending_sync');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearPendingRequests_SW(ids) {
  const db = await initOfflineDB_SW();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sync'], 'readwrite');
    const store = transaction.objectStore('pending_sync');
    ids.forEach(id => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function syncOfflineData() {
  try {
    const requests = await getPendingRequests_SW();
    if (!requests || requests.length === 0) return;

    console.log(`[SW Background Sync] Khởi động đồng bộ ${requests.length} requests...`);
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });

    if (response.ok) {
      const data = await response.json();
      if(data.success && data.processedIds) {
          await clearPendingRequests_SW(data.processedIds);
          console.log(`[SW Background Sync] Đã đồng bộ ${data.processedIds.length} requests lên máy chủ!`);
      } else {
          const ids = requests.map(r => r.id);
          await clearPendingRequests_SW(ids);
      }
    } else {
      throw new Error(`Máy chủ từ chối lúc đồng bộ, trạng thái: ${response.status}`);
    }
  } catch (error) {
    console.error('[SW Background Sync] Thất bại, sẽ tự thử lại lần sau:', error);
    throw error;
  }
}

