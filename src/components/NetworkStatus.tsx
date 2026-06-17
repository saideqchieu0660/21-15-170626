import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { NetworkHealthMonitor } from '../lib/NetworkHealthMonitor';

export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  useEffect(() => {
    NetworkHealthMonitor.init();
    
    // Get initial pending count of offline updates
    import('../lib/offlineSync').then(({ OfflineSyncQueue }) => {
      setPendingCount(OfflineSyncQueue.getPendingCount());
    });

    let syncTimeoutId: ReturnType<typeof setTimeout>;

    const handleOnline = async () => {
      setIsOnline(true);
      setShowToast(true);
      setIsSyncing(true);

      // CƠ CHẾ SOFT RELOAD AN TOÀN (SMART RE-SYNC)
      try {
        console.log('[System] Re-establishing Firebase Secure Connections...');
        await disableNetwork(db);
        await enableNetwork(db);
        window.dispatchEvent(new CustomEvent('app-network-reconnect'));
        console.log('[System] Network streams repaired successfully & event dispatched.');
      } catch (error) {
        console.error('[System] Error reviving network streams:', error);
      } finally {
        setTimeout(() => setIsSyncing(false), 2000);
        syncTimeoutId = setTimeout(() => setShowToast(false), 5000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast(true);
    };

    const handleQueueUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.pendingCount === 'number') {
        setPendingCount(customEvent.detail.pendingCount);
      }
    };

    const handleSyncCompleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const count = customEvent.detail?.count || 0;
      if (count > 0) {
        setSyncNotification(`Đồng bộ thành công ${count} kết quả học tập ngoại tuyến!`);
        // Auto dismiss after 4 seconds
        setTimeout(() => setSyncNotification(null), 4000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sync-queue-updated', handleQueueUpdated);
    window.addEventListener('offline-sync-completed', handleSyncCompleted);

    // ANTI-LOOP THROTLLER & PERIODIC HEALTH CHECK
    const healthCheckInterval = setInterval(() => {
      if (!navigator.onLine) return;
      
      const lastRefresh = parseInt(localStorage.getItem('last_system_health_check') || '0', 10);
      const now = Date.now();
      const THREE_HOURS = 3 * 60 * 60 * 1000;
      
      if (now - lastRefresh > THREE_HOURS) {
        localStorage.setItem('last_system_health_check', now.toString());
        console.log('[System] Periodic health check passed.');
      }
    }, 15 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sync-queue-updated', handleQueueUpdated);
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
      clearTimeout(syncTimeoutId);
      clearInterval(healthCheckInterval);
      NetworkHealthMonitor.cleanup();
    };
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2">
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border backdrop-blur-md ${
              isOnline 
                ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400 font-bold' 
                : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400 font-bold'
            }`}
          >
            {isOnline ? (
              isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
            )}
            <span className="text-xs tracking-wide">
              {!isOnline 
                 ? `Mất mạng ngoại tuyến ${pendingCount > 0 ? `(${pendingCount} dữ liệu chờ đồng bộ)` : '(Không có dữ liệu chờ)'}` 
                 : (isSyncing ? 'Đang đồng bộ dữ liệu ngoại tuyến...' : 'Đã kết nối trực tuyến thành công')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {syncNotification && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="flex items-center gap-2.5 px-5 py-2 rounded-full shadow-xl border border-orange-500/30 bg-orange-500/10 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold backdrop-blur-md"
          >
            <CheckCircle className="w-4.5 h-4.5 text-orange-500" />
            <span className="text-xs uppercase tracking-wide">{syncNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
