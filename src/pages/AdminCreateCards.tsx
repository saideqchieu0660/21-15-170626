import { toast } from "sonner";
import React, { useState, useEffect, useRef, useCallback , useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Save,
  Trash2,
  ChevronLeft,
  Layers,
  Type,
  Speech,
  BookOpen,
  BrainCircuit,
  Edit3,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { v4 as uuidv4 } from "uuid";
import { store, Flashcard, Deck } from "../lib/store";
import { db } from "../lib/firebase";
import { doc, setDoc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { safeRequest } from "../utils/apiClient";
import { CustomDeckSelect } from "../components/CustomDeckSelect";

// Helper function for Retry with Exponential Backoff
async function runWithRetryAndBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 1200,
  factor = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      
      const isRateLimit = (error: any) => {
        if (!error) return false;
        const msg = String(error.message || error).toLowerCase();
        const code = String(error.code || "").toLowerCase();
        return (
          code === "resource-exhausted" ||
          code === "unavailable" ||
          error.status === 429 ||
          msg.includes("429") ||
          msg.includes("too many requests") ||
          msg.includes("quota exceeded") ||
          msg.includes("rate limit")
        );
      };

      if (attempt > maxRetries || !isRateLimit(err)) {
        throw err;
      }

      const delay = initialDelayMs * Math.pow(factor, attempt - 1);
      const jitter = Math.random() * 250;
      const finalDelay = delay + jitter;
      
      console.warn(
        `[Retry Backoff] Hạn ngạch đầy/Spam chặn (429/Unavailable). Thử lại lần ${attempt}/${maxRetries} sau ${Math.round(
          finalDelay
        )}ms... Chi tiết lỗi: ${err.message || err}`
      );
      
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }
}

