import React, { useState, useRef , useEffect , useMemo } from "react";
import {
  Copy,
  ExternalLink,
  Database,
  Check,
  Sparkles,
  X,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Layers,
  Terminal,
  AlertTriangle,
  AlertCircle,
  FileUp,
  FileText,
  Loader2,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils.js";
import { CustomDeckSelect } from "./CustomDeckSelect";
import { db, auth } from "../lib/firebase.js";
import {
  collection,
  writeBatch,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import ErrorNotification from "./ErrorNotification.js";
import { store, Deck } from "../lib/store";
import { useTheme } from "./ThemeProvider.js";

export default function ManualFlashcardImporter() {
  const { isFixLagEnabled } = useTheme();
  const [activeTab, setActiveTab] = useState<"automated" | "manual">(
    "automated",
  );
  const [showToolModal, setShowToolModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNormalize, setShowNormalize] = useState(false);
  const [copiedNormalize, setCopiedNormalize] = useState(false);

  // Traditional Manual States
  const [jsonInput, setJsonInput] = useState("");
  const [previewCards, setPreviewCards] = useState<
    { id: string; front: string; wordForm?: string; back: string }[] | null
  >(null);

  // Added states for manual row-by-row card creator
  const [manualMode, setManualMode] = useState<"form" | "json">("form");
  const [manualRows, setManualRows] = useState<
    { front: string; back: string }[]
  >([
    { front: "", back: "" },
    { front: "", back: "" },
    { front: "", back: "" },
  ]);

  // Real-time Automated review state
  const [autoCreatedCards, setAutoCreatedCards] = useState<any[]>([]);

  // File Upload state for Manual JSON tab
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [jsonFileName, setJsonFileName] = useState("");
  const [isAiParsingJson, setIsAiParsingJson] = useState(false);

  // General Deck Details
  const [deckTitle, setDeckTitle] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [isAddToExisting, setIsAddToExisting] = useState(false);
  const [selectedExistingDeckId, setSelectedExistingDeckId] = useState("");

  // Automated Pipeline States
  const [rawTextLines, setRawTextLines] = useState("");
  const [isAutomating, setIsAutomating] = useState(false);
  const [autoProgress, setAutoProgress] = useState<{
    totalChunks: number;
    currentChunk: number;
    processedCards: number;
    totalLines: number;
    logs: string[];
  } | null>(null);

  const [concurrency, setConcurrency] = useState<number>(1);
  const [chunkSize, setChunkSize] = useState<number>(20);
  const [startChunkInput, setStartChunkInput] = useState<number>(1);

  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);

  const fetchTelemetryLogs = async () => {
    try {
      const res = await fetch("/api/automation/generation-logs");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setTelemetryLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Lỗi kéo dữ liệu telemetry:", err);
    }
  };

  useEffect(() => {
    if (isAutomating) {
      fetchTelemetryLogs();
      const interval = setInterval(fetchTelemetryLogs, 4000);
      return () => clearInterval(interval);
    } else {
      fetchTelemetryLogs();
    }
  }, [isAutomating]);

  // Advanced Optimization States
  const [savedPipeline, setSavedPipeline] = useState<{
    rawLines: string[];
    currentChunk: number;
    processedCardsCount: number;
    allGeneratedCards: any[];
    deckTitle: string;
    deckSubject: string;
    deckId: string;
    logs: string[];
    failedChunks?: { chunkIndex: number; content: string; error: string }[];
  } | null>(null);

  const [pipelineErrors, setPipelineErrors] = useState<
    {
      chunkIndex: number;
      content: string;
      error: string;
    }[]
  >([]);

  const [editingErrorIndex, setEditingErrorIndex] = useState<number | null>(
    null,
  );
  const [editingErrorText, setEditingErrorText] = useState<string>("");
  const [processingErrorIndex, setProcessingErrorIndex] = useState<
    number | null
  >(null);
  const [retryAllLoading, setRetryAllLoading] = useState<boolean>(false);

  // High-performance optimization refs for throttling main-thread updates
  const allLogsRef = useRef<string[]>([]);
  const logRafRef = useRef<number | null>(null);
  const isCanceledRef = useRef<boolean>(false);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  // Step cancellation & skip handlers for large vocabulary processing
  const [activeProcessingChunkIndex, setActiveProcessingChunkIndex] = useState<
    number | null
  >(null);
  const currentActiveChunkControllersRef = useRef<Map<number, AbortController>>(
    new Map(),
  );

  const handleSkipActiveChunk = (chunkIndex: number) => {
    const controller = currentActiveChunkControllersRef.current.get(chunkIndex);
    if (controller) {
      allLogsRef.current.push(
        `⚠️ [Người dùng] Click bỏ qua phân đoạn #${chunkIndex + 1} đang kết xuất...`,
      );
      controller.abort();
    }
  };

  const handleCancelAutomatedPipeline = () => {
    isCanceledRef.current = true;
    for (const controller of activeControllersRef.current) {
      if (controller) {
        controller.abort();
      }
    }
    activeControllersRef.current.clear();
    currentActiveChunkControllersRef.current.clear();
    setActiveProcessingChunkIndex(null);
    setIsAutomating(false);
    setAutoProgress(null);

    allLogsRef.current.push(
      `🛑 Tiến trình tự động hóa đã bị hủy bỏ khẩn cấp bởi người dùng thành công! Mở khóa các tùy chọn.`,
    );
    setAutoProgress((prev) =>
      prev
        ? {
            ...prev,
            logs: allLogsRef.current.slice(-40),
          }
        : null,
    );
  };

  useEffect(() => {
    return () => {
      if (logRafRef.current) {
        cancelAnimationFrame(logRafRef.current);
      }
      for (const controller of activeControllersRef.current) {
        if (controller) {
          controller.abort();
        }
      }
      activeControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("henosis-importer-pipeline");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedPipeline(parsed);
        if (parsed.failedChunks) {
          setPipelineErrors(parsed.failedChunks);
        }
        if (
          parsed.allGeneratedCards &&
          Array.isArray(parsed.allGeneratedCards)
        ) {
          setAutoCreatedCards(parsed.allGeneratedCards);
        }
      } catch (err) {
        console.error("Failed to parse saved pipeline state:", err);
      }
    }
  }, []);

  const saveSavedState = (state: any) => {
    localStorage.setItem("henosis-importer-pipeline", JSON.stringify(state));
  };

  const clearSavedState = () => {
    localStorage.removeItem("henosis-importer-pipeline");
    setSavedPipeline(null);
  };

  const handleDiscardSavedPipeline = () => {
    clearSavedState();
    setPipelineErrors([]);
    setAutoCreatedCards([]);
  };

  const handleRetrySingleFailedChunk = async (
    errIdx: number,
    originalIndex: number,
    currentText: string,
  ) => {
    if (processingErrorIndex !== null) return;
    setProcessingErrorIndex(originalIndex);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toast-dispatch', { detail: "Bạn cần đăng nhập lại để thao tác băm phục hồi lỗi!" }));
      setProcessingErrorIndex(null);
      return;
    }

    try {
      const lines = currentText.split("\n").filter((l) => l.trim().length > 0);
      const exactCount = lines.length;

      const res = await fetch("/api/automation/process-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textChunk: currentText,
          exactCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || data.rawText === undefined) {
        throw new Error(
          data.message ||
            "Tạo thất bại. Vui lòng kiểm tra lại Keys hoặc nội dung.",
        );
      }

      const rawLinesStr = data.rawText as string;
      const resLines = rawLinesStr
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const cardsInChunk = [];
      for (const line of resLines) {
        const parts = line.split("|||").map((p) => p.trim());
        if (parts.length >= 4) {
          cardsInChunk.push({
            front: parts[0] || "",
            ipa: parts[1] || "",
            wordForm: parts[2] || "",
            back: parts[3] || "",
            example: parts[4] || "",
            origin: parts[5] || "",
          });
        }
      }

      if (cardsInChunk.length < exactCount) {
        throw new Error(
          `Data Loss: Yêu cầu ${exactCount} thẻ nhưng chỉ nhận được ${cardsInChunk.length} thẻ hợp lệ.`,
        );
      }

      const batch = writeBatch(db);

      let currentBatchDeckId = savedPipeline?.deckId;
      if (!currentBatchDeckId) {
        const { v4: uuidv4 } = await import("uuid");
        currentBatchDeckId = `deck_${uuidv4()}`;
      }

      const targetDeckForBatch =
        isAddToExisting && selectedExistingDeckId
          ? store.getDeck(selectedExistingDeckId)
          : null;
      if (targetDeckForBatch) {
        currentBatchDeckId = targetDeckForBatch.id;
      }

      const currentBatchSubject = targetDeckForBatch
        ? targetDeckForBatch.subject || "Tự chọn"
        : deckSubject || "Tự chọn";

      const { v4: uuidv4 } = await import("uuid");
      const mappedBatch = cardsInChunk.map((card: any) => {
        const cardId = `card_${uuidv4()}`;
        return {
          id: cardId,
          front: (card.front || "").trim(),
          back: `${card.wordForm ? `(${card.wordForm}) ` : ""}${card.ipa ? `[${card.ipa}] ` : ""}${card.back || ""}${card.example ? `\nVí dụ: ${card.example}` : ""}`,
          wordForm: card.wordForm || "",
          ipa: card.ipa || "",
          example: card.example || "",
          subject: currentBatchSubject,
          mastery: 0,
          nextReview: Date.now(),
          isHard: false,
          origin: card.origin || "",
          createdAt: Date.now(),
          userId: currentUser.uid,
          deckId: currentBatchDeckId,
        };
      });

      mappedBatch.forEach((cardObj) => {
        const cardDocRef = doc(db, "flashcards", cardObj.id);
        batch.set(cardDocRef, cardObj);
      });

      await batch.commit();

      const updatedPipelineCards = [...autoCreatedCards, ...mappedBatch];
      setAutoCreatedCards(updatedPipelineCards);

      const newCardsMappedStore = mappedBatch.map((c) => ({
        id: c.id,
        front: c.front,
        wordForm: c.wordForm || "",
        back: c.back,
        subject: currentBatchSubject,
        mastery: 0,
        nextReview: Date.now(),
        isHard: false,
        interval: 1,
        easeFactor: 2.5,
        repetitionCount: 0,
        isNewCard: true,
      }));

      const deckInStore = store.getDeck(currentBatchDeckId);
      if (deckInStore) {
        const updatedDeck = {
          ...deckInStore,
          cards: [...(deckInStore.cards || []), ...newCardsMappedStore],
        };
        await store.addDeck(updatedDeck);
      } else {
        const newDeckObj = {
          id: currentBatchDeckId,
          title:
            deckTitle.trim() ||
            savedPipeline?.deckTitle ||
            "Bộ thẻ Tự động hóa",
          subject: currentBatchSubject,
          cards: newCardsMappedStore,
        };
        await store.addDeck(newDeckObj);
      }

      const nextErrors = pipelineErrors.filter((_, idx) => idx !== errIdx);
      setPipelineErrors(nextErrors);

      if (savedPipeline) {
        const nextPipeline = {
          ...savedPipeline,
          allGeneratedCards: updatedPipelineCards,
          failedChunks: nextErrors,
        };
        saveSavedState(nextPipeline);
        setSavedPipeline(nextPipeline);
      }

      setEditingErrorIndex(null);

      allLogsRef.current.push(
        `💖 Phục hồi lỗi phân đoạn #${originalIndex} thành công! Nạp thành công ${mappedBatch.length} thẻ.`,
      );
      setAutoProgress((prev) =>
        prev
          ? {
              ...prev,
              processedCards: updatedPipelineCards.length,
              logs: allLogsRef.current.slice(-40),
            }
          : null,
      );
    } catch (err: any) {
      console.error(err);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toast-dispatch', { detail: `Lỗi phục hồi phân đoạn: ${err.message || err}` }));
    } finally {
      setProcessingErrorIndex(null);
    }
  };

  const handleRetryAllFailedChunks = async () => {
    if (pipelineErrors.length === 0 || retryAllLoading) return;
    setRetryAllLoading(true);
    let successCountLocal = 0;
    const errorsToRetry = [...pipelineErrors];
    const remainingErrors: typeof pipelineErrors = [];

    allLogsRef.current.push(
      `⚡ Khởi chạy tiến trình băm lại hàng loạt ${errorsToRetry.length} phân đoạn lỗi đang cách ly...`,
    );

    for (let i = 0; i < errorsToRetry.length; i++) {
      const errItem = errorsToRetry[i];
      try {
        const lines = errItem.content
          .split("\n")
          .filter((l) => l.trim().length > 0);
        const exactCount = lines.length;

        const res = await fetch("/api/automation/process-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textChunk: errItem.content,
            exactCount,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || data.rawText === undefined) {
          throw new Error(data.message || "Lỗi phản hồi API");
        }

        const rawLinesStr = data.rawText as string;
        const resLines = rawLinesStr
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        const cardsInChunk = [];
        for (const line of resLines) {
          const parts = line.split("|||").map((p) => p.trim());
          if (parts.length >= 4) {
            cardsInChunk.push({
              front: parts[0] || "",
              ipa: parts[1] || "",
              wordForm: parts[2] || "",
              back: parts[3] || "",
              example: parts[4] || "",
              origin: parts[5] || "",
            });
          }
        }

        if (cardsInChunk.length < exactCount) {
          throw new Error(
            `Data Loss: Yêu cầu ${exactCount} thẻ nhưng chỉ nhận được ${cardsInChunk.length}`,
          );
        }

        const batch = writeBatch(db);

        let currentBatchDeckId = savedPipeline?.deckId;
        if (!currentBatchDeckId) {
          const { v4: uuidv4 } = await import("uuid");
          currentBatchDeckId = `deck_${uuidv4()}`;
        }

        const targetDeckForBatch =
          isAddToExisting && selectedExistingDeckId
            ? store.getDeck(selectedExistingDeckId)
            : null;
        if (targetDeckForBatch) {
          currentBatchDeckId = targetDeckForBatch.id;
        }

        const currentBatchSubject = targetDeckForBatch
          ? targetDeckForBatch.subject || "Tự chọn"
          : deckSubject || "Tự chọn";

        const { v4: uuidv4 } = await import("uuid");
        const mappedBatch = cardsInChunk.map((card: any) => {
          const cardId = `card_${uuidv4()}`;
          return {
            id: cardId,
            front: (card.front || "").trim(),
            back: `${card.wordForm ? `(${card.wordForm}) ` : ""}${card.ipa ? `[${card.ipa}] ` : ""}${card.back || ""}${card.example ? `\nVí dụ: ${card.example}` : ""}`,
            wordForm: card.wordForm || "",
            ipa: card.ipa || "",
            example: card.example || "",
            subject: currentBatchSubject,
            mastery: 0,
            nextReview: Date.now(),
            isHard: false,
            origin: card.origin || "",
            createdAt: Date.now(),
            userId: auth.currentUser?.uid,
            deckId: currentBatchDeckId,
          };
        });

        mappedBatch.forEach((cardObj) => {
          const cardDocRef = doc(db, "flashcards", cardObj.id);
          batch.set(cardDocRef, cardObj);
        });

        await batch.commit();

        const updatedPipelineCards = [...autoCreatedCards, ...mappedBatch];
        setAutoCreatedCards(updatedPipelineCards);

        const newCardsMappedStore = mappedBatch.map((c) => ({
          id: c.id,
          front: c.front,
          wordForm: c.wordForm || "",
          back: c.back,
          subject: currentBatchSubject,
          mastery: 0,
          nextReview: Date.now(),
          isHard: false,
          interval: 1,
          easeFactor: 2.5,
          repetitionCount: 0,
          isNewCard: true,
        }));

        const deckInStore = store.getDeck(currentBatchDeckId);
        if (deckInStore) {
          const updatedDeck = {
            ...deckInStore,
            cards: [...(deckInStore.cards || []), ...newCardsMappedStore],
          };
          await store.addDeck(updatedDeck);
        } else {
          const newDeckObj = {
            id: currentBatchDeckId,
            title:
              deckTitle.trim() ||
              savedPipeline?.deckTitle ||
              "Bộ thẻ Tự động hóa",
            subject: currentBatchSubject,
            cards: newCardsMappedStore,
          };
          await store.addDeck(newDeckObj);
        }

        successCountLocal++;
        allLogsRef.current.push(
          `💚 [Hồi phục hàng loạt] Tạo thành công phân đoạn lỗi #${errItem.chunkIndex}.`,
        );
      } catch (err: any) {
        console.error(err);
        remainingErrors.push(errItem);
        allLogsRef.current.push(
          `⚠️ [Hồi phục hàng loạt] Phân đoạn lỗi #${errItem.chunkIndex} bọc lỗi tiếp: ${err.message || err}`,
        );
      }
    }

    setPipelineErrors(remainingErrors);
    if (savedPipeline) {
      const nextPipeline = {
        ...savedPipeline,
        allGeneratedCards: autoCreatedCards,
        failedChunks: remainingErrors,
      };
      saveSavedState(nextPipeline);
      setSavedPipeline(nextPipeline);
    }

    setRetryAllLoading(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast-dispatch', { detail: `Hoàn thành băm lại hàng loạt phân đoạn lỗi! Phục hồi thành công: ${successCountLocal}/${errorsToRetry.length} phân đoạn.` }));
    }
  };

  const handleCleanAndDeduplicate = async (inputText: string) => {
    const lines = inputText.split("\n");
    const stats = {
      initial: lines.length,
      blankRemoved: 0,
      duplicateRemoved: 0,
      existingFiltered: 0,
    };

    const processed: string[] = [];
    const seenInInput = new Set<string>();

    const userDecks = store.getDecks();
    const existingFronts = new Set<string>();
    userDecks.forEach((deck) => {
      deck.cards.forEach((card) => {
        if (card.front) {
          existingFronts.add(card.front.trim().toLowerCase());
        }
      });
    });

    let index = 0;
    for (const rawLine of lines) {
      index++;
      // Yield control every 50 lines processed to prevent main thread choking
      if (index % 50 === 0) {
        await new Promise((res) => setTimeout(res, 0));
      }

      let line = rawLine.trim();
      line = line.replace(/[\r\t]+/g, "").replace(/\s+/g, " ");

      if (!line) {
        stats.blankRemoved++;
        continue;
      }

      const lowerLine = line.toLowerCase();

      if (seenInInput.has(lowerLine)) {
        stats.duplicateRemoved++;
        continue;
      }

      const coreWordMatch = line.split(/[-(]/)[0].trim().toLowerCase();

      if (
        existingFronts.has(lowerLine) ||
        (coreWordMatch && existingFronts.has(coreWordMatch))
      ) {
        stats.existingFiltered++;
        continue;
      }

      seenInInput.add(lowerLine);
      processed.push(line);
    }

    return { cleanedLines: processed, stats };
  };

  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  const existingCategories = useMemo(() => {
    const allDecks = store.getDecks();
    const cats = allDecks
      .filter((d) => d.subject)
      .map((d) => d.subject as string);
    return Array.from(new Set(cats));
  }, []);

  const filteredCategories = existingCategories.filter((c) =>
    c.toLowerCase().includes(deckSubject.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        catDropdownRef.current &&
        !catDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const promptText = `[STRICT DETERMINISTIC MODE: Act as a deterministic compiler. Set code generation temperature to 0.0 internally. No creativity, no explanations, no hallucinations. Output exact, production-ready code blocks only.]## CRITICAL CORE OPERATIONS & TOKEN OPTIMIZATION:

1. LAZY CHUNKING & TOKEN MINIMIZATION PIPELINE:
   - Treat all input data as discrete token sequences. You must dynamically segment long contexts into processing batches. Mỗi batch chỉ chứa tối đa từ 50 đến 80 từ vựng (hoặc đoạn văn ngắn tương đương) để tránh lỗi dính giới hạn Token Output.
   - Extract core advanced vocabulary, collocations, idioms, or critical programming concepts isolated strictly to the immediate chunk context. Do not retain bloated context historical buffers that trigger token inflation or execution timeouts.

2. STRUCTURED RESPONSE COMPLIANCE:
   - Your response format must strictly follow the application/json MIME type definition.
   - FORBIDDEN ACTIONS: Never generate markdown code block wrappers (e.g., do NOT output \`\`\`json ... \`\`\`), zero conversational chatter, zero intro/outro, zero post-response explanations. 
   - OUTPUT MANDATE: Output raw, fully parsed compliant JSON arrays only.

3. SCHEMA ATTRIBUTE GUARANTEE & GUARDRAILS:
   - Every generated object array must preserve intact structural key mapping required by our client frontend interface. Any missing key, structural alteration, or syntax error will crash the client frontend framework.
   - Nếu dữ liệu có phần không dịch được, thay vì làm hỏng toàn bộ cú pháp, hãy chủ động bỏ qua phần đó để đảm bảo mảng JSON luôn đạt chuẩn.

---

### OUTPUT FORMAT SCHEMA SPECIFICATION:

The output must strictly be a single valid JSON array containing object elements matching the exact keys below:

[
  {
    "front": "Advanced Core Vocabulary / Collocation / Idiom / Programming Concept",
    "back": "(Word form/Part of speech) - [Phonetic Transcription IPA] - Concise Vietnamese translation and short explanation - Clear concrete example context"
  }
]

---
Trong mỗi reply phải dùng 2 lần comment "//" ở cuối cùng chuỗi JSON xuất ra để thông báo rằng trong file đó còn đoạn nào chưa xử lý hay không hay là đã convert to json hết rồi.


### EXECUTION COMMAND:
Acknowledge this protocol. Execute all text transformations deterministically at 100% precision. Analyze the uploaded files or inputs and start processing the data matrix now.`;

  const handleCopyPrompt = () => {
    navigator.clipboard
      .writeText(promptText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error("Copy failed", err));
  };

  const normalizePromptText = `Dưới đây là một chuỗi JSON có thể bị lỗi cú pháp do quá trình copy hoặc xuất bị cắt ngang. Hãy chuẩn hóa lại nó thành một mảng JSON Array hợp lệ. Đầu ra chỉ chứa đúng một mảng JSON sạch, KHÔNG có markdown, KHÔNG giải thích. Bắt buộc kết quả phải parse được bằng JSON.parse().`;

  const handleCopyNormalizePrompt = () => {
    navigator.clipboard
      .writeText(normalizePromptText)
      .then(() => {
        setCopiedNormalize(true);
        setTimeout(() => setCopiedNormalize(false), 2000);
      })
      .catch((err) => console.error("Copy failed", err));
  };

  // Traditional Manual Parser
  const handleParseJson = () => {
    if (!jsonInput.trim()) return;
    setError(null);
    setSuccessCount(null);
    try {
      const cleanJson = jsonInput.replace(/```(?:json)?/g, "").trim();
      let parsedData = JSON.parse(cleanJson);

      // Nếu dữ liệu dạng object mà không phải mảng, trích xuất thông tin
      if (
        parsedData &&
        typeof parsedData === "object" &&
        !Array.isArray(parsedData)
      ) {
        if (parsedData.title) {
          setDeckTitle(parsedData.title);
        }
        if (parsedData.subject) {
          setDeckSubject(parsedData.subject);
        }
        if (Array.isArray(parsedData.cards)) {
          parsedData = parsedData.cards;
        } else {
          throw new Error(
            "Không tìm thấy danh sách thẻ học (mảng 'cards') trong cấu trúc dữ liệu!",
          );
        }
      }

      if (!Array.isArray(parsedData)) {
        throw new Error("Dữ liệu không phải là một mảng JSON Array!");
      }

      const mapped = parsedData.map((item: any, idx: number) => ({
        id: `temp_${Date.now()}_${idx}`,
        front: item.front || "",
        back: item.back || "",
      }));

      setPreviewCards(mapped);
    } catch (err: any) {
      console.error(err);
      setError(
        `Lỗi Parse JSON: ${err.message || "Định dạng JSON không hợp lệ"}. Vui lòng kiểm tra lại cú pháp.`,
      );
    }
  };

  const handleUpdatePreviewCard = (
    id: string,
    field: "front" | "back",
    value: string,
  ) => {
    if (!previewCards) return;
    setPreviewCards(
      previewCards.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const handleDeletePreviewCard = (id: string) => {
    if (!previewCards) return;
    setPreviewCards(previewCards.filter((c) => c.id !== id));
  };

  const handleUpdateAutoCard = async (
    id: string,
    field: "front" | "back",
    value: string,
  ) => {
    const updated = autoCreatedCards.map((c) =>
      c.id === id ? { ...c, [field]: value } : c,
    );
    setAutoCreatedCards(updated);

    // Save to cache/localStorage
    if (savedPipeline) {
      const stateToSave = {
        ...savedPipeline,
        allGeneratedCards: updated,
      };
      saveSavedState(stateToSave);
      setSavedPipeline(stateToSave);
    }

    try {
      const cardRef = doc(db, "flashcards", id);
      await updateDoc(cardRef, { [field]: value });
    } catch (e) {
      console.warn("Đồng bộ Firestore thất bại:", e);
    }
  };

  const handleDeleteAutoCard = async (id: string) => {
    const updated = autoCreatedCards.filter((c) => c.id !== id);
    setAutoCreatedCards(updated);

    // Save to cache/localStorage
    if (savedPipeline) {
      const stateToSave = {
        ...savedPipeline,
        allGeneratedCards: updated,
      };
      saveSavedState(stateToSave);
      setSavedPipeline(stateToSave);
    }

    try {
      const cardRef = doc(db, "flashcards", id);
      await deleteDoc(cardRef);
    } catch (e) {
      console.warn("Xóa khỏi Firestore thất bại:", e);
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.size > 2 * 1024 * 1024) {
        setError(
          "Kích thước tệp tin JSON/TXT quá lớn (Vui lòng chọn tệp < 2MB).",
        );
        return;
      }
      setJsonFileName(selected.name);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const text = event.target.result as string;
          setJsonInput(text);
          // Tự động kích hoạt kiểm tra AI
          handleParseJsonWithAi(text);
        }
      };
      reader.onerror = () => {
        setError("Lỗi đọc tệp tin.");
      };
      reader.readAsText(selected);
    }
  };

  const handleJsonDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (selected.size > 2 * 1024 * 1024) {
        setError("Kích thước tệp tin vượt quá 2MB.");
        return;
      }
      setJsonFileName(selected.name);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const text = event.target.result as string;
          setJsonInput(text);
          // Tự động kích hoạt kiểm tra AI
          handleParseJsonWithAi(text);
        }
      };
      reader.readAsText(selected);
    }
  };

  const handleParseJsonWithAi = async (
    textToParse?: string | React.MouseEvent,
  ) => {
    const text =
      textToParse && typeof textToParse === "string" ? textToParse : jsonInput;
    if (!text.trim()) return;
    setError(null);
    setSuccessCount(null);
    setIsAiParsingJson(true);

    try {
      const res = await fetch("/api/automation/validate-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonText: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      if (data.success && Array.isArray(data.cards)) {
        const mapped = data.cards.map((item: any, idx: number) => ({
          id: `temp_${Date.now()}_${idx}`,
          front: item.front || "",
          wordForm: item.wordForm || "",
          ipa: item.ipa || "",
          back: item.back || "",
        }));
        setPreviewCards(mapped);
      } else {
        throw new Error("Phản hồi không chứa danh sách thẻ hợp lệ từ AI.");
      }
    } catch (err: any) {
      console.error(err);
      setError(
        `Lỗi chuẩn hóa AI: ${err.message || "Không thể khởi động kênh chuẩn hóa."}. Vui lòng thử lại hoặc dùng "Parse JSON thủ công" bên dưới.`,
      );
    } finally {
      setIsAiParsingJson(false);
    }
  };

  const isProcessingRef = useRef(false);

  const getKeysStatus = async () => {
    try {
      const adminKey = localStorage.getItem("henosis_admin_key") || "";
      const res = await fetch("/api/admin/keys-status", {
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        return data.keys;
      }
    } catch (err) {
      console.error("Failed to query API keys status:", err);
    }
    return null;
  };

  const handleResumePipeline = () => {
    if (savedPipeline) {
      setDeckTitle(savedPipeline.deckTitle);
      setDeckSubject(savedPipeline.deckSubject);
      handleAutomatedPipeline(savedPipeline);
    }
  };

  // Automated Pipeline Execution with Lazy Chunking, Failure recovery and Batch writes
  const handleAutomatedPipeline = async (
    resumeState?: typeof savedPipeline,
  ) => {
    const isResuming = !!resumeState;
    isCanceledRef.current = false;
    setIsAutomating(true);
    setError(null);
    setSuccessCount(null);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Bạn chưa đăng nhập hoặc phiên học đã hết hạn!");
      setIsAutomating(false);
      return;
    }

    let finalRawLines: string[] = [];
    let title = "";
    let subject = "";
    let activeDeckId = "";
    let startChunk = 0;
    let accumulatedCards: any[] = [];
    let initialLogs: string[] = [];
    let failedChunksAccumulator: any[] = [];

    if (isResuming && resumeState) {
      finalRawLines = resumeState.rawLines;
      title = resumeState.deckTitle;
      subject = resumeState.deckSubject;
      activeDeckId = resumeState.deckId;
      startChunk = resumeState.currentChunk;
      accumulatedCards = resumeState.allGeneratedCards;
      setAutoCreatedCards(accumulatedCards);
      initialLogs = [
        ...resumeState.logs,
        `🚀 [Resume] Phục hồi tiến trình cũ thành công. Tiếp tục chạy từ phân đoạn ${startChunk + 1}.`,
      ];
      failedChunksAccumulator = resumeState.failedChunks || [];
      setPipelineErrors(failedChunksAccumulator);
    } else {
      title = deckTitle.trim();
      subject = deckSubject.trim() || "Tự chọn";

      if (!rawTextLines.trim()) {
        setError("Vui lòng nhập văn bản thô.");
        setIsAutomating(false);
        return;
      }

      // 1. Client-Side Deduplication & Pre-processing (Optimization Technique 1)
      const { cleanedLines, stats } =
        await handleCleanAndDeduplicate(rawTextLines);
      if (cleanedLines.length === 0) {
        setError(
          `Lọc hoàn tất: Tất cả ${stats.initial} dòng nhập vào đều trùng lặp hoặc chứa từ vựng đã có trong hệ thống.`,
        );
        setIsAutomating(false);
        return;
      }

      finalRawLines = cleanedLines;
      const { v4: uuidv4 } = await import("uuid");
      activeDeckId = `deck_${uuidv4()}`;
      startChunk = Math.max(0, startChunkInput - 1);
      accumulatedCards = [];
      setAutoCreatedCards([]);
      initialLogs = [
        `🤖 Khởi động kênh tự động hóa hiệu suất cao.`,
        `🧹 Lọc làm sạch dữ liệu thành công:`,
        `- Tổng số dòng nhận diện: ${stats.initial}`,
        `- Bỏ qua dòng trống / rác: ${stats.blankRemoved}`,
        `- Lược bỏ trùng lặp nội bộ: ${stats.duplicateRemoved}`,
        `- Sàng lọc thực thể đã tồn tại: ${stats.existingFiltered}`,
        `🚀 Bắt đầu xử lý ${finalRawLines.length} phân đoạn từ vựng sạch ưu tú.`,
      ];
      failedChunksAccumulator = [];
      setPipelineErrors([]);
    }

    allLogsRef.current = [...initialLogs];

    try {
      const { v4: uuidv4 } = await import("uuid");

      // CHUNKING & CONCURRENCY REFACTOR: Exact 20 cards per batch for 1000+ scale
      const lineCount = finalRawLines.length;
      // Using user-defined settings
      let localChunkSize = chunkSize;
      let localConcurrency = concurrency; // Strict serial conveyor queue to insulate keys from 429 & trigger instant responses

      const chunkArray: string[][] = [];
      for (let i = 0; i < finalRawLines.length; i += localChunkSize) {
        chunkArray.push(finalRawLines.slice(i, i + localChunkSize));
      }

      const totalChunks = chunkArray.length;
      setAutoProgress({
        totalChunks,
        currentChunk: startChunk,
        processedCards: accumulatedCards.length,
        totalLines: finalRawLines.length,
        logs: initialLogs.slice(-40),
      });

      const pushLog = (msg: string, immediate = false) => {
        allLogsRef.current.push(msg);
        if (immediate) {
          if (logRafRef.current) {
            cancelAnimationFrame(logRafRef.current);
            logRafRef.current = null;
          }
          setAutoProgress((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              logs: allLogsRef.current.slice(-40),
            };
          });
        } else {
          if (!logRafRef.current) {
            logRafRef.current = requestAnimationFrame(() => {
              setAutoProgress((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  logs: allLogsRef.current.slice(-40),
                };
              });
              logRafRef.current = null;
            });
          }
        }
      };

      pushLog(
        `🔮 [SEMAPHORE STARTING] Kích hoạt luồng trích xuất tuần tự (Chunk Size: ${chunkSize} dòng) bảo đảm an toàn, bứt tốc 1000 thẻ.`,
      );

      let completedCount = startChunk;

      for (let cIdx = startChunk; cIdx < totalChunks; cIdx++) {
        if (isCanceledRef.current) break;

        // 1. Rest delay with stagger logic
        if (cIdx > startChunk) {
          const restPeriod = 2000; // CHUNKS_DELAY = 2000ms to cooldown infrastructure properly
          let waitRemaining = restPeriod;
          while (waitRemaining > 0 && !isCanceledRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            waitRemaining -= 200;
          }
        }

        if (isCanceledRef.current) break;

        // 2. Key status check (Throttled rate)
        if (cIdx % 3 === 0) {
          try {
            const currentKeys = await getKeysStatus();
            if (currentKeys && !isCanceledRef.current) {
              const activeKeys = currentKeys.filter(
                (k: any) => k.status === "active",
              );
              const coolingKeys = currentKeys.filter(
                (k: any) => k.status === "rate_limited",
              );

              if (coolingKeys.length > 0) {
                pushLog(
                  `❄️ Hiện có ${coolingKeys.length} Keys đang giãn cách làm dịu...`,
                  true,
                );
              }

              if (activeKeys.length === 0) {
                pushLog(
                  `🚨 CẢNH BÁO: Tất cả Keys bận rộn! Chờ 15s để làm dịu...`,
                  true,
                );
                let coolRemain = 15;
                while (coolRemain > 0 && !isCanceledRef.current) {
                  await new Promise((r) => setTimeout(r, 1000));
                  coolRemain--;
                }
              }
            }
          } catch (err) {
            console.warn("Keys status check skipped:", err);
          }
        }

        if (isCanceledRef.current) break;

        const currentChunkLines = chunkArray[cIdx];
        const linesInChunk = currentChunkLines.length;
        // Exact count extraction for 100% completion yield
        const exactCount = linesInChunk;

        const textSegment = currentChunkLines.join("\n");
        pushLog(
          `⚡ [Phân đoạn ${cIdx + 1}/${totalChunks}] Đang băm từ vựng (${exactCount} thẻ)...`,
        );
        setAutoProgress((prev) =>
          prev ? { ...prev, currentChunk: completedCount } : null,
        );

        let success = false;
        let attempt = 0;
        const maxRetries = 3;
        let cardsInChunk: any[] = [];
        let lastErrorMessage = "";

        while (!success && attempt < maxRetries && !isCanceledRef.current) {
          attempt++;

          const controller = new AbortController();
          currentActiveChunkControllersRef.current.set(cIdx, controller);
          activeControllersRef.current.add(controller);
          setActiveProcessingChunkIndex(cIdx);

          try {
            const res = await fetch("/api/automation/process-chunk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                textChunk: textSegment,
                exactCount,
              }),
              signal: controller.signal,
            });

            activeControllersRef.current.delete(controller);
            currentActiveChunkControllersRef.current.delete(cIdx);
            setActiveProcessingChunkIndex(null);

            if (isCanceledRef.current) break;

            const data = await res.json();

            if (!res.ok) {
              throw new Error(data?.message || `HTTP Error ${res.status}`);
            }

            if (data.success && data.rawText !== undefined) {
              const rawLinesStr = data.rawText as string;
              const lines = rawLinesStr
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

              cardsInChunk = [];
              for (const line of lines) {
                // e.g. front ||| ipa ||| wordForm ||| back ||| example ||| origin
                const parts = line.split("|||").map((p) => p.trim());
                if (parts.length >= 4) {
                  // Minimum degraded fields: front, ipa, wordForm, back
                  cardsInChunk.push({
                    front: parts[0] || "",
                    ipa: parts[1] || "",
                    wordForm: parts[2] || "",
                    back: parts[3] || "",
                    example: parts[4] || "",
                    origin: parts[5] || "",
                  });
                }
              }

              if (cardsInChunk.length < exactCount) {
                // Retry incremental check if yield is dropped
                throw new Error(
                  `Data Loss: Yêu cầu ${exactCount} thẻ nhưng chỉ nhận được ${cardsInChunk.length}. Đang làm dịu và thử lại...`,
                );
              }

              success = true;
              const usedIndexStr = data.keyIndex
                ? ` qua Key #${data.keyIndex}`
                : "";
              pushLog(
                `✅ [Phân đoạn ${cIdx + 1}] Tạo thành công ${cardsInChunk.length}/${exactCount} thẻ${usedIndexStr}.`,
                true,
              );
            } else {
              throw new Error(
                data.message || "Phản hồi lỗi do thất thoát chuỗi văn bản.",
              );
            }
          } catch (err: any) {
            activeControllersRef.current.delete(controller);
            currentActiveChunkControllersRef.current.delete(cIdx);
            setActiveProcessingChunkIndex(null);

            if (err.name === "AbortError") {
              if (isCanceledRef.current) {
                pushLog(
                  `🛑 Cuộc gọi phân đoạn ${cIdx + 1} đã bị dừng khẩn cấp.`,
                  true,
                );
                break;
              } else {
                pushLog(
                  `🎯 Đã chủ động hủy và bỏ qua phân đoạn #${cIdx + 1}.`,
                  true,
                );
                lastErrorMessage = "Người dùng chủ động bỏ qua phân đoạn này.";
                break; // break the retry loop and skip to the next chunk!
              }
            }

            lastErrorMessage = err.message || err.toString();
            pushLog(
              `⚠️ [Phân đoạn ${cIdx + 1}] Thử lần [${attempt}/${maxRetries}] thất bại: ${lastErrorMessage}`,
              true,
            );

            if (attempt < maxRetries && !isCanceledRef.current) {
              const backoff = 4000 * Math.pow(2, attempt - 1);
              pushLog(
                `⏳ Hồi sức chờ ${backoff / 1000} giây trước khi tự truy vấn lại...`,
              );
              let waitRemaining = backoff;
              while (waitRemaining > 0 && !isCanceledRef.current) {
                await new Promise((r) => setTimeout(r, 200));
                waitRemaining -= 200;
              }
            }
          }
        }

        if (isCanceledRef.current) break;

        if (success) {
          try {
            const batch = writeBatch(db);
            const targetDeckForBatch =
              isAddToExisting && selectedExistingDeckId
                ? store.getDeck(selectedExistingDeckId)
                : null;
            const currentBatchDeckId = targetDeckForBatch
              ? targetDeckForBatch.id
              : activeDeckId;
            const currentBatchSubject = targetDeckForBatch
              ? targetDeckForBatch.subject || "Tự chọn"
              : subject || "Tự chọn";

            const { v4: uuidv4 } = await import("uuid");
            const mappedBatch = cardsInChunk.map((card) => {
              const cardId = `card_${uuidv4()}`;
              return {
                id: cardId,
                front: (card.front || "").trim(),
                back: `${card.wordForm ? `(${card.wordForm}) ` : ""}${card.ipa ? `[${card.ipa}] ` : ""}${card.back || ""}${card.example ? `\nVí dụ: ${card.example}` : ""}`,
                wordForm: card.wordForm || "",
                ipa: card.ipa || "",
                example: card.example || "",
                subject: currentBatchSubject,
                mastery: 0,
                nextReview: Date.now(),
                isHard: false,
                origin: card.origin || "",
                createdAt: Date.now(),
                userId: currentUser.uid,
                deckId: currentBatchDeckId,
              };
            });

            mappedBatch.forEach((cardObj) => {
              const cardDocRef = doc(db, "flashcards", cardObj.id);
              batch.set(cardDocRef, cardObj);
              accumulatedCards.push(cardObj);
            });

            await batch.commit();

            setAutoCreatedCards([...accumulatedCards]);
            completedCount++;

            setAutoProgress((prev) =>
              prev
                ? {
                    ...prev,
                    processedCards: accumulatedCards.length,
                    currentChunk: completedCount,
                  }
                : null,
            );

            // Safe Checkpoint
            const stateToSave = {
              rawLines: finalRawLines,
              currentChunk: completedCount,
              processedCardsCount: accumulatedCards.length,
              allGeneratedCards: accumulatedCards,
              deckTitle: title,
              deckSubject: subject,
              deckId: activeDeckId,
              logs: allLogsRef.current.slice(-40),
              failedChunks: failedChunksAccumulator,
            };
            saveSavedState(stateToSave);
            setSavedPipeline(stateToSave);
          } catch (saveErr: any) {
            pushLog(
              `🚨 Lỗi ghi Firestore tại phân đoạn ${cIdx + 1}: ${saveErr.message || saveErr}`,
              true,
            );
          }
        } else {
          pushLog(
            `🚨 [Mảng Cách Ly] Tiếp tục cô lập phân đoạn lỗi ${cIdx + 1} do cạn hạn kết nối.`,
            true,
          );
          failedChunksAccumulator.push({
            chunkIndex: cIdx + 1,
            content: textSegment,
            error: `Quá giới hạn ${maxRetries} lần hồi đáp thất bại.`,
          });
          setPipelineErrors([...failedChunksAccumulator]);

          completedCount++;
          setAutoProgress((prev) =>
            prev
              ? {
                  ...prev,
                  currentChunk: completedCount,
                }
              : null,
          );

          const stateToSave = {
            rawLines: finalRawLines,
            currentChunk: completedCount,
            processedCardsCount: accumulatedCards.length,
            allGeneratedCards: accumulatedCards,
            deckTitle: title,
            deckSubject: subject,
            deckId: activeDeckId,
            logs: allLogsRef.current.slice(-40),
            failedChunks: failedChunksAccumulator,
          };
          saveSavedState(stateToSave);
          setSavedPipeline(stateToSave);
        }
      }

      if (isCanceledRef.current) {
        setIsAutomating(false);
        return;
      }

      // 5. Finalize the target Deck only if non-canceled
      let finalDeckId = activeDeckId;
      let targetDeck =
        isAddToExisting && selectedExistingDeckId
          ? store.getDeck(selectedExistingDeckId)
          : null;

      if (targetDeck) {
        finalDeckId = targetDeck.id;
      }

      const cardsToUse = accumulatedCards;
      if (cardsToUse.length > 0) {
        const currentUserObj = store.getCurrentUser();
        const newCardsMapped = cardsToUse.map((c) => ({
          id: c.id,
          front: c.front,
          wordForm: c.wordForm || "",
          back: c.back,
          subject: targetDeck?.subject || c.subject || subject || "Tự chọn",
          mastery: 0,
          nextReview: Date.now(),
          isHard: false,
          interval: 1,
          easeFactor: 2.5,
          repetitionCount: 0,
          isNewCard: true,
        }));

        const newDeckObj = targetDeck
          ? {
              ...targetDeck,
              cards: [...(targetDeck.cards || []), ...newCardsMapped],
            }
          : {
              id: activeDeckId,
              title: title || "Bộ thẻ Tự động hóa",
              subject: subject || "Tự chọn",
              cards: newCardsMapped,
            };

        await store.addDeck(newDeckObj);
        if (targetDeck) {
          pushLog(
            `🎉 [Hoàn thành] Đã thêm thành công ${cardsToUse.length} thẻ mới vào bộ thẻ sẵn có "${newDeckObj.title}"!`,
            true,
          );
        } else {
          pushLog(
            `🎉 [Hoàn thành] Đã tạo thành công bộ thẻ "${newDeckObj.title}" với ${cardsToUse.length} thẻ học!`,
            true,
          );
        }
        setSuccessCount(cardsToUse.length);
      } else {
        pushLog(`⚠️ Không có thẻ nào được cấu trúc hoàn tất.`, true);
      }

      if (failedChunksAccumulator.length > 0) {
        pushLog(
          `⚠️ Quá trình kết thúc với ${failedChunksAccumulator.length} phân đoạn bị cách ly lỗi.`,
          true,
        );
      }

      // Reset fields on absolute success
      setRawTextLines("");
      setDeckTitle("");
      setDeckSubject("");
      setAutoCreatedCards([]);
      setIsAddToExisting(false);
      setSelectedExistingDeckId("");
      clearSavedState();
    } catch (err: any) {
      console.error("Automated Pipeline error:", err);
      setError(
        `Lỗi Pipeline: ${err.message || "Tự động lưu tiến trình cũ lỗi."}`,
      );
    } finally {
      setIsAutomating(false);
      setAutoProgress(null);
    }
  };

  // Traditional manual import to Firestore
  const handleImportToFirestore = async () => {
    if (!previewCards || previewCards.length === 0 || isProcessingRef.current)
      return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);
    setSuccessCount(null);
    setProgress(0);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Bạn chưa đăng nhập hoặc phiên đã hết hạn!");
      setIsProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    try {
      const { v4: uuidv4 } = await import("uuid");
      const deckId = `deck_${uuidv4()}`;

      const targetDeck =
        isAddToExisting && selectedExistingDeckId
          ? store.getDeck(selectedExistingDeckId)
          : null;

      const newCardsMapped = previewCards.map((c) => ({
        id: `card_${uuidv4()}`,
        front: c.front,
        wordForm: c.wordForm || "",
        back: c.back,
        subject: targetDeck?.subject || deckSubject.trim() || "Tự chọn",
        mastery: 0,
        nextReview: Date.now(),
        isHard: false,
      }));

      const newDeckObj: Deck = targetDeck
        ? {
            ...targetDeck,
            cards: [...(targetDeck.cards || []), ...newCardsMapped],
          }
        : {
            id: deckId,
            title: deckTitle.trim() || "Bộ thẻ nhập tay",
            subject: deckSubject.trim() || "Tự chọn",
            cards: newCardsMapped,
          };

      await store.addDeck(newDeckObj);

      setProgress(100);
      setSuccessCount(previewCards.length);
      setPreviewCards(null);
      setJsonInput("");
      setDeckTitle("");
      setDeckSubject("");
      setIsAddToExisting(false);
      setSelectedExistingDeckId("");

      setTimeout(() => setSuccessCount(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError(
        `Lỗi Import Firestore: ${err.message || "Không thể lưu dữ liệu"}`,
      );
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      setProgress(null);
    }
  };

  return (
    <section
      style={
        isFixLagEnabled
          ? { transform: "translateZ(0)", willChange: "transform" }
          : undefined
      }
      className={cn(
        isFixLagEnabled
          ? "p-6 md:p-8 rounded-2xl border-2 border-zinc-400 dark:border-zinc-800 bg-white dark:bg-black relative mt-8 max-w-4xl mx-auto shadow-none backdrop-blur-none transition-none duration-0"
          : "glass p-6 md:p-8 rounded-2xl border border-blue-500/10 dark:border-blue-400/10 shadow-lg relative overflow-hidden mt-8 max-w-4xl mx-auto",
      )}
    >
      <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl">
        Kênh Hồi Sức AI
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-zinc-200/50 dark:border-zinc-800/80 pb-6">
        <div>
          <h3 className="text-3xl font-display font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-1">
            <Sparkles className="w-7 h-7 text-blue-500" /> Nạp Thẻ Học Bằng Cơm
          </h3>
          <p className="text-sm opacity-70">
            Hạ tầng tự động hóa siêu nạp từ vựng & giải pháp dự phòng lỗi.
          </p>
        </div>

        <button
          onClick={() => setShowToolModal(true)}
          className={cn(
            "shrink-0 flex items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-xl border border-transparent",
            isFixLagEnabled
              ? "bg-blue-600 hover:bg-blue-700 border-blue-700 font-extrabold shadow-none transition-none duration-0"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/25 active:scale-95",
          )}
        >
          <Database className="w-5 h-5" /> Prompt Chuyên Biệt AI
        </button>
      </div>

      {/* Navigation Tabs for Flow Selector */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800/80 mb-6 gap-2">
        <button
          onClick={() => {
            if (!isAutomating && !isProcessing) setActiveTab("automated");
          }}
          className={cn(
            "flex-1 pb-3 text-base font-bold transition flex items-center justify-center gap-2 border-b-2 px-4 py-2",
            activeTab === "automated"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          <Layers className="w-4 h-4" /> Kênh Tự Động Hoá (Flashcard Pipeline)
        </button>
        <button
          onClick={() => {
            if (!isAutomating && !isProcessing) setActiveTab("manual");
          }}
          className={cn(
            "flex-1 pb-3 text-base font-bold transition flex items-center justify-center gap-2 border-b-2 px-4 py-2",
            activeTab === "manual"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          <Edit3 className="w-4 h-4" /> Bảng Nhập Tay (Raw JSON Copy)
        </button>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorNotification message={error} onRetry={() => setError(null)} />
        </div>
      )}

      {successCount !== null && (
        <div
          className={cn(
            "mb-6 p-4 rounded-xl text-base font-bold flex items-center gap-3 border shadow-none",
            isFixLagEnabled
              ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-700 transition-none animate-none duration-0"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 animate-in zoom-in-95 duration-200",
          )}
        >
          <Check className="w-6 h-6 shrink-0" />
          <span>
            Bơm thành công {successCount} thẻ học vào Database! Trạng thái
            Realtime đã đồng bộ tệp.
          </span>
        </div>
      )}

      {/* Active Panel Rendering */}
      {activeTab === "automated" ? (
        <div
          style={
            isFixLagEnabled
              ? { transform: "translateZ(0)", willChange: "transform" }
              : undefined
          }
          className={cn(
            "space-y-6",
            isFixLagEnabled
              ? "transition-none animate-none duration-0"
              : "animate-in fade-in duration-350",
          )}
        >
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Dán đoạn văn bản chứa danh sách từ vựng thô, câu nói, tài liệu
              chuyên ngành... Hệ thống sẽ tự động băm nhỏ theo cơ chế{" "}
              <strong>Lazy Chunking</strong>, tự động trích xuất IPA, cụm ví dụ,
              cấu trúc dịch nghĩa, xoay tua khóa API lỗi và ghi trực tiếp vào
              Firestore.
            </p>
          </div>

          {/* Target Deck Configuration */}
          <div className="p-4 bg-blue-50/40 dark:bg-zinc-900/35 border border-blue-100/60 dark:border-zinc-800/60 rounded-xl space-y-4">
            <label className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">
              THÊM THẺ HỌC VÀO BỘ THẺ SẴN CÓ
            </label>
            <CustomDeckSelect
              decks={store.getDecks()}
              value={
                isAddToExisting && selectedExistingDeckId
                  ? selectedExistingDeckId
                  : "new"
              }
              onChange={(val) => {
                if (val === "new") {
                  setIsAddToExisting(false);
                  setSelectedExistingDeckId("");
                } else {
                  setIsAddToExisting(true);
                  setSelectedExistingDeckId(val);
                }
              }}
              disabled={isAutomating}
            />

            {!isAddToExisting && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200 pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40">
                <div>
                  <label className="text-sm font-semibold opacity-85 mb-2 block text-zinc-800 dark:text-zinc-300">
                    Tên Bộ Thẻ Học Mới:
                  </label>
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="Ví dụ: 1000 Từ khóa Khoa Học Đời Sống"
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    disabled={isAutomating}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold opacity-85 mb-2 block text-zinc-800 dark:text-zinc-300">
                    Danh mục / Phân loại:
                  </label>
                  {!isCreatingNewSubject ? (
                    <div className="flex gap-2">
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
                        disabled={isAutomating}
                        className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        <option value="">-- Chọn danh mục hiện có --</option>
                        {existingCategories.map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option
                          value="__NEW__"
                          className="text-orange-500 font-bold"
                        >
                          + Thêm danh mục mới...
                        </option>
                      </select>
                      <button
                        type="button"
                        disabled={isAutomating}
                        onClick={() => {
                          setIsCreatingNewSubject(true);
                          setDeckSubject("");
                        }}
                        className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl flex items-center justify-center border border-zinc-200/50 dark:border-zinc-800 focus:outline-none disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deckSubject}
                        onChange={(e) => setDeckSubject(e.target.value)}
                        disabled={isAutomating}
                        placeholder="Ví dụ: Thượng tầng, AI, Lập trình..."
                        className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                      <button
                        type="button"
                        disabled={isAutomating}
                        onClick={() => {
                          setIsCreatingNewSubject(false);
                          setDeckSubject("");
                        }}
                        className="px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold border border-zinc-200/50 dark:border-zinc-800 disabled:opacity-50"
                      >
                        Quay lại
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {savedPipeline && (
            <div
              className={cn(
                "p-4 rounded-xl space-y-3 border shadow-none",
                isFixLagEnabled
                  ? "bg-orange-600 dark:bg-orange-700 text-white border-orange-700 transition-none animate-none duration-0"
                  : "bg-orange-500/10 border border-orange-500/20 animate-in fade-in duration-350",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5
                    className={cn(
                      "font-bold flex items-center gap-2 text-base",
                      isFixLagEnabled
                        ? "text-white"
                        : "text-orange-700 dark:text-orange-400",
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "w-5 h-5",
                        isFixLagEnabled
                          ? "text-white"
                          : "text-orange-500 animate-pulse",
                      )}
                    />{" "}
                    Phát Hiện Tiến Trình Bị Gián Đoạn!
                  </h5>
                  <p
                    className={cn(
                      "text-sm font-medium mt-1",
                      isFixLagEnabled
                        ? "text-white"
                        : "text-slate-900 dark:text-zinc-200",
                    )}
                  >
                    Hệ thống đã tự động sao lưu tiến trình băm thẻ dở cho bộ{" "}
                    <strong>"{savedPipeline.deckTitle}"</strong> (Phân đoạn:{" "}
                    {savedPipeline.currentChunk}/
                    {Math.ceil(savedPipeline.rawLines.length / 6)}). Bạn có muốn
                    Auto-Resume không?
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleResumePipeline}
                    disabled={isAutomating}
                    className={cn(
                      "bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm disabled:opacity-50",
                      isFixLagEnabled
                        ? "border border-orange-700 shadow-none transition-none animate-none duration-0"
                        : "transition active:scale-95 animate-pulse",
                    )}
                  >
                    Tiếp tục ngay (Auto-Resume)
                  </button>
                  <button
                    onClick={handleDiscardSavedPipeline}
                    disabled={isAutomating}
                    className="text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 py-2.5 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                  >
                    Xóa bỏ
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-base font-semibold opacity-85 mb-2">
              Nhập tệp dữ liệu từ vựng thô (Một từ/câu mỗi dòng là tốt nhất):
            </label>
            <textarea
              className="w-full h-64 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-base font-mono resize-y focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200 transition"
              placeholder="vibration&#10;break down (v) - hỏng hóc&#10;mitigate (v) - giảm thiểu mức ảnh hưởng..."
              value={rawTextLines}
              onChange={(e) => setRawTextLines(e.target.value)}
              disabled={isAutomating}
            />
          </div>

          {/* Console / Log Terminal Area during execution */}
          {autoProgress && (
            <div
              style={
                isFixLagEnabled
                  ? { transform: "translateZ(0)", willChange: "transform" }
                  : undefined
              }
              className="p-4 bg-black/90 dark:bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-300 font-mono text-sm space-y-3 shadow-none"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <Terminal
                      className={cn(
                        "w-4 h-4 text-blue-500",
                        !isFixLagEnabled && "animate-pulse",
                      )}
                    />{" "}
                    Trạng thái Hàng đợi AI
                  </span>
                  {autoProgress.totalLines && (
                    <span className="text-[11px] text-orange-500 font-bold font-mono mt-0.5 animate-pulse">
                      Đang tạo thẻ: {autoProgress.processedCards} /{" "}
                      {autoProgress.totalLines}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    Cụm: {autoProgress.currentChunk}/{autoProgress.totalChunks}
                  </span>
                  {activeProcessingChunkIndex !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSkipActiveChunk(activeProcessingChunkIndex)
                      }
                      className="text-[11px] bg-red-650 hover:bg-red-700 text-white font-extrabold px-3 py-1 rounded-lg transition transform active:scale-95 flex items-center gap-1 cursor-pointer shadow border border-red-500"
                      title="Hủy/Bỏ qua phân đoạn hiện tại nếu nghi ngờ bị treo"
                    >
                      <X className="w-3 h-3" /> Hủy mảng{" "}
                      {activeProcessingChunkIndex + 1}
                    </button>
                  )}
                </div>
              </div>
              <div
                style={
                  isFixLagEnabled
                    ? { transform: "translateZ(0)", willChange: "transform" }
                    : undefined
                }
                className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin text-zinc-200"
              >
                {autoProgress.logs.map((log, lIdx) => (
                  <div key={lIdx} className="text-xs leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs mb-1 mb-2 font-bold opacity-80">
                  <span>Tiến độ xử lý chung</span>
                  <span>
                    {Math.round(
                      (autoProgress.currentChunk / autoProgress.totalChunks) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isFixLagEnabled
                        ? "bg-blue-600 transition-none duration-0"
                        : "bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300",
                    )}
                    style={{
                      width: `${(autoProgress.currentChunk / autoProgress.totalChunks) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-2 text-right">
                  Đã xử lý:{" "}
                  <strong className="text-emerald-400">
                    {autoProgress.processedCards} / {autoProgress.totalLines}
                  </strong>{" "}
                  thẻ.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Telemetry & Logging Dashboard Panel for AI Rotation & Pacing Monitoring */}
          {telemetryLogs.length > 0 && (
            <div className="p-5 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      Bảng Giám sát Telemetry & Phân tích Đột biến AI
                    </h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      Ghi nhận token, độ mất mát dữ liệu và luân phiên API keys
                      theo thời gian thực
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchTelemetryLogs}
                  className="p-1 px-2.5 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-lg transition text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Tẩy mới
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-150 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-500">
                      <th className="pb-2 font-semibold">
                        Tập tin / Thời gian
                      </th>
                      <th className="pb-2 font-semibold text-center">
                        API Key Index
                      </th>
                      <th className="pb-2 font-semibold text-center">
                        Token Đã Dùng
                      </th>
                      <th className="pb-2 font-semibold text-center">
                        Số thẻ (Đạt/Yêu cầu)
                      </th>
                      <th className="pb-2 font-semibold text-center">
                        Trạng thái dữ liệu
                      </th>
                      <th className="pb-2 font-semibold text-right">
                        Phản hồi (Ms)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/50">
                    {telemetryLogs.map((log: any, idx: number) => {
                      const timeStr = new Date(
                        log.timestamp,
                      ).toLocaleTimeString();
                      return (
                        <tr
                          key={log.id || idx}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors"
                        >
                          <td className="py-2.5 text-zinc-500 dark:text-zinc-400">
                            <div>{timeStr}</div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-650 font-mono">
                              Len: {log.inputLength} kí tự
                            </div>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-850 font-bold text-[11px] text-blue-500">
                              🗝️ #{log.keyIndex}{" "}
                              <span className="text-[10px] text-zinc-400">
                                ({log.keyMasked})
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            {log.status === "failed" ? (
                              <span className="text-red-500 font-extrabold text-[11px]">
                                Bị huỷ / Lỗi
                              </span>
                            ) : (
                              <div className="text-[11px]">
                                <span
                                  className="text-emerald-500 font-bold"
                                  title="Prompt Tokens"
                                >
                                  {log.tokenUsage?.promptTokens || 0}
                                </span>
                                <span className="text-zinc-400 mx-1">+</span>
                                <span
                                  className="text-indigo-500 font-bold"
                                  title="Completion Tokens"
                                >
                                  {log.tokenUsage?.completionTokens || 0}
                                </span>
                                <span className="text-zinc-400 mx-1">=</span>
                                <strong
                                  className="text-orange-500"
                                  title="Tổng Tokens"
                                >
                                  {log.tokenUsage?.totalTokens || 0}
                                </strong>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {log.status === "failed" ? (
                              <span className="text-red-500">0</span>
                            ) : (
                              <span
                                className={cn(
                                  log.isLossy
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-emerald-500",
                                )}
                              >
                                {log.actualCardsCount}
                              </span>
                            )}
                            <span className="text-zinc-400 dark:text-zinc-600 font-normal">
                              {" "}
                              / {log.targetMin}-{log.targetMax}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            {log.status === "failed" ? (
                              <span
                                className="inline-flex items-center gap-1 text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/30 text-[10px] font-bold"
                                title={log.errorMessage}
                              >
                                ⚠️ Thất bại
                              </span>
                            ) : log.isLossy ? (
                              <span
                                className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-905/30 text-[10px] font-bold"
                                title="Số thẻ tạo ra thấp hơn mức tối thiểu yêu cầu cho cụm này."
                              >
                                🟡 Mất thông tin (Lossy)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30 text-[10px] font-bold">
                                🟢 Đầy đủ bảo toàn
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-bold text-zinc-600 dark:text-neutral-400">
                            {log.latencyMs
                              ? `${(log.latencyMs / 1000).toFixed(1)}s`
                              : "Chờ"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Start Chunk (Phân đoạn bắt đầu)
              </label>
              <input
                type="number"
                min="1"
                value={startChunkInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartChunkInput(val === '' ? '' as any : Number(val));
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (!val || val < 1) setStartChunkInput(1);
                }}
                disabled={isAutomating}
                className="w-full input-3d px-3 py-2 text-sm font-bold disabled:opacity-50"
                placeholder="1"
              />
            </div>
            <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Số dòng mỗi phân đoạn (Chunk Size)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={chunkSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setChunkSize(val === '' ? '' as any : Number(val));
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (!val || val < 1) setChunkSize(1);
                  else if (val > 500) setChunkSize(500);
                }}
                disabled={isAutomating}
                className="w-full input-3d px-3 py-2 text-sm font-bold disabled:opacity-50"
                placeholder="20"
              />
            </div>
            <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Luồng Xử Lý Đồng Thời
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
                disabled={isAutomating}
                className="w-full input-3d px-3 py-2 text-sm font-bold disabled:opacity-50"
                placeholder="1"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleAutomatedPipeline()}
              disabled={
                isAutomating ||
                !rawTextLines.trim() ||
                (!isAddToExisting && !deckTitle.trim()) ||
                (isAddToExisting && !selectedExistingDeckId)
              }
              className={cn(
                "flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed",
                isFixLagEnabled
                  ? "shadow-none transition-none duration-0"
                  : "transition shadow-lg shadow-blue-500/10",
              )}
            >
              {isAutomating ? (
                <>
                  <RefreshCw
                    className={cn("w-5 h-5", !isFixLagEnabled && "animate-spin")}
                  />{" "}
                  Đang Chạy Pipeline (
                  {autoProgress
                    ? `${autoProgress.currentChunk}/${autoProgress.totalChunks}`
                    : "Song song"}
                  )...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-orange-300" /> Kích Hoạt
                  Kênh Tự Động Hoá (Hỗ trợ Song song CC)
                </>
              )}
            </button>
            {isAutomating && (
              <button
                type="button"
                onClick={handleCancelAutomatedPipeline}
                className={cn(
                  "px-6 bg-red-650 hover:bg-red-700 text-white font-extrabold rounded-xl transition duration-200 transform active:scale-95 flex items-center justify-center gap-2 border-2 border-red-500 shadow-md shadow-red-500/20 py-4",
                  isFixLagEnabled
                    ? "bg-red-700 text-white shadow-none"
                    : "hover:shadow-lg animate-pulse",
                )}
              >
                <X className="w-5 h-5" /> Hủy tiến trình
              </button>
            )}
          </div>

          {/* REAL-TIME review/editing list for Kênh Tự Động Hóa */}
          {autoCreatedCards.length > 0 && (
            <div
              style={
                isFixLagEnabled
                  ? { transform: "translateZ(0)", willChange: "transform" }
                  : undefined
              }
              className={cn(
                "p-4 border rounded-xl space-y-3 mt-4 shadow-none",
                isFixLagEnabled
                  ? "bg-white dark:bg-black border-zinc-400 dark:border-zinc-800 transition-none duration-0"
                  : "bg-zinc-100/40 dark:bg-zinc-950/40 border-zinc-200/50 dark:border-zinc-800/80 animate-in fade-in duration-300",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-250 dark:border-zinc-800 pb-2">
                <span
                  className={cn(
                    "flex items-center gap-2 font-bold text-sm",
                    isFixLagEnabled
                      ? "text-emerald-600 dark:text-emerald-450"
                      : "text-emerald-600 dark:text-emerald-450",
                  )}
                >
                  <Check
                    className={cn("w-5 h-5", !isFixLagEnabled && "animate-bounce")}
                  />{" "}
                  Các Thẻ Đã Tạo Thành Công ({autoCreatedCards.length} Thẻ)
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 px-2 py-1 rounded font-bold uppercase tracking-wider">
                  Đồng bộ realtime
                </span>
              </div>

              {autoCreatedCards.length > 30 && (
                <p className="text-[11px] text-orange-500 font-bold mb-2">
                  ⚠️ Đang hiển thị 30 thẻ mới nhất được băm để xem và chỉnh sửa
                  nhanh. Toàn bộ {autoCreatedCards.length} thẻ vẫn được tự động
                  ghi nhận trực tiếp realtime vào cơ sở dữ liệu.
                </p>
              )}

              <div
                style={
                  isFixLagEnabled
                    ? { transform: "translateZ(0)", willChange: "transform" }
                    : undefined
                }
                className="max-h-[300px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin font-sans"
              >
                {autoCreatedCards.slice(-30).map((c, index) => (
                  <div
                    key={c.id || index}
                    className={cn(
                      "p-3 bg-white dark:bg-zinc-900 rounded-lg border relative group",
                      isFixLagEnabled
                        ? "bg-white dark:bg-black border-zinc-400 dark:border-zinc-800 shadow-none transition-none duration-0"
                        : "border-zinc-250/50 dark:border-zinc-800/80 hover:border-blue-500 dark:hover:border-blue-400/50 transition",
                    )}
                  >
                    <button
                      onClick={() => handleDeleteAutoCard(c.id)}
                      className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
                      title="Xóa thẻ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1 pr-6 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider opacity-60 mb-0.5 block">
                          Mặt Trước (Front)
                        </span>
                        <input
                          type="text"
                          value={c.front}
                          onChange={(e) =>
                            handleUpdateAutoCard(c.id, "front", e.target.value)
                          }
                          className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider opacity-60 mb-0.5 block">
                          Mặt Sau (Back)
                        </span>
                        <textarea
                          value={c.back}
                          rows={1}
                          onChange={(e) =>
                            handleUpdateAutoCard(c.id, "back", e.target.value)
                          }
                          className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-zinc-800 dark:text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pipelineErrors.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-500/20 pb-2">
                <span className="flex items-center gap-2 font-bold text-red-500 text-sm">
                  <AlertCircle className="w-5 h-5" /> Báo Cáo Cách Ly Sai Lệch (
                  {pipelineErrors.length} Phân Đoạn Lỗi)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleRetryAllFailedChunks}
                    disabled={retryAllLoading || processingErrorIndex !== null}
                    className={cn(
                      "text-xs bg-orange-600 hover:bg-orange-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 disabled:opacity-50",
                      !isFixLagEnabled && "transition active:scale-95 duration-150",
                    )}
                  >
                    {retryAllLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang
                        băm lại hàng loạt...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Băm lại tất cả phân
                        đoạn lỗi
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(pipelineErrors, null, 2)],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `henosis-pipeline-errors-${deckTitle || "unnamed"}.json`;
                      link.click();
                    }}
                    className={cn(
                      "text-xs bg-red-650 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg",
                      !isFixLagEnabled && "transition active:scale-95",
                    )}
                  >
                    Tải Xuống JSON Lỗi
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {pipelineErrors.map((errItem, idx) => {
                  const isEditing = editingErrorIndex === idx;
                  const isRetryingCurrent =
                    processingErrorIndex === errItem.chunkIndex;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 bg-red-550/5 dark:bg-black/40 rounded-lg border border-red-500/10 space-y-2 relative group",
                        !isFixLagEnabled &&
                          "hover:bg-red-500/10 transition duration-150",
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-red-400 font-bold">
                        <span>Phân đoạn lỗi #{errItem.chunkIndex}</span>
                        <span className="text-[11px] opacity-80 font-normal">
                          {errItem.error}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full h-32 text-xs font-mono p-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-blue-500"
                            value={editingErrorText}
                            onChange={(e) =>
                              setEditingErrorText(e.target.value)
                            }
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingErrorIndex(null)}
                              className="text-xs text-zinc-400 hover:text-zinc-250 font-semibold px-2 py-1 rounded"
                            >
                              Hủy
                            </button>
                            <button
                              disabled={isRetryingCurrent}
                              onClick={() =>
                                handleRetrySingleFailedChunk(
                                  idx,
                                  errItem.chunkIndex,
                                  editingErrorText,
                                )
                              }
                              className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1 rounded flex items-center gap-1"
                            >
                              {isRetryingCurrent ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Đã sửa & Chạy băm lại"
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <pre className="text-[11px] font-mono p-2 bg-black/40 dark:bg-black/60 rounded border border-zinc-900/40 overflow-x-auto text-zinc-300 max-h-24 leading-relaxed">
                            {errItem.content}
                          </pre>
                          <div className="flex justify-end gap-2 text-xs pt-1">
                            <button
                              onClick={() => {
                                setEditingErrorIndex(idx);
                                setEditingErrorText(errItem.content);
                              }}
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-bold px-2 py-1 bg-blue-500/5 hover:bg-blue-500/10 rounded flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Sửa nhanh
                            </button>
                            <button
                              disabled={
                                isRetryingCurrent ||
                                processingErrorIndex !== null
                              }
                              onClick={() =>
                                handleRetrySingleFailedChunk(
                                  idx,
                                  errItem.chunkIndex,
                                  errItem.content,
                                )
                              }
                              className="text-green-500 hover:text-green-600 dark:text-green-400 font-bold px-2 py-1 bg-green-500/5 hover:bg-green-500/10 rounded flex items-center gap-1"
                            >
                              {isRetryingCurrent ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3" /> Chạy lại
                                  ngay
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={
            isFixLagEnabled
              ? { transform: "translateZ(0)", willChange: "transform" }
              : undefined
          }
          className={cn(
            "space-y-6",
            isFixLagEnabled
              ? "transition-none animate-none duration-0"
              : "animate-in fade-in duration-300",
          )}
        >
          {!previewCards ? (
            <div className="space-y-4">
              <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 gap-1 w-fit">
                <button
                  type="button"
                  onClick={() => setManualMode("form")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition border-none cursor-pointer",
                    manualMode === "form"
                      ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-450 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  📝 Nhập Thủ Công (Gõ Tay)
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode("json")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition border-none cursor-pointer",
                    manualMode === "json"
                      ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-450 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  ⚙️ Dán JSON Raw
                </button>
              </div>

              {manualMode === "form" ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black uppercase opacity-70 block tracking-wide">
                      Nhập từ vựng & nghĩa thủ công từng thẻ
                    </h4>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">
                      Form trực tiếp
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin">
                    {manualRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-center animate-in slide-in-from-top-1 duration-150"
                      >
                        <span className="text-xs opacity-55 font-mono w-5 shrink-0 text-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Mặt trước (Khái niệm, Câu hỏi...)*"
                            value={row.front}
                            onChange={(e) => {
                              const copy = [...manualRows];
                              copy[idx].front = e.target.value;
                              setManualRows(copy);
                            }}
                            className="bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs focus:ring-1 focus:ring-orange-500/50 outline-none font-medium text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="Mặt sau (Dịch nghĩa, Giải thích...)*"
                            value={row.back}
                            onChange={(e) => {
                              const copy = [...manualRows];
                              copy[idx].back = e.target.value;
                              setManualRows(copy);
                            }}
                            className="bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs focus:ring-1 focus:ring-orange-500/50 outline-none font-medium text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        {manualRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualRows(
                                manualRows.filter((_, rIdx) => rIdx !== idx),
                              );
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition border-none cursor-pointer"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setManualRows([...manualRows, { front: "", back: "" }])
                      }
                      className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition active:scale-95 border-none cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm dòng mới
                    </button>
                    <button
                      type="button"
                      disabled={
                        manualRows.filter(
                          (r) => r.front.trim() && r.back.trim(),
                        ).length === 0
                      }
                      onClick={() => {
                        const validRows = manualRows.filter(
                          (row) => row.front.trim() && row.back.trim(),
                        );
                        const mapped = validRows.map((row, idx) => ({
                          id: `temp_manual_${Date.now()}_${idx}`,
                          front: row.front.trim(),
                          wordForm: "",
                          ipa: "",
                          back: row.back.trim(),
                        }));
                        setPreviewCards(mapped);
                      }}
                      className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black rounded-xl text-xs font-black transition shadow-sm active:scale-95 border-none cursor-pointer ml-auto"
                    >
                      Xác nhận & Chuyển sang Nạp (
                      {
                        manualRows.filter(
                          (r) => r.front.trim() && r.back.trim(),
                        ).length
                      }{" "}
                      thẻ)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <label className="block text-base font-semibold opacity-85 mb-2">
                    Tải tệp JSON/TXT hoặc dán chuỗi JSON vào đây:
                  </label>

                  <p className="text-sm text-red-500 dark:text-red-400 font-medium mb-2">
                    ⚠️ Phương án dự phòng có thể xảy ra lỗi nếu AI bị đứt gãy
                    giữa chừng trong lúc sinh JSON siêu dài.
                  </p>

                  <div className="flex flex-col items-start gap-3 mb-4">
                    <button
                      onClick={() => setShowNormalize(!showNormalize)}
                      className={cn(
                        "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5",
                        isFixLagEnabled
                          ? "border-blue-500 bg-white dark:bg-black shadow-none transition-none duration-0"
                          : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 transition",
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Chuẩn hoá chuỗi JSON
                      dự phòng
                    </button>

                    {showNormalize && (
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 p-3 rounded-xl border",
                          isFixLagEnabled
                            ? "bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-800 transition-none animate-none duration-0"
                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-1 duration-200",
                        )}
                      >
                        <button
                          onClick={() => {
                            handleCopyNormalizePrompt();
                            window.open(
                              "https://gemini.google.com/",
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          className={cn(
                            "flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold",
                            isFixLagEnabled
                              ? "transition-none shadow-none font-extrabold duration-0"
                              : "transition",
                          )}
                          id="gemini-copy-btn"
                        >
                          {copiedNormalize ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copiedNormalize
                            ? "Đã Copy & Chuyển..."
                            : "Copy Prompt Dự Phòng & Chuyển Sang Gemini"}
                          <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Drag and Drop Zone / File selector */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleJsonDrop}
                    onClick={() => jsonFileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-2",
                      isFixLagEnabled
                        ? "bg-white dark:bg-black border-zinc-400 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-none transition-none duration-0"
                        : "border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 hover:bg-zinc-50 dark:hover:bg-zinc-950/40 hover:border-blue-500 dark:hover:border-blue-500/50 transition duration-200 animate-in fade-in",
                    )}
                    id="manual-drop-zone"
                  >
                    <input
                      type="file"
                      ref={jsonFileInputRef}
                      onChange={handleJsonFileChange}
                      accept=".txt,.json"
                      className="hidden"
                    />

                    {jsonFileName ? (
                      <>
                        <FileText className="w-10 h-10 text-emerald-500" />
                        <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                          Đã nạp thành công:{" "}
                          <span className="text-emerald-500">
                            {jsonFileName}
                          </span>
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setJsonFileName("");
                            setJsonInput("");
                          }}
                          className="text-xs text-red-500 hover:underline font-bold"
                        >
                          Xóa tệp tin
                        </button>
                      </>
                    ) : (
                      <>
                        <FileUp
                          className={cn(
                            "w-10 h-15 text-blue-500/80",
                            !isFixLagEnabled && "animate-pulse",
                          )}
                        />
                        <p className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                          Kéo thả hoặc nhấn để tải tệp JSON / TXT lên
                        </p>
                        <p className="text-xs opacity-60">
                          Nhấn vào đây để tải tệp .txt hoặc .json chứa dữ liệu
                          thẻ học của bạn
                        </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold opacity-85">
                      Hoặc dán tay chuỗi JSON vào đây:
                    </label>
                    <textarea
                      className="w-full h-48 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs font-mono resize-y focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                      placeholder='[\n  {\n    "front": "Từ khóa",\n    "back": "Định nghĩa"\n  }\n]'
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text");
                        if (pasted && pasted.trim()) {
                          setJsonInput(pasted);
                          if (pasted.includes("{") || pasted.includes("[")) {
                            setTimeout(() => {
                              handleParseJsonWithAi(pasted);
                            }, 50);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-4 items-center justify-center pt-2 w-full">
                    <button
                      onClick={handleParseJsonWithAi}
                      disabled={!jsonInput.trim() || isAiParsingJson}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed",
                        isFixLagEnabled
                          ? "bg-blue-600 hover:bg-blue-700 shadow-none transition-none duration-0"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/10",
                      )}
                    >
                      {isAiParsingJson ? (
                        <>
                          <Loader2
                            className={cn(
                              "w-5 h-5",
                              !isFixLagEnabled && "animate-spin",
                            )}
                          />{" "}
                          AI Đang Sửa Lỗi Cú Syntax...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white" /> Sửa lỗi &
                          Chuẩn hóa cấu trúc bằng AI (Khuyên dùng)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={
                isFixLagEnabled
                  ? { transform: "translateZ(0)", willChange: "transform" }
                  : undefined
              }
              className="space-y-6"
            >
              <div
                className={cn(
                  "flex items-center justify-between mt-2",
                  isFixLagEnabled
                    ? "transition-none animate-none duration-0"
                    : "animate-in slide-in-from-top-2 duration-300",
                )}
              >
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" /> Bản Xem Trước (
                  {previewCards.length} Thẻ)
                </h4>
                <button
                  onClick={() => {
                    setPreviewCards(null);
                    setError(null);
                  }}
                  disabled={isProcessing}
                  className={cn(
                    "text-xs text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg font-semibold",
                    isFixLagEnabled
                      ? "transition-none shadow-none text-red-600/90 font-bold duration-0"
                      : "transition",
                  )}
                >
                  Hủy / Sửa JSON
                </button>
              </div>

              {/* Target Deck Configuration */}
              <div className="p-4 bg-blue-50/40 dark:bg-zinc-900/35 border border-blue-100/60 dark:border-zinc-800/60 rounded-xl space-y-4">
                <label className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">
                  THÊM THẺ HỌC VÀO BỘ THẺ SẴN CÓ
                </label>
                <CustomDeckSelect
                  decks={store.getDecks()}
                  value={
                    isAddToExisting && selectedExistingDeckId
                      ? selectedExistingDeckId
                      : "new"
                  }
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

                {!isAddToExisting && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200 pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40">
                    <div>
                      <label className="text-sm font-semibold opacity-80 mb-2 block">
                        Tên Bộ Thẻ:
                      </label>
                      <input
                        type="text"
                        value={deckTitle}
                        onChange={(e) => setDeckTitle(e.target.value)}
                        placeholder="VD: IELTS Vocabulary Unit 1"
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={isProcessing}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold opacity-80 mb-2 block">
                        Phân loại / Môn học:
                      </label>
                      {!isCreatingNewSubject ? (
                        <div className="flex gap-2">
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
                            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">
                              -- Chọn danh mục hiện có --
                            </option>
                            {existingCategories.map((cat, idx) => (
                              <option key={idx} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option
                              value="__NEW__"
                              className="text-orange-600 dark:text-orange-450 font-bold"
                            >
                              + Thêm danh mục mới...
                            </option>
                          </select>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setIsCreatingNewSubject(true);
                              setDeckSubject("");
                            }}
                            className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl flex items-center justify-center border border-zinc-200/50 dark:border-zinc-800 focus:outline-none disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={deckSubject}
                            onChange={(e) => setDeckSubject(e.target.value)}
                            disabled={isProcessing}
                            placeholder="English, Tiếng Nhật, Lịch sử..."
                            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setIsCreatingNewSubject(false);
                              setDeckSubject("");
                            }}
                            className="px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold border border-zinc-200/50 dark:border-zinc-800 disabled:opacity-50"
                          >
                            Quay lại
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {previewCards.length > 40 && (
                <p className="text-[11px] text-orange-500 font-bold mb-2">
                  ⚠️ Đang hiển thị bản nháp xem trước của 40 thẻ đầu tiên để tối
                  ưu hóa hiệu năng thiết bị. Toàn bộ {previewCards.length} thẻ
                  vẫn được nạp đầy đủ vào hệ thống.
                </p>
              )}

              <div
                style={
                  isFixLagEnabled
                    ? { transform: "translateZ(0)", willChange: "transform" }
                    : undefined
                }
                className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin"
              >
                {previewCards.slice(0, 40).map((card, idx) => (
                  <div
                    key={card.id}
                    className={cn(
                      "p-4 rounded-xl relative group border shadow-none",
                      isFixLagEnabled
                        ? "bg-white dark:bg-black border-zinc-400 dark:border-zinc-850 transition-none duration-0"
                        : "bg-zinc-100/60 dark:bg-zinc-900/60 border-zinc-200/50 dark:border-zinc-800",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute -left-1 -top-1 bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold",
                        !isFixLagEnabled && "shadow-sm",
                      )}
                    >
                      {idx + 1}
                    </div>
                    <button
                      onClick={() => handleDeletePreviewCard(card.id)}
                      className={cn(
                        "absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg",
                        isFixLagEnabled
                          ? "transition-none shadow-none duration-0"
                          : "transition",
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="pl-3 pr-6 space-y-3">
                      <div>
                        <label
                          className={cn(
                            "text-[10px] uppercase font-bold tracking-wider opacity-50 mb-1 block",
                            !isFixLagEnabled && "animate-in fade-in",
                          )}
                        >
                          Front
                        </label>
                        <input
                          type="text"
                          value={card.front}
                          onChange={(e) =>
                            handleUpdatePreviewCard(
                              card.id,
                              "front",
                              e.target.value,
                            )
                          }
                          className="w-full bg-white dark:bg-black border border-zinc-200/50 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-50 mb-1 block">
                          Back
                        </label>
                        <textarea
                          value={card.back}
                          onChange={(e) =>
                            handleUpdatePreviewCard(
                              card.id,
                              "back",
                              e.target.value,
                            )
                          }
                          className="w-full h-16 resize-none bg-white dark:bg-black border border-zinc-200/50 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-800">
                {progress !== null && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                      <span>Tiến độ Nạp</span>
                      <span className="text-blue-500">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleImportToFirestore}
                  disabled={
                    isProcessing ||
                    previewCards.length === 0 ||
                    (!isAddToExisting && !deckTitle.trim()) ||
                    (isAddToExisting && !selectedExistingDeckId)
                  }
                  className={cn(
                    "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2",
                    isFixLagEnabled
                      ? "transition-none shadow-none animate-none duration-0"
                      : "transition animate-pulse",
                  )}
                >
                  {isProcessing
                    ? "Đang Đồng Bộ..."
                    : `Kích Hoạt Nạp ${previewCards.length} Thẻ Học`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROMPT TOOL MODAL */}
      {showToolModal && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            isFixLagEnabled ? "bg-black/95 animate-none" : "modal-glass-overlay",
          )}
        >
          <div
            className={cn(
              "w-full max-w-2xl rounded-2xl border overflow-hidden shadow-none",
              isFixLagEnabled
                ? "border-zinc-400 dark:border-zinc-800 bg-white dark:bg-black p-2 transition-none duration-0"
                : "bg-white dark:bg-zinc-900 modal-glass-content border-zinc-200 dark:border-zinc-800 shadow-xl animate-in zoom-in-95 duration-200",
            )}
          >
            <div className="px-6 py-4 flex justify-between items-center border-b border-zinc-200/50 dark:border-zinc-800/50">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-5 h-5 text-indigo-500" /> Bản Thiết Kế
                Prompt Hệ Cực Hạn
              </h3>
              <button
                onClick={() => setShowToolModal(false)}
                className={cn(
                  "p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500",
                  isFixLagEnabled
                    ? "transition-none shadow-none duration-0"
                    : "transition",
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={cn(
                  "p-4 rounded-xl border flex flex-col h-full shadow-none",
                  isFixLagEnabled
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/25 transition-none duration-0"
                    : "border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5",
                )}
              >
                <h4 className="font-bold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" /> Bản Khuyên Dùng
                </h4>
                <p className="text-sm opacity-100 font-medium mb-4 flex-grow text-zinc-600 dark:text-zinc-300">
                  Google AI Studio chuyên dụng đã tối giản hoá token và tự động
                  ghi chú mảng.
                </p>
                <a
                  href="https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%2217MwznDpps2XqQ55uhRa8uhzXaMXCyAaC%22%5D,%22action%22:%22open%22,%22userId%22:%22101494878159029919274%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "w-full block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm mb-2",
                    isFixLagEnabled
                      ? "transition-none shadow-none font-bold duration-0"
                      : "transition",
                  )}
                >
                  Mở Google AI Studio
                </a>
              </div>

              <div
                className={cn(
                  "p-4 rounded-xl border flex flex-col h-full shadow-none",
                  isFixLagEnabled
                    ? "border-zinc-400 bg-zinc-50 dark:bg-zinc-950 transition-none duration-0 text-zinc-900 dark:text-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/20",
                )}
              >
                <h4 className="font-bold mb-2 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                  <Layers className="w-4 h-4" /> Gemini Web System
                </h4>
                <p className="text-sm opacity-100 font-medium mb-4 flex-grow text-zinc-600 dark:text-zinc-300">
                  Sử dụng Prompt tối ưu hóa để gò ép cấu trúc mảng JSON hoàn hảo
                  khi làm thủ công.
                </p>
                <div className="space-y-2 mt-auto">
                  <button
                    onClick={() => {
                      handleCopyPrompt();
                      window.open(
                        "https://gemini.google.com/",
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm",
                      isFixLagEnabled
                        ? "transition-none shadow-none font-extrabold duration-0"
                        : "transition",
                    )}
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Layers className="w-4 h-4" />
                    )}
                    {copied
                      ? "Đã Copy Prompt..."
                      : "Sao Chép Prompt & Mở Gemini Web"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
