import React, { useState, useRef, useEffect, useCallback , useMemo } from "react";
import { store } from "../lib/store";
import { MessageCircle, X, Send, Bot, CheckCircle, Maximize2, Minimize2, Flame, Plus, Loader2, FolderPlus, Settings, Sparkles, XCircle, Copy, Download, FileCode } from "lucide-react";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useAICooldown } from "../lib/cooldown";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "motion/react";

export function preprocessMessageText(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  
  if (trimmed.includes("```mermaid") || trimmed.includes("```")) {
    return text;
  }
  
  const keywords = ["mindmap", "graph TD", "graph LR", "flowchart TD", "flowchart LR"];
  for (let kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      const preText = text.substring(0, idx);
      const postText = text.substring(idx);
      return `${preText}\n\`\`\`mermaid\n${postText}\n\`\`\``;
    }
  }
  
  return text;
}

export default function Agent3Widget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<{role: "user"|"ai", text: string}[]>([]);

  useEffect(() => {
    const savedMode = (localStorage.getItem("agent3_response_mode") as "socratic" | "direct") || "socratic";
    const welcomeText = savedMode === "direct"
      ? "Yo! Tôi là Học giả AI trí tuệ - Trợ lý trực diện của ngài. Mời ngài đặt câu hỏi. Tôi sẽ cung cấp câu trả lời trực tiếp và cặn kẽ!"
      : "Yo! Tôi là Học giả AI trí tuệ - 'Socrates Coach' siêu cấp của ngài. Hôm nay muốn cày từ vựng IELTS, học lập trình ESP32 hay phân tích tâm lý học kinh tế chi không? Hãy gõ lệnh `/draw` + (chủ đề) tôi sẽ phác họa sơ đồ tư duy ngay lập tức. Mời ngài ra lệnh!";
    setMessages([{ role: "ai", text: welcomeText }]);
  }, []);

  /* Ký sinh đè lên useEffect gốc bằng cách comment out
  useEffect(() => {
    setMessages([{ role: "ai", text: "Yo! Tôi là Học giả AI trí tuệ - Trợ lý siêu cấp của ngài. Hôm nay muốn cày từ vựng IELTS, học lập trình ESP32 hay phân tích tâm lý học kinh tế chi không? Đặc biệt, tôi mới được nâng cấp hệ thống: có khả năng BẮM KHÁI NIỆM & VẼ SƠ ĐỒ TƯ DUY (MINDMAP) trực quan cực đỉnh luôn nà! Cứ gõ lệnh `/draw` cộng với (chủ đề), ví dụ: `/draw cấu trúc IELTS Writing Task 2`, tôi sẽ phác họa sơ đồ ra ngay. Mời ngài đưa ra chỉ thị!" }]);
  }, []);
  */
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [responseMode, setResponseMode] = useState<"socratic" | "direct" | "debate" | "auto">(() => {
    return (localStorage.getItem("agent3_response_mode") as "socratic" | "direct" | "debate" | "auto") || "auto";
  });
  const [responseLength, setResponseLength] = useState<"concise" | "detailed" | "super_detailed">(() => {
    return (localStorage.getItem("agent3_response_length") as "concise" | "detailed" | "super_detailed") || "detailed";
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleToggleResponseMode = (mode: "socratic" | "direct" | "debate" | "auto") => {
    setResponseMode(mode);
    localStorage.setItem("agent3_response_mode", mode);
    
    // Thêm thông báo đổi chế độ bằng thông điệp trang trọng vào chatbox
    let noticeText = "";
    if (mode === "direct") noticeText = "⚡ *Hệ thống: Đã chuyển sang chế độ Trực Diện.* Từ giờ tôi sẽ trả lời trực tiếp vấn đề trần trụi với sự tôn trọng, cấm tiệt phương pháp Socrates vòng vo!";
    else if (mode === "debate") noticeText = "⚔️ *Hệ thống: Đã chuyển sang chế độ Tranh Biện.* Tôi sẽ đóng vai kẻ phản biện (Devil's Advocate) gắt gao nhất, sẵn sàng vạch trần mọi sơ hở tư duy của ngài!";
    else if (mode === "auto") noticeText = "🧠 *Hệ thống: Đã bật Tier 1 Routing (Tự Động).* Tôi sẽ siêu phân tích yêu cầu của ngài và tự quyết định xem nên Gợi mở, Trực diện hay Tranh biện!";
    else noticeText = "🤔 *Hệ thống: Đã chuyển sang chế độ Gợi Mở.* Tôi sẽ sử dụng phương pháp triết học để ép ngài phải tự động não suy nghĩ!";
    setMessages(prev => [...prev, { role: "ai", text: noticeText }]);
  };

  const handleToggleResponseLength = (length: "concise" | "detailed" | "super_detailed") => {
    setResponseLength(length);
    localStorage.setItem("agent3_response_length", length);
  };


  const [existingSets, setExistingSets] = useState<any[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState({ front: "", back: "", ipa: "", example: "" });
  const [selectedSetId, setSelectedSetId] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");

  const [isCreateNewSet, setIsCreateNewSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [newSetSubject, setNewSetSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const user = store.getCurrentUser();

  useEffect(() => {
    if (!user) return;
    try {
      const unsub = onSnapshot(collection(db, "sets"), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data) {
            const isSystem = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"].includes(data.id);
            const isCreatedBySelf = data.createdBy === user.id;
            const isCreatedByTeacher = data.creatorRole === "teacher" || data.creatorRole === "Admin" || data.creatorRole === "admin";
            const isUserTeacher = user.role === "teacher" || user.role === "Admin" || user.role === "admin";
            
            if (!isSystem && (isCreatedBySelf || isUserTeacher || isCreatedByTeacher)) {
              list.push({
                id: docSnap.id,
                title: data.title || "Không có tiêu đề",
                subject: data.subject || "Chưa phân loại"
              });
            }
          }
        });
        setExistingSets(list);
      });
      return () => unsub();
    } catch (e) {
      console.error("Failed to sync sets in Agent3Widget:", e);
    }
  }, [user]);

  const parseAiTextToCard = (rawText: string) => {
    let front = "";
    let back = rawText;
    let ipa = "";
    let example = "";

    const boldMatch = rawText.match(/\*\*([^*]+)\*\*:\s*([\s\S]+)/);
    if (boldMatch) {
      front = boldMatch[1].trim();
      back = boldMatch[2].trim();
    } else {
      const boldMatch2 = rawText.match(/\*\*([^*]+)\*\*\s*-\s*([\s\S]+)/);
      if (boldMatch2) {
        front = boldMatch2[1].trim();
        back = boldMatch2[2].trim();
      }
    }

    const ipaMatch = back.match(/\/([^/]+)\//);
    if (ipaMatch) {
      ipa = ipaMatch[0].trim();
    }

    const exampleMatch = back.match(/(Ví dụ|Example|Eg):\s*([\s\S]+)/i);
    if (exampleMatch) {
      example = exampleMatch[2].trim();
    }

    return { front, back, ipa, example };
  };

  const handleSaveToSetClicked = (rawText: string, messageIndex?: number) => {
    const cardData = parseAiTextToCard(rawText);
    
    // We want the front of the created card to ALWAYS be the user's question, and back side is the AI's answer
    let userQuestion = "";
    if (messageIndex !== undefined && messageIndex > 0) {
      for (let j = messageIndex - 1; j >= 0; j--) {
        if (messages[j]?.role === "user") {
          userQuestion = messages[j].text;
          break;
        }
      }
    }

    if (userQuestion) {
      cardData.front = userQuestion.trim();
      cardData.back = rawText.trim();
    } else {
      if (!cardData.front) {
        cardData.front = "Câu hỏi từ Trợ lý AI";
      }
    }

    setEditingCard(cardData);
    
    // Tự động gợi ý tên bộ thẻ học mới siêu nhanh dựa vào khái niệm mặt trước
    const cleanFront = cardData.front ? cardData.front.trim().replace(/['"“”]/g, "").slice(0, 30) + (cardData.front.length > 30 ? "..." : "") : "";
    const suggestedTitle = cleanFront ? `Bộ học: ${cleanFront}` : "Bộ học mới";
    setNewSetTitle(suggestedTitle);
    setNewSetSubject("Gia sư AI");
    
    if (existingSets.length > 0) {
      setSelectedSetId(existingSets[0].id);
      setIsCreateNewSet(false);
    } else {
      setSelectedSetId("");
      setIsCreateNewSet(true);
    }
    
    setSearchQuery("");
    setSelectedCategory(null);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    setIsSaveModalOpen(true);
  };

  const handleQuickAddNode = (nodeLabel: string) => {
    const cardData = {
      front: nodeLabel.trim(),
      back: `Giải nghĩa chi tiết cho khái niệm: "${nodeLabel.trim()}"`,
      ipa: "",
      example: ""
    };
    setEditingCard(cardData);
    setNewSetTitle(`Sơ đồ: ${nodeLabel.trim()}`);
    setNewSetSubject("Gia sư AI");
    if (existingSets.length > 0) {
      setSelectedSetId(existingSets[0].id);
      setIsCreateNewSet(false);
    } else {
      setSelectedSetId("");
      setIsCreateNewSet(true);
    }
    setSearchQuery("");
    setSelectedCategory(null);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    setIsSaveModalOpen(true);
  };

  const handleSaveToSetConfirm = async () => {
    if (!editingCard.front.trim()) {
      setSaveErrorMsg("Khái niệm (Mặt trước) không được để trống!");
      return;
    }
    if (!editingCard.back.trim()) {
      setSaveErrorMsg("Giải nghĩa (Mặt sau) không được để trống!");
      return;
    }

    setSavingCard(true);
    setSaveErrorMsg("");
    setSaveSuccessMsg("");

    try {
      const cardSubject = isCreateNewSet 
        ? (newSetSubject.trim() || "Tự chọn")
        : (existingSets.find(s => s.id === selectedSetId)?.subject || "Tự chọn");

      const newCardObj = {
        id: uuidv4(),
        front: editingCard.front.trim(),
        back: editingCard.back.trim(),
        ipa: editingCard.ipa.trim(),
        example: editingCard.example.trim(),
        subject: cardSubject,
        mastery: 0,
        isHard: false,
        nextReview: Date.now(),
        nextReviewDate: Date.now(),
        repetitionCount: 0,
        isNewCard: true
      };

      if (isCreateNewSet) {
        if (!newSetTitle.trim()) {
          setSaveErrorMsg("Vui lòng nhập tên bộ thẻ học mới!");
          setSavingCard(false);
          return;
        }

        const deckId = `deck_user_${Date.now()}`;
        const newDeckObj = {
          id: deckId,
          title: newSetTitle.trim(),
          subject: newSetSubject.trim() || "Tự chọn",
          cards: [newCardObj]
        };

        await store.addDeck(newDeckObj);
        setSaveSuccessMsg(`🎉 Đã tạo bộ thẻ "${newSetTitle.trim()}" và thêm thẻ học thành công!`);
      } else {
        if (!selectedSetId) {
          setSaveErrorMsg("Vui lòng chọn một bộ thẻ học!");
          setSavingCard(false);
          return;
        }

        // IMPROVED: Safe local state sync via store.addDeck as well
        const currentDeck = store.getDeck(selectedSetId);
        if (currentDeck) {
          const updatedCards = [...(currentDeck.cards || []), newCardObj];
          await store.addDeck({
            ...currentDeck,
            cards: updatedCards
          });
        } else {
          // Fallback direct Firestore update
          const setRef = doc(db, "sets", selectedSetId);
          await updateDoc(setRef, {
            cards: arrayUnion(newCardObj)
          });
        }
        setSaveSuccessMsg("🎉 Đã lưu thẻ vào bộ flashcard thành công!");
      }

      setTimeout(() => {
        setIsSaveModalOpen(false);
        setEditingCard({ front: "", back: "", ipa: "", example: "" });
        setSelectedSetId("");
        setNewSetTitle("");
        setNewSetSubject("");
        setSaveSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      console.error("Error saving card to set:", err);
      setSaveErrorMsg(err?.message || "Không thể lưu thẻ, vui lòng thử lại!");
    } finally {
      setSavingCard(false);
    }
  };
  const { cooldownRemaining, startCooldown } = useAICooldown(user);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const executeSend = async (textToSend: string, customContext?: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    if (user && user.role === "student" && cooldownRemaining > 0) {
      setMessages(prev => [...prev, { role: "ai", text: `⏳ Bạn ơi, vui lòng đợi thêm ${cooldownRemaining} giây để đặt câu hỏi tiếp theo nhé!` }]);
      return;
    }
    
    setMessages(prev => [...prev, { role: "user", text: textToSend }]);
    setIsLoading(true);

    if (user && user.role === "student") {
      startCooldown();
    }

    try {
      const idToken = await auth.currentUser?.getIdToken() || "";
      const decks = store.getDecks();
      const baseContext = responseMode === "direct"
        ? "You are Agent 3 - Personal Assistant (Direct & Blunt Mode). STRICT RULES:\n" +
          "- BẮT BUỘC TRẢ LỜI TRỰC TIẾP: Tuyệt đối không dùng phương pháp Socratic, không gợi mở, không đặt ra dòng tư duy lặp lại. Cung cấp đáp án ngay lập tức.\n" +
          "- DIAGRAMS: KHÔNG ĐƯỢC tự ý vẽ mindmap/chart trừ khi người dùng ra lệnh rõ ràng bằng cú pháp: '/draw [chủ đề]'. Nếu không có lệnh này, chỉ trả lời bằng văn bản hoặc danh sách.\n" +
          "- FORMAT VẼ SƠ ĐỒ: Khi có lệnh '/draw', BẮT BUỘC sinh mã Mermaid.js bắt đầu bằng 'mindmap'. Dùng xuống dòng (\\n) và thụt lề 2-4 spaces. KHÔNG viết trên 1 dòng. QUAN TRỌNG: Mọi tiêu đề / nhãn dán của node MUST luôn được đặt trong ngoặc vuông và dấu ngoặc kép đôi, ví dụ: `id1[\"Khái niệm\"]`, `id2[\"Khái niệm sinh học (H2O)\"]`. Tuyệt đối bỏ qua dạng (( )) hoặc ( ).\n" +
          "- Student is studying. Deck info available."
        : "You are Agent 3 - Socrates AI Coach. STRICT RULES:\n" +
          "- TẬP TRUNG HỌC THUẬT: Tập trung mổ xẻ nội dung học thuật với mục tiêu cao nhất là người dùng phải hiểu rõ bản chất.\n" +
          "- DIAGRAMS: KHÔNG ĐƯỢC tự ý vẽ mindmap/chart trừ khi người dùng ra lệnh rõ ràng bằng cú pháp: '/draw [chủ đề]'. Nếu không có lệnh này, chỉ trả lời bằng văn bản hoặc danh sách.\n" +
          "- FORMAT VẼ SƠ ĐỒ: Khi có lệnh '/draw', BẮT BUỘC sinh mã Mermaid.js bắt đầu bằng 'mindmap'. Dùng xuống dòng (\\n) và thụt lề 2-4 spaces. KHÔNG viết trên 1 dòng. QUAN TRỌNG: Mọi tiêu đề / nhãn dán của node MUST luôn được đặt trong ngoặc vuông và dấu ngoặc kép đôi, ví dụ: `id1[\"Khái niệm\"]`, `id2[\"Khái niệm sinh học (H2O)\"]`. Tuyệt đối bỏ qua dạng (( )) hoặc ( ).\n" +
          "- Student is studying. Deck info available.";
      const context = customContext ? `${baseContext}\nCurrent Card Context: ${customContext}` : baseContext;

      if (textToSend.trim().toLowerCase().startsWith("/quiz")) {
        setMessages(prev => [...prev, { role: "ai", text: `Chức năng /quiz hiện tại đã được vô hiệu hóa để nâng cấp cấu hình mới.` }]);
        setIsLoading(false);
        return;
      }

      const res = await safeRequest("/api/agent3/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false"
        },
        body: JSON.stringify({ 
          message: textToSend, 
          history: messages.filter(m => !(m.role === "ai" && (m.text.includes("⏳") || m.text.includes("Tín hiệu bị nhiễu")))), 
          context, 
          sessionId, 
          mode: "chat",
          responseMode,
          responseLength: (user && user.argusEyesUntil && user.argusEyesUntil > Date.now()) ? "super_detailed" : responseLength
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 429) {
          const errMsg = typeof errData.error === 'string' ? errData.error : "Bạn đang gọi AI quá nhanh. Hãy chờ hoặc nạp năng lượng!";
          setMessages(prev => [...prev, { role: "ai", text: `⏳ ${errMsg}` }]);
          setIsLoading(false);
          return;
        }
        throw new Error(errData.message || (typeof errData.error === 'string' ? errData.error : "API Agent 3 lỗi"));
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.result }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "ai", text: error?.message || "Tín hiệu bị nhiễu do bão mặt trời (Error 500). Vui lòng thử lại." }]);
    }
    setIsLoading(false);
  };

  const handleSend = () => {
    executeSend(input);
    setInput("");
  };

  useEffect(() => {
    const handleTriggerAgent3 = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string, context: string }>;
      setIsOpen(true);
      if (customEvent.detail?.message && customEvent.detail?.context) {
         executeSend(customEvent.detail.message, customEvent.detail.context);
      }
    };
    window.addEventListener("trigger-agent3", handleTriggerAgent3);
    return () => window.removeEventListener("trigger-agent3", handleTriggerAgent3);
  }, [messages, isLoading, cooldownRemaining, sessionId, responseMode, responseLength]); // Dependencies needed because executeSend uses them

  return (
    <>
      <AnimatePresence>
      {!isOpen && (
        <motion.button 
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3 }}
          onClick={() => setIsOpen(true)}
          id="agent3-side-widget-anchor"
          className="fixed bottom-24 right-6 w-14 h-14 bg-orange-500 text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition z-50 group cursor-pointer"
        >
          <Bot className="w-6 h-6 group-hover:animate-bounce" />
        </motion.button>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/40 dark:bg-black/40 backdrop-blur-md z-40 transition-all duration-[350ms] ease-out"
            onClick={() => setIsOpen(false)}
          />
          <motion.div 
            layout
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={cn(
            "fixed z-50 flex flex-col bg-white/95 dark:bg-zinc-950/98 sm:bg-zinc-50/90 sm:dark:bg-zinc-950/90 backdrop-blur-md sm:backdrop-blur-none sm:glass rounded-none sm:rounded-2xl overflow-hidden shadow-2xl sm:border sm:border-zinc-200/50 dark:sm:border-white/[0.08]",
            isMaximized 
              ? "inset-0 sm:inset-auto sm:top-[10%] sm:left-[10%] sm:w-[80vw] sm:h-[80vh] sm:translate-x-0 sm:translate-y-0" 
              : "inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[550px]"
          )}>
            <div className="bg-orange-500 text-black p-4 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-2">
               <Bot className="w-5 h-5 animate-pulse" />
               <h3 className="font-bold tracking-tight text-zinc-950">Agent 3 - Socratic Coach</h3>
             </div>
             <div className="flex justify-end gap-1 items-center">
               <button 
                 onClick={() => setShowSettings(!showSettings)} 
                 className={cn("p-1.5 rounded-full transition cursor-pointer hover:bg-black/10", showSettings && "bg-black/25")}
                 title="Cài đặt hành vi"
               >
                 <Settings className="w-4 h-4" />
               </button>
               <button onClick={() => setIsMaximized(!isMaximized)} className="hover:bg-black/10 p-1.5 rounded-full transition cursor-pointer hidden sm:block">
                 {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
               </button>
               <button onClick={() => setIsOpen(false)} className="hover:bg-black/10 p-1.5 rounded-full transition cursor-pointer"><X className="w-5 h-5" /></button>
             </div>
           </div>

           {/* Behavior Settings Window */}
           {showSettings && (
             <div className="bg-orange-500/10 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200/50 dark:border-white/10 space-y-3 shrink-0 text-left animate-in slide-in-from-top duration-200">
               <div className="flex items-center justify-between">
                 <h4 className="text-[11px] font-extrabold uppercase text-orange-700 dark:text-orange-500 tracking-wider flex items-center gap-1.5">
                   ⚙️ Cài đặt hành vi Agent 3
                 </h4>
                 <button 
                   onClick={() => setShowSettings(false)} 
                   className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
                 >
                   Đóng
                 </button>
               </div>
               
               <div className="space-y-3">
                 <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                     Độ chi tiết:
                   </span>
                   <div className="grid grid-cols-3 gap-1 bg-zinc-200/55 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-300/30">
                     <button
                       onClick={() => handleToggleResponseLength("concise")}
                       className={cn(
                         "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                         responseLength === "concise"
                           ? "bg-orange-500 text-black shadow-xs"
                           : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                       )}
                       title="Súc tích - Trả lời 1-3 câu siêu ngắn gọn"
                     >
                       Súc tích
                     </button>
                     <button
                       onClick={() => handleToggleResponseLength("detailed")}
                       className={cn(
                         "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                         responseLength === "detailed"
                           ? "bg-orange-500 text-black shadow-xs"
                           : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                       )}
                       title="Chi tiết - Giải thích 200-300 chữ kèm ví dụ"
                     >
                       Chi tiết
                     </button>
                     <button
                       onClick={() => handleToggleResponseLength("super_detailed")}
                       className={cn(
                         "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                         responseLength === "super_detailed"
                           ? "bg-orange-500 text-black shadow-xs"
                           : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                       )}
                       title="Siêu chi tiết - Phân tích sâu sắc cặn kẽ 100%"
                     >
                       Siêu chi tiết
                     </button>
                   </div>
                 </div>

                 
               </div>
             </div>
           )}

          {/* Mode Switcher Bar */}
          <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200/50 dark:border-white/10 flex justify-between items-center shrink-0 text-left">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              Chế độ trả lời:
            </span>
            <div className="flex bg-zinc-200/60 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-300/30">
              <button
                onClick={() => handleToggleResponseMode("auto")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                  responseMode === "auto"
                    ? "bg-purple-500 text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                title="Tự động (Auto) - Tier 1 Router sẽ phân tích ngữ cảnh"
              >
                Auto 🧠
              </button>
              <button
                onClick={() => handleToggleResponseMode("socratic")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                  responseMode === "socratic"
                    ? "bg-orange-500 text-black shadow-xs"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                title="Gợi mở (Socrates) - Đặt câu hỏi gợi ý để bạn tự suy luận"
              >
                Gợi mở 🤔
              </button>
              <button
                onClick={() => handleToggleResponseMode("direct")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                  responseMode === "direct"
                    ? "bg-orange-500 text-black shadow-xs"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                title="Trực diện (Direct) - Trả lời thẳng vào câu hỏi trực tiếp"
              >
                Trực diện ⚡
              </button>
              <button
                onClick={() => handleToggleResponseMode("debate")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                  responseMode === "debate"
                    ? "bg-orange-500 text-black shadow-xs"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                title="Tranh biện (Debate) - Đóng vai phản biện sắc bén"
              >
                Tranh biện ⚔️
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative overflow-y-auto p-4 space-y-4 bg-zinc-50/90 dark:bg-zinc-950/40 sm:bg-transparent sm:dark:bg-transparent">
             <AnimatePresence>
             {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={i} 
                  className={cn(
                    "flex flex-col gap-1 max-w-[85%] relative z-10",
                    m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl break-words transition-all duration-300 relative z-10 w-full", 
                    m.role === "user" ? "bg-orange-500/30 dark:bg-orange-500/20 rounded-tr-none text-zinc-900 dark:text-zinc-100" : "bg-zinc-200/50 dark:bg-white/10 rounded-tl-none text-zinc-800 dark:text-zinc-200",
                    isMaximized ? "text-lg" : "text-sm"
                  )}>
                     <ReactMarkdown 
                       remarkPlugins={[remarkMath]} 
                       rehypePlugins={[rehypeKatex]}
                       components={{
                         code({ className, children, ...props }: any) {
                           const match = /language-(\w+)/.exec(className || '');
                           const codeContent = String(children).replace(/\n$/, '');
                           const isMermaid = (match && match[1] === 'mermaid') || codeContent.trim().startsWith('mindmap') || codeContent.trim().startsWith('graph ') || codeContent.trim().startsWith('flowchart ');
                           if (isMermaid) {
                             return <MermaidRenderer code={codeContent} onAddCard={handleQuickAddNode} />;
                           }
                           return (
                             <code className={cn(className, "bg-zinc-100 dark:bg-zinc-900 rounded px-1.5 py-0.5 font-mono text-xs text-orange-600 dark:text-orange-400")} {...props}>
                               {children}
                             </code>
                           );
                         }
                       }}
                     >
                       {preprocessMessageText(m.text)}
                     </ReactMarkdown>
                  </div>
                  {m.role === "ai" && (
                    <button
                      onClick={() => handleSaveToSetClicked(m.text, i)}
                      className="text-[11px] text-orange-600 dark:text-orange-400 font-extrabold flex items-center gap-1 mt-1 hover:underline self-start pl-1 cursor-pointer transition duration-200"
                    >
                      <Plus className="w-3 h-3" /> Thêm vào bộ thẻ
                    </button>
                  )}
                </motion.div>
             ))}
             </AnimatePresence>
             
             <AnimatePresence>
             {isLoading && (
                <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9, y: 5 }}
                   className="bg-zinc-200/50 dark:bg-white/10 p-3 rounded-xl rounded-tl-none w-fit relative z-10"
                >
                   <div className="flex gap-1.5 h-4 items-center justify-center">
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1.5 h-1.5 bg-orange-500 rounded-full"></motion.div>
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} className="w-1.5 h-1.5 bg-orange-500 rounded-full"></motion.div>
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} className="w-1.5 h-1.5 bg-orange-500 rounded-full"></motion.div>
                   </div>
                </motion.div>
             )}
             </AnimatePresence>
             
             {/* Glassmorphic Placeholder State for Cooldown Energy Charging */}
             {cooldownRemaining > 0 && (
                <div className="absolute inset-0 z-20 bg-zinc-50/40 dark:bg-zinc-950/40 backdrop-blur-sm transition-all duration-500 flex flex-col items-center justify-center p-4">
                   <div className="glass px-6 py-4 flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300 border border-orange-500/20">
                     <div className="relative w-12 h-12 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
                        <svg className="absolute inset-0 w-12 h-12 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray="289" strokeDashoffset={289 - (289 * (10 - cooldownRemaining)) / 10} className="text-orange-500 transition-all duration-1000 ease-linear" />
                        </svg>
                        <Bot className="w-5 h-5 text-orange-500 animate-pulse relative z-10" />
                     </div>
                     <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 italic font-sans flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Sạc năng lượng hệ thống...</span>
                   </div>
                </div>
             )}
             
             <div ref={messagesEndRef} className="h-4 w-full" />
          </div>

          <div className="p-4 sm:p-3 border-t border-zinc-200/50 dark:border-white/10 bg-zinc-100/90 dark:bg-zinc-900/60 sm:bg-zinc-50/50 sm:dark:bg-white/5 sticky bottom-0 pb-8 sm:pb-3 shrink-0">
            <div className="flex gap-2 items-center bg-zinc-200/40 dark:bg-zinc-800/40 border border-zinc-300/60 dark:border-zinc-700/60 rounded-xl px-2.5 py-1.5 shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-all">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                disabled={cooldownRemaining > 0}
                placeholder={cooldownRemaining > 0 ? `Chờ ${cooldownRemaining}s...` : "Hỏi Gia sư Socrates..."}
                className={cn(
                  "flex-1 bg-transparent border-none focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 transition-all duration-300 min-w-0",
                  cooldownRemaining > 0 && "opacity-50 cursor-not-allowed",
                  isMaximized ? "text-lg py-1" : "text-sm py-0.5"
                )}
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim() || cooldownRemaining > 0}
                className="p-1.5 bg-orange-500 text-black rounded-lg disabled:opacity-50 hover:bg-orange-600 transition cursor-pointer flex items-center justify-center shrink-0 w-8 h-8"
                title={cooldownRemaining > 0 ? `Đang trong cooldown 10s (Còn lại ${cooldownRemaining}s)` : "Gửi"}
              >
                {cooldownRemaining > 0 ? (
                  <span className="text-[10px] font-black font-mono text-zinc-900">{cooldownRemaining}s</span>
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
        </>
      )}
      </AnimatePresence>

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col space-y-4 animate-in zoom-in-95 relative text-left">
            <button 
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-display font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" /> Thêm thẻ học mới
            </h3>

            {saveErrorMsg && (
              <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-500/20 font-medium">
                ⚠️ {saveErrorMsg}
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-xl border border-green-500/20 font-medium">
                {saveSuccessMsg}
              </div>
            )}

            {/* Toggle Tab chuyển đổi giữa thêm vào bộ sẵn có và tạo bộ mới */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800/40 p-1 rounded-xl gap-1 border border-zinc-200/55 dark:border-zinc-850">
              <button
                type="button"
                onClick={() => {
                  if (existingSets.length > 0) {
                    setIsCreateNewSet(false);
                  } else {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('toast-dispatch', { detail: "Ngài chưa có bộ thẻ học cá nhân nào! Hãy dùng tùy chọn 'Tạo Bộ Mới Tinh' bên dưới nhé." }));
                    }
                  }
                }}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                  !isCreateNewSet 
                    ? "bg-orange-500 text-zinc-900 shadow-xs" 
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                Bộ Thẻ Có Sẵn
              </button>
              <button
                type="button"
                onClick={() => setIsCreateNewSet(true)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                  isCreateNewSet 
                    ? "bg-orange-500 text-zinc-900 shadow-xs" 
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                <FolderPlus className="w-3.5 h-3.5" /> Tạo Bộ Mới Tinh
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bộ Thẻ Mục Tiêu *</label>
                {existingSets.length === 0 ? (
                  <div className="text-xs text-red-500 dark:text-red-400 font-bold mt-1 bg-red-500/5 p-2 rounded-lg border border-red-500/15 max-w-xs break-words">
                    Ngài chưa có bộ thẻ học cá nhân nào. Hệ thống đã kích hoạt chế độ "Tạo Bộ Mới Tinh" bên dưới để hỗ trợ ngài!
                  </div>
                ) : !isCreateNewSet ? (
                  <div className="space-y-2.5 mt-1 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 animate-in fade-in-30">
                    {/* Search set input and optionally Selected Target Deck state header */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="🔍 Tìm tên bộ thẻ học..."
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          if (e.target.value !== "") {
                            // Clear selected category to show search results comfortably
                            setSelectedCategory(null);
                          }
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-orange-500/55 transition"
                      />
                      {selectedCategory && !searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          className="px-2 py-1 text-[10px] uppercase font-bold bg-zinc-200 dark:bg-zinc-750 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition text-zinc-600 dark:text-zinc-300 shrink-0 cursor-pointer"
                        >
                          ⬅️ Quay Lại
                        </button>
                      )}
                    </div>

                    {/* Active Selected Set indicator */}
                    {selectedSetId ? (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/15 flex justify-between items-center animate-in slide-in-from-top-1 duration-150">
                        <span className="truncate">📍 Đã chọn: {existingSets.find(s => s.id === selectedSetId)?.title || "Chưa xác định"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSetId("");
                          }}
                          className="text-[9px] font-black text-rose-500 uppercase hover:underline ml-2 shrink-0 cursor-pointer"
                        >
                          XÓA CHỌN
                        </button>
                      </div>
                    ) : (
                      <div className="text-[9px] text-orange-600 dark:text-orange-400 font-bold bg-orange-500/5 p-2 rounded-lg border border-orange-500/10 animate-in fade-in">
                        👋 Ngài chưa chọn bộ thẻ nào cả! Hãy tích chọn 1 bộ học ở danh sách bên dưới:
                      </div>
                    )}

                    {/* List area with fixed height and scroll bar */}
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {searchQuery.trim() !== "" ? (
                        /* Flattened Search Results mode */
                        (() => {
                          const matched = existingSets.filter(s =>
                            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.subject || "").toLowerCase().includes(searchQuery.toLowerCase())
                          );
                          if (matched.length === 0) {
                            return <div className="text-center py-4 text-zinc-400 text-[11px]">Không tìm thấy bộ thẻ nào khớp với từ khoá 😢</div>;
                          }
                          return matched.map(set => (
                            <button
                              key={set.id}
                              type="button"
                              onClick={() => {
                                setSelectedSetId(set.id);
                                setIsCreateNewSet(false);
                              }}
                              className={cn(
                                "w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-1.5 cursor-pointer text-xs",
                                selectedSetId === set.id
                                  ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400"
                                  : "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 border-zinc-150 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300"
                              )}
                            >
                              <span className="font-bold truncate">{set.title}</span>
                              <span className="text-[8px] uppercase font-black px-1 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 rounded shrink-0">{set.subject || "Chưa phân loại"}</span>
                            </button>
                          ));
                        })()
                      ) : selectedCategory ? (
                        /* Inside a selected Category */
                        (() => {
                          const categorySets = existingSets.filter(s => (s.subject || "Chưa phân loại") === selectedCategory);
                          return (
                            <div className="space-y-1">
                              <div className="text-[9px] uppercase font-black text-zinc-400 tracking-wider mb-1 flex items-center justify-between">
                                <span>Chuyên mục: {selectedCategory}</span>
                                <button type="button" onClick={() => setSelectedCategory(null)} className="text-orange-500 hover:underline cursor-pointer">📂Xem các chủ đề khác</button>
                              </div>
                              {categorySets.map(set => (
                                <button
                                  key={set.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSetId(set.id);
                                    setIsCreateNewSet(false);
                                  }}
                                  className={cn(
                                    "w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-1.5 cursor-pointer text-xs",
                                    selectedSetId === set.id
                                      ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400"
                                      : "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 border-zinc-150 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300"
                                  )}
                                >
                                  <span className="font-bold truncate">{set.title}</span>
                                  {selectedSetId === set.id && <span className="text-emerald-500 font-bold shrink-0">✓ đang chọn</span>}
                                </button>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        /* Categories List / Accordions main mode */
                        (() => {
                          const categoryCounts: Record<string, number> = {};
                          existingSets.forEach(s => {
                            const sub = s.subject || "Chưa phân loại";
                            categoryCounts[sub] = (categoryCounts[sub] || 0) + 1;
                          });

                          return Object.entries(categoryCounts).map(([cat, count]) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className="w-full text-left p-2 rounded-lg border bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 border-zinc-150 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-between cursor-pointer group text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-sm shrink-0">📂</span>
                                <span className="font-bold truncate group-hover:text-orange-500">{cat}</span>
                              </div>
                              <span className="text-[9px] font-mono bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500 shrink-0 font-bold">
                                {count} bộ thẻ
                              </span>
                            </button>
                          ));
                        })()
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-orange-500 dark:text-orange-400 font-bold mt-1 bg-orange-500/5 p-2 rounded-lg border border-orange-500/10 max-w-xs animate-in slide-in-from-top-1">
                    ✨ Đang ở chế độ tạo bộ mới dẫu vậy có thể đổi ý bằng tab bên trên!
                  </div>
                )}
              </div>

              {isCreateNewSet && (
                <div className="space-y-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/15 animate-in slide-in-from-top-1 duration-200">
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Tên Bộ Thẻ Học Mới *</label>
                    <input
                      type="text"
                      placeholder="ví dụ: Từ vựng Gia sư Socrates..."
                      value={newSetTitle}
                      onChange={e => setNewSetTitle(e.target.value)}
                      disabled={savingCard}
                      className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Môn Học / Chủ Đề (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="ví dụ: English, Triết học, Tech..."
                      value={newSetSubject}
                      onChange={e => setNewSetSubject(e.target.value)}
                      disabled={savingCard}
                      className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Khái niệm / Mặt trước *</label>
                <input
                  type="text"
                  placeholder="Nhập thuật ngữ, từ vựng hoặc câu hỏi..."
                  value={editingCard.front}
                  onChange={e => setEditingCard({ ...editingCard, front: e.target.value })}
                  disabled={savingCard}
                  className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Giải nghĩa / Mặt sau *</label>
                <textarea
                  rows={4}
                  placeholder="Nhập phần giải nghĩa, định nghĩa hoặc câu trả lời..."
                  value={editingCard.back}
                  onChange={e => setEditingCard({ ...editingCard, back: e.target.value })}
                  disabled={savingCard}
                  className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Phần phiên âm (Phụ)</label>
                  <input
                    type="text"
                    placeholder="ví dụ: /heˈnoʊ.sɪs/"
                    value={editingCard.ipa}
                    onChange={e => setEditingCard({ ...editingCard, ipa: e.target.value })}
                    disabled={savingCard}
                    className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Ví dụ minh họa (Phụ)</label>
                  <textarea
                    rows={1}
                    placeholder="Đặt câu mẫu..."
                    value={editingCard.example}
                    onChange={e => setEditingCard({ ...editingCard, example: e.target.value })}
                    disabled={savingCard}
                    className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                disabled={savingCard}
                className="flex-1 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition border border-zinc-200 dark:border-zinc-700 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveToSetConfirm}
                disabled={savingCard || (!isCreateNewSet && existingSets.length === 0)}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black hover:bg-orange-600 text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingCard ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                  </>
                ) : (
                  "Xác nhận lưu"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface MindmapNode {
  id: string;
  label: string;
  depth: number;
  shape: "circle" | "rounded" | "square" | "default";
  children: MindmapNode[];
}

function parseMermaidMindmap(text: string): MindmapNode | null {
  if (!text) return null;
  
  let workingText = text;
  if (!workingText.trim().includes("mindmap")) {
    const idx = workingText.indexOf("mindmap");
    if (idx !== -1) {
      workingText = workingText.substring(idx);
    }
  }

  const lines = workingText.split("\n");
  const nodes: MindmapNode[] = [];
  
  // Tìm điểm bắt đầu mindmap
  let startIndex = lines.findIndex(l => l.trim().startsWith("mindmap"));
  if (startIndex === -1) {
    startIndex = 0; // Fallback
  } else {
    startIndex += 1;
  }
  
  const contentLines = lines.slice(startIndex);
  let idCounter = 0;

  for (let line of contentLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Đếm số khoảng trắng thụt lề
    const leadingSpaces = line.search(/\S/);
    if (leadingSpaces === -1) continue;
    
    let label = trimmed;
    let shape: MindmapNode["shape"] = "default";
    
    // Match optional ID prefix followed by shape brackets
    const match = trimmed.match(/^(?:[a-zA-Z0-9_\-]+)?(\(\(|\[\[|\(|\{|\[)(.+?)(\)\)|\]\]|\)|\}|\])$/);
    if (match) {
      const startBracket = match[1];
      let innerText = match[2].trim();
      
      // Bỏ ngoặc kép nếu AI sinh ra
      if ((innerText.startsWith('"') && innerText.endsWith('"')) || (innerText.startsWith("'") && innerText.endsWith("'"))) {
         innerText = innerText.substring(1, innerText.length - 1).trim();
      }
      
      label = innerText;
      if (startBracket === "((") shape = "circle";
      else if (startBracket === "[" || startBracket === "[[") shape = "square";
      else if (startBracket === "(" || startBracket === "{") shape = "rounded";
    } else {
      // Trường hợp thuần chữ (không bọc ngoặc)
      label = trimmed;
    }
    
    const node: MindmapNode = {
      id: `node_${idCounter++}`,
      label,
      depth: leadingSpaces,
      shape,
      children: []
    };
    
    nodes.push(node);
  }

  // --- HỆ THỐNG TỰ ĐỘNG KHÔI PHỤC KHI GẶP SƠ ĐỒ ĐƠN DÒNG / PHẲNG KHÔNG LÙI ĐẦU DÒNG ---
  // Trường hợp không có dòng nào được phân tách hợp lệ hoặc tất cả các nút đều có độ sâu bằng 0 (phẳng)
  if (nodes.length === 0 || nodes.every(n => n.depth === 0)) {
    // Trích xuất tất cả các khối có ngoặc dạng ((Label)), (Label), [Label] hoặc văn bản chữ
    const blockRegex = /\(\([^\)]+\)\)|\([^\)]+\)|\[[^\]]+\]|[a-zA-Z0-9_À-ỹ\s→\-+*\/=]+/g;
    const rawMatches = workingText.match(blockRegex) || [];
    
    const parsedBlocks: { label: string; shape: MindmapNode["shape"] }[] = [];
    for (let match of rawMatches) {
      const trimmedMatch = match.trim();
      if (!trimmedMatch || trimmedMatch === "mindmap") continue;
      
      let label = trimmedMatch;
      let shape: MindmapNode["shape"] = "default";
      
      if (trimmedMatch.startsWith("((") && trimmedMatch.endsWith("))")) {
        label = trimmedMatch.substring(2, trimmedMatch.length - 2).trim();
        shape = "circle";
      } else if (trimmedMatch.startsWith("(") && trimmedMatch.endsWith(")")) {
        label = trimmedMatch.substring(1, trimmedMatch.length - 1).trim();
        shape = "rounded";
      } else if (trimmedMatch.startsWith("[") && trimmedMatch.endsWith("]")) {
        label = trimmedMatch.substring(1, trimmedMatch.length - 1).trim();
        shape = "square";
      }
      
      parsedBlocks.push({ label, shape });
    }

    if (parsedBlocks.length > 0) {
      nodes.length = 0;
      idCounter = 0;
      
      // Khối đầu tiên làm Gốc (Root)
      const rootBlock = parsedBlocks[0];
      const rootNode: MindmapNode = {
        id: `node_${idCounter++}`,
        label: rootBlock.label,
        depth: 0,
        shape: rootBlock.shape,
        children: []
      };
      nodes.push(rootNode);

      // Phân bổ các khái niệm còn lại thành các nhánh con phân lớp
      // Nhóm thông minh: mỗi khi gặp dạng nút tròn/bo tròn hoặc hết chu kì 4 nút, tạo một nhánh con chính mới
      let currentSubRoot = rootNode;
      for (let i = 1; i < parsedBlocks.length; i++) {
        const b = parsedBlocks[i];
        const isNewBranch = b.shape === "circle" || b.shape === "rounded" || i === 1 || i % 4 === 1;
        
        if (isNewBranch) {
          const branch: MindmapNode = {
            id: `node_${idCounter++}`,
            label: b.label,
            depth: 2,
            shape: b.shape,
            children: []
          };
          rootNode.children.push(branch);
          currentSubRoot = branch;
        } else {
          const child: MindmapNode = {
            id: `node_${idCounter++}`,
            label: b.label,
            depth: 4,
            shape: b.shape,
            children: []
          };
          currentSubRoot.children.push(child);
        }
      }
      return rootNode;
    }
  }

  if (nodes.length === 0) return null;
  
  const root = nodes[0];
  const stack: MindmapNode[] = [root];
  
  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }
    
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      root.children.push(node);
      stack.push(node);
    }
  }
  
  return root;
}

const MermaidRenderer = ({ code, onAddCard }: { code: string; onAddCard: (text: string) => void }) => {
  const [activeTab, setActiveTab] = React.useState<"interactive" | "image" | "code">("image");
  const [copied, setCopied] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // Parse mindmap sang cây cấu trúc
  const parsedRoot = useMemo(() => {
    try {
      return parseMermaidMindmap(code);
    } catch (e) {
      console.error("Failed to parse local mindmap", e);
      return null;
    }
  }, [code]);

  // Sinh URL Mermaid.ink
  const imageUrl = useMemo(() => {
    try {
      let cleaned = code.trim();
      const utf8Bytes = new TextEncoder().encode(cleaned);
      let base64 = "";
      for (let i = 0; i < utf8Bytes.length; i++) {
        base64 += String.fromCharCode(utf8Bytes[i]);
      }
      const encoded = btoa(base64);
      return `https://mermaid.ink/svg/${encoded}`;
    } catch (err) {
      console.error("Error generating Mermaid.ink URL", err);
      return null;
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render các node lồng nhau đẹp mắt của mindmap
  const renderInteractiveNode = (node: MindmapNode, depth = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    
    const shapeClasses = cn(
      "px-3 py-1.5 text-xs font-bold transition-all shadow-sm rounded-xl cursor-pointer flex items-center justify-between border select-none max-w-xs sm:max-w-md",
      node.shape === "circle" 
        ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/35 hover:bg-orange-500/25 active:scale-95"
        : node.shape === "square"
        ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700/80 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 active:scale-95"
        : "bg-orange-500/5 text-orange-800 dark:text-orange-300 border-orange-500/20 dark:border-orange-500/15 hover:bg-orange-500/10 active:scale-95"
    );

    return (
      <div key={node.id} className="flex flex-col items-start pl-4 border-l border-zinc-200 dark:border-zinc-800/80 my-1.5 py-1 relative w-full">
        <div className="absolute left-0 top-[1.1rem] w-3 border-t border-zinc-200 dark:border-zinc-800/80" />
        
        <div className="flex items-center gap-1.5 relative z-10 max-w-full group/node">
          <div className={shapeClasses} onClick={() => onAddCard(node.label)}>
            <span className="truncate">{node.label}</span>
          </div>
          
          <button
            onClick={() => onAddCard(node.label)}
            className="w-5 h-5 rounded-full bg-zinc-200/80 hover:bg-orange-500 dark:bg-zinc-850 dark:hover:bg-orange-500 hover:text-black text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-all cursor-pointer text-[10px] shrink-0 opacity-0 group-hover/node:opacity-100 focus:opacity-100"
            title="Thêm nhanh khái niệm này vào bộ thẻ học"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {hasChildren && (
          <div className="mt-1.5 space-y-1.5 w-full">
            {node.children.map(child => renderInteractiveNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="my-4 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-white/40 dark:bg-zinc-950/20 shadow-md relative w-full">
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-100/50 dark:bg-zinc-900/30 border-b border-zinc-200/50 dark:border-zinc-850/80 relative z-20">
        <span className="text-[10px] font-black tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          SƠ ĐỒ TƯ DUY AI
        </span>
        
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 border-r border-zinc-300 dark:border-zinc-700 pr-2">
            {imageUrl && !imageError && (
              <button 
                onClick={() => {
                  fetch(imageUrl)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mindmap-${Date.now()}.svg`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    })
                    .catch(err => {
                       console.error("Lỗi khi tải ảnh Mermaid", err);
                       window.open(imageUrl, '_blank');
                    });
                }}
                className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded transition-colors text-zinc-500 dark:text-zinc-400 cursor-pointer flex items-center gap-1"
                title="Tải ảnh (SVG)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold hidden sm:inline">Tải Ảnh</span>
              </button>
            )}
            <button 
              onClick={() => {
                const blob = new Blob([code], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `mindmap-${Date.now()}.mermaid`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded transition-colors text-zinc-500 dark:text-zinc-400 cursor-pointer flex items-center gap-1"
              title="Tải mã Mermaid"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold hidden sm:inline">Tải Mã</span>
            </button>
          </div>
        
          <div className="flex bg-zinc-200/50 dark:bg-zinc-850/80 p-0.5 rounded-lg shrink-0">
          {parsedRoot && (
            <button
              onClick={() => setActiveTab("interactive")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
                activeTab === "interactive" 
                  ? "bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              Phân rã
            </button>
          )}
          {imageUrl && !imageError && (
            <button
              onClick={() => setActiveTab("image")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
                activeTab === "image" 
                  ? "bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              Sơ đồ
            </button>
          )}
          <button
            onClick={() => setActiveTab("code")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
              activeTab === "code" 
                ? "bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            Mã
          </button>
        </div>
        </div>
      </div>

      <div className="p-3 overflow-x-auto min-h-[100px] flex items-center justify-start max-w-full">
        {activeTab === "interactive" && parsedRoot && (
          <div className="w-full text-left scale-95 sm:scale-100 origin-left max-w-full">
            {renderInteractiveNode(parsedRoot)}
          </div>
        )}

        {activeTab === "image" && imageUrl && !imageError && (
          <div className="w-full flex items-center justify-center p-2 min-h-[150px] bg-white rounded-lg">
            <img 
              src={imageUrl} 
              alt="Mermaid mindmap graph" 
              className="max-h-[300px] object-contain transition-opacity duration-350"
              onError={() => {
                setImageError(true);
                setActiveTab("code");
              }}
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {activeTab === "code" && (
          <div className="w-full text-left relative">
            <pre className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto p-2 bg-zinc-100/40 dark:bg-zinc-900/40 rounded-xl max-w-full whitespace-pre-wrap">
              {code}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-[10px] bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-350 px-2 py-0.5 rounded font-bold cursor-pointer transition"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