export default function AdminCreateCards() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [decks, setDecks] = useState<Deck[]>(store.getDecks());

  // Deck Management State
  const [selectedDeckId, setSelectedDeckId] = useState<string>("new");
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [newDeckSubject, setNewDeckSubject] = useState("");
  const [isCreatingNewSubjectAdmin, setIsCreatingNewSubjectAdmin] = useState(false);

  const existingSubjects = useMemo(() => {
    const subjectsSet = new Set<string>();
    decks.forEach((d) => {
      const s =
        (typeof d.subject === "string"
          ? d.subject
          : JSON.stringify(d.subject)) || "general";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    // Add default subjects as fallbacks
    const defaults = [
      "general",
      "english",
      "math",
      "science",
      "history",
      "geography",
      "literature",
      "programming",
    ];
    defaults.forEach((def) => subjectsSet.add(def));
    return Array.from(subjectsSet);
  }, [decks]);

  // Card Builder State
  const [front, setFront] = useState("");
  const [wordForm, setWordForm] = useState("");
  const [back, setBack] = useState("");

  // local batch
  const [batchCards, setBatchCards] = useState<Flashcard[]>([]);
  const [editingBatchCardId, setEditingBatchCardId] = useState<string | null>(
    null,
  );

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const frontInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateBack = async () => {
    if (!front.trim()) {
      toast("Vui lòng nhập Mặt trước (Từ / Khái niệm) trước khi phân tích AI!");
      frontInputRef.current?.focus();
      return;
    }
    setIsGeneratingAI(true);
    try {
      const res = await safeRequest("/api/automation/manual-define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front, wordForm: wordForm })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.definition)) {
        setBack(data.definition);
        if (data.wordForm) {
          setWordForm(data.wordForm);
        }
      } else {
        throw new Error(data.error || data.message || "Lỗi cập nhật AI");
      }
    } catch (err: any) {
      toast("Lỗi khi gọi AI phân tích: " + (err.message || ""));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    const user = store.getCurrentUser();
    if (
      !user ||
      (user.role !== "teacher" &&
        user.role !== "admin" &&
        user.role !== "Admin")
    ) {
      navigate("/dashboard");
    } else {
      setIsAuthorized(true);
      setCurrentUser(user);
    }
  }, [navigate]);

  const handleEditCard = useCallback(
    (id: string) => {
      const card = batchCards.find((c) => c.id === id);
      if (!card) return;
      setFront(card.front);
      setWordForm(card.wordForm || "");
      setBack(card.back || (card as any).meaning || "");
      setEditingBatchCardId(id);
      frontInputRef.current?.focus();
    },
    [batchCards],
  );

  const handleDeleteCard = useCallback(
    (id: string) => {
      if (!window.confirm("Bạn có chắc chắn muốn xóa thẻ này khỏi danh sách không?")) return;
      setBatchCards((prev) => prev.filter((c) => c.id !== id));
      if (editingBatchCardId === id) {
        setEditingBatchCardId(null);
        setFront("");
        setWordForm("");
        setBack("");
      }
    },
    [editingBatchCardId],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingBatchCardId(null);
    setFront("");
    setWordForm("");
    setBack("");
    frontInputRef.current?.focus();
  }, []);

  const handleAddOrUpdateCardToBatch = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!front.trim() || !back.trim()) return;

      if (editingBatchCardId) {
        setBatchCards((prev) =>
          prev.map((c) =>
            c.id === editingBatchCardId
              ? {
                  ...c,
                  front: front.trim(),
                  wordForm: wordForm.trim(),
                  back: back.trim(),
                }
              : c,
          ),
        );
        setEditingBatchCardId(null);
      } else {
        const baseSubject =
          selectedDeckId === "new"
            ? newDeckSubject || "general"
            : decks.find((d) => d.id === selectedDeckId)?.subject || "general";

        const newCard: Flashcard = {
          id: `card_${uuidv4()}`,
          front: front.trim(),
          back: back.trim(),
          subject: baseSubject,
          mastery: 0,
          nextReview: Date.now(),
          isHard: false,
          repetitionCount: 0,
          easeFactor: 2.5,
          interval: 0,
          isNewCard: true,
        };

        if (wordForm.trim()) {
          newCard.wordForm = wordForm.trim();
        }

        setBatchCards((prev) => [...prev, newCard]);
      }

      // Clear form for quick add
      setFront("");
      setWordForm("");
      setBack("");

      // Focus back to front input
      frontInputRef.current?.focus();
    },
    [
      front,
      wordForm,
      back,
      editingBatchCardId,
      selectedDeckId,
      newDeckSubject,
      decks,
    ],
  );

  const handleBulkSave = async () => {
    if (batchCards.length === 0) return;

    // Validate New Deck if selected
    if (selectedDeckId === "new" && !newDeckTitle.trim()) {
      toast("Vui lòng nhập tên Bộ bài mới!");
      return;
    }

    setIsSaving(true);
    setSuccessMsg("");

    try {
      // Bổ sung các mandatory fields cứng vào payload trước khi gửi để tránh Firestore Rules thả lỗi
      const adminUid = store.getCurrentUser()?.id || "";
      const targetDeckId =
        selectedDeckId === "new" ? `deck_${uuidv4()}` : selectedDeckId;
      const now = Date.now();

      const enrichedBatchCards = batchCards.map((card) => ({
        ...card,
        deckId: targetDeckId,
        uid: adminUid,
        createdAt: now,
        updatedAt: now,
        isReviewing: false,
      }));

      const safeBatchCards = JSON.parse(JSON.stringify(enrichedBatchCards)); // Drop any undefined fields

      if (selectedDeckId === "new") {
        const newDeck: Deck = {
          id: targetDeckId,
          title: newDeckTitle.trim(),
          subject: newDeckSubject.trim() || "general",
          cards: safeBatchCards,
        };

        await runWithRetryAndBackoff(() => setDoc(doc(db, "sets", targetDeckId), newDeck));

        // Update local store
        store.addDeck(newDeck);
        setDecks(store.getDecks());
        setSelectedDeckId(targetDeckId);
        setNewDeckTitle("");
        setNewDeckSubject("");
      } else {
        const deckRef = doc(db, "sets", selectedDeckId);
        const snap = await runWithRetryAndBackoff(() => getDoc(deckRef));

        if (!snap.exists()) {
          // Deck is likely a local mock that hasn't been saved to firestore yet
          const localDeck = store
            .getDecks()
            .find((d) => d.id === selectedDeckId);
          if (localDeck) {
            const fullDeckObj = {
              id: localDeck.id,
              title: localDeck.title,
              subject: localDeck.subject,
              cards: [...(localDeck.cards || []), ...safeBatchCards],
            };
            await runWithRetryAndBackoff(() => setDoc(deckRef, fullDeckObj));
          } else {
            throw new Error("Không tìm thấy dữ liệu bộ bài gốc");
          }
        } else {
          await runWithRetryAndBackoff(() => updateDoc(deckRef, {
            cards: arrayUnion(...safeBatchCards),
          }));
        }

        // Fetch and update local store
        const snapAfter = await runWithRetryAndBackoff(() => getDoc(deckRef));
        if (snapAfter.exists()) {
          const updatedDeck = snapAfter.data() as Deck;
          const existingIdx = decks.findIndex((d) => d.id === selectedDeckId);
          if (existingIdx !== -1) {
            store.setDecksLocally([
              ...decks.slice(0, existingIdx),
              { ...decks[existingIdx], cards: updatedDeck.cards },
              ...decks.slice(existingIdx + 1),
            ]);
            setDecks(store.getDecks());
          }
        }
      }

      setSuccessMsg(`Đã lưu thành công ${batchCards.length} thẻ vào bộ bài!`);
      setBatchCards([]);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(
        "Save Card Error Details (Full error):",
        err,
        typeof err,
        err.code,
        err.message,
      );
      if (err && typeof err === "object" && err.message) {
        toast(
          `Có lỗi xảy ra khi lưu thẻ: ${err.code} - ${err.message}. Vui lòng thử lại!`,
        );
      } else {
        toast(
          `Có lỗi xảy ra khi lưu thẻ: ${JSON.stringify(err)}. Vui lòng thử lại!`,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) return null;

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-500 mt-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-orange-500" />
            Tạo Thẻ Học Chuyên Sâu
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
            <span className="uppercase text-xs font-bold tracking-widest text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
              Admin Route
            </span>
            Quản lý thư viện thẻ học tập trung
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-2xl font-medium flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* LEFT COLUMN: Deck & Card Builder */}
        <div className="lg:col-span-7 space-y-6">
          {/* Deck Selection Layer */}
          <div className="glass p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
              <Layers className="w-5 h-5 text-blue-500" />
              Bộ bài đích
            </h2>

            <div className="space-y-4 relative z-10">
              <CustomDeckSelect
                decks={decks}
                value={selectedDeckId}
                onChange={(val) => setSelectedDeckId(val)}
                disabled={editingBatchCardId !== null}
              />

              {selectedDeckId === "new" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                  <input
                    type="text"
                    placeholder="Tên bộ bài (VD: 3000 Từ Vựng Toeic)"
                    className="p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition"
                    value={newDeckTitle}
                    onChange={(e) => setNewDeckTitle(e.target.value)}
                    disabled={editingBatchCardId !== null}
                  />
                  {!isCreatingNewSubjectAdmin ? (
                    <div className="flex gap-2">
                      <select
                        value={newDeckSubject}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setIsCreatingNewSubjectAdmin(true);
                            setNewDeckSubject("");
                          } else {
                            setNewDeckSubject(e.target.value);
                          }
                        }}
                        disabled={editingBatchCardId !== null}
                        className="flex-1 p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">-- Chọn danh mục --</option>
                        {existingSubjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option
                          value="__NEW__"
                          className="text-blue-600 dark:text-blue-400 font-bold"
                        >
                          + Thêm danh mục mới...
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewSubjectAdmin(true);
                          setNewDeckSubject("");
                        }}
                        disabled={editingBatchCardId !== null}
                        className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition shadow-md focus:ring-2 focus:ring-blue-500 outline-none"
                        title="Thêm danh mục mới"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Danh mục (VD: Tiếng Anh)"
                        className="flex-1 p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition text-zinc-900 dark:text-zinc-100"
                        value={newDeckSubject}
                        onChange={(e) => setNewDeckSubject(e.target.value)}
                        disabled={editingBatchCardId !== null}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewSubjectAdmin(false);
                          setNewDeckSubject(existingSubjects[0] || "general");
                        }}
                        disabled={editingBatchCardId !== null}
                        className="px-4 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold"
                      >
                        Quay lại
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card Builder Layer */}
          <div
            className={`glass p-6 md:p-8 rounded-3xl border ${editingBatchCardId ? "border-orange-400 dark:border-orange-500/50 shadow-orange-500/20 shadow-xl" : "border-zinc-200 dark:border-zinc-800 shadow-lg"} relative transition-all duration-300`}
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-orange-400/10 blur-3xl rounded-full" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus
                  className={`w-6 h-6 ${editingBatchCardId ? "text-orange-500" : "text-orange-600 dark:text-orange-500"}`}
                />
                {editingBatchCardId
                  ? "Cập Nhật Thông Tin Thẻ"
                  : "Thêm Thông Tin Thẻ"}
              </h2>
              {editingBatchCardId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-semibold rounded-lg transition"
                >
                  <X className="w-4 h-4" /> Bỏ qua
                </button>
              )}
            </div>

            <form onSubmit={handleAddOrUpdateCardToBatch} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Type className="w-3.5 h-3.5" /> Mặt trước (Từ / Khái niệm)
                </label>
                <input
                  ref={frontInputRef}
                  type="text"
                  className="w-full text-lg p-5 bg-white/70 dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 shadow-inner rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 transition font-medium"
                  placeholder="Nhập từ vựng, câu hỏi..."
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Speech className="w-3.5 h-3.5" /> Từ loại / Phát âm (Không
                  bắt buộc)
                </label>
                <input
                  type="text"
                  className="w-full p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-orange-500 transition text-sm font-mono"
                  placeholder="VD: Noun, Verb, /'stʌdi/..."
                  value={wordForm}
                  onChange={(e) => setWordForm(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" /> Mặt sau (Nghĩa / Lời giải)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBack}
                    disabled={isGeneratingAI || !front.trim()}
                    className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-500 font-bold text-[10px] rounded flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Khuyến Nghị
                  </button>
                </div>
                <textarea
                  rows={4}
                  className="w-full p-5 bg-white/70 dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 shadow-inner rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 transition resize-none leading-relaxed"
                  placeholder="Giải thích chi tiết, ý nghĩa, ví dụ tiếng Việt..."
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  required
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddOrUpdateCardToBatch();
                    }
                  }}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!front.trim() || !back.trim()}
                  className={`px-6 py-3 font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 duration-200
                        ${
                          editingBatchCardId
                            ? "bg-orange-500 hover:bg-orange-600 text-white"
                            : "bg-zinc-800 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black"
                        }
                     `}
                >
                  {editingBatchCardId ? "Cập Nhật Thẻ Này" : "Thêm Vào Batch"}
                  <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 bg-white/20 dark:bg-black/20 rounded font-mono text-xs shadow-sm text-inherit">
                    Enter
                  </kbd>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Batch Preview & Bulk Submission */}
        <div className="lg:col-span-5 h-full">
          <div className="glass p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col h-full sticky top-28 shadow-sm">
            <div className="flex items-center justify-between mx-2 mb-4">
              <h3 className="font-bold text-lg">Danh sách chờ lưu</h3>
              <div className="px-3 py-1 bg-orange-500/20 text-orange-700 dark:text-orange-400 font-bold rounded-full text-sm flex items-center gap-2 transition-all">
                {batchCards.length} Thẻ
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-3 min-h-[300px] max-h-[500px]">
              <AnimatePresence>
                {batchCards.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center opacity-30 p-8 text-center"
                  >
                    <Layers className="w-12 h-12 mb-4 opacity-50" />
                    <p>Chưa có thẻ nào trong Batch.</p>
                    <p className="text-xs mt-2">
                      Hãy điền thông tin ở form bên trái.
                    </p>
                  </motion.div>
                ) : (
                  batchCards.map((card, idx) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`p-4 bg-white/50 dark:bg-zinc-900/50 rounded-2xl group flex flex-col gap-3 transition-colors duration-200 relative overflow-hidden ${
                        editingBatchCardId === card.id
                          ? "border-2 border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                          : "border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {editingBatchCardId === card.id && (
                        <div
                          className="absolute top-0 right-0 w-8 h-8 bg-orange-400 dark:bg-orange-500"
                          style={{
                            clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                          }}
                        />
                      )}

                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex justify-between items-start w-full gap-3">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-xs font-bold opacity-40 mb-1 flex items-center gap-1.5">
                              # {idx + 1}
                              {editingBatchCardId === card.id && (
                                <span className="text-orange-600 dark:text-orange-400 opacity-100">
                                  (Đang sửa)
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold line-clamp-1 text-sm">
                              {card.front}{" "}
                              {card.wordForm && (
                                <span className="opacity-50 font-normal italic">
                                  ({card.wordForm})
                                </span>
                              )}
                            </h4>
                            <p className="text-xs opacity-70 line-clamp-2 mt-1">
                              {card.back || (card as any).meaning}
                            </p>
                          </div>

                          {/* Using flex gap-2 instead of absolute positioning to prevent overlap */}
                          <div
                            className={`flex flex-col sm:flex-row gap-2 flex-shrink-0 z-10 transition-opacity duration-200 ${editingBatchCardId === card.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                          >
                            <button
                              onClick={() => handleEditCard(card.id)}
                              className={`p-2 rounded-lg transition flex items-center justify-center transform active:scale-95 ${
                                editingBatchCardId === card.id
                                  ? "bg-orange-500 text-white shadow-md"
                                  : "bg-orange-500/10 text-orange-600 dark:text-orange-500 hover:bg-orange-500 hover:text-white"
                              }`}
                              title="Sửa thẻ"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition flex items-center justify-center transform active:scale-95"
                              title="Xóa thẻ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleBulkSave}
              disabled={
                batchCards.length === 0 ||
                isSaving ||
                editingBatchCardId !== null
              }
              className="w-full btn-3d btn-3d-primary py-4 text-lg font-bold flex justify-center items-center gap-3 disabled:opacity-50 disabled:grayscale transition cursor-pointer"
            >
              {isSaving ? (
                <div className="flex gap-2 items-center">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang đồng bộ DB...
                </div>
              ) : (
                <>
                  <Save className="w-6 h-6" /> Lưu toàn bộ lên Cloud
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
