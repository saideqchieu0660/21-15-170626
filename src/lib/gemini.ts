// frontend/client-side OpenRouter/Gemini key rotation
export interface KeyState {
  key: string;
  isRateLimited: boolean;
  cooldownUntil: number;
}

const parseClientKeys = (prefix: string): KeyState[] => {
  const keys: KeyState[] = [];
  // Vite exposes import.meta.env.VITE_*
  try {
    for (const [envKey, envVal] of Object.entries(import.meta.env)) {
      if (envKey.startsWith(prefix) && typeof envVal === 'string' && envVal.trim()) {
        keys.push({ key: envVal.trim(), isRateLimited: false, cooldownUntil: 0 });
      }
    }
  } catch (e) {
    // catch any access errors
  }
  return keys;
};

// Khởi tạo pool cho Client Side Fallback
const OPENROUTER_KEYS = parseClientKeys('VITE_OPENROUTER_KEY');
const GEMINI_KEYS = parseClientKeys('VITE_GEMINI_API_KEY');

class KeyManager {
  private keys: KeyState[];
  private currentIndex: number;

  constructor(keys: KeyState[]) {
    this.keys = keys;
    this.currentIndex = keys.length > 0 ? Math.floor(Math.random() * keys.length) : 0;
  }

  // Helper function to cycle through keys explicitly replacing 429 or 5xx
  getKey(): string | null {
    if (this.keys.length === 0) return null;
    
    const now = Date.now();
    let attempts = 0;
    
    while(attempts < this.keys.length) {
      const state = this.keys[this.currentIndex];
      
      if (state.isRateLimited) {
        if (now > state.cooldownUntil) {
          state.isRateLimited = false; // Phục hồi sau cooldown
          return state.key;
        }
      } else {
        return state.key;
      }
      
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    // Nếu tất cả lock, bắt buộc lấy key tạm random hoặc chờ
    return this.keys[this.currentIndex].key;
  }

  markRateLimited(apiKey: string, cooldownDelayMs = 60000) {
    const state = this.keys.find(k => k.key === apiKey);
    if (state) {
      state.isRateLimited = true;
      state.cooldownUntil = Date.now() + cooldownDelayMs;
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }
}

export const ClientOpenRouterManager = new KeyManager(OPENROUTER_KEYS);
export const ClientGeminiManager = new KeyManager(GEMINI_KEYS);

// Generic key cycler execution framework
export async function fetchWithKeyRotation(
  manager: KeyManager,
  fetchFn: (apiKey: string) => Promise<Response>,
  maxAttempts = 3
): Promise<Response> {
  let attempts = 0;
  let lastError: any = null;

  while(attempts < maxAttempts) {
    const currentKey = manager.getKey();
    if (!currentKey) {
      throw new Error("No API keys available in environment mapping.");
    }

    attempts++;
    try {
      const response = await fetchFn(currentKey);
      
      if (response.status === 429 || response.status >= 500) {
        // Rate limited or overloaded -> mark logic and cycle next
        manager.markRateLimited(currentKey, response.status === 429 ? 60000 : 10000);
        lastError = new Error(`API Status ${response.status}`);
        continue; // Cycle round
      }

      if (!response.ok) {
        throw new Error(`API HTTP Error Status: ${response.status}`);
      }

      return response; // Success
    } catch (e: any) {
      lastError = e;
      // Network failure or immediate crash, rotate fallback key just in case
      manager.markRateLimited(currentKey, 5000);
    }
  }

  throw lastError || new Error("All API keys failed or rate-limited after multiple rotation attempts.");
}
