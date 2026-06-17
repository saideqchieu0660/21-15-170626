import localforage from "localforage";
// High-Performance Advanced API Client with Anti-Scraping Evasion and Robust Provider Failover
let isTripped = false;
let failureCount = 0;
let penaltyTier = 0;
let cooldownTimer: NodeJS.Timeout | null = null;

// ---- ADVANCED EVASION LISTS & GENERATORS ----

// Realistic User-Agent Strings (Updated for popular PC & Mobile browsers)
const USER_AGENTS = [
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  // Chrome on Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  // Safari on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  // Chrome on Android
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  // Safari on iPhone
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/605.1.15",
  // Edge on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
];

// Seeded proxy simulation and routing nodes list to prevent IP-sweeps and avoid server-level threshold locks
let PROXIES = [
  { url: "https://proxy-vn-central1.nodes.internal", region: "VN-Central", active: true },
  { url: "https://proxy-sg-primary.nodes.internal", region: "Singapore", active: true },
  { url: "https://proxy-us-west.nodes.internal", region: "US-West", active: true },
  { url: "https://proxy-tokyo-edge.nodes.internal", region: "Tokyo", active: true },
  { url: "https://proxy-frankfurt.nodes.internal", region: "Frankfurt", active: true }
];

// Helper to generate a random credible look-alike public IP address
function generateRandomIP() {
  const parts = [
    Math.floor(Math.random() * 140) + 40, // Avoid system IPs
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 254) + 1
  ];
  return parts.join(".");
}

// Generate random Accept-Language values to mimic authentic locale diversity
const ACCEPT_LANGUAGES = [
  "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "en-US,en;q=0.9",
  "en-GB,en;q=0.8,ms;q=0.6",
  "vi-VN,vi;q=0.9"
];

// ---- GLOBAL QUEUE SYSTEM & LOCKING ----
interface QueuedRequest {
  url: string;
  options?: RequestInit;
  resolve: (value: Response) => void;
  reject: (reason?: any) => void;
}

// Parallel Processing Threads: Force default to 2
const PARALLEL_LIMIT = 2; // Maximum concurrent pending calls from this client (Tăng tốc - 2 luồng)
const MIN_DELAY_BETWEEN_CALLS = 2500; // 2.5s base safety margin
let activeRequests = 0;
let lastCallTimestamp = 0;
const callQueue: QueuedRequest[] = [];

async function processQueue() {
  if (callQueue.length === 0 || activeRequests >= PARALLEL_LIMIT || isTripped) return;
  
  const now = Date.now();
  const timeSinceLast = now - lastCallTimestamp;
  
  // Enforce minimal delay between outgoing dispatched requests
  if (timeSinceLast < MIN_DELAY_BETWEEN_CALLS) {
     setTimeout(processQueue, MIN_DELAY_BETWEEN_CALLS - timeSinceLast);
     return;
  }

  const task = callQueue.shift();
  if (!task) return;

  activeRequests++;
  lastCallTimestamp = Date.now();

  try {
    const response = await executeFetchWithBackoffAndEvasion(task.url, task.options);
    task.resolve(response);
  } catch (err) {
    task.reject(err);
  } finally {
    activeRequests--;
    processQueue(); // proceed to the next in queue
  }
}

const MAX_FAILURES = 3;

function getCooldownTime() {
  if (penaltyTier === 1) return 5000;
  if (penaltyTier === 2) return 15000;
  return 30000;
}

function handleFailure() {
  failureCount++;
  if (failureCount >= MAX_FAILURES) {
    isTripped = true;
    penaltyTier++;
    const cooldownTime = getCooldownTime();
    
    if (cooldownTimer) {
      clearTimeout(cooldownTimer);
    }
    
    console.warn(`[apiClient Circuit Breaker] Tripped! Blocking requests for ${cooldownTime / 1000} seconds. Tier: ${penaltyTier}`);
    cooldownTimer = setTimeout(() => {
      isTripped = false;
      failureCount = 0;
      console.log('[apiClient Circuit Breaker] Reset: System is operational again.');
      processQueue(); // Resume queue operation
    }, cooldownTime);
  }
}

function resetCircuitBreaker() {
  failureCount = 0;
  penaltyTier = 0;
  isTripped = false;
}

// ---- ADVANCED FETCH WITH EVASION, RETRY & EXPOSURE MINIMIZATION ----

const INTERCEPTED_AI_ROUTES = [
  "/api/agent/lesson-plan",
  "/api/agent2/explain",
  "/api/agent3/chat",
  "/api/exam/generate",
  "/api/automation/process-chunk",
  "/api/convert-document-chunk",
  "/api/automation/hydrate-card",
  "/api/automation/validate-json"
];

function cleanJsonResponse(text: string): string {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  return cleanText.trim();
}

