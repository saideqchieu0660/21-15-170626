import React, { useEffect, useState } from "react";
import { AlertCircle, X, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface ApiError {
  message: string;
  path: string;
  stack?: string;
  id: string; // for unique keys
  timestamp?: string;
}

import { useSystemConfig } from "../hooks/useSystemConfig";

export function GlobalErrorToast() {
  const [errors, setErrors] = useState<ApiError[]>([]);
  const { config } = useSystemConfig();

  useEffect(() => {
    const addError = (newErrorParams: Omit<ApiError, "id" | "timestamp">) => {
      setErrors((prev) => {
        // Prevent spamming the exact same error within a short time frame
        if (prev.some((e) => e.message === newErrorParams.message)) {
          return prev;
        }
        
        // Prevent infinite render loops by capping the maximum toast count
        if (prev.length >= 5) {
          return prev;
        }

        const newError: ApiError = {
          ...newErrorParams,
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString()
        };

        return [...prev, newError];
      });
    };

    const handleGlobalApiError = (event: Event) => {
      const customEvent = event as CustomEvent;
      addError({
        message: customEvent.detail?.message || "Lỗi không xác định",
        path: customEvent.detail?.path || "Custom logic / API",
        stack: customEvent.detail?.stack,
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      // Ignore ResizeObserver/Cross-origin script errors that aren't critical
      if (
        event.message.includes("ResizeObserver") ||
        event.message.includes("Script error.") ||
        event.message.includes("dynamically imported module")
      ) {
        return;
      }

      addError({
        message: event.message || "Lỗi JavaScript toàn cục",
        path: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : "Global window.onerror",
        stack: event.error?.stack || "No stack trace available",
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let isIgnored = false;
      const reasonMsg = event.reason?.message || String(event.reason);
      
      if (
         reasonMsg.includes("dynamically imported module") || 
         reasonMsg.includes("Loading chunk failed") ||
         reasonMsg.includes("WebSocket closed without opened") ||
         reasonMsg.includes("WebSocket is not open")
      ) {
         isIgnored = true;
      }
      
      if (!isIgnored) {
        let errorMsg = "Lỗi Promise không được xử lý";
        if (event.reason) {
          if (typeof event.reason.message === "string" && event.reason.message) {
            errorMsg = event.reason.message;
          } else if (typeof event.reason === "string") {
            errorMsg = event.reason;
          } else {
            errorMsg = String(event.reason);
          }
        }
        addError({
          message: errorMsg,
          path: "Global unhandledrejection",
          stack: event.reason?.stack,
        });
      }
    };

    window.addEventListener("global-api-error", handleGlobalApiError);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("global-api-error", handleGlobalApiError);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const removeError = (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  };

  const handleReportError = async (error: ApiError, method: 'telegram' | 'gmail') => {
    try {
      const logData = `[CRASH REPORT]
Message: ${error.message}
Path/Source: ${error.path}
Stack: ${error.stack || "No stack trace"}
Time: ${error.timestamp}
URL: ${window.location.href}`;

      let copySuccess = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(logData);
          copySuccess = true;
        } catch (e) {
          console.error("Modern copy failed, trying fallback...", e);
        }
      }

      if (!copySuccess) {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = logData;
          textArea.style.top = "0";
          textArea.style.left = "0";
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          copySuccess = document.execCommand("copy");
          document.body.removeChild(textArea);
        } catch (fallbackErr) {
          console.error("Fallback copy failed:", fallbackErr);
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
      
      removeError(error.id);
    } catch (err) {
      console.error("Lỗi khi copy log:", err);
      // Fallback redirect
      window.location.href = "https://t.me/+O50q6ltXTzwxMzk1";
      removeError(error.id);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[9999] flex flex-col gap-3 max-w-[90%] sm:max-w-[350px] md:max-w-sm w-full">
      <AnimatePresence>
        {errors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-red-50 dark:bg-red-950/90 border border-red-500/50 shadow-2xl relative overflow-hidden flex flex-col p-4 rounded-xl"
          >
            <button 
              onClick={() => removeError(error.id)}
              className="absolute top-2 right-2 p-1 text-red-500/70 hover:text-red-700 dark:hover:text-red-300 pointer-events-auto rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 w-full">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 pr-6 w-full">
                <h4 className="font-bold text-red-800 dark:text-red-200 text-sm mb-1 truncate">Lỗi Hệ Thống</h4>
                <p className="text-xs text-red-600 dark:text-red-300 font-medium mb-1.5 break-words line-clamp-3">
                  {error.message}
                </p>
                {error.path && (
                  <p className="text-[10px] font-mono text-red-500 dark:text-red-400/80 truncate bg-red-100/50 dark:bg-red-900/30 px-1.5 py-0.5 rounded inline-block max-w-full">
                    {error.path}
                  </p>
                )}
                
                <div className="mt-3 flex gap-2 w-full">
                  <button
                    onClick={() => handleReportError(error, 'telegram')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Telegram
                  </button>
                  <button
                    onClick={() => handleReportError(error, 'gmail')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-[#EA4335] hover:bg-[#D33828] text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Gmail
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

