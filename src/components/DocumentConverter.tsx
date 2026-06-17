import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createWorker } from 'tesseract.js';
import { 
  FileUp, 
  FileText, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Layers, 
  Terminal, 
  X, 
  Sparkles, 
  Copy, 
  Edit3, 
  RefreshCw, 
  Play, 
  AlertTriangle, 
  Database,
  Zap,
  Lock,
  Type,
  Speech,
  BookOpen,
  Save
} from "lucide-react";
import { cn } from "../lib/utils";
import { CustomDeckSelect } from "./CustomDeckSelect";
import localforage from "localforage";
import ErrorNotification from "./ErrorNotification";
import { store, Deck } from "../lib/store";
import { db, auth } from "../lib/firebase";
import { collection, writeBatch, doc, updateDoc, getDoc } from "firebase/firestore";
import { safeRequest } from "../utils/apiClient";
import { splitIntoChunks } from "../utils/textProcessor";

// 1. Unified Client-Side Clean-up utility
function isCleanHumanLine(line: string): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  const lower = trimmed.toLowerCase();
  
  // 1. Chặn hoàn toàn các từ khóa cú pháp PDF thuần túy khi chúng đứng một mình trên dòng
  const EXACT_PDF_KEYWORDS = ['obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer', 'startxref', 'eof'];
  if (EXACT_PDF_KEYWORDS.includes(lower)) return false;
  
  // 2. Chặn các định nghĩa Object PDF dạng: "3 0 obj" hoặc tham chiếu "12 0 R"
  if (/^\s*\d+\s+\d+\s+obj\b/i.test(trimmed)) return false;
  if (/^\s*\d+\s+\d+\s+R\b/i.test(trimmed)) return false;
  if (trimmed.startsWith('%%EOF') || trimmed.startsWith('%%')) return false;

  // 3. Chặn các cặp thẻ thuộc tính từ điển PDF kiểu: << /Type /Page >> hoặc << /Font >>
  if (trimmed.startsWith('<<') || trimmed.endsWith('>>')) {
    if (lower.includes('/type') || lower.includes('/length') || lower.includes('/filter') || lower.includes('/subtype')) {
      return false;
    }
  }

  // 4. Phát hiện các dòng chứa từ 2 thẻ định danh PDF trở lên (ví dụ: "/Type /Page /Resources")
  const slashTagsCount = (trimmed.match(/\/[A-Za-z0-9_]+/g) || []).length;
  if (slashTagsCount >= 2) {
    if (lower.includes('/font') || lower.includes('/page') || lower.includes('/parent') || lower.includes('/resources') || lower.includes('/contents') || lower.includes('/type')) {
      return false;
    }
  }

  // 5. Chặn dòng cú pháp bắt đầu bằng gạch chéo chứa các từ khóa hệ thống
  if (trimmed.startsWith('/') && (lower.includes('/type') || lower.includes('/parent') || lower.includes('/font') || lower.includes('/page'))) {
    return false;
  }

  // 6. Chặn các dòng chỉ toàn ký tự điều hướng mã nguồn như << >> [ ] / \
  if (/^[<>\[\]\(\)\{\}\/\\\s]+$/.test(trimmed) && trimmed.length > 2) return false;

  return true;
}