async function buildGroqPayload(url: string, parsedBody: any): Promise<{ model: string; messages: any[] }> {
  const model = "google/gemini-2.5-flash"; // Updated to Gemini 2.5 Flash for gold-standard stability and speed

  let messages: any[] = [];

  if (url.includes("/api/agent/lesson-plan")) {
    const topic = parsedBody.topic || "Chủ đề học tập";
    const prompt = `Bạn là một chuyên gia thiết kế chương trình giảng dạy (Instructional Designer).
Hãy tạo một giáo án học tập tối ưu cho chủ đề: "${topic}".
Giáo án cần đảm bảo đủ kiến thức sâu sắc, logic và dễ hiểu.
KHÔNG sử dụng Markdown code block. TRẢ VỀ ĐÚNG MỘT OBJECT JSON DUY NHẤT.
 
Định dạng JSON mẫu:
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
    messages = [
      { role: "system", content: "You are an elite instructional designer. You must only respond in JSON format conforming to the user's specification without markdown blocks." },
      { role: "user", content: prompt }
    ];
  } else if (url.includes("/api/agent2/explain")) {
    const { term, definition, fastMode } = parsedBody;
    let prompt = "";
    if (fastMode) {
      const defaultFast = `Giải nghĩa khái niệm "{term}" (Định nghĩa của người dùng: {definition}).\nYÊU CẦU QUAN TRỌNG NHẤT:\n1. ĐI THẲNG VÀO NỘI DUNG, BỎ QUA MỌI LỜI CHÀO HỎI xã giao hay câu mào đầu.\n2. Dài khoảng tối thiểu 250 chữ, giải thích bản chất súc tích nhưng đầy đủ sinh động, trực quan.\n3. BẮT BUỘC có cấu trúc:- Bản chất cốt lõi (1 câu cực gọn).- Đi sâu vào chi tiết giải thích bản chất thực sự của khái niệm.- 1 Ví dụ minh hoạ thực tế sinh động.- NẾU LÀ TIẾNG ANH: Bắt buộc cung cấp loại từ và giải thích cặn kẽ nguồn gốc (etymology) của từ để người học dễ nhớ hơn.- Kết bằng câu hỏi gợi mở suy luận.\nChỉ trả ra nội dung (markdown).`;
      let template = aiPromptsConfig?.agent2_fast || defaultFast;
      prompt = template.replace(/{term}/g, term).replace(/{definition}/g, definition || "Không có");
    } else {
      const defaultDetailed = `Phân tích khái niệm "{term}" (Định nghĩa: {definition}).\nYÊU CẦU QUAN TRỌNG NHẤT:\n1. ĐI THẲNG VÀO NỘI DUNG, BỎ QUA MỌI LỜI CHÀO HỎI xã giao hay câu mào đầu.\n2. Dài khoảng tối thiểu 250 chữ, giải thích bản chất cốt lõi cực kỳ chi tiết, dễ hiểu.\n3. BẮT BUỘC CÁC BƯỚC:\n- Định nghĩa & Bản chất cốt lõi.\n- NẾU LÀ TIẾNG ANH: Bắt buộc cung cấp loại từ và giải thích cặn kẽ nguồn gốc (etymology) của từ để người học có thể nhớ sâu hơn.\n- Mở rộng vấn đề và góc nhìn phân tích.\n- BẮT BUỘC kết thúc bằng 1 câu hỏi gợi mở liên quan đến ứng dụng hoặc tính chất cốt lõi để thúc đẩy học sinh tự suy nghĩ và phát triển kiến thức.\nBọc công thức Toán/Lý/Hóa bằng LaTeX (dấu $ hoặc $$). Chỉ trả ra nội dung (markdown).`;
      let template = aiPromptsConfig?.agent2_detailed || defaultDetailed;
      prompt = template.replace(/{term}/g, term).replace(/{definition}/g, definition || "Không có");
    }
    messages = [
      { role: "system", content: aiPromptsConfig?.agent2_system || "You are a professional educational coach. Answer immediately using clean Vietnamese Markdown without conversational introductions." },
      { role: "user", content: prompt }
    ];
  } else if (url.includes("/api/agent3/chat")) {
    const { message, history, context, mode, mcqData, difficulty, category_context, responseLength } = parsedBody;
    let { responseMode } = parsedBody;
    
    // Tầng 1 - Routing (nếu responseMode là auto)
    if (responseMode === "auto" && mode === "chat") {
      const tier1PromptTemplate = aiPromptsConfig?.agent3_tier1 || `Mày là Agent 3 Tier 1 Router. Phân tích ngữ cảnh và trả về đúng 1 từ khóa duy nhất: direct, debate, hoặc socrates.`;
      try {
        console.log("[Agent 3 Tier 1] Running routing logic...");
        const pool = getInterleavedPool();
        let content = "";
        const systemPrompt = { role: "system", content: tier1PromptTemplate };
        const userPrompt = { role: "user", content: `History: ${JSON.stringify(history?.slice(-3) || [])}\nMessage: ${message}` };

        for (const item of pool) {
          try {
            if (item.provider === "gemini") {
              content = await fetchGeminiDirect(item.key, [systemPrompt, userPrompt], false);
              break;
            } else if (item.provider === "groq") {
              content = await fetchGroqDirect(item.key, [systemPrompt, userPrompt], false);
              break;
            } else if (item.provider === "openRouter") {
              content = await fetchOpenRouterDirect(item.key, "google/gemini-2.5-flash", [systemPrompt, userPrompt], false);
              break;
            } else if (item.provider === "deepInfra") {
              content = await fetchDeepInfraDirect(item.key, [systemPrompt, userPrompt], false);
              break;
            }
          } catch (e) {
            continue; // try next key
          }
        }
        
        content = content.trim().toLowerCase();
        if (content.includes("direct")) {
          responseMode = "direct";
        } else if (content.includes("debate")) {
          responseMode = "debate";
        } else {
          responseMode = "socrates";
        }
        console.log(`[Agent 3 Tier 1] Router decided: ${responseMode}`);
      } catch (tier1Err) {
        console.warn("[Agent 3 Tier 1] Routing failed, defaulting to socratic", tier1Err);
        responseMode = "socratic";
      }
    }
    
    let styleGuidance = "";
    if (responseLength === "super_detailed") {
      const defaultSuperDetailed = `\nĐỘ CHI TIẾT - SIÊU CHI TIẾT (SUPER DETAILED MODE):
- BẮT BUỘC TỐI CAO: Tập trung phân tích chuyên sâu toàn bộ bản chất khoa học và nguồn gốc vấn đề từ cốt lõi. Phân chia nhỏ các khía cạnh bằng các đề mục lớn.
- BẮT BUỘC TỐI CAO: Trả lời cực kỳ dài dặn, đầy đủ chi tiết, dồi dào chữ nghĩa, cặn kẽ và phong phú (tối thiểu bắt buộc 600 từ). Tuyệt đối cấm trả lời sơ sài hoặc ngắn gọn!
- Cung cấp ít nhất 3 ví dụ minh họa thực tế sinh động. Cắt nghĩa cặn kẽ từng thứ.
- Tuyệt đối bỏ qua hoàn toàn mọi yêu cầu viết ngắn gọn.`;
      styleGuidance = aiPromptsConfig?.agent3_length_super_detailed || defaultSuperDetailed;
    } else if (responseLength === "detailed") {
      const defaultDetailed = `\nĐỘ CHI TIẾT - CHI TIẾT (DETAILED MODE):
- Tập trung vào bản chất cốt lõi. Trả lời chi tiết ở mức độ vừa đủ trọn vẹn.
- Dài khoảng 250 - 400 chữ.
- Bắt buộc có 1 - 2 ví dụ cụ thể để làm rõ nghĩa.
- Không được quá siêu ngắn gọn, nhưng cũng đừng lê thê lan man, giữ độ dài lý tưởng.`;
      styleGuidance = aiPromptsConfig?.agent3_length_detailed || defaultDetailed;
    } else {
      const defaultConcise = `\nĐỘ CHI TIẾT - SÚC TÍCH (CONCISE MODE):
- Trả lời cực kỳ ngắn gọn, tối giản (chỉ 1-3 câu).
- Đi thẳng vào bản chất cốt lõi, không giải thích dông dài phụ họa.`;
      styleGuidance = aiPromptsConfig?.agent3_length_concise || defaultConcise;
    }

    const englishRuleTemplate = aiPromptsConfig?.agent3_english_rule || `\nĐẶC QUYỀN VỀ TIẾNG ANH & GIAO TIẾP: Đi thẳng vào nội dung, bỏ qua mọi lời chào hỏi xã giao. Nếu câu hỏi liên quan đến tiếng Anh (từ vựng, thuật ngữ...), BẮT BUỘC cung cấp loại từ (part of speech) và giải thích nguồn gốc của nó (etymology) để giúp người học dễ nhớ hơn.`;
    const englishRule = englishRuleTemplate;

    let systemPrompt = "";
    if (responseMode === "direct") {
      const defaultDirect = `Mày là trợ lý AI tên Agent 3 (Direct Robot Mode).
ĐIỀU KHOẢN TỐI THƯỢNG:
1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày". CẤM DÙNG TỪ "bạn", "tôi", "mình", "anh/chị".
2. TRẢ LỜI TRỰC TIẾP: KHÔNG áp dụng Socratic. KHÔNG hỏi ngược lại người dùng. Đưa trực tiếp câu trả lời ra.
3. KHÔNG BẮT CHƯỚC LỊCH SỬ NẾU SAI CHẾ ĐỘ. Tự chỉnh lại độ dài/văn phong ngay lập tức.
4. FORMAT: Dùng LaTeX ($$, $).{englishRule}
{styleGuidance}`;
      let template = aiPromptsConfig?.agent3_direct || defaultDirect;
      systemPrompt = template.replace("{englishRule}", englishRule).replace("{styleGuidance}", styleGuidance);
    } else if (responseMode === "debate") {
      const defaultDebate = `Mày là trợ lý AI tên Agent 3 (Devil's Advocate / Tranh biện Mode).
ĐIỀU KHOẢN TỐI THƯỢNG:
1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày".
2. ĐÓNG VAI ĐỐI THỦ TRANH LUẬN: Luôn đóng vai phản biện gắt gao. Cấm xuôi theo ý người dùng. Cố tình vạch trần sơ hở tư duy.
3. BUỘC NGƯỜI DÙNG PHÒNG THỦ: Luôn kết thúc bằng một câu hỏi xoáy, thách thức lập trường hiện tại của người dùng.
4. FORMAT: Dùng LaTeX ($$, $).{englishRule}
{styleGuidance}`;
      let template = aiPromptsConfig?.agent3_debate || defaultDebate;
      systemPrompt = template.replace("{englishRule}", englishRule).replace("{styleGuidance}", styleGuidance);
    } else {
      const defaultSocraticLong = `2. PHƯƠNG PHÁP SOCRATIC: BẮT BUỘC PHẢI THỰC HIỆN ĐẦY ĐỦ số lượng chữ đã yêu cầu trước (dài dặn cặn kẽ), CẤM TRẢ LỜI NGẮN. Sau khi giải thích xong theo đúng chuẩn chiều dài, chỉ đặt MỘT VÀ CHỈ MỘT câu hỏi gợi mở ở TẬN CÙNG để thúc đẩy tự suy nghĩ.`;
      const defaultSocraticShort = `2. PHƯƠNG PHÁP SOCRATIC: Không bao giờ cho đáp án dễ dàng. Luôn dồn ép bằng câu hỏi gợi mở suy luận.`;
      
      const socraticRule = (responseLength === "detailed" || responseLength === "super_detailed")
        ? (aiPromptsConfig?.agent3_socratic_long_rule || defaultSocraticLong)
        : (aiPromptsConfig?.agent3_socratic_short_rule || defaultSocraticShort);
        
      const defaultSocrates = `Mày là Agent 3 - Socrates AI Coach.
QUY TẮC CỐT LÕI:
1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày". Cấm dùng "bạn", "tôi", "mình".
{socraticRule}
3. CẤM BẮT CHƯỚC ĐỘ DÀI LỊCH SỬ NẾU HIỆN TẠI YÊU CẦU ĐỘ DÀI KHÁC. Phải tuân theo yêu cầu hiện tại.
4. FORMAT: Dùng LaTeX.{englishRule}
{styleGuidance}`;
      let template = aiPromptsConfig?.agent3_socrates || defaultSocrates;
      systemPrompt = template.replace("{socraticRule}", socraticRule).replace("{englishRule}", englishRule).replace("{styleGuidance}", styleGuidance);
    }

    let prompt = "";
    if (mode === "quiz" && mcqData) {
      let difficultyGuidance = "Cấp độ trung bình.";
      const diffLevel = difficulty || "medium";
      if (diffLevel === "easy") difficultyGuidance = "Cấp độ dễ: Hỏi trực tiếp định nghĩa cơ bản, nhận biết trực tiếp.";
      if (diffLevel === "medium") difficultyGuidance = "Cấp độ trung bình: Yêu cầu hiểu sâu hơn, áp dụng cơ bản.";
      if (diffLevel === "hard") difficultyGuidance = "Cấp độ khó: Đánh đố, vận dụng cao, suy luận logic tổng hợp.";
      
      if (category_context) {
        prompt = `Tạo một bài Test 15 câu trắc nghiệm MCQ cho mục học "${category_context.name}". Giới hạn phạm vi tạo câu hỏi CHỈ xoay quanh các khái niệm, định nghĩa và kiến thức học tập trong mục học này dựa trên danh sách thẻ dữ liệu dưới đây. Độ khó: ${difficultyGuidance}\nTrả về đúng 1 mảng JSON chứa các object: {"question": "...", "options": ["A...","B...","C...","D..."], "correctIndex": 0..3, "explanation": "..."}. KHÔNG trả về thứ gì khác ngoài JSON.\nDữ liệu các thẻ trong mục học này: ${JSON.stringify(mcqData)}`;
      } else {
        prompt = `Tạo một bài Test 15 câu trắc nghiệm MCQ dựa trên danh sách các thẻ yếu sau đây. \nĐộ khó: ${difficultyGuidance}\nTrả về đúng 1 mảng JSON chứa các object: {"question": "...", "options": ["A...","B...","C...","D..."], "correctIndex": 0..3, "explanation": "..."}. KHÔNG trả về gì khác ngoài JSON.\nDữ liệu hổng kiến thức: ${JSON.stringify(mcqData)}`;
      }
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];
    } else {
      let previousHistoryText = "";
      if (history && Array.isArray(history)) {
        previousHistoryText = history.map(msg => {
           const label = msg.role === "ai" ? "AI" : "USER";
           let text = msg.text;
           if (msg.role === "ai") {
              text = text.replace(/\bBạn\b/g, "Mày").replace(/\bbạn\b/g, "mày")
                         .replace(/\bMình\b/g, "Tao").replace(/\bmình\b/g, "tao");
           }
           return `${label}: ${text}`;
        }).join("\n---\n");
      }
      
      const defaultLengthReminder = "[LỜI NHẮC LÕI]: MÀY ĐANG Ở CHẾ ĐỘ CHI TIẾT. HÃY PHỚT LỜ LỊCH SỬ NGẮN GỌN TRƯỚC ĐÓ! BẮT BUỘC PHẢI GIẢI THÍCH DÀI DẰNG DẶC.";
      const lengthReminderText = (responseLength === "detailed" || responseLength === "super_detailed")
        ? (aiPromptsConfig?.agent3_length_reminder || defaultLengthReminder)
        : "";

      const fullPrompt = `
=== LỊCH SỬ CHAT TRƯỚC ĐÓ ===
${previousHistoryText || "(Không có)"}
=== HẾT LỊCH SỬ CHAT ===

NGỮ CẢNH BỔ SUNG: ${context || "Không có"}

[CÂU HỎI MỚI CỦA HỌC SINH]: ${message}

${lengthReminderText}
`;
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullPrompt }
      ];
    }
  } else if (url.includes("/api/exam/generate")) {
    const { decks, count } = parsedBody;
    const contextData = JSON.stringify((decks || []).map((d: any) => ({
      deckId: d.id,
      deckTitle: d.title,
      cards: (d.cards || []).map((c: any) => ({ cardId: c.id, front: c.front, back: c.back }))
    })));

    const prompt = `Bạn là một AI được thiết kế để tạo bài kiểm tra tự động từ các thẻ (flashcards) được cung cấp.
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
    messages = [
      { role: "system", content: "You are a professional quiz builder. Return ONLY a single minified JSON array as described." },
      { role: "user", content: prompt }
    ];
  } else if (url.includes("/api/automation/process-chunk")) {
    const { textChunk, isDegraded, targetMin = 4, targetMax = 15 } = parsedBody;
    const defaultNormalPrompt = `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.
 
Each flashcard object MUST have:
- front: English word/phrase.
- ipa: Accurate IPA pronunciation.
- wordForm: noun|verb|adjective|adverb|phrasal verb|idiom.
- back: Concise Vietnamese translation.
- example: Illustrative English sentence with its Vietnamese translation in parentheses immediately following.
- origin: The matching raw word, phrase or context from the original text chunk.
 
STRICT CARD COUNT COHERENCE & LIMITS:
- You MUST extract between {targetMin} and {targetMax} highly valuable vocabulary terms or phrases from the provided source text.
- Do NOT generate fewer than {targetMin} or more than {targetMax} cards under any circumstances to keep output sizes deterministic and protect API bandwidth.
 
SMART VOCABULARY YIELD & ACADEMIC BALANCE:
1. RELAXED ACADEMIC FILTERING: Focus on selecting prominent nouns, verbs, adjectives, and adverbs that have educational or lexical value from the source text. Look for ANY core vocabulary words, useful academic collocations, or idiomatic expressions that would be beneficial for a student to study.
2. MINIMUM YIELD GUARDRAIL: Analyze the provided text packet thoroughly. If the text contains readable English sentences or word lists, you MUST extract at least {targetMin} useful vocabulary terms from it. Do not return an empty array [] unless the input string is completely devoid of English words.
3. CRITICAL LINGUISTIC HYGIENE: While we want high selection yield, you are strictly FORBIDDEN from extracting pure machine or layout strings, such as standalone bracket tokens, single-character noise, or raw PDF/programming syntax markers (like "obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref").
4. STRICT CONTEXTUAL VERIFICATION: Avoid technical parameters, variable namespace tokens, or system property names being used as coding variables in the source text. Focus on genuine words used in human communication.
 
Rule Checklist:
1. Return ONLY a valid minified JSON array [].
2. No markdown wrapper.
3. Maintain maximum yield of legitimate advanced and useful vocabularies.
 
Original Source Text:
{textChunk}`;

    const defaultDegradedPrompt = `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.
 
Each flashcard object MUST have ONLY these critical fields:
- front: English word/phrase.
- ipa: Accurate IPA pronunciation.
- wordForm: noun|verb|adjective|adverb|phrasal verb|idiom.
- back: Concise Vietnamese translation.
 
(IMPORTANT: Drop the heavy fields like 'example' and 'origin' entirely to prevent computation timeout. Do not include 'example' or 'origin' in the JSON return structure. Return ONLY fields: front, ipa, wordForm, back).
 
STRICT CARD COUNT COHERENCE & LIMITS:
- You MUST extract between {targetMin} and {targetMax} highly valuable vocabulary terms or phrases from the provided source text.
- Do NOT generate fewer than {targetMin} or more than {targetMax} cards under any circumstances to keep output sizes deterministic and protect API bandwidth.
 
SMART VOCABULARY YIELD & ACADEMIC BALANCE:
1. RELAXED ACADEMIC FILTERING: Focus on selecting prominent nouns, verbs, adjectives, and adverbs that have educational or lexical value from the source text. Look for ANY core vocabulary words, useful academic collocations, or idiomatic expressions that would be beneficial for a student to study.
2. MINIMUM YIELD GUARDRAIL: Analyze the provided text packet thoroughly. If the text contains readable English sentences or word lists, you MUST extract at least {targetMin} useful vocabulary terms from it. Do not return an empty array [] unless the input string is completely devoid of English words.
3. CRITICAL LINGUISTIC HYGIENE: While we want high selection yield, you are strictly FORBIDDEN from extracting pure machine or layout strings, such as standalone bracket tokens, single-character noise, or raw PDF/programming syntax markers (like "obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref").
4. STRICT CONTEXTUAL VERIFICATION: Avoid technical parameters, variable namespace tokens, or system property names being used as coding variables in the source text. Focus on genuine words used in human communication.
 
Rule Checklist:
1. Return ONLY a valid minified JSON array [].
2. No markdown wrapper.
3. Maintain maximum yield of legitimate advanced and useful vocabularies.
 
Original Source Text:
{textChunk}`;

    let normalPromptTemplate = aiPromptsConfig?.united_process_chunk_normal || defaultNormalPrompt;
    const normalPrompt = normalPromptTemplate
      .replace(/{targetMin}/g, targetMin.toString())
      .replace(/{targetMax}/g, targetMax.toString())
      .replace(/{textChunk}/g, textChunk);

    let degradedPromptTemplate = aiPromptsConfig?.united_process_chunk_degraded || defaultDegradedPrompt;
    const degradedPrompt = degradedPromptTemplate
      .replace(/{targetMin}/g, targetMin.toString())
      .replace(/{targetMax}/g, targetMax.toString())
      .replace(/{textChunk}/g, textChunk);

    const actPrompt = isDegraded ? degradedPrompt : normalPrompt;
    messages = [
      { role: "system", content: "You are an elite lexicographer. Return ONLY a valid JSON array of extracted flashcards according to the user's instructions. Do not use Markdown wraps." },
      { role: "user", content: actPrompt }
    ];
  } else if (url.includes("/api/convert-document-chunk")) {
    const { chunkWords } = parsedBody;
    const defaultPrompt = `[STRICT DETERMINISTIC MODE] Bạn là một cỗ máy biên dịch dữ liệu (Data Compiler).
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
{chunkWords}`;
    let promptTemplate = aiPromptsConfig?.united_convert_document_chunk || defaultPrompt;
    const prompt = promptTemplate.replace(/{chunkWords}/g, (chunkWords || []).join("\n"));

    messages = [
      { role: "system", content: "You are a compiler. Output ONLY a valid JSON array conforming to the specification." },
      { role: "user", content: prompt }
    ];
  } else if (url.includes("/api/automation/hydrate-card")) {
    const { front, wordForm, back } = parsedBody;
    const defaultPrompt = `You are an expert English-Vietnamese lexicographer. Provide a high-quality illustrative example sentence for this English word/phrase.
          
Word: {front}
Part of Speech: {wordForm}
Meaning: {back}
 
Return ONLY a minified JSON object with these EXACT keys:
{
  "example": "Illustrative English sentence with its Vietnamese translation in parentheses immediately following.",
  "origin": "An appropriate context snippet matching the word."
}
 
Do not include any markdown wrapper or extra text.`;
    let promptTemplate = aiPromptsConfig?.united_hydrate_card || defaultPrompt;
    const prompt = promptTemplate
      .replace(/{front}/g, front)
      .replace(/{wordForm}/g, wordForm || "unknown")
      .replace(/{back}/g, back || "unknown");

    messages = [
      { role: "system", content: "You are an expert lexicographer. Return ONLY a single minified JSON object as specified." },
      { role: "user", content: prompt }
    ];
  } else if (url.includes("/api/automation/validate-json")) {
    const { jsonText } = parsedBody;
    const defaultPrompt = `Bạn là một AI chuyên gia kiểm duyệt, làm sạch và sửa lỗi cú pháp dữ liệu cấu trúc (JSON Validator & Repairer).
Nhiệm vụ của bạn là nhận vào một chuỗi văn bản (gồm JSON chuẩn, hoặc JSON bị thiếu ngoặc, thừa dấu phẩy, bị bọc trong markdown) và sửa lỗi cú pháp, sau đó chuẩn hóa thành một mảng JSON Array chính xác:
 
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
- KHÔNG có bất kỳ lời giải thích dông dài nào. Nếu không hợp lệ, trả về mảng rỗng [].
 
Dữ liệu đầu vào cần sửa lỗi:
{jsonText}`;
    let promptTemplate = aiPromptsConfig?.united_validate_json || defaultPrompt;
    const prompt = promptTemplate.replace(/{jsonText}/g, jsonText);

    messages = [
      { role: "system", content: "You are an expert JSON normalizer. Output ONLY a valid JSON array conforming to the specification." },
      { role: "user", content: prompt }
    ];
  }

  return { model, messages };
}

// Smart Circuit Breaker configuration for OpenRouter (Server boundary)
let openRouterDisabledUntil = 0;
let openRouterConsecutiveFailures = 0;

// Force robust 45s Timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, ms = 45000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchOpenRouterWithBackoff(model: string, messages: any[], attemptsLeft = 1, delayMs = 500): Promise<string> {
  if (Date.now() < openRouterDisabledUntil) {
    throw new Error("Circuit Breaker: OpenRouter is currently disabled. Fast fallback to Gemini.");
  }

  try {
    const rawRes = await fetchWithTimeout("/api/proxy/openrouter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4096 // Force-set directly to 4096
      })
    }, 45000);

    if (rawRes.ok) {
      const data = await rawRes.json();
      if (data && typeof data.content === "string") {
        openRouterConsecutiveFailures = 0;
        return data.content;
      }
    }
    
    // Yêu cầu: Silent bypass for 404, 403, 402, or "paid version" errors
    const errText = await rawRes.text();
    if ([402, 403, 404].includes(rawRes.status) || errText.toLowerCase().includes("unavailable for free") || errText.toLowerCase().includes("paid version")) {
       console.warn(`[apiClient Silent Bypass] Provider error: ${rawRes.status} - ${errText}`);
       throw new Error("PROVIDER_SILENT_FAIL"); // Đánh dấu để key rotation nhảy sang key tiếp theo
    }
    
    throw new Error(`Proxy error: ${rawRes.status} - ${errText}`);
  } catch (proxyErr: any) {
    if (proxyErr.message && (proxyErr.message.includes("503") || proxyErr.message.includes("disabled") || proxyErr.message.includes("tắt"))) {
      console.warn("[apiClient Circuit Breaker] OpenRouter disabled on backend. Skipping client fallback.");
      throw proxyErr;
    }
    console.warn("[apiClient] Backend OpenRouter proxy route failed, checking client-side key fallback...", proxyErr.message || proxyErr);
    
    const { ClientOpenRouterManager, fetchWithKeyRotation } = await import("../lib/gemini").catch(() => ({ ClientOpenRouterManager: null, fetchWithKeyRotation: null }));
    
    if (ClientOpenRouterManager && ClientOpenRouterManager.getKey() !== null) {
      try {
        const rawRes = await fetchWithKeyRotation!(ClientOpenRouterManager, (apiKey) => {
          return fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": "https://henosisweb.vercel.app",
              "X-Title": "Henosis Learning App"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash", // Updated to Gemini 2.5 Flash for gold-standard stability and speed
              messages,
              temperature: 0.7,
              max_tokens: 4096 // Force-set directly to 4096
            })
          });
        }, Math.max(2, attemptsLeft));

        if (!rawRes.ok) {
          const errText = await rawRes.text();
          console.error("OpenRouter Error Details:", errText);
          throw new Error(`Rotated direct key error: ${rawRes.status}`);
        }

        const data = await rawRes.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content === undefined || content === null) {
          throw new Error("Empty content returned from rotated direct OpenRouter API.");
        }
        
        openRouterConsecutiveFailures = 0;
        return content;
      } catch (err: any) {
        console.warn(`[OpenRouter Rotator Direct Client] Exhausted fallback rotation. Error:`, err);
      }
    } else {
      const singleKey = import.meta.env.VITE_OPENROUTER_KEY || "";
      if (singleKey) {
        try {
          const rawRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${singleKey}`,
              "HTTP-Referer": "https://henosisweb.vercel.app",
              "X-Title": "Henosis Learning App"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash", // Updated to Gemini 2.5 Flash for gold-standard stability and speed
              messages,
              temperature: 0.7,
              max_tokens: 4096 // Force-set directly to 4096
            })
          });

          if (rawRes.status === 429) {
             throw new Error("429 Rate limit single key fallback");
          }

          if (!rawRes.ok) {
            const errText = await rawRes.text();
            console.error("OpenRouter Error Details:", errText);
            throw new Error("HTTP " + rawRes.status);
          }
          
          const data = await rawRes.json();
          openRouterConsecutiveFailures = 0;
          return data?.choices?.[0]?.message?.content;
        } catch (singleErr) {
           console.warn("Single key fallback failed too", singleErr);
        }
      }
    }
    
    openRouterConsecutiveFailures++;
    if (openRouterConsecutiveFailures >= 2) {
       openRouterDisabledUntil = Date.now() + 15 * 60 * 1000;
       console.warn("[apiClient Circuit Breaker] OpenRouter failed twice consecutively. Disabling OpenRouter route for 15 minutes.");
    }
    
    throw new Error("No valid OpenRouter provider available. " + (proxyErr.message || proxyErr));
  }
}

async function mapOpenRouterResponse(url: string, content: string): Promise<Response> {
  const cleanContent = cleanJsonResponse(content);
  let parsedData: any = null;

  if (url.includes("/api/agent/lesson-plan") || url.includes("/api/agent2/explain") || url.includes("/api/agent3/chat") || url.includes("/api/exam/generate")) {
    parsedData = { result: content }; 
  } else if (url.includes("/api/automation/process-chunk") || url.includes("/api/automation/validate-json")) {
    try {
      const parsed = JSON.parse(cleanContent);
      parsedData = { success: true, cards: parsed, keyIndex: "OpenRouter", keyMasked: "OR-Gemma2" };
    } catch (e) {
      const match = cleanContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        parsedData = { success: true, cards: JSON.parse(match[0]), keyIndex: "OpenRouter", keyMasked: "OR-Gemma2" };
      } else {
        throw new Error("Unable to parse response as clean JSON array.");
      }
    }
  } else if (url.includes("/api/convert-document-chunk")) {
    try {
      const parsed = JSON.parse(cleanContent);
      parsedData = { flashcards: parsed };
    } catch (e) {
      const match = cleanContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        parsedData = { flashcards: JSON.parse(match[0]) };
      } else {
        throw new Error("Unable to parse response as clean document-chunk array.");
      }
    }
  } else if (url.includes("/api/automation/hydrate-card")) {
    try {
      const parsed = JSON.parse(cleanContent);
      parsedData = { success: true, example: parsed.example || "", origin: parsed.origin || "" };
    } catch (e) {
      throw new Error("Unable to parse hydrated card JSON.");
    }
  }

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => parsedData,
    text: async () => JSON.stringify(parsedData),
    clone: () => {
      let isRead = false;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => {
          if (isRead) throw new TypeError("Failed to execute 'json' on 'Response': body stream already read");
          isRead = true;
          return parsedData;
        },
        text: async () => {
          if (isRead) throw new TypeError("Failed to execute 'text' on 'Response': body stream already read");
          isRead = true;
          return JSON.stringify(parsedData);
        }
      } as unknown as Response;
    }
  } as unknown as Response;
}

// ---- ROUND-ROBIN CROSS-PROVIDER API ROTATION WITH DYNAMIC FILTERING ----

export interface ProviderConfig {
  openRouter: boolean;
  gemini: boolean;
  groq: boolean;
  deepInfra: boolean;
}

export let apiProviderConfig: ProviderConfig = {
  openRouter: true,
  gemini: true,
  groq: true,
  deepInfra: true
};

try {
  const stored = localStorage.getItem("henosis_provider_config");
  if (stored) {
    apiProviderConfig = { ...apiProviderConfig, ...JSON.parse(stored) };
  }
} catch (e) {
  // safe fallback
}

export function updateApiProviderConfig(newConfig: Partial<ProviderConfig>) {
  apiProviderConfig = { ...apiProviderConfig, ...newConfig };
  try {
    localStorage.setItem("henosis_provider_config", JSON.stringify(apiProviderConfig));
  } catch (e) {}
}

export let aiPromptsConfig: any = {};

export async function syncAIPrompts() {
  try {
    const res = await fetch(`/api/admin/ai-prompts?t=${Date.now()}`);
    if (res.ok) {
      const resp = await res.json();
      if (resp && resp.success && resp.data) {
        aiPromptsConfig = resp.data;
      }
    }
  } catch (e) {
    // Silent catch
  }
}

async function syncProviderToggles() {
  try {
    const res = await fetch("/api/admin/api-toggles");
    if (res.ok) {
      const data = await res.json();
      updateApiProviderConfig({
        openRouter: data.openRouterEnabled !== false,
        gemini: data.geminiEnabled !== false,
        groq: data.groqEnabled !== false,
        deepInfra: data.deepInfraEnabled !== false
      });
      console.log("[apiClient] Automatically synchronized active provider toggles from server:", apiProviderConfig);
    }
  } catch (e) {
    // Silent catch
  }
}

if (typeof window !== "undefined") {
  setTimeout(syncProviderToggles, 1000);
  setInterval(syncProviderToggles, 30000); // Periodically check for remote API circuit breaker flips from administrator
  
  setTimeout(syncAIPrompts, 1500);
  setInterval(syncAIPrompts, 45000); // Periodically check for remote AI prompts adjustments
}

// Utility to parse environment keys, avoiding duplicates
export function parseKeys(prefixes: string[]): string[] {
  const keys: string[] = [];
  try {
    for (const [envKey, envVal] of Object.entries(import.meta.env)) {
      if (prefixes.some(p => envKey.startsWith(p)) && typeof envVal === 'string' && envVal.trim()) {
        const val = envVal.trim();
        if (!keys.includes(val)) {
          keys.push(val);
        }
      }
    }
  } catch (e) {
    // catch mapping access restriction errors
  }
  return keys;
}

export interface InterleavedKey {
  key: string;
  provider: "openRouter" | "gemini" | "groq" | "deepInfra";
}

let globalPoolIndex = 0;

// ---- ADVANCED KEY COOLDOWN MANAGER ----
export interface KeyState {
  key: string;
  provider: "openRouter" | "gemini" | "groq" | "deepInfra";
  status: "ACTIVE" | "COOLING" | "DEPLETED";
  cooldownUntil: number;
}

export const keyRegistry = new Map<string, KeyState>();

async function reportKeyUsageToServer(provider: string, key: string, metric: "usage" | "error", errorText?: string) {
  try {
    fetch("/api/admin/report-key-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key, metric, error: errorText })
    }).catch(() => {});
  } catch (err) {
    console.warn("[apiClient] Failed to report key usage to server:", err);
  }
}

export function handleKeyError(key: string, provider: "openRouter" | "gemini" | "groq" | "deepInfra", status: number, bodyText: string) {
  let state = keyRegistry.get(key);
  if (!state) {
    state = { key, provider, status: "ACTIVE", cooldownUntil: 0 };
    keyRegistry.set(key, state);
  }

  // Report error key usage to server
  reportKeyUsageToServer(provider, key, "error", `Status ${status}: ${bodyText.substring(0, 300)}`);

  // Pipe raw error to debugger console
  console.error(`[DEBUGGER] Key failure detected on provider ${provider}. Status code: ${status}. Error body:`, bodyText);

  const normalizedText = bodyText.toLowerCase();
  
  // Model Not Found (404), Quota/Billing exceeded strings
  const isDepleted = status === 404 || status === 401 || status === 403 ||
                     normalizedText.includes("quota, please check your plan") || 
                     normalizedText.includes("exceeded your current quota") ||
                     normalizedText.includes("hard quota") ||
                     normalizedText.includes("billing") ||
                     normalizedText.includes("credit") ||
                     normalizedText.includes("limit_exceeded") ||
                     normalizedText.includes("model not found") ||
                     normalizedText.includes("not_found") ||
                     normalizedText.includes("unauthorized") ||
                     normalizedText.includes("forbidden") ||
                     normalizedText.includes("invalid api key");

  // Rate Limiting (429) or Server Error (5xx)
  const isCooling = status === 429 || 
                    status >= 500 ||
                    status === 408 || // Timeout fast fail mapping
                    normalizedText.includes("rate limit") || 
                    normalizedText.includes("too many requests") || 
                    normalizedText.includes("429") ||
                    normalizedText.includes("requests limit") ||
                    normalizedText.includes("tps");

  if (isDepleted) {
    state.status = "DEPLETED";
    state.cooldownUntil = Date.now() + 5 * 60 * 1000; // 5 minutes (300000 ms) quarantine 
    console.warn(`[Key Cooldown Manager] Key (${provider}) marked DEPLETED for 5m due to status ${status} / quota / auth / model issues.`, key.substring(0, 10) + "...");
  } else if (isCooling) {
    state.status = "COOLING";
    state.cooldownUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
    console.warn(`[Key Cooldown Manager] Key (${provider}) marked COOLING for 5m due to status ${status} / rate limit.`, key.substring(0, 10) + "...");
  }
}

export function getInterleavedPool(): InterleavedKey[] {
  const geminiKeysRaw: string[] = [];
  const openRouterKeys: string[] = [];
  const deepInfraKeys: string[] = [];
  const groqKeysRaw: string[] = [];

  // Safe process.env accessor to avoid ReferenceError on client environment
  const safeProcessEnv = (typeof process !== "undefined" && process?.env) ? process.env : {};

  // Clean helper
  const cleanKey = (val: any): string => {
    if (!val || typeof val !== "string") return "";
    const clean = val.trim();
    if (clean === "undefined" || clean === "null" || clean === "") return "";
    return clean;
  };

  // Safe literal mapping for Vite production (import.meta.env does not support dynamic indexing)
  const getEnv = (k: string) => {
    try { 
      // Keep process.env lookup for server-side
      return typeof process !== 'undefined' ? process.env[k] : undefined; 
    } catch(e) { return undefined; }
  };

  const getViteEnv = (v: any) => {
      try { return v; } catch(e) { return undefined; }
  }

  const geminiEnvKeys = [
    getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_1), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_2), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_3),
    getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_4), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_5), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_6),
    getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_7), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_8), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_9),
    getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_10), getViteEnv(import.meta.env?.VITE_GEMINI_API_KEY_11)
  ];

  // 1. Parse Gemini Keys: process.env.GEMINI_API_KEY_1 to process.env.GEMINI_API_KEY_11
  for (let i = 1; i <= 11; i++) {
    const k1 = cleanKey(safeProcessEnv[`GEMINI_API_KEY_${i}`]);
    if (k1) geminiKeysRaw.push(k1);

    const k2 = cleanKey(safeProcessEnv[`VITE_GEMINI_API_KEY_${i}`]);
    if (k2) geminiKeysRaw.push(k2);

    const k3 = cleanKey(geminiEnvKeys[i - 1]);
    if (k3) geminiKeysRaw.push(k3);
  }

  // Single default fallback Gemini keys
  const gf1 = cleanKey(safeProcessEnv.GEMINI_API_KEY);
  if (gf1) geminiKeysRaw.push(gf1);
  const gf2 = cleanKey(safeProcessEnv.VITE_GEMINI_API_KEY);
  if (gf2) geminiKeysRaw.push(gf2);
  try {
    const gf3 = cleanKey(import.meta.env?.VITE_GEMINI_API_KEY);
    if (gf3) geminiKeysRaw.push(gf3);
  } catch (e) {}

  const openRouterEnvKeysApi = [
    getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_1), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_2), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_3),
    getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_4), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_5), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_6),
    getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_7), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_8), getViteEnv(import.meta.env?.VITE_OPENROUTER_API_KEY_9)
  ];
  const openRouterEnvKeys = [
    getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_1), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_2), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_3),
    getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_4), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_5), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_6),
    getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_7), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_8), getViteEnv(import.meta.env?.VITE_OPENROUTER_KEY_9)
  ];

  // 2. Parse OpenRouter Keys: Loop 1 to 9
  for (let i = 1; i <= 9; i++) {
    const k1 = cleanKey(safeProcessEnv[`OPENROUTER_KEY_${i}`]);
    if (k1) openRouterKeys.push(k1);

    const k2 = cleanKey(safeProcessEnv[`OPENROUTER_API_KEY_${i}`]);
    if (k2) openRouterKeys.push(k2);

    const k3 = cleanKey(safeProcessEnv[`VITE_OPENROUTER_API_KEY_${i}`]);
    if (k3) openRouterKeys.push(k3);

    const k4 = cleanKey(safeProcessEnv[`VITE_OPENROUTER_KEY_${i}`]);
    if (k4) openRouterKeys.push(k4);

    const k5 = cleanKey(openRouterEnvKeysApi[i - 1]);
    if (k5) openRouterKeys.push(k5);

    const k6 = cleanKey(openRouterEnvKeys[i - 1]);
    if (k6) openRouterKeys.push(k6);
  }

  // Single default fallback OR keys
  const orf1 = cleanKey(safeProcessEnv.OPENROUTER_API_KEY);
  if (orf1) openRouterKeys.push(orf1);
  const orf2 = cleanKey(safeProcessEnv.VITE_OPENROUTER_API_KEY);
  if (orf2) openRouterKeys.push(orf2);
  const orf3 = cleanKey(safeProcessEnv.VITE_OPENROUTER_KEY);
  if (orf3) openRouterKeys.push(orf3);
  try {
    const orf4 = cleanKey(import.meta.env?.VITE_OPENROUTER_API_KEY);
    if (orf4) openRouterKeys.push(orf4);
  } catch (e) {}
  try {
    const orf5 = cleanKey(import.meta.env?.VITE_OPENROUTER_KEY);
    if (orf5) openRouterKeys.push(orf5);
  } catch (e) {}

  const deepInfraEnvKeysApi = [
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_1), getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_2), getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_3),
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_4), getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_5), getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_6),
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_7), getViteEnv(import.meta.env?.VITE_DEEPINFRA_API_KEY_8)
  ];
  const deepInfraEnvKeys = [
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_1), getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_2), getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_3),
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_4), getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_5), getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_6),
    getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_7), getViteEnv(import.meta.env?.VITE_DEEPINFRA_KEY_8)
  ];

  // 3. Parse DeepInfra Keys: Loop 1 to 8
  for (let i = 1; i <= 8; i++) {
    const k1 = cleanKey(safeProcessEnv[`DEEPINFRA_KEY_${i}`]);
    if (k1) deepInfraKeys.push(k1);

    const k2 = cleanKey(safeProcessEnv[`DEEPINFRA_API_KEY_${i}`]);
    if (k2) deepInfraKeys.push(k2);

    const k3 = cleanKey(safeProcessEnv[`VITE_DEEPINFRA_API_KEY_${i}`]);
    if (k3) deepInfraKeys.push(k3);

    const k4 = cleanKey(safeProcessEnv[`VITE_DEEPINFRA_KEY_${i}`]);
    if (k4) deepInfraKeys.push(k4);

    const k5 = cleanKey(deepInfraEnvKeysApi[i - 1]);
    if (k5) deepInfraKeys.push(k5);

    const k6 = cleanKey(deepInfraEnvKeys[i - 1]);
    if (k6) deepInfraKeys.push(k6);
  }

  // Single default fallback DeepInfra keys
  const dif1 = cleanKey(safeProcessEnv.DEEPINFRA_API_KEY);
  if (dif1) deepInfraKeys.push(dif1);
  const dif2 = cleanKey(safeProcessEnv.VITE_DEEPINFRA_API_KEY);
  if (dif2) deepInfraKeys.push(dif2);
  const dif3 = cleanKey(safeProcessEnv.VITE_DEEPINFRA_KEY);
  if (dif3) deepInfraKeys.push(dif3);
  try {
    const dif4 = cleanKey(import.meta.env?.VITE_DEEPINFRA_API_KEY);
    if (dif4) deepInfraKeys.push(dif4);
  } catch (e) {}
  try {
    const dif5 = cleanKey(import.meta.env?.VITE_DEEPINFRA_KEY);
    if (dif5) deepInfraKeys.push(dif5);
  } catch (e) {}

  const groqEnvKeysApi = [
    getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_1), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_2), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_3),
    getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_4), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_5), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_6),
    getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_7), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_8), getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_9),
    getViteEnv(import.meta.env?.VITE_GROQ_API_KEY_10)
  ];
  const groqEnvKeys = [
    getViteEnv(import.meta.env?.VITE_GROQ_KEY_1), getViteEnv(import.meta.env?.VITE_GROQ_KEY_2), getViteEnv(import.meta.env?.VITE_GROQ_KEY_3),
    getViteEnv(import.meta.env?.VITE_GROQ_KEY_4), getViteEnv(import.meta.env?.VITE_GROQ_KEY_5), getViteEnv(import.meta.env?.VITE_GROQ_KEY_6),
    getViteEnv(import.meta.env?.VITE_GROQ_KEY_7), getViteEnv(import.meta.env?.VITE_GROQ_KEY_8), getViteEnv(import.meta.env?.VITE_GROQ_KEY_9),
    getViteEnv(import.meta.env?.VITE_GROQ_KEY_10)
  ];

  // 4. Parse Groq Keys (Exhibition - DO NOT leak into active loop if empty)
  for (let i = 1; i <= 10; i++) {
    const k1 = cleanKey(safeProcessEnv[`GROQ_API_KEY_${i}`]);
    if (k1) groqKeysRaw.push(k1);

    const k2 = cleanKey(safeProcessEnv[`VITE_GROQ_API_KEY_${i}`]);
    if (k2) groqKeysRaw.push(k2);

    const k3 = cleanKey(safeProcessEnv[`VITE_GROQ_KEY_${i}`]);
    if (k3) groqKeysRaw.push(k3);

    const k4 = cleanKey(groqEnvKeysApi[i - 1]);
    if (k4) groqKeysRaw.push(k4);

    const k5 = cleanKey(groqEnvKeys[i - 1]);
    if (k5) groqKeysRaw.push(k5);
  }
  // Fallbacks
  const grf1 = cleanKey(safeProcessEnv.GROQ_API_KEY);
  if (grf1) groqKeysRaw.push(grf1);
  const grf2 = cleanKey(safeProcessEnv.VITE_GROQ_API_KEY);
  if (grf2) groqKeysRaw.push(grf2);
  const grf3 = cleanKey(safeProcessEnv.VITE_GROQ_KEY);
  if (grf3) groqKeysRaw.push(grf3);
  try {
    const grf4 = cleanKey(import.meta.env?.VITE_GROQ_API_KEY);
    if (grf4) groqKeysRaw.push(grf4);
  } catch (e) {}
  try {
    const grf5 = cleanKey(import.meta.env?.VITE_GROQ_KEY);
    if (grf5) groqKeysRaw.push(grf5);
  } catch (e) {}

  // Ultra-Strict Cleansing (Anti-Undefined and Pattern Filtering)
  const validOpenRouter = Array.from(new Set(openRouterKeys))
    .filter(k => k && k.startsWith("sk-or-"));

  const validGemini = Array.from(new Set(geminiKeysRaw))
    .filter(k => k && k !== "");

  const validDeepInfra = Array.from(new Set(deepInfraKeys))
    .filter(k => k && k !== "");

  // Filter Groq keys appropriately
  const validGroq = Array.from(new Set(groqKeysRaw))
    .filter(k => k && k.startsWith("gsk_"));

  // Switch-OFF Guard: Read current active UI state variables / toggles in real-time
  let isGeminiEnabled = apiProviderConfig.gemini;
  let isOpenRouterEnabled = apiProviderConfig.openRouter;
  let isDeepInfraEnabled = apiProviderConfig.deepInfra;
  let isGroqEnabled = apiProviderConfig.groq;

  try {
    const stored = localStorage.getItem("henosis_provider_config");
    if (stored) {
      const storedConfig = JSON.parse(stored);
      if (storedConfig.gemini !== undefined) isGeminiEnabled = !!storedConfig.gemini;
      if (storedConfig.openRouter !== undefined) isOpenRouterEnabled = !!storedConfig.openRouter;
      if (storedConfig.deepInfra !== undefined) isDeepInfraEnabled = !!storedConfig.deepInfra;
      if (storedConfig.groq !== undefined) isGroqEnabled = !!storedConfig.groq;
    }
  } catch (e) {
    // ignore parsing errors
  }

  const lists: { provider: "openRouter" | "gemini" | "groq" | "deepInfra"; keys: string[] }[] = [];

  if (isOpenRouterEnabled && validOpenRouter.length > 0) {
    lists.push({ provider: "openRouter", keys: validOpenRouter });
  }
  if (isGeminiEnabled && validGemini.length > 0) {
    lists.push({ provider: "gemini", keys: validGemini });
  }
  if (isDeepInfraEnabled && validDeepInfra.length > 0) {
    lists.push({ provider: "deepInfra", keys: validDeepInfra });
  }
  if (isGroqEnabled && validGroq.length > 0) {
    lists.push({ provider: "groq", keys: validGroq });
  }

  if (lists.length === 0) return [];

  // Cross-Provider Interleaved Round-Robin Matrix
  const interleavedPool: InterleavedKey[] = [];
  const maxLen = Math.max(...lists.map(list => list.keys.length));

  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.keys.length) {
        interleavedPool.push({
          key: list.keys[i],
          provider: list.provider
        });
      }
    }
  }

  // KEY FILTERING MANDATE: picker MUST only yield active keys where Date.now() > cooldownUntil and status is not DEPLETED
  const cleanInterleavedPool = interleavedPool.filter(item => {
    if (!item || !item.key || typeof item.key !== 'string') return false;
    const trimKey = item.key.trim();
    if (trimKey === "" || trimKey === "undefined" || trimKey === "null") return false;
    if (item.provider === "openRouter" && !trimKey.startsWith("sk-or-")) return false;
    return true;
  });

  return cleanInterleavedPool.filter(item => {
    const state = keyRegistry.get(item.key);
    if (!state) return true;
    if (state.status === "DEPLETED") return false;
    return Date.now() > state.cooldownUntil;
  });
}

// Direct Call implementations using raw provider HTTP Endpoints bypasses server proxies
async function fetchOpenRouterDirect(apiKey: string, model: string, messages: any[], isJsonExpected: boolean): Promise<string> {
  const modelsToTry = [
    (model && model !== "openai/gpt-oss-120b") ? model : "google/gemini-2.5-flash",
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemini-2.5-flash:free",
    "meta-llama/llama-3-8b-instruct:free"
  ];

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    const bodyObj: any = {
      model: currentModel,
      messages,
      temperature: 0.1,
      max_tokens: 4096
    };
    
    if (isJsonExpected) {
      bodyObj.response_format = { type: "json_object" };
    }

    try {
      console.log(`[apiClient OpenRouter Direct] Attempting completions using model: ${currentModel}`);
      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://henosisweb.vercel.app",
          "X-Title": "Henosis Learning App"
        },
        body: JSON.stringify(bodyObj)
      }, 45000);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[apiClient OpenRouter Direct] Model ${currentModel} failed with status ${response.status}: ${errText}`);
        lastError = new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
        
        if (response.status === 400 || errText.toLowerCase().includes("model not found") || errText.toLowerCase().includes("unavailable")) {
          // Model error or deprecated, step down to next model
          continue;
        }

        handleKeyError(apiKey, "openRouter", response.status, errText);
        const isSilent = [402, 403, 404, 429].includes(response.status) || 
                         errText.toLowerCase().includes("unavailable for free") || 
                         errText.toLowerCase().includes("paid version") ||
                         errText.toLowerCase().includes("paid version only") ||
                         errText.toLowerCase().includes("model not found");
                         
        if (isSilent) {
          throw new Error("PROVIDER_SILENT_FAIL");
        }
        throw lastError;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty content returned from OpenRouter direct endpoint.");
      return content;
    } catch (err: any) {
      if (err.message === "PROVIDER_SILENT_FAIL") {
        throw err;
      }
      lastError = err;
      const errString = err.message || "";
      if (errString.includes("400") || errString.toLowerCase().includes("model")) {
        continue;
      }
      
      const isSilent = errString.toLowerCase().includes("unavailable for free") || 
                       errString.toLowerCase().includes("paid version") ||
                       errString.toLowerCase().includes("paid version only") ||
                       errString.toLowerCase().includes("model not found") ||
                       errString.toLowerCase().includes("403") ||
                       errString.toLowerCase().includes("404");
                       
      if (isSilent) {
        console.warn("OpenRouter slot failed, bypassing...");
        throw new Error("PROVIDER_SILENT_FAIL");
      }

      if (err.message && !err.message.includes("OpenRouter Direct failure") && !err.message.includes("OpenRouter API Error")) {
        handleKeyError(apiKey, "openRouter", 0, err.message || "");
      }
      throw err;
    }
  }

  throw lastError || new Error("All fallback models on OpenRouter failed.");
}

