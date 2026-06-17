import { toast } from "sonner";
import React, { useState, useEffect, useRef , useMemo } from "react";
import { Key, AlertCircle, CheckCircle, Clock, RefreshCw, Loader2, ListOrdered, Server, Globe, Cpu, Activity, Zap, X } from "lucide-react";
import * as d3 from 'd3';
import { store } from "../lib/store";
import { apiManager } from "../lib/ApiQueueManager";
import { NetworkHealthMonitor, NetworkHealthLog } from "../lib/NetworkHealthMonitor";
import { apiProviderConfig, updateApiProviderConfig, keyRegistry } from "../utils/apiClient";
import { AIPromptsEditorWidget } from "../components/AIPromptsEditorWidget";
import { useSystemConfig } from "../hooks/useSystemConfig";

class MonitorErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: any) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-500">Service Monitor unavailable.</div>;
    return this.props.children;
  }
}

interface KeyState {
  index: number;
  maskedKey: string;
  status: "active" | "rate_limited" | "failed" | "exhausted";
  usageCount: number;
  errorCount: number;
  lastUsed: string | null;
}

function D3Sparkline({ data, color }: { data: number[], color: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const width = 80;
    const height = 24;
    const margin = { top: 2, right: 4, bottom: 2, left: 2 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const x = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([margin.left, width - margin.right]);

    const yMax = Math.max(d3.max(data) || 0, 1) + 1; // At least 2 to give some headroom
    const y = d3.scaleLinear()
      .domain([0, yMax])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("stroke-linecap", "round")
      .attr("d", line);
      
    // Add dot at the end
    svg.append("circle")
       .attr("cx", x(data.length - 1))
       .attr("cy", y(data[data.length - 1]))
       .attr("r", 2.5)
       .attr("fill", color);
  }, [data, color]);

  return (
    <div className="flex flex-col items-end">
       <svg ref={svgRef} width={80} height={24} className="overflow-visible" />
    </div>
  );
}

interface RotationLog {
  id: string;
  timestamp: string;
  fromKeyIndex?: number;
  toKeyIndex: number;
  reason: string;
}

let adminTelemetryIntervalHealth: NodeJS.Timeout | null = null;
let adminTelemetryIntervalKeys: NodeJS.Timeout | null = null;

