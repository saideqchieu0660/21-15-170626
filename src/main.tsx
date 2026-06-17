import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { SoundProvider } from './components/SoundProvider';
import { unregisterServiceWorker } from './lib/serviceWorkerRegistration';
import { ErrorBoundary } from './components/ErrorBoundary';
import { toast } from 'sonner';

// Defensive Canvas polyfill to prevent "canvas.getBoundingClientRect is not a function" crashes
try {

  if (typeof window !== "undefined") {
    // 1. Regular Canvas
    if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.getBoundingClientRect) {
      HTMLCanvasElement.prototype.getBoundingClientRect = function() {
        return { width: this.width || 0, height: this.height || 0, top: 0, left: 0, right: this.width || 0, bottom: this.height || 0, x: 0, y: 0, toJSON: () => this };
      };
    }
    
    // 2. OffscreenCanvas (frequently used by tsparticles)
    if (typeof OffscreenCanvas !== "undefined") {
      (OffscreenCanvas.prototype as any).getBoundingClientRect = (OffscreenCanvas.prototype as any).getBoundingClientRect || function(this: any) {
        return { width: this.width || 0, height: this.height || 0, top: 0, left: 0, right: this.width || 0, bottom: this.height || 0, x: 0, y: 0, toJSON: () => this };
      };
    }

    // 3. Fallback for document.createElement('canvas')
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string, options?: ElementCreationOptions): HTMLElement {
      const el = originalCreateElement.call(document, tagName, options);
      if (tagName && tagName.toLowerCase() === 'canvas') {
        if (!el.getBoundingClientRect) {
          el.getBoundingClientRect = function() {
              return { width: (el as any).width || 0, height: (el as any).height || 0, top: 0, left: 0, right: (el as any).width || 0, bottom: (el as any).height || 0, x: 0, y: 0, toJSON: () => this };
          };
        }
      }
      return el;
    } as any;
  }
} catch (e) {
  console.warn("Failed to apply Canvas getBoundingClientRect polyfills:", e);
}

// Removed old unregister to allow PWA Service Worker offline caching
// unregisterServiceWorker();

// Handle dynamic import failures globally (Auto-reload on new production deployments)
const handleChunkError = (message: string) => {
  if (
    message?.includes("Failed to fetch dynamically imported module") ||
    message?.includes("Loading chunk failed") ||
    message?.includes("Importing a module script failed") ||
    message?.includes("dynamically imported module")
  ) {
    if (!navigator.onLine) {
       console.warn("Offline: Cannot load chunk. Not reloading.");
       return;
    }
    const lastReloadTime = sessionStorage.getItem("chunk_reload_time");
    const now = Date.now();
    // Only reload once every 10 seconds to prevent infinite loops when network is genuinely down
    if (!lastReloadTime || now - parseInt(lastReloadTime, 10) > 10000) {
      sessionStorage.setItem("chunk_reload_time", now.toString());
      console.warn("Chunk load error detected, triggering hard reload to fetch new assets...");
      window.location.reload();
    }
  }
};

window.addEventListener("error", (e) => {
  if (e.message) {
    handleChunkError(e.message);
  }
});

window.addEventListener("unhandledrejection", (e) => {
  if (e.reason && e.reason.message) {
    handleChunkError(e.reason.message);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <SoundProvider>
          <App />
        </SoundProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);

// 🌍 OFFLINE-FIRST PWA Registration
if ('serviceWorker' in navigator) {
  const passAssetsToSW = (sw: ServiceWorker) => {
    // Collect all static Vite JS/CSS assets currently loaded in the DOM
    const assets: string[] = ['/', '/index.html', '/manifest.json'];
    
    document.querySelectorAll('script[type="module"][src]').forEach(script => {
      assets.push(script.getAttribute('src')!);
    });
    
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
      assets.push(link.getAttribute('href')!);
    });

    // Extract any modulepreload links
    document.querySelectorAll('link[rel="modulepreload"][href]').forEach(link => {
      assets.push(link.getAttribute('href')!);
    });

    // Remove duplicates and post to SW
    const uniqueAssets = [...new Set(assets)].filter(Boolean);
    sw.postMessage({ type: 'CACHE_ASSETS', assets: uniqueAssets });
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('👷 [PWA] Service Worker registered successfully: ', registration.scope);
      
      // Proactively cache dynamic Vite build assets
      if (registration.active) {
        passAssetsToSW(registration.active);
      } else if (registration.installing) {
        registration.installing.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') {
            passAssetsToSW((e.target as ServiceWorker));
          }
        });
      }
    }).catch((registrationError) => {
      console.error('⚠️ [PWA] Service Worker registration failed: ', registrationError);
    });
  });

  window.addEventListener('online', async () => {
    console.log('📡 [App] Kết nối mạng đả khôi phục! Kích hoạt Background Sync để đẩy các thao tác chờ...');
    if ('SyncManager' in window) {
      try {
        const swRegistration = await navigator.serviceWorker.ready;
        await (swRegistration as any).sync.register('sync-henosis-data');
      } catch (e) {
        console.error("Manual sync registration failed", e);
      }
    }
  });

  window.addEventListener('henosis-force-hydration', async () => {
     console.log('🛡️ [App] Kích hoạt quá trình Hydration từ Cloud để khôi phục metadata gốc...');
     try {
       const { auth } = await import("./lib/firebase");
       const { store } = await import("./lib/store");
       if (auth.currentUser) {
         await store.setFirebaseUser(auth.currentUser);
         window.dispatchEvent(new CustomEvent("henosis-data-synced"));
       }
     } catch(e) {
       console.error("Hydration recovery failed:", e);
     }
  });

  window.addEventListener('offline', () => {
    console.warn('📡 [App] Đã mất kết nối mạng!');
    toast.error('Đang ở chế độ Offline', {
      description: 'Các thay đổi của bạn sẽ được lưu cục bộ và đồng bộ khi có mạng lại.',
      duration: 5000,
    });
  });
}