async function fetchGeminiDirect(apiKey: string, messages: any[], isJsonExpected: boolean): Promise<string> {
  const contents: any[] = [];
  let systemInstructionText = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstructionText += (systemInstructionText ? "\n" : "") + msg.content;
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    }
  }

  const payload: any = {
    contents,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096 // Force-set to 4096
    }
  };

  if (isJsonExpected) {
    payload.generationConfig.responseMimeType = "application/json";
  }

  if (systemInstructionText) {
    payload.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  try {
    const model = "gemini-2.5-flash"; // stable, efficient flash model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }, 45000);

    if (!response.ok) {
      const errText = await response.text();
      handleKeyError(apiKey, "gemini", response.status, errText);
      throw new Error(`Gemini Direct failure: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Empty content returned from Gemini direct endpoint.");
    return content;
  } catch (err: any) {
    if (err.name === "AbortError") {
      handleKeyError(apiKey, "gemini", 408, "Request Timeout 45s");
      throw new Error("Request Timeout 45s on Gemini Direct");
    }
    if (err.message && !err.message.includes("Gemini Direct failure")) {
      handleKeyError(apiKey, "gemini", 0, err.message || "");
    }
    throw err;
  }
}

async function fetchGroqDirect(apiKey: string, messages: any[], isJsonExpected: boolean): Promise<string> {
  const bodyObj: any = {
    model: "llama3-8b-8192",
    messages,
    temperature: 0.1,
    max_tokens: 4096 // Force-set to 4096
  };
  
  if (isJsonExpected) {
    bodyObj.response_format = { type: "json_object" };
  }

  try {
    const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyObj)
    }, 45000);

    if (!response.ok) {
      const errText = await response.text();
      handleKeyError(apiKey, "groq", response.status, errText);
      throw new Error(`Groq Direct failure: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty content returned from Groq direct endpoint.");
    return content;
  } catch (err: any) {
    if (err.name === "AbortError") {
      handleKeyError(apiKey, "groq", 408, "Request Timeout 45s");
      throw new Error("Request Timeout 45s on Groq Direct");
    }
    if (err.message && !err.message.includes("Groq Direct failure")) {
      handleKeyError(apiKey, "groq", 0, err.message || "");
    }
    throw err;
  }
}

async function fetchDeepInfraDirect(apiKey: string, messages: any[], isJsonExpected: boolean): Promise<string> {
  const bodyObj: any = {
    model: "microsoft/Phi-3-mini-4k-instruct", // Strictly updated to the 100% serverless free model of DeepInfra for $0 tier
    messages,
    temperature: 0.1,
    max_tokens: 4096 // Force-set to 4096
  };
  
  if (isJsonExpected) {
    bodyObj.response_format = { type: "json_object" };
  }

  try {
    const response = await fetchWithTimeout("https://api.deepinfra.com/v1/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyObj)
    }, 45000);

    if (!response.ok) {
      const errText = await response.text();
      handleKeyError(apiKey, "deepInfra", response.status, errText);
      throw new Error(`DeepInfra Direct failure: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty content returned from DeepInfra direct endpoint.");
    return content;
  } catch (err: any) {
    if (err.name === "AbortError") {
      handleKeyError(apiKey, "deepInfra", 408, "Request Timeout 45s");
      throw new Error("Request Timeout 45s on DeepInfra Direct");
    }
    if (err.message && !err.message.includes("DeepInfra Direct failure")) {
      handleKeyError(apiKey, "deepInfra", 0, err.message || "");
    }
    throw err;
  }
}

async function executeFetchWithBackoffAndEvasion(url: string, options?: RequestInit): Promise<Response> {
  let currentOptions = options ? { ...options } : {};
  let providerType: "primary" | "backup" = "primary";

  // Check if AI requested of standard parsed routes
  const isAiRequest = INTERCEPTED_AI_ROUTES.some(route => url.includes(route));

  const writeCache = async (res: Response, urlKey: string, bodyObj: any) => {
    try {
      if (typeof navigator !== 'undefined') {
         const cacheKey = `ai_cache_${urlKey}_${JSON.stringify(bodyObj)}`;
         const cloned = res.clone();
         const data = await cloned.json();
         await localforage.setItem(cacheKey, data);
      }
    } catch(e) {
      console.warn("Storage sync failed", e);
    }
  };

  if (isAiRequest) {
    let parsedBody: any = {};
    if (currentOptions.body) {
      try {
        parsedBody = JSON.parse(currentOptions.body as string);
      } catch (e) {
        console.warn("[apiClient Dynamic Rotation] Failed to parse request body as JSON:", e);
      }
    }

    // 🌍 OFFLINE FALLBACK - IndexedDB Write-Through Retrieval
    const cacheKey = `ai_cache_${url}_${JSON.stringify(parsedBody)}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const cachedContent = await localforage.getItem(cacheKey);
        if (cachedContent) {
          console.warn("[apiClient Offline] Seamless fallback: Loaded previously fetched state from IndexedDB.", cacheKey);
          return new Response(JSON.stringify(cachedContent), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Pass down to UI so UI can render fallback skeleton
          throw new Error("Mạng đang ngoại tuyến và không tìm thấy nội dung phản hồi trong bộ nhớ tạm mượt mà IndexedDB.");
        }
      } catch (e) {
        console.error("LocalForage fallback read error:", e);
        throw new Error("Lỗi đọc IndexedDB lúc mất mạng.");
      }
    }

    const { model, messages } = await buildGroqPayload(url, parsedBody);
    const isJsonExpected = url.includes("lesson-plan") || 
                           url.includes("process-chunk") || 
                           url.includes("convert-document-chunk") || 
                           url.includes("hydrate-card") || 
                           url.includes("validate-json") || 
                           url.includes("generate");

    let attempts = 0;
    // Max attempts should be at least length of the pool, up to 15, to ensure we cycle through all available keys
    let pool = getInterleavedPool();
    const maxAttempts = Math.min(Math.max(5, pool.length), 15); 
    let lastRotationError: any = null;

    while (attempts < maxAttempts) {
      const pool = getInterleavedPool(); // Fresh pool check prevents choosing cooled down keys
      if (pool.length === 0) {
        console.warn("[apiClient Rotation] Interleaved pool is completely exhausted or filtered out.");
        break;
      }

      let currIndex = globalPoolIndex;
      let item = pool[currIndex % pool.length];
      let skipCount = 0;

      // Safe Pointer Advancement: Skip invalid or empty slots immediately without triggering an API call
      while ((!item || !item.key || typeof item.key !== "string" || item.key.trim() === "" || item.key === "undefined" || item.key === "null" ||
             (item.provider === "openRouter" && !item.key.trim().startsWith("sk-or-"))) && skipCount < pool.length) {
        console.warn("Skipping invalid key slot");
        currIndex++;
        globalPoolIndex = currIndex;
        item = pool[currIndex % pool.length];
        skipCount++;
      }

      if (!item || !item.key || typeof item.key !== "string" || item.key.trim() === "" || item.key === "undefined" || item.key === "null" ||
          (item.provider === "openRouter" && !item.key.trim().startsWith("sk-or-"))) {
        console.warn("[apiClient Rotation] Scanned entire pool, no valid keys remaining.");
        break;
      }

      attempts++;
      console.log(`[apiClient Rotation] [Attempt ${attempts}/${maxAttempts}] Dispatching via provider: ${item.provider} | Global Key Index: ${globalPoolIndex}`);

      try {
        let content = "";
        if (item.provider === "openRouter") {
          content = await fetchOpenRouterDirect(item.key, model, messages, isJsonExpected);
        } else if (item.provider === "gemini") {
          content = await fetchGeminiDirect(item.key, messages, isJsonExpected);
        } else if (item.provider === "groq") {
          content = await fetchGroqDirect(item.key, messages, isJsonExpected);
        } else if (item.provider === "deepInfra") {
          content = await fetchDeepInfraDirect(item.key, messages, isJsonExpected);
        }

        if (content) {
          console.log(`[apiClient Rotation] Successfully completed request via rotated ${item.provider} on attempt ${attempts}!`);
          
          // Report successful key usage to server in background
          reportKeyUsageToServer(item.provider, item.key, "usage");
          
          const mappedRes = await mapOpenRouterResponse(url, content);
          globalPoolIndex++; // safe advancement after success
          
          // Write to IndexedDB mirror
          writeCache(mappedRes, url, parsedBody);
          return mappedRes;
        }
      } catch (err: any) {
        console.warn("Skipping invalid key slot");
        console.warn(`[apiClient Rotation] Rotation failure on provider ${item.provider} on attempt ${attempts}. Error: ${err.message || err}. Incrementing pointer immediately.`);
        
        // During rotation, we do NOT dispatch user-facing popups/toasts for individual key errors because we are cycling through alternatives
        // the final request will be fallback proxy or raise an actual fetch error if everything completely fails.
        // This stops multiple red "Lỗi Hệ Thống" popups from covering the user's screen.

        // Increment the interleaved key pointer on EVERY failed attempt to advance immediately
        globalPoolIndex++;
        lastRotationError = err;

        // "and retry the chunk processing immediately" -> very small delay to avoid extreme tight infinite CPU loops, but essentially immediate retry
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.warn(`[apiClient Rotation] Direct interleaved keys exhausted. Falling back to backend server-side handlers...`, lastRotationError);

    // Server-side fallback proxy try (Original flow)
    if (apiProviderConfig && apiProviderConfig.openRouter) {
      try {
        console.log(`[apiClient Server Fallback] Attempting backend server proxy route as dual backup...`);
        const content = await fetchOpenRouterWithBackoff(model, messages, 1, 500);
        const mappedRes = await mapOpenRouterResponse(url, content);
        
        // Write to IndexedDB mirror
        writeCache(mappedRes, url, parsedBody);
        return mappedRes;
      } catch (err: any) {
        console.warn(`[apiClient Server Fallback] Backend server fallback failed: ${err.message || err}.`);
      }
    }
    
    // Instead of failing fast here, we let the request continue to the regular Vercel/Express backend!
    console.warn("[apiClient Rotation] Falling back to primary backend route.");
  }

  // 🌍 OFFLINE FALLBACK - Non-AI Standard API Requests
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
     const cacheKey = `std_cache_${url}`;
     try {
       const cachedContent = await localforage.getItem(cacheKey);
       if (cachedContent) {
          console.warn("[apiClient Offline] Seamless fallback: Loaded standard API request from IndexedDB.", cacheKey);
          return new Response(JSON.stringify(cachedContent), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
       }
     } catch(e) {}
     throw new Error("Mạng đang ngoại tuyến và không tìm thấy bộ đệm thay thế IndexedDB chuẩn.");
  }

  let attempt = 0;
  const maxAttempts = 5; // Enhanced to 5 max attempts with exponential backoff

  // Pick a random proxy Sim node
  let activeProxies = PROXIES.filter(p => p.active);
  if (activeProxies.length === 0) {
    // Reset if all died
    PROXIES.forEach(p => p.active = true);
    activeProxies = PROXIES;
  }
  let currentProxy = activeProxies[Math.floor(Math.random() * activeProxies.length)];

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    
    // Set response deadline with a generous timeout to allow large text/doc completions
    // Force set Timeout duration to 45000ms (45 seconds) as requested to cycle unresponsive keys early
    const timeoutDuration = 45000;
    const timeoutId = setTimeout(() => {
      console.warn(`[apiClient Log] Yêu cầu tới ${url} bị quá thời gian phản hồi (timeout ${timeoutDuration / 1000}s). Đang tự động huỷ bỏ và phát tín hiệu thử lại.`);
      controller.abort();
    }, timeoutDuration);

    // Apply Random Jitter Delay to disrupt predictable bots activity
    const jitter = 2000 + Math.random() * 1500;
    if (attempt > 1) {
      console.log(`[apiClient Log] [Jitter Delay] Đang nghỉ ngơi ngẫu nhiên ${jitter.toFixed(0)}ms để tránh bị hệ thống quét chặn...`);
      await new Promise(r => setTimeout(r, jitter));
    }

    try {
      // 1. Forge realistic Headers & Spoofing Information
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const randomIP = generateRandomIP();
      const acceptLanguage = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];

      const originalHeaders = currentOptions.headers ? { ...currentOptions.headers } : {};
      
      // Inject sophisticated spoofing identity headers
      const evasionHeaders: Record<string, string> = {
        "User-Agent": userAgent,
        "X-Forwarded-For": randomIP,
        "X-Real-IP": randomIP,
        "CF-Connecting-IP": randomIP,
        "Accept-Language": acceptLanguage,
        "X-Proxy-Simulated-Node": currentProxy ? currentProxy.url : "direct",
        "X-Request-Jitter-Ms": jitter.toFixed(0)
      };

      // Merge spoofed headers with original headers while maintaining token credentials
      const mergedHeaders = {
        ...originalHeaders,
        ...evasionHeaders
      };

      const fetchOptions: RequestInit = {
        ...currentOptions,
        headers: mergedHeaders,
        signal: controller.signal
      };

      console.log(`[apiClient Log] Gửi yêu cầu đến ${url} | Lần thử ${attempt}/${maxAttempts}`);
      console.log(`[apiClient Spoof Log] IP giả lập: ${randomIP} | Node Proxy: ${currentProxy ? currentProxy.region : "Direct"} | UA: ${userAgent.substring(0, 45)}...`);

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (response.ok) {
        resetCircuitBreaker();
        
        // Write standard cache asynchronously
        try {
          if (typeof navigator !== 'undefined') {
             const cacheKey = `std_cache_${url}`;
             const cloned = response.clone();
             cloned.json().then(data => {
                localforage.setItem(cacheKey, data).catch(console.warn);
             }).catch(() => {}); // ignore parsing errors for non-json
          }
        } catch(e) {}
        
        return response;
      }

      // Handle 429 Rate limits, 408 Timeout or 503/504 Server overloaded
      if (response.status === 429 || response.status === 408 || response.status === 503 || response.status === 504) {
        console.warn(`[apiClient Log] Server phản hồi lỗi bận/quá tải (${response.status}) tại node proxy: ${currentProxy ? currentProxy.region : "Direct"}`);
        
        // Remove dead proxy or flag as rate-limited from pool to change route in next attempts
        if (currentProxy) {
          console.warn(`[apiClient Proxy Evasion] Loại bỏ proxy ${currentProxy.region} ra khỏi danh sách chạy hiện tại do dính lỗi Rate Limit / Quá Tải.`);
          currentProxy.active = false;
        }

        if (attempt < maxAttempts) {
          // Automatic Provider Swap Logic if body allows payload injection
          if (providerType === "primary" && currentOptions.body) {
            try {
              const bodyParsed = JSON.parse(currentOptions.body as string);
              bodyParsed.provider = "backup";
              currentOptions.body = JSON.stringify(bodyParsed);
              providerType = "backup";
              console.warn(`[apiClient Log] Phát hiện lỗi giới hạn hạn ngạch hoặc Rate Limit. Tự động chuyển đổi sang Provider Dự Phòng lớp dưới (backup).`);
            } catch (e) {
              // Ignore parse errors for raw attachments
            }
          }

          // Pick a next fresh proxy sim node for the retry
          const remActive = PROXIES.filter(p => p.active);
          currentProxy = remActive.length > 0 ? remActive[Math.floor(Math.random() * remActive.length)] : PROXIES[Math.floor(Math.random() * PROXIES.length)];

          // Apply robust Exponential Backoff Delay
          const backoffDelay = Math.pow(2.5, attempt) * 1000 + Math.random() * 1000;
          console.log(`[apiClient Log] Đang kích hoạt Backoff trong ${backoffDelay.toFixed(0)}ms trước khi thử lại với proxy và danh tính mới...`);
          await new Promise((r) => setTimeout(r, backoffDelay));
          continue;
        } else {
          handleFailure();
          throw new Error(`Đã đạt giới hạn tối đa lần thử lại. Server trạng thái lỗi: ${response.status}`);
        }
      }

      // Client errors (400 - 499, except 429 and 408) - abort early without repeating
      if (response.status >= 400 && response.status < 500) {
        let errorData;
        try {
          const clonedResponse = response.clone();
          errorData = await clonedResponse.json();
        } catch (e) {
          errorData = { message: `HTTP Error ${response.status}: ${response.statusText}`, path: url };
        }
        
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent('global-api-error', { 
            detail: { 
              message: errorData.message || 'Lỗi từ máy chủ', 
              path: errorData.path || url,
              stack: errorData.stack 
            } 
          }));
        }
        return response;
      } else {
        // Other server errors (500, 502, etc.)
        if (attempt < maxAttempts) {
          if (providerType === "primary" && currentOptions.body) {
            try {
              const bodyParsed = JSON.parse(currentOptions.body as string);
              bodyParsed.provider = "backup";
              currentOptions.body = JSON.stringify(bodyParsed);
              providerType = "backup";
              console.warn(`[apiClient Log] Tự động chuyển đổi sang Provider Dự Phòng lớp dưới (backup) do máy chủ lỗi hệ thống.`);
            } catch (e) {}
          }
          const backoffDelay = Math.pow(2.5, attempt) * 1000 + Math.random() * 1000;
          console.log(`[apiClient Log] Lỗi hệ thống server (${response.status}). Thử lại sau ${backoffDelay.toFixed(0)}ms...`);
          await new Promise((r) => setTimeout(r, backoffDelay));
          continue;
        } else {
          handleFailure();
          return response;
        }
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[apiClient Log] Phát hiện lỗi kết nối / timeout đột biến tại lần thử ${attempt}:`, error);

      const isTimeoutOrNetwork = error.name === "AbortError" || error.message?.toLowerCase().includes("timeout") || error.message?.toLowerCase().includes("fetch");
      
      if (isTimeoutOrNetwork && attempt < maxAttempts) {
        if (providerType === "primary" && currentOptions.body) {
          try {
            const bodyParsed = JSON.parse(currentOptions.body as string);
            bodyParsed.provider = "backup";
            currentOptions.body = JSON.stringify(bodyParsed);
            providerType = "backup";
            console.warn(`[apiClient Log] Chuyển đổi sang Provider Dự Phòng lớp dưới (backup) do phản hồi kết nối không hoàn thành.`);
          } catch (e) {}
        }
        
        if (currentProxy) {
          currentProxy.active = false; // Mark dead proxy
        }
        
        const remActive = PROXIES.filter(p => p.active);
        currentProxy = remActive.length > 0 ? remActive[Math.floor(Math.random() * remActive.length)] : PROXIES[Math.floor(Math.random() * PROXIES.length)];

        const backoffDelay = Math.pow(2.5, attempt) * 1000 + Math.random() * 1000;
        console.log(`[apiClient Log] Trễ mạng đột biến, chờ ${backoffDelay.toFixed(0)}ms và chạy thử lại với danh tính/proxy mới...`);
        await new Promise((r) => setTimeout(r, backoffDelay));
        continue;
      }

      if (error.name !== 'AbortError') {
        handleFailure();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent('global-api-error', { 
            detail: { message: error.message || 'Không thể kết nối đến máy chủ', path: url } 
          }));
        }
      }
      throw error;
    }
  }

  throw new Error(`Đã thử lại ${maxAttempts} lần tiến trình nhưng yêu cầu vẫn bất thành.`);
}

export async function safeRequest(url: string, options?: RequestInit): Promise<Response> {
  if (isTripped) {
    console.error('CRITICAL WARNING: Circuit Breaker is active. Outbound request blocked.', url);
    const time = getCooldownTime() / 1000;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent('global-api-error', { 
        detail: { message: `Circuit Breaker active. Thử lại sau ${time}s.`, path: url } 
      }));
    }
    throw new Error(`Hệ thống đang bảo trì tự động. Vui lòng thử lại sau ${time} giây.`);
  }

  // Inject User Custom Auth Headers if available
  const mergedOptions = { ...(options || {}) };
  try {
    const { store } = await import("../lib/store");
    const currentUser = store.getCurrentUser();
    if (currentUser) {
      const headers = { ...(mergedOptions.headers || {}) } as Record<string, string>;
      if (!headers["x-user-id"]) {
        headers["x-user-id"] = currentUser.id || "";
      }
      if (!headers["x-user-role"]) {
        headers["x-user-role"] = currentUser.role || "";
      }
      if (!headers["x-user-is-pro"]) {
        headers["x-user-is-pro"] = currentUser.isPro ? "true" : "false";
      }
      
      // Auto-inject Firebase Auth token if available
      try {
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        if (auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken();
          if (idToken && !headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${idToken}`;
          }
        }
      } catch (authErr) {
        // Ignored fallback
      }
      
      mergedOptions.headers = headers;
    }
  } catch (err) {
    console.warn("Failed to inject user headers in safeRequest:", err);
  }

  // Push to FIFO Queue
  return new Promise((resolve, reject) => {
    callQueue.push({ url, options: mergedOptions, resolve, reject });
    processQueue();
  });
}
