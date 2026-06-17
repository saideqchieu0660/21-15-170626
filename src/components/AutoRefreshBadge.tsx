import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

export function AutoRefreshBadge() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initial calculation
    const calculateTimeLeft = () => {
       const updateSetting = localStorage.getItem("autoUpdateInterval") || "10";
       if (updateSetting === "disabled") {
         setIsDisabled(true);
         setTimeLeft(null);
         return null;
       }
       setIsDisabled(false);
       const intervalMins = parseInt(updateSetting, 10);
       
       let targetTime = localStorage.getItem("autoUpdateTargetTime");
       const now = Date.now();
       
       if (!targetTime || parseInt(targetTime, 10) <= now) {
          const nextTarget = now + intervalMins * 60 * 1000;
          localStorage.setItem("autoUpdateTargetTime", nextTarget.toString());
          targetTime = nextTarget.toString();
       }
       
       return Math.max(0, parseInt(targetTime, 10) - now);
    };

    let currentRemaining = calculateTimeLeft();
    if (currentRemaining !== null) {
       setTimeLeft(currentRemaining);
    }

    const interval = setInterval(() => {
       if (isRefreshing) return;
       const updateSetting = localStorage.getItem("autoUpdateInterval") || "10";
       if (updateSetting === "disabled") {
         setIsDisabled(true);
         setTimeLeft(null);
         localStorage.removeItem("autoUpdateTargetTime");
         return;
       }
       
       setIsDisabled(false);
       let targetTime = localStorage.getItem("autoUpdateTargetTime");
       const now = Date.now();
       const intervalMins = parseInt(updateSetting, 10);

       if (!targetTime || parseInt(targetTime, 10) <= now) {
          // Time's up, trigger a refresh event locally and reset target
          const nextTarget = now + intervalMins * 60 * 1000;
          localStorage.setItem("autoUpdateTargetTime", nextTarget.toString());
          targetTime = nextTarget.toString();
          
          handlePerformRefresh();
       }
       
       setTimeLeft(Math.max(0, parseInt(targetTime, 10) - Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRefreshing]);

  const handlePerformRefresh = async () => {
      setIsRefreshing(true);
      // Ensure target time is reset
      const updateSetting = localStorage.getItem("autoUpdateInterval") || "10";
      if (updateSetting !== "disabled") {
         const intervalMins = parseInt(updateSetting, 10);
         const nextTarget = Date.now() + intervalMins * 60 * 1000;
         localStorage.setItem("autoUpdateTargetTime", nextTarget.toString());
         setTimeLeft(intervalMins * 60 * 1000);
      }

      // 1. Force SW update
      if ('serviceWorker' in navigator) {
         try {
            const reg = await navigator.serviceWorker.ready;
            await reg.update();
         } catch (err) {
            console.warn('[AutoRefresh] ServiceWorker update failed');
         }
      }
      
      // 2. Fetch cache busted root to ensure we get newest content layer
      try {
         await fetch('/?v=' + Date.now(), { cache: 'no-store', method: 'HEAD' });
      } catch (e) {
         // ignore network errors on ping
      }
      
      // 3. Force FireStore hooks and UI real-time components to resync
      window.dispatchEvent(new CustomEvent('app-network-reconnect'));
      window.dispatchEvent(new CustomEvent('app-manual-refresh'));
      
      // Visual feedback wait
      setTimeout(() => {
          setIsRefreshing(false);
      }, 800);
  };

  if (isDisabled) return null;

  const m = timeLeft !== null ? Math.floor(timeLeft / 60000) : 0;
  const s = timeLeft !== null ? Math.floor((timeLeft % 60000) / 1000) : 0;

  return (
    <button 
       onClick={handlePerformRefresh}
       disabled={isRefreshing}
       className={cn(
           "flex items-center gap-2 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur border px-3 py-1.5 rounded-full shadow-sm transition-all outline-none cursor-pointer active:scale-95 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80",
           isRefreshing ? "border-orange-500/50" : "border-zinc-200 dark:border-zinc-800"
       )} 
       title="Tự động đồng bộ & cập nhật phiên bản (Bấm để làm mới ngay)"
    >
       <span className="relative flex h-2.5 w-2.5">
          {timeLeft && timeLeft < 10000 || isRefreshing ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </>
          )}
       </span>
       <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 tracking-wider flex items-center gap-1.5 min-w-[12px] sm:min-w-[40px] justify-center">
          <RefreshCw className={cn("w-3 h-3 text-zinc-500 dark:text-zinc-400", (isRefreshing || (timeLeft && timeLeft < 10000)) ? "animate-spin" : "")} />
          <span className="hidden sm:inline">{isRefreshing ? "--:--" : (timeLeft === null ? "--:--" : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)}</span>
       </span>
    </button>
  );
}
