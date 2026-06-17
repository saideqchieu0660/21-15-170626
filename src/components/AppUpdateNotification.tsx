import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AppUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.registration) {
        setRegistration(customEvent.detail.registration);
        setShowUpdate(true);
      }
    };

    window.addEventListener('app-update-available', handleUpdate);
    return () => window.removeEventListener('app-update-available', handleUpdate);
  }, []);

  const handleRefresh = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
    setShowUpdate(false);
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 rounded-2xl shadow-2xl border border-white/10"
        >
          <div className="flex flex-col">
            <span className="font-bold text-sm">Có phiên bản mới! 🚀</span>
            <span className="text-xs opacity-80">Cập nhật để trải nghiệm tính năng mới.</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 bg-orange-500 text-zinc-900 px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-orange-400 transition transform active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Khởi động lại
            </button>
            <button
              onClick={() => setShowUpdate(false)}
              className="p-1.5 rounded-full hover:bg-white/20 dark:hover:bg-black/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
