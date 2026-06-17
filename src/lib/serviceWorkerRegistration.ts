export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check if it's development mode and maybe skip SW things; let's leave it as is for now, but suppress update errors gracefully.
          console.log('[ServiceWorker] Registered with scope:', registration.scope);

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available and will be used when all tabs are closed
                  console.log('[ServiceWorker] New content is available; dispacting update event...');
                  window.dispatchEvent(new CustomEvent('app-update-available', {
                    detail: { registration }
                  }));
                } else {
                  // Content is cached for offline use
                  console.log('[ServiceWorker] Content is cached for offline use.');
                }
              }
            });
          });

          // Periodically check for updates
          let lastCheckTime = Date.now();
          
          setInterval(() => {
            const updateSetting = localStorage.getItem("autoUpdateInterval");
            if (updateSetting === "disabled") return;
            
            const intervalMins = updateSetting ? parseInt(updateSetting, 10) : 10;
            const now = Date.now();
            
            if (now - lastCheckTime >= intervalMins * 60 * 1000) {
                lastCheckTime = now;
                registration.update().catch(err => {
                  console.warn('[ServiceWorker] Update check failed (ignoring)');
                });
            }
          }, 60 * 1000); // Ticking every 1 minute to check configurations
        })
        .catch((error) => {
          if (error.message && error.message.includes("fetching the script")) {
             console.warn('[ServiceWorker] Registration fetch skipped.');
          } else {
             console.warn('[ServiceWorker] Registration failed:', error.message);
          }
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Unregistration failed:', error);
      });
  }
}

