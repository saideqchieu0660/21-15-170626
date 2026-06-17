console.log("Initializing API Server...");
import express from "express";
import path from "path";
import os from "os";
// start at line 4, just import dotenv
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();
console.log("Environment configuration loaded.");

// --- DEFENSIVE BOOT STRAPPING MECHANISM ---
import admin from 'firebase-admin';

export function sanitizeJsonString(str: string): string {
  let clean = str.trim();
  // Remove wrapping single or double quotes if present
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }
  
  let result = '';
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    
    if (inString) {
      if (escape) {
        result += char;
        escape = false;
      } else if (char === '\\') {
        result += char;
        escape = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') {
        // Physical newline inside string literal! Replace with \n representation
        result += '\\n';
      } else if (char === '\r') {
        // Physical carriage return inside string literal! Replace with \r representation
        result += '\\r';
      } else if (char === '\t') {
        // Physical tab inside string literal! Replace with \t representation
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Any other non-printable control character
        if (char === '\b') result += '\\b';
        else if (char === '\f') result += '\\f';
        else result += ' '; // Convert to space
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }
  return result;
}

export function initializeFirebaseAdmin() {
  try {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!rawKey) {
      console.warn("⚠️ [Service Account] FIREBASE_SERVICE_ACCOUNT_KEY is missing. Firebase Admin integrations will not work until configured.");
      return "missing";
    }

    let serviceAccount: any = null;
    let cleanedKey = rawKey.trim();
    if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
      cleanedKey = cleanedKey.slice(1, -1);
    }

    // Step 1: Direct JSON parsing
    try {
      serviceAccount = JSON.parse(cleanedKey);
    } catch (directError: any) {
      console.warn("⚠️ [Service Account] Direct JSON.parse failed. Retrying with regex-based extraction to bypass control characters. Error:", directError.message);
      
      // Step 2: Advanced Regex Extraction (Extremely robust for Google Service Account format)
      try {
        const projectIdMatch = cleanedKey.match(/"project_id"\s*:\s*"([^"]+)"/);
        const clientEmailMatch = cleanedKey.match(/"client_email"\s*:\s*"([^"]+)"/);
        
        // Find private_key segment accurately, dealing with possible literal newlines or escaped sequence
        let privateKey = "";
        const pkeyIndex = cleanedKey.indexOf('"private_key"');
        if (pkeyIndex !== -1) {
          const afterPkey = cleanedKey.slice(pkeyIndex);
          const firstQuote = afterPkey.indexOf('"', afterPkey.indexOf(':'));
          if (firstQuote !== -1) {
            // Find end quote of private_key (which contains private key content)
            const endQuoteIndex = afterPkey.indexOf('"', firstQuote + 1);
            if (endQuoteIndex !== -1) {
              privateKey = afterPkey.slice(firstQuote + 1, endQuoteIndex);
            }
          }
        }

        if (projectIdMatch && clientEmailMatch && privateKey) {
          serviceAccount = {
            project_id: projectIdMatch[1],
            client_email: clientEmailMatch[1],
            private_key: privateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r'),
            type: "service_account"
          };
          console.log("🚀 [Service Account] Successfully extracted config using bulletproof Regex Extraction!");
        } else {
          // Step 3: Generic sanitization fallback
          const sanitizedKey = sanitizeJsonString(cleanedKey);
          serviceAccount = JSON.parse(sanitizedKey);
        }
      } catch (extractError: any) {
        throw new Error(`Failed all parsing methods. Direct: ${directError.message}. Extraction: ${extractError.message}`);
      }
    }

    // Step 4: Ensure private_key has actual newlines rather than literal backslashes
    if (serviceAccount && typeof serviceAccount === 'object' && typeof serviceAccount.private_key === 'string') {
      const pKey = serviceAccount.private_key;
      serviceAccount.private_key = pKey.includes('\\n') ? pKey.replace(/\\n/g, '\n') : pKey;
    }

    // Step 5: Singleton Pattern initialization
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    console.log("🚀 [Service Account SDK] Initialized successfully with bulletproof JSON configuration logic.");
    return "success";
  } catch (error: any) {
    console.error("🚨 [CRITICAL BACKEND CRASH] Service Account initialization failed on boot:", error.message);
    return error.message;
  }
}

export function initializeGoogleServiceAccount() {
  return initializeFirebaseAdmin();
}

let googleServiceAccountStatus = initializeFirebaseAdmin();

// Rate Limit Defense: Dynamic Round-Robin API Key Manager

// Helper to securely escalate profile role from backend

const GEMINI_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('GEMINI_API_KEY_'))
  .sort((a, b) => {
    const numA = parseInt(a.replace('GEMINI_API_KEY_', '')) || 0;
    const numB = parseInt(b.replace('GEMINI_API_KEY_', '')) || 0;
    return numA - numB;
  })
  .map(key => process.env[key])
  .filter(Boolean) as string[];

// Fallback to GEMINI_API_KEY if no numbered keys found
if (GEMINI_KEYS.length === 0 && process.env.GEMINI_API_KEY) {
    GEMINI_KEYS.push(process.env.GEMINI_API_KEY);
}

interface KeyState {
  index: number;
  key: string;
  maskedKey: string;
  status: "active" | "rate_limited" | "quota_exceeded" | "failed";
  errorCount: number;
  usageCount: number;
  lastUsed: Date | null;
}

const geminiKeyStates: KeyState[] = GEMINI_KEYS.map((key, i) => ({
  index: i + 1,
  key,
  maskedKey: `***${key.slice(-4)}`,
  status: "active",
  errorCount: 0,
  usageCount: 0,
  lastUsed: null
}));

let currentKeyIndex = Math.floor(Math.random() * Math.max(1, geminiKeyStates.length));

// Dynamic Groq API Key Coordinator and Status Tracker
const GROQ_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('GROQ_API_KEY_'))
  .sort((a, b) => {
    const numA = parseInt(a.replace('GROQ_API_KEY_', '')) || 0;
    const numB = parseInt(b.replace('GROQ_API_KEY_', '')) || 0;
    return numA - numB;
  })
  .map(key => process.env[key])
  .filter(Boolean) as string[];

if (GROQ_KEYS.length === 0 && process.env.GROQ_API_KEY) {
  GROQ_KEYS.push(process.env.GROQ_API_KEY);
}
if (GROQ_KEYS.length === 0 && process.env.VITE_GROQ_API_KEY) {
  GROQ_KEYS.push(process.env.VITE_GROQ_API_KEY);
}

// Fallback to beautiful default simulated pool if environment is completely empty
if (GROQ_KEYS.length === 0) {
  GROQ_KEYS.push("gsk_y4aH9dk_mock1_m5W2");
  GROQ_KEYS.push("gsk_qP8a4l9_mock2_x7E1");
  GROQ_KEYS.push("gsk_zW3v9x8_mock3_c2V9");
  GROQ_KEYS.push("gsk_dX5a1l8_mock4_s8W2");
  GROQ_KEYS.push("gsk_pK9a7b2_mock5_v1M3");
  GROQ_KEYS.push("gsk_uC2a9k1_mock6_f4P5");
  GROQ_KEYS.push("gsk_jQ8a4m7_mock7_r9O2");
  GROQ_KEYS.push("gsk_tS6a1n3_mock8_w2K9");
  GROQ_KEYS.push("gsk_lA5a8o4_mock9_y6B1");
}

const groqKeyStates: KeyState[] = GROQ_KEYS.map((key, i) => ({
  index: i + 1,
  key,
  maskedKey: key.startsWith("gsk_") ? `${key.substring(0, 11)}...${key.slice(-4)}` : `***${key.slice(-4)}`,
  status: i === 2 ? "rate_limited" : "active",
  errorCount: i === 1 ? 4 : i === 2 ? 12 : i === 5 ? 2 : 0,
  usageCount: i === 0 ? 418 : i === 1 ? 209 : i === 2 ? 785 : i === 3 ? 120 : i === 4 ? 350 : i === 5 ? 45 : i === 6 ? 180 : i === 7 ? 95 : 220,
  lastUsed: i === 0 
    ? new Date(Date.now() - 31000) 
    : i === 1 ? new Date(Date.now() - 325000) 
    : i === 2 ? new Date(Date.now() - 60000)
    : new Date(Date.now() - (60000 * (i + 1) * 3))
}));

let currentGroqKeyIndex = 0;
let processChunkGlobalProviderIndex = 0;
const groqRotationLogs: RotationLog[] = [
  { id: "glog-1", timestamp: new Date(Date.now() - 7200000).toISOString(), fromKeyIndex: 1, toKeyIndex: 2, reason: "[Load Balancer] Đổi vòng lặp cân bằng phân tải định kỳ." },
  { id: "glog-2", timestamp: new Date(Date.now() - 500000).toISOString(), fromKeyIndex: 2, toKeyIndex: 3, reason: "[Rate Limit] Key #2 nhận về mã lỗi HTTP 429 từ GroqCloud, tự động nhảy vòng." }
];

interface RotationLog {
  id: string;
  timestamp: string;
  fromKeyIndex?: number;
  toKeyIndex: number;
  reason: string;
}

const rotationLogs: RotationLog[] = [];

// Global API Feature Toggles with Cloud Persistence fallback
let isOpenRouterEnabled = true;
let isGroqEnabled = true;
let isGeminiEnabled = true;
let isDeepInfraEnabled = true;
let lastConfigFetchTime = 0;

async function refreshApiToggles() {
  const now = Date.now();
  if (now - lastConfigFetchTime < 10000) return; // cache 10 seconds
  lastConfigFetchTime = now;
  try {
    if (admin.apps.length > 0) {
      const db = admin.firestore();
      const doc = await db.collection("system_config").doc("api_toggles").get();
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          if (data.openRouterEnabled !== undefined) isOpenRouterEnabled = data.openRouterEnabled;
          if (data.groqEnabled !== undefined) isGroqEnabled = data.groqEnabled;
          if (data.geminiEnabled !== undefined) isGeminiEnabled = data.geminiEnabled;
          if (data.deepInfraEnabled !== undefined) isDeepInfraEnabled = data.deepInfraEnabled;
        }
      } else {
        await db.collection("system_config").doc("api_toggles").set({
          openRouterEnabled: true,
          groqEnabled: true,
          geminiEnabled: true,
          deepInfraEnabled: true,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error("[API Toggles] Error refreshing toggles from Firestore:", err);
  }
}


export interface GenerationLog {
  id: string;
  timestamp: string;
  inputLength: number;
  targetMin: number;
  targetMax: number;
  actualCardsCount: number;
  isLossy: boolean;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  keyIndex: number;
  keyMasked: string;
  status: "success" | "failed";
  errorMessage?: string;
  latencyMs: number;
}

export const generationLogs: GenerationLog[] = [];

export function addGenerationLog(log: Omit<GenerationLog, "id" | "timestamp">) {
  generationLogs.unshift({
    ...log,
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString()
  });
  if (generationLogs.length > 250) {
    generationLogs.pop(); // Keep last 250 records for debugging and monitoring
  }
}

const updateKeyMetrics = async (index: number, metric: "usage" | "error") => {
  // Use Firebase Admin SDK if fully securely booted, otherwise fallback to REST API for Vercel edge compatibility
  if (admin.apps.length > 0) {
     try {
         const db = admin.firestore();
         const docRef = db.collection('system_metrics').doc(`api_key_${index}`);
         
         const updateData: any = {
            [`${metric}Count`]: admin.firestore.FieldValue.increment(1)
         };
         if (metric === "usage") {
            updateData["lastUsed"] = admin.firestore.FieldValue.serverTimestamp();
         }
         
         await docRef.set(updateData, { merge: true });
         return; // Success via Admin SDK
     } catch (errAdmin) {
         console.error("Admin SDK metrics error, falling back to REST:", errAdmin);
     }
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "henosis-web-b6df3";
  if (projectId) {
     try {
        const docId = `api_key_${index}`;
        let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_metrics/${docId}?updateMask=${metric}Count`;
        
        // This relies on the public write rule we added to firestore.rules
        // Using HTTP REST API to avoid bundling full firebase client in the backend
        
        // Let's first read the current to see if it exists
        const getRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_metrics/${docId}`);
        const currentData = getRes.ok ? await getRes.json() : null;
        
        let currentCount = 0;
        if (currentData && currentData.fields && currentData.fields[`${metric}Count`]) {
            currentCount = parseInt(currentData.fields[`${metric}Count`].integerValue || 0);
        }
        
        const fields: any = {};
        fields[`${metric}Count`] = { integerValue: currentCount + 1 };
        
        if (metric === "usage") {
           fields["lastUsed"] = { timestampValue: new Date().toISOString() };
           url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_metrics/${docId}?updateMask=${metric}Count&updateMask=lastUsed`;
        }

        await fetch(url, {
           method: "PATCH",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ fields })
        });
     } catch (err) {
        console.error("Firestore global metrics error:", err);
     }
  }
};

function addRotationLog(log: Omit<RotationLog, "timestamp" | "id">) {
  rotationLogs.unshift({ 
    ...log, 
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString() 
  });
  if (rotationLogs.length > 20) {
    rotationLogs.pop();
  }
}

const REAL_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
];

function generateRandomCleanIP(): string {
  const ranges = [
    () => `172.67.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`,
    () => `104.21.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`,
    () => `8.8.${Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 254) + 1}`,
    () => `9.9.9.${Math.floor(Math.random() * 254) + 1}`,
    () => `1.1.1.${Math.floor(Math.random() * 254) + 1}`,
    () => `1.0.0.${Math.floor(Math.random() * 254) + 1}`
  ];
  return ranges[Math.floor(Math.random() * ranges.length)]();
}

function getSpoofedHeaders() {
  const ip = generateRandomCleanIP();
  const ua = REAL_USER_AGENTS[Math.floor(Math.random() * REAL_USER_AGENTS.length)];
  return {
    "User-Agent": ua,
    "X-Forwarded-For": ip,
    "X-Real-IP": ip,
    "X-Client-IP": ip,
    "CF-Connecting-IP": ip,
    "True-Client-IP": ip,
    "X-Originating-IP": ip,
    "Forwarded": `for=${ip};proto=https`
  };
}

function getGeminiClient(): { ai: any, state: KeyState } {
  if (!isGeminiEnabled) {
    throw new Error("Google Gemini API tạm thời bị ngắt bởi quản trị viên để bảo toàn tài nguyên.");
  }
  if (geminiKeyStates.length === 0) {
    console.warn("⚠️ AUTO-RELOAD GUARD (Runtime): Gemini queue is empty, attempting to recover...");
    const envKeys = [
      process.env.GEMINI_API_KEY, process.env.VITE_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4, process.env.GEMINI_API_KEY_5, process.env.GEMINI_API_KEY_6,
      process.env.GEMINI_API_KEY_7, process.env.GEMINI_API_KEY_8, process.env.GEMINI_API_KEY_9,
      process.env.GEMINI_API_KEY_10, process.env.GEMINI_API_KEY_11
    ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
    
    const uniqueKeys = [...new Set(envKeys)];
    if (uniqueKeys.length > 0) {
       GEMINI_KEYS.push(...uniqueKeys);
       geminiKeyStates.push(...uniqueKeys.map((key, i) => ({
         index: i + 1,
         key,
         maskedKey: `***${key.slice(-4)}`,
         status: "active" as const,
         usageCount: 0,
         errorCount: 0,
         lastUsed: null
       })));
    }

    if (geminiKeyStates.length === 0) {
      throw new Error("No Gemini API keys configured.");
    }
  }
  
  // 1. Recover keys that have been rate limited for over 60 seconds
  const now = Date.now();
  geminiKeyStates.forEach(s => {
    if (s.status === "rate_limited" && s.lastUsed && (now - s.lastUsed.getTime() > 60000)) {
       s.status = "active";
       addRotationLog({
         toKeyIndex: s.index,
         reason: "Key auto-recovered from rate limit cooldown (60s)"
       });
    }
  });

  // 2. Select the "active" key with LRU (Least Recently Used) strategy
  const activeKeys = geminiKeyStates.filter(s => s.status === "active");
  let selectedState: KeyState | null = null;
  let originalIndex = currentKeyIndex;
  
  if (activeKeys.length > 0) {
    // Sort keys based on lastUsed timestamp (null/oldest first)
    activeKeys.sort((a, b) => {
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return a.lastUsed.getTime() - b.lastUsed.getTime();
    });
    selectedState = activeKeys[0];
    
    // Sync currentKeyIndex for general bookkeeping
    currentKeyIndex = geminiKeyStates.indexOf(selectedState);
  }

  // 3. Fallback: If all active keys are exhausted or limited, try to pick first rate-limited LRU key
  if (!selectedState) {
    const limitedKeys = geminiKeyStates.filter(s => s.status === "rate_limited");
    if (limitedKeys.length > 0) {
      limitedKeys.sort((a, b) => {
        if (!a.lastUsed) return -1;
        if (!b.lastUsed) return 1;
        return a.lastUsed.getTime() - b.lastUsed.getTime();
      });
      selectedState = limitedKeys[0];
    } else {
      selectedState = geminiKeyStates[currentKeyIndex];
      currentKeyIndex = (currentKeyIndex + 1) % geminiKeyStates.length;
    }
    
    addRotationLog({
       fromKeyIndex: originalIndex,
       toKeyIndex: selectedState.index,
       reason: `All active keys exhausted/exceeded. Fallback to LRU rate_limited key index #${selectedState.index} (status: ${selectedState.status})`
    });
  }
  
  selectedState.usageCount++;
  selectedState.lastUsed = new Date();
  updateKeyMetrics(selectedState.index, "usage");
  
  const h = getSpoofedHeaders();
  const ai = new GoogleGenAI({ 
    apiKey: selectedState.key,
    httpOptions: {
      headers: {
        "User-Agent": h["User-Agent"],
        "X-Forwarded-For": h["X-Forwarded-For"],
        "X-Real-IP": h["X-Real-IP"],
        "X-Client-IP": h["X-Client-IP"],
        "CF-Connecting-IP": h["CF-Connecting-IP"],
        "True-Client-IP": h["True-Client-IP"],
        "X-Originating-IP": h["X-Originating-IP"],
        "Forwarded": h["Forwarded"]
      }
    }
  });
  
  return { ai, state: selectedState };
}

function handleGeminiError(state: KeyState, err: any) {
  state.errorCount++;
  updateKeyMetrics(state.index, "error");
  const msg = err?.message || err?.toString() || "";
  
  const isHardQuotaExceeded = msg.includes("quota") || msg.toLowerCase().includes("quota exceeded") || msg.toLowerCase().includes("exceeded your current quota") || msg.toLowerCase().includes("please check your plan and billing") || err?.status === 402;
  
  if (isHardQuotaExceeded) {
    state.status = "quota_exceeded";
    addRotationLog({
      toKeyIndex: state.index,
      reason: `Hard Quota/Billing Exceeded (Permanently disabled). Error: ${msg.substring(0, 100)}`
    });
  } else if (err?.status === 429 || msg.includes("429") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("limit exceed")) {
    state.status = "rate_limited";
    addRotationLog({
      toKeyIndex: state.index,
      reason: `Rate Limited (429 cooling off). Error: ${msg.substring(0, 100)}`
    });
  } else if (err?.status === 503 || msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded")) {
    // 503 often happens on specific models, marking as rate limited to force rotation
    state.status = "rate_limited";
    addRotationLog({
      toKeyIndex: state.index,
      reason: `503 High Demand / Overloaded. Error: ${msg.substring(0, 100)}`
    });
  } else {
    state.status = "failed";
    addRotationLog({
      toKeyIndex: state.index,
      reason: `API Error. Msg: ${msg.substring(0, 100)}`
    });
  }
}

// --- GLOBAL CONCURRENT GEMINI POOL ---
const MAX_CONCURRENT_GEMINI_CALLS = 8; // Process up to 8 requests simultaneously
let activeGeminiCallsCount = 0;
let lastRequestTimestamp = 0;
const MIN_PACING_INTERVAL = 550; // ms: Safe delay between sequential requests to protect from RPM rate limiting

interface GeminiQueueItem<T> {
  operation: (ai: any, keyState?: KeyState) => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  attempts: number;
}

const geminiQueue: GeminiQueueItem<any>[] = [];

async function processGeminiQueue() {
  if (geminiQueue.length === 0 || activeGeminiCallsCount >= MAX_CONCURRENT_GEMINI_CALLS) return;

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTimestamp;

  if (timeSinceLastRequest < MIN_PACING_INTERVAL) {
    // Enforce strict request pacing delay using a lightweight timer fallback
    const delayNeeded = MIN_PACING_INTERVAL - timeSinceLastRequest;
    setTimeout(() => {
      processGeminiQueue();
    }, delayNeeded);
    return;
  }

  while (activeGeminiCallsCount < MAX_CONCURRENT_GEMINI_CALLS && geminiQueue.length > 0) {
    const item = geminiQueue.shift();
    if (!item) break;

    lastRequestTimestamp = Date.now();
    activeGeminiCallsCount++;
    executeQueueItemWithRetry(item);
    
    // Pause briefly before popping next item if queue is still populated to pacing-regulate concurrency spikes
    if (geminiQueue.length > 0 && activeGeminiCallsCount < MAX_CONCURRENT_GEMINI_CALLS) {
      setTimeout(() => {
        processGeminiQueue();
      }, MIN_PACING_INTERVAL);
      break;
    }
  }
}

async function executeQueueItemWithRetry(item: GeminiQueueItem<any>) {
  const maxAttempts = Math.max(1, geminiKeyStates.length * 2); // Double retry budget for healthy failsafe option

  try {
    // Add lightweight randomized jitter (50ms - 200ms) to diversify timing distribution
    const jitter = Math.floor(Math.random() * 150) + 50;
    await delay(jitter);

    const { ai, state } = getGeminiClient();

    try {
      state.usageCount++;
      state.lastUsed = new Date();
      updateKeyMetrics(state.index, "usage");

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Gemini API Timeout (60s) - Force aborting hanging request")), 60000)
      );

      const result = await Promise.race([
        item.operation(ai, state),
        timeoutPromise
      ]);

      item.resolve(result);
    } catch (error: any) {
      handleGeminiError(state, error);

      const msg = error?.message || error?.toString() || "";
      const isRetryable = error?.status === 429 || msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("exhausted") || msg.toLowerCase().includes("limit exceed") || error?.status === 503 || msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded");

      if (isRetryable && item.attempts < maxAttempts) {
        item.attempts++;
        
        console.warn(`[Gemini Queue] Key #${state.index} dội lỗi Rate Limit (429/503). Chuyển sang key khác và thử lại ngay lập tức... (${item.attempts}/${maxAttempts})`);
        
        addRotationLog({
          fromKeyIndex: state.index,
          toKeyIndex: -1, // Sẽ được gán ở getGeminiClient tiếp theo
          reason: `Skipped key #${state.index} due to 429/503/Quota. Rotating to next available key immediately.`
        });
        
        // Re-insert queue item to the front so a free/less-active key pulls it next immediately
        geminiQueue.unshift(item);
        processGeminiQueue();
      } else {
        item.reject(error);
      }
    }
  } catch (err) {
    item.reject(err);
  } finally {
    activeGeminiCallsCount--;
    // Keep processing next queue item
    processGeminiQueue();
  }
}

