import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ForceRefreshButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleError = (e: ErrorEvent | PromiseRejectionEvent) => {
      const msg = e instanceof ErrorEvent ? e.message : e.reason?.message;
      if (msg && (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Loading chunk failed"))) {
         setShow(true);
      }
    };
    window.addEventListener("error", handleError as any);
    window.addEventListener("unhandledrejection", handleError as any);
    return () => {
       window.removeEventListener("error", handleError as any);
       window.removeEventListener("unhandledrejection", handleError as any);
    };
  }, []);

  const handleRefresh = () => {
     sessionStorage.removeItem("chunk_reload_time");
     window.location.reload();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
           initial={{ opacity: 0, y: 50 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: 50 }}
           className="fixed flex bottom-4 right-4 z-[9999]"
        >
           <button 
              onClick={handleRefresh}
              className="group flex items-center gap-2 bg-zinc-900 border border-zinc-700 text-white px-4 py-2.5 rounded-full shadow-2xl hover:bg-zinc-800 transition transform hover:scale-105 active:scale-95"
           >
              <RefreshCw className="w-4 h-4 text-orange-500 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-sm font-medium tracking-wide">Cập nhật phiên bản mới</span>
           </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
