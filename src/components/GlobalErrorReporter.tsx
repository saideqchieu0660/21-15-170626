import React, { useState, useEffect } from 'react';
import { Bug, X, Send } from 'lucide-react';
import { cn } from '../lib/utils';

import { useSystemConfig } from "../hooks/useSystemConfig";

export function GlobalErrorReporter() {
  const [errorLog, setErrorLog] = useState<{message: string; stack?: string; time: string; url: string} | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { config } = useSystemConfig();

  useEffect(() => {
    const handleGlobalApiError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      setErrorLog({
        message: detail.message || "Lỗi API không xác định",
        stack: detail.stack || "API path: " + detail.path,
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      // Ignore chunk load errors here because ErrorBoundary handles them nicely
      if (event.message.includes("chunk") || event.message.includes("dynamically imported module")) return;
      setErrorLog({
        message: event.message || "Lỗi giao diện không xác định",
        stack: event.error?.stack || "No stack",
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonMsg = typeof reason === 'string' ? reason : (reason?.message || "");
      if (
        reasonMsg.includes("dynamically imported module") || 
        reasonMsg.includes("Loading chunk failed") ||
        reasonMsg.includes("WebSocket closed without opened") ||
        reasonMsg.includes("WebSocket is not open")
      ) return;

      setErrorLog({
        message: typeof reason === 'string' ? reason : (reason?.message || "Lỗi xử lý (Promise Rejection)"),
        stack: reason?.stack || "No stack",
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    window.addEventListener('global-api-error', handleGlobalApiError);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('global-api-error', handleGlobalApiError);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);

  const handleReport = async (method: 'telegram' | 'gmail') => {
    if (!errorLog) return;
    setIsRedirecting(true);

    const logData = `[BUG REPORT]
Message: ${errorLog.message}
Stack: ${errorLog.stack}
Time: ${errorLog.time}
URL: ${errorLog.url}
User Agent: ${navigator.userAgent}`;

    let copySuccess = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(logData);
        copySuccess = true;
      } catch (e) {
        console.error("Clipboard API failed:", e);
      }
    }

    if (!copySuccess) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = logData;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copySuccess = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (e) {
        console.error("Fallback copy failed:", e);
      }
    }

    if (method === 'telegram') {
      const telegramLink = "https://t.me/+O50q6ltXTzwxMzk1";
      const newWin = window.open(telegramLink, "_blank");
      if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
        window.location.href = telegramLink;
      }
    } else {
      const targetEmail = config?.supportEmail || 'lgbtbd12@gmail.com';
      const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${targetEmail}&su=Bug+Report&body=${encodeURIComponent(logData)}`;
      const newWin = window.open(gmailLink, "_blank");
      if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
        window.location.href = gmailLink;
      }
    }

    setTimeout(() => {
      setIsRedirecting(false);
      setErrorLog(null);
    }, 3000);
  };

  if (!errorLog) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border-l-4 border-l-red-500 border border-t-zinc-200 border-r-zinc-200 border-b-zinc-200 dark:border-t-zinc-700 dark:border-r-zinc-700 dark:border-b-zinc-700 p-4 animate-in slide-in-from-bottom-8">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full shrink-0">
          <Bug className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">Đã phát hiện lỗi hệ thống</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words">
            {errorLog.message}
          </p>
        </div>
        <button 
          onClick={() => setErrorLog(null)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex gap-2 mt-3 w-full">
        <button
          onClick={() => handleReport('telegram')}
          disabled={isRedirecting}
          className={cn(
            "flex-1 py-2.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-white",
            isRedirecting ? "bg-green-500" : "bg-[#0088cc] hover:bg-[#0077b3] active:scale-95 shadow-sm"
          )}
        >
          <Send className={cn("w-3.5 h-3.5", isRedirecting && "animate-pulse")} />
          Telegram
        </button>
        <button
          onClick={() => handleReport('gmail')}
          disabled={isRedirecting}
          className={cn(
            "flex-1 py-2.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-white",
            isRedirecting ? "bg-green-500" : "bg-[#EA4335] hover:bg-[#D33828] active:scale-95 shadow-sm"
          )}
        >
          <Send className={cn("w-3.5 h-3.5", isRedirecting && "animate-pulse")} />
          Gmail
        </button>
      </div>
    </div>
  );
}