function cleanRawText(text: string): string {
  if (!text) return "";
  
  // Phân tách dòng và loại bỏ triệt để dòng có cú pháp rác PDF
  const lines = text.split(/\r?\n/);
  const purifiedLines = lines.filter(line => isCleanHumanLine(line));
  const purifiedText = purifiedLines.join("\n");

  return purifiedText
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Strip dangerous control chars
    .replace(/\\r|\\t/g, " ")
    .replace(/[\r\t]/g, " ")
    .replace(/[“”]/g, '"') // Normalize double quotes
    .replace(/[‘’`]/g, "'") // Normalize single quotes
    .replace(/[ ]+/g, " ") // Clean multiple spaces but keep newlines intact!
    .trim();
}

const loadPdfJS = () => {
  return new Promise<any>((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = () => {
      reject(new Error("Không thể tải thư viện xử lý PDF.js từ CDN. Vui lòng kiểm tra kết nối mạng của ngài."));
    };
    document.head.appendChild(script);
  });
};

function sanitizeAndHealJson(rawJson: string): string {
  let cleaned = rawJson.trim();
  
  if (cleaned.includes("```json")) {
    const parts = cleaned.split("```json");
    if (parts.length > 1) {
      cleaned = parts[1].split("```")[0].trim();
    }
  } else if (cleaned.startsWith("```")) {
    const parts = cleaned.split("```");
    if (parts.length > 1) {
      cleaned = parts[1].trim();
    }
  }

  const firstCurly = cleaned.indexOf("{");
  if (firstCurly !== -1) {
    cleaned = cleaned.substring(firstCurly);
  }

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  if (inString) {
    cleaned += '"';
  }
  
  if (openBrackets > 0 && openBraces > 1) {
    cleaned += "}";
    openBraces--;
  }

  if (openBrackets > 0) {
    cleaned += "]";
  }

  if (openBraces > 0) {
    cleaned += "}";
  }

  return cleaned;
}

interface ChunkTask {
  id: string;
  index: number;
  content: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  attempts: number;
  flashcards: any[];
  error?: string;
}

export default function DocumentConverter() {
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "text" | "json" | "manual">("file");
  const [manualFront, setManualFront] = useState("");
  const [manualWordForm, setManualWordForm] = useState("");
  const [manualBack, setManualBack] = useState("");
  const [manualBatch, setManualBatch] = useState<any[]>([]);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const manualFrontInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingManualAi, setIsGeneratingManualAi] = useState(false);

  const handleGenerateManualBack = async () => {
    if (!manualFront.trim()) {
      setError("Vui lòng nhập Mặt trước (Từ / Khái niệm) trước khi phân tích AI!");
      manualFrontInputRef.current?.focus();
      return;
    }
    setIsGeneratingManualAi(true);
    try {
      const res = await safeRequest("/api/automation/manual-define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: manualFront, wordForm: manualWordForm })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.definition)) {
        setManualBack(data.definition);
        if (data.wordForm) {
          setManualWordForm(data.wordForm);
        }
        setToastSuccessMessage("AI đã phân tích thành công!");
      } else {
        throw new Error(data.error || data.message || "Lỗi cập nhật AI");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi gọi AI phân tích.");
    } finally {
      setIsGeneratingManualAi(false);
    }
  };

  const [isAiSystemBusy, setIsAiSystemBusy] = useState(false);
  const [aiBusyType, setAiBusyType] = useState<string | null>(null);
  const [streamedBytes, setStreamedBytes] = useState<number>(0);

  useEffect(() => {
    const checkBusy = () => {
      if ((window as any).AI_BUSY) {
        setIsAiSystemBusy(true);
        setAiBusyType((window as any).AI_BUSY_TYPE || "convert");
      }
    };
    checkBusy();

    const handleAiBusyChange = (e: any) => {
      const { isBusy, type } = e.detail;
      setIsAiSystemBusy(isBusy);
      setAiBusyType(type);
    };

    window.addEventListener("ai-busy-change", handleAiBusyChange);
    return () => {
      window.removeEventListener("ai-busy-change", handleAiBusyChange);
    };
  }, []);

  const triggerServerAndClientLock = async (userId: string) => {
    try {
      await safeRequest("/api/automation/lock-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "convert", userId })
      });
    } catch (err) {
      console.warn("Failed to lock AI on server:", err);
    }
    window.dispatchEvent(new CustomEvent("ai-busy-change", { detail: { isBusy: true, type: "convert" } }));
  };

  const triggerServerAndClientUnlock = async () => {
    try {
      await safeRequest("/api/automation/unlock-ai", {
        method: "POST"
      });
    } catch (err) {
      console.warn("Failed to unlock AI on server:", err);
    }
    window.dispatchEvent(new CustomEvent("ai-busy-change", { detail: { isBusy: false, type: null } }));
    // Refresh user AI quota data reactively
    fetchUserAiQuota();
  };

  // Safe release on unmount to make sure no lock is orphaned
  useEffect(() => {
    return () => {
      triggerServerAndClientUnlock();
    };
  }, []);

  const [aiUsage, setAiUsage] = useState<{ used: number; total: number; isFreeUser: boolean } | null>(null);

  const fetchUserAiQuota = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    try {
      const userObj = store.getCurrentUser();
      const isFree = userObj?.role === "student" && !userObj?.isPro;
      if (!isFree) {
        setAiUsage({ used: 0, total: 10, isFreeUser: false });
        return;
      }

      const userDocRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const todayStr = new Date().toISOString().split("T")[0];
        const lastAiUsedDate = data?.lastAiUsedDate || todayStr;
        let aiLimitUsedToday = data?.aiLimitUsedToday || 0;
        
        if (lastAiUsedDate !== todayStr) {
          aiLimitUsedToday = 0;
        }
        
        setAiUsage({
          used: aiLimitUsedToday,
          total: 10,
          isFreeUser: true
        });
      } else {
        setAiUsage({ used: 0, total: 10, isFreeUser: true });
      }
    } catch (err) {
      console.error("Failed to fetch user AI quota:", err);
    }
  }, []);

  useEffect(() => {
    fetchUserAiQuota();
  }, [fetchUserAiQuota]);

  const [concurrency, setConcurrency] = useState<number>(2);
  const [reviewPage, setReviewPage] = useState<number>(1);

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [rawTextarea, setRawTextarea] = useState("");
  const [jsonPasteInput, setJsonPasteInput] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Target deck creation settings
  const [deckTitle, setDeckTitle] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [isAddToExisting, setIsAddToExisting] = useState(false);
  const [selectedExistingDeckId, setSelectedExistingDeckId] = useState("");

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Configuration settings (Fine-tuned for mobile memory stability)
  const [isChunkingEnabled, setIsChunkingEnabled] = useState(true);
  const [sanitizeDuplicates, setSanitizeDuplicates] = useState(true);
  const [isSplitDeckEnabled, setIsSplitDeckEnabled] = useState(false);
  const [splitDeckSize, setSplitDeckSize] = useState<number>(40);

  const [showBypassModal, setShowBypassModal] = useState(false);
  const [toastSuccessMessage, setToastSuccessMessage] = useState<string | null>(null);

  const LAZY_CHUNK_PROMPT = `
# SYSTEM PROMPT: REFACTOR TO LAZY-CHUNKED JSON CONVERSION ENGINE

## 1. CORE ROLE & DETERMINISTIC CONTRACT
You are a deterministic Multimodal Data Extraction Agent. Your sole purpose is to convert content from long, high-density images or text blocks into structured JSON.
- **Temperature Setting:** Strictly executed at \`temperature = 0\`. No creativity allowed.
- **Output Constraint:** Output MUST be a valid JSON object. Do not wrap in markdown \`\`\`json blocks if the API enforces JSON mode, otherwise return ONLY the raw JSON structure. No conversational prose.

## 2. LAZY CHUNKING & PROGRESS TRACKING (CRITICAL)
Due to context window limits and token output throttling on massive images, you must employ a "Lazy Chunking" strategy across multiple turns.
- You must dynamically divide the total visual content into smaller, logical batches (Chunks).
- At the very beginning of the JSON response payload, you MUST inject a strict progress tracking metadata node using double slashes \`//\` inside the key string to signal the processing state to the frontend parser.

### PROGRESS METADATA SCHEMA SCHEMA
The first keys in the root JSON object must strictly follow this syntax:
{
  "//_PROGRESS_STATUS": "Processing Chunk X out of Y",
  "//_CURRENT_CHUNK": X,
  "//_TOTAL_CHUNKS": Y,
  "//_HAS_MORE": true/false,
  "data": [ ... ]
}

## 3. MULTI-TURN CONTINUATION LOGIC
- **If \`//_HAS_MORE\` is \`true\`:** The frontend will automatically reply with a prompt like "Continue next chunk". You must remember the exact historical boundary from the previous turn and resume processing the next sequence of vocabulary without skipping a single word.
- **If \`//_HAS_MORE\` is \`false\`:** This signifies that the entire document/image has been fully extracted and successfully converted.

## 4. INGESTION DATA TARGET SCHEMA
Extract all items into the \`data\` array matching this exact vocabulary schema:
{
  "data": [
    {
      "front": "English word, phrasal verb, collocation, or idiom",
      "back": "Exact Vietnamese meaning and definitions",
      "example": "Accompanying English example sentence (if none exists, extract the contextual sentence containing it)",
      "category": "The specific classified group/topic section name from the source document"
    }
  ]
}

## 5. EXECUTION GUARDRAILS
1. **Zero Text Omission:** Do NOT skip any word. Extract line-by-line, section-by-section.
2. **Noise Filtering:** Ignore conversational flavor text or headers that do not contain actual flashcard data (e.g., system logs, chat greetings).
3. If the document is too massive to predict \`Y\` (Total Chunks) accurately, set a safe estimated \`Y\` or set \`Y\` dynamically, but tracking \`X\` (Current Chunk) sequentially is non-negotiable.
`.trim();

  const handleCopyPromptAndGoToGemini = async () => {
    try {
      await navigator.clipboard.writeText(LAZY_CHUNK_PROMPT);
      setToastSuccessMessage("Đã copy prompt thành công!");
      setTimeout(() => {
        setToastSuccessMessage(null);
      }, 3500);
      window.open("https://gemini.google.com", "_blank");
    } catch (err) {
      console.error("Lỗi khi sao chép prompt:", err);
    }
  };

  const handleGoToAIStudio = () => {
    window.open("https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221jzFwMi-W6UECeGyiZL5pwPy8j-kuL72x%22%5D,%22action%22:%22open%22,%22userId%22:%22101494878159029919274%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing", "_blank");
  };

  // Synchronous Refs to eliminate stale React closures of settings
  const isSplitDeckEnabledRef = useRef(isSplitDeckEnabled);
  const splitDeckSizeRef = useRef(splitDeckSize);
  const isAddToExistingRef = useRef(isAddToExisting);
  const deckTitleRef = useRef(deckTitle);
  const deckSubjectRef = useRef(deckSubject);

  useEffect(() => {
    isSplitDeckEnabledRef.current = isSplitDeckEnabled;
  }, [isSplitDeckEnabled]);

  useEffect(() => {
    splitDeckSizeRef.current = splitDeckSize;
  }, [splitDeckSize]);

  useEffect(() => {
    isAddToExistingRef.current = isAddToExisting;
  }, [isAddToExisting]);

  useEffect(() => {
    deckTitleRef.current = deckTitle;
  }, [deckTitle]);

  useEffect(() => {
    deckSubjectRef.current = deckSubject;
  }, [deckSubject]);

  const [chunkMaxWords, setChunkMaxWords] = useState<number>(150); // Mặc định 150 từ
  const [chunkMaxChars, setChunkMaxChars] = useState<number>(2500); // Mặc định 2500 kí tự
  const [chunkOverlapWords, setChunkOverlapWords] = useState<number>(10);
  const [lastSplitMetrics, setLastSplitMetrics] = useState<{
    totalWords: number;
    totalChars: number;
    chunkCount: number;
  } | null>(null);

  // High-performance log progress throttling (60FPS Webview Optimization)
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [logFontSize, setLogFontSize] = useState<"small" | "medium" | "large">("small");
  const allLogsRef = useRef<string[]>([]);
  const logRafRef = useRef<number | null>(null);
  const lastLogUpdateRef = useRef<number>(0);

  // Auto-Resume LocalStorage state persistence
  const [activeSession, setActiveSession] = useState<{
    importTab: "file" | "text" | "json" | "manual";
    fileName: string;
    deckTitle: string;
    deckSubject: string;
    rawLines: string[];
    chunks: ChunkTask[];
    activeProgressIdx: number;
    allGeneratedCards: any[];
    logs: string[];
  } | null>(null);

  // Daily conversion limit logic
  const todayStr = new Date().toLocaleDateString('sv');
  const currentUserObj = store.getCurrentUser();
  const isUserAdminOrTeacher = currentUserObj?.role === 'teacher' || currentUserObj?.role === 'admin' || currentUserObj?.role === 'Admin' || !!currentUserObj?.isPro;
  const trackingKey = `ai_card_gen_count_${currentUserObj?.id || 'guest'}_${todayStr}`;
  const [currentCount, setCurrentCount] = useState<number>(() => {
    const raw = localStorage.getItem(trackingKey);
    return raw ? parseInt(raw, 10) : 0;
  });

  const [extractedCards, setExtractedCards] = useState<any[] | null>(null);
  
  // -- COOLDOWN GUARD STATE AND LOGIC FOR UNIFIED INGESTION ENGINE V3 --
  const [engineGuard, setEngineGuard] = useState<'safe' | 'warn'>('safe');
  const [timerSeconds, setTimerSeconds] = useState(5);
  const [pendingTrigger, setPendingTrigger] = useState<'file_text' | 'json' | 'json_ai' | null>(null);
  const timerRef = useRef<any>(null);

  const startGuardTimer = (triggerType: 'file_text' | 'json' | 'json_ai') => {
    if (timerRef.current) clearInterval(timerRef.current);
    setEngineGuard('warn');
    setPendingTrigger(triggerType);
    setTimerSeconds(5);
    
    let currentSeconds = 5;
    timerRef.current = setInterval(() => {
      currentSeconds -= 1;
      if (currentSeconds <= 0) {
        clearInterval(timerRef.current);
        setEngineGuard('safe');
        setPendingTrigger(null);
        setTimerSeconds(5);
      } else {
        setTimerSeconds(currentSeconds);
      }
    }, 1000);
  };

  const cancelGuardTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setEngineGuard('safe');
    setPendingTrigger(null);
    setTimerSeconds(5);
  };

  const onConvertClick = () => {
    if (extractedCards && extractedCards.length > 0) {
      if (engineGuard === 'safe' || pendingTrigger !== 'file_text') {
        startGuardTimer('file_text');
      } else if (engineGuard === 'warn' && pendingTrigger === 'file_text') {
        cancelGuardTimer();
        setExtractedCards(null);
        handleConvert();
      }
    } else {
      handleConvert();
    }
  };

  const onParseJsonNormalClick = () => {
    if (extractedCards && extractedCards.length > 0) {
      if (engineGuard === 'safe' || pendingTrigger !== 'json') {
        startGuardTimer('json');
      } else if (engineGuard === 'warn' && pendingTrigger === 'json') {
        cancelGuardTimer();
        setExtractedCards(null);
        handleParseJsonOption(false);
      }
    } else {
      handleParseJsonOption(false);
    }
  };

  const onParseJsonAiClick = () => {
    if (extractedCards && extractedCards.length > 0) {
      if (engineGuard === 'safe' || pendingTrigger !== 'json_ai') {
        startGuardTimer('json_ai');
      } else if (engineGuard === 'warn' && pendingTrigger === 'json_ai') {
        cancelGuardTimer();
        setExtractedCards(null);
        handleParseJsonOption(true);
      }
    } else {
      handleParseJsonOption(true);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (extractedCards && extractedCards.length > 0) {
        e.preventDefault();
        e.returnValue = "Bạn có thẻ học tập chưa lưu! Rời khỏi trang web lúc này sẽ mất sạch toàn bộ số thẻ vừa tạo.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [extractedCards]);
  // -------------------------------------------------------------------

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Deduplication check utility (Pre-filtering existing cards)
  const getExistingCardFrontsMap = useCallback((): Set<string> => {
    const currentDecks = store.getDecks();
    const fronts = new Set<string>();
    currentDecks.forEach(d => {
      if (d.cards) {
        d.cards.forEach(c => {
          if (c.front) fronts.add(c.front.trim().toLowerCase());
        });
      }
    });
    return fronts;
  }, []);

  // Set categories logic
  const existingCategories = useMemo(() => {
    const allDecks = store.getDecks();
    const cats = allDecks.filter(d => d.subject).map(d => d.subject as string);
    return Array.from(new Set(cats));
  }, []);

  // Throttle logs display update (at most once every 600ms)
  const pushLog = (msg: string, immediate = false) => {
    allLogsRef.current.push(msg);
    if (allLogsRef.current.length > 200) {
      allLogsRef.current.shift(); // Tránh phình to logs khi tải 1000 thẻ học
    }
    
    if (immediate) {
      if (logRafRef.current) {
        cancelAnimationFrame(logRafRef.current);
        logRafRef.current = null;
      }
      setProgressLogs([...allLogsRef.current]);
    } else {
      if (!logRafRef.current) {
        logRafRef.current = requestAnimationFrame(() => {
          setProgressLogs([...allLogsRef.current]);
          logRafRef.current = null;
        });
      }
    }
  };

  // Direct REST Streaming pipeline bypassing Vercel lambda restrictions entirely
  const callGeminiStreamingAPI = async (textChunk: string, partIndex: number) => {
    // 1. Fetch secured active key from server securely
    const keyRes = await fetch("/api/automation/get-streaming-key");
    if (!keyRes.ok) {
      throw new Error(`Kho khóa API rỗng hoặc server đang bảo trì (Status ${keyRes.status})`);
    }
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.key) {
      throw new Error(keyData.message || "Không tìm thấy khóa Gemini hoạt động.");
    }
    const securedKey = keyData.key;
    
    // Set progression text with streaming details
    setStreamedBytes(0);
    setProgressText(`Đang truyền tải dữ liệu trực tiếp...`);

    // 2. Setup REST stream generate content endpoint
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?key=${securedKey}`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Hãy trích xuất tất cả các từ vựng/thuật ngữ quan trọng nhất từ đoạn văn bản/tài liệu tiếng Anh hoặc tiếng Việt sau đây thành Flashcards chất lượng cao. Với mỗi Flashcard, cung cấp từ vựng/câu hỏi thâm sâu (front), định nghĩa/câu trả lời súc tích tuyệt đối (back), từ loại (wordForm), phát âm IPA (ipa), ví dụ thực tế chuẩn bối cảnh (example), và nguồn gốc bối cảnh xuất xứ (origin).\n\nVăn bản đầu vào bản gốc:\n${textChunk}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: `Ngươi là AI bóc tách Flashcard siêu tốc của Henosis. Nhiệm vụ duy nhất: Đọc văn bản tiếng Việt/Anh và bóc tách danh sách từ vựng/thuật ngữ quan trọng thành các Flashcard. Bắt buộc xuất ra định dạng JSON thỏa mãn cấu trúc: { "cards": [ { "front": "tử vựng/câu hỏi", "back": "nghĩa/câu trả lời", "explanation": "giải thích ngắn gọn", "wordForm": "từ loại", "ipa": "phát âm IPA", "example": "ví dụ thực tế", "origin": "từ gốc trong bài" } ] }. Tuyệt đối không được thêm thụt lề (indentation), không thêm xuống dòng thừa, không bọc trong thẻ \`\`\`json. Không sinh trường 'category' hay bất kỳ thông tin thừa nào khác. Chỉ sinh duy nhất chuỗi JSON nén siêu gọn để tối ưu tối đa băng thông.`
            }
          ]
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let niceError = `Đường truyền trực tiếp thất bại với mã trạng thái: ${response.status}`;
      if (errText.includes("API_KEY_INVALID") || errText.includes("API key not valid")) {
        niceError = "Khóa bảo mật AI lấy từ hệ thống gặp lỗi kích hoạt của Google. Hệ thống tự động đẩy khóa vào danh sách làm nguội để xoay vòng.";
      }
      throw new Error(niceError);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullAccumulatedText = "";
    let byteCounter = 0;

    if (reader) {
      pushLog(`📡 [Truyền tải V8.0] Đã thiết lập liên kết trực tiếp an toàn với Cloud Gemini [Lite Engine]...`);
      pushLog(`🍿 Mở đầu luồng dữ liệu thời gian thực cho Phân đoạn ${partIndex + 1}...`);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        byteCounter += value.length;
        setStreamedBytes(byteCounter);
        const chunkStr = decoder.decode(value, { stream: true });
        
        // Dynamic streaming text extraction
        const textMatches = chunkStr.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
        if (textMatches) {
          for (const match of textMatches) {
            const valMatch = match.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (valMatch && valMatch[1]) {
              try {
                const decodedPart = JSON.parse(`"${valMatch[1]}"`);
                fullAccumulatedText += decodedPart;
                
                const cleanPreview = decodedPart.replace(/[\n\r]+/g, " ");
                if (cleanPreview.trim().length > 0) {
                  pushLog(`🛰️ -> ${cleanPreview.substring(0, 60)}${cleanPreview.length > 60 ? "..." : ""} [Truyền tải: ${byteCounter} bytes]`);
                }
              } catch (err) {}
            }
          }
        }
      }
    }

    pushLog(`🛸 [Phần ${partIndex + 1}] Đã nhận đầy đủ ${byteCounter} bytes dữ liệu luồng. Khởi động Trình vá cú pháp cao cấp (Auto-Recovery Syntax Sanitizer)...`);

    const healedJsonStr = sanitizeAndHealJson(fullAccumulatedText);
    let parsedData: any = null;
    
    try {
      parsedData = JSON.parse(healedJsonStr);
    } catch (e) {
      pushLog("⚠️ Trình vá cú pháp cao cấp tự vá JSON thất bại, khởi động cơ chế bóc tách Regex thô bạo...", true);
      const cardObjects: any[] = [];
      const frontBackRegex = /\{\s*"front"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"back"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"explanation"\s*:\s*"((?:[^"\\]|\\.)*)")?(?:\s*,\s*"wordForm"\s*:\s*"((?:[^"\\]|\\.)*)")?(?:\s*,\s*"ipa"\s*:\s*"((?:[^"\\]|\\.)*)")?(?:\s*,\s*"example"\s*:\s*"((?:[^"\\]|\\.)*)")?(?:\s*,\s*"origin"\s*:\s*"((?:[^"\\]|\\.)*)")?/gi;
      
      let match;
      while ((match = frontBackRegex.exec(healedJsonStr)) !== null) {
        try {
          const frontVal = JSON.parse(`"${match[1]}"`);
          const backVal = JSON.parse(`"${match[2]}"`);
          const expVal = match[3] ? JSON.parse(`"${match[3]}"`) : "";
          const wfVal = match[4] ? JSON.parse(`"${match[4]}"`) : "";
          const ipaVal = match[5] ? JSON.parse(`"${match[5]}"`) : "";
          const exVal = match[6] ? JSON.parse(`"${match[6]}"`) : "";
          const origVal = match[7] ? JSON.parse(`"${match[7]}"`) : "";
          
          cardObjects.push({
            front: frontVal,
            back: backVal,
            explanation: expVal,
            wordForm: wfVal,
            ipa: ipaVal,
            example: exVal,
            origin: origVal
          });
        } catch (err) {}
      }

      if (cardObjects.length > 0) {
        parsedData = { cards: cardObjects };
        pushLog(`🛠️ Bóc tách thành công ${cardObjects.length} thẻ bằng Regex fallback.`);
      } else {
        throw new Error("Không thể phục hồi hoặc phân tích cấu trúc dữ liệu thẻ bài học từ luồng.");
      }
    }

    if (parsedData && Array.isArray(parsedData.cards)) {
      return parsedData.cards;
    } else {
      throw new Error("Mẫu dữ liệu bóc tách từ Google AI không đủ điều kiện phân mảng thẻ.");
    }
  };

   // Removed broken useEffect

  // Auto-scanning active cached session on mount
  useEffect(() => {
    setReviewPage(1);
  }, [extractedCards?.length]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const parsed = await localforage.getItem<any>("costudy_unified_convert_session");
        if (parsed) {
          if (parsed && Array.isArray(parsed.chunks) && parsed.chunks.length > 0) {
            // Check session expiration (safely destroy after 24h)
            if (parsed.createdAt && Date.now() - parsed.createdAt > 24 * 60 * 60 * 1050) {
              await localforage.removeItem("costudy_unified_convert_session");
            } else {
              setActiveSession(parsed);
              setDeckTitle(parsed.deckTitle || "");
              setDeckSubject(parsed.deckSubject || "");
              setActiveImportTab(parsed.importTab || "file");
              if (parsed.allGeneratedCards && parsed.allGeneratedCards.length > 0) {
                setExtractedCards(parsed.allGeneratedCards);
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to recover conversion cache state:", e);
      }
    };
    loadSession();
  }, []);

  // Drag and drop zone handlers
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        // Tạm thời hiển thị cảnh báo nhưng vẫn cho phép up, sẽ chuyển chunk
        pushLog("⚠️ Kích thước tệp > 10MB. Sẽ kích hoạt chế độ tự động băm nhỏ (Stream Upload) để vượt proxy.");
      }
      setFile(selected);
      setUploadedFileName(selected.name.replace(/\.[^/.]+$/, ""));
      setError(null);
      setSuccessCount(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setUploadedFileName(selected.name.replace(/\.[^/.]+$/, ""));
      setError(null);
      setSuccessCount(null);
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        // Warning
        pushLog("⚠️ Kích thước tệp JSON > 10MB, có thể bị chậm.", true);
      }
      const reader = new FileReader();
      reader.onload = () => {
        setJsonPasteInput(reader.result as string);
        setError(null);
        setSuccessCount(null);
        pushLog(`📥 Đã nạp dữ liệu JSON từ file: ${selected.name}`, true);
      };
      reader.onerror = () => {
        setError("Không thể đọc tệp này.");
      };
      reader.readAsText(selected);
    }
  };

  // Master Ingestion Normalizer
  const runNormalizationPipeline = async (rawText: string) => {
    pushLog("🧹 Đang thực thi Unified Ingestion Normalizer (Xử lý thô & lọc ký tự vòm)...", true);
    
    // Step 1: Clean control character sequences & dangerous tabs
    const preCleaned = cleanRawText(rawText);
    
    if (!preCleaned) {
      throw new Error("Không trích xuất được văn bản / Nội dung đầu vào rỗng sau chuẩn hóa.");
    }

    pushLog(`📝 Tổng ký tự thô: ${rawText.length} -> Văn bản sạch: ${preCleaned.length} ký tự.`);
    return preCleaned;
  };

  // Core Sequential & Parallel Pipeline Engine
  const processChunksSequentially = async (sessionData: typeof activeSession) => {
    if (!sessionData) return;
    setIsProcessing(true);
    setError(null);
    setSuccessCount(null);
    isCancelledRef.current = false;
    isPausedRef.current = false;

    const tasks = [...sessionData.chunks];
    const totalCount = tasks.length;
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Phiên hoạt động đã hết hạn. Vui lòng đăng nhập lại!");
      setIsProcessing(false);
      return;
    }

    pushLog(`🔮 [ENGINE KÍCH HOẠT] Khởi chạy song song đa luồng (Concurrency: ${concurrency}) bảo đảm hiệu năng tối ưu hóa để hướng tới cột mốc 1000 thẻ học.`, true);

    const existingFrontsMap = getExistingCardFrontsMap();

    // Re-synchronize previous session's extracted cards to tasks
    if (sessionData.allGeneratedCards && sessionData.allGeneratedCards.length > 0) {
      // Restore generated flashcards into tasks so the reducer combines them correctly
      sessionData.chunks.forEach((chunkTask, index) => {
        if (!tasks[index].flashcards || tasks[index].flashcards.length === 0) {
          tasks[index].flashcards = chunkTask.flashcards || [];
        }
      });
    }

    // Throttle state updates for premium 60FPS UI rendering
    let lastProgressUpdate = 0;
    const throttledProgressUpdate = (completedIdx: number) => {
      const now = Date.now();
      const pct = Math.min(100, Math.round((completedIdx / totalCount) * 100));
      const txt = `Đang xử lý phân đoạn [${completedIdx}/${totalCount}]...`;
      if (now - lastProgressUpdate >= 400 || completedIdx === totalCount) {
        lastProgressUpdate = now;
        requestAnimationFrame(() => {
          setProgressPercent(pct);
          setProgressText(txt);
        });
      }
    };

    const saveCheckpoint = (completedIdx: number) => {
      try {
        const combined = tasks.reduce((acc, t) => [...acc, ...(t.flashcards || [])], [] as any[]);
        
        // Tối ưu hóa sâu dữ liệu lưu trữ để tránh QuotaExceededError khi chạy 1000 thẻ học!
        const optimizedChunks = tasks.map(t => {
          if (t.status === "SUCCESS") {
            return { ...t, content: "" }; // Xóa nội dung thô của chunk đã xử lý xong để giải phóng bộ nhớ!
          }
          return t;
        });

        const checkpointSession = {
          importTab: sessionData.importTab,
          fileName: sessionData.fileName,
          deckTitle: sessionData.deckTitle,
          deckSubject: sessionData.deckSubject,
          rawLines: sessionData.rawLines || [],
          chunks: optimizedChunks,
          activeProgressIdx: completedIdx,
          allGeneratedCards: combined,
          logs: allLogsRef.current ? allLogsRef.current.slice(-30) : [], // Chỉ lưu 30 logs gần nhất để khôi phục nhanh
        };
        
        setActiveSession(checkpointSession);
        
        localforage.setItem("costudy_unified_convert_session", checkpointSession).catch(storageErr => {
          console.warn("Storage quota exceeded in localforage, saving minimal checkpoint...", storageErr);
          // Lưu tối giản nhất để bằng mọi giá không bị đứng tiến trình
          const minimalSession = {
            importTab: sessionData.importTab,
            fileName: sessionData.fileName,
            deckTitle: sessionData.deckTitle,
            deckSubject: sessionData.deckSubject,
            rawLines: [],
            chunks: optimizedChunks.map(c => ({ id: c.id, status: c.status, flashcards: c.flashcards })),
            activeProgressIdx: completedIdx,
            allGeneratedCards: combined,
            logs: []
          };
          localforage.setItem("costudy_unified_convert_session", minimalSession).catch(err => {
            console.error("Non-fatal checkpoint save failed. Sưu tập thẻ vẫn hoạt động bình thường:", err);
          });
        });
      } catch (err) {
        console.error("Non-fatal checkpoint sync logic failed:", err);
      }
    };

    let nextIndex = sessionData.activeProgressIdx;
    let completedCount = sessionData.activeProgressIdx;
    let activeWorkersCount = 0;

    const runWorker = async () => {
      while (nextIndex < totalCount && !isCancelledRef.current && !isPausedRef.current) {
        const i = nextIndex++;
        activeWorkersCount++;
        const task = tasks[i];
        pushLog(`⚡ [Phần ${i + 1}/${totalCount}] Đang gửi dữ liệu phân đoạn...`);
        task.status = "PROCESSING";
        
        throttledProgressUpdate(completedCount);

        let success = false;
        let attempt = 0;
        const maxRetries = 3;
        let lastErrorMessage = "";
        let cardsInChunk: any[] = [];
        let wasDegradedUsed = false;

        while (!success && attempt < maxRetries && !isCancelledRef.current && !isPausedRef.current) {
          attempt++;
          task.attempts = attempt;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 300000); // 300s strict timeout

          try {
            const isDegraded = attempt > 1;
            if (isDegraded) {
              wasDegradedUsed = true;
              pushLog(`🔄 [HẠ TẢI CHỦ ĐỘNG] Thử lần ${attempt}/${maxRetries} (Khối ${i+1}): Giản lược kích thước payload chống nghẽn nghẹt...`);
            } else {
              pushLog(`🤖 AI xử lý phân đoạn ${i + 1} [Thử lần ${attempt}/${maxRetries}].`);
            }
            
            const wordCount = task.content.split(/\s+/).filter((w: string) => w.length > 0).length;
            const calculatedMin = Math.max(6, Math.floor(wordCount / 12));
            const calculatedMax = Math.min(125, Math.max(20, Math.ceil(wordCount / 4.5)));

            try {
              pushLog(`📡 Khởi động Direct REST Streaming Pipeline (Bypass ceilings)...`);
              const streamedCards = await callGeminiStreamingAPI(task.content, i);
              if (streamedCards && streamedCards.length > 0) {
                cardsInChunk = streamedCards;
                success = true;
                clearTimeout(timeoutId);
              } else {
                throw new Error("Dữ liệu stream trống rỗng.");
              }
            } catch (streamErr: any) {
              pushLog(`⚠️ [Direct Stream Thất bại] ${streamErr.message || streamErr}. Đang tự động chuyển sang luồng truyền thống vững chãi...`, true);
              
              const rawResponse = await safeRequest("/api/automation/process-chunk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  textChunk: task.content,
                  isDegraded: isDegraded,
                  targetMin: calculatedMin,
                  targetMax: calculatedMax
                }),
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (!rawResponse.ok) {
                let errorMsg = `Server response error: ${rawResponse.status}`;
                try {
                  const errData = await rawResponse.json();
                  errorMsg = errData.message || errData.error || errorMsg;
                } catch (e) {}

                // Dispatch event to show the red popup
                window.dispatchEvent(new CustomEvent('global-api-error', { 
                  detail: { message: errorMsg, path: "/api/automation/process-chunk" } 
                }));

                const controlledError = new Error(errorMsg) as any;
                controlledError.handled = true;
                throw controlledError;
              }

              const resData = await rawResponse.json();
              if (resData && resData.success && Array.isArray(resData.cards)) {
                cardsInChunk = resData.cards;
                success = true;
              } else {
                throw new Error(resData.message || "Đầu ra không chứa mảng thẻ học hợp chuẩn.");
              }
            }

          } catch (err: any) {
            clearTimeout(timeoutId);
            if (err?.handled) {
              lastErrorMessage = err.message;
              pushLog(`⚠️ [Khối ${i+1}] Lỗi đã được xử lý bằng popup: ${lastErrorMessage}`, true);
              success = false;
              break; // Swallow error safely and exit the retry loop
            }

            const isAbortErr = err.name === "AbortError";
            lastErrorMessage = isAbortErr ? "Yêu cầu bị Aborted (Quá thời hạn 300 giây)." : err.message || err.toString();
            
            pushLog(`⚠️ [Khối ${i+1}] Thử thất bại [${attempt}/${maxRetries}]: ${lastErrorMessage}`, true);

            if (attempt < maxRetries && !isCancelledRef.current && !isPausedRef.current) {
              const currentBackoff = 8000 * Math.pow(2, attempt - 1);
              pushLog(`❄️ Lùi lại ${currentBackoff / 1000} giây trước khi tự động truy vấn lại...`);
              
              let waitRemaining = currentBackoff;
              while (waitRemaining > 0 && !isCancelledRef.current && !isPausedRef.current) {
                await new Promise(r => setTimeout(r, 200));
                waitRemaining -= 200;
              }
            }
          }
        }

        if (isCancelledRef.current || isPausedRef.current) {
          activeWorkersCount--;
          return;
        }

        if (success) {
          task.status = "SUCCESS";
          const { v4: uuidv4 } = await import("uuid");
          const filteredAndMapped: any[] = [];
          let duplicateSkipCount = 0;

          cardsInChunk.forEach((c: any) => {
            if (!c.front) return;
            const frontNormal = c.front.trim();
            const lowerFront = frontNormal.toLowerCase();

            if (sanitizeDuplicates && existingFrontsMap.has(lowerFront)) {
              duplicateSkipCount++;
              return;
            }

            const isIncomplete = wasDegradedUsed || !c.example || !c.origin;

            filteredAndMapped.push({
              id: `card_${uuidv4()}`,
              front: frontNormal,
              back: `${c.wordForm ? `(${c.wordForm}) ` : ""}${c.ipa ? `[${c.ipa}] ` : ""}${c.back || ""}${c.example ? `\nVí dụ: ${c.example}` : ""}`,
              wordForm: c.wordForm || "",
              ipa: c.ipa || "",
              example: c.example || "",
              origin: c.origin || "",
              mastery: 0,
              nextReview: Date.now(),
              isHard: false,
              userId: currentUser.uid,
              deckId: sessionData.fileName ? `deck_res_${sessionData.fileName.replace(/\s+/g, "")}` : "deck_default",
              subject: sessionData.deckSubject || "Tự chọn",
              createdAt: Date.now(),
              incomplete: isIncomplete ? true : false
            });
          });

          if (duplicateSkipCount > 0) {
            pushLog(`✨ [Phần ${i + 1}] Khử trùng: Đã lọc bỏ ${duplicateSkipCount} thẻ trùng lặp.`);
          }

          task.flashcards = filteredAndMapped;
          completedCount++;
          
          const combined = tasks.reduce((acc, t) => [...acc, ...(t.flashcards || [])], [] as any[]);
          setExtractedCards(combined);

          pushLog(`✅ [Phần ${i + 1}] Trích xuất thành công ${filteredAndMapped.length} Thẻ Mới.`);
          saveCheckpoint(completedCount);

          if (nextIndex < totalCount) {
            const delayTime = concurrency > 1 ? 300 : 1500;
            pushLog(`⏳ [Phần ${i + 1}] Giữ nhịp giãn cách API trong lọc ${delayTime / 1000}s...`);
            let cooldownProgress = delayTime;
            while (cooldownProgress > 0 && !isCancelledRef.current && !isPausedRef.current) {
              await new Promise(r => setTimeout(r, 200));
              cooldownProgress -= 200;
            }
          }
        } else {
          task.status = "FAILED";
          task.error = `Skipped due to error: ${lastErrorMessage}`;
          pushLog(`⚠️ [Khối ${i + 1}] Bỏ qua khối do sự cố liên hoàn: ${lastErrorMessage}`, true);

          try {
            let failsafeChunks: string[] = [];
            const rawLocalData = localStorage.getItem("henosis-failed-chunks");
            if (rawLocalData) {
              failsafeChunks = JSON.parse(rawLocalData);
            }
            failsafeChunks.push(task.content);
            localStorage.setItem("henosis-failed-chunks", JSON.stringify(failsafeChunks));
          } catch (exErr) {
            console.error("Lỗi ghi nhớ failsafe chunks:", exErr);
          }

          completedCount++;
          saveCheckpoint(completedCount);

          if (nextIndex < totalCount) {
            const delayTime = concurrency > 1 ? 1000 : 3000;
            let cooldownProgress = delayTime;
            while (cooldownProgress > 0 && !isCancelledRef.current && !isPausedRef.current) {
              await new Promise(r => setTimeout(r, 200));
              cooldownProgress -= 200;
            }
          }
        }
        activeWorkersCount--;
      }
    };

    // Parallel Worker dispatching pool
    const workers: Promise<void>[] = [];
    const actualConcurrency = Math.min(concurrency, totalCount - sessionData.activeProgressIdx);
    for (let w = 0; w < actualConcurrency; w++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);

    setIsProcessing(false);

    // If queue is fully finalized
    const isCompletedFully = tasks.every(t => t.status === "SUCCESS" || t.status === "FAILED");
    if (isCompletedFully) {
      const combined = tasks.reduce((acc, t) => [...acc, ...(t.flashcards || [])], [] as any[]);
      if (combined.length > 0) {
        setProgressPercent(100);
        setProgressText("Hoàn thành tuyệt hảo! Rà soát lại dữ liệu phía dưới rồi ấn Lưu.");
        setSuccessCount(combined.length);
        setExtractedCards(combined);
        pushLog(`🎉 TOÀN BỘ TIẾN TRÌNH HOÀN TẤT: Trích xuất thành công ${combined.length} thẻ học!`);
      } else {
        setError("Công đoạn hoàn thành nhưng không tìm thấy dữ liệu thẻ học hợp chuẩn.");
      }
      localforage.removeItem("costudy_unified_convert_session").catch(console.error);
      setActiveSession(null);
    }
  };

  // Action: Launch conversion process (Tab File or Tab Text inputs)
  const handleConvert = async () => {
    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsProcessing(true);
    setError(null);
    setSuccessCount(null);
    setProgressPercent(2);
    setProgressText("Đang chạy Unified Ingestion Normalizer...");
    allLogsRef.current = [];
    setProgressLogs([]);

    pushLog("🚀 KHỞI TẠO KHUNG ĐỒNG BỘ UNIFIED CONVERSION ENGINE");

    if (!isUserAdminOrTeacher && currentCount >= 3) {
      setError("Bạn đã đạt giới hạn 3 lần chuyển đổi bằng AI hôm nay. Nâng cấp Pro hoặc liên hệ Giáo viên.");
      setIsProcessing(false);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await triggerServerAndClientLock(currentUser.uid);
      }
      let extractedSourceText = "";
      let fileNameTarget = "";

      if (activeImportTab === "file") {
        if (!file) {
          throw new Error("Vui lòng tải lên tài liệu PDF, Hình ảnh hoặc file TEXT.");
        }
        pushLog(`📂 Tải tài liệu đa phương diện: ${file.name} | Dung lượng: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

        const isImage = file && (file.type.startsWith("image/") || file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|bmp)$/));
        if (isImage) {
          pushLog(`📸 Phát hiện định dạng hình ảnh phù hợp bóc tách Streaming: ${file.name}`);
          
          setIsProcessing(true);
          setProgressPercent(5);
          
          const { streamExtractImageContent } = await import("../lib/directImageStreamer");
          
          let lastLogIndex = -1;
          const rawCards = await streamExtractImageContent({
            file: file,
            onProgress: (statusText, bytesReceived) => {
              setProgressText(statusText);
              setProgressPercent(Math.min(95, Math.ceil((bytesReceived / file.size) * 100)));
            },
            onLog: (message, isError) => {
              pushLog(message, isError);
            },
            onChunkText: (text) => {
              if (lastLogIndex === -1) {
                allLogsRef.current.push("🤖 AI STREAM OUT => " + text);
                lastLogIndex = allLogsRef.current.length - 1;
              } else {
                allLogsRef.current[lastLogIndex] += text;
              }
              setProgressLogs([...allLogsRef.current]);
            }
          });

          // Data handoff
          const { v4: uuidv4 } = await import("uuid");
          const existingFrontsMap = getExistingCardFrontsMap();
          const filteredAndMapped: any[] = [];
          let duplicateSkipCount = 0;

          rawCards.forEach((c: any) => {
            if (!c.front) return;
            const frontNormal = c.front.trim();
            const lowerFront = frontNormal.toLowerCase();

            if (sanitizeDuplicates && existingFrontsMap.has(lowerFront)) {
              duplicateSkipCount++;
              return;
            }

            filteredAndMapped.push({
              id: `card_${uuidv4()}`,
              front: frontNormal,
              back: `${c.wordForm ? `(${c.wordForm}) ` : ""}${c.ipa ? `[${c.ipa}] ` : ""}${c.back || ""}${c.example ? `\nVí dụ: ${c.example}` : ""}`,
              wordForm: c.wordForm || "",
              ipa: c.ipa || "",
              example: c.example || "",
              origin: c.origin || "",
              mastery: 0,
              nextReview: Date.now(),
              isHard: false,
              userId: currentUser ? currentUser.uid : "anonymous",
              deckId: file.name ? `deck_res_${file.name.replace(/\s+/g, "")}` : "deck_default",
              subject: deckSubject.trim() || "Tự chọn",
              createdAt: Date.now(),
              incomplete: false
            });
          });

          if (duplicateSkipCount > 0) {
            pushLog(`✨ Khử trùng: Đã lọc bỏ ${duplicateSkipCount} thẻ trùng lặp.`);
          }

          setExtractedCards(filteredAndMapped);
          setSuccessCount(filteredAndMapped.length);
          setProgressPercent(100);
          setProgressText("Hoàn thành bóc tách trực tiếp tuyệt hảo! Rà soát dữ liệu rồi ấn Lưu.");
          pushLog(`🎉 TOÀN BỘ TIẾN TRÌNH HOÀN TẤT: Trích xuất thành công ${filteredAndMapped.length} thẻ học!`);
          
          setIsProcessing(false);
          return;
        }

        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          pushLog("📄 Phát hiện file TEXT (.txt) học tập thô. Đang đọc trực tiếp ở Client-side...");
          setProgressText("Đang đọc nội dung file text...");
          const reader = new FileReader();
          const textPromise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = e => reject(e);
          });
          reader.readAsText(file);
          extractedSourceText = await textPromise;
          fileNameTarget = file.name;
        } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          pushLog("📄 Phát hiện tệp tài liệu PDF. Khởi chạy bộ giải mã Client-Side PDF.js Engine độc quyền...");
          setProgressText("Đang nạp định vị thư viện PDF.js...");
          
          const pdfjsLib = await loadPdfJS();
          setProgressText("Đang phân tích cấu trúc PDF...");
          
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          
          loadingTask.onProgress = (progress: any) => {
            if (progress.total > 0) {
              const loadedPct = Math.round((progress.loaded / progress.total) * 100);
              setProgressText(`Đang nạp dữ liệu PDF (${loadedPct}%)...`);
            }
          };
          
          const pdf = await loadingTask.promise;
          const totalPages = pdf.numPages;
          pushLog(`📖 Hoàn tất nạp tài liệu PDF: Có tổng cộng ${totalPages} trang sách.`);
          
          let parsedPagesText: string[] = [];
          
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            setProgressText(`Đang phân tách văn bản trang [${pageNum}/${totalPages}]...`);
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            
            // Map over items and concatenate item.str. We sanitize on line-by-line level later.
            const pageText = content.items
              .map((item: any) => item.str || "")
              .join(' ');
              
            if (pageText.trim()) {
              parsedPagesText.push(pageText);
            }
          }
          
          // Fallback Trigger: OCR Processing
          if (parsedPagesText.join("").trim().length === 0) {
            pushLog("⚠️ Phát hiện PDF dạng ảnh/quét. Kích hoạt Anti-Image-PDF Tesseract.js OCR Engine...");

            const workerCount = Math.max(1, Math.min(navigator.hardwareConcurrency ? navigator.hardwareConcurrency - 1 : 2, 4));
            setProgressText(`Khởi tạo OCR đa luồng (${workerCount} luồng)...`);
            pushLog(`⚙️ Khởi tạo ${workerCount} OCR Workers & Tối ưu Scale render...`);
            
            const workers = await Promise.all(
              Array(workerCount).fill(0).map(() => createWorker('vie+eng'))
            );
            
            let ocrText = "";
            let processedPages = 0;
            const results: {pageNum: number, text: string}[] = [];
            const queue = Array.from({ length: totalPages }, (_, i) => i + 1);

            const processPage = async (pageNum: number, worker: any) => {
              const page = await pdf.getPage(pageNum);
              // Giới hạn scale xuống 1.5 để tối giảm ~44% số pixel cần xử lý so với 2.0
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context!, viewport }).promise;
              
              const { data: { text } } = await worker.recognize(canvas);
              
              processedPages++;
              setProgressText(`OCR trang [${processedPages}/${totalPages}]...`);
              
              return { pageNum, text };
            };

            const workerTasks = workers.map(async (worker) => {
              while (queue.length > 0) {
                const pageNum = queue.shift();
                if (pageNum !== undefined) {
                  const res = await processPage(pageNum, worker);
                  results.push(res);
                }
              }
            });

            await Promise.all(workerTasks);
            await Promise.all(workers.map(w => w.terminate()));

            results.sort((a, b) => a.pageNum - b.pageNum);
            ocrText = results.map(r => r.text).join("\n\n");
            
            if (ocrText.trim()) {
              parsedPagesText.push(ocrText);
              pushLog(`✅ Hoàn tất siêu tốc bằng Multithreading & Scale Optimize.`);
            }
          }
          
          // Double-filtered: apply the sanitizer line-by-line prior to slicing
          const rawJoinedText = parsedPagesText.join("\n\n");
          const splitLines = rawJoinedText.split(/\r?\n/);
          const thoroughlySanitizedLines = splitLines.filter(line => isCleanHumanLine(line));
          
          extractedSourceText = thoroughlySanitizedLines.join("\n");
          fileNameTarget = file.name;
          
          pushLog(`✅ Trích xuất văn bản PDF.js hoàn tất: Thu được ${extractedSourceText.length} kí tự văn bản thô cực kỳ sạch sẽ.`);
        } else {
          pushLog("🛰️ Bắt đầu đánh giá tải trọng tài liệu để điều phối luồng...");
          const THRESHOLD = 10 * 1024 * 1024;
          let tempRawText = "";
          
          if (file.size <= THRESHOLD) {
            pushLog("🟢 Kích thước an toàn (<=10MB). Đang vận chuyển trực tiếp nguyên khối (Direct Full Upload) sang Gateway AI...");
            setProgressText("Đang nhận dạng văn bản nguyên khối...");
            
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = e => reject(e);
            });
            reader.readAsDataURL(file);
            const base64Data = await base64Promise;
            
            const extractRes = await safeRequest("/api/extract-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                isChunked: false,
                fileData: base64Data,
                mimeType: file.type || "application/pdf"
              })
            });

            if (!extractRes.ok) throw new Error("Gateway trích xuất OCR phản hồi lỗi bất ngờ.");
            const extractResData = await extractRes.json();
            tempRawText = extractResData.rawText || "";
            
          } else {
            pushLog("🔴 CẢNH BÁO TẢI TRỌNG (>10MB). Kích hoạt cơ chế Streaming Băm Nhỏ (Fault-Tolerant Chunked Streaming)...");
            const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per slice config
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            let finalResData: any = null;
            
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
              const start = chunkIndex * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const chunkBlob = file.slice(start, end);
              
              pushLog(`📦 Đang băm và truyền tải Frame [${chunkIndex + 1}/${totalChunks}]...`);
              setProgressText(`Đảng tải Frame [${chunkIndex + 1}/${totalChunks}]...`);
              
              const base64ChunkPromise = new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = e => reject(e);
                reader.readAsDataURL(chunkBlob);
              });
              const base64ChunkData = await base64ChunkPromise;
              
              const extractRes = await safeRequest("/api/extract-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  isChunked: true,
                  chunkIndex,
                  totalChunks,
                  uploadId,
                  fileData: base64ChunkData,
                  mimeType: file.type || "application/pdf"
                })
              });
              
              if (!extractRes.ok) throw new Error(`Lỗi truyền tải Frame [${chunkIndex + 1}/${totalChunks}]`);
              const responseData = await extractRes.json();
              if (chunkIndex === totalChunks - 1) {
                finalResData = responseData; // Last chunk causes completion extraction
              }
            }
            
            pushLog("✅ Hoàn tất hợp nhất nguyên khối (Assembly). Gateway đang trích xuất dữ liệu...");
            tempRawText = finalResData?.rawText || "";
          }

          extractedSourceText = tempRawText;
          fileNameTarget = file.name;
        }
      } else {
        // Tab Text Ingestion
        if (!rawTextarea.trim()) {
          throw new Error("Vui lòng nhập văn bản thô.");
        }
        extractedSourceText = rawTextarea;
        fileNameTarget = "TextareaInput";
      }

      // Step 2: Ingestion cleaning
      const cleanText = await runNormalizationPipeline(extractedSourceText);

      // Step 3: Split text thô thành các segment nhỏ (Deep Client-Side Content Slicing)
      let segmentChunks: string[] = [];
      const totalWords = cleanText.split(/\s+/).filter(w => w.length > 0).length;

      pushLog(`📊 Phân tích số liệu từ: ${totalWords} words.`);

      const wordSafetyCeiling = 600;
      const charSafetyCeiling = 9000;

      if (isChunkingEnabled) {
        pushLog("✂️ Kích hoạt Sliding Window splitter.");
        const processed = splitIntoChunks(cleanText, {
          maxWords: chunkMaxWords,
          maxChars: chunkMaxChars,
          overlapWords: chunkOverlapWords
        });
        segmentChunks = processed.map(x => x.words.join(" "));
      } else if (totalWords > wordSafetyCeiling || cleanText.length > charSafetyCeiling) {
        pushLog("⚠️ Phát hiện văn bản quá tải! Để đảm bảo an toàn & không mất dữ liệu, tự động phân mảnh siêu mượt (Auto Safety Slicing)...", true);
        const processed = splitIntoChunks(cleanText, {
          maxWords: wordSafetyCeiling,
          maxChars: charSafetyCeiling,
          overlapWords: 15
        });
        segmentChunks = processed.map(x => x.words.join(" "));
      } else {
        pushLog("📝 Văn bản nằm trong ngưỡng an toàn, tiến hành xử lý nguyên khối.");
        segmentChunks = [cleanText];
      }

      if (segmentChunks.length === 0 || !segmentChunks[0]) {
        throw new Error("Dữ liệu rỗng hoặc không thể chia nhỏ.");
      }

      setLastSplitMetrics({
        totalWords,
        totalChars: cleanText.length,
        chunkCount: segmentChunks.length
      });

      pushLog(`💡 Phân rã văn bản thô thành ${segmentChunks.length} sequential sub-packets.`);

      const mappedChunks: ChunkTask[] = segmentChunks.map((c, index) => ({
        id: `chunk_${Date.now()}_${index}`,
        index,
        content: c,
        status: "PENDING",
        attempts: 0,
        flashcards: []
      }));

      // Initialize session Object
      const sessionData = {
        importTab: activeImportTab,
        fileName: fileNameTarget,
        deckTitle: deckTitle.trim() || uploadedFileName || `Bộ thẻ học AI ${todayStr}`,
        deckSubject: deckSubject.trim() || "Tự chọn",
        rawLines: cleanText.split("\n"),
        chunks: mappedChunks,
        activeProgressIdx: 0,
        allGeneratedCards: [],
        logs: allLogsRef.current,
        createdAt: Date.now()
      };

      // Add generation usage tracker
      if (!isUserAdminOrTeacher) {
        const nextC = currentCount + 1;
        localStorage.setItem(trackingKey, nextC.toString());
        setCurrentCount(nextC);
      }

      setActiveSession(sessionData);
      try {
        await localforage.setItem("costudy_unified_convert_session", sessionData);
      } catch (storageErr) {
        console.warn("Storage quota exceeded on initial save. Running in RAM only.", storageErr);
      }

      // Launch sequential worker
      await processChunksSequentially(sessionData);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Xảy ra sự cố không lường trước.");
      setIsProcessing(false);
      setProgressText("");
    } finally {
      await triggerServerAndClientUnlock();
    }
  };

  // Option 1 Handler: Copy Paste JSON Syntax fixes via AI or Local parser
  const handleParseJsonOption = async (useAiSlightFix = false) => {
    if (!jsonPasteInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSuccessCount(null);
    setProgressText("Đang đọc và chuẩn hóa cấu trúc JSON...");

    try {
      let cleanJson = jsonPasteInput.replace(/```(?:json)?/g, "").trim();
      let finalCards: any[] = [];

      if (useAiSlightFix) {
        pushLog("🛰️ Đang vận dụng AI để khôi phục cấu trúc JSON vỡ nát...", true);
        const res = await fetch("/api/automation/validate-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonText: cleanJson })
        });

        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.cards)) {
          finalCards = data.cards;
          pushLog(`✨ AI đã phục dựng thành công mảng JSON với ${data.cards.length} thẻ chất lượng.`);
        } else {
          throw new Error(data.message || "Mô hình xử lý JSON không thể dọn sạch tệp này.");
        }
      } else {
        // Direct manual parsing
        let parsedData = JSON.parse(cleanJson);
        if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
          if (parsedData.title) setDeckTitle(parsedData.title);
          if (parsedData.subject) setDeckSubject(parsedData.subject);
          if (Array.isArray(parsedData.cards)) {
            parsedData = parsedData.cards;
          } else {
            throw new Error("Không thấy mảng 'cards' trong JSON Object.");
          }
        }
        if (!Array.isArray(parsedData)) {
          throw new Error("JSON nhập vào không biểu thị một mảng hợp lý.");
        }
        finalCards = parsedData;
      }

      const { v4: uuidv4 } = await import("uuid");
      const mapped = finalCards.map((item: any, idx: number) => ({
        id: `card_json_${uuidv4()}_${idx}`,
        front: item.front || "",
        wordForm: item.wordForm || "",
        ipa: item.ipa || "",
        back: item.back || "",
        example: item.example || ""
      }));

      setExtractedCards(mapped);
      setSuccessCount(mapped.length);
      pushLog(`🎉 Đồng bộ Preview thành công! Chuẩn bị nhập trực tiếp ${mapped.length} thẻ.`);
    } catch (err: any) {
      console.error(err);
      setError(`Lỗi Cú Pháp JSON: ${err.message || "Kiểm tra lại ngoắc vuông hoặc nháy kép"}. Chuyển sang "Sửa Cú Pháp Bằng AI" để sửa lỗi tự động.`);
    } finally {
      setIsProcessing(false);
      setProgressText("");
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;
    await processChunksSequentially(activeSession);
  };

  const handlePauseSession = () => {
    isPausedRef.current = true;
    pushLog("⏸️ Đã yêu cầu tạm dừng. Hệ thống sẽ giữ trạng thái sau khi hoàn tất chunk hiện tại.", true);
  };

  const handleCancelSession = () => {
    isCancelledRef.current = true;
    localforage.removeItem("costudy_unified_convert_session").catch(console.error);
    setActiveSession(null);
    setExtractedCards(null);
    setSuccessCount(null);
    setProgressText("");
    setProgressPercent(0);
    setError(null);
    setIsProcessing(false);
    setProgressLogs([]);
    allLogsRef.current = [];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Update card fields locally in preview view
  const handleCardChange = useCallback((id: string, field: 'front' | 'back', value: string) => {
    setExtractedCards(prev => prev ? prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ) : null);
  }, []);

  const handleRemoveCard = useCallback((id: string) => {
    setExtractedCards(prev => prev ? prev.filter(c => c.id !== id) : null);
  }, []);

  // Background quiet worker to populate examples and descriptions for simplified/degraded flashcards
  const runQuietIncompleteHydrationBackground = useCallback(async (cardsToHydrate: any[], targetDeckId?: string) => {
    console.log(`[Hydration Sub-Agent] Khởi chạy nạp ví dụ thầm lặng song song cho ${cardsToHydrate.length} thẻ học khuyết thiếu...`);
    
    const CONCURRENCY = 10; // Chạy song song lên tới 10 cards cùng lúc nhờ cơ chế xoay vòng key robust
    let currentIndex = 0;

    const worker = async (workerId: number) => {
      while (currentIndex < cardsToHydrate.length) {
        // Lấy card tiếp theo theo thứ tự và tăng chỉ mục một cách an toàn
        const currentTaskIndex = currentIndex++;
        if (currentTaskIndex >= cardsToHydrate.length) break;
        
        const card = cardsToHydrate[currentTaskIndex];
        if (!card) continue;

        try {
          console.log(`[Hydration Worker #${workerId}] Đang sinh ví dụ ngầm cho thẻ [${currentTaskIndex + 1}/${cardsToHydrate.length}]: '${card.front}'`);
          
          const rawRes = await fetch("/api/automation/hydrate-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              front: card.front,
              wordForm: card.wordForm,
              back: card.back
            })
          });

          if (!rawRes.ok) {
            throw new Error(`Mã phản hồi Hydration: ${rawRes.status}`);
          }

          const resData = await rawRes.json();
          if (resData && resData.success) {
            const { example, origin } = resData;

            // Cập nhật document tương ứng trên Firestore
            const cardRef = doc(db, "flashcards", card.id);
            const formBackPrefix = `${card.wordForm ? `(${card.wordForm}) ` : ""}${card.ipa ? `[${card.ipa}] ` : ""}`;
            
            // Loại bỏ định dạng ví dụ cũ (nếu có) trước khi ghép ví dụ đầy đủ mới
            const originalBackText = card.back.replace(/\nVí dụ:[\s\S]*/, "").trim();
            const cleanBackText = originalBackText.startsWith(formBackPrefix)
              ? originalBackText.substring(formBackPrefix.length).trim()
              : originalBackText.trim();

            const finalFormattedBack = `${formBackPrefix}${cleanBackText}${example ? `\nVí dụ: ${example}` : ""}`;

            await updateDoc(cardRef, {
              example: example || "",
              origin: origin || "",
              back: finalFormattedBack
            });

            // Cập nhật đồng thời trong kho dữ liệu cục bộ LocalStore Memory của thiết bị
            const currentDeck = store.getDeck(card.deckId || targetDeckId || "");
            if (currentDeck) {
              const updatedCards = (currentDeck.cards || []).map((c: any) => {
                if (c.id === card.id) {
                  return {
                    ...c,
                    back: finalFormattedBack
                  };
                }
                return c;
              });
              await store.addDeck({
                ...currentDeck,
                cards: updatedCards
              });
            }

            console.log(`[Hydration Worker #${workerId}] ✅ Đã nạp thành công câu ví dụ cho '${card.front}': ${example}`);
          }
        } catch (err: any) {
          console.warn(`[Hydration Worker #${workerId}] ⚠️ Không thể tự nạp cho từ '${card.front}':`, err.message || err);
        }

        // Nghỉ ngơi ngắn 300ms sau mỗi câu của từng luồng để tản lưu lượng nhẹ nhàng
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    // Khởi tạo và khởi chạy song song 10 workers độc lập
    const workersCount = Math.min(CONCURRENCY, cardsToHydrate.length);
    const workerPromises = Array.from({ length: workersCount }, (_, i) => worker(i + 1));
    
    await Promise.all(workerPromises);
    console.log(`[Hydration Sub-Agent] 🎉 Toàn tất tiến trình chạy ngầm song song bổ sung câu ví dụ mẫu.`);
  }, []);

  // Save the resolved cards list directly into Firestore and LocalStore (Syncing phase)
  const handleSaveDeck = useCallback(async () => {
    if (!extractedCards || extractedCards.length === 0) return;
    
    setIsProcessing(true);
    setProgressText("Đang tiến hành đồng bộ Firestore & LocalStore...");
    setError(null);
    
    try {
      const { v4: uuidv4 } = await import("uuid");
      const deckId = `deck_${uuidv4()}`;
      
      // Luôn trích xuất trực tiếp từ Refs đồng bộ để bẻ gãy triệt để mọi closure trì hoãn hay delay state của React
      const currentIsSplitEnabled = isSplitDeckEnabledRef.current;
      const currentSplitSizeVal = splitDeckSizeRef.current;
      const currentIsAddToExisting = isAddToExistingRef.current;
      const currentDeckTitle = deckTitleRef.current;
      const currentDeckSubject = deckSubjectRef.current;

      const titleToUse = currentDeckTitle.trim() || uploadedFileName || `Chuyển đổi AI ${todayStr}`;
      const subjectToUse = currentDeckSubject.trim() || "Tự chọn";

      const targetDeck = currentIsAddToExisting && selectedExistingDeckId ? store.getDeck(selectedExistingDeckId) : null;
      const finalDeckId = targetDeck ? targetDeck.id : deckId;
      const finalSubject = targetDeck ? (targetDeck.subject || "Tự chọn") : subjectToUse;

      const BATCH_LIMIT = 400;
      const batches: Promise<void>[] = [];
      const currentUser = auth.currentUser;

      // Ép kiểu cực kỳ nghiêm ngặt để triệt tiêu mọi rủi ro dính NaN, undefined hoặc chuỗi rỗng
      const parsedSplitSize = Math.max(5, Number(currentSplitSizeVal) || 40);
      const isSplitActive = (currentIsSplitEnabled === true || String(currentIsSplitEnabled) === "true") && !currentIsAddToExisting;
      const shouldSplit = isSplitActive && extractedCards.length > parsedSplitSize;

      pushLog(`🔍 [THIẾT LẬP LƯU BỘ THẺ] Phân tích trạng thái phân chia thẻ học:`, true);
      pushLog(`  - Nút tự động chia nhỏ hoạt động: ${currentIsSplitEnabled ? "BẬT" : "TẮT"}`);
      pushLog(`  - Thêm thẻ học vào bộ sẵn có: ${currentIsAddToExisting}`);
      pushLog(`  - Ngưỡng giới hạn thẻ tối đa mỗi bộ: ${parsedSplitSize} thẻ`);
      pushLog(`  - Tổng số thẻ chuẩn bị ghi nhận: ${extractedCards.length} thẻ`);
      pushLog(`  -> Kết luận Chia Nhỏ: ${shouldSplit ? "KÍCH HOẠT CHIA TỰ ĐỘNG" : "KHÔNG CHIA - NHẬP GHÉP LÀM 1 BỘ HỌC PHẦN CHUNG"}`);

      if (shouldSplit) {
        const splitSize = parsedSplitSize;
        const splitCount = Math.ceil(extractedCards.length / splitSize);
        pushLog(`✂️ [CHIA TỰ ĐỘNG] Tiến hành băm nhỏ ${extractedCards.length} thẻ thành ${splitCount} bộ độc lập (Mỗi phần chứa tối đa ${splitSize} thẻ)...`, true);

        const decksToCreate: Deck[] = [];
        const cardsToHydrate: any[] = [];

        for (let s = 0; s < splitCount; s++) {
          const subDeckId = `deck_${uuidv4()}`;
          const subDeckTitle = `${titleToUse} - Phần ${s + 1}`;
          const startIdx = s * splitSize;
          const endIdx = startIdx + splitSize;
          const subCards = extractedCards.slice(startIdx, endIdx);

          pushLog(`📦 Đang kiến tạo bộ thẻ học thứ ${s + 1}/${splitCount}: "${subDeckTitle}" chứa ${subCards.length} thẻ...`);

          const subCardsMapped: any[] = [];
          let currentBatch = writeBatch(db);
          let cardsInBatchCount = 0;

          subCards.forEach((c) => {
            const cardId = c.id.startsWith("temp_") || c.id.startsWith("card_json_") || c.id.startsWith("card_") ? c.id : `card_${uuidv4()}`;
            const cardRef = doc(db, "flashcards", cardId);
            
            const firestorePayload = {
              id: cardId,
              front: c.front.trim(),
              wordForm: c.wordForm || "",
              ipa: c.ipa || "",
              back: c.back.trim(),
              example: c.example || "",
              origin: c.origin || "",
              subject: finalSubject,
              mastery: 0,
              nextReview: Date.now(),
              isHard: false,
              userId: currentUser?.uid || "anonymous",
              deckId: subDeckId,
              createdAt: Date.now()
            };

            currentBatch.set(cardRef, firestorePayload);
            cardsInBatchCount++;

            subCardsMapped.push({
              id: cardId,
              front: c.front.trim(),
              wordForm: c.wordForm || "",
              back: c.back.trim(),
              subject: finalSubject,
              mastery: 0,
              nextReview: Date.now(),
              isHard: false
            });

            if (c.incomplete) {
              cardsToHydrate.push({
                ...c,
                id: cardId,
                deckId: subDeckId
              });
            }

            if (cardsInBatchCount >= BATCH_LIMIT) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              cardsInBatchCount = 0;
            }
          });

          if (cardsInBatchCount > 0) {
            batches.push(currentBatch.commit());
          }

          decksToCreate.push({
            id: subDeckId,
            title: subDeckTitle,
            subject: finalSubject,
            cards: subCardsMapped
          });
        }

        pushLog(`⚡ Đang truyền tải ${batches.length} phân vùng dữ liệu Firestore đồng bộ lên đám mây...`, true);
        // Commit all Firestore operations in parallel
        await Promise.all(batches);

        pushLog(`💾 Đang cập nhật cơ sở dữ liệu danh mục cục bộ LocalStore...`);
        // Commit and sync to LocalStore
        for (const d of decksToCreate) {
          await store.addDeck(d);
        }

        pushLog(`🎉 Chia nhỏ và nạp thành công ${splitCount} bộ thẻ riêng độc lập vào thư viện!`);

        // Khởi động chạy ngầm bổ sung câu ví dụ cho các thẻ incomplete thầm lặng
        if (cardsToHydrate.length > 0) {
          runQuietIncompleteHydrationBackground(cardsToHydrate);
        }

      } else {
        const newCardsMapped: any[] = [];
        const cardsToHydrate: any[] = [];

        for (let i = 0; i < extractedCards.length; i += BATCH_LIMIT) {
          const chunk = extractedCards.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);

          chunk.forEach((c) => {
            const cardId = c.id.startsWith("temp_") || c.id.startsWith("card_json_") || c.id.startsWith("card_") ? c.id : `card_${uuidv4()}`;
            const cardRef = doc(db, "flashcards", cardId);
            
            const firestorePayload = {
              id: cardId,
              front: c.front.trim(),
              wordForm: c.wordForm || "",
              ipa: c.ipa || "",
              back: c.back.trim(),
              example: c.example || "",
              origin: c.origin || "",
              subject: finalSubject,
              mastery: 0,
              nextReview: Date.now(),
              isHard: false,
              userId: currentUser?.uid || "anonymous",
              deckId: finalDeckId,
              createdAt: Date.now()
            };

            batch.set(cardRef, firestorePayload);

            newCardsMapped.push({
              id: cardId,
              front: c.front.trim(),
              wordForm: c.wordForm || "",
              back: c.back.trim(),
              subject: finalSubject,
              mastery: 0,
              nextReview: Date.now(),
              isHard: false
            });

            if (c.incomplete) {
              cardsToHydrate.push({
                ...c,
                id: cardId,
                deckId: finalDeckId
              });
            }
          });

          batches.push(batch.commit());
        }

        // Commit all Firestore operations in parallel bursts
        await Promise.all(batches);

        // Commit and sync to LocalStore
        const newDeckObj: Deck = targetDeck ? {
          ...targetDeck,
          cards: [...(targetDeck.cards || []), ...newCardsMapped]
        } : {
          id: finalDeckId,
          title: titleToUse,
          subject: finalSubject,
          cards: newCardsMapped
        };

        await store.addDeck(newDeckObj);
        
        // Khởi động chạy ngầm bổ sung câu ví dụ cho các thẻ incomplete thầm lặng
        if (cardsToHydrate.length > 0) {
          runQuietIncompleteHydrationBackground(cardsToHydrate, finalDeckId);
        }
      }

      setSuccessCount(extractedCards.length);
      setExtractedCards(null);
      setDeckTitle("");
      setDeckSubject("");
      setRawTextarea("");
      setJsonPasteInput("");
      setUploadedFileName("");
      setIsAddToExisting(false);
      setSelectedExistingDeckId("");
      setProgressText("Đã đồng bộ lên cơ sở dữ liệu đám mây thành công!");
      
    } catch (err: any) {
      console.error(err);
      setError("Khôi phục lỗi đồng bộ: " + err.message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgressText(""), 3000);
    }
  }, [extractedCards, deckTitle, deckSubject, uploadedFileName, isAddToExisting, selectedExistingDeckId, todayStr, isSplitDeckEnabled, splitDeckSize]);

  return (
    <section className="card-3d rounded-3xl p-6 md:p-8 relative bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="absolute top-0 right-0 bg-orange-500 text-zinc-950 text-[10px] uppercase font-black tracking-wider px-4 py-1.2 rounded-bl-2xl shadow-md z-10 font-sans">
        🚀 UNIFIED INGESTION ENGINE v3
      </div>
      
      {/* Upper Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-2xl border border-orange-500/20 shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-zinc-900 dark:text-zinc-50">Bộ Trích Xuất Thẻ Học AI Đa Năng</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Tích hợp trọn vẹn cả 3 pipeline: File tài liệu, Đoạn văn thô, và copy dán JSON.</p>
            {aiUsage && aiUsage.isFreeUser && (
              <div className="mt-2.5 px-3 py-2 bg-orange-500/5 dark:bg-orange-950/10 border border-orange-500/20 rounded-xl flex items-center justify-between gap-4 text-[11px] animate-in slide-in-from-top-2 duration-300">
                <span className="flex items-center gap-1.5 font-bold text-orange-600 dark:text-orange-400">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse shrink-0" />
                  Hạn mức AI hôm nay: {aiUsage.used}/{aiUsage.total} lượt dùng
                </span>
                <div className="flex-1 max-w-[120px] bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((aiUsage.used / aiUsage.total) * 100))}%` }}
                  />
                </div>
                {aiUsage.used >= aiUsage.total ? (
                  <span className="text-[10px] text-red-500 font-extrabold dark:text-red-400">Đã hết lượt!</span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-bold dark:text-zinc-400 opacity-80">Còn {aiUsage.total - aiUsage.used} lượt</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Usages tracker */}
        {!isUserAdminOrTeacher && (
           <div className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 flex items-center gap-2.5 text-xs font-semibold shrink-0 shadow-sm transition">
             <span className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse",
                currentCount >= 3 ? "bg-red-500 shadow-lg shadow-red-500/30" : "bg-emerald-500 shadow-lg shadow-emerald-500/30"
             )} />
             <span className="opacity-70 text-zinc-700 dark:text-zinc-300">Lượt AI miễn phí:</span>
             <span className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-extrabold",
                currentCount >= 3 
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" 
                  : "bg-emerald-100 text-emerald-750 dark:bg-emerald-950/40 dark:text-emerald-400"
              )}>
                 {currentCount}/3 hôm nay
             </span>
           </div>
        )}
      </div>

      {/* Persistence Auto-Resume Alert box */}
      {activeSession && (
        <div className="bg-orange-500/10 border border-orange-550/25 p-4.5 rounded-2xl mb-2 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-in fade-in slide-in-from-top-3 duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.2 h-full bg-orange-500" />
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5.5 h-5.5 text-orange-500 shrink-0 mt-0.5 animate-bounce-slow" />
            <div>
              <h4 className="font-extrabold text-sm text-orange-850 dark:text-orange-400 flex items-center gap-1.5Parser">
                ⚠️ KHÔI PHỤC TIẾN TRÌNH NHẬP LIỆU DỞ DANG (LOCAL CACHE)
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 font-medium leading-relaxed">
                Tài liệu <strong>{activeSession.fileName}</strong> đang tạm dừng ở phân đoạn <strong>{activeSession.activeProgressIdx}/{activeSession.chunks?.length}</strong>. 
                Tích lũy khả dụng: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{extractedCards?.length || 0} thẻ</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button 
              onClick={handleResumeSession}
              disabled={isProcessing}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-zinc-950 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer hover:shadow hover:scale-103 duration-150 flex items-center gap-1"
            >
              <Play className="w-3 h-3 fill-current" /> Tiếp tục luôn (Resume)
            </button>
            <button 
              onClick={handleCancelSession}
              disabled={isProcessing}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 disabled:opacity-50 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Bỏ qua hết (Reset)
            </button>
          </div>
        </div>
      )}

      {error && <ErrorNotification message={error} onRetry={() => setError(null)} />}
      
      {successCount !== null && (
        <div className="flex items-center gap-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-4.5 rounded-2xl font-bold mb-2 animate-in fade-in slide-in-from-top-2 border border-emerald-500/20">
          <div className="p-1.5 bg-emerald-500/15 rounded-lg">
            <Check className="w-5 h-5 flex-shrink-0 stroke-[3]" />
          </div>
          <span>Cơ chế nạp thành công! Đã chuẩn bị {successCount} thẻ chất lượng. Hãy rà soát lại và ấn Lưu Học Phần.</span>
        </div>
      )}

      {/* Unified Tab Switchers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 gap-1">
        <button
          onClick={() => { if (!isProcessing) setActiveImportTab("file"); }}
          disabled={isProcessing}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
            activeImportTab === "file" 
              ? "bg-white dark:bg-zinc-805 text-orange-600 dark:text-orange-450 shadow-sm"
              : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300 disabled:opacity-40"
          )}
        >
          <FileText className="w-4 h-4" /> 📁 FILE / IMAGE
        </button>
        <button
          onClick={() => { if (!isProcessing) setActiveImportTab("text"); }}
          disabled={isProcessing}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
            activeImportTab === "text" 
              ? "bg-white dark:bg-zinc-805 text-orange-600 dark:text-orange-450 shadow-sm"
              : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300 disabled:opacity-40"
          )}
        >
          <span className="text-sm">✍️</span> VĂN BẢN THÔ
        </button>
        <button
          onClick={() => { if (!isProcessing) setActiveImportTab("json"); }}
          disabled={isProcessing}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
            activeImportTab === "json" 
              ? "bg-white dark:bg-zinc-805 text-orange-600 dark:text-orange-450 shadow-sm"
              : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300 disabled:opacity-40"
          )}
        >
          <span className="text-sm">⚙️</span> DÁN CHUỖI JSON
        </button>
        <button
          onClick={() => { if (!isProcessing) setActiveImportTab("manual"); }}
          disabled={isProcessing}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
            activeImportTab === "manual" 
              ? "bg-white dark:bg-zinc-805 text-orange-600 dark:text-orange-450 shadow-sm"
              : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300 disabled:opacity-40"
          )}
        >
          <span className="text-sm">📝</span> NHẬP THỦ CÔNG
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Left Side: Input Form zone */}
        <div data-tour="step-4" className="space-y-4">
          
          {activeImportTab === "file" && (
             <div 
                className={cn(
                   "border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-colors h-56 cursor-pointer transform-gpu md:hover:scale-101 duration-200 shadow-inner",
                   file ? "border-orange-500 bg-orange-500/5" : "border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
                   isProcessing && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
             >
                <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileChange} 
                   className="hidden" 
                   accept="application/pdf,image/*,text/plain"
                />
                
                {file ? (
                   <>
                      <FileText className="w-12 h-12 text-orange-500 mb-4 animate-pulse" />
                      <p className="font-extrabold text-sm line-clamp-1 text-zinc-800 dark:text-zinc-200">{file.name}</p>
                      <p className="text-xs opacity-60 mt-1 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <span className="text-[10px] mt-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-black">Nhấn để thay thế</span>
                   </>
                ) : (
                   <>
                      <FileUp className="w-12 h-12 text-zinc-400 dark:text-zinc-700 mb-4" />
                      <p className="font-bold text-sm">Tải Tài Liệu Lớp Học</p>
                      <p className="text-xs opacity-60 mt-1.5 leading-relaxed">Nhấn hoặc Kéo thả file PDF, Ảnh hoặc File TEXT (.txt) vào đây.<br />Hỗ trợ file kích thước lớn qua chế độ băm tải lên.</p>
                   </>
                )}
             </div>
          )}

          {activeImportTab === "text" && (
            <div className="space-y-2">
              <label className="text-xs font-black uppercase opacity-70 block tracking-wide">Nhập hoặc Dán văn bản học tập thô</label>
              <textarea
                value={rawTextarea}
                onChange={(e) => setRawTextarea(e.target.value)}
                disabled={isProcessing}
                placeholder="Ví dụ dán: 
vibration - sự rung động
break down - phân tích, hỏng hóc...
Hoặc dán toàn bộ đoạn văn bài đọc IELTS/TOEFL vào đây. AI sẽ tự nhặt từ vựng xịn và gõ IPA dốc lòng!"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-4.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[224px] focus:bg-white resize-y"
              />
            </div>
          )}

          {activeImportTab === "json" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Specialized Dropzone box for .txt/.json files containing JSON Array */}
              <div 
                className={cn(
                  "border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all h-32 cursor-pointer transform-gpu duration-150 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-100/50 dark:hover:bg-zinc-850/30",
                  isProcessing && "opacity-55 pointer-events-none"
                )}
                onClick={() => jsonFileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={jsonFileInputRef} 
                  onChange={handleJsonFileChange} 
                  className="hidden" 
                  accept=".json,.txt" 
                />
                <Database className="w-6 h-6 text-orange-500 mb-1.5" />
                <p className="font-extrabold text-[11px] text-zinc-800 dark:text-zinc-200">📂 Tải lên Tệp Tin chứa JSON (.txt hoặc .json)</p>
                <p className="text-[9px] opacity-65 leading-tight mt-1 max-w-[260px] mx-auto">Click hoặc kéo thả file dán sẵn chuỗi JSON dạng mảng thẻ học để nạp trực tiếp siêu tốc</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase opacity-70 block tracking-wide">Hoặc nhập chuỗi JSON thô thủ công</label>
                </div>
                <textarea
                  value={jsonPasteInput}
                  onChange={(e) => setJsonPasteInput(e.target.value)}
                  disabled={isProcessing}
                  placeholder={`Mẫu hợp chuẩn:
[
  { "front": "hello", "back": "xin chào" }
]`}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-4.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[120px] resize-y"
                />
              </div>

              {/* Fix syntax Action buttons */}
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={onParseJsonNormalClick}
                  disabled={isProcessing || !jsonPasteInput.trim()}
                  className={cn(
                    "py-2.5 px-4 text-xs font-bold rounded-xl transition cursor-pointer border flex items-center justify-center gap-1.5 disabled:opacity-50",
                    (engineGuard === "warn" && pendingTrigger === "json")
                      ? "bg-orange-600 hover:bg-orange-705 border-orange-500 animate-pulse text-white shadow"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 hover:shadow text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  {engineGuard === "warn" && pendingTrigger === "json" ? (
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-center leading-tight">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-white animate-bounce" />
                      XOÁ {extractedCards?.length || 0} THẺ? NHẤN LẠI ({timerSeconds}s)
                    </span>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" /> Parse JSON trực tiếp
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onParseJsonAiClick}
                  disabled={isProcessing || !jsonPasteInput.trim()}
                  className={cn(
                    "py-2.5 px-4 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5",
                    (engineGuard === "warn" && pendingTrigger === "json_ai")
                      ? "bg-orange-600 hover:bg-orange-705 border-orange-500 animate-pulse text-white shadow-lg"
                      : "bg-orange-500 hover:bg-orange-600 disabled:opacity-55 text-zinc-950 shadow-sm hover:shadow active:scale-98"
                  )}
                >
                  {engineGuard === "warn" && pendingTrigger === "json_ai" ? (
                    <span className="flex items-center gap-1 text-[10px] uppercase font-black text-center leading-tight">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-white animate-bounce" />
                      XOÁ {extractedCards?.length || 0} THẺ? NHẤN LẠI ({timerSeconds}s)
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Sửa Cú Pháp Bằng AI
                    </>
                  )}
                </button>
              </div>

              {/* Autumn fallback manual button */}
              <button
                type="button"
                onClick={() => setShowBypassModal(true)}
                className="w-full py-2.5 px-4 text-xs font-extrabold rounded-xl transition cursor-pointer bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 active:scale-98"
              >
                🍳 Chuyển JSON bằng cơm (Dự phòng)
              </button>
            </div>
          )}

          {activeImportTab === "manual" && (
            <div className="space-y-4 animate-in fade-in duration-200">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="text-xs font-black uppercase opacity-70 block tracking-wide">Tạo Thẻ Học Thủ Công</h4>
                 <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold px-2 py-0.5 rounded">Giống chức năng Admin</span>
               </div>
               
               <div className="flex flex-col xl:flex-row gap-6">
                 {/* Left side: Card Builder */}
                 <div className="flex-1">
                   <div className={`p-5 rounded-2xl border ${editingManualId ? "border-orange-400 bg-orange-500/5" : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"} relative transition-all duration-300`}>
                     <div className="flex justify-between items-center mb-4">
                       <h5 className="font-bold text-sm flex items-center gap-1.5">
                         <Plus className={`w-4 h-4 ${editingManualId ? "text-orange-500" : "text-orange-500"}`} />
                         {editingManualId ? "Cập Nhật Thông Tin Thẻ" : "Thêm Thông Tin Thẻ"}
                       </h5>
                       {editingManualId && (
                         <button
                           type="button"
                           onClick={() => {
                             setEditingManualId(null);
                             setManualFront("");
                             setManualWordForm("");
                             setManualBack("");
                             manualFrontInputRef.current?.focus();
                           }}
                           className="flex items-center gap-1 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-bold rounded-md transition"
                         >
                           <X className="w-3 h-3" /> Bỏ qua
                         </button>
                       )}
                     </div>

                     <form 
                       onSubmit={(e) => {
                         e.preventDefault();
                         if (!manualFront.trim() || !manualBack.trim()) return;
                         
                         if (editingManualId) {
                           setManualBatch(prev => prev.map(c => 
                             c.id === editingManualId 
                               ? { ...c, front: manualFront.trim(), wordForm: manualWordForm.trim(), back: manualBack.trim() } 
                               : c
                           ));
                           setEditingManualId(null);
                         } else {
                           import("uuid").then(({ v4: uuidv4 }) => {
                             setManualBatch(prev => [...prev, {
                               id: `manual_${uuidv4()}`,
                               front: manualFront.trim(),
                               wordForm: manualWordForm.trim(),
                               back: manualBack.trim()
                             }]);
                           });
                         }
                         
                         setManualFront("");
                         setManualWordForm("");
                         setManualBack("");
                         manualFrontInputRef.current?.focus();
                       }}
                       className="space-y-4"
                     >
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                           <Type className="w-3 h-3" /> Mặt trước (Từ / Khái niệm)
                         </label>
                         <input
                           ref={manualFrontInputRef}
                           type="text"
                           className="w-full text-sm p-3 bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 transition font-medium"
                           placeholder="Nhập từ vựng, câu hỏi..."
                           value={manualFront}
                           onChange={(e) => setManualFront(e.target.value)}
                           required
                         />
                       </div>

                       <div className="space-y-1">
                         <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                           <Speech className="w-3 h-3" /> Từ loại / Phát âm (Không bắt buộc)
                         </label>
                         <input
                           type="text"
                           className="w-full p-2.5 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-orange-500 transition text-xs font-mono"
                           placeholder="VD: Noun, Verb, /'stʌdi/..."
                           value={manualWordForm}
                           onChange={(e) => setManualWordForm(e.target.value)}
                         />
                       </div>

                       <div className="space-y-1">
                         <div className="flex items-center justify-between">
                           <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                             <BookOpen className="w-3 h-3" /> Mặt sau (Nghĩa / Lời giải)
                           </label>
                           <button
                             type="button"
                             onClick={handleGenerateManualBack}
                             disabled={isGeneratingManualAi || !manualFront.trim()}
                             className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] rounded flex items-center gap-1 transition disabled:opacity-50"
                           >
                             {isGeneratingManualAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                             AI Phân Tích
                           </button>
                         </div>
                         <textarea
                           rows={3}
                           className="w-full p-3 bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 transition resize-none text-sm leading-relaxed"
                           placeholder="Giải thích chi tiết, ý nghĩa, ví dụ..."
                           value={manualBack}
                           onChange={(e) => setManualBack(e.target.value)}
                           required
                           onKeyDown={(e) => {
                             if (e.key === "Enter" && !e.shiftKey) {
                               e.preventDefault();
                               if (manualFront.trim() && manualBack.trim()) {
                                 e.currentTarget.form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                               }
                             }
                           }}
                         />
                       </div>

                       <div className="flex justify-end pt-1">
                         <button
                           type="submit"
                           disabled={!manualFront.trim() || !manualBack.trim()}
                           className={`px-4 py-2 font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 duration-200
                             ${editingManualId ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-zinc-800 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black"}
                           `}
                         >
                           {editingManualId ? "Cập Nhật" : "Thêm Vào Batch"}
                           <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-white/20 dark:bg-black/20 rounded font-mono text-[9px] shadow-sm text-inherit">Enter</kbd>
                         </button>
                       </div>
                     </form>
                   </div>
                 </div>

                 {/* Right side: Batch List */}
                 <div className="w-full xl:w-72 2xl:w-80 flex flex-col pt-3 xl:pt-0">
                   <div className="flex items-center justify-between mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                     <h5 className="font-bold text-xs tracking-wide opacity-80 uppercase">Danh sách chờ lưu</h5>
                     <div className="px-2 py-0.5 bg-orange-500/20 text-orange-700 dark:text-orange-400 font-bold rounded-lg text-[10px]">
                       {manualBatch.length} Thẻ
                     </div>
                   </div>

                   <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-y-auto max-h-[300px] xl:max-h-[380px] p-2 space-y-2 scrollbar-thin">
                     {manualBatch.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-8">
                         <Layers className="w-8 h-8 mb-2 opacity-50" />
                         <p className="text-xs font-bold">Trống</p>
                         <p className="text-[10px] mt-1 px-4">Hãy điền form bên trái để thêm thẻ</p>
                       </div>
                     ) : (
                       manualBatch.map((card, idx) => (
                         <div
                           key={card.id}
                           className={`p-2.5 bg-white dark:bg-zinc-900 rounded-lg group transition-colors relative ${
                             editingManualId === card.id
                               ? "border border-orange-400 shadow-sm"
                               : "border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50"
                           }`}
                         >
                           <div className="flex justify-between items-start gap-2">
                             <div className="flex-1 min-w-0 pr-1">
                               <div className="flex items-center gap-1 mb-1">
                                 <span className="text-[9px] font-bold opacity-40">#{idx + 1}</span>
                                 {editingManualId === card.id && <span className="text-[9px] text-orange-500 font-bold">(Đang sửa)</span>}
                               </div>
                               <h6 className="font-bold text-xs line-clamp-1">
                                 {card.front} {card.wordForm && <span className="opacity-50 font-normal italic">({card.wordForm})</span>}
                               </h6>
                               <p className="text-[10px] opacity-70 line-clamp-2 mt-0.5 leading-snug">{card.back}</p>
                             </div>

                             <div className={`flex flex-col gap-1 transition-opacity opacity-100`}>
                               <button
                                 onClick={() => {
                                   setManualFront(card.front);
                                   setManualWordForm(card.wordForm || "");
                                   setManualBack(card.back || "");
                                   setEditingManualId(card.id);
                                   manualFrontInputRef.current?.focus();
                                 }}
                                 className="p-1.5 rounded transition bg-orange-500/10 hover:bg-orange-500 text-orange-600 hover:text-white"
                               >
                                 <Edit3 className="w-3 h-3" />
                               </button>
                               <button
                                 onClick={() => {
                                   setManualBatch(prev => prev.filter(c => c.id !== card.id));
                                   if (editingManualId === card.id) {
                                     setEditingManualId(null);
                                     setManualFront("");
                                     setManualWordForm("");
                                     setManualBack("");
                                   }
                                 }}
                                 className="p-1.5 rounded transition bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white"
                               >
                                 <Trash2 className="w-3 h-3" />
                               </button>
                             </div>
                           </div>
                         </div>
                       ))
                     )}
                   </div>

                   <button
                     type="button"
                     onClick={() => {
                       if (manualBatch.length === 0) return;
                       setIsProcessing(true);
                       setError(null);
                       setProgressText("Đang nạp dữ liệu thủ công...");
                       
                       setTimeout(() => {
                         const mapped = manualBatch.map(card => ({
                           ...card,
                           wordForm: card.wordForm || "",
                           ipa: "",
                           example: ""
                         }));
                         setExtractedCards(mapped);
                         setSuccessCount(mapped.length);
                         pushLog(`🎉 Đã nạp thành công ${mapped.length} thẻ học phần do ngài vừa nhập thủ công.`);
                         setIsProcessing(false);
                         setProgressText("");
                       }, 400); // slight delay for effect
                     }}
                     disabled={manualBatch.length === 0 || isProcessing || editingManualId !== null}
                     className="mt-3 w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold text-xs rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-1.5"
                   >
                     {isProcessing ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
                     Nạp vào Grid ({manualBatch.length} thẻ)
                   </button>
                 </div>
               </div>
            </div>
          )}

          {/* Slicing sliding-window settings */}
          {activeImportTab !== "json" && activeImportTab !== "manual" && (
             <div data-tour="step-3" className="p-4 bg-zinc-50 dark:bg-zinc-900/35 border border-zinc-200/60 dark:border-zinc-800/70 rounded-2xl space-y-3.5">
                {/* Concurrency speed-up thread controller */}
                <div className="pb-3 border-b border-zinc-250/65 dark:border-zinc-800 flex flex-col gap-1.5 animate-in fade-in duration-300">
                  <label className="block text-[9px] uppercase font-black text-zinc-500 flex items-center gap-1 leading-tight">
                    <Zap className="w-3 h-3 text-orange-500 animate-pulse" /> Luồng Xử Lý Đồng Thời
                  </label>
                  <input
                     type="number"
                     min="1"
                     max="20"
                     value={concurrency}
                     onChange={(e) => {
                       const val = e.target.value;
                       setConcurrency(val === '' ? '' as any : Number(val));
                     }}
                     onBlur={(e) => {
                       const val = Number(e.target.value);
                       if (!val || val < 1) setConcurrency(1);
                       else if (val > 20) setConcurrency(20);
                     }}
                     disabled={isProcessing}
                     className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg px-2 py-1.5 focus:outline-none font-bold text-[11px]"
                  />
                  <p className="text-[9px] text-zinc-500 mt-1">Tuỳ chỉnh không giới hạn mặc định (1-20 luồng)</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">⚙️ Cấu hình Micro-Slicing bảo vệ luồng</span>
                   <input 
                      type="checkbox" 
                      id="opt-chunking"
                      checked={isChunkingEnabled} 
                      onChange={(e) => setIsChunkingEnabled(e.target.checked)} 
                      disabled={isProcessing}
                      className="w-4 h-4 text-orange-500 cursor-pointer disabled:opacity-50"
                   />
                </div>

                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/40 pt-2.5">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">💎 Khử trùng (Lọc bỏ thẻ từ vựng đã có)</span>
                   <input 
                      type="checkbox" 
                      id="opt-sanitize-duplicates"
                      checked={sanitizeDuplicates} 
                      onChange={(e) => setSanitizeDuplicates(e.target.checked)} 
                      disabled={isProcessing}
                      className="w-4 h-4 text-emerald-500 cursor-pointer disabled:opacity-50"
                   />
                </div>

                {isChunkingEnabled && (
                   <div className="space-y-3 pt-1 animate-in slide-in-from-top-1 duration-200">
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                         <div>
                            <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Từ tối đa / Batch</label>
                            <select
                               value={chunkMaxWords}
                               onChange={(e) => {
                                 const val = Number(e.target.value);
                                 setChunkMaxWords(val);
                                 setChunkMaxChars(val * 15);
                               }}
                               disabled={isProcessing}
                               className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg px-2 py-1.5 focus:outline-none font-bold"
                            >
                                <option value={100}>100 từ (Cực nhỏ)</option>
                                <option value={150}>150 từ (Mặc định)</option>
                                <option value={200}>200 từ</option>
                                <option value={300}>300 từ (Nhanh)</option>
                                <option value={400}>400 từ (Đề nghị)</option>
                                <option value={600}>600 từ (Rất nhanh)</option>
                                <option value={800}>800 từ (Cân bằng)</option>
                                <option value={1000}>1000 từ (Lớn)</option>
                                <option value={1200}>1200 từ (Siêu lớn)</option>
                                <option value={1500}>1500 từ (Bộ tối đa)</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Kí tự tối đa / Batch</label>
                            <select
                               value={chunkMaxChars}
                               onChange={(e) => setChunkMaxChars(Number(e.target.value))}
                               disabled={isProcessing}
                               className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg px-2 py-1.5 focus:outline-none font-bold"
                            >
                               <option value={1500}>1500 kí tự</option>
                               <option value={2500}>2500 kí tự (Mặc định)</option>
                               <option value={3000}>3000 kí tự</option>
                               <option value={4500}>4500 kí tự</option>
                               <option value={6005}>6000 kí tự (Khuyên dùng)</option>
                               <option value={9000}>9000 kí tự</option>
                                <option value={12000}>12000 kí tự</option>
                                <option value={15000}>15000 kí tự</option>
                                <option value={20000}>20000 kí tự (Tối ưu mốc 1000)</option>
                            </select>
                         </div>
                      </div>
                   </div>
                )}
             </div>
          )}

        </div>

        {/* Right Side: Setup Output & Run Actions */}
        <div className="space-y-4">
               {/* Target Deck Configuration */}
           <div className="space-y-4">
              <div className="p-4 bg-orange-500/5 dark:bg-zinc-900/30 border border-orange-500/10 dark:border-zinc-800/80 rounded-2xl space-y-3.5 shadow-sm">
                 <label className="text-xs font-black uppercase opacity-75 mb-1.5 block tracking-wide">THÊM THẺ HỌC VÀO BỘ THẺ SẴN CÓ</label>
                 <CustomDeckSelect
                   decks={store.getDecks()}
                   value={isAddToExisting && selectedExistingDeckId ? selectedExistingDeckId : "new"}
                   onChange={(val) => {
                     if (val === "new") {
                       setIsAddToExisting(false);
                       setSelectedExistingDeckId("");
                     } else {
                       setIsAddToExisting(true);
                       setSelectedExistingDeckId(val);
                     }
                   }}
                   disabled={isProcessing}
                 />
              </div>

           {/* Manual creation form details */}
           {!isAddToExisting && (
              <div className="space-y-4 animate-in fade-in duration-200">
                 <div>
                    <label className="text-xs font-black uppercase opacity-75 mb-1.5 block tracking-wide">Chỉ định Tên Bộ Thẻ Học</label>
                    <input 
                       type="text" 
                       value={deckTitle} 
                       onChange={(e) => setDeckTitle(e.target.value)} 
                       disabled={isProcessing}
                       className="w-full input-3d px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                       placeholder="Để trống AI sẽ tự phân tích và tạo tên"
                    />
                 </div>

                 <div className="relative">
                    <label className="text-xs font-black uppercase opacity-75 mb-1.5 block tracking-wide">Danh mục môn học / Category</label>
                    {!isCreatingNewSubject ? (
                      <div className="flex gap-2 animate-in fade-in duration-200">
                        <select
                          value={deckSubject}
                          onChange={(e) => {
                            if (e.target.value === "__NEW__") {
                              setIsCreatingNewSubject(true);
                              setDeckSubject("");
                            } else {
                              setDeckSubject(e.target.value);
                            }
                          }}
                          disabled={isProcessing}
                          className="flex-1 input-3d px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 disabled:opacity-50 font-bold"
                        >
                          <option value="">-- Lựa chọn danh mục --</option>
                          {existingCategories.map((cat, idx) => (
                            <option key={idx} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option
                            value="__NEW__"
                            className="text-orange-600 font-extrabold"
                          >
                            + Tạo danh mục học mới...
                          </option>
                        </select>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setIsCreatingNewSubject(true);
                            setDeckSubject("");
                          }}
                          className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition shrink-0 focus:outline-none disabled:opacity-50 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={deckSubject}
                          onChange={(e) => setDeckSubject(e.target.value)}
                          disabled={isProcessing}
                          placeholder="English, Từ vựng, Chuyên ngành..."
                          className="flex-1 input-3d px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setIsCreatingNewSubject(false);
                            setDeckSubject("");
                          }}
                          className="px-3 py-2 bg-zinc-100 hover:bg-zinc-205 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl transition text-[11px] font-bold disabled:opacity-50 border border-zinc-200"
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto Split Deck Configuration */}
                  <div className="p-4 bg-orange-500/5 dark:bg-zinc-900/30 border border-orange-500/15 dark:border-zinc-800/80 rounded-2xl space-y-3 shadow-inner hover:shadow-sm transition duration-300">
                     <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                           type="checkbox" 
                           checked={isSplitDeckEnabled} 
                           onChange={(e) => setIsSplitDeckEnabled(e.target.checked)} 
                           disabled={isProcessing}
                           className="w-4.5 h-4.5 text-orange-500 rounded border-zinc-300 focus:ring-orange-500 checked:bg-orange-500"
                        />
                        <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                           Tự động chia nhỏ bộ thẻ học
                        </span>
                     </label>
                     {isSplitDeckEnabled && (
                        <div className="flex items-center gap-3.5 pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40 animate-in slide-in-from-top-1.5 duration-200 text-xs text-zinc-600 dark:text-zinc-400 font-bold">
                           <span>Mỗi bộ tối đa:</span>
                           <input 
                              type="number" 
                              min={5}
                              max={500}
                              value={splitDeckSize || ""}
                              onChange={(e) => {
                                 const val = parseInt(e.target.value, 10);
                                 setSplitDeckSize(isNaN(val) ? 40 : Math.max(5, val));
                              }}
                              disabled={isProcessing}
                              className="w-20 input-3d px-2.5 py-1 text-center font-black rounded-lg text-orange-600 dark:text-orange-405"
                           />
                           <span>thẻ học</span>
                        </div>
                     )}
                  </div>
               </div>
            )}
           </div>

           {/* Conversion master execution triggers */}
           {activeImportTab !== "json" && (
             <button 
                onClick={onConvertClick}
                disabled={isProcessing || isAiSystemBusy || (activeImportTab === "file" && !file) || (!isUserAdminOrTeacher && currentCount >= 3)}
                className={cn("w-full btn-3d py-3 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase text-xs transition-all duration-300", (engineGuard === "warn" && pendingTrigger === "file_text") ? "bg-orange-600 hover:bg-orange-705 animate-pulse border-orange-500 text-white shadow-lg scale-102" : "btn-3d-primary")}
             >
                {isProcessing ? (
                   <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Đang xử lý tuần tự...
                   </>
                ) : (
                   <>
                      {engineGuard === "warn" && pendingTrigger === "file_text" ? <span className="flex items-center gap-1.5 text-center justify-center leading-normal text-[11px]"><AlertTriangle className="w-4.5 h-4.5 text-white animate-bounce shrink-0" /> CẢNH BÁO: XOÁ SẠCH {extractedCards?.length || 0} THẺ CHƯA LƯU? NHẤN LẠI ĐỂ LẬT CHỐT ({timerSeconds}s)</span> : <>{isAiSystemBusy ? <Lock className="w-4.5 h-4.5 text-orange-500 animate-bounce" /> : <Play className="w-4.5 h-4.5 fill-current" />} {isAiSystemBusy ? "Hệ thống AI đang bận xử lý..." : "Bắt đầu chuyển đổi AI"}</>}
                   </>
                )}
             </button>
           )}

           {/* Processing Progress Panel */}
           {isProcessing && (
              <div className="mt-4 p-4.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 space-y-3 animate-in zoom-in-95 duration-200">
                 <p className="text-xs font-extrabold text-orange-600 dark:text-orange-405 text-center flex items-center justify-center gap-1.5">
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>
                        {progressText === "Đang truyền tải dữ liệu trực tiếp..." ? "Đang truyền tải dữ liệu trực tiếp từ vệ tinh Google AI (Streaming)..." : progressText}
                        {streamedBytes > 0 && (
                           <span className="font-mono text-[10px] bg-orange-500/20 text-orange-700 dark:text-orange-405 px-1.5 py-0.5 rounded ml-1.5 animate-pulse">
                              ({streamedBytes.toLocaleString()} bytes)
                           </span>
                        )}
                     </span>
                 </p>
                 {progressPercent > 0 && (
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden shadow-inner relative">
                       <div 
                          className="bg-orange-500 h-full rounded-full transition-all duration-500 ease-out shadow shadow-orange-500/40" 
                          style={{ width: `${progressPercent}%` }}
                       ></div>
                    </div>
                 )}
                 
                 <div className="flex justify-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                       type="button"
                       onClick={handlePauseSession}
                       className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/50 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                       Tạm dừng
                    </button>
                    <button
                       type="button"
                       onClick={handleCancelSession}
                       className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-rose-950/40 dark:text-rose-400 border border-red-200/50 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                       <Trash2 className="w-3.5 h-3.5" /> Dừng & Reset
                    </button>
                 </div>
               </div>
            )}

        </div>
      </div>

      {/* Real-time System Progress Logs Panel (Throttled 60FPS) */}
      {(progressLogs.length > 0 || isProcessing || (typeof window !== "undefined" && !localStorage.getItem('hasRunTutorial'))) && (
         <div data-tour="step-5" className={cn(
           "p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left font-mono text-zinc-300 space-y-2 overflow-y-auto select-text scrollbar-thin shadow-2xl relative animate-in fade-in duration-300 transition-all",
           isLogExpanded ? "max-h-[500px] min-h-[300px] h-[400px] md:h-[500px] md:col-span-2 border-orange-500/50 bg-zinc-950 shadow-orange-500/5" : "max-h-44 min-h-[90px]",
           logFontSize === "small" ? "text-[10px]" : logFontSize === "medium" ? "text-[12px] sm:text-xs" : "text-[14px] sm:text-sm font-semibold"
         )}>
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm pb-1.5 flex flex-wrap justify-between items-center text-zinc-500 border-b border-zinc-800 text-[9px] font-bold uppercase tracking-wider z-20 gap-2 mb-2">
               <span className="flex items-center gap-1.2"><Terminal className="w-3 h-3 text-orange-500" /> CoStudy Terminal Logs</span>
               <div className="flex items-center gap-2 font-sans text-[10px]">
                  <button 
                    type="button"
                    onClick={() => {
                      const logList = progressLogs.length > 0 ? progressLogs : [
                        "⏳ [SYSTEM] CoStudy Ingestion Engine stands by...",
                        "🟢 [CLUSTER] Interleaved hot provider pools online (Round-Robin ready)",
                        "⚙️ [THREAD] Workers: 2 concurrent threads initialized",
                        "💡 [TUTORIAL] Quăng tài liệu bất kỳ vào Dropzone bên trên để trải nghiệm tự động bóc tách từ vựng đỉnh cao!"
                      ];
                      const rawText = logList.join("\n");
                      const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `costudy_convert_log_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-0.5 rounded bg-orange-500 hover:bg-orange-600 text-zinc-950 font-black active:scale-95 transition cursor-pointer flex items-center gap-1"
                  >
                     📥 Xuất Log (.txt)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setLogFontSize(p => p === "small" ? "medium" : p === "medium" ? "large" : "small")}
                    className="px-2 py-0.5 rounded bg-zinc-805 text-zinc-300 hover:bg-zinc-700 active:scale-95 transition cursor-pointer font-bold"
                  >
                     🅰️ Cỡ chữ: <span className="text-orange-400 capitalize">{logFontSize === "small" ? "nhỏ" : logFontSize === "medium" ? "vừa" : "lớn"}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsLogExpanded(!isLogExpanded)}
                    className="px-2 py-0.5 rounded bg-zinc-805 text-zinc-300 hover:bg-zinc-700 active:scale-95 transition cursor-pointer font-bold flex items-center gap-1"
                  >
                     {isLogExpanded ? "🗗 Thu nhỏ" : "🗖 Phóng to Log"}
                  </button>
                  <span className="text-zinc-600 hidden sm:inline">Buffered</span>
               </div>
            </div>
            <div className="flex flex-col gap-1 pr-1 overscroll-contain">
              {(progressLogs.length > 0 ? progressLogs : [
                "⏳ [SYSTEM] CoStudy Ingestion Engine stands by...",
                "🟢 [CLUSTER] Interleaved hot provider pools online (Round-Robin ready)",
                "⚙️ [THREAD] Workers: 2 concurrent threads initialized",
                "💡 [TUTORIAL] Quăng tài liệu bất kỳ vào Dropzone bên trên để trải nghiệm tự động bóc tách từ vựng đỉnh cao!"
              ]).slice(isLogExpanded ? -100 : -25).map((log, idx) => {
                let colorClass = "text-zinc-300";
                if (log.includes("✅") || log.includes("✨") || log.includes("🎉")) colorClass = "text-emerald-450 dark:text-emerald-400 font-bold";
                else if (log.includes("❌") || log.includes("🚨")) colorClass = "text-rose-450 dark:text-rose-400 font-black";
                else if (log.includes("⏳") || log.includes("⏳")) colorClass = "text-orange-400 font-medium";
                else if (log.includes("❄️")) colorClass = "text-indigo-400 font-semibold";
                return (
                  <div key={idx} className={cn("leading-relaxed", colorClass)}>
                    {log}
                  </div>
                );
              })}
            </div>
         </div>
      )}

      {/* Interactive Review Extracted Deck Box */}
      {(() => {
        if (!extractedCards || extractedCards.length === 0) return null;
        const cardsPerPage = 20; // 20 cards per view is extremely snappy and lightweight
        const totalPages = Math.ceil(extractedCards.length / cardsPerPage);
        const activePage = Math.min(reviewPage, totalPages);
        const startIndex = (activePage - 1) * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const currentCards = extractedCards.slice(startIndex, endIndex);

        return (
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
              <div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 font-display">Review {extractedCards.length} Thẻ Vừa Tạo</h3>
                <p className="text-xs opacity-65 font-medium text-zinc-500">Rà soát bản dịch và chỉnh sửa các trường cần thiết trước khi lưu.</p>
              </div>
              <button 
                onClick={handleSaveDeck}
                disabled={isProcessing || (isAddToExisting && !selectedExistingDeckId)}
                className="btn-3d px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-55 text-zinc-950 font-black rounded-xl cursor-pointer hover:shadow transition text-xs shrink-0"
              >
                🔑 Lưu Học Phần Vào Thư Viện
              </button>
            </div>

            {/* Pagination Controls bar */}
            {totalPages > 1 && (
              <div className="flex flex-col xs:flex-row items-center justify-between gap-2 bg-zinc-100/40 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-805/60 rounded-xl px-4 py-2.5 mb-4 text-xs select-none">
                <span className="text-[11px] font-bold text-zinc-500">
                   Hiển thị <span className="text-zinc-800 dark:text-zinc-200 font-black">{startIndex + 1} - {Math.min(endIndex, extractedCards.length)}</span> từ tổng số <span className="text-orange-600 dark:text-orange-450 font-black">{extractedCards.length}</span> thẻ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewPage(prev => Math.max(1, prev - 1))}
                    disabled={activePage === 1}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200/60 dark:border-zinc-800/80 font-bold disabled:opacity-35 cursor-pointer"
                  >
                    ◀ Trước
                  </button>
                  <select
                    value={activePage}
                    onChange={(e) => setReviewPage(Number(e.target.value))}
                    className="px-3 py-1 rounded-lg border border-zinc-300 bg-white dark:bg-zinc-950 dark:border-zinc-850 font-black text-xs outline-none text-zinc-800 dark:text-zinc-200"
                  >
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Trang {idx + 1} / {totalPages}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setReviewPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={activePage === totalPages}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200/60 dark:border-zinc-800/80 font-bold disabled:opacity-35 cursor-pointer"
                  >
                    Sau ▶
                  </button>
                </div>
              </div>
            )}
            
            <div 
              className="space-y-4 w-full max-h-[500px] overflow-y-auto pr-1 select-text scrollbar-thin"
              style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
            >
              {currentCards.map((c, i) => (
                <FlashcardItem 
                  key={c.id} 
                  index={startIndex + i} 
                  card={c} 
                  onRemove={handleRemoveCard} 
                  onChange={handleCardChange} 
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bypass Modal Dialog */}
      <AnimatePresence>
        {showBypassModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Blurred dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/80 dark:bg-black/90 backdrop-blur-md cursor-pointer"
              onClick={() => setShowBypassModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl z-10 space-y-6 max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowBypassModal(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <span className="text-2xl">🍳</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-display uppercase tracking-tight">CHUYỂN JSON BẰNG CƠM (DỰ PHÒNG)</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Nếu luồng tự động của vệ tinh AI bị nghẽn mạch hoặc vượt quá giới hạn tài nguyên, ngài có thể bóc tách thủ công siêu tốc và cực kỳ chuẩn xác bằng hai phương án dưới đây.
                </p>
              </div>

              <div className="space-y-4">
                {/* Option A Box */}
                <div 
                  onClick={handleGoToAIStudio}
                  className="group cursor-pointer p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-orange-500/50 hover:bg-orange-500/5 dark:hover:bg-orange-500/5 transition-all text-left flex gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-orange-600 dark:group-hover:text-orange-450">
                        Sử dụng Google AI Studio (Yêu cầu &gt;18 tuổi)
                      </h4>
                      <span className="text-[9px] shrink-0 text-orange-600 dark:text-orange-450 font-black bg-orange-500/10 px-1.5 py-0.5 rounded leading-none">Cực nhạy</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Làm việc trực tiếp trên Playground của Google AI. Giao diện trực quan, không lo bị nghẽn hay trễ kết nối mạng.
                    </p>
                  </div>
                </div>

                {/* Option B Box */}
                <div 
                  onClick={handleCopyPromptAndGoToGemini}
                  className="group cursor-pointer p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5 transition-all text-left flex gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Copy className="w-5 h-5 group-hover:animate-bounce" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        Sao chép Prompt &amp; Chuyển sang Gemini Web
                      </h4>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Hệ thống tự động sao chép prompt tối ưu dán sẵn vào khay bộ nhớ đệm (Clipboard) rồi định tuyến ngài sang Gemini Web để nhận phản hồi JSON có ngay lập tức.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowBypassModal(false)}
                className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 transition cursor-pointer border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-98"
              >
                Đóng cửa đóng cứu nguy
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast Notification */}
      <AnimatePresence>
        {toastSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[1050] bg-emerald-650 text-white font-extrabold text-[11px] px-4.5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <Check className="w-4 h-4 shrink-0 animate-bounce" />
            <span>{toastSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const FlashcardItem = React.memo(({ index, card, onRemove, onChange }: { 
  index: number; 
  card: { id: string, front: string, wordForm?: string, back: string }; 
  onRemove: (id: string) => void;
  onChange: (id: string, field: 'front' | 'back', value: string) => void;
}) => {
  let badgeColor = "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const wf = (card.wordForm || "").toLowerCase();
  
  if (wf.includes("noun") || wf === "n") badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-450";
  else if (wf.includes("verb") || wf === "v") badgeColor = "bg-red-105 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  else if (wf.includes("adj")) badgeColor = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  else if (wf.includes("adv")) badgeColor = "bg-emerald-100 text-emerald-750 dark:bg-emerald-900/30 dark:text-emerald-400";
  else if (wf.includes("idiom") || wf.includes("colloc")) badgeColor = "bg-purple-105 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";

  return (
    <div className="card-3d p-4.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900 flex gap-4 relative transform-gpu w-full min-w-0 transition-colors">
      <div className="flex-shrink-0 text-zinc-400 font-bold w-6 text-sm">{index + 1}</div>
      <div className="flex-grow min-w-0 grid md:grid-cols-2 gap-4">
        <div className="relative">
            {card.wordForm && (
              <span className={`absolute -top-3.5 left-3 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm z-10 ${badgeColor}`}>
                {card.wordForm}
              </span>
            )}
            <textarea
              value={card.front}
              onChange={(e) => onChange(card.id, 'front', e.target.value)}
              className="input-3d p-3 pt-5 min-h-[72px] w-full text-xs font-semibold"
              placeholder="Mặt trước..."
            />
        </div>
        <textarea
            value={card.back}
            onChange={(e) => onChange(card.id, 'back', e.target.value)}
            className="input-3d p-3 min-h-[72px] w-full text-xs font-medium"
            placeholder="Mặt sau..."
        />
      </div>
      <button 
        onClick={() => onRemove(card.id)}
        className="flex-shrink-0 self-center p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition cursor-pointer"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
});
