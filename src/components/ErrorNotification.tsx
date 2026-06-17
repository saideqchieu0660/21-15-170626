import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Lock, Server, Send, Clock } from 'lucide-react';
import { useSystemConfig } from '../hooks/useSystemConfig';

interface ErrorNotificationProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorNotification({ message, onRetry }: ErrorNotificationProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { config } = useSystemConfig();
  let icon = <AlertCircle className="w-5 h-5" />;
  let title = "Đã có lỗi xảy ra";

  if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('time out')) {
    icon = <Clock className="w-5 h-5" />;
    title = "Thời gian chờ kết nối quá lâu";
  } else if (message.includes('401') || message.includes('403')) {
    icon = <Lock className="w-5 h-5" />;
    title = "Lỗi xác thực (Authentication)";
  } else if (message.includes('500') || message.includes('model')) {
    icon = <Server className="w-5 h-5" />;
    title = "Lỗi từ mô hình AI";
  }

  const handleReportError = async (method: 'telegram' | 'gmail') => {
    try {
      setIsRedirecting(true);
      const logData = `[LOCAL ERROR REPORT]
Title: ${title}
Message: ${message}
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
      }, 3000);
    } catch (err) {
      console.error("Lỗi khi báo cáo:", err);
      setIsRedirecting(false);
      window.location.href = "https://t.me/+O50q6ltXTzwxMzk1";
    }
  };

  return (
    <div className="bg-red-500/10 border border-red-500/50 text-red-700 dark:text-red-300 p-4 rounded-xl mt-4 space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm">
        {icon}
        {title}
      </div>
      <p className="text-sm opacity-90 break-words">{message}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button 
          onClick={onRetry}
          className="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition active:scale-95 border border-zinc-300/50 dark:border-zinc-700/50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Thử lại
        </button>

        <button 
          onClick={() => handleReportError('telegram')}
          disabled={isRedirecting}
          className="flex items-center gap-2 bg-[#0088cc] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#0077b3] transition shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          {isRedirecting ? "Đã copy!" : "Telegram"}
        </button>
        <button 
          onClick={() => handleReportError('gmail')}
          disabled={isRedirecting}
          className="flex items-center gap-2 bg-[#EA4335] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#D33828] transition shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          {isRedirecting ? "Đã copy!" : "Gmail"}
        </button>
      </div>
    </div>
  );
}