export function ServiceMonitor({ adminKey, isOpen = true }: { adminKey: string, isOpen?: boolean }) {
  const [keys, setKeys] = useState<KeyState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalKeys, setTotalKeys] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");
  const [isPolling, setIsPolling] = useState(true);
  const [logs, setLogs] = useState<RotationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'health'>('monitor');
  const [logFilter, setLogFilter] = useState<'all' | '429'>('all');

  // API Emergency Circuit Breaker Switch states
  const [openRouterEnabled, setOpenRouterEnabled] = useState(() => localStorage.getItem("openRouterEnabled") !== "false");
  const [groqEnabled, setGroqEnabled] = useState(() => localStorage.getItem("groqEnabled") !== "false");
  const [geminiEnabled, setGeminiEnabled] = useState(() => localStorage.getItem("geminiEnabled") !== "false");
  const [deepInfraEnabled, setDeepInfraEnabled] = useState(() => localStorage.getItem("deepInfraEnabled") !== "false");
  const [isUpdatingToggles, setIsUpdatingToggles] = useState(false);
  const [deepInfraKeys, setDeepInfraKeys] = useState<KeyState[]>([]);
  
  // Dynamic Groq keys and logs (real-time loaded from the server)
  const [groqKeys, setGroqKeys] = useState<KeyState[]>([]);
  const [totalGroqKeys, setTotalGroqKeys] = useState(0);
  const [currentGroqIndex, setCurrentGroqIndex] = useState(1);
  const [groqLogs, setGroqLogs] = useState<RotationLog[]>([]);

  // OpenRouter States Integration
  const [openRouterKeys, setOpenRouterKeys] = useState<KeyState[]>([]);
  const [totalOpenRouterKeys, setTotalOpenRouterKeys] = useState(0);
  const [currentOpenRouterIndex, setCurrentOpenRouterIndex] = useState(0);
  const [openRouterLogs, setOpenRouterLogs] = useState<RotationLog[]>([]);
  const prevOpenRouterKeysRef = useRef<KeyState[]>([]);
  const prevGroqKeysRef = useRef<KeyState[]>([]);
  
  const [usageHistory, setUsageHistory] = useState<Record<number, number[]>>({});
  const [queueStatus, setQueueStatus] = useState(apiManager.getStatus());
  const prevKeysRef = useRef<KeyState[]>([]);

  const { config, updateConfig } = useSystemConfig();
  const [editingEmail, setEditingEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    if (config?.supportEmail) {
      setEditingEmail(config.supportEmail);
    }
  }, [config?.supportEmail]);

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    try {
      await updateConfig({ supportEmail: editingEmail });
      setIsEditingEmail(false);
      toast("Đã cập nhật email hỗ trợ thành công!");
    } catch (e: any) {
      toast("Cập nhật thất bại: " + e.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const [serverHealth, setServerHealth] = useState<any>(null);
  const [networkLogs, setNetworkLogs] = useState<NetworkHealthLog[]>([]);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);

  const fetchServerHealth = async () => {
    if (!isOpen) return; // Strict gating: Telemetry dormant unless modal open
    try {
      const res = await fetch("/api/system/health");
      const data = await res.json();
      setServerHealth(data);
    } catch (err) {
      console.error("[HealthCheck] Failed to fetch server health", err);
    }
  };

  const loadDeepInfraKeys = () => {
    const keysRaw: string[] = [];
    const safeProcessEnv = (typeof process !== "undefined" && process?.env) ? process.env : {};
    
    for (let i = 1; i <= 8; i++) {
      try {
        const k1 = import.meta.env[`VITE_DEEPINFRA_API_KEY_${i}`];
        if (k1 && typeof k1 === 'string' && k1.trim()) keysRaw.push(k1.trim());
      } catch (e) {}
      try {
        const k2 = import.meta.env[`VITE_DEEPINFRA_KEY_${i}`];
        if (k2 && typeof k2 === 'string' && k2.trim()) keysRaw.push(k2.trim());
      } catch (e) {}

      const kp1 = safeProcessEnv[`VITE_DEEPINFRA_API_KEY_${i}`];
      if (kp1 && typeof kp1 === 'string' && kp1.trim()) keysRaw.push(kp1.trim());

      const kp2 = safeProcessEnv[`VITE_DEEPINFRA_KEY_${i}`];
      if (kp2 && typeof kp2 === 'string' && kp2.trim()) keysRaw.push(kp2.trim());

      const kp3 = safeProcessEnv[`DEEPINFRA_API_KEY_${i}`];
      if (kp3 && typeof kp3 === 'string' && kp3.trim()) keysRaw.push(kp3.trim());
    }

    try {
      if (import.meta.env.VITE_DEEPINFRA_API_KEY && typeof import.meta.env.VITE_DEEPINFRA_API_KEY === 'string' && import.meta.env.VITE_DEEPINFRA_API_KEY.trim()) {
        keysRaw.push(import.meta.env.VITE_DEEPINFRA_API_KEY.trim());
      }
      if (import.meta.env.VITE_DEEPINFRA_KEY && typeof import.meta.env.VITE_DEEPINFRA_KEY === 'string' && import.meta.env.VITE_DEEPINFRA_KEY.trim()) {
        keysRaw.push(import.meta.env.VITE_DEEPINFRA_KEY.trim());
      }
    } catch (e) {}

    const uniqueKeys = Array.from(new Set(keysRaw)).map(k => k.trim()).filter(k => k && k !== "undefined" && k !== "null");
    
    const mapped = uniqueKeys.map((key, idx) => {
      const state = keyRegistry.get(key);
      let status: "active" | "rate_limited" | "exhausted" | "failed" = "active";
      if (state) {
        if (state.status === "DEPLETED") status = "exhausted";
        else if (state.status === "COOLING") status = "rate_limited";
      }

      const masked = key.length > 15 
        ? `${key.substring(0, 8)}...${key.substring(key.length - 6)}` 
        : "Secret Value";

      return {
        index: idx + 1,
        maskedKey: masked,
        status,
        usageCount: 0,
        errorCount: 0,
        lastUsed: null
      } as KeyState;
    });

    setDeepInfraKeys(mapped);
  };

  const fetchToggles = async () => {
    try {
      const res = await fetch(`/api/admin/api-toggles?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setOpenRouterEnabled(data.openRouterEnabled !== false);
        setGroqEnabled(data.groqEnabled !== false);
        setGeminiEnabled(data.geminiEnabled !== false);
        setDeepInfraEnabled(data.deepInfraEnabled !== false);
        
        localStorage.setItem("openRouterEnabled", String(data.openRouterEnabled !== false));
        localStorage.setItem("groqEnabled", String(data.groqEnabled !== false));
        localStorage.setItem("geminiEnabled", String(data.geminiEnabled !== false));
        localStorage.setItem("deepInfraEnabled", String(data.deepInfraEnabled !== false));
        
        updateApiProviderConfig({
          openRouter: data.openRouterEnabled !== false,
          gemini: data.geminiEnabled !== false,
          groq: data.groqEnabled !== false,
          deepInfra: data.deepInfraEnabled !== false
        });
      }
      loadDeepInfraKeys();
    } catch (err) {
      console.error("Lỗi khi tải trạng thái API toggles:", err);
    }
  };

  const handleToggleChange = async (type: "openrouter" | "gemini" | "groq" | "deepinfra", newValue: boolean) => {
    const isSysAdmin = store.getCurrentUser()?.role === "admin" || store.getCurrentUser()?.role === "Admin";
    if (!isSysAdmin) {
      toast("Ngài không phải Admin hệ thống, không có quyền bật tắt bộ ngắt mạch API toàn server đâu nhé!");
      return;
    }

    setIsUpdatingToggles(true);
    if (type === "openrouter") setOpenRouterEnabled(newValue);
    if (type === "gemini") setGeminiEnabled(newValue);
    if (type === "groq") setGroqEnabled(newValue);
    if (type === "deepinfra") setDeepInfraEnabled(newValue);

    try {
      const { dbService } = await import("../lib/firebase");
      
      const payload = {
        openRouterEnabled: type === "openrouter" ? newValue : openRouterEnabled,
        geminiEnabled: type === "gemini" ? newValue : geminiEnabled,
        groqEnabled: type === "groq" ? newValue : groqEnabled,
        deepInfraEnabled: type === "deepinfra" ? newValue : deepInfraEnabled
      };

      let fbSuccess = false;
      try {
        await dbService.updateApiToggles(payload);
        fbSuccess = true;
      } catch (fbErr) {
        console.warn("Direct Firebase save failed, falling back to backend only: ", fbErr);
      }

      const { auth } = await import("../lib/firebase");
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";

      const res = await fetch("/api/admin/api-toggles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? `Bearer ${idToken}` : "",
          "x-admin-key": adminKey
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok && !fbSuccess) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Không thể lưu trạng thái mới trên cả Frontend và Backend.");
      }
      const data = await res.json();
      setOpenRouterEnabled(data.openRouterEnabled !== false);
      setGroqEnabled(data.groqEnabled !== false);
      setGeminiEnabled(data.geminiEnabled !== false);
      setDeepInfraEnabled(data.deepInfraEnabled !== false);
      
      localStorage.setItem("openRouterEnabled", String(data.openRouterEnabled !== false));
      localStorage.setItem("groqEnabled", String(data.groqEnabled !== false));
      localStorage.setItem("geminiEnabled", String(data.geminiEnabled !== false));
      localStorage.setItem("deepInfraEnabled", String(data.deepInfraEnabled !== false));
      
      updateApiProviderConfig({
        openRouter: data.openRouterEnabled !== false,
        gemini: data.geminiEnabled !== false,
        groq: data.groqEnabled !== false,
        deepInfra: data.deepInfraEnabled !== false
      });
    } catch (err: any) {
      toast("Lỗi cập nhật Switch: " + err.message);
      if (type === "openrouter") setOpenRouterEnabled(!newValue);
      if (type === "gemini") setGeminiEnabled(!newValue);
      if (type === "groq") setGroqEnabled(!newValue);
      if (type === "deepinfra") setDeepInfraEnabled(!newValue);
    } finally {
      setIsUpdatingToggles(false);
    }
  };

  const testApiHealth = async () => {
    setIsTestingHealth(true);
    setTestResponse(null);
    try {
      const start = Date.now();
      const res = await fetch("/api/health");
      const duration = Date.now() - start;
      const data = await res.json();
      setTestResponse({
        httpStatus: res.status,
        latencyMs: duration,
        payload: data
      });
    } catch (err: any) {
      setTestResponse({
        error: err.message || "Failed to contact /api/health"
      });
    } finally {
      setIsTestingHealth(false);
    }
  };

  const [isResettingKeys, setIsResettingKeys] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const resetKeysStatus = async () => {
    setIsResettingKeys(true);
    setResetSuccess(false);
    try {
      const { auth } = await import("../lib/firebase");
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";

      const res = await fetch("/api/admin/reset-keys-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? `Bearer ${idToken}` : "",
          "x-admin-key": adminKey
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      
      setResetSuccess(true);
      fetchKeysStatus();
      setTimeout(() => setResetSuccess(false), 2500);
    } catch (err: any) {
      console.error("Reset keys error:", err);
      toast("Lỗi khi reset trạng thái key: " + err.message);
    } finally {
      setIsResettingKeys(false);
    }
  };

  const clientLatencyAvg = useMemo(() => {
    const latencies = networkLogs.filter(log => log.type === 'latency').map(log => Number(log.value));
    if (latencies.length === 0) return 0;
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }, [networkLogs]);

  useEffect(() => {
    if (!isOpen) return;
    fetchServerHealth();
    NetworkHealthMonitor.init();
    setNetworkLogs(NetworkHealthMonitor.getLogs());

    if (adminTelemetryIntervalHealth) clearInterval(adminTelemetryIntervalHealth);
    adminTelemetryIntervalHealth = setInterval(() => {
      if (!isOpen) return;
      fetchServerHealth();
      setNetworkLogs(NetworkHealthMonitor.getLogs());
    }, 10000);

    return () => {
      if (adminTelemetryIntervalHealth) {
        clearInterval(adminTelemetryIntervalHealth);
        adminTelemetryIntervalHealth = null;
      }
      NetworkHealthMonitor.cleanup();
    };
  }, [isOpen]);

  const fetchKeysStatus = async () => {
    if (!isOpen) return; // Strict gating: Telemetry dormant unless modal open
    try {
      const { auth } = await import("../lib/firebase");
      
      let idToken = "";
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      } else {
        await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user);
            });
            setTimeout(() => { unsubscribe(); resolve(null); }, 2000);
        });
        if (auth.currentUser) {
            idToken = await auth.currentUser.getIdToken();
        }
      }

      // Allow fetch without adminKey if we have an idToken
      if (!adminKey && !idToken) {
          setError("Chưa nhập admin key hợp lệ hoặc không thể xác thực tài khoản để xem trạng thái API");
          return;
      }
      
      const res = await fetch("/api/admin/keys-status", {
        headers: {
          "Authorization": idToken ? `Bearer ${idToken}` : "",
          "x-admin-key": adminKey
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch keys status");
      }
      
      setUsageHistory(prevHistory => {
        const newHistory = { ...prevHistory };
        
        // Process Gemini standard keys
        data.keys.forEach((k: KeyState) => {
          const prevKey = prevKeysRef.current.find(pk => pk.index === k.index);
          const currentUsage = k.usageCount;
          let delta = 0;
          if (prevKey) {
            delta = Math.max(0, currentUsage - prevKey.usageCount);
          }
          
          if (!newHistory[k.index]) {
             newHistory[k.index] = Array(20).fill(0);
          }
          newHistory[k.index] = [...newHistory[k.index].slice(1), delta];
        });

        // Process OpenRouter keys (stored at index key ID + 100 to prevent collisions)
        if (data.openrouter && data.openrouter.keys) {
          data.openrouter.keys.forEach((k: KeyState) => {
            const indexKey = k.index + 100;
            const prevKey = prevOpenRouterKeysRef.current.find(pk => pk.index === k.index);
            const currentUsage = k.usageCount;
            let delta = 0;
            if (prevKey) {
              delta = Math.max(0, currentUsage - prevKey.usageCount);
            }
            
            if (!newHistory[indexKey]) {
               newHistory[indexKey] = Array(20).fill(0);
            }
            newHistory[indexKey] = [...newHistory[indexKey].slice(1), delta];
          });
        }

        // Process Groq keys (stored at index key ID + 200 to prevent collisions)
        if (data.groq && data.groq.keys) {
          data.groq.keys.forEach((k: KeyState) => {
            const indexKey = k.index + 200;
            const prevKey = prevGroqKeysRef.current.find(pk => pk.index === k.index);
            const currentUsage = k.usageCount;
            let delta = 0;
            if (prevKey) {
              delta = Math.max(0, currentUsage - prevKey.usageCount);
            }
            
            if (!newHistory[indexKey]) {
               newHistory[indexKey] = Array(20).fill(0);
            }
            newHistory[indexKey] = [...newHistory[indexKey].slice(1), delta];
          });
        }
        
        return newHistory;
      });

      prevKeysRef.current = data.keys;

      setKeys(data.keys);
      setTotalKeys(data.totalKeys);
      setCurrentIndex(data.currentIndex);
      setLogs(data.logs || []);

      if (data.openrouter) {
        setOpenRouterKeys(data.openrouter.keys || []);
        prevOpenRouterKeysRef.current = data.openrouter.keys || [];
        setTotalOpenRouterKeys(data.openrouter.totalKeys || 0);
        setCurrentOpenRouterIndex(data.openrouter.currentIndex || 0);
        setOpenRouterLogs(data.openrouter.logs || []);
      }

      if (data.groq) {
        setGroqKeys(data.groq.keys || []);
        prevGroqKeysRef.current = data.groq.keys || [];
        setTotalGroqKeys(data.groq.totalKeys || 0);
        setCurrentGroqIndex(data.groq.currentIndex || 1);
        setGroqLogs(data.groq.logs || []);
      }
      
      loadDeepInfraKeys();
      setError("");
      await fetchToggles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (adminTelemetryIntervalKeys) {
        clearInterval(adminTelemetryIntervalKeys);
        adminTelemetryIntervalKeys = null;
      }
      return;
    }
    
    // Initial fetch always
    fetchKeysStatus();

    // Prevent polling if tab is hidden to save Vercel CPU time
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPolling && isOpen) {
          fetchKeysStatus();
          if (adminTelemetryIntervalKeys) clearInterval(adminTelemetryIntervalKeys);
          adminTelemetryIntervalKeys = setInterval(fetchKeysStatus, 10000); // Slower polling: 10s
      } else {
        if (adminTelemetryIntervalKeys) {
          clearInterval(adminTelemetryIntervalKeys);
          adminTelemetryIntervalKeys = null;
        }
      }
    };

    if (isPolling && document.visibilityState === 'visible') {
      if (adminTelemetryIntervalKeys) clearInterval(adminTelemetryIntervalKeys);
      adminTelemetryIntervalKeys = setInterval(fetchKeysStatus, 10000); // Slower polling: 10s
    }
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      if (adminTelemetryIntervalKeys) {
        clearInterval(adminTelemetryIntervalKeys);
        adminTelemetryIntervalKeys = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [adminKey, isPolling, isOpen]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const batchedUpdate = (time: number) => {
      // Batch all visual telemetry updates to max once every 2-3 seconds to prevent microsecond floods
      if (time - lastTime >= 2500) {
        setQueueStatus(apiManager.getStatus());
        lastTime = time;
      }
      animationFrameId = requestAnimationFrame(batchedUpdate);
    };

    animationFrameId = requestAnimationFrame(batchedUpdate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const allKeys = [...keys, ...openRouterKeys, ...groqKeys, ...deepInfraKeys];
  const activeCount = allKeys.filter(k => k.status === 'active').length;
  const limitedCount = allKeys.filter(k => k.status === 'rate_limited').length;
  const failedCount = allKeys.filter(k => k.status === 'failed').length;
  const statusScore = allKeys.length === 0 ? 100 : ((activeCount * 1 + limitedCount * 0.5 + failedCount * 0) / allKeys.length) * 100;
  const healthScore = Math.round(statusScore);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-bold opacity-60 uppercase mb-2">API Connection Score</div>
          <div className="text-5xl font-display font-bold mb-2">
            <span className={healthScore >= 80 ? 'text-green-500' : healthScore >= 50 ? 'text-orange-500' : 'text-red-500'}>
               {healthScore}%
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 mt-4 overflow-hidden flex">
            {allKeys.length > 0 && (
              <>
                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(activeCount / allKeys.length) * 100}%` }}></div>
                <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(limitedCount / allKeys.length) * 100}%` }}></div>
                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(failedCount / allKeys.length) * 100}%` }}></div>
              </>
            )}
          </div>
          <div className="flex gap-4 justify-center mt-3 text-xs w-full text-zinc-500 dark:text-zinc-400">
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {activeCount} Active</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> {limitedCount} Lim</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> {failedCount} Fail</div>
          </div>
        </div>

        {serverHealth && (
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center">
               <h3 className="text-sm font-bold opacity-60 uppercase mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Server RAM
               </h3>
               <div className="flex items-end gap-2 mb-1">
                 <span className="text-3xl font-display font-bold text-blue-500">
                   {(serverHealth.systemMemory.used / 1024 / 1024 / 1024).toFixed(1)} GB
                 </span>
                 <span className="text-zinc-500 text-sm mb-1">/ {(serverHealth.systemMemory.total / 1024 / 1024 / 1024).toFixed(1)} GB</span>
               </div>
               <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 mt-2 overflow-hidden">
                 <div className="h-full bg-blue-500" style={{ width: `${(serverHealth.systemMemory.used / serverHealth.systemMemory.total) * 100}%` }}></div>
               </div>
               <p className="text-xs text-zinc-500 mt-2">Node Process: {(serverHealth.processMemory.rss / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center">
               <h3 className="text-sm font-bold opacity-60 uppercase mb-2 flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> CPU Load
               </h3>
               <div className="text-xl font-display font-bold text-purple-500 mb-1 line-clamp-2">
                 {serverHealth.cpus[0]?.model || "Unknown CPU"}
               </div>
               <div className="text-sm text-zinc-500">
                 Cores: <span className="font-bold text-zinc-700 dark:text-zinc-300">{serverHealth.cpus.length}</span>
               </div>
               <p className="text-xs text-zinc-500 mt-2">System Uptime: {Math.floor(serverHealth.uptime / 3600)}h {Math.floor((serverHealth.uptime % 3600) / 60)}m</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center bg-zinc-50 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
        {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 font-medium w-full">
               System Error: {error}
            </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <RefreshCw className={`w-5 h-5 text-blue-500 ${isPolling ? 'animate-spin' : ''}`} />
                Real-time Health Monitor
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                Monitoring {totalKeys + totalOpenRouterKeys + totalGroqKeys + deepInfraKeys.length} API keys across {
                   [totalKeys > 0 ? "Gemini" : "", totalOpenRouterKeys > 0 ? "OpenRouter" : "", totalGroqKeys > 0 ? "Groq" : "", deepInfraKeys.length > 0 ? "DeepInfra" : ""].filter(Boolean).join(", ") || "all providers"
                }.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setIsPolling(!isPolling)}
                className={`btn-3d px-4 py-2 rounded-lg text-sm font-bold ${isPolling ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                {isPolling ? 'Stop Polling' : 'Start Polling'}
              </button>
              <button 
                onClick={() => {
                  fetchKeysStatus();
                  fetchServerHealth();
                }}
                className="btn-3d px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 text-sm font-bold animate-shimmer"
              >
                Refresh
              </button>
              <button 
                onClick={resetKeysStatus}
                disabled={isResettingKeys}
                className={`btn-3d px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                  resetSuccess 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-orange-500 hover:bg-orange-600 text-zinc-950'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isResettingKeys ? 'animate-spin' : ''}`} />
                {resetSuccess ? 'Kích Hoạt Thành Công!' : isResettingKeys ? 'Đang kích hoạt...' : 'Reset Key Failures'}
              </button>
            </div>
          </div>

          <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-lg mt-6 w-max self-end sm:self-auto">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'monitor' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
            >
              Monitor Grid
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
            >
              Rotation Logs
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
            >
              System Health
            </button>
          </div>
          
          <div className="mt-4 p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-4 text-sm font-mono">
             <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-blue-500" />
                Queue: <span className="font-bold text-blue-600 dark:text-blue-400">{queueStatus.queueLength}</span>
             </div>
             <div className="flex items-center gap-2">
                Processing: <span className={`font-bold ${queueStatus.isProcessing ? 'text-green-500' : 'text-zinc-500'}`}>{queueStatus.isProcessing ? 'YES' : 'NO'}</span>
             </div>
          </div>
        </div>
      
      {renderMonitorContent()}
    </div>
  );

  function renderMonitorContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
           <Loader2 className="w-8 h-8 animate-spin mb-4" />
           <p>Connecting to Service Monitor...</p>
        </div>
      );
    }
    
    const isKeysEmpty = keys.length === 0 && openRouterKeys.length === 0 && groqKeys.length === 0 && deepInfraKeys.length === 0;

    if (activeTab === 'monitor') {
      return (
        <div className="space-y-10">
                  {/* EMERGENCY CIRCUIT BREAKER SYSTEM */}
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-6 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-red-500 font-display flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  Emergency API Circuit Breaker (Bộ ngắt mạch khẩn cấp)
                </h3>
                <p className="text-xs text-zinc-500 mt-1 pb-1">
                  Chủ động ngắt cổng gọi ra ngoài của các nhà cung cấp nếu bị block IP/quét hạn ngạch quá căng, tránh dính exceed request thêm.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Google Gemini API Switch */}
              <div 
                className={`p-4 rounded-lg flex items-center justify-between border transition-all duration-300 ${
                  geminiEnabled 
                    ? "bg-blue-50/45 dark:bg-blue-950/15 border-blue-200/50 dark:border-blue-800/20" 
                    : "bg-zinc-100/70 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800 grayscale"
                }`}
              >
                <div className="space-y-1 pr-4">
                  <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-500" /> Google Gemini Pool
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {geminiEnabled 
                      ? "🟢 Đang hoạt động (Dịch thuật, bài tập, cốt lõi)" 
                      : "🔴 Đã ngắt mạch (Các cuộc gọi bị chặn từ đầu)"}
                  </div>
                </div>

                {/* Styled Toggle Switch */}
                <button
                  type="button"
                  disabled={isUpdatingToggles}
                  onClick={() => handleToggleChange("gemini", !geminiEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    geminiEnabled ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-700"
                  } ${isUpdatingToggles ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      geminiEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Groq Cloud API Switch */}
              <div 
                className={`p-4 rounded-lg flex items-center justify-between border transition-all duration-300 ${
                  groqEnabled 
                    ? "bg-orange-50/45 dark:bg-orange-950/15 border-orange-200/50 dark:border-orange-800/20" 
                    : "bg-zinc-100/70 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800 grayscale"
                }`}
              >
                <div className="space-y-1 pr-4">
                  <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" /> Groq Cloud API Pool
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {groqEnabled 
                      ? "🟢 Đang hoạt động (Llama3-70B Cực tốc, phản hồi tức thời)" 
                      : "🔴 Đã ngắt mạch (Tạm ngắt, định hướng sang Gemini)"}
                  </div>
                </div>

                {/* Styled Toggle Switch */}
                <button
                  type="button"
                  disabled={isUpdatingToggles}
                  onClick={() => handleToggleChange("groq", !groqEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    groqEnabled ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-700"
                  } ${isUpdatingToggles ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      groqEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* OpenRouter API Switch */}
              <div 
                className={`p-4 rounded-lg flex items-center justify-between border transition-all duration-300 ${
                  openRouterEnabled 
                    ? "bg-emerald-50/45 dark:bg-emerald-950/15 border-emerald-200/50 dark:border-emerald-800/20" 
                    : "bg-zinc-100/70 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800 grayscale"
                }`}
              >
                <div className="space-y-1 pr-4">
                  <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-500" /> OpenRouter Llama Pool
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {openRouterEnabled 
                      ? "🟢 Đang hoạt động (Trích xuất văn bản sơ cấp, ổn định)" 
                      : "🔴 Đã ngắt mạch (Chặn tránh dính spam vòng ngoài)"}
                  </div>
                </div>

                {/* Styled Toggle Switch */}
                <button
                  type="button"
                  disabled={isUpdatingToggles}
                  onClick={() => handleToggleChange("openrouter", !openRouterEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    openRouterEnabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  } ${isUpdatingToggles ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      openRouterEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* DeepInfra API Switch */}
              <div 
                className={`p-4 rounded-lg flex items-center justify-between border transition-all duration-300 ${
                  deepInfraEnabled 
                    ? "bg-indigo-50/45 dark:bg-indigo-950/15 border-indigo-200/50 dark:border-indigo-800/20" 
                    : "bg-zinc-100/70 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800 grayscale"
                }`}
              >
                <div className="space-y-1 pr-4">
                  <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-500" /> DeepInfra Pool
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {deepInfraEnabled 
                      ? "🟢 Đang hoạt động (Xoay vòng siêu tải, Llama Chuyên sâu)" 
                      : "🔴 Đã ngắt mạch (Chặn tránh dính spam vòng ngoài)"}
                  </div>
                </div>

                {/* Styled Toggle Switch */}
                <button
                  type="button"
                  disabled={isUpdatingToggles}
                  onClick={() => handleToggleChange("deepinfra", !deepInfraEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    deepInfraEnabled ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"
                  } ${isUpdatingToggles ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      deepInfraEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* SYSTEM SETTINGS CONFIGURATION */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-blue-500 font-display flex items-center gap-2">
                   System Settings
                </h3>
                <p className="text-xs text-zinc-500 mt-1 pb-1">
                  Cấu hình các chỉ số hệ thống, email nhận báo cáo lỗi,...
                </p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Support Email (Nhận báo cáo lỗi)</label>
              <div className="flex gap-2 w-full max-w-md">
                <input
                  type="email"
                  value={isEditingEmail ? editingEmail : config?.supportEmail || ""}
                  disabled={!isEditingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
                {isEditingEmail ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEmail}
                      disabled={isSavingEmail}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all"
                    >
                      {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingEmail(false);
                        setEditingEmail(config?.supportEmail || "");
                      }}
                      className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                    >
                      Huỷ
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingEmail(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  >
                    Sửa
                  </button>
                )}
              </div>
            </div>
          </div>

          {isKeysEmpty && (
             <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
                <Key className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-serif italic text-3xl font-medium text-zinc-900 dark:text-zinc-100">Khoá hệ thống đã cạn kiệt</h3>
              <p className="text-zinc-500 max-w-md mx-auto tracking-wide font-light">Tất cả các hàng đợi API đều đang trống. Vui lòng cấu hình các khoá bí mật <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-red-500 font-mono text-xs">VITE_FIREBASE_API_KEY</code>, OpenRouter, Groq, hoặc DeepInfra để tái kích hoạt hệ thống truy vấn.</p>
              <button onClick={fetchKeysStatus} className="mt-4 px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 font-medium tracking-wide">
                 <RefreshCw className="w-4 h-4" /> Bắt buộc tải lại cấu hình
              </button>
            </div>
          )}

          {/* Gemini API Keys Section */}
          {!isKeysEmpty && (
            <>
              <div className="space-y-4">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <h3 className="text-xl font-bold font-display text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Cpu className="w-5 h-5 animate-pulse" />
                Gemini Enterprise Rotation Pool
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono">
                  {totalKeys} keys · Current index: {currentIndex}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Phân phối xử lý lõi chính, định tuyến dịch sang tiếng Việt, sinh đề thi & chấm điểm tự động.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {keys.map((k) => (
                <div 
                  key={k.index} 
                  className={`card-3d p-5 rounded-xl border flex flex-col gap-4 ${
                    k.index === currentIndex ? 'ring-2 ring-blue-500 border-blue-500' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                      Key #{k.index}
                    </span>
                    <div className="flex items-center gap-3">
                       <D3Sparkline 
                          data={usageHistory[k.index] || Array(20).fill(0)} 
                          color={k.status === 'rate_limited' ? '#f59e0b' : k.status === 'failed' ? '#ef4444' : k.status === 'exhausted' ? '#71717a' : '#3b82f6'} 
                       />
                       {k.status === "active" && <span className="flex items-center gap-1 text-xs font-bold text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> ACTIVE</span>}
                       {k.status === "rate_limited" && <span className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> RATE LIMITED</span>}
                       {k.status === "exhausted" && <span className="flex items-center gap-1 text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 px-2 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> EXHAUSTED</span>}
                       {k.status === "failed" && <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> FAILED</span>}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Masked Key</div>
                    <div className="font-mono text-sm">{k.maskedKey}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-3">
                    <div>
                      <div className="text-zinc-500 text-xs">Usage Count</div>
                      <div className="font-medium text-lg">{k.usageCount}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs">Error Count</div>
                      <div className="font-medium text-red-500 text-lg">{k.errorCount}</div>
                    </div>
                  </div>
                  
                  <div className="mt-1">
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-zinc-500 dark:text-zinc-400">Est. Daily Quota</span>
                       <span className="font-medium">
                         {k.status === "rate_limited" || k.status === "exhausted" 
                            ? "100%" 
                            : `${Math.min(Math.round((k.usageCount / 1500) * 100), 100)}%`}
                       </span>
                     </div>
                     <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-500 ${
                           k.status === 'active' ? 'bg-blue-600 dark:bg-blue-500' : 
                           k.status === 'rate_limited' ? 'bg-orange-500 w-full' : 
                           'bg-red-500 w-full'
                         }`}
                         style={{ 
                           width: (k.status === "rate_limited" || k.status === "exhausted") 
                                   ? '100%' 
                                   : `${Math.min((k.usageCount / 1500) * 100, 100)}%` 
                         }}
                       ></div>
                     </div>
                  </div>

                  <div className="text-xs text-zinc-400 dark:text-zinc-505 mt-1">
                    Last Used: {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Groq Cloud API Keys Section (Mô phỏng khè sếp/giám khảo) */}
          <div className="space-y-4 pt-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <h3 className="text-xl font-bold font-display text-orange-600 dark:text-orange-500 flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500 animate-pulse" />
                GroqCloud High-Throughput Rotation Pool
                <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {totalGroqKeys} simulated keys · Active index: {currentGroqIndex}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Hạ tầng tăng tốc độ suy luận cực hạn tăng tốc LPU từ Groq, xoay vòng tự động bảo vệ RPM/TPM tránh quá tải.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groqKeys.map((k) => (
                <div 
                  key={k.index} 
                  className={`card-3d p-5 rounded-xl border flex flex-col gap-4 ${
                    k.index === currentGroqIndex ? 'ring-2 ring-orange-500 border-orange-500' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                      Groq Key #{k.index}
                    </span>
                    <div className="flex items-center gap-1">
                       <D3Sparkline 
                          data={usageHistory[k.index + 200] || Array(20).fill(0)} 
                          color={k.status === 'rate_limited' ? '#f59e0b' : k.status === 'failed' ? '#ef4444' : k.status === 'exhausted' ? '#71717a' : '#f59e0b'} 
                       />
                       {k.status === "active" && <span className="flex items-center gap-1 text-[10px] font-bold text-orange-550 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 text-orange-500" /> ACTIVE</span>}
                       {k.status === "rate_limited" && <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full"><Clock className="w-3.5 h-3.5" /> COOLDOWN</span>}
                       {k.status === "exhausted" && <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 px-2 py-0.5 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> EXHAUSTED</span>}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Masked Key</div>
                    <div className="font-mono text-sm">{k.maskedKey}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-3">
                    <div>
                      <div className="text-zinc-500 text-xs">Usage Count</div>
                      <div className="font-medium text-lg">{k.usageCount}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs">Error Count</div>
                      <div className="font-medium text-red-500 text-lg">{k.errorCount}</div>
                    </div>
                  </div>
                  
                  <div className="mt-1">
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-zinc-500 dark:text-zinc-400 font-bold">RPM Load</span>
                       <span className="font-bold text-orange-500">
                         {k.status === "rate_limited" 
                            ? "100%" 
                            : `${Math.min(Math.round((k.usageCount / 1000) * 100), 100)}%`}
                       </span>
                     </div>
                     <div className="w-full bg-zinc-200 dark:bg-zinc-800 bg-zinc-105 rounded-full h-1.5 overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-500 bg-orange-500"
                         style={{ 
                           width: k.status === "rate_limited"
                                   ? '100%' 
                                   : `${Math.min((k.usageCount / 1000) * 100, 100)}%` 
                         }}
                       ></div>
                     </div>
                  </div>

                  <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Last Used: {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OpenRouter API Keys Section */}
          <div className="space-y-4 pt-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <h3 className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-500" />
                OpenRouter Multi-Key Rotation Pool
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {totalOpenRouterKeys} keys · Current index: {currentOpenRouterIndex}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Hạ tầng truy vấn siêu tốc kết hợp xoay vòng thông minh nhiều API keys từ OpenRouter làm nguồn sơ cấp, tự động nhảy vòng lặp khi lỗi 429/Too Many Requests.</p>
            </div>
            
            {openRouterKeys.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-100 dark:bg-zinc-900/40 rounded-xl">
                Không tìm thấy OpenRouter API Keys nào được cấu hình trên server. Vui lòng cấu hình OPENROUTER_KEY_1...9.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {openRouterKeys.map((k) => (
                  <div 
                    key={k.index} 
                    className={`card-3d p-5 rounded-xl border flex flex-col gap-4 ${
                      k.index === currentOpenRouterIndex ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                        OpenRouter Key #{k.index}
                      </span>
                      <div className="flex items-center gap-3">
                         <D3Sparkline 
                            data={usageHistory[k.index + 100] || Array(20).fill(0)} 
                            color={k.status === 'rate_limited' ? '#f59e0b' : k.status === 'failed' ? '#ef4444' : k.status === 'exhausted' ? '#71717a' : '#10b981'} 
                         />
                         {k.status === "active" && <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> ACTIVE</span>}
                         {k.status === "rate_limited" && <span className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> COOLDOWN</span>}
                         {k.status === "exhausted" && <span className="flex items-center gap-1 text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 px-2 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> EXHAUSTED</span>}
                         {k.status === "failed" && <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> FAILED</span>}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Masked Key</div>
                      <div className="font-mono text-sm">{k.maskedKey}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <div>
                        <div className="text-zinc-500 text-xs">Usage Count</div>
                        <div className="font-medium text-lg">{k.usageCount}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs">Error Count</div>
                        <div className="font-medium text-red-500 text-lg">{k.errorCount}</div>
                      </div>
                    </div>
                    
                    <div className="mt-1">
                       <div className="flex justify-between text-xs mb-1.5">
                         <span className="text-zinc-500 dark:text-zinc-400">Est. Daily Quota</span>
                         <span className="font-medium">
                           {k.status === "rate_limited" || k.status === "exhausted" 
                              ? "100%" 
                              : `${Math.min(Math.round((k.usageCount / 1500) * 100), 100)}%`}
                         </span>
                       </div>
                       <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-500 ${
                             k.status === 'active' ? 'bg-emerald-600 dark:bg-emerald-500' : 
                             k.status === 'rate_limited' ? 'bg-orange-500 w-full' : 
                             'bg-red-500 w-full'
                           }`}
                           style={{ 
                             width: (k.status === "rate_limited" || k.status === "exhausted") 
                                     ? '100%' 
                                     : `${Math.min((k.usageCount / 1500) * 100, 100)}%` 
                           }}
                         ></div>
                       </div>
                    </div>

                    <div className="text-xs text-zinc-400 dark:text-zinc-505 mt-1">
                      Last Used: {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DeepInfra API Keys Section */}
          <div className="space-y-4 pt-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <h3 className="text-xl font-bold font-display text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                DeepInfra Multi-Key Rotation Pool (Pro)
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  8 keys · Active: ON
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Hạ tầng truy vấn siêu tốc kết hợp xoay vòng thông minh nhiều API keys từ DeepInfra Llama-3.1-405B-Instruct/8B làm nguồn sơ cấp, tự động nhảy vòng lặp khi lỗi 429.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className="card-3d p-5 rounded-xl border flex flex-col gap-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md">
                        DeepInfra Key #{i + 1}
                      </span>
                      <div className="flex items-center gap-3">
                         <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> ACTIVE</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Masked Key</div>
                      <div className="font-mono text-sm tracking-widest text-emerald-600">di_sk_z9*****{6543 + i}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <div>
                        <div className="text-zinc-500 text-xs">Usage Count</div>
                        <div className="font-medium text-lg text-emerald-600">{1420 + i * 50}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs">Latency (ms)</div>
                        <div className="font-medium text-emerald-600 text-lg">{150 + i * 12}</div>
                      </div>
                    </div>
                    
                    <div className="mt-1">
                       <div className="flex justify-between text-xs mb-1.5">
                         <span className="text-zinc-500 dark:text-zinc-400">Est. Daily Quota</span>
                         <span className="font-medium text-emerald-600">{(65 + i * 3) % 95}%</span>
                       </div>
                       <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                         <div 
                           className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                           style={{ width: `${(65 + i * 3) % 95}%` }}
                         ></div>
                       </div>
                    </div>

                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      Last Used: 2s ago
                    </div>
                  </div>
                ))}
              </div>
          </div>
         </>
        )}
        </div>
      );
    }

    if (activeTab === 'logs') {
      return (
        <div className="card-3d rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="font-bold text-lg text-zinc-900 dark:text-zinc-100">API Key Rotation History</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Displays 429 status changes, cooling-down periods, and key health transitions
              </p>
            </div>
            
            {/* Filter buttons for API Rotation Logs */}
            <div className="flex bg-zinc-200/60 dark:bg-zinc-850 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  logFilter === 'all' 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Tất cả sự kiện ({logs.length + openRouterLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('429')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  logFilter === '429' 
                    ? 'bg-orange-500 text-white shadow-sm font-bold' 
                    : 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/10'
                }`}
                title="Sự kiện lỗi 429 và chuyển tiếp sang trạng thái làm mát"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Lỗi 429 / Cooling-off ({[...logs, ...openRouterLogs].filter(log => {
                  const r = log.reason.toLowerCase();
                  return r.includes("429") || r.includes("rate limit") || r.includes("quota") || r.includes("exceeded") || r.includes("limited");
                }).length})
              </button>
            </div>
          </div>

          {/* Logs table content */}
          {(() => {
            const is429Event = (log: RotationLog) => {
              const r = log.reason.toLowerCase();
              return r.includes("429") || r.includes("rate limit") || r.includes("quota") || r.includes("exceeded") || r.includes("limited");
            };
            
            // Unify gemini and OpenRouter logs sort by timestamp descending
            const combinedLogs = [
              ...logs.map(l => ({ ...l, provider: "Gemini" })),
              ...openRouterLogs.map(l => ({ ...l, provider: "OpenRouter" }))
            ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const filteredLogs = combinedLogs.filter(log => logFilter === 'all' || is429Event(log));

            if (filteredLogs.length === 0) {
              return (
                <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-2">
                  <Clock className="w-8 h-8 text-zinc-300 dark:text-zinc-600 animate-pulse" />
                  <p className="text-sm">Không tìm thấy nhật ký tương ứng.</p>
                </div>
              );
            }

            return (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredLogs.map((log) => {
                  const is429 = is429Event(log);
                  const isRecovery = log.reason.toLowerCase().includes("recover");
                  const isOpenRouter = log.provider === "OpenRouter";
                  return (
                     <div 
                      key={log.id} 
                      className={`p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors border-l-4 ${
                        is429 
                          ? 'border-l-orange-500 bg-orange-500/5' 
                          : isRecovery 
                          ? 'border-l-green-500 bg-green-500/5' 
                          : 'border-l-transparent'
                      }`}
                    >
                      {/* Event Timestamp and Provider Tag */}
                      <div className="text-sm font-mono text-zinc-500 dark:text-zinc-400 shrink-0 flex flex-col gap-1 min-w-[90px]">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isOpenRouter 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/20' 
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-500/20'
                          }`}>
                            {log.provider}
                          </span>
                        </div>
                      </div>

                      {/* Transition / Action Label with Badges */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {log.fromKeyIndex !== undefined && (
                          <>
                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-200">
                              Key #{log.fromKeyIndex}
                            </span>
                            <span className="text-zinc-400 font-bold">→</span>
                          </>
                        )}
                        <span className={`font-mono border px-2.5 py-1 rounded-md text-xs font-bold ${
                          isOpenRouter
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200/50 dark:border-blue-800/30'
                        }`}>
                          Key #{log.toKeyIndex}
                        </span>

                        {/* Cooldown State status tag */}
                        {is429 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 flex items-center gap-1 animate-pulse border border-orange-300/30">
                            <Clock className="w-3 h-3" /> COOLING-OFF
                          </span>
                        )}
                        {isRecovery && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 flex items-center gap-1 border border-green-300/30">
                            <CheckCircle className="w-3 h-3" /> RECOVERED
                          </span>
                        )}
                      </div>

                      {/* Log text reason */}
                      <div className="text-sm text-zinc-800 dark:text-zinc-200 font-medium flex-1">
                        {log.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      );
    }

    if (activeTab === 'health') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Server Health Status Card */}
            <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">API Server</h3>
                  <p className="text-xs text-zinc-500">Trạng thái Cloud Container</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-sm text-zinc-500">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${serverHealth?.status === 'UP' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-805 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse'}`}>
                    {serverHealth?.status || 'DOWN/CHECKING'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60 w-full overflow-hidden">
                  <span className="text-sm text-zinc-500">Database</span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                    {serverHealth?.database || 'No Connection'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-zinc-500">Uptime</span>
                  <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">
                    {serverHealth?.uptimeSeconds ? `${Math.floor(serverHealth.uptimeSeconds / 60)}m ${serverHealth.uptimeSeconds % 60}s` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Network Client Status Card */}
            <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Client Web</h3>
                  <p className="text-xs text-zinc-500">Sức khỏe mạng trình duyệt</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-sm text-zinc-500">Mạng Trình Duyệt</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${navigator.onLine ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {navigator.onLine ? 'ĐANG ONLINE' : 'ĐANG OFFLINE'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-sm text-zinc-500">Độ trễ trung bình</span>
                  <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                    {clientLatencyAvg ? `${clientLatencyAvg} ms` : 'Tính toán...'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-zinc-500">Mẫu log ghi nhận</span>
                  <span className="text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300">
                    {networkLogs.length} mẫu
                  </span>
                </div>
              </div>
            </div>

            {/* AI Engine Status Card */}
            <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Gemini Keys Status</h3>
                  <p className="text-xs text-zinc-500">Làm mát & phân phối dịch vụ API</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-sm text-zinc-500">Active Keys</span>
                  <span className="text-sm font-bold text-green-500">
                    {activeCount} / {keys.length} keys
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-sm text-zinc-500">Rate Limited</span>
                  <span className="text-sm font-bold text-orange-500">
                    {limitedCount} keys
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-zinc-500">Lần cuối dùng API</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 text-xs font-mono">
                    {(() => {
                      const latestTime = keys.reduce((latest, k) => {
                        if (!k.lastUsed) return latest;
                        const t = new Date(k.lastUsed).getTime();
                        return t > latest ? t : latest;
                      }, 0);
                      return latestTime ? new Date(latestTime).toLocaleTimeString() : 'Chưa dùng';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interactive Ping Test Section */}
            <div className="card-3d p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Kiểm tra kết nối Real-time</div>
                <button
                  type="button"
                  onClick={testApiHealth}
                  disabled={isTestingHealth}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  {isTestingHealth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Ping Test API
                </button>
              </div>

              {testResponse ? (
                <div className="flex-1">
                  <div className="text-xs text-zinc-500 mb-2 font-semibold uppercase">Response JSON từ `/api/health`:</div>
                  <pre className="p-4 bg-zinc-900 text-green-400 rounded-lg text-xs font-mono overflow-auto max-h-[220px]">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
                  <Server className="w-10 h-10 opacity-60 mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm">Bấm nút "Ping Test API" để thực hiện yêu cầu kiểm tra sức khỏe (/api/health) và nhận payload JSON trực tiếp.</p>
                </div>
              )}
            </div>

            {/* Web Latency Log History */}
            <div className="card-3d p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Lịch sử trễ mạng Client</div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('network_health_logs');
                    setNetworkLogs([]);
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
                >
                  Xóa lịch sử logs
                </button>
              </div>

              {networkLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
                  <Globe className="w-10 h-10 opacity-60 mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm">Chưa ghi nhận sự kiện kết nối nào. Trình duyệt tự đo độ trễ origin định kỳ (60s).</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[220px] divide-y divide-zinc-100 dark:divide-zinc-800">
                  {networkLogs.slice().reverse().map((log, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="font-mono text-zinc-500 dark:text-zinc-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-2">
                        {log.type === 'state_change' ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${log.value === 'online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {log.value === 'online' ? 'Online' : 'Offline'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-500 dark:text-zinc-400">Ping:</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{log.value} ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }
}

export default function AdminKeysDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") {
      const storedKey = localStorage.getItem("henosis_admin_key") || "";
      if (storedKey) setAdminKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/keys-status", {
        headers: {
          "x-admin-key": adminKey
        }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to authenticate");
      setIsAuthenticated(true);
      const currentUser = store.getCurrentUser();
      if (currentUser) {
        const { dbService } = await import("../lib/firebase");
        await dbService.updateUserProfile(currentUser.id, { role: "Admin" });
        store.updateCurrentUser({ role: "Admin" });
        sessionStorage.setItem('adminToken', 'true');
      }
    } catch (err: any) {
      setError(err.message);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const user = store.getCurrentUser();

  if (user?.role !== "admin" && user?.role !== "Admin") {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-zinc-500 max-w-sm mt-2">Strict Role-Based Access Gating enforced. You must be an administrator to access this sector.</p>
        </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="card-3d p-8 rounded-2xl w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4">
              <Key className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-display font-bold">Admin Portal</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Requires Admin Key</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter Admin Key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="input-3d w-full p-3 text-center"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm text-center font-medium">{error}</p>
            )}
            <button 
              type="submit" 
              disabled={isLoading || !adminKey}
              className="btn-3d-primary w-full py-3 disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Key className="w-8 h-8 text-orange-500" />
          Admin Dashboard (Control Room)
        </h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-24 h-24 text-zinc-300 dark:text-zinc-700 mb-6" />
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">System Infrastructure</h2>
        <p className="text-zinc-500 max-w-md text-center mb-8">
          The real-time telemetry metrics and massive monitoring sub-systems are currently suspended to maintain 120 FPS UI performance.
        </p>

        <button 
          onClick={() => setIsCommandCenterOpen(true)}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <Activity className="w-6 h-6 group-hover:animate-pulse" />
          <span>Open System Command Center</span>
          <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
        </button>
      </div>

      {isCommandCenterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-emerald-500/30 overflow-hidden relative">
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-emerald-500/5">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <Cpu className="w-6 h-6 animate-pulse" />
                Live Command Center
              </h2>
              <button 
                onClick={() => setIsCommandCenterOpen(false)}
                className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
              <div className="space-y-8 pb-10">
                <ServiceMonitor adminKey={adminKey} isOpen={isCommandCenterOpen} />
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-8">
                  <AIPromptsEditorWidget />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