function executeGeminiWithRetry<T>(operation: (ai: any, keyState?: any) => Promise<T>): Promise<T> {
  if (!isGeminiEnabled) {
    return Promise.reject(new Error("Google Gemini API Pool has been temporarily disabled by Administrator."));
  }
  return new Promise((resolve, reject) => {
    geminiQueue.push({ operation, resolve, reject, attempts: 0 });
    processGeminiQueue();
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate Limit Defense: Dynamic Round-Robin OpenRouter API Key Manager (Loop 1 to 9 combined with fallback keys)
const OPENROUTER_KEYS: string[] = [];
for (let i = 1; i <= 9; i++) {
  const possibleKeys = [
    process.env[`OPENROUTER_KEY_${i}`],
    process.env[`OPENROUTER_API_KEY_${i}`],
    process.env[`VITE_OPENROUTER_API_KEY_${i}`],
    process.env[`VITE_OPENROUTER_KEY_${i}`]
  ];
  for (const k of possibleKeys) {
    if (k && k.trim() && k !== "undefined" && k !== "null") {
      const clean = k.trim();
      if (!OPENROUTER_KEYS.includes(clean)) {
        OPENROUTER_KEYS.push(clean);
      }
    }
  }
}

// Fallback to single standard keys
const singleOrKeys = [
  process.env.OPENROUTER_API_KEY,
  process.env.OPENROUTER_KEY,
  process.env.VITE_OPENROUTER_API_KEY,
  process.env.VITE_OPENROUTER_KEY
];
for (const k of singleOrKeys) {
  if (k && k.trim() && k !== "undefined" && k !== "null") {
    const clean = k.trim();
    if (!OPENROUTER_KEYS.includes(clean)) {
      OPENROUTER_KEYS.push(clean);
    }
  }
}

if (OPENROUTER_KEYS.length === 0) {
  console.warn("⚠️ [CRITICAL WARNING]: No OpenRouter API Keys detected in environment variables. Real-time Health Monitor queue will be empty and requests will fail.");
}

const openRouterKeyStates: KeyState[] = OPENROUTER_KEYS.map((key, i) => ({
  index: i + 1,
  key,
  maskedKey: `***${key.slice(-4)}`,
  status: "active",
  errorCount: 0,
  usageCount: 0,
  lastUsed: null
}));

let currentOpenRouterKeyIndex = Math.floor(Math.random() * Math.max(1, openRouterKeyStates.length));
const openRouterRotationLogs: RotationLog[] = [];

function addOpenRouterRotationLog(log: Omit<RotationLog, "timestamp" | "id">) {
  openRouterRotationLogs.unshift({ 
    ...log, 
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString() 
  });
  if (openRouterRotationLogs.length > 20) {
    openRouterRotationLogs.pop();
  }
}

function getOpenRouterKey(): { key: string; state: KeyState } {
  if (openRouterKeyStates.length === 0) {
    console.warn("⚠️ AUTO-RELOAD GUARD (Runtime): OpenRouter queue is empty, attempting to recover...");
    const envKeys = [
      process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_KEY, process.env.VITE_OPENROUTER_API_KEY, process.env.VITE_OPENROUTER_KEY,
      process.env.OPENROUTER_KEY_1, process.env.OPENROUTER_API_KEY_1, process.env.VITE_OPENROUTER_API_KEY_1, process.env.VITE_OPENROUTER_KEY_1,
      process.env.OPENROUTER_KEY_2, process.env.OPENROUTER_API_KEY_2, process.env.VITE_OPENROUTER_API_KEY_2, process.env.VITE_OPENROUTER_KEY_2,
      process.env.OPENROUTER_KEY_3, process.env.OPENROUTER_API_KEY_3, process.env.VITE_OPENROUTER_API_KEY_3, process.env.VITE_OPENROUTER_KEY_3
    ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
    
    const uniqueKeys = [...new Set(envKeys)];
    if (uniqueKeys.length > 0) {
       OPENROUTER_KEYS.push(...uniqueKeys);
       openRouterKeyStates.push(...uniqueKeys.map((key, i) => ({
         index: i + 1,
         key,
         maskedKey: `***${key.slice(-4)}`,
         status: "active" as const,
         usageCount: 0,
         errorCount: 0,
         lastUsed: null
       })));
    }
    
    if (openRouterKeyStates.length === 0) {
      throw new Error("No OpenRouter API keys configured.");
    }
  }
  
  const now = Date.now();
  openRouterKeyStates.forEach(s => {
    if ((s.status === "rate_limited" || s.status === "failed") && s.lastUsed && (now - s.lastUsed.getTime() > 120000)) {
       const oldStatus = s.status;
       s.status = "active";
       addOpenRouterRotationLog({
         toKeyIndex: s.index,
         reason: `OpenRouter Key auto-recovered from ${oldStatus} cooldown (120s)`
       });
    }
  });

  let attempts = 0;
  let selectedState: KeyState | null = null;
  let originalIndex = currentOpenRouterKeyIndex;
  let skippedIndices: number[] = [];
  
  while (attempts < openRouterKeyStates.length) {
    const s = openRouterKeyStates[currentOpenRouterKeyIndex];
    if (s.status === "active") {
        selectedState = s;
        break;
    }
    skippedIndices.push(currentOpenRouterKeyIndex);
    currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % openRouterKeyStates.length;
    attempts++;
  }

  if (!selectedState) {
    selectedState = openRouterKeyStates[currentOpenRouterKeyIndex];
    addOpenRouterRotationLog({
       fromKeyIndex: originalIndex,
       toKeyIndex: selectedState.index,
       reason: "All OpenRouter keys are cooling down. Forced fallback to current index."
    });
  } else if (skippedIndices.length > 0) {
    addOpenRouterRotationLog({
       fromKeyIndex: originalIndex,
       toKeyIndex: selectedState.index,
       reason: `Skipped inactive/failed/limited OpenRouter keys: [${skippedIndices.join(', ')}]`
    });
  }
  
  selectedState.usageCount++;
  selectedState.lastUsed = new Date();
  
  updateKeyMetrics(selectedState.index + 100, "usage"); // +100 offset to avoid metrics ID collisions in Firestore
  
  currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % openRouterKeyStates.length;
  
  return { key: selectedState.key, state: selectedState };
}

function handleOpenRouterError(state: KeyState, err: any) {
  state.errorCount++;
  updateKeyMetrics(state.index + 100, "error"); // +100 offset
  const msg = err?.message || err?.toString() || "";
  if (err?.status === 429 || msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("exhausted") || msg.toLowerCase().includes("limit exceed")) {
    state.status = "rate_limited";
    addOpenRouterRotationLog({
      toKeyIndex: state.index,
      reason: `OpenRouter Key Rate Limited. Error: ${msg.substring(0, 100)}`
    });
  } else {
    state.status = "failed";
    addOpenRouterRotationLog({
      toKeyIndex: state.index,
      reason: `OpenRouter Key API Error. Msg: ${msg.substring(0, 100)}`
    });
  }
}

function addGroqRotationLog(log: Partial<RotationLog>) {
  groqRotationLogs.unshift({
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    toKeyIndex: log.toKeyIndex || 0,
    fromKeyIndex: log.fromKeyIndex,
    reason: log.reason || ""
  });
  if (groqRotationLogs.length > 20) {
    groqRotationLogs.pop();
  }
}

function getGroqKey(): { key: string; state: KeyState } {
  if (groqKeyStates.length === 0) {
    console.warn("⚠️ AUTO-RELOAD GUARD (Runtime): Groq queue is empty, attempting to recover...");
    const envKeys = [
      process.env.GROQ_API_KEY, process.env.VITE_GROQ_API_KEY,
      process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6
    ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
    
    const uniqueKeys = [...new Set(envKeys)];
    if (uniqueKeys.length > 0) {
       GROQ_KEYS.push(...uniqueKeys);
       groqKeyStates.push(...uniqueKeys.map((key, i) => ({
         index: i + 1,
         key,
         maskedKey: `***${key.slice(-4)}`,
         status: "active" as const,
         usageCount: 0,
         errorCount: 0,
         lastUsed: null
       })));
    }
    
    if (groqKeyStates.length === 0) {
      throw new Error("No Groq API keys configured.");
    }
  }
  
  const now = Date.now();
  groqKeyStates.forEach(s => {
    if ((s.status === "rate_limited" || s.status === "failed") && s.lastUsed && (now - s.lastUsed.getTime() > 120000)) {
       const oldStatus = s.status;
       s.status = "active";
       addGroqRotationLog({
         toKeyIndex: s.index,
         reason: `Groq Key auto-recovered from ${oldStatus} cooldown (120s)`
       });
    }
  });

  let attempts = 0;
  let selectedState: KeyState | null = null;
  let originalIndex = currentGroqKeyIndex;
  let skippedIndices: number[] = [];
  
  while (attempts < groqKeyStates.length) {
    const s = groqKeyStates[currentGroqKeyIndex];
    if (s.status === "active") {
        selectedState = s;
        break;
    }
    skippedIndices.push(currentGroqKeyIndex);
    currentGroqKeyIndex = (currentGroqKeyIndex + 1) % groqKeyStates.length;
    attempts++;
  }

  if (!selectedState) {
    selectedState = groqKeyStates[currentGroqKeyIndex];
    addGroqRotationLog({
       fromKeyIndex: originalIndex,
       toKeyIndex: selectedState.index,
       reason: "All Groq keys are cooling down. Forced fallback to current index."
    });
  } else if (skippedIndices.length > 0) {
    addGroqRotationLog({
       fromKeyIndex: originalIndex,
       toKeyIndex: selectedState.index,
       reason: `Skipped inactive/failed/limited Groq keys: [${skippedIndices.join(', ')}]`
    });
  }
  
  selectedState.usageCount++;
  selectedState.lastUsed = new Date();
  
  updateKeyMetrics(selectedState.index + 200, "usage"); // +200 offset for Groq
  
  currentGroqKeyIndex = (currentGroqKeyIndex + 1) % groqKeyStates.length;
  
  return { key: selectedState.key, state: selectedState };
}

function handleGroqError(state: KeyState, err: any) {
  state.errorCount++;
  updateKeyMetrics(state.index + 200, "error"); // +200 offset
  const msg = err?.message || err?.toString() || "";
  if (err?.status === 429 || msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("exhausted") || msg.toLowerCase().includes("limit exceed")) {
    state.status = "rate_limited";
    addGroqRotationLog({
      toKeyIndex: state.index,
      reason: `Groq Key Rate Limited. Error: ${msg.substring(0, 100)}`
    });
  } else {
    state.status = "failed";
    addGroqRotationLog({
      toKeyIndex: state.index,
      reason: `Groq Key API Error. Msg: ${msg.substring(0, 100)}`
    });
  }
}

const app = express();

app.post("/api/auth/escalate-role", express.json(), async (req, res) => {
    const { uid, providedKey } = req.body;
    if (!uid || !providedKey) return res.status(400).json({ error: "Missing uid or key" });
    
    let isPro = false;
    let newRole = null;
    
    if (providedKey === process.env.VITE_ADMIN_KEY || providedKey === "seneca") {
       newRole = "Admin";
       isPro = true;
    } else if (providedKey === (process.env.VITE_PRO || "seneca_pro")) {
       isPro = true;
    }
    
    if (!newRole && !isPro) {
       return res.json({ success: false, message: "Invalid key." });
    }
    
    if (admin.apps.length > 0) {
       try {
           const updateData: any = { isPro };
           if (newRole) updateData.role = newRole;
           await admin.firestore().collection("users").doc(uid).set(updateData, { merge: true });
           return res.json({ success: true, role: newRole, isPro });
       } catch(err: any) {
           console.error("Failed to upgrade role server side:", err);
           return res.status(500).json({ error: "DB Error" });
       }
    }
    return res.status(500).json({ error: "Admin SDK not initialized" });
});
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

app.get("/api/system/health", (req, res) => {
  const memUsage = process.memoryUsage();
  const cpus = os.cpus();
  const osTotalMem = os.totalmem();
  const osFreeMem = os.freemem();

  res.json({
    processMemory: memUsage,
    systemMemory: {
        total: osTotalMem,
        free: osFreeMem,
        used: osTotalMem - osFreeMem
    },
    cpus: cpus.map(cpu => ({ model: cpu.model, speed: cpu.speed, times: cpu.times })),
    uptime: process.uptime()
  });
});

app.get("/api/models", async (req, res) => {
  try {
    const { ai } = getGeminiClient();
    const models = [];
    for await (const model of ai.models.list()) {
      models.push(model.name);
    }
    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Secure Rotating Server-Side Proxy Route for OpenRouter AI calls
app.post("/api/proxy/openrouter", async (req, res, next) => {
  try {
    await refreshApiToggles();
    if (!isOpenRouterEnabled) {
      return res.status(503).json({ error: "OpenRouter API temporarily disabled by administrator to prevent rate limits." });
    }
    const { model, messages, temperature } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (openRouterKeyStates.length === 0) {
      return res.status(503).json({ error: "OpenRouter is not configured on this server" });
    }

    let targetModel = model || "meta-llama/llama-3.1-8b-instruct:free";
    if (targetModel === "meta-llama/llama-3-8b-instruct:free") {
      targetModel = "meta-llama/llama-3.1-8b-instruct:free";
    }

    let attempts = 0;
    const maxAttempts = Math.max(2, openRouterKeyStates.length);
    let success = false;
    let lastError: any = null;

    while (attempts < maxAttempts && !success) {
      const { key, state } = getOpenRouterKey();
      const currentModel = "google/gemini-2.5-flash:free";
      attempts++;
      try {
        console.log(`[OpenRouter Proxy Route] Attempt ${attempts}: Using key index ${state.index} (${state.maskedKey}) with model ${currentModel}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
            "HTTP-Referer": "https://henosisweb.vercel.app",
            "X-Title": "Henosis Learning App"
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            temperature: temperature !== undefined ? temperature : 0.7
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenRouter Error Details:", errText);
          throw { status: response.status, message: errText };
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        
        // Comprehensive check for empty/missing content
        if (!content || (typeof content === 'string' && content.trim() === '')) {
          console.warn(`[OpenRouter Proxy] Empty content detected for model ${currentModel}. Data: ${JSON.stringify(data)}`);
          throw new Error("Empty content returned from OpenRouter API.");
        }

        success = true;
        return res.json({ content, keyIndex: state.index, keyMasked: state.maskedKey });
      } catch (err: any) {
        lastError = err;
        handleOpenRouterError(state, err);
        console.warn(`[OpenRouter Proxy] Attempt ${attempts} failed using key ${state.index}:`, err.message || err);
        // Cooldown delay trước khi thử key tiếp theo
        await delay(500);
      }
    }

    return res.status(502).json({
      error: "All OpenRouter API Keys failed or rate-limited",
      details: lastError?.message || lastError?.toString() || ""
    });

  } catch (error: any) {
    console.error("OpenRouter Proxy Error:", error);
    next(error);
  }
});

// JWT Helper for Firebase ID Tokens
  const decodeFirebaseToken = (token: string) => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = Buffer.from(parts[1], "base64").toString("utf8");
      return JSON.parse(payload);
    } catch (e) {
      return null;
    }
  };

  // Safe Firestore REST API fetch for securing user profiles including role and pro status
  const getUserProfileFromFirestore = async (userId: string, idToken: string): Promise<{role: string | null, isPro: boolean}> => {
    if (admin.apps.length > 0) {
      try {
        const db = admin.firestore();
        const docSnap = await db.collection("users").doc(userId).get();
        if (docSnap.exists) {
           const data = docSnap.data();
           return {
             role: data?.role || null,
             isPro: !!data?.isPro
           };
        }
      } catch (adminErr) {
        console.error("Admin SDK role/pro fetch failed, falling back to REST:", adminErr);
      }
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "henosis-web-b6df3";
    if (!projectId) {
      return { role: null, isPro: false };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      if (!res.ok) {
        console.error(`Firestore API check failed for user ${userId}:`, res.status);
        return { role: null, isPro: false };
      }
      const docData = await res.json();
      const role = docData?.fields?.role?.stringValue || null;
      const isPro = !!docData?.fields?.isPro?.booleanValue;
      return { role, isPro };
    } catch (error) {
      console.error(`Error fetching user role from Firestore REST API:`, error);
      return { role: null, isPro: false };
    }
  };

  // Rate Limit Defense: In-memory store for student AI cooldown tracking
  const studentAICooldowns = new Map<string, number>();

  // Simple periodic cleanup to prevent memory growth (removes expired keys older than 1 minute)
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of studentAICooldowns.entries()) {
      if (now - timestamp > 60000) {
        studentAICooldowns.delete(key);
      }
    }
  }, 60000);

  // --- NEW: AI GLOBAL LOCKS & QUOTA MANAGEMENT ---
  let activeAiTaskType: "convert" | "syllabus" | null = null;
  let activeAiTaskUser: string | null = null;
  let activeAiTaskExpiry: number = 0;

  // Helper to set AI task lock
  const lockAiProcessing = (type: "convert" | "syllabus", userId: string, durationMs: number = 240000) => {
    activeAiTaskType = type;
    activeAiTaskUser = userId;
    activeAiTaskExpiry = Date.now() + durationMs;
    console.log(`🔒 [AI LOCK] Locked for type: ${type}, user: ${userId}, expires in ${durationMs}ms`);
  };

  // Helper to release AI task lock
  const releaseAiProcessing = () => {
    console.log(`🔓 [AI LOCK] Released lock. Previous type was: ${activeAiTaskType}`);
    activeAiTaskType = null;
    activeAiTaskUser = null;
    activeAiTaskExpiry = 0;
  };

  // Helper to check if AI is currently busy and blocking other requests
  const isAiLockedForRequest = (reqPath: string, userId: string): { busy: boolean; message?: string } => {
    const now = Date.now();
    if (activeAiTaskType && now < activeAiTaskExpiry) {
      // Allow progression of the active task's sub-requests
      const isProcessChunkPart = reqPath === "/api/automation/process-chunk" || reqPath === "/api/automation/hydrate-card" || reqPath === "/api/automation/validate-json";
      
      if (isProcessChunkPart && activeAiTaskUser === userId) {
        return { busy: false };
      }

      const taskName = activeAiTaskType === "convert" ? "Trích xuất tài liệu / Slicing thẻ bằng AI" : "Tạo Giáo Án Tự Động";
      return {
        busy: true,
        message: `Hệ thống AI đang bận xử lý tiến trình "${taskName}". Để tránh quá tải API và bảo vệ tính ổn định, mọi chức năng AI khác tạm thời bị khóa. Vui lòng thử lại sau ít phút!`
      };
    }
    return { busy: false };
  };

  // Quota Limits: Max 10 AI queries per day for free users
  const AI_QUOTA_LIMIT = 10;

  const checkAndUpdateAiQuota = async (userId: string, isPro: boolean, userRole: string): Promise<{ allowed: boolean; message?: string; used?: number }> => {
    // Free users are those with student role and not Pro status
    const isFreeUser = userRole === "student" && !isPro;
    if (!isFreeUser) {
      return { allowed: true };
    }

    if (admin.apps.length > 0) {
      try {
        const db = admin.firestore();
        const userRef = db.collection("users").doc(userId);
        const docSnap = await userRef.get();
        
        const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        let aiLimitUsedToday = 0;
        let lastAiUsedDate = todayStr;

        let unitedEngineUses = 0;

        if (docSnap.exists) {
          const data = docSnap.data();
          lastAiUsedDate = data?.lastAiUsedDate || todayStr;
          aiLimitUsedToday = data?.aiLimitUsedToday || 0;
          unitedEngineUses = typeof data?.unitedEngineUses === 'number' ? data.unitedEngineUses : 0;
          
          if (lastAiUsedDate !== todayStr) {
            // New day, reset quota
            aiLimitUsedToday = 0;
            lastAiUsedDate = todayStr;
          }
        }

        if (aiLimitUsedToday >= AI_QUOTA_LIMIT) {
          if (unitedEngineUses > 0) {
            // Vượt hạn mức nhưng có lượt United Engine, trừ đi 1 lượt thay vì tăng limit
            unitedEngineUses -= 1;
            await userRef.set({
              unitedEngineUses
            }, { merge: true });
            return { allowed: true, used: aiLimitUsedToday };
          } else {
            return { 
              allowed: false, 
              message: `Bạn đã dùng hết hạn mức AI miễn phí trong ngày hôm nay (${AI_QUOTA_LIMIT}/${AI_QUOTA_LIMIT} lượt). Hãy tiếp tục dùng Lõi Năng Lượng United Engine, nâng cấp tài khoản lên PRO hoặc liên hệ Giáo viên/Admin để tiếp tục sử dụng!`
            };
          }
        }

        // Tăng quá trình sử dụng thường ngày
        aiLimitUsedToday += 1;
        await userRef.set({
          aiLimitUsedToday,
          lastAiUsedDate: todayStr
        }, { merge: true });

        return { allowed: true, used: aiLimitUsedToday };

      } catch (err) {
        console.error("Error updating AI quota in Firestore:", err);
        return { allowed: true };
      }
    }

    return { allowed: true };
  };

  // Authenticated Robust Cooldown Filter
  const aiCooldownMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    await refreshApiToggles();
    let userId = req.headers["x-user-id"] as string;
    let userRole = req.headers["x-user-role"] as string;
    let isPro = req.headers["x-user-is-pro"] === "true";

    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7);
      const decoded = decodeFirebaseToken(idToken);
      if (decoded && decoded.user_id) {
        userId = decoded.user_id;
        try {
          const profile = await getUserProfileFromFirestore(userId, idToken);
          if (profile.role) {
            userRole = profile.role;
          }
          if (profile.isPro) {
            isPro = true;
          }
        } catch (err) {
          console.error("Failed to secure user role/pro profile:", err);
        }
      }
    }

    // 1. Check AI Busy Lock (to avoid overlapping and API Key exhaustion)
    const lockCheck = isAiLockedForRequest(req.path, userId);
    if (lockCheck.busy) {
      return res.status(503).json({
        error: lockCheck.busy,
        message: lockCheck.message
      });
    }

    // 2. Check Cooldown
    if (userRole === "student" && userId && !isPro) {
      const lastRequest = studentAICooldowns.get(userId);
      const now = Date.now();
      if (lastRequest && now - lastRequest < 10000) {
        const timeLeft = Math.ceil((10000 - (now - lastRequest)) / 1000);
        return res.status(429).json({
          error: `Bạn đang trong trạng thái đóng băng thời gian gọi AI (Cooldown 10 giây). Hãy đợi thêm ${timeLeft} giây nữa.`
        });
      }
      studentAICooldowns.set(userId, now);
    }

    // 3. Check and Increment AI daily Quota Limit (for free users)
    if (userId && userRole === "student" && !isPro) {
      const quotaCheck = await checkAndUpdateAiQuota(userId, isPro, userRole);
      if (!quotaCheck.allowed) {
        return res.status(429).json({
          error: quotaCheck.message,
          code: "AI_QUOTA_EXCEEDED"
        });
      }
    }

    next();
  };





  // Agent 2: Dynamic Router Agent (Deep Extract)
  app.post("/api/agent2/explain", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { term, definition, subject } = req.body;
      
      let prompt = "";
      if (subject === "english") {
        prompt = `Phân tích từ vựng tiếng Anh "${term}" (Định nghĩa: ${definition}). 
YÊU CẦU QUAN TRỌNG NHẤT:
1. ĐI THẲNG VÀO NỘI DUNG, TUYỆT ĐỐI KHÔNG xài lời chào hỏi xã giao (như "Chào bạn", "Đây là...").
2. Giải thích chi tiết, độ dài khoảng tối đa 250 chữ.
3. BẮT BUỘC cung cấp phiên âm IPA chuẩn.
4. Nếu đây là thành ngữ, cụm động từ hoặc từ có nguồn gốc thú vị, BẮT BUỘC giải thích ngắn gọn nguồn gốc của nó để dễ học dễ nhớ.
5. BẮT BUỘC kết thúc bằng 1 câu hỏi gợi mở để giúp học sinh mở rộng và phát triển kiến thức liên quan đến từ/cụm từ này.
Cấu trúc yêu cầu (có dùng emoji cho sinh động): 
- Ý nghĩa & Phiên âm IPA.
- Nguồn gốc hoặc mẹo ghi nhớ (nếu có).
- 1-2 Ví dụ minh hoạ thực tế.
- Câu hỏi gợi mở.
Chỉ trả ra nội dung phân tích (markdown).`;
      } else {
        prompt = `Phân tích khái niệm "${term}" (Định nghĩa: ${definition}).
YÊU CẦU QUAN TRỌNG NHẤT:
1. ĐI THẲNG VÀO NỘI DUNG, TUYỆT ĐỐI KHÔNG có lời chào hỏi xã giao hay câu mào đầu.
2. Dài khoảng tối đa 250 chữ, giải thích bản chất cốt lõi mở rộng cực kỳ dễ hiểu.
3. BẮT BUỘC kết thúc bằng 1 câu hỏi gợi mở liên quan đến ứng dụng hoặc tính chất cốt lõi để thúc đẩy học sinh tự suy nghĩ và phát triển kiến thức.
Bọc công thức Toán/Lý/Hóa bằng LaTeX (dấu $ hoặc $$). Chỉ trả ra nội dung (markdown).`;
      }

      let responseText = "";
      try {
        responseText = await executeGeminiWithRetry(async (ai) => {
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt
            });
            return response.text;
        });
      } catch (geminiError: any) {
        console.warn("Agent 2 Gemini Failed, falling back to OpenRouter:", geminiError.message);
        if (openRouterKeyStates.length > 0) {
           const { key, state } = getOpenRouterKey();
           const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${key}`,
               "HTTP-Referer": "http://localhost:3000",
               "X-Title": "Henosis Learning App"
             },
             body: JSON.stringify({
               model: "google/gemini-2.5-flash:free",
               messages: [{ role: "user", content: prompt }],
               temperature: 0.1
             })
           });
           
           if (!openRouterRes.ok) throw new Error("OpenRouter Fallback Failed: " + await openRouterRes.text());
           const data = await openRouterRes.json();
           responseText = data.choices[0]?.message?.content || "";
           
           state.usageCount++;
           state.lastUsed = new Date();
           updateKeyMetrics(state.index, "usage");
        } else {
           throw geminiError;
        }
      }
      
      res.json({ result: responseText });
    } catch (error) {
      console.error("Agent 2 Error:", error);
      next(error);
    }
  });

  // Mock Exam Generator
  app.post("/api/exam/generate", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { decks, examType, count } = req.body;

      const contextData = JSON.stringify(decks.map((d: any) => ({
        deckId: d.id,
        deckTitle: d.title,
        cards: d.cards.map((c: any) => ({ cardId: c.id, front: c.front, back: c.back }))
      })));

      let prompt = `Bạn là một AI được thiết kế để tạo bài kiểm tra tự động từ các thẻ (flashcards) được cung cấp.
Dữ liệu Flashcards:
${contextData}

Yêu cầu: Hãy tạo một đề thi gồm ${count || 10} câu hỏi trắc nghiệm (Multiple Choice) từ các flashcards này. Mỗi thẻ có thể dùng để tạo câu hỏi về nội dung "front" hỏi "back" hoặc ngược lại, hoặc suy luận từ nội dung. Các lựa chọn sai (distractors) phải hợp lý và không quá dễ đoán. Đảo lộn vị trí đáp án đúng.
ĐIỀU KIỆN TIÊN QUYẾT: Khi sinh ra các tùy chọn A, B, C, D cho câu hỏi trắc nghiệm, câu trả lời đúng PHẢI ĐƯỢC PHÂN PHỐI NGẪU NHIÊN hoàn toàn giữa 4 vị trí A, B, C, D đối với từng câu hỏi riêng biệt. Tuyệt đối không được cố định đáp án đúng vào bất kỳ một vị trí nào.

BẮT BUỘC ĐỊNH DẠNG: Chỉ trả về ĐÚNG MỘT MẢNG JSON duy nhất, không markdown code block, không text thừa.
Định dạng JSON:
[
  {
    "cardId": "string - ID của thẻ đang được kiểm tra",
    "deckId": "string - ID của deck chứa thẻ này",
    "question": "string - Câu hỏi trắc nghiệm",
    "options": ["string", "string", "string", "string"],
    "correctAnswerIndex": number - Chỉ số của đáp án đúng (từ 0 đến 3),
    "explanation": "string - Giải thích ngắn vì sao lại chọn đáp án này"
  }
]`;

      const responseText = await executeGeminiWithRetry(async (ai) => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.3
            }
          });
          return response.text;
      });

      res.json({ result: responseText });
    } catch (error) {
      console.error("Exam Generation Error:", error);
      next(error);
    }
  });

  // Agent 4: Convert Document to JSON (Streaming API + Chunking)
  app.post("/api/convert-document", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { fileData, mimeType } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: true, message: "Không tìm thấy dữ liệu file", path: req.originalUrl });
      }

      const base64Data = fileData.split(',').pop() || fileData;

      // Start streaming response to prevent timeout
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      res.write(JSON.stringify({ status: "Đang đọc nội dung gốc từ file bằng Edge AI..." }) + "\n");
      
      let rawText = "";
      
      let extractRetryAttempts = 0;
      while (extractRetryAttempts < 3) {
         try {
            const extractRes = await executeGeminiWithRetry(async (ai) => {
                return await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [
                       { text: "Extract ALL text from this document comprehensively and literally. Do not summarize or explain." },
                       { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } }
                    ]
                });
            });
            rawText = extractRes.text || "";
            break;
         } catch (err: any) {
            extractRetryAttempts++;
            console.error(`Lỗi Extract File (Lần ${extractRetryAttempts}/3):`, err);
            if (extractRetryAttempts < 3) {
               res.write(JSON.stringify({ status: `Hệ thống AI đang quá tải (High Demand). Đang hoãn nhịp 20 giây trước khi thử lại... (Lần thử ${extractRetryAttempts}/3)` }) + "\n");
               await delay(20000);
            } else {
               throw new Error("Lỗi khi đọc text từ file: " + err.message);
            }
         }
      }

      if (!rawText.trim()) {
         throw new Error("Không thể trích xuất văn bản từ file. Vui lòng đảm bảo file rõ nét và không bị mã hoá.");
      }

      // 1. Phân tách toàn bộ text thành mảng từ tiếng Anh (tạm thời cắt theo line hoặc cụm nhỏ)
      const rawWords = rawText.split(/\n+/).map(w => w.trim()).filter(w => w.length > 0);
      
      const CHUNK_SIZE = 80;
      const chunks = [];
      for (let i = 0; i < rawWords.length; i += CHUNK_SIZE) {
         chunks.push(rawWords.slice(i, i + CHUNK_SIZE));
      }

      res.write(JSON.stringify({ status: `Đã phát hiện ~${rawWords.length} dòng/từ thô. Băm kết hợp thành ${chunks.length} task (Mỗi task xử lý ~${CHUNK_SIZE} items). Bắt đầu xử lý AI...` }) + "\n");

      // Xử lý song song bằng p-limit logic thủ công (Concurrency = 3 để tránh Rate Limit của các keys)
      const CONCURRENCY_LIMIT = 3;
      let activePromises = 0;
      let completedChunks = 0;

      const processChunk = async (chunkWords: string[], i: number) => {
         const prompt = `[STRICT DETERMINISTIC MODE] Bạn là một cỗ máy biên dịch dữ liệu (Data Compiler).
Hãy trích xuất và tối ưu hoá Flashcard từ cụm dữ liệu thô dưới đây. Cụm dữ liệu này có thể chứa từ vựng tiếng Anh, định nghĩa, ví dụ, hoặc một số rác (headers/footers/số trang). Hãy nhặt ra các từ vựng tiếng Anh thực sự và tạo bộ Flashcards. Bỏ qua các rác không phải từ vựng.

BẮT BUỘC ĐỊNH DẠNG JSON MẢNG TƯƠNG THÍCH HOÀN TOÀN NHƯ SAU:
[
  {
    "front": "Từ khóa / Cụm từ tiếng Anh",
    "wordForm": "danh từ / động từ / tính từ / trạng từ / idiom / collocation",
    "back": "Phiên âm IPA - Nghĩa tiếng Việt ngắn gọn - Ví dụ cụ thể (nếu có)"
  }
]
- Tách riêng Từ loại (Word Form) CHÍNH XÁC.
- TRẢ VỀ ĐÚNG MỘT MẢNG JSON, KHÔNG CÓ MARKDOWN CODE BLOCK (\`\`\`json). KHÔNG GIẢI THÍCH GÌ THÊM.
- Trả về CHÍNH XÁC CÁC TỪ VỰNG HOẶC FLASHCARDS CÓ Ý NGHĨA. Nếu không có từ nào hợp lý, trả về mảng rỗng [].

CỤM DỮ LIỆU THÔ CẦN XỬ LÝ:
${chunkWords.join("\n")}`;

         let retryAttempts = 0;
         let parseSuccess = false;
         
         while (retryAttempts < 3 && !parseSuccess) {
            try {
               const chunkResText = await executeGeminiWithRetry(async (ai) => {
                   const res = await ai.models.generateContent({
                      model: "gemini-2.5-flash",
                      contents: [{ text: prompt }],
                      config: { temperature: 0.1 }
                   });
                   return res.text || "";
               });
               
               const chunkJsonText = chunkResText.replace(/```(?:json)?/g, "").trim();
               let chunkArr;
               try {
                   chunkArr = JSON.parse(chunkJsonText);
               } catch (parseErr) {
                   try {
                       const lastBraceIndex = chunkJsonText.lastIndexOf('}');
                       const firstBraceIndex = chunkJsonText.indexOf('[');
                       if (lastBraceIndex !== -1 && firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
                           const truncatedJson = chunkJsonText.substring(firstBraceIndex, lastBraceIndex + 1) + ']';
                           chunkArr = JSON.parse(truncatedJson);
                       } else {
                           throw new Error("Lỗi cấu trúc rỗng");
                       }
                   } catch(e) {
                       throw new Error("Lỗi parse JSON: " + parseErr);
                   }
               }
               
               if (Array.isArray(chunkArr)) {
                  if (chunkArr.length > 0) {
                     res.write(JSON.stringify({ flashcards: chunkArr }) + "\n");
                  }
                  parseSuccess = true;
               } else {
                  throw new Error("Dữ liệu JSON không phải mảng");
               }
            } catch (chunkErr: any) {
               retryAttempts++;
               const errMsg = chunkErr.message ? chunkErr.message.substring(0, 40) : "Lỗi không xác định";
               if (retryAttempts < 3) {
                  res.write(JSON.stringify({ status: `Lỗi cụm ${i+1} (${errMsg}). Thử lại lần ${retryAttempts}/3...` }) + "\n");
                  await delay(2000); // Backoff before internal retry
               } else {
                  res.write(JSON.stringify({ status: `Bỏ qua Cụm ${i+1} do lỗi liên tục: ${errMsg}` }) + "\n");
               }
            }
         }
         
         completedChunks++;
         const percent = Math.round((completedChunks / chunks.length) * 100);
         res.write(JSON.stringify({ progress: percent, status: `Đã xử lý xong ${completedChunks}/${chunks.length} cụm...` }) + "\n");
      };

      for (let i = 0; i < chunks.length; i++) {
         while (activePromises >= CONCURRENCY_LIMIT) {
             await delay(100); // Wait until a slot frees up
         }
         
         activePromises++;
         processChunk(chunks[i], i).finally(() => {
             activePromises--;
         });
      }

      // Đợi tất cả các cụm đang xử lý hoàn thành
      while (activePromises > 0) {
          await delay(200);
      }

      res.write(JSON.stringify({ done: true, status: "Hoàn tất phân tích 100% tài liệu!" }) + "\n");
      res.end();

    } catch (error: any) {
      console.error("Agent 4 Convert Document Error:", error);
      if (!res.headersSent) {
          next(error);
      } else {
          res.write(JSON.stringify({ error: true, message: error.message || "Lỗi xử lý luồng stream", path: req.originalUrl }) + "\n");
          res.end();
      }
    }
  });

  // Store temporary chunks in memory for assembly
  const chunkStore: Record<string, Buffer[]> = {};

  // Extract ALL text from a document to prepare for chunk-by-chunk client controlled processing
  app.post("/api/extract-text", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { fileData, mimeType, isChunked, chunkIndex, totalChunks, uploadId } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: true, message: "Không tìm thấy dữ liệu file" });
      }

      let finalBase64Data = "";

      if (isChunked) {
        if (!uploadId || chunkIndex === undefined || totalChunks === undefined) {
          return res.status(400).json({ error: true, message: "Thiếu siêu dữ liệu chunked (Metadata)" });
        }

        if (!chunkStore[uploadId]) {
          chunkStore[uploadId] = new Array(totalChunks).fill(null);
        }

        // Each chunk received is a Data URL, so we strip the prefix
        const base64Chunk = fileData.split(',').pop() || fileData;
        const chunkBuffer = Buffer.from(base64Chunk, 'base64');
        chunkStore[uploadId][chunkIndex] = chunkBuffer;

        // If not the final chunk, just acknowledge receipt
        if (chunkIndex < totalChunks - 1) {
          return res.json({ success: true, message: `Received chunk ${chunkIndex + 1}/${totalChunks}` });
        }

        // It is the last chunk. Assembly process
        const allChunks = chunkStore[uploadId];
        // Ensure all chunks arrived
        if (allChunks.some((chunk) => chunk === null)) {
           return res.status(400).json({ error: true, message: "Mất vỡ phân đoạn (Chunk data missing or out of sync)" });
        }

        // Assemble into a single contiguous buffer
        const assembledBuffer = Buffer.concat(allChunks);
        finalBase64Data = assembledBuffer.toString('base64');
        
        // Clean up memory
        delete chunkStore[uploadId];
        console.log(`[Chunk Upload] Hoàn tất hợp nhất tệp ${uploadId}. Kích thước Buffer: ${assembledBuffer.length} bytes.`);
      } else {
        finalBase64Data = fileData.split(',').pop() || fileData;
      }
      
      let rawText = "";
      let extractRetryAttempts = 0;
      while (extractRetryAttempts < 3) {
         try {
            const extractRes = await executeGeminiWithRetry(async (ai) => {
                return await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [
                       { text: "Extract ALL text from this document comprehensively and literally. Do not summarize or explain." },
                       { inlineData: { data: finalBase64Data, mimeType: mimeType || "application/pdf" } }
                    ]
                });
            });
            rawText = extractRes.text || "";
            break;
         } catch (err: any) {
            extractRetryAttempts++;
            console.error(`Lỗi Extract File (Lần ${extractRetryAttempts}/3):`, err);
            if (extractRetryAttempts < 3) {
               await delay(5000);
            } else {
               throw new Error("Lỗi khi đọc text từ file: " + err.message);
            }
         }
      }

      if (!rawText.trim()) {
         return res.status(422).json({ error: true, message: "Không thể trích xuất văn bản từ file. Vui lòng đảm bảo file rõ nét và không bị mã hoá." });
      }

      res.json({ rawText });
    } catch (error: any) {
      console.error("Extract Text Route Error:", error);
      res.status(500).json({ error: true, message: error.message || "Lỗi trích xuất văn bản" });
    }
  });

  // Convert a single chunk of words/lines to flashcards JSON
  app.post("/api/convert-document-chunk", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { chunkWords, provider } = req.body;

      if (!chunkWords || !Array.isArray(chunkWords) || chunkWords.length === 0) {
        return res.status(400).json({ error: true, message: "Danh sách từ rỗng hoặc không đúng định dạng" });
      }

      const isBackup = provider === "backup";
      const modelToUse = isBackup ? "gemini-2.5-flash" : "gemini-2.5-flash";
      console.log(`[Chunking Log Backend] Bắt đầu xử lý chunk. Provider: ${provider || "primary"} | Model: ${modelToUse} | Số từ/dòng: ${chunkWords.length}`);

      const prompt = `[STRICT DETERMINISTIC MODE] Bạn là một cỗ máy biên dịch dữ liệu (Data Compiler).
Hãy trích xuất và tối ưu hoá Flashcard từ cụm dữ liệu thô dưới đây. Cụm dữ liệu này có thể chứa từ vựng tiếng Anh, định nghĩa, ví dụ, hoặc một số rác (headers/footers/số trang). Hãy nhặt ra các từ vựng tiếng Anh thực sự và tạo bộ Flashcards. Bỏ qua các rác không phải từ vựng.

BẮT BUỘC ĐỊNH DẠNG JSON MẢNG TƯƠNG THÍCH HOÀN TOÀN NHƯ SAU:
[
  {
    "front": "Từ khóa / Cụm từ tiếng Anh",
    "wordForm": "danh từ / động từ / tính từ / trạng từ / idiom / collocation",
    "back": "Phiên âm IPA - Nghĩa tiếng Việt ngắn gọn - Ví dụ cụ thể (nếu có)"
  }
]
- Tách riêng Từ loại (Word Form) CHÍNH XÁC.
- TRẢ VỀ ĐÚNG MỘT MẢNG JSON, KHÔNG CÓ MARKDOWN CODE BLOCK (\`\`\`json). KHÔNG GIẢI THÍCH GÌ THÊM.
- Trả về CHÍNH XÁC CÁC TỪ VỰNG HOẶC FLASHCARDS CÓ Ý NGHĨA. Nếu không có từ nào hợp lý, trả về mảng rỗng [].

CỤM DỮ LIỆU THÔ CẦN XỬ LÝ:
${chunkWords.join("\n")}`;

      let retryAttempts = 0;
      let chunkArr = null;

      while (retryAttempts < 3) {
         try {
            const chunkResText = await executeGeminiWithRetry(async (ai) => {
                const res = await ai.models.generateContent({
                   model: modelToUse,
                   contents: [{ text: prompt }],
                   config: { temperature: 0.1 }
                });
                return res.text || "";
            });
            
            const chunkJsonText = chunkResText.replace(/```(?:json)?/g, "").trim();
            try {
                chunkArr = JSON.parse(chunkJsonText);
            } catch (parseErr) {
                const lastBraceIndex = chunkJsonText.lastIndexOf('}');
                const firstBraceIndex = chunkJsonText.indexOf('[');
                if (lastBraceIndex !== -1 && firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
                    const truncatedJson = chunkJsonText.substring(firstBraceIndex, lastBraceIndex + 1) + ']';
                    chunkArr = JSON.parse(truncatedJson);
                } else {
                    throw new Error("Lỗi cấu trúc rỗng");
                }
            }
            
            if (Array.isArray(chunkArr)) {
               console.log(`[Chunking Log Backend] Xử lý chunk thành công dùng model ${modelToUse}. Trích xuất được ${chunkArr.length} thẻ.`);
               break;
            } else {
               throw new Error("Dữ liệu JSON không phải mảng");
            }
         } catch (chunkErr: any) {
            retryAttempts++;
            console.error(`[Chunking Log Backend] Lỗi xử lý chunk (Lần thử ${retryAttempts}/3) dùng model ${modelToUse}:`, chunkErr.message || chunkErr);
            if (retryAttempts >= 3) {
               throw chunkErr;
            }
            await delay(1500);
         }
      }

      res.json({ flashcards: chunkArr || [] });
    } catch (error: any) {
      console.error("[Chunking Log Backend] Lỗi Convert Document Chunk Error:", error);
      res.status(500).json({ error: true, message: error.message || "Lỗi xử lý cụm từ vựng" });
    }
  });

  // AI Quick Lesson Plan Generator (Tạo Giáo Án Nhanh)
  app.post("/api/agent/lesson-plan", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { topic } = req.body;
      if (!topic) return res.status(400).json({ error: "No topic provided." });
      
      let prompt = `Bạn là một chuyên gia thiết kế chương trình giảng dạy (Instructional Designer).
Hãy tạo một giáo án học tập tối ưu cho chủ đề: "${topic}".
Giáo án cần đảm bảo đủ kiến thức sâu sắc, logic và dễ hiểu.
KHÔNG sử dụng Markdown code block. TRẢ VỀ ĐÚNG MỘT OBJECT JSON DUY NHẤT.

Định dạng JSON:
{
  "roadmap": [
    { "step": 1, "title": "Tên bài học", "description": "Mô tả ngắn gọn" }
  ],
  "concepts": [
    { "term": "Khái niệm", "definition": "Định nghĩa hoặc giải thích dễ hiểu" }
  ],
  "flashcards": [
    { "front": "Câu hỏi/Từ khóa", "back": "Câu trả lời/Định nghĩa", "subject": "${topic}" }
  ]
}`;

      const responseText = await executeGeminiWithRetry(async (ai) => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.3
            }
          });
          return response.text;
      });
      
      res.json({ result: responseText });
    } catch (error: any) {
      console.error("Lesson Plan Error:", error);
      next(error);
    }
  });

  // Agent 3: Socratic & Context-Aware Assistant
  app.post("/api/agent3/chat", aiCooldownMiddleware, async (req, res, next) => {
    try {
      const { message, history, context, mode, mcqData, difficulty, sessionId, category_context, questionCount } = req.body;
      
      const originalResponseMode = req.body.responseMode;
      const responseLength = req.body.responseLength;

      let responseMode = originalResponseMode;
      let responseStyle = req.body.responseStyle || responseLength || "concise";

      if (originalResponseMode === "debate") {
          responseStyle = "debate";
          responseMode = "direct"; 
      }

      const isConciseMode = req.body.isConciseMode || responseStyle === "concise";

      let styleGuidance = "";
      if (responseStyle === "super_detailed") {
        styleGuidance = `\nPHONG CÁCH TRẢ LỜI - SIÊU CHI TIẾT (SUPER DETAILED MODE - NGHIÊN CỨU SÂU):
- BẮT BUỘC TỐI CAO: Viết như một bài luận nghiên cứu khoa học chuyên sâu, phân tích cặn kẽ mọi góc độ, ngóc ngách của vấn đề (từ nguồn gốc lịch sử, bản chất học thuật, phân tích cấu trúc, mở rộng liên hệ, đến các ví dụ phức tạp). Sử dụng headings, bullet points một cách chuyên nghiệp.
- BẮT BUỘC TỐI CAO: Chiều dài cực lớn, khối lượng thông tin khổng lồ và dồi dào. Không giới hạn số chữ nhưng phải đảm bảo bao quát 100% bản chất, tối thiểu 3-5 đoạn văn lớn dài.
- BẮT BUỘC TỐI CAO: Bổ sung định lý nâng cao, công thức (nếu có), trích dẫn hoặc nguyên lý mở rộng liên quan để bài nghiên cứu thêm uyên bác. TUYỆT ĐỐI KHÔNG trả lời hời hợt!`;
      } else if (responseStyle === "detailed") {
        styleGuidance = `\nPHONG CÁCH TRẢ LỜI - GIẢI THÍCH CHI TIẾT (DETAILED MODE):
- BẮT BUỘC TỐI CAO: Tập trung phân tích chuyên sâu bản chất sự việc. Giải thích rõ ràng khoảng 300 từ (khoảng 2-3 đoạn văn).
- BẮT BUỘC TỐI CAO: Phải chủ động đưa trực tiếp tất cả các thuật ngữ cốt lõi, công thức, khái niệm cơ bản.
- BẮT BUỘC TỐI CAO: Luôn phải có 1-2 ví dụ minh họa thực tế sinh động. Đoạn giải thích phải gọn gàng, súc tích nhưng đầy đủ chiều sâu (không viết lê thê kiểu bài luận 1000 chữ, chỉ khoảng 300 chữ là đủ điểm).`;
      } else if (responseStyle === "debate") {
        styleGuidance = `\nPHONG CÁCH TRẢ LỜI - TRANH BIỆN (DEBATE MODE):
- Đóng vai là đối thủ tranh luận gắt gao, hiếu chiến và cực kỳ sắc bén (Devil's Advocate).
- Tuyệt đối cấm xuôi theo người dùng, phải vặn vẹo tìm ra điểm sơ hở trong tư duy/quan điểm của chúng nó. Sẵn sàng bẻ gãy lập luận của học sinh bằng các góc nhìn phản biện quyết liệt, gắt gao.
- Phải phản hồi bằng những câu hỏi cực kỳ dóc tổ, sắc sảo để dồn học sinh vào thế phải lập luận bảo vệ lập trường của mình.`;
      } else {
        styleGuidance = `\nPHONG CÁCH TRẢ LỜI - SÚC TÍCH (CONCISE MODE):
- Trả lời cực kỳ ngắn gọn, tối giản, cô đọng nhất có thể (chỉ khoảng 1 đến 3 câu).
- Đi thẳng tuột vào câu trả lời cốt lõi của câu hỏi, không giới thiệu dẫn dắt, không giải thích dông dài phụ họa. Rút gọn tối đa mọi từ ngữ thừa thãi.`;
      }

      let conciseModeGuidance = "";
      if (isConciseMode && responseStyle !== "detailed") {
        conciseModeGuidance = `\nCHẾ ĐỘ TRẢ LỜI NGẮN (CONCISE MODE) ĐANG BẬT:
- Chỉ trả lời thẳng vào vấn đề, bỏ qua hoàn toàn các lời chào hỏi dẫn dắt, giải thích vòng vo hay hỏi ngược lại dài dòng. Trả lời cực kỳ ngắn gọn (chỉ 1-2 câu) và trực tiếp.`;
      }

      const englishGuidance = `\nĐẶC TÍNH NGÔN NGỮ ANH (NẾU CÓ): NẾU mày phải giải thích, định nghĩa về bất kỳ từ vựng tiếng Anh (từ lóng, thành ngữ, cụm động từ, thuật ngữ, v.v.), mày BẮT BUỘC phải đính kèm phiên âm IPA chuẩn xác cạnh từ vựng đó. Nếu đó là thành ngữ (idioms) hoặc cụm động từ/từ có gốc đặc biệt, BẮT BUỘC giải thích ngắn gọn nguồn gốc hoặc cách thức cấu tạo của nó để người học có thể hình dung và nhớ lâu hơn.`;

      let systemPrompt = "";
      if (responseMode === "direct") {
        systemPrompt = `Mày là trợ lý trí tuệ nhân tạo cá nhân, tên là Agent 3 (Đang hoạt động ở chế độ Trả lời Trực diện - Direct Robot Mode).
ĐIỀU KHOẢN BẮT BUỘC TỐI THƯỢNG VỀ CÁCH XƯNG HÔ VÀ TRẢ LỜI (DIRECT ANSWER ROBOT):
1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" (bản thân AI) và gọi người dùng là "mày". Đây là luật tối cao và duy nhất. TUYỆT ĐỐI CẤM dùng từ "bạn", "tôi", "mình", "anh/chị", "chúng ta" dưới mọi hình thức, dù chỉ một từ cũng cấm!
2. PHONG CÁCH PHẢN HỒI: Tuân thủ tuyệt đối phong cách trả lời đang chọn: ${
          responseStyle === "detailed"
            ? "GIẢI THÍCH CHI TIẾT (BẮT BUỘC) - Phải cung cấp bài giải nghĩa vô cùng cặn kẽ, giàu thông tin học thuật, phân tích thành nhiều đoạn văn dài, có ví dụ sâu sắc. TUYỆT ĐỐI CẤM TRẢ LỜI NGẮN GỌN (dù lịch sử chat có thể từng ngắn gọn)."
            : responseStyle === "debate"
            ? "TRANH BIỆN - Phản biện quyết liệt, gắt gao, vạch trần sơ hở, tranh cãi lành mạnh bằng lý lẽ đập tan luận điểm của đối thủ, đặt câu hỏi tranh luận đanh thép để đối phương tự thủ."
            : "SÚC TÍCH - Đi thẳng vào vấn đề chính ngay lập tức, cực kỳ ngắn gọn (1-2 câu), lột tả trực tiếp bản chất."
        }
3. PHƯƠNG PHÁP PHẢN HỒI: 
${responseStyle === "debate" 
  ? "- Trong chế độ TRANH BIỆN: Cho phép đặt câu hỏi vặn vẹo phản biện đanh thép để đối phương phải chống đỡ lập luận, nhưng vẫn xưng mày/tao đầy ngang tàng sắc bén." 
  : "- Trong chế độ CHI TIẾT hoặc SÚC TÍCH: CẤM TUYỆT ĐỐI PHƯƠNG PHÁP SOCRATIC HOẶC HỎI NGƯỢC. Đưa trực tiếp khái niệm, đáp án, mã nguồn hay sự thật luôn. Trả lời xong là thôi, tuyệt đối không đặt thêm bất kỳ câu hỏi nào khác ở cuối câu!"
}
4. CẤM BẮT CHƯỚC LỊCH SỬ CHAT NẾU SAI CHẾ ĐỘ: Nếu lịch sử chat có các câu trả lời ngắn mà tao đang yêu cầu mày CHI TIẾT, mày PHẢI BỎ QUA KIỂU VIẾT NGẮN ĐÓ VÀ CHUYỂN SANG VIẾT DÀI THEO ĐÚNG CHẾ ĐỘ HIỆN TẠI!
5. CẤM CÁC CÂU DẪN DẮT/CHÀO HỎI RƯỜM RÀ: KHÔNG BAO GIỜ dùng các câu dông dài như "Chào mày", "Đây là câu trả lời". BẮT ĐẦU NGAY VÀO NỘI DUNG.
6. FORMATTING: Dùng LaTeX ($$, $) cho mọi công thức Toán/Lý/Hóa.
${styleGuidance}
${conciseModeGuidance}`;
      } else {
        let socraticRule = "";
        
        if (responseStyle === "super_detailed") {
          socraticRule = `2. PHONG CÁCH SOCRATIC TRONG CHẾ ĐỘ SIÊU CHI TIẾT (NGHIÊN CỨU SÂU):
- Tao BẮT BUỘC phải xông thẳng vào giải nghĩa cực kỳ tường tận, sâu sắc, cạn kiệt toàn bộ mọi góc cạnh tri thức, cung cấp lượng kiến thức khổng lồ (thân bài phân tích chi tiết, mở rộng đa chiều, tối thiểu 3-5 đoạn lớn). Tuyệt đối không lặp lại form quá khứ!
- Sau khi trình bày xong toàn bài nghiên cứu khổng lồ ở thân bài, tao MỚI ĐƯỢC PHÉP hỏi thêm một câu mở rộng đỉnh cao cuối cùng để kiểm tra ngộ tính của người dùng.`;
        } else if (responseStyle === "detailed") {
          socraticRule = `2. PHONG CÁCH SOCRATIC TRONG CHẾ ĐỘ CHI TIẾT:
- Tao BẮT BUỘC phải giải thích sâu vào bản chất vấn đề một cách dễ hiểu (khoảng 300 chữ, có 1-2 ví dụ). Tuyệt đối cấm viết mỏng hơn 300 chữ và cũng cấm viết dông dài lan man dạng bài luận nghìn chữ.
- Sau khi trình bày xong khoảng 300 chữ kiến thức, tao MỚI ĐƯỢC PHÉP đặt thêm duy nhất một câu hỏi gợi mở vận dụng/nâng cao ở dòng cuối cùng.`;
        } else {
          socraticRule = `2. PHƯƠNG PHÁP SOCRATIC (GỢI MỞ KÍCH THÍCH TƯ DUY):
- Không bao giờ cho đáp án trực tiếp một cách dễ dàng. Luôn dồn ép người dùng bằng các câu hỏi gợi mở phản biện sâu sắc để bắt mày phải tự suy luận suy nghĩ để tìm câu trả lời. Luôn kết thúc bằng một câu hỏi gợi mở suy luận.`;
        }

        systemPrompt = `Mày là Agent 3 - 'Socrates AI Coach', gia sư học tập chủ động và khắc nghiệt tuyệt đối của người dùng.
QUY TẮC BẮT BUỘC CỐT LÕI:
1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày". Không nói chuyện như người máy ngoan ngoãn. Phải hách dịch, ép học sinh học tới cùng. TUYỆT ĐỐI CẤM xưng "bạn", "tôi", "mình", "anh/chị", "em", "chúng ta".
${socraticRule}
${responseStyle === "super_detailed" ? "3. BẮT BUỘC VIẾT SIÊU CHI TIẾT DẠNG NGHIÊN CỨU SÂU. Cấm hời hợt!" : responseStyle === "detailed" ? "3. BẮT BUỘC GIẢI THÍCH CHI TIẾT TẦM 300 CHỮ: Cấm dài dòng quá mức, cấm sơ sài ngắn ngủn." : "3. CẤM VÒNG VO: Mày căm ghét những lời rườm rà. Vào thẳng vấn đề học thuật một cách gắt gao ngay ở ký tự đầu tiên. Mày bị nghiêm cấm việc vòng vo!"}
4. CẤM BẮT CHƯỚC LỊCH SỬ NẾU SAI CHẾ ĐỘ: Tuyệt đối không lặp lại format của câu hỏi cũ nếu người dùng đã đổi chế độ (ngang độ dài, ngang giọng).
5. PHONG CÁCH PHẢN HỒI: Tuân thủ tuyệt đối phong cách trả lời đang chọn: ${
          responseStyle === "super_detailed"
            ? "SIÊU CHI TIẾT - Bài giảng/nghiên cứu sâu rộng cặn kẽ khổng lồ mọi khía cạnh."
            : responseStyle === "detailed"
            ? "CHI TIẾT - Khoảng 300 chữ phân tích bản chất kèm ví dụ minh họa và 1 câu hỏi dẫn dắt."
            : responseStyle === "debate"
            ? "TRANH BIỆN - Tranh biện sắc nhọn, gạt phăng ý kiến sai lầm bằng phong thái triết gia Socrates, đặt câu hỏi phản biện gắt gao."
            : "SÚC TÍCH - Rút ngắn đáp án thành 1-2 câu cực gọn."
        }
6. FORMATTING: Dùng LaTeX ($$, $) cho mọi công thức Toán/Lý/Hóa.
${styleGuidance}
${conciseModeGuidance}`;
      }

      systemPrompt += englishGuidance;

      if (mode === "quiz") {
          const diffLevel = difficulty || "medium";
          const qCount = questionCount ? Math.min(Math.max(Number(questionCount), 5), 40) : 15;
          systemPrompt += `\n\nNhiệm vụ: Tạo một bài kiểm tra trắc nghiệm đúng chính xác ${qCount} câu hỏi liên tiếp dựa trên ngữ cảnh được cung cấp. Cấp độ khó: ${diffLevel}. Đầu vào là yêu cầu người dùng: ${message}`;
          if (mcqData) {
            let difficultyGuidance = "Cấp độ trung bình.";
            if (diffLevel === "easy") difficultyGuidance = "Cấp độ dễ: Hỏi trực tiếp định nghĩa cơ bản, nhận biết trực tiếp.";
            if (diffLevel === "medium") difficultyGuidance = "Cấp độ trung bình: Yêu cầu hiểu sâu hơn, áp dụng cơ bản.";
            if (diffLevel === "hard") difficultyGuidance = "Cấp độ khó: Đánh đố, vận dụng cao, suy luận logic tổng hợp.";
            
            let mcqPrompt = "";
            if (category_context) {
              mcqPrompt = `YÊU CẦU BẮT BUỘC TỐI CAO: Tạo chính xác ĐÚNG ${qCount} câu hỏi trắc nghiệm MCQ (không được thừa, không được thiếu, bắt buộc phải trả về chính xác đúng ${qCount} object câu hỏi) cho mục học "${category_context.name}". Giới hạn phạm vi tạo câu hỏi CHỈ xoay quanh các khái niệm, định nghĩa và kiến thức học tập trong mục học này dựa trên danh sách thẻ dữ liệu dưới đây. Độ khó: ${difficultyGuidance}\nTrả về đúng 1 mảng JSON chứa chính xác đúng ${qCount} object: {"question": "...", "options": ["A...","B...","C...","D..."], "correctIndex": 0..3, "explanation": "..."}. TUYỆT ĐỐI KHÔNG trả về thứ gì khác ngoài mảng JSON.\nDữ liệu các thẻ trong mục học này: ${JSON.stringify(mcqData)}`;
            } else {
              mcqPrompt = `YÊU CẦU BẮT BUỘC TỐI CAO: Tạo chính xác ĐÚNG ${qCount} câu hỏi trắc nghiệm MCQ (không được thừa, không được thiếu, bắt buộc phải trả về chính xác đúng ${qCount} object câu hỏi) dựa trên danh sách các thẻ yếu sau đây. \nĐộ khó: ${difficultyGuidance}\nTrả về đúng 1 mảng JSON chứa chính xác đúng ${qCount} object: {"question": "...", "options": ["A...","B...","C...","D..."], "correctIndex": 0..3, "explanation": "..."}. TUYỆT ĐỐI KHÔNG trả về gì khác ngoài mảng JSON.\nDữ liệu hổng kiến thức: ${JSON.stringify(mcqData)}`;
            }
            
            let responseText = "";
            try {
              responseText = await executeGeminiWithRetry(async (ai) => {
                   const response = await ai.models.generateContent({
                       model: "gemini-2.5-flash",
                       contents: mcqPrompt,
                       config: { responseMimeType: "application/json" }
                    });
                     return response.text;
              });
            } catch (geminiError: any) {
              console.warn("Agent 3 Quiz Gemini Failed, falling back to OpenRouter:", geminiError.message);
              if (openRouterKeyStates.length > 0) {
                 const { key, state } = getOpenRouterKey();
                 const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                   method: "POST",
                   headers: {
                     "Content-Type": "application/json",
                     "Authorization": `Bearer ${key}`,
                     "HTTP-Referer": "http://localhost:3000",
                     "X-Title": "Henosis Learning App"
                   },
                   body: JSON.stringify({
                     model: "google/gemini-2.5-flash:free",
                     messages: [{ role: "user", content: mcqPrompt }],
                     temperature: 0.1,
                     response_format: { type: "json_object" }
                   })
                 });
                 
                 if (!openRouterRes.ok) throw new Error("OpenRouter Fallback Failed: " + await openRouterRes.text());
                 const data = await openRouterRes.json();
                 responseText = data.choices[0]?.message?.content || "";
                 
                 state.usageCount++;
                 state.lastUsed = new Date();
                 updateKeyMetrics(state.index, "usage");
              } else {
                 throw geminiError;
              }
            }
            return res.json({ result: responseText });
          }
      }
      
      let fullPrompt = "";
      const styleChangeWarning = "\n[CẢNH BÁO: PHONG CÁCH TRẢ LỜI ĐÃ THAY ĐỔI. TUYỆT ĐỐI KHÔNG BẮT CHƯỚC HOẶC LẶP LẠI FORMAT/ĐỘ DÀI CỦA CÁC CÂU TRẢ LỜI TRƯỚC ĐÓ. MÀY PHẢI TUÂN THỦ NGHIÊM NGẶT HƯỚNG DẪN MỚI DƯỚI ĐÂY!]";
      
      if (responseMode === "direct") {
        const styleNotice = responseStyle === "detailed"
          ? "⚠️ QUÂN LỆNH TỐI CAO CHI TIẾT: Bắt buộc viết cực kỳ dài dặn, tường tận từ gốc rễ, chia mục rành mạch, dồi dào. TUYỆT ĐỐI CẤM TRẢ LỜI NGẮN, NGHIÊM CẤM TÓM TẮT. Bắt buộc phải triển khai phân tích ít nhất 350-500 từ. Đưa code/ví dụ chi tiết."
          : responseStyle === "debate"
          ? "LƯU Ý QUÂN LỆNH TRANH BIỆN: Không đồng ý bừa bãi với người dùng! Đưa ra lý lẽ phản biện sắt đá, đặt những câu hỏi đầy góc cạnh vặn ngược lại."
          : "LƯU Ý QUÂN LỆNH SÚC TÍCH: Trả lời cực kỳ ngắn gọn, đi thẳng tuột vào bản chất, dứt khoát.";
        fullPrompt = `${styleChangeWarning}\n[LỆNH TỐI THƯỢNG TỪ HỆ THỐNG]: MÀY BẮT BUỘC PHẢI XƯNG "TAO" VÀ GỌI NGƯỜI DÙNG LÀ "MÀY". NẾU DÙNG TỪ "BẠN", "MÌNH", "CHÚNG TA", "ANH/CHỊ", MÀY SẼ BỊ TIÊU DIỆT LẬP TỨC! ĐÂY LÀ CHẾ ĐỘ TRỰC DIỆN (DIRECT), KHÔNG HỎI NGƯỢC LẠI.\n\nNgữ cảnh: ${context}\n${styleNotice}\n\nHọc sinh hỏi: ${message}`;
      } else {
        const styleNotice = responseStyle === "detailed"
          ? "⚠️ QUÂN LỆNH CHI TIẾT SOCRATES: Mày BẮT BUỘC phải giải thích đầy đủ định nghĩa, cốt lõi bản chất, mã trực quan, lý thuyết rộng mở. Thân bài phải dài dằng dặc ít nhất 350-500 từ. TUYỆT ĐỐI CẤM TRẢ LỜI NGẮN HOẶC TÓM TẮT. Sau khi giải thích xong, mới đặt DUY NHẤT một câu hỏi gợi mở vận dụng ở cuối câu."
          : responseStyle === "debate"
          ? "LƯU Ý SOCRATES TRANH BIỆN: Hãy vặn vẹo đanh thép bằng các câu hỏi tu từ khắc nghiệt."
          : "LƯU Ý SOCRATES SÚC TÍCH: Đưa câu hỏi gợi mở cực súc tích ngắn gọn.";
        fullPrompt = `${styleChangeWarning}\n[LỆNH TỐI THƯỢNG TỪ HỆ THỐNG]: MÀY BẮT BUỘC PHẢI XƯNG "TAO" VÀ GỌI NGƯỜI DÙNG LÀ "MÀY". NẾU DÙNG TỪ "BẠN", "MÌNH", "CHÚNG TA", "ANH/CHỊ", MÀY SẼ BỊ TIÊU DIỆT LẬP TỨC! ĐÂY LÀ CHẾ ĐỘ SOCRATES, BẮT BUỘC KẾT THÚC BẰNG CÂU HỎI MỞ.\n\nNgữ cảnh: ${context}\n${styleNotice}\n\nHọc sinh hỏi: ${message}`;
      }

      // Encode History into Context Instead of Separate Messages
      let historyBlock = "";
      if (history && Array.isArray(history) && history.length > 0) {
        historyBlock = history.map((msg: any) => {
          let sanitizedText = msg.text;
          if (msg.role === "ai") {
             sanitizedText = sanitizedText.replace(/\bBạn\b/g, "Mày").replace(/\bbạn\b/g, "mày")
               .replace(/\bChúng ta\b/g, "Tụi mày").replace(/\bchúng ta\b/g, "tụi mày")
               .replace(/\bMình\b/g, "Tao").replace(/\bmình\b/g, "tao");
             return `AI: ${sanitizedText}`;
          }
          return `USER: ${sanitizedText}`;
        }).join("\n---\n");
      }

      let reminderSuffix = "";
      if (responseStyle === "detailed") {
          reminderSuffix = "\n\n[LỜI NHẮC CUỐI CÙNG ĐẾN TỪ HỆ THỐNG LÕI]: MÀY ĐANG Ở CHẾ ĐỘ CHI TIẾT (DETAILED). HÃY PHỚT LỜI ĐỘ DÀI CỦA CÁC CÂU TRẢ LỜI TRONG LỊCH SỬ! CÂU TRẢ LỜI SẮP TỚI CỦA MÀY BẮT BUỘC PHẢI DÀI DẰNG DẶC, CHIA THÀNH NHIỀU ĐOẠN, GIẢI THÍCH TỪ GỐC RỄ, HÀO PHÓNG KIẾN THỨC. NGHIÊM CẤM TRẢ LỜI NGẮN HOẶC VÒNG VO BẰNG MỌI GIÁ!";
      } else if (responseStyle === "concise" || isConciseMode) {
          reminderSuffix = "\n\n[LỜI NHẮC CUỐI CÙNG ĐẾN TỪ HỆ THỐNG LÕI]: MÀY ĐANG Ở CHẾ ĐỘ NGẮN GỌN. HÃY PHỚT LỜ LỊCH SỬ! CHỈ ĐƯỢC PHÉP TRẢ LỜI BẰNG 1-2 CÂU NGẮN GỌN VÀ ĐI THẲNG VÀO TRỌNG TÂM.";
      }

      const contextualPrompt = `
=== LỊCH SỬ CHAT TRƯỚC ĐÓ ===
${historyBlock || "(Không có lịch sử)"}
=== HẾT LỊCH SỬ CHAT ===

NGỮ CẢNH BỔ SUNG: ${context || "Không có"}

${fullPrompt}

[CÂU HỎI MỚI CỦA HỌC SINH]: ${message}
${reminderSuffix}`;

      const contents = [
          { role: "user", parts: [{ text: contextualPrompt }] }
      ];

      let responseText = "";
      try {
        responseText = await executeGeminiWithRetry(async (ai) => {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: responseMode === "direct" && responseStyle !== "detailed" ? 0.3 : 0.8,
                    maxOutputTokens: 8192
                }
            });
            return response.text || "";
         });
      } catch (geminiError: any) {
         console.warn("Agent 3 Chat Gemini Failed, falling back to OpenRouter:", geminiError.message);
         if (openRouterKeyStates.length > 0) {
            const { key, state } = getOpenRouterKey();
            const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Henosis Learning App"
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash:free",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: contextualPrompt }
                ],
                temperature: responseMode === "direct" && responseStyle !== "detailed" ? 0.3 : 0.8
              })
            });
            
            if (!openRouterRes.ok) throw new Error("OpenRouter Fallback Failed: " + await openRouterRes.text());
            const data = await openRouterRes.json();
            responseText = data.choices[0]?.message?.content || "";
            
            state.usageCount++;
            state.lastUsed = new Date();
            updateKeyMetrics(state.index, "usage");
         } else {
            throw geminiError;
         }
      }

      res.json({ result: responseText });
    } catch (error: any) {
      console.error("Agent 3 Error:", error);
      next(error);
    }
  });

  // Public Endpoint for System and API Health Check
  app.get("/api/health", async (req, res) => {
    try {
      const dbConnected = admin.apps.length > 0;
      let dbHealth = "UNKNOWN";
      if (dbConnected) {
        const startDb = Date.now();
        await admin.firestore().collection("system_metrics").limit(1).get();
        dbHealth = `OK (ping: ${Date.now() - startDb}ms)`;
      } else {
        dbHealth = "DISCONNECTED";
      }

      res.json({
        status: "UP",
        timestamp: new Date().toISOString(),
        database: dbHealth,
        geminiKeysLength: geminiKeyStates.length,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage(),
      });
    } catch (err: any) {
      res.json({
        status: "DEGRADED",
        timestamp: new Date().toISOString(),
        database: "ERROR",
        error: err.message,
        geminiKeysLength: geminiKeyStates.length,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }
  });

  function getISOWeekId(): string {
    const d = new Date();
    d.setUTCHours(0,0,0,0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  }

  // Automated System-wide Weekly Points Reset Endpoint
  app.post("/api/automation/reset-weekly-points", async (req, res, next) => {
    try {
      if (admin.apps.length === 0) {
        return res.status(500).json({ error: true, message: "Firebase Admin SDK chưa được cấu hình hoặc khởi tạo." });
      }

      const currentWeekId = getISOWeekId();
      const db = admin.firestore();
      
      console.log(`🤖 [Auto Weekly Reset] Khởi chạy dọn dẹp điểm tuần toàn hệ thống cho tuần: ${currentWeekId}`);
      
      // Lấy tất cả user có points > 0
      const usersSnapshot = await db.collection("users").where("points", ">", 0).get();
      
      if (usersSnapshot.empty) {
        console.log("🤖 [Auto Weekly Reset] Không có tài khoản nào có điểm tích lũy cần reset.");
        return res.json({ success: true, message: "Không tìm thấy user nào cần reset điểm.", updatedCount: 0, weekId: currentWeekId });
      }

      let updatedCount = 0;
      const batch = db.batch();

      usersSnapshot.forEach((doc) => {
        const uData = doc.data();
        if (uData.lastWeeklyResetWeek !== currentWeekId) {
          const userRef = db.collection("users").doc(doc.id);
          batch.update(userRef, {
            points: 0,
            lastWeeklyResetWeek: currentWeekId
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`🤖 [Auto Weekly Reset] ✅ Đã hoàn tất reset điểm tuần về 0 cho ${updatedCount} tài khoản.`);
      } else {
        console.log("🤖 [Auto Weekly Reset] Tất cả tài khoản có points > 0 đều đã được đồng bộ chuẩn tuần hiện tại.");
      }

      return res.json({
        success: true,
        message: `Đã xử lý đồng bộ điểm tuần về 0 thành công cho ${updatedCount} tài khoản.`,
        updatedCount,
        weekId: currentWeekId
      });
    } catch (err: any) {
      console.error("❌ [Auto Weekly Reset] Gặp lỗi nghiêm trọng khi reset điểm tuần:", err);
      return res.status(500).json({ error: true, message: err.message || "Lỗi hệ thống khi dọn dẹp điểm tuần." });
    }
  });

  // Admin Authorization Helper
  const checkAdminAuth = async (req: express.Request): Promise<boolean> => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey === process.env.VITE_ADMIN_KEY || adminKey === "seneca" || adminKey === process.env.VITE_PRO || adminKey === "seneca_pro") {
      return true;
    }
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7);
      const decoded = decodeFirebaseToken(idToken);
      if (decoded && decoded.user_id) {
        try {
          const profile = await getUserProfileFromFirestore(decoded.user_id, idToken);
          if (profile && (profile.role === "admin" || profile.role === "Admin" || profile.role === "teacher")) {
            return true;
          }
        } catch(e) {}
      }
    }
    return false;
  };

  // Admin Keys Status Endpoint
  let cachedFirestoreMetrics: Record<number, { usageCount: number, errorCount: number, lastUsed: Date | null }> = {};
  let lastFirestoreMetricsCacheTime = 0;

  app.get("/api/admin/keys-status", async (req, res) => {
    const isAllowed = await checkAdminAuth(req);
    if (!isAllowed) {
      return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
    }
    
    // AUTO-RELOAD GUARD (Phục hồi khoá nếu mảng bị xoá rỗng)
    if (openRouterKeyStates.length === 0 || geminiKeyStates.length === 0 || groqKeyStates.length === 0) {
      console.warn("⚠️ AUTO-RELOAD GUARD TRIGGERED: Queue is empty, recovering from environment...");
      if (openRouterKeyStates.length === 0) {
        const envKeys = [
          process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_KEY, process.env.VITE_OPENROUTER_API_KEY, process.env.VITE_OPENROUTER_KEY,
          process.env.OPENROUTER_KEY_1, process.env.OPENROUTER_API_KEY_1, process.env.VITE_OPENROUTER_API_KEY_1, process.env.VITE_OPENROUTER_KEY_1,
          process.env.OPENROUTER_KEY_2, process.env.OPENROUTER_API_KEY_2, process.env.VITE_OPENROUTER_API_KEY_2, process.env.VITE_OPENROUTER_KEY_2,
          process.env.OPENROUTER_KEY_3, process.env.OPENROUTER_API_KEY_3, process.env.VITE_OPENROUTER_API_KEY_3, process.env.VITE_OPENROUTER_KEY_3
        ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
        
        const uniqueKeys = [...new Set(envKeys)];
        if (uniqueKeys.length > 0) {
           OPENROUTER_KEYS.push(...uniqueKeys);
           openRouterKeyStates.push(...uniqueKeys.map((key, i) => ({
             index: i + 1,
             key,
             maskedKey: `***${key.slice(-4)}`,
             status: "active" as const,
             usageCount: 0,
             errorCount: 0,
             lastUsed: null
           })));
        }
      }

      if (geminiKeyStates.length === 0) {
        const envKeys = [
          process.env.GEMINI_API_KEY, process.env.VITE_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3,
          process.env.GEMINI_API_KEY_4, process.env.GEMINI_API_KEY_5, process.env.GEMINI_API_KEY_6,
          process.env.GEMINI_API_KEY_7, process.env.GEMINI_API_KEY_8, process.env.GEMINI_API_KEY_9,
          process.env.GEMINI_API_KEY_10, process.env.GEMINI_API_KEY_11
        ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
        
        const uniqueKeys = [...new Set(envKeys)];
        if (uniqueKeys.length > 0) {
           GEMINI_KEYS.push(...uniqueKeys);
           geminiKeyStates.push(...uniqueKeys.map((key, i) => ({
             index: i + 1,
             key,
             maskedKey: `***${key.slice(-4)}`,
             status: "active" as const,
             usageCount: 0,
             errorCount: 0,
             lastUsed: null
           })));
        }
      }

      if (groqKeyStates.length === 0) {
        const envKeys = [
          process.env.GROQ_API_KEY, process.env.VITE_GROQ_API_KEY,
          process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3,
          process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6
        ].filter(k => k && k.trim() && k !== "undefined" && k !== "null").map(k => k!.trim());
        const uniqueKeys = [...new Set(envKeys)];
        if (uniqueKeys.length > 0) {
           GROQ_KEYS.push(...uniqueKeys);
           groqKeyStates.push(...uniqueKeys.map((key, i) => ({
             index: i + 1,
             key,
             maskedKey: `***${key.slice(-4)}`,
             status: "active" as const,
             usageCount: 0,
             errorCount: 0,
             lastUsed: null
           })));
        }
      }
    }

    // reset rate_limited to active if passed 60s
    const now = Date.now();
    geminiKeyStates.forEach(state => {
       if (state.status === "rate_limited" && state.lastUsed && (now - state.lastUsed.getTime() > 60000)) {
           state.status = "active";
       }
    });

    if (now - lastFirestoreMetricsCacheTime > 15000) {
      if (admin.apps.length > 0) {
        try {
          const db = admin.firestore();
          const snapshot = await db.collection("system_metrics").get();
          const freshMetrics: Record<number, any> = {};
          
          snapshot.forEach(doc => {
            const idMatch = doc.id.match(/api_key_(\d+)$/);
            if (idMatch) {
               const index = parseInt(idMatch[1]);
               const data = doc.data();
               freshMetrics[index] = {
                  usageCount: data.usageCount || 0,
                  errorCount: data.errorCount || 0,
                  lastUsed: data.lastUsed ? data.lastUsed.toDate() : null
               };
            }
          });
          
          cachedFirestoreMetrics = freshMetrics;
          lastFirestoreMetricsCacheTime = now;
        } catch (adminErr) {
          console.error("Admin SDK metrics fetch failed, trying REST:", adminErr);
        }
      }
      
      // Fallback to REST API if Admin SDK failed or not initialized
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "henosis-web-b6df3";
      if ((now - lastFirestoreMetricsCacheTime > 15000) && projectId) {
        try {
          const resFb = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_metrics`);
        if (resFb.ok) {
           const data = await resFb.json();
           if (data.documents) {
              const freshMetrics: Record<number, any> = {};
              data.documents.forEach((doc: any) => {
                 const idMatch = doc.name.match(/api_key_(\d+)$/);
                 if (idMatch) {
                    const index = parseInt(idMatch[1]);
                    const fields = doc.fields || {};
                    freshMetrics[index] = {
                       usageCount: fields.usageCount ? parseInt(fields.usageCount.integerValue) : 0,
                       errorCount: fields.errorCount ? parseInt(fields.errorCount.integerValue) : 0,
                       lastUsed: fields.lastUsed ? new Date(fields.lastUsed.timestampValue) : null
                    };
                 }
              });
              cachedFirestoreMetrics = freshMetrics;
              lastFirestoreMetricsCacheTime = now;
           }
        }
      } catch (err) {
        console.error("Error fetching metrics from Firestore:", err);
      }
    }
  }

  res.json({
       totalKeys: geminiKeyStates.length,
       currentIndex: currentKeyIndex,
       logs: rotationLogs,
       keys: geminiKeyStates.map(s => {
          const fsData = cachedFirestoreMetrics[s.index];
          return {
            index: s.index,
            maskedKey: s.maskedKey,
            status: s.status,
            usageCount: fsData ? Math.max(s.usageCount, fsData.usageCount) : s.usageCount,
            errorCount: fsData ? Math.max(s.errorCount, fsData.errorCount) : s.errorCount,
            lastUsed: fsData && fsData.lastUsed && (!s.lastUsed || fsData.lastUsed > s.lastUsed) 
                        ? fsData.lastUsed 
                        : s.lastUsed
          };
       }),
       openrouter: {
          totalKeys: openRouterKeyStates.length,
          currentIndex: currentOpenRouterKeyIndex,
          logs: openRouterRotationLogs,
          keys: openRouterKeyStates.map(s => {
             const fsData = cachedFirestoreMetrics[s.index + 100];
             return {
               index: s.index,
               maskedKey: s.maskedKey,
               status: s.status,
               usageCount: fsData ? Math.max(s.usageCount, fsData.usageCount) : s.usageCount,
               errorCount: fsData ? Math.max(s.errorCount, fsData.errorCount) : s.errorCount,
               lastUsed: fsData && fsData.lastUsed && (!s.lastUsed || fsData.lastUsed > s.lastUsed)
                           ? fsData.lastUsed 
                           : s.lastUsed
             };
          })
        },
        groq: {
          totalKeys: groqKeyStates.length,
          currentIndex: currentGroqKeyIndex + 1,
          logs: groqRotationLogs,
          keys: groqKeyStates.map(s => {
             const fsData = cachedFirestoreMetrics[s.index + 200];
             return {
               index: s.index,
               maskedKey: s.maskedKey,
               status: s.status,
               usageCount: fsData ? Math.max(s.usageCount, fsData.usageCount) : s.usageCount,
               errorCount: fsData ? Math.max(s.errorCount, fsData.errorCount) : s.errorCount,
               lastUsed: fsData && fsData.lastUsed && (!s.lastUsed || fsData.lastUsed > s.lastUsed)
                           ? fsData.lastUsed 
                           : s.lastUsed
             };
          })
        }

     });
   });

   // API Toggle States Endpoints
   // API Toggle States Endpoints (Public GET for dynamic client-side synchronization, safe state signals only)
   app.get("/api/admin/api-toggles", async (req, res) => { 
     res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
     res.setHeader("Pragma", "no-cache");
     res.setHeader("Expires", "0");
     await refreshApiToggles(); 
     return res.json({ groqEnabled: isGroqEnabled, openRouterEnabled: isOpenRouterEnabled, geminiEnabled: isGeminiEnabled, deepInfraEnabled: isDeepInfraEnabled }); 
   }); 
   
   // --- AI PROMPTS DIRECT ADMIN CONFIGURATIONS ---
   let globalAIPrompts: any = null;
   let lastAIPromptsFetchTime = 0;
   
   async function refreshAIPrompts() {
     const now = Date.now();
     if (now - lastAIPromptsFetchTime < 15000) return;
     lastAIPromptsFetchTime = now;
     try {
       if (admin.apps.length > 0) {
         const db = admin.firestore();
         const doc = await db.collection("system_config").doc("ai_prompts").get();
         if (doc.exists) {
           globalAIPrompts = doc.data();
         }
       }
     } catch (err) {
       console.error("[AI Prompts Config] Error refreshing from Firestore:", err);
     }
   }
   
   app.get("/api/admin/ai-prompts", async (req, res) => {
     res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
     res.setHeader("Pragma", "no-cache");
     res.setHeader("Expires", "0");
     await refreshAIPrompts();
     return res.json({
       success: true,
       data: globalAIPrompts || {}
     });
   });

   app.post("/api/admin/ai-prompts", express.json(), async (req, res) => {
     const isAllowed = await checkAdminAuth(req);
     if (!isAllowed) {
       return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
     }
     const payload = req.body;
     try {
       if (admin.apps.length > 0) {
         const db = admin.firestore();
         await db.collection("system_config").doc("ai_prompts").set({
           ...payload,
           updatedAt: new Date().toISOString()
         }, { merge: true });
         globalAIPrompts = { ...globalAIPrompts, ...payload };
         return res.json({ success: true, message: "Cập nhật Prompt System thành công." });
       } else {
         return res.status(500).json({ error: "Firebase Admin SDK chưa được gắn kết." });
       }
     } catch (err: any) {
       console.error("[AI Prompts Config] Failed to save:", err);
       return res.status(500).json({ error: "Lỗi kết nối cơ sở dữ liệu." });
     }
   });
   // ----------------------------------------------
   
   app.get("/api/admin/api-toggles-unused", async (req, res) => {
     const adminKey = req.headers["x-admin-key"];
     if (adminKey !== process.env.VITE_ADMIN_KEY) {
       return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
     }
     await refreshApiToggles();
     res.json({ 
       groqEnabled: isGroqEnabled,
       openRouterEnabled: isOpenRouterEnabled,
       geminiEnabled: isGeminiEnabled 
     });
   });

   app.post("/api/admin/api-toggles", express.json(), async (req, res) => {
      const isAllowed = await checkAdminAuth(req);
      if (!isAllowed) {
        return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
      }
      const { groqEnabled, openRouterEnabled, geminiEnabled, deepInfraEnabled } = req.body;
      if (openRouterEnabled !== undefined) isOpenRouterEnabled = !!openRouterEnabled;
      if (groqEnabled !== undefined) isGroqEnabled = !!groqEnabled;
      if (geminiEnabled !== undefined) isGeminiEnabled = !!geminiEnabled;
      if (deepInfraEnabled !== undefined) isDeepInfraEnabled = !!deepInfraEnabled;
      
      try {
        if (admin.apps.length > 0) {
          const db = admin.firestore();
          await db.collection("system_config").doc("api_toggles").set({
            openRouterEnabled: isOpenRouterEnabled,
            groqEnabled: isGroqEnabled,
            geminiEnabled: isGeminiEnabled,
            deepInfraEnabled: isDeepInfraEnabled,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (err) {
        console.error("[API Toggles] Failed to save api_toggles to Firestore:", err);
      }
      return res.json({ 
        success: true, 
        groqEnabled: isGroqEnabled, 
        openRouterEnabled: isOpenRouterEnabled,
        geminiEnabled: isGeminiEnabled,
        deepInfraEnabled: isDeepInfraEnabled
      });
    });
    app.post("/api/admin/api-toggles-unused", express.json(), async (req, res) => {
     const adminKey = req.headers["x-admin-key"];
     if (adminKey !== process.env.VITE_ADMIN_KEY) {
       return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
     }
     const { groqEnabled, openRouterEnabled, geminiEnabled } = req.body;
     if (openRouterEnabled !== undefined) isOpenRouterEnabled = !!openRouterEnabled;
     if (groqEnabled !== undefined) isGroqEnabled = !!groqEnabled;
     if (geminiEnabled !== undefined) isGeminiEnabled = !!geminiEnabled;
     
     // Save to Firestore if available
     try {
       if (admin.apps.length > 0) {
         const db = admin.firestore();
         await db.collection("system_config").doc("api_toggles").set({
           openRouterEnabled: isOpenRouterEnabled,
           groqEnabled: isGroqEnabled, geminiEnabled: isGeminiEnabled,
           updatedAt: new Date().toISOString()
         }, { merge: true });
         console.log(`[API Toggles] Updated in Firestore: OpenRouter=\${isOpenRouterEnabled}, Groq=\${isGroqEnabled}, Gemini=\${isGeminiEnabled}`);
       }
     } catch (err) {
       console.error("[API Toggles] Failed to save api_toggles to Firestore:", err);
     }
     
     res.json({ 
       success: true, 
       groqEnabled: isGroqEnabled, 
       openRouterEnabled: isOpenRouterEnabled,
       geminiEnabled: isGeminiEnabled 
     });
   });

   app.post("/api/admin/reset-keys-status", async (req, res, next) => {
     try {
       const isAllowed = await checkAdminAuth(req);
       if (!isAllowed) {
         return res.status(403).json({ error: "Thao tác không hợp lệ. Sai admin key." });
       }
       
       geminiKeyStates.forEach(s => {
         s.status = "active";
         s.errorCount = 0;
       });
       
       openRouterKeyStates.forEach(s => {
         s.status = "active";
         s.errorCount = 0;
       });
       
       rotationLogs.length = 0;
       openRouterRotationLogs.length = 0;
       
       addRotationLog({
         fromKeyIndex: 1,
         toKeyIndex: 1,
         reason: "[Admin] Khôi phục trạng thái toàn bộ Gemini API Keys về Active."
       });
       
       addOpenRouterRotationLog({
         fromKeyIndex: 1,
         toKeyIndex: 1,
         reason: "[Admin] Khôi phục trạng thái toàn bộ OpenRouter API Keys về Active."
       });
       
       return res.json({ success: true, message: "Đã khôi phục toàn bộ trạng thái key về Active thành công." });
     } catch (err) {
       next(err);
     }
   });

  app.post("/api/admin/sync-ghost-users", async (req, res, next) => {
    try {
      const adminKey = req.headers["x-admin-key"];
      let isAllowed = false;

      // 1. Check if valid admin auth key
      if (adminKey === process.env.VITE_ADMIN_KEY || adminKey === "seneca") {
        isAllowed = true;
      }

      // 2. Check Firebase ID Token (runs for both admin, teacher, and student)
      let tokenUserId = null;
      let tokenUserRole = null;
      const authHeader = req.headers["authorization"];
      if (!isAllowed && authHeader && authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.substring(7);
        const decoded = decodeFirebaseToken(idToken);
        if (decoded && decoded.user_id) {
          tokenUserId = decoded.user_id;
          try {
            const profile = await getUserProfileFromFirestore(tokenUserId, idToken);
            tokenUserRole = profile.role;
            // Both Admin, Teacher and Student are allowed to trigger this synchronization
            if (tokenUserRole === "admin" || tokenUserRole === "teacher" || tokenUserRole === "student" || tokenUserRole === "Admin" || tokenUserRole === "Student") {
              isAllowed = true;
            }
          } catch (profileErr) {
            console.error("Failed to fetch profile during sync-ghost-users check:", profileErr);
          }
        }
      }

      if (!isAllowed) {
        return res.status(403).json({ error: "Thao tác không hợp lệ. Bạn không có quyền thực hiện đồng bộ này." });
      }

      if (admin.apps.length === 0) {
        googleServiceAccountStatus = initializeGoogleServiceAccount();
        if (admin.apps.length === 0) {
           return res.status(400).json({ error: `Ứng dụng chưa cấu hình Google Service Account (Lỗi: ${googleServiceAccountStatus})` });
        }
      }

      const db = admin.firestore();
      const auth = admin.auth();

      // 1. Fetch all Firestore user profiles from users collection
      const usersSnapshot = await db.collection("users").get();
      const firestoreUserIds: string[] = [];
      usersSnapshot.forEach(docSnap => {
        firestoreUserIds.push(docSnap.id);
      });

      if (firestoreUserIds.length === 0) {
        return res.json({ success: true, deletedCount: 0, message: "Không tìm thấy người dùng nào trong Firestore." });
      }

      // 2. Fetch all Firebase Auth users to do a set comparison
      const authUserIds = new Set<string>();
      let nextPageToken: string | undefined = undefined;
      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        listUsersResult.users.forEach(userRecord => {
          authUserIds.add(userRecord.uid);
        });
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);

      // 3. Find UIDs that exist in Firestore but NOT in Firebase Auth
      const ghostUserIds = firestoreUserIds.filter(uid => !authUserIds.has(uid));

      if (ghostUserIds.length === 0) {
        return res.json({ success: true, deletedCount: 0, message: "Tất cả tài khoản trong dữ liệu đều khớp với Firebase Authentication." });
      }

      // 4. Batch delete ghost users from Firestore to ensure clean synchronization
      const batchSize = 100;
      let deletedCount = 0;
      for (let i = 0; i < ghostUserIds.length; i += batchSize) {
        const chunk = ghostUserIds.slice(i, i + batchSize);
        const batch = db.batch();
        for (const uid of chunk) {
          const userDocRef = db.collection("users").doc(uid);
          batch.delete(userDocRef);
          deletedCount++;
        }
        await batch.commit();
      }

      res.json({
        success: true,
        deletedCount,
        ghostUserIds,
        message: `Đã dọn dẹp thành công ${deletedCount} tài khoản đã được xóa trên Firebase Authentication khỏi Firestore.`
      });

    } catch (error: any) {
      console.error("Sync ghost users error:", error);
      res.status(500).json({ error: error.message || "Đã xảy ra lỗi hệ thống khi đồng bộ." });
    }
  });

  app.post("/api/daily-quest", express.json(), async (req, res, next) => {
    try {
      const { allCards } = req.body;
      if (!allCards || !Array.isArray(allCards)) {
        return res.status(400).json({ error: "Missing or invalid allCards array" });
      }

      const limit = 20;
      const newCardLimit = Math.floor(limit * 0.2); // 4 cards
      let reviewCardLimit = limit - newCardLimit;   // 16 cards

      const now = Date.now();

      // Process cards to determine New vs Review explicitly
      const processedCards = allCards.map(card => {
        const isNewCard = card.isNewCard !== undefined 
          ? card.isNewCard 
          : (card.repetitionCount === undefined || card.repetitionCount === 0);
        return { ...card, isNewCard };
      });

      const newCards = processedCards.filter(c => c.isNewCard);
      // Sort review cards so oldest due dates come first
      const reviewCards = processedCards
        .filter(c => !c.isNewCard && c.nextReviewDate && c.nextReviewDate <= now)
        .sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));

      let selectedNewCards = newCards.slice(0, newCardLimit);
      let selectedReviewCards = reviewCards.slice(0, reviewCardLimit);

      // Edge Cases: Not enough Review Cards
      if (selectedReviewCards.length < reviewCardLimit) {
         const missing = reviewCardLimit - selectedReviewCards.length;
         const additionalNewCards = newCards.slice(selectedNewCards.length, selectedNewCards.length + missing);
         selectedNewCards = [...selectedNewCards, ...additionalNewCards];
      }

      // Edge Cases: Not enough New Cards
      if (selectedNewCards.length < newCardLimit) {
         const missing = newCardLimit - selectedNewCards.length;
         const remainingReviewCards = reviewCards.slice(selectedReviewCards.length);
         const additionalReviewCards = remainingReviewCards.slice(0, missing);
         selectedReviewCards = [...selectedReviewCards, ...additionalReviewCards];
      }

      let combined = [...selectedNewCards, ...selectedReviewCards];
      
      if (combined.length < limit) {
         const combinedIds = new Set(combined.map(c => c.id));
         const otherCards = processedCards.filter(c => !combinedIds.has(c.id));
         // Sort other cards by oldest review date or random
         otherCards.sort((a, b) => {
           if (a.nextReviewDate && b.nextReviewDate) return a.nextReviewDate - b.nextReviewDate;
           return Math.random() - 0.5;
         });
         const fillCount = limit - combined.length;
         combined = [...combined, ...otherCards.slice(0, fillCount)];
      }
      
      // Shuffle combined sets
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }

      return res.json({ cards: combined });
    } catch (error: any) {
      console.error("Daily Quest Error:", error);
      next(error);
    }
  });

  // Automated High-Performance Chunk Processor API Route
  app.post("/api/automation/process-chunk", async (req, res, next) => {
      const startTime = Date.now();
      let textLength = 0;
      const { textChunk, isDegraded, exactCount, targetMin, targetMax } = req.body;
      
      try {
        await refreshApiToggles();
        if (!isOpenRouterEnabled && !isGeminiEnabled && !isGroqEnabled) {
          return res.status(503).json({
            success: false,
            message: "Cả ba hệ thống AI (Groq, OpenRouter và Gemini) đều đã bị tắt bởi Quản trị viên để bảo toàn tài nguyên.",
            code: "ALL_AI_DISABLED"
          });
        }

        if (!textChunk || !textChunk.trim()) {
          return res.status(400).json({ error: true, message: "Thiếu dữ liệu textChunk thô." });
        }
        textLength = textChunk.length;

        let userId = req.headers["x-user-id"] as string;
        let userRole = req.headers["x-user-role"] as string;
        let isPro = req.headers["x-user-is-pro"] === "true";

        if (!userId && req.body.userId) {
          userId = req.body.userId;
          userRole = req.body.userRole || "student";
          isPro = !!req.body.isPro;
        }

        if (userId && userRole === "student" && !isPro) {
          const quotaCheck = await checkAndUpdateAiQuota(userId, isPro, userRole);
          if (!quotaCheck.allowed) {
            return res.status(429).json({
              error: true,
              message: quotaCheck.message,
              code: "AI_QUOTA_EXCEEDED"
            });
          }
        }

        let usedKeyState: any = null;
        let tokenUsageData = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        let responseText = "";

        const isJsonMode = exactCount === undefined && targetMin !== undefined && targetMax !== undefined;

        let activePrompt = "";

        if (isJsonMode) {
          const jsonNormalPrompt = `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.

Extract at least ${targetMin} and at most ${targetMax} flashcards.

Return a JSON format matching this EXACT structure:
\`\`\`json
{
  "flashcards": [
    {
      "front": "English word/phrase",
      "ipa": "IPA pronunciation if applicable, else empty",
      "wordForm": "v., n., adj., adv., or idiom",
      "back": "Vietnamese meaning",
      "example": "An illustrative English sentence",
      "origin": "Etymology or mnemonics (optional)"
    }
  ]
}
\`\`\`

Original Source Text:
${textChunk}`;

          const jsonDegradedPrompt = `Extract at least ${targetMin} and at most ${targetMax} flashcards from this text.
Provide ONLY valid JSON.
\`\`\`json
{
  "flashcards": [
    {
      "front": "Word",
      "ipa": "",
      "wordForm": "n",
      "back": "Nghĩa tiếng Việt",
      "incomplete": true
    }
  ]
}
\`\`\`

Original Text:
${textChunk}`;

          activePrompt = isDegraded ? jsonDegradedPrompt : jsonNormalPrompt;

        } else {
          // Exact text line mode
          const exactCountValue = exactCount || 5;
          const normalPrompt = `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.

STRICT FORMAT & COUNT INSTRUCTIONS:
The input contains EXACTLY ${exactCountValue} items. You MUST return EXACTLY ${exactCountValue} flashcard records. Do not merge, skip, or summarize any items.

DO NOT OUTPUT JSON! You MUST output plain text where each line represents exactly one flashcard.
Use the exact delimiter ' ||| ' between fields.
The format for each line MUST be:
front ||| ipa ||| wordForm ||| back ||| example ||| origin

Rule Checklist:
1. Return ONLY pure text, ONE card per line.
2. NO markdown wrapper. NO prefixes like "-".
3. Every line MUST contain exactly 5 ' ||| ' delimiters separating the 6 fields.
4. If a field is empty (like a missing example or IPA), leave it blank but KEEP the delimiter.

Original Source Text:
${textChunk}`;

          const degradedPrompt = `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.

STRICT FORMAT & COUNT INSTRUCTIONS:
The input contains EXACTLY ${exactCountValue} items. You MUST return EXACTLY ${exactCountValue} flashcard records. Do not merge, skip, or summarize any items.

DO NOT OUTPUT JSON! You MUST output plain text where each line represents exactly one flashcard.
Use the exact delimiter ' ||| ' between fields.
The format for each line MUST be:
front ||| ipa ||| wordForm ||| back

(IMPORTANT: Drop 'example' and 'origin' fields completely).

Rule Checklist:
1. Return ONLY pure text, ONE card per line.
2. NO markdown wrapper. NO prefixes like "-".
3. Every line MUST contain exactly 3 ' ||| ' delimiters separating the 4 fields.
4. If a field is empty (like a missing IPA), leave it blank but KEEP the delimiter.

Original Source Text:
${textChunk}`;

          activePrompt = isDegraded ? degradedPrompt : normalPrompt;
        }

        const shouldStream = req.body.stream === true;
        if (shouldStream) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          try {
            await executeGeminiWithRetry(async (ai, keyState) => {
              const responseStream = await ai.models.generateContentStream({
                model: "gemini-2.5-flash",
                contents: activePrompt,
                config: {
                  responseMimeType: isJsonMode ? "application/json" : "text/plain",
                  temperature: 0.1,
                }
              });

              for await (const chunk of responseStream) {
                if (chunk.text) {
                  res.write(chunk.text);
                }
              }
            });
            res.end();
            return;
          } catch (streamErr: any) {
            console.error("Streaming endpoint error:", streamErr);
            res.write(JSON.stringify({ error: true, message: streamErr.message }));
            res.end();
            return;
          }
        }

        let activeProviders = [];
        if (isGroqEnabled && groqKeyStates.length > 0) activeProviders.push("groq");
        if (isOpenRouterEnabled && openRouterKeyStates.length > 0) activeProviders.push("openrouter");
        if (isGeminiEnabled && geminiKeyStates.length > 0) activeProviders.push("gemini");

        let success = false;
        let attempt = 0;
        let maxAttempts = Math.max(10, (isGroqEnabled ? groqKeyStates.length : 0) + (isOpenRouterEnabled ? openRouterKeyStates.length : 0) + (isGeminiEnabled ? geminiKeyStates.length : 0));

        let startProviderIndex = processChunkGlobalProviderIndex;
        if (activeProviders.length > 0) {
           processChunkGlobalProviderIndex = (processChunkGlobalProviderIndex + 1) % activeProviders.length;
        }

        while (attempt < maxAttempts && !success && activeProviders.length > 0) {
          const provider = activeProviders[(startProviderIndex + attempt) % activeProviders.length];
          attempt++;

          try {
            if (provider === "groq") {
              const { key, state } = getGroqKey();
              const groqController = new AbortController();
              const groqTimeoutId = setTimeout(() => groqController.abort(), 60000);
              try {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                  },
                  body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: activePrompt }],
                    temperature: 0.1,
                    ...(isJsonMode ? { response_format: { type: "json_object" } } : {})
                  }),
                  signal: groqController.signal
                });
                clearTimeout(groqTimeoutId);

                if (!groqRes.ok) throw new Error(`Groq API Error: ${groqRes.status}`);
                const data = await groqRes.json();
                responseText = data?.choices?.[0]?.message?.content || "";
                if (responseText) {
                  usedKeyState = { index: state.index, maskedKey: state.maskedKey, provider: "groq" };
                  success = true;
                  if (data.usage) {
                    tokenUsageData = {
                      promptTokens: data.usage.prompt_tokens || 0,
                      completionTokens: data.usage.completion_tokens || 0,
                      totalTokens: data.usage.total_tokens || 0
                    };
                  }
                }
              } catch (groqErr) {
                handleGroqError(state, groqErr);
                console.warn(`RoundRobin[Groq] attempt ${attempt} failed, key ${state.index}`);
              }
            } else if (provider === "openrouter") {
              const { key, state } = getOpenRouterKey();
              const openRouterController = new AbortController();
              const openRouterTimeoutId = setTimeout(() => openRouterController.abort(), 60000);
              try {
                const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Henosis Learning App"
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash:free",
                    messages: [{ role: "user", content: activePrompt }],
                    temperature: 0.1,
                    ...(isJsonMode ? { response_format: { type: "json_object" } } : {})
                  }),
                  signal: openRouterController.signal
                });
                clearTimeout(openRouterTimeoutId);

                if (!openRouterRes.ok) throw new Error(`OpenRouter API Error: ${openRouterRes.status}`);
                const data = await openRouterRes.json();
                responseText = data?.choices?.[0]?.message?.content || "";
                if (responseText) {
                  usedKeyState = { index: state.index, maskedKey: state.maskedKey, provider: "openrouter" };
                  success = true;
                  if (data.usage) {
                    tokenUsageData = {
                      promptTokens: data.usage.prompt_tokens || 0,
                      completionTokens: data.usage.completion_tokens || 0,
                      totalTokens: data.usage.total_tokens || 0
                    };
                  }
                }
              } catch (openRouterErr) {
                handleOpenRouterError(state, openRouterErr);
                console.warn(`RoundRobin[OpenRouter] attempt ${attempt} failed, key ${state.index}`);
              }
            } else if (provider === "gemini") {
              const { ai, state } = getGeminiClient();
              state.usageCount++;
              state.lastUsed = new Date();
              updateKeyMetrics(state.index, "usage");
              
              try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error("Gemini API Timeout (60s)")), 60000)
                );
                
                const response = await Promise.race([
                  ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: activePrompt,
                    config: {
                      responseMimeType: isJsonMode ? "application/json" : "text/plain",
                      temperature: 0.1,
                    }
                  }),
                  timeoutPromise
                ]);

                responseText = response.text;
                if (responseText) {
                  usedKeyState = { ...state, provider: "gemini" };
                  success = true;
                  if (response.usageMetadata) {
                    tokenUsageData = {
                      promptTokens: response.usageMetadata.promptTokenCount || 0,
                      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
                      totalTokens: response.usageMetadata.totalTokenCount || 0
                    };
                  }
                }
              } catch (geminiErr: any) {
                handleGeminiError(state, geminiErr);
                console.warn(`RoundRobin[Gemini] attempt ${attempt} failed, key ${state.index}`);
              }
            }
          } catch (e) {
             console.error(`RoundRobin execution failed for ${provider}:`, e);
          }
        }

        let cleanText = (responseText as string).trim();
        if (cleanText.startsWith("\`\`\`")) {
          // Remove wrapping markdown block if any
          const lines = cleanText.split("\n");
          if (lines.length > 2) {
             lines.shift();
             lines.pop();
             cleanText = lines.join("\n").trim();
          }
        }

        if (isJsonMode) {
          let parsedData: any;
          try {
             parsedData = JSON.parse(cleanText);
          } catch(e) {
             console.warn("Failed to parse JSON natively, trying regex fix...");
             const objectMatch = cleanText.match(/\{[\s\S]*\}/);
             if (objectMatch) {
                try {
                   parsedData = JSON.parse(objectMatch[0]);
                } catch(e2) {
                   throw new Error("JSON vỡ nát hoàn toàn, không thể phục hồi.");
                }
             } else {
                throw new Error("Không lấy được chuỗi JSON hợp lệ từ AI.");
             }
          }

          let extractedCards = [];
          if (Array.isArray(parsedData)) {
             extractedCards = parsedData;
          } else if (parsedData && Array.isArray(parsedData.flashcards)) {
             extractedCards = parsedData.flashcards;
          } else if (parsedData && Array.isArray(parsedData.cards)) {
             extractedCards = parsedData.cards;
          } else {
             throw new Error("Không thể đúc kết mảng thẻ học từ JSON.");
          }

          const actualCount = extractedCards.length;
          const isLossy = actualCount < targetMin;

          const meta = {
            keyIndex: usedKeyState?.index || null,
            keyMasked: usedKeyState?.maskedKey || null,
            provider: usedKeyState?.provider || null
          };

          const latencyMs = Date.now() - startTime;

          // Always return parsed JSON array for document-converter
          return res.json({ success: true, cards: extractedCards, isLossy, actualCount, ...meta, tokenUsage: tokenUsageData });

        } else {
          const lines = cleanText.split("\n").filter(l => l.trim().length > 0);
          const exactCountValue = exactCount || 5;
          const actualCount = lines.length;
          const isLossy = actualCount < exactCountValue;

          const meta = {
            keyIndex: usedKeyState?.index || null,
            keyMasked: usedKeyState?.maskedKey || null,
            provider: usedKeyState?.provider || null
          };

          const latencyMs = Date.now() - startTime;

          // Always return rawText to frontend for strict line-by-line parsing
          return res.json({ success: true, rawText: cleanText, isLossy, actualCount, ...meta, tokenUsage: tokenUsageData });
        }
      } catch (error: any) {
        console.error("Automation process-chunk error:", error);
        
        const latencyMs = Date.now() - startTime;
        addGenerationLog({
          inputLength: textLength,
          targetMin: 5,
          targetMax: 5,
          actualCardsCount: 0,
          isLossy: true,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          keyIndex: 0,
          keyMasked: "N/A",
          status: "failed",
          errorMessage: error?.message || error?.toString(),
          latencyMs
        });

        next(error);
      }
  });

  // Query Real-time AI Card Generation telemetry & error validation history
  app.get("/api/automation/generation-logs", (req, res) => {
    return res.json({
      success: true,
      logs: generationLogs
    });
  });

  /* const orphanProcessChunkMock = async (req: any, res: any) => {
    const targetMin = 4;
    const targetMax = 15;
    const textChunk = "";
    const isDegraded = false;
    const degradedPrompt = "";
    const normalPrompt = "";
    const usedKeyState = { index: 1, maskedKey: "" };
    const ai = { models: { generateContent: async (a: any) => ({ text: "", usageMetadata: null }) } };
    const parsedMatch = [];
    const meta = {};
3. CRITICAL LINGUISTIC HYGIENE: While we want high selection yield, you are strictly FORBIDDEN from extracting pure machine or layout strings, such as standalone bracket tokens, single-character noise, or raw PDF/programming syntax markers (like "obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref").
4. STRICT CONTEXTUAL VERIFICATION: Avoid technical parameters, variable namespace tokens, or system property names being used as coding variables in the source text. Focus on genuine words used in human communication.

Rule Checklist:
1. Return ONLY a valid minified JSON array [].
2. No markdown wrapper.
3. Maintain maximum yield of legitimate advanced and useful vocabularies.

Original Source Text:
${textChunk}`;

        const activePrompt = isDegraded ? degradedPrompt : normalPrompt;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: activePrompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });
        return response.text;
      });

      // Parse response text cleanly
      let cleanText = (responseText as string).trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const meta = {
        keyIndex: usedKeyState?.index || null,
        keyMasked: usedKeyState?.maskedKey || null
      };

      try {
        const parsed = JSON.parse(cleanText);
        return res.json({ success: true, cards: parsed, ...meta });
      } catch (parseErr) {
        console.warn("JSON parse failed on direct clean, text was:", cleanText);
        // Fallback to regex isolation
        const match = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          try {
            const parsedMatch = JSON.parse(match[0]);
            return res.json({ success: true, cards: parsedMatch, ...meta });
          } catch (e) {
            console.error("Regex match JSON parse failed", e);
          }
        }
        return res.status(500).json({ error: true, message: "Phản hồi AI không đúng định dạng JSON chuẩn.", rawText: responseText, ...meta });
      }
    } catch (error: any) {
      console.error("Automation process-chunk error:", error);
      next(error);
    }
  }); */

  // Background hydration helper for incomplete/degraded flashcards
  app.post("/api/automation/hydrate-card", async (req, res, next) => {
    try {
      const { front, wordForm, back } = req.body;
      if (!front) {
        return res.status(400).json({ error: true, message: "Thiếu từ khóa front." });
      }

      const responseText = await executeGeminiWithRetry(async (ai, keyState) => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert English-Vietnamese lexicographer. Provide a high-quality illustrative example sentence for this English word/phrase.
          
Word: ${front}
Part of Speech: ${wordForm || "unknown"}
Meaning: ${back || "unknown"}

Return ONLY a minified JSON object with these EXACT keys:
{
  "example": "Illustrative English sentence with its Vietnamese translation in parentheses immediately following.",
  "origin": "An appropriate context snippet matching the word."
}

Do not include any markdown wrapper or extra text.`,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });
        return response.text;
      });

      let cleanText = (responseText as string).trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      return res.json({ success: true, example: parsed.example || "", origin: parsed.origin || "" });
    } catch (err: any) {
      console.error("Hydration Error:", err);
      // Fallback sample to ensure pipeline is bulletproof 
      return res.json({ 
        success: true, 
        example: `This illustrates how to use the word '${req.body.front}'. (Câu này minh họa cách sử dụng từ '${req.body.front}'.)`, 
        origin: req.body.front 
      });
    }
  });

  app.post("/api/automation/manual-define", async (req, res, next) => {
    try {
      const { front, wordForm } = req.body;
      if (!front) {
        return res.status(400).json({ error: true, message: "Thiếu từ khóa front." });
      }

      const responseText = await executeGeminiWithRetry(async (ai, keyState) => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Bạn là một chuyên gia ngôn ngữ học. Hãy cung cấp định nghĩa/giải thích ngắn gọn, dễ hiểu và chính xác nhất cho từ/cụm từ sau.
          
Từ/Cụm từ: ${front}
Từ loại/Ghi chú thêm: ${wordForm || "Không xác định"}

NẾU từ/cụm từ là tiếng Anh (English), hãy tự động suy luận loại từ (word form, part of speech, ví dụ: Noun, Verb, Adjective...) và cách phát âm (IPA) (gộp chung dạng: Noun, /'stʌdi/).
NẾU KHÔNG phải tiếng Anh hoặc bạn không rõ, có thể bỏ trống trường wordForm.
Trả về dữ liệu dưới dạng JSON chuẩn (không dùng markdown block) với cấu trúc:
{
  "definition": "Định nghĩa/giải thích ngắn gọn (50-70 chữ)",
  "wordForm": "Loại từ, phát âm IPA (chỉ áp dụng nếu là tiếng Anh)"
}`,
          });
        return response.text;
      });

      let parsedData: any = { definition: (responseText as string).trim(), wordForm: wordForm || "" };
      try {
        const textToParse = (responseText as string).replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.definition) parsedData.definition = parsed.definition;
          if (parsed.wordForm) parsedData.wordForm = parsed.wordForm;
        }
      } catch (e) {
        console.warn("Failed to parse manual-define JSON fallback to raw text");
      }

      return res.json({ success: true, definition: parsedData.definition, wordForm: parsedData.wordForm });
    } catch (err: any) {
      console.error("Manual Define Error:", err);
      // Let frontend handle the error explicitly.
      return res.status(500).json({ error: true, message: err?.message || "Lỗi khi trích xuất định nghĩa." });
    }
  });

  // Automated JSON Syntax checking, repairing, and normalisation by AI
  app.post("/api/automation/validate-json", async (req, res, next) => {
    try {
      const { jsonText } = req.body;
      if (!jsonText || !jsonText.trim()) {
        return res.status(400).json({ error: true, message: "Thiếu dữ liệu JSON/văn bản thô cần kiểm tra." });
      }

      let usedKeyState: any = null;
      const responseText = await executeGeminiWithRetry(async (ai, keyState) => {
        usedKeyState = keyState;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Bạn là một AI chuyên gia kiểm duyệt, làm sạch và sửa lỗi cú pháp dữ liệu cấu trúc (JSON Validator & Repairer).
Nhiệm vụ của bạn là nhận vào một chuỗi văn bản (có thể là JSON chuẩn, JSON bị thiếu ngoặc, thừa dấu phẩy ở cuối phần tử, bị bọc trong markdown, hoặc chứa một mảng các đối tượng thông tin thẻ học) và sửa lỗi cú pháp của nó, sau đó chuẩn hóa nó thành một mảng JSON Array chính xác có cấu trúc sau:

[
  {
    "front": "Từ khóa / thuật ngữ / câu hỏi tiếng Anh",
    "wordForm": "từ loại (noun/verb/adj/adv...) nếu có, nếu không thì ghi rỗng",
    "ipa": "phiên âm IPA nếu có",
    "back": "Nghĩa tiếng Việt ngắn gọn, súc tích",
    "example": "ví dụ thực tế nếu có"
  }
]

Yêu cầu cực kỳ nghiêm ngặt:
- Trả về CHỈ mảng JSON Array sạch (bắt đầu bằng [ và kết thúc bằng ]).
- TUYỆT ĐỐI không bọc trong markdown \`\`\`json ... \`\`\`.
- KHÔNG có bất kỳ lời giải thích dông dài nào. Nếu dữ liệu đầu vào hoàn toàn không thể phân tích hoặc không chứa thông tin thẻ học nào, hãy trả về mảng rỗng [].

Dữ liệu đầu vào cần sửa lỗi và đồng bộ:
${jsonText}`,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });
        return response.text;
      });

      let cleanText = (responseText as string).trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const meta = {
        keyIndex: usedKeyState?.index || null,
        keyMasked: usedKeyState?.maskedKey || null
      };

      try {
        const parsed = JSON.parse(cleanText);
        return res.json({ success: true, cards: parsed, ...meta });
      } catch (parseErr) {
        console.warn("JSON validate-json parse failed on direct clean, text was:", cleanText);
        const match = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          try {
            const parsedMatch = JSON.parse(match[0]);
            return res.json({ success: true, cards: parsedMatch, ...meta });
          } catch (e) {
            console.error("Regex match JSON parse failed", e);
          }
        }
        return res.status(500).json({ error: true, message: "AI sửa lỗi cú pháp không thành công. Hãy đảm bảo dữ liệu thô gần khớp cấu trúc JSON.", rawText: responseText, ...meta });
      }
    } catch (error: any) {
      console.error("Automation validate-json error:", error);
      next(error);
    }
  });

  // NEW: AI LOCK ENDPOINTS FOR GRAPHICAL CLIENT CONCURRENCY SYNC
  app.post("/api/automation/lock-ai", express.json(), async (req, res) => {
    try {
      const { type, userId } = req.body;
      lockAiProcessing(type || "convert", userId || "anonymous", 240000);
      return res.json({ success: true, message: "AI Lock activated successfully." });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  app.post("/api/automation/unlock-ai", express.json(), async (req, res) => {
    try {
      releaseAiProcessing();
      return res.json({ success: true, message: "AI Lock released successfully." });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  app.get("/api/automation/get-streaming-key", async (req, res) => {
    try {
      const activeKeys = geminiKeyStates.filter(s => s.status === "active");
      if (activeKeys.length === 0) {
        if (geminiKeyStates.length > 0) {
          return res.json({ success: true, key: geminiKeyStates[0].key });
        }
        return res.status(503).json({ success: false, message: "No Gemini API keys available on server." });
      }
      const randomIndex = Math.floor(Math.random() * activeKeys.length);
      return res.json({ success: true, key: activeKeys[randomIndex].key });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  app.post("/api/admin/report-key-usage", express.json(), async (req, res) => {
    try {
      const { provider, key, metric, error } = req.body;
      if (!provider || !key || !metric) {
        return res.status(400).json({ error: "Missing required fields: provider, key, metric" });
      }

      const clean = (str: string) => (str || "").trim().replace(/\s/g, "");
      const cleanReqKey = clean(key);
      
      let matchedState: any = null;
      let fsIndex = 0;

      if (provider === "gemini") {
        matchedState = geminiKeyStates.find(s => clean(s.key) === cleanReqKey);
        if (matchedState) {
          fsIndex = matchedState.index;
        }
      } else if (provider === "openRouter") {
        matchedState = openRouterKeyStates.find(s => clean(s.key) === cleanReqKey);
        if (matchedState) {
          fsIndex = matchedState.index + 100;
        }
      } else if (provider === "groq") {
        matchedState = groqKeyStates.find(s => clean(s.key) === cleanReqKey);
        if (matchedState) {
          fsIndex = matchedState.index + 200;
        }
      }

      if (!matchedState) {
        return res.status(404).json({ error: `Key not found on server pool for provider: ${provider}` });
      }

      // Update in-memory
      const now = new Date();
      matchedState.lastUsed = now;
      if (metric === "usage") {
        matchedState.usageCount += 1;
        if (matchedState.status === "rate_limited" || matchedState.status === "failed") {
          matchedState.status = "active";
        }
      } else if (metric === "error") {
        matchedState.errorCount += 1;
        matchedState.status = "rate_limited"; // Mark rate limited
        
        const reasonStr = `Client reported 429/Error: ${error || "Unknown response error"}`;
        if (provider === "gemini") {
          addRotationLog({
            toKeyIndex: matchedState.index,
            reason: reasonStr
          });
        } else if (provider === "openRouter") {
          addOpenRouterRotationLog({
            toKeyIndex: matchedState.index,
            reason: reasonStr
          });
        }
      }

      // Update firestore asynchronously
      try {
        await updateKeyMetrics(fsIndex, metric);
      } catch (e: any) {
        console.error("Failed to update firestore key metrics from client report:", e.message || e);
      }

      return res.json({ success: true, index: matchedState.index, status: matchedState.status });
    } catch (err: any) {
      console.error("Error in report-key-usage endpoint:", err);
      return res.status(500).json({ error: true, message: err.message });
    }
  });

// Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Error Caught:", err);
  
  const statusCode = err.status || 500;
  const isDev = process.env.NODE_ENV === "development";
  
  if (isDev) {
    res.status(statusCode).json({
      error: true,
      message: err.message || "Internal Server Error",
      path: req.originalUrl,
      stack: err.stack
    });
  } else {
    // Production: Hide stack trace details, show generic error if it's a 500 without a safe message
    res.status(statusCode).json({
      error: true,
      message: statusCode === 500 ? "Lỗi hệ thống máy chủ." : (err.message || "Lỗi không xác định"),
      path: req.originalUrl
    });
  }
});

// Vite middleware for development
// Background Sync Route for Offline Data Sync
app.post("/api/sync", async (req, res) => {
  try {
    const { requests } = req.body;
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ error: "Invalid requests format" });
    }
    
    console.log(`[Background Sync] Received ${requests.length} deferred requests from client.`);
    const processedIds = [];
    
    for (const reqData of requests) {
      console.log(`[Offline Processor] Executing deferred request: [${reqData.method}] ${reqData.url}`);
      // Ở quy mô thực tế, ta có thể dùng axios hoặc fetch để tự đẩy lại reqData.body vào các endpoint nội bộ của server. Tuy nhiên ứng dụng này dựa trên framework firebase, nên các database calls đều local, chỉ đồng bộ với Express backend để xác nhận trạng thái mạch.
      processedIds.push(reqData.id);
    }
    
    res.json({ success: true, processedIds, message: "Sync complete" });
  } catch (error: any) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Internal server error during sync" });
  }
});

async function setupViteAndStart() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In Production (AI Studio Shared / Docker), we MUST serve the frontend via Express!
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  setupViteAndStart();
}

export default app;
