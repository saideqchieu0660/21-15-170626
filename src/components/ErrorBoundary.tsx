import React, { Component, ReactNode } from "react";
import { AlertTriangle, Send } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  isRedirecting: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isRedirecting: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isRedirecting: false };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });

    // Check if it is a dynamic import or chunk load failure
    const errorMessage = error?.message || "";
    const isChunkError = 
      errorMessage.includes("Failed to fetch dynamically imported module") ||
      errorMessage.includes("Loading chunk") ||
      errorMessage.includes("ChunkLoadError") ||
      errorMessage.includes("error loading dynamically imported module");

    if (isChunkError) {
      const now = Date.now();
      const lastReloadStr = sessionStorage.getItem("chunk_load_failed_reload_time");
      const lastReload = lastReloadStr ? parseInt(lastReloadStr, 10) : 0;

      // Only auto-reload if the last automatic reload was more than 15 seconds ago to avoid loops
      if (now - lastReload > 15000) {
        sessionStorage.setItem("chunk_load_failed_reload_time", now.toString());
        console.warn("[System] Detected application update. Loading raw assets...");
        window.location.reload();
      }
    }
  }

  private handleReportError = async () => {
    try {
      this.setState({ isRedirecting: true });
      
      const { error, errorInfo } = this.state;
      const logData = `[CRASH REPORT]
Message: ${error?.message || "Unknown error"}
Stack: ${error?.stack || "No stack trace"}
Component Stack: ${errorInfo?.componentStack || "No component stack"}
Time: ${new Date().toISOString()}
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

      // Perform redirection safely
      const telegramLink = "https://t.me/+O50q6ltXTzwxMzk1";
      const newWin = window.open(telegramLink, "_blank");
      if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
        // Fallback redirection if popup blocker active
        window.location.href = telegramLink;
      }
      
      setTimeout(() => {
        this.setState({ isRedirecting: false });
      }, 3000);
    } catch (err) {
      console.error("Lỗi khi copy log:", err);
      this.setState({ isRedirecting: false });
      window.location.href = "https://t.me/+O50q6ltXTzwxMzk1";
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMessage = this.state.error?.message || "";
      const isChunkError = 
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Loading chunk") ||
        errorMessage.includes("ChunkLoadError") ||
        errorMessage.includes("error loading dynamically imported module");

      return (
        <div className={`flex flex-col items-center justify-center p-8 text-center glass relative overflow-hidden rounded-xl border ${isChunkError ? 'bg-orange-100/10 dark:bg-orange-900/10 border-orange-500/30' : 'bg-red-100 dark:bg-red-900/20 border-red-500/30'}`}>
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isChunkError ? 'from-orange-400 to-orange-500' : 'from-red-500 to-orange-500'}`}></div>
            <AlertTriangle className={`w-12 h-12 mb-4 animate-pulse ${isChunkError ? 'text-orange-500' : 'text-red-500'}`} />
            <h2 className={`text-xl font-bold mb-2 ${isChunkError ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
              {isChunkError ? "Hệ thống Đã Được Cập Nhật" : "Đã Xảy Ra Lỗi Hiển Thị"}
            </h2>
            <p className="text-sm opacity-80 mb-6 max-w-md text-zinc-700 dark:text-zinc-300">
              {isChunkError 
                ? "Ứng dụng vừa được nâng cấp lên phiên bản mới để nâng cao bảo mật và hiệu năng. Xin vui lòng bấm nút 'Tải lại trang' bên dưới để nạp các tính năng mới."
                : (this.state.error?.message || "Hệ thống gặp sự cố không mong muốn trong quá trình render.")}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
               <button
                  onClick={() => {
                    if (isChunkError) {
                      window.location.reload();
                    } else {
                      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
                    }
                  }}
                  className="px-5 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-sm font-bold shadow hover:bg-zinc-300 dark:hover:bg-zinc-700 transition active:scale-95 border border-zinc-300 dark:border-zinc-600"
               >
                  {isChunkError ? "Tải lại trang" : "Thử Lại (Retry)"}
               </button>
               
               <button
                  onClick={this.handleReportError}
                  disabled={this.state.isRedirecting}
                  className="group px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
               >
                  <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                  {this.state.isRedirecting ? "Đã copy! Đang mở Telegram..." : "Báo Lỗi qua Telegram"}
               </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
