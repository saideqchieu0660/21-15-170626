import { savePendingRequest } from '../lib/offline-db';
import { v4 as uuidv4 } from 'uuid';

// 🛡️ CIRCUIT BREAKER MANDATE: safeFetch 
// Chống sập hệ thống (Cascading Failures) qua mô hình Circuit Breaker cho Vercel Edge

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeout = 10000; // 10 giây
  private nextAttempt: number = Date.now();

  async execute(requestFn: () => Promise<Response>): Promise<Response> {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("[Circuit Breaker: OPEN] Từ chối Request để bảo vệ hệ thống.");
      }
    }

    try {
      const response = await requestFn();
      if (!response.ok && response.status >= 500) {
        this.recordFailure();
      } else {
        this.reset();
      }
      return response;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn("🚨 [Circuit Breaker] Chuyển trạng thái sang OPEN! Chặn request trong 10s.");
    }
  }

  private reset() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }
}

const globalBreaker = new CircuitBreaker();

export async function safeFetch(url: string | Request | URL, options?: RequestInit): Promise<Response> {
  const method = options?.method?.toUpperCase() || 'GET';
  const urlStr = url instanceof Request ? url.url : url.toString();

  // 🌍 MẠCH OFFLINE-FIRST: Ngắt khi client mất mạng, lưu IndexedDB
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      let bodyStr = null;
      if (typeof options?.body === 'string') {
        bodyStr = options.body;
      } else if (options?.body instanceof FormData) {
        // Tạm serialize formdata thành dạng literal json (không hoàn hảo nhưng đủ cho chuỗi basic)
        const obj: Record<string, any> = {};
        options.body.forEach((val, key) => obj[key] = val);
        bodyStr = JSON.stringify(obj);
      }
      
      const pendingReq = {
        id: uuidv4(),
        url: urlStr,
        method,
        headers: (options?.headers as Record<string, string>) || {},
        body: bodyStr,
        timestamp: Date.now()
      };
      
      await savePendingRequest(pendingReq);
      console.warn(`[Offline Mode] Đã lưu request ${method} ${urlStr} vào hàng chờ đồng bộ.`);
      
      try {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
           const swRegistration = await navigator.serviceWorker.ready;
           await (swRegistration as any).sync.register('sync-henosis-data');
        }
      } catch (e) {
         console.warn("Could not register background sync", e);
      }
      
      // Trả file giả lập không phá UI framework
      return new Response(JSON.stringify({ success: true, queued: true, offline: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error("Không có kết nối mạng. Bạn đang dùng chế độ offline đọc liệu.");
    }
  }

  return globalBreaker.execute(() => fetch(url, options));
}
