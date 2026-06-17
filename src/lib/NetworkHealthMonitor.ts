export type NetworkHealthLog = {
  timestamp: number;
  type: 'state_change' | 'latency';
  value: string | number;
};

const LOG_KEY = 'network_health_logs';
const MAX_LOGS = 100;

export class NetworkHealthMonitor {
  private static intervalId: ReturnType<typeof setInterval> | null = null;
  private static handlers: { online: () => void; offline: () => void } | null = null;

  public static addLog(log: NetworkHealthLog) {
    try {
      const existingLogsRaw = localStorage.getItem(LOG_KEY);
      let logs: NetworkHealthLog[] = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
      logs.push(log);
      
      if (logs.length > MAX_LOGS) {
        logs = logs.slice(logs.length - MAX_LOGS);
      }
      
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (error) {
      console.warn('[NetworkHealthMonitor] Failed to write to localStorage', error);
    }
  }

  public static init() {
    if (typeof window === 'undefined') return;

    // Prevent multiple initializations
    if (this.handlers) return;

    this.handlers = {
      online: () => {
        this.addLog({ timestamp: Date.now(), type: 'state_change', value: 'online' });
        console.log('[System] Network state changed: online');
      },
      offline: () => {
        this.addLog({ timestamp: Date.now(), type: 'state_change', value: 'offline' });
        console.log('[System] Network state changed: offline');
      }
    };

    window.addEventListener('online', this.handlers.online);
    window.addEventListener('offline', this.handlers.offline);

    // Initial state
    this.addLog({ timestamp: Date.now(), type: 'state_change', value: navigator.onLine ? 'online' : 'offline' });

    // Periodic latency checks (every 60 seconds)
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(async () => {
      if (!navigator.onLine) return;

      const start = Date.now();
      try {
        // Ping current origin, appending timestamp to bypass cache
        const response = await fetch(window.location.origin + '/?ping=' + start, { 
          method: 'HEAD', 
          cache: 'no-store' 
        });
        
        if (response.ok) {
          const latency = Date.now() - start;
          this.addLog({ timestamp: Date.now(), type: 'latency', value: latency });
        }
      } catch (error) {
        console.warn('[NetworkHealthMonitor] Periodic ping failed (high latency or network error)', error);
      }
    }, 60000);
  }

  public static cleanup() {
    if (this.handlers) {
      window.removeEventListener('online', this.handlers.online);
      window.removeEventListener('offline', this.handlers.offline);
      this.handlers = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public static getLogs(): NetworkHealthLog[] {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
