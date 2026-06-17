export const runtime = 'edge';

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { safeFetch } from "../src/utils/safeFetch";

// Khởi tạo Upstash Redis cho Rate Limiting & Caching
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const cache = new Map();

// Cấu hình chặn spam: 5 request / 10s cho mỗi IP
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  ephemeralCache: cache, // In-memory caching for ultra speed
});

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Stateless Verification Middleware
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "[Stateless Auth] Token missing. Blocked at CDN border." }), { status: 401 });
  }

  // Lấy IP người dùng để giới hạn rate limit toàn cầu (Cloudflare/Vercel)
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  
  if (process.env.UPSTASH_REDIS_REST_URL) {
      const { success, limit, remaining, reset } = await ratelimit.limit(ip);
      if (!success) {
        return new Response(
          JSON.stringify({ error: "[Circuit Breaker] Quá tải request. Vui lòng thử lại sau vài giây." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
  }

  const payload = await req.json();
  const messages = payload.messages;
  const model = payload.model || "google/gemini-2.5-flash:free";
  const temperature = payload.temperature ?? 0.7;

  // Lấy danh sách pool key
  const OPENROUTER_KEYS: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`OPENROUTER_API_KEY_${i}`];
    if (k && !OPENROUTER_KEYS.includes(k)) OPENROUTER_KEYS.push(k);
  }
  const fallbackKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || "";
  if (fallbackKey && !OPENROUTER_KEYS.includes(fallbackKey)) OPENROUTER_KEYS.push(fallbackKey);
  
  const openRouterKey = OPENROUTER_KEYS[Math.floor(Math.random() * Math.max(1, OPENROUTER_KEYS.length))] || fallbackKey;

  if (!openRouterKey) {
      return new Response(JSON.stringify({ error: "Missing OpenRouter API Key in Edge Pool" }), { status: 500 });
  }

  try {
    const response = await safeFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://henosisweb.vercel.app",
        "X-Title": "Henosis Learning App"
      },
      body: JSON.stringify({
        model: model,
        messages,
        temperature: temperature,
        stream: true // ⚡ Bật Server-Sent Events (SSE) Streaming
      })
    });

    if (!response.ok) {
        return new Response(await response.text(), { status: response.status });
    }

    // ⚡ Trả trực tiếp Stream Data (SSE) về máy khách không lưu trong buffer bộ nhớ
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Edge Proxy Stream Error", details: error.message }), { status: 500 });
  }
}
