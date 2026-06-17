
interface ApiKeyInfo {
  key: string;
  isExhausted: boolean;
  lastUsed: number;
}

class ApiQueueManager {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;
  private delay = 2500; // ms between requests
  private keys: ApiKeyInfo[] = [];

  public getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      keysStatus: this.keys.map(k => ({ maskedKey: k.key.slice(-4), isExhausted: k.isExhausted }))
    };
  }

  constructor(apiKeys: string[]) {
    this.keys = apiKeys.map(key => ({ key, isExhausted: false, lastUsed: 0 }));
  }

  public async enqueue<T>(apiCall: (apiKey: string) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        const key = this.getAvailableKey();
        if (!key) throw new Error("All API keys are exhausted");
        
        try {
          const result = await apiCall(key.key);
          key.lastUsed = Date.now();
          resolve(result);
        } catch (err: any) {
          if (err.status === 429) {
            key.isExhausted = true;
            return this.enqueue(apiCall).then(resolve).catch(reject);
          }
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private getAvailableKey(): ApiKeyInfo | undefined {
    // Basic round-robin-ish key selection logic
    const available = this.keys.filter(k => !k.isExhausted);
    if (available.length === 0) return undefined;
    return available.sort((a, b) => a.lastUsed - b.lastUsed)[0];
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    const task = this.queue.shift();
    if (task) {
        await task();
        await new Promise(r => setTimeout(r, this.delay));
    }
    
    this.isProcessing = false;
    this.processQueue();
  }
}

// Initialize with placeholder keys (replace with real env vars)
// In a real scenario, these would come from .env
const keysPool = ["key1", "key2", "key3", "key4", "key5", "key6", "key7", "key8", "key9", "key10", "key11"];
export const apiManager = new ApiQueueManager(keysPool);
