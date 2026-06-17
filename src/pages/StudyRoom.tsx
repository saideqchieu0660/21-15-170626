import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { store, Flashcard, Deck } from "../lib/store";
import localforage from "localforage";
import { getOfflineDeck, saveDeckOffline, deleteOfflineDeck, isDeckSavedOffline } from '../utils/offlineDb';
import {
  Check,
  X,
  RefreshCcw,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Edit3,
  Sparkles,
  Volume2,
  VolumeX,
  Type,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Play,
  Pause,
  Clock,
  BellPlus,
  Trash2,
  Plus,
  AlertCircle,
  BarChart3,
  Activity as ActivityIcon,
  Download,
  Bot,
  Network,
  Eye,
  Share2,
} from "lucide-react";
import {
  playFlipSound,
  playCorrectSound,
  playIncorrectSound,
  toggleMute,
  getIsMuted,
  initAudio,
} from "../lib/audio";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import { useAICooldown } from "../lib/cooldown";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion } from "motion/react";
import { triggerCelebration } from "../lib/celebration";
import { v4 as uuidv4 } from "uuid";
import { db, auth, FirebaseListenerManager } from "../lib/firebase";
import { doc, onSnapshot, collection, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const MOTIVATION_QUOTES = [
  "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult. - Seneca",
  "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius",
  "You have power over your mind - not outside events. - Marcus Aurelius",
  "Luck is what happens when preparation meets opportunity. - Seneca",
];

// Confetti component removed

import { useSoundContext } from "../components/SoundProvider";
import { GlobalActivityFeed } from "../components/GlobalActivityFeed";
import { VirtualizedFlashcardList } from "../components/VirtualizedFlashcardList";
import { useTheme } from "../components/ThemeProvider";

export function detectLanguage(text: string): { isAvailable: boolean; locale: 'en-US' | 'vi-VN' | '' } {
  if (!text) return { isAvailable: false, locale: '' };
  
  // Clean up code/LaTeX/symbols and Markdown markers
  const clean = text
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[\s\S]*?\$/g, '')
    .replace(/[*_#`\\[\]]/g, "")
    .trim();
    
  if (!clean) return { isAvailable: false, locale: '' };

  // Check if there are any alphabet letters
  const hasLetters = /[a-zA-Záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(clean);
  if (!hasLetters) return { isAvailable: false, locale: '' };

  // Check for foreign scripts we do not support
  const hasOtherScripts = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff]/i.test(clean);
  if (hasOtherScripts) return { isAvailable: false, locale: '' };

  // Vietnamese diacritics
  const hasViDiacritics = /[áàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(clean);
  if (hasViDiacritics) {
    return { isAvailable: true, locale: 'vi-VN' };
  }

  // English letters
  const hasEnLetters = /[a-zA-Z]/.test(clean);
  if (hasEnLetters) {
    return { isAvailable: true, locale: 'en-US' };
  }

  return { isAvailable: false, locale: '' };
}

const ParsedTextContent = ({ text }: { text: string }) => {
  if (!text) return <span className="opacity-50">Chưa có nội dung</span>;

  const isSemicolonSeparated = text.includes(";") && !text.includes("\n\n");
  const isDashSeparated =
    text.includes("-") &&
    !text.includes("\n") &&
    !text.includes(";") &&
    text.split("-").length >= 2 &&
    text.length < 300;

  if (isSemicolonSeparated || isDashSeparated) {
    const separator = isSemicolonSeparated ? ";" : "-";
    const parts = text
      .split(separator)
      .map((p) => p.trim())
      .filter(Boolean);

    // Smart detection of Vietnamese/English on the first part
    const firstPart = parts[0] || "";
    const hasViAccent = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵĐ]/i.test(firstPart);
    const hasViStopwords = /\b(la|bi|duoc|cua|va|hoac|cho|trong|mot|nhu|voi|nhung|co|khong|de|nay|kia|tren|duoi|trai|phai|nay|kia|ay|la|ma|vi)\b/i.test(firstPart);
    const isFirstPartEnglish = !hasViAccent && !hasViStopwords;

    return (
      <div className="space-y-3 text-left w-full px-1 sm:px-2">
        {parts.map((p, i) => {
          const labelIcon = i === 0
            ? (isFirstPartEnglish ? "🇬🇧" : "🇻🇳")
            : i === 1
              ? "🇻🇳"
              : "💡";

          const labelText = i === 0
            ? (isFirstPartEnglish ? "Định nghĩa (English)" : "Nghĩa chính (Tiếng Việt)")
            : i === 1
              ? (isFirstPartEnglish ? "Nghĩa (Tiếng Việt)" : "Nét nghĩa khác (Tiếng Việt)")
              : "Phân tích / Ví dụ";

          return (
            <div
              key={i}
              className={cn(
                "p-3 rounded-xl border shadow-sm transition-all",
                i === 0
                  ? "bg-blue-500/10 border-blue-500/30"
                  : i === 1
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-bold opacity-80 mb-1.5 uppercase tracking-wider flex items-center gap-1.5",
                  i === 0
                    ? "text-blue-600 dark:text-blue-400"
                    : i === 1
                      ? "text-green-600 dark:text-green-400"
                      : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                <span className="text-sm">
                  {labelIcon}
                </span>
                {labelText}
              </p>
              <p
                className={cn(
                  "text-base md:text-lg leading-relaxed",
                  i === 0
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : i === 1
                      ? "font-medium text-zinc-800 dark:text-zinc-200"
                      : "italic opacity-90 text-zinc-700 dark:text-zinc-300 text-sm md:text-base",
                )}
              >
                {p}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default function StudyRoom() {
  const navigate = useNavigate();
  const { isFixLagEnabled } = useTheme();
  const { isSoundEnabled, toggleSound } = useSoundContext();
  useEffect(() => {
    document.title = "Henosis - Study Room";
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const user = store.getCurrentUser();
  const isAdminMode = sessionStorage.getItem('isAdminMode') !== 'false' && 
                      (user?.role === "admin" || user?.role === "Admin" || user?.role === "teacher");
  const homePath = isAdminMode ? "/teacher" : "/dashboard";
  const handleBack = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(homePath);
    }
  };
  const { cooldownRemaining, startCooldown } = useAICooldown(user);
  const { deckId: rawDeckId } = useParams();
  const deckId = rawDeckId ? decodeURIComponent(rawDeckId) : "";
  const [isLoading, setIsLoading] = useState(true);
  const [rawDeck, setRawDeck] = useState<any>(() =>
    store.getDeck(deckId),
  );
  const [personalCardStates, setPersonalCardStates] = useState<any[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Quick Notes Scratchpad states
  const [scratchpadText, setScratchpadText] = useState("");
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [lastNotesSavedTime, setLastNotesSavedTime] = useState<string | null>(null);

  useEffect(() => {
    const handleSync = () => {
      if (deckId) {
        setRawDeck(store.getDeck(deckId));
      }
    };
    window.addEventListener("henosis-data-synced", handleSync);
    return () => window.removeEventListener("henosis-data-synced", handleSync);
  }, [deckId]);

  // 1. Listen to raw deck structure in real-time
  const unsubDeckRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    setIsLoading(true);
    if (!deckId || !user) return;

    // Check offline saved state and load immediately if offline
      isDeckSavedOffline(deckId).then(setIsOfflineSaved);
      
      if (!navigator.onLine) {
        if (deckId === "daily-quest") {
          localforage.getItem("cached_roadmap").then((cachedRoadmap) => {
              if (cachedRoadmap && Array.isArray(cachedRoadmap)) {
                toast("Mạng ngoại tuyến, hiển thị lộ trình tuyến Offline PWA.");
                const dailyDeck = {
                  id: "daily-quest",
                  title: "Nhiệm vụ hôm nay (Daily Quest)",
                  subject: "Spaced Repetition",
                  description: "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
                  cards: cachedRoadmap,
                  createdAt: new Date().toISOString(),
                  ownerId: "system",
                };
                setRawDeck(dailyDeck);
                store.setTempDeck(dailyDeck);
              } else {
                toast("Không có lộ trình ngoại tuyến nào khả dụng.");
                navigate(user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard');
              }
              setIsLoading(false);
            });
        } else {
          getOfflineDeck(deckId).then((offlineDeck) => {
            if (offlineDeck) {
              console.log("Loaded offline deck from DB:", offlineDeck);
              setRawDeck(offlineDeck);
              store.setTempDeck(offlineDeck);
              setIsOfflineSaved(true);
            }
            setIsLoading(false);
          });
        }
      }

    if (!navigator.onLine) {
      return;
    }

    // Transient frontend decks bypass server fetch
    if (deckId === "daily-quest" || deckId === "remind-later-deck") {
      const localTransient = store.getDeck(deckId);
      if (localTransient) {
        setRawDeck(localTransient);
        setIsLoading(false);
      } else if (deckId === "daily-quest") {
        // Auto-generate daily-quest
        const buildDailyQuest = async () => {
          try {
            const safeRequest = (await import("../utils/apiClient")).safeRequest;
            const { getDocs, collection } = await import("firebase/firestore");

            const snapshot = await getDocs(collection(db, "sets"));
            const allCards: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (data && Array.isArray(data.cards)) {
                const systemDecks = [
                  "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
                ];
                const isSystem = systemDecks.includes(data.id);
                const isCreatedBySelf = data.createdBy === user.id;
                const isCreatedByTeacher = data.creatorRole === "teacher" || data.creatorRole === "Admin" || data.creatorRole === "admin";
                
                const isUserTeacher = user.role === "teacher" || user.role === "Admin" || user.role === "admin";

                if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
                  data.cards.forEach((c: any) => {
                    allCards.push({
                      ...c,
                      originDeckId: data.id,
                      originDeckTitle: data.title,
                    });
                  });
                }
              }
            });

            const homePath = user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';

            if (allCards.length === 0) {
              navigate(homePath);
              return;
            }

            const res = await safeRequest("/api/daily-quest", {
              headers: { "Content-Type": "application/json" },
              method: "POST",
              body: JSON.stringify({ allCards }),
            });
            const reqData = await res.json();

            if (!reqData.cards || reqData.cards.length === 0) {
              navigate(homePath);
              return;
            }
            
            // CACHE ROADMAP
            await localforage.setItem("cached_roadmap", reqData.cards).catch(console.warn);

            const dailyDeck = {
              id: "daily-quest",
              title: "Nhiệm vụ hôm nay (Daily Quest)",
              subject: "Spaced Repetition",
              description:
                "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
              cards: reqData.cards,
              createdAt: new Date().toISOString(),
              ownerId: "system",
            };

            store.setTempDeck(dailyDeck);
            setRawDeck(dailyDeck);
            setIsLoading(false);
          } catch (e) {
            console.error("Auto daily quest generation failed:", e);
            const homePath = user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
            
            // Fallback on Catch: If network failed unexpectedly during fetch
            try {
              const cachedRoadmap = await localforage.getItem("cached_roadmap");
              if (cachedRoadmap && Array.isArray(cachedRoadmap)) {
                  toast("Mạng không ổn định. Kích hoạt dự phòng lộ trình Offline.");
                  const dailyDeck = {
                     id: "daily-quest",
                     title: "Nhiệm vụ hôm nay (Daily Quest)",
                     subject: "Spaced Repetition",
                     description: "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
                     cards: cachedRoadmap,
                     createdAt: new Date().toISOString(),
                     ownerId: "system"
                  };
                  store.setTempDeck(dailyDeck);
                  setRawDeck(dailyDeck);
                  setIsLoading(false);
                  return;
              }
            } catch (fallbackErr) {}
            
            navigate(homePath);
          }
        };
        buildDailyQuest();
      } else if (deckId === "remind-later-deck") {
        const homePath = user?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
        navigate(homePath);
      }
      return;
    }

    let unsubAuth: any = null;

    const setupAuthAndListen = () => {
       unsubAuth = import("firebase/auth").then(({ onAuthStateChanged }) => {
          return onAuthStateChanged(auth, (firebaseUser) => {
             if (!firebaseUser && navigator.onLine) {
                 // Wait for auth to resolve
                 return;
             }
             
             if (unsubDeckRef.current) {
                 unsubDeckRef.current();
             }
             
             try {
                const unsub = onSnapshot(doc(db, "sets", deckId), (docSnap) => {
                  if (docSnap.exists()) {
                    const fetchedData = docSnap.data();
                    if (fetchedData && !fetchedData.id) fetchedData.id = docSnap.id;
                    setRawDeck(fetchedData);
                    store.setTempDeck(fetchedData);
                  } else {
                    // Fallback to IndexedDB if document does not exist
                    getOfflineDeck(deckId).then((offlineDeck) => {
                      if (offlineDeck) {
                        setRawDeck(offlineDeck);
                          store.setTempDeck(offlineDeck);
                          setIsOfflineSaved(true);
                        }
                      });
                  }
                  setIsLoading(false);
                }, (err) => {
                  console.error("onSnapshot failed, falling back to IndexedDB database:", err);
                  getOfflineDeck(deckId).then((offlineDeck) => {
                    if (offlineDeck) {
                      setRawDeck(offlineDeck);
                      store.setTempDeck(offlineDeck);
                      setIsOfflineSaved(true);
                    }
                    setIsLoading(false);
                  });
                });
                unsubDeckRef.current = unsub;
                FirebaseListenerManager.add(`StudyRoom_deck_${deckId}`, unsub);
              } catch (e) {
                console.error("Failed to sync room deck in real-time:", e);
                setIsLoading(false);
              }
          });
       });
    };
    
    setupAuthAndListen();

    return () => {
      if (unsubDeckRef.current) {
        unsubDeckRef.current();
        unsubDeckRef.current = null;
      }
      FirebaseListenerManager.remove(`StudyRoom_deck_${deckId}`);
      if (unsubAuth) {
         unsubAuth.then((unsub: any) => { if (unsub) unsub(); });
      }
    };
  }, [deckId, user?.id]);

  useEffect(() => {
    if (rawDeck && user) {
      setAccessDenied(false);
    }
  }, [rawDeck, user]);

  // 2. Listen to personal card states in real-time
  const unsubCardStatesRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!user) return;
    let unsubAuthStates: any = null;
    
    unsubAuthStates = import("firebase/auth").then(({ onAuthStateChanged }) => {
      return onAuthStateChanged(auth, (firebaseUser) => {
         if (!firebaseUser && navigator.onLine) return; // Wait until authenticated
         
         if (unsubCardStatesRef.current) unsubCardStatesRef.current();
         try {
            const unsub = onSnapshot(
              collection(db, "users", user.id, "cardsState"),
              (snapshot) => {
                const states: any[] = [];
                snapshot.forEach((docSnap) => {
                  states.push({ id: docSnap.id, ...docSnap.data() });
                });
                setPersonalCardStates(states);
              },
              (err) => {
                console.error("StudyRoom cardsState sync error:", err);
              },
            );
            unsubCardStatesRef.current = unsub;
            FirebaseListenerManager.add(`StudyRoom_cardsState_${user.id}`, unsub);
          } catch (e) {
            console.error("Failed to sync study room card states:", e);
          }
      });
    });

    return () => {
      if (unsubCardStatesRef.current) {
        unsubCardStatesRef.current();
        unsubCardStatesRef.current = null;
      }
      FirebaseListenerManager.remove(`StudyRoom_cardsState_${user?.id}`);
      if (unsubAuthStates) {
         unsubAuthStates.then((unsub: any) => { if (unsub) unsub(); });
      }
    };
  }, [user?.id]);

  // 3. Merge raw deck and personal card states to form reactive deck
  const deck = useMemo(() => {
    if (!rawDeck) return null;
    const stateMap = new Map();
    if (personalCardStates && personalCardStates.length > 0) {
      personalCardStates.forEach((s) => stateMap.set(s.id, s));
    }

    const mergedDeck = { ...rawDeck };
    if (mergedDeck.cards) {
      mergedDeck.cards = mergedDeck.cards.map((card: any) => {
        const savedState = stateMap.get(card.id);
        if (savedState) {
          return {
            ...card,
            mastery:
              typeof savedState.mastery === "number"
                ? savedState.mastery
                : card.mastery,
            nextReview:
              typeof savedState.nextReview === "number"
                ? savedState.nextReview
                : card.nextReview,
            interval:
              typeof savedState.interval === "number"
                ? savedState.interval
                : card.interval,
            repetition:
              typeof savedState.repetition === "number"
                ? savedState.repetition
                : card.repetition,
            efactor:
              typeof savedState.efactor === "number"
                ? savedState.efactor
                : card.efactor,
            isHard:
              typeof savedState.isWeakCard !== "undefined"
                ? savedState.isWeakCard
                : card.isHard,
          };
        }
        return card;
      });
    }

    // Attempt to silently update global store locally in background
    setTimeout(async () => {
      try {
        const { store: globalStore } = await import("../lib/store");
        const currentDecks = [...globalStore.getDecks()];
        const existIdx = currentDecks.findIndex((d) => d.id === mergedDeck.id);
        if (existIdx >= 0) {
          currentDecks[existIdx] = mergedDeck;
          if (typeof (globalStore as any).setDecksLocally === "function") {
            (globalStore as any).setDecksLocally(currentDecks);
          }
        }
      } catch (e) {
        // ignore
      }
    }, 0);

    return mergedDeck;
  }, [rawDeck, personalCardStates]);

  // Load scratchpad from Firestore, fallback to Local Storage
  useEffect(() => {
    if (!user || !deckId) return;
    
    const localKey = `scratchpad_${user.id}_${deckId}`;
    const localContent = localStorage.getItem(localKey) || "";
    setScratchpadText(localContent);

    const loadNotes = async () => {
      try {
        const docRef = doc(db, "users", user.id, "scratchpads", deckId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudContent = docSnap.data().content || "";
          setScratchpadText(cloudContent);
          localStorage.setItem(localKey, cloudContent);
        }
      } catch (err) {
        console.error("Lỗi khi tải ghi chú nhanh:", err);
      }
    };
    
    if (navigator.onLine) {
      loadNotes();
    }
  }, [deckId, user?.id]);

  // Debounce Auto-Save scratchpad to Firestore & Local Storage
  useEffect(() => {
    if (!user || !deckId) return;
    
    const localKey = `scratchpad_${user.id}_${deckId}`;
    const cached = localStorage.getItem(localKey) || "";
    if (scratchpadText === cached) {
      return;
    }

    localStorage.setItem(localKey, scratchpadText);

    const timer = setTimeout(async () => {
      setIsNotesSaving(true);
      try {
        const docRef = doc(db, "users", user.id, "scratchpads", deckId);
        await setDoc(docRef, {
          content: scratchpadText,
          updatedAt: new Date().toISOString(),
          deckId: deckId,
          deckTitle: deck?.title || "Sổ tay phòng học"
        }, { merge: true });
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastNotesSavedTime(timeStr);
      } catch (err) {
        console.error("Lỗi tự động lưu ghi chú:", err);
      } finally {
        setIsNotesSaving(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [scratchpadText, deckId, user?.id, deck?.title]);

  // Handle network reconnect with throttle
  useEffect(() => {
    let reconnectThrottle: NodeJS.Timeout | null = null;

    const handleReconnect = () => {
      if (reconnectThrottle) return;

      console.log(
        "[StudyRoom] Network reconnect detected. Ensuring state freshness...",
      );
      // onSnapshot automatically refreshes under the hood thanks to enableNetwork.
      // We can reset isLoading here if the view got stuck
      if (
        isLoading &&
        deckId &&
        deckId !== "daily-quest" &&
        deckId !== "remind-later-deck"
      ) {
        console.log(
          "[StudyRoom] Forced loading state bypass to revive stalled UI",
        );
        // It might take a moment for onSnapshot to fire, but we mark it as attempting reconnect
      }

      reconnectThrottle = setTimeout(() => {
        reconnectThrottle = null;
      }, 15000); // 15s throttle
    };

    window.addEventListener("app-network-reconnect", handleReconnect);
    return () => {
      window.removeEventListener("app-network-reconnect", handleReconnect);
      if (reconnectThrottle) clearTimeout(reconnectThrottle);
    };
  }, [isLoading, deckId]);

  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isClozeMode, setIsClozeMode] = useState(() => {
    return localStorage.getItem("study_cloze_mode") === "true";
  });
  const [isHintRevealed, setIsHintRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [isGeneratingCloze, setIsGeneratingCloze] = useState(false);

  useEffect(() => {
    if (finished) {
      triggerCelebration();
      if (deck) {
        const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
        localStorage.setItem(progressKey, "0");
      }
    }
  }, [finished, deck, user?.id]);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionMasteryGained, setSessionMasteryGained] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());
  const [sessionTimeSpent, setSessionTimeSpent] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<
    Array<{
      cardIndex: number;
      front: string;
      status: "correct" | "incorrect" | "skipped";
      cumulativeCorrect: number;
      cumulativeStudied: number;
      accuracy: number;
      masteryChange: number;
    }>
  >([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(
    null,
  );

  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelDeleteCountdown = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deleteTimerRef.current) {
      clearInterval(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setDeleteCountdown(null);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      cancelDeleteCountdown();
    }
  }, [isEditing, cancelDeleteCountdown]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearInterval(deleteTimerRef.current);
      }
    };
  }, []);

  const [deckEditTitle, setDeckEditTitle] = useState("");
  const [deckEditSubject, setDeckEditSubject] = useState("");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isCreatingNewSubjectDeck, setIsCreatingNewSubjectDeck] =
    useState(false);

  const existingSubjects = useMemo(() => {
    const subjectsSet = new Set<string>();
    store.getDecks().forEach((d) => {
      const s =
        (typeof d.subject === "string"
          ? d.subject
          : JSON.stringify(d.subject)) || "general";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    // Add default core subjects to make sure they are always available as defaults
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
  }, []);

  const canEditDeck = useMemo(() => {
    if (!user || !deck) return false;
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"
    ];
    const isSystem = systemDecks.includes(deck.id);
    const isAdmin = user.role === "admin" || user.role === "Admin" || user.role === "teacher";
    const isCreator = deck.createdBy === user.id;

    if (isSystem) {
      return isAdmin; // Only admin/teacher can edit system/official decks
    }
    return isCreator || isAdmin;
  }, [user, deck]);

  useEffect(() => {
    if (deck && !isEditingMetadata) {
      setDeckEditTitle(
        typeof deck.title === "string"
          ? deck.title
          : JSON.stringify(deck.title),
      );
      setDeckEditSubject(
        typeof deck.subject === "string"
          ? deck.subject
          : deck.subject
            ? JSON.stringify(deck.subject)
            : "general",
      );
    }
  }, [deck, isEditingMetadata]);

  const handleUpdateDeckMetadata = async () => {
    if (!deck || !deckEditTitle.trim() || !canEditDeck) return;
    setIsSavingMetadata(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const docRef = doc(db, "sets", deck.id);
      await updateDoc(docRef, {
        title: deckEditTitle.trim(),
        subject: deckEditSubject.trim() || "general",
      });

      // Update locally
      const currentDecks = store.getDecks();
      const existIdx = currentDecks.findIndex((d) => d.id === deck.id);
      if (existIdx >= 0) {
        currentDecks[existIdx].title = deckEditTitle.trim();
        currentDecks[existIdx].subject = deckEditSubject.trim() || "general";
        if (typeof (store as any).setDecksLocally === "function") {
          (store as any).setDecksLocally(currentDecks);
        }
      }

      setEditSuccessMessage("Đã cập nhật thông tin bộ bài thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
      setIsEditingMetadata(false);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/${deck.id}`);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleToggleMute = () => {
    toggleSound();
  };

  const handleExportDeck = () => {
    if (!deck) return;
    const cleanDeck = {
      title: deck.title,
      subject: deck.subject,
      cards: deck.cards.map(card => ({
        front: card.front || "",
        back: card.back || ""
      }))
    };
    const blob = new Blob([JSON.stringify(cleanDeck, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (deck && isOfflineSaved) {
      saveDeckOffline(deck).catch(e => console.error("Error backing up updated deck to offline DB:", e));
    }
  }, [deck, isOfflineSaved]);

  const handleToggleOffline = async () => {
    if (!deck) return;
    try {
      if (isOfflineSaved) {
        await deleteOfflineDeck(deck.id);
        setIsOfflineSaved(false);
      } else {
        await saveDeckOffline(deck);
        setIsOfflineSaved(true);
      }
    } catch (e) {
      console.error("Error toggling offline storage:", e);
    }
  };

  const handleFlip = () => {
    if (!isEditing) {
      if (!isFlipped)
        playFlipSound(); // Optionally play sound both on flip and unflip, but just play it
      else playFlipSound();
      setIsFlipped(!isFlipped);
    }
  };

  const [deepExplanation, setDeepExplanation] = useState<string | null>(null);
  const [isSerif, setIsSerif] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [quote] = useState(
    MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
  );

  const [studyMode, setStudyMode] = useState<"all" | "weak">("all");
  const [weakCardIds, setWeakCardIds] = useState<string[]>([]);
  const [showRemindToast, setShowRemindToast] = useState(false);

  // Pomodoro
  const POMODORO_MINS = 25;
  const [timerSeconds, setTimerSeconds] = useState(POMODORO_MINS * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerFinished, setIsTimerFinished] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s - 1);
      }, 1000);
    } else if (isTimerRunning && timerSeconds === 0) {
      setIsTimerRunning(false);
      setIsTimerFinished(true);
      store.addBonusPoints(25);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const toggleTimer = () => {
    if (isTimerFinished) {
      setTimerSeconds(POMODORO_MINS * 60);
      setIsTimerFinished(false);
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Đồng bộ thời gian thực Thẻ X (weak cards) giữa Firestore sync deck và localStorage kéo theo đa thiết bị
  useEffect(() => {
    if (!deck || !deck.cards) return;
    
    const storageKey = `weak_cards_${deck.id}`;
    const savedWeakIds: string[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    
    const finalWeakIdsSet = new Set<string>();
    
    // 1. Quét tất cả thẻ được đánh dấu là isHard: true từ Firestore / store memory
    deck.cards.forEach((c: any) => {
      if (c.isHard) {
        finalWeakIdsSet.add(c.id);
      }
    });
    
    // 2. Bảo lưu các thẻ X trong localStorage nếu thẻ đó vẫn tồn tại trong bộ này
    // và chưa bị đánh dấu rõ ràng là isHard = false ở trên Firestore (khớp trạng thái)
    const cardsInDeck = new Set(deck.cards.map((c: any) => c.id));
    savedWeakIds.forEach(id => {
      if (cardsInDeck.has(id)) {
        const cardObj = deck.cards.find((c: any) => c.id === id);
        if (cardObj && cardObj.isHard !== false) {
          finalWeakIdsSet.add(id);
        }
      }
    });

    const finalWeakIds = Array.from(finalWeakIdsSet);
    
    // Tránh render lặp vô tận bằng cách so sánh sâu mảng
    const hasDiff = 
      finalWeakIds.length !== savedWeakIds.length ||
      !finalWeakIds.every(id => savedWeakIds.includes(id)) ||
      finalWeakIds.length !== weakCardIds.length ||
      !finalWeakIds.every(id => weakCardIds.includes(id));
      
    if (hasDiff) {
      localStorage.setItem(storageKey, JSON.stringify(finalWeakIds));
      setWeakCardIds(finalWeakIds);
    }
  }, [deck, weakCardIds]);

  const queueInitDeckIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (deck) {
      if (queueInitDeckIdRef.current === deck.id) return; // Prevent overwriting study state on background syncs
      queueInitDeckIdRef.current = deck.id;

      const storageKey = `weak_cards_${deck.id}`;
      const savedWeakIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setWeakCardIds(savedWeakIds);

      let due = deck.cards || [];
      if (deck.id === "daily-quest") {
        const now = Date.now();
        // Filter cards based on mastery and next review time
        const reviewCards = due.filter(
          (c: any) => c.mastery > 0 && c.nextReview <= now,
        );
        const newCards = due.filter(
          (c: any) => !c.mastery || c.mastery === 0 || !c.nextReview,
        );

        // Mix 80% review (up to 16 cards) and 20% new (up to 4 cards) = max 20 cards standard
        const shuffledReview = reviewCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 16);
        const shuffledNew = newCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        due = [...shuffledReview, ...shuffledNew].sort(
          () => Math.random() - 0.5,
        );

        // If no due cards, we can just grab some new or random cards to keep the daily quest active
        if (due.length === 0) {
          due = newCards.sort(() => Math.random() - 0.5).slice(0, 10);
        }
      }
      setStudyQueue(due);
      
      // Restore study progress
      const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
      const savedIdxStr = localStorage.getItem(progressKey);
      let loadedIdx = 0;
      if (savedIdxStr) {
        const parsed = parseInt(savedIdxStr, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < due.length) {
          loadedIdx = parsed;
        }
      }
      setCurrentIndex(loadedIdx);
      setIsFlipped(false);
      setSessionCorrectCount(0);
      setSessionMasteryGained(0);
      setSessionTimeSpent(0);
      setSessionHistory([]);
    }
  }, [deck, user]);

  useEffect(() => {
    if (deck && currentIndex !== undefined && currentIndex >= 0) {
      const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
      localStorage.setItem(progressKey, currentIndex.toString());
    }
  }, [currentIndex, deck, user?.id]);

  useEffect(() => {
    setIsHintRevealed(false);
  }, [currentIndex]);

  useEffect(() => {
    const unlockAudio = () => {
      initAudio();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const startReviewXCards = () => {
    if (!deck) return;
    const storageKey = `weak_cards_${deck.id}`;
    const savedWeakIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const weakCards = (deck.cards || []).filter((c: any) =>
      savedWeakIds.includes(c.id),
    );

    if (weakCards.length === 0) {
      toast("Tuyệt vời! Bạn không còn thẻ nào bị đánh dấu X trong bộ này.");
      return;
    }

    setWeakCardIds(savedWeakIds);
    setStudyQueue(weakCards);
    setStudyMode("weak");
    setCurrentIndex(0);
    setSessionCorrectCount(0);
    setSessionMasteryGained(0);
    setSessionHistory([]);
    setFinished(false);
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);
  };

  const startReviewAll = () => {
    if (!deck) return;
    setStudyQueue(deck.cards || []);
    setStudyMode("all");
    setCurrentIndex(0);
    setSessionCorrectCount(0);
    setSessionMasteryGained(0);
    setSessionHistory([]);
    setFinished(false);
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);
  };

  const currentCard = studyQueue[currentIndex];

  const executeActiveCardDeletion = useCallback(async () => {
    if (!deck || !currentCard || !canEditDeck) return;
    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, getDoc, updateDoc, arrayRemove } = await import("firebase/firestore");

      const targetDeckId = (currentCard as any).originDeckId || deck.id;
      const docRef = doc(db, "sets", targetDeckId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentCards = data.cards || [];
        const originalCardObj = currentCards.find((c: any) => c.id === currentCard.id);
        if (originalCardObj) {
          await updateDoc(docRef, {
            cards: arrayRemove(originalCardObj)
          });
        }
      }

      // Update local storage and app state
      store.removeCardLocally(targetDeckId, currentCard.id);
      
      // Calculate advancing index
      const totalInQueue = studyQueue.length;
      if (totalInQueue <= 1) {
        setFinished(true);
      } else if (currentIndex === totalInQueue - 1) {
        setCurrentIndex(currentIndex - 1);
      } else {
        // Shifting keeps current index same which targets the next available card
      }

      setStudyQueue((prev) => prev.filter((c) => c.id !== currentCard.id));
      setDeleteCountdown(null);
      setIsEditing(false);

      setEditSuccessMessage("Đã xóa thẻ học thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting active card:", err);
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/`);
    } finally {
      setIsUpdatingCard(false);
    }
  }, [deck, currentCard, canEditDeck, studyQueue, currentIndex]);

  const startDeleteCountdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteTimerRef.current) {
      clearInterval(deleteTimerRef.current);
    }
    setDeleteCountdown(5);
    
    const intervalId = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev === null) {
          clearInterval(intervalId);
          return null;
        }
        if (prev <= 1) {
          clearInterval(intervalId);
          deleteTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    deleteTimerRef.current = intervalId;
  }, [executeActiveCardDeletion]);

  const handleListen = (e?: React.MouseEvent, text?: string, forceLocale?: string) => {
    if (e) e.stopPropagation();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const targetText = text || currentCard?.front || "";
    // Clean up basic markdown symbols, LaTeX and math blocks for better reading
    const cleanText = targetText
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      .replace(/\$[\s\S]*?\$/g, '')
      .replace(/[*_#`\\[\]]/g, "")
      .trim();
    if (!cleanText) return;

    // Detect language if not forced
    const detection = detectLanguage(targetText);
    const locale = forceLocale || (detection.isAvailable ? detection.locale : "en-US");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale;
    utterance.rate = 0.9;

    // Auto-Voice Selection: query system voices and correctly bind matching voice
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      // Find voices matching the locale prefix or exact match
      const exactMatch = voices.find(v => v.lang.toLowerCase() === locale.toLowerCase() || v.lang.toLowerCase().replace('_', '-') === locale.toLowerCase());
      if (exactMatch) {
         utterance.voice = exactMatch;
      } else {
         const prefix = locale.split('-')[0].toLowerCase();
         const prefixMatch = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
         if (prefixMatch) {
            utterance.voice = prefixMatch;
         }
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateAICloze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || isGeneratingCloze) return;
    setIsGeneratingCloze(true);
    try {
      if (!auth.currentUser) throw new Error("Vui lòng đăng nhập để sử dụng AI.");
      
      const res = await safeRequest("/api/automation/hydrate-card", {
        method: "POST",
        body: JSON.stringify({
          front: currentCard.front,
          wordForm: currentCard.wordForm || "",
          back: currentCard.back || "",
        }),
      });
      
      if (!res.ok) throw new Error("API Exception");
      const data = await res.json();
      
      if (data.example) {
        const targetDeckId = currentCard.originDeckId || deck?.id;
        if (!targetDeckId) throw new Error("Chưa xác định ID nhóm thẻ.");
        
        // Cập nhật Firebase ngay lập tức
        let docRef = doc(db, "sets", targetDeckId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          const docCards: any[] = docData.cards || [];
          const updatedDocCards = docCards.map((c: any) =>
            c.id === currentCard.id
              ? { ...c, example_sentence: data.example }
              : c
          );
          await updateDoc(docRef, { cards: updatedDocCards });
        }
        
        // Update local object & store
        currentCard.example_sentence = data.example;
        store.updateCard(targetDeckId, currentCard.id, currentCard.front, currentCard.back, data.example);
        
        toast.success("✅ Đã tạo câu ví dụ để đục lỗ thông minh.");
      } else {
        toast.error("Không thể tạo câu đục lỗ hợp lý.");
      }
    } catch(err: any) {
      toast.error(err.message || "Lỗi kết nối AI khi tạo câu đục lỗ.");
      console.error(err);
    } finally {
      setIsGeneratingCloze(false);
    }
  };

  const getClozeSentence = () => {
    if (!currentCard) return "";
    let sentence = currentCard.example_sentence || "";
    if (!sentence) {
      sentence = `Điền từ thích hợp vào chỗ trống: [${currentCard.front}] (Nghĩa: ${currentCard.back})`;
    }
    return sentence;
  };

  const renderStudyCloze = () => {
    if (!currentCard) return null;
    
    let sentence = getClozeSentence();
    
    // Tìm cụm đặt trong ngoặc vuông [...]
    const regex = /\[(.*?)\]/;
    let match = sentence.match(regex);
    
    // Nếu không tìm thấy cụm đặt trong ngoặc vuông, thử tìm từ khoá trùng khớp với currentCard.front (không phân biệt chữ hoa thường)
    if (!match && currentCard.front) {
      const escapedWord = currentCard.front.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Tìm nguyên từ hoặc cụm từ khớp
      const wordRegex = new RegExp(`\\b(${escapedWord})\\b`, 'i');
      if (wordRegex.test(sentence)) {
        sentence = sentence.replace(wordRegex, '[$1]');
        match = sentence.match(regex);
      }
    }
    
    if (!match) {
      // Fallback khi không khớp gì cả
      return (
        <p className="text-lg sm:text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed text-center px-4">
          {sentence}
        </p>
      );
    }
    
    const targetWord = match[1];
    const sentenceBefore = sentence.substring(0, match.index);
    const sentenceAfter = sentence.substring(match.index! + match[0].length);
    const hint = targetWord.charAt(0) + "_".repeat(targetWord.length - 1);
    
    const isFallback = !currentCard?.example_sentence;
    const isComplexOrLong = currentCard?.front ? (currentCard.front.split(' ').length >= 3 || /[\/≠=()]/.test(currentCard.front) || currentCard.front.length > 20) : false;

    return (
      <div className="flex flex-col items-center justify-center w-full px-2">
        <p className="text-lg sm:text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed text-center px-4 w-full">
          {sentenceBefore}
          <span 
            onClick={(e) => {
              // Ngăn sự kiện click lật thẻ khi bấm vào ô đục lỗ nếu muốn
              e.stopPropagation();
              if (isFallback) return; // Không cần bật hint nếu chỉ hiển thị ______ fallback xấu
              setIsHintRevealed(!isHintRevealed);
            }}
            className={cn(
              "mx-1.5 px-3 py-0.5 rounded-lg border font-bold transition-all inline-block select-none shadow-sm cursor-pointer",
              isFlipped 
                ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-300 dark:border-green-800" 
                : isHintRevealed
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400 border-orange-350 dark:border-orange-800/50"
            )}
            title="Bấm để bật/tắt gợi ý từ này"
          >
            {isFlipped ? targetWord : (isHintRevealed ? hint : "________")}
          </span>
          {sentenceAfter}
        </p>

        {isFallback && isComplexOrLong && (
           <div className="mt-8 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleGenerateAICloze}
                disabled={isGeneratingCloze}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-md transition-all font-medium text-sm disabled:opacity-70 disabled:cursor-wait"
              >
                  {isGeneratingCloze ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGeneratingCloze ? "AI Đang xử lý..." : "Agent 2: Sinh câu đục lỗ ngữ cảnh"}
              </button>
              <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 max-w-xs text-center font-light">Thẻ này hơi phức tạp để đục lỗ chay. Khuyên ngài nên dùng AI tạo ra câu ví dụ ngữ cảnh để học hiệu quả hơn.</p>
           </div>
        )}
      </div>
    );
  };

  const handleReportError = useCallback(async () => {
    if (!currentCard || !deck) return;

    try {
      const cardIndex =
        deck.cards.findIndex((c: any) => c.id === currentCard.id) + 1;
      const reportText = `🚨 REPORT CARD ERROR 🚨\n\n📌 Deck: ${deck.title}\n🃏 Card: #${cardIndex}/${deck.cards.length} (ID: ${currentCard.id})\n🔗 URL: ${window.location.href}\n\nFRONT:\n${currentCard.front}\n\nBACK:\n${currentCard.back}\n\n---\nPlease describe the error here: `;

      try {
        await navigator.clipboard.writeText(reportText);
      } catch (err) {
        console.warn("Clipboard permission denied or failed", err);
      }

      window.open("https://t.me/+O50q6ltXTzwxMzk1", "_blank");
    } catch (err) {
      console.error("Error generating report", err);
    }
  }, [currentCard, deck]);

  const handleMark = useCallback(
    (remembered: boolean) => {
      initAudio();
      if (currentCard) {
        if (remembered) {
          playCorrectSound();
          setSessionCorrectCount((prev) => prev + 1);
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.vibrate === "function"
          ) {
            navigator.vibrate(80); // Short nudge for correct answer
          }
        } else {
          playIncorrectSound();
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.vibrate === "function"
          ) {
            navigator.vibrate([60, 40, 60]); // Double pulse for incorrect answer
          }
        }

        const oldMastery = currentCard.mastery;
        const targetDeckId = currentCard.originDeckId || deck?.id;
        if (targetDeckId) {
          store.updateCardMastery(targetDeckId, currentCard.id, remembered);
        }
        const newMastery = currentCard.mastery; // Since updateCardMastery updates the object reference in memory
        const diff = newMastery - oldMastery;
        setSessionMasteryGained((prev) => prev + diff);

        const nextCorrectCount = sessionCorrectCount + (remembered ? 1 : 0);
        const nextStudiedCount = sessionHistory.length + 1;
        const nextAccuracy = Math.round(
          (nextCorrectCount / nextStudiedCount) * 100,
        );

        setSessionHistory((prev) => [
          ...prev,
          {
            cardIndex: nextStudiedCount,
            front: currentCard.front,
            status: remembered ? "correct" : "incorrect",
            cumulativeCorrect: nextCorrectCount,
            cumulativeStudied: nextStudiedCount,
            accuracy: nextAccuracy,
            masteryChange: diff,
          },
        ]);

        if (deck) {
          const storageKey = `weak_cards_${deck.id}`;
          let weakIds = JSON.parse(localStorage.getItem(storageKey) || "[]");

          if (!remembered) {
            if (!weakIds.includes(currentCard.id)) {
              weakIds.push(currentCard.id);
            }
          } else {
            weakIds = weakIds.filter((id: string) => id !== currentCard.id);
          }

          localStorage.setItem(storageKey, JSON.stringify(weakIds));
          setWeakCardIds(weakIds);
        }

      }

      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);

      setIsFlipped(false);
      if (currentIndex + 1 < studyQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
        setFinished(true);
      }
    },
    [
      currentCard,
      deck,
      sessionCorrectCount,
      sessionHistory.length,
      isPinned,
      currentIndex,
      studyQueue.length,
      sessionStartTime,
    ],
  );

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, isPinned]);

  const handleNextCard = useCallback(() => {
    if (currentIndex + 1 < studyQueue.length) {
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
      setFinished(true);
    }
  }, [currentIndex, studyQueue.length, isPinned, sessionStartTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (finished || !currentCard || isExtracting || isEditing) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "KeyL") {
        e.preventDefault();
        if (!isFlipped) {
          const text = currentCard?.front || (currentCard as any)?.word || "";
          const check = detectLanguage(text);
          if (check.isAvailable) {
            handleListen(undefined, text, check.locale);
          }
        } else {
          const text = currentCard?.back || (currentCard as any)?.meaning || "";
          const check = detectLanguage(text);
          if (check.isAvailable) {
            handleListen(undefined, text, check.locale);
          }
        }
      } else if (e.code === "ArrowLeft") {
        if (isFlipped) {
          e.preventDefault();
          handleMark(false);
        } else {
          e.preventDefault();
          handlePrevCard();
        }
      } else if (e.code === "ArrowRight") {
        if (isFlipped) {
          e.preventDefault();
          handleMark(true);
        } else {
          e.preventDefault();
          handleNextCard();
        }
      } else if (e.code === "ArrowDown") {
        if (isFlipped) {
          e.preventDefault();
          handleRemindLater();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    finished,
    currentCard,
    isExtracting,
    isEditing,
    isFlipped,
    deckId,
    currentIndex,
    sessionCorrectCount,
    sessionHistory.length,
    handlePrevCard,
    handleNextCard,
  ]); // Keep all necessary dependencies

  const handleAgent2 = async () => {
    if (!currentCard) return;

    if (user && user.role === "student" && cooldownRemaining > 0) {
      setDeepExplanation(
        `⏳ **Hệ thống AI đang hạ nhiệt**: Bạn là Học sinh, vui lòng đợi thêm **${cooldownRemaining} giây** để hỏi giải thích tiếp theo nhé.`,
      );
      return;
    }

    setIsExtracting(true);
    setIsMinimized(false);

    if (user && user.role === "student" && !user.isPro) {
      startCooldown();
    }

    try {
      const idToken = (await auth.currentUser?.getIdToken()) || "";
      const res = await safeRequest("/api/agent2/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false",
        },
        body: JSON.stringify({
          term: currentCard.front,
          definition: currentCard.back,
          subject: currentCard.subject,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 429) {
          setDeepExplanation(
            `⏳ **Cooldown 20s**: ${errData.error || "Bạn đang gọi AI quá nhanh. Hãy chờ!"}`,
          );
          setIsExtracting(false);
          return;
        }
        throw new Error(errData.error || "Failed to query express backend");
      }

      const data = await res.json();
      setDeepExplanation(data.result);
    } catch (e: any) {
      setDeepExplanation(
        "Failed to router extract. Check AI connection. Error: " +
          (e.message || e),
      );
    }
    setIsExtracting(false);
  };

  const handleRemindLater = () => {
    if (!currentCard) return;
    const existing = JSON.parse(
      localStorage.getItem("remind_later_items") || "[]",
    );
    if (!existing.includes(currentCard.id)) {
      existing.push(currentCard.id);
      localStorage.setItem("remind_later_items", JSON.stringify(existing));
    }

    setShowRemindToast(true);
    setTimeout(() => setShowRemindToast(false), 2000);

    const nextStudiedCount = sessionHistory.length + 1;
    const nextAccuracy = Math.round(
      (sessionCorrectCount / nextStudiedCount) * 100,
    );

    setSessionHistory((prev) => [
      ...prev,
      {
        cardIndex: nextStudiedCount,
        front: currentCard.front,
        status: "skipped",
        cumulativeCorrect: sessionCorrectCount,
        cumulativeStudied: nextStudiedCount,
        accuracy: nextAccuracy,
        masteryChange: 0,
      },
    ]);

    // Move to next card
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);

    if (currentIndex + 1 < studyQueue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
      setFinished(true);
    }
  };

  const handleEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditFront(currentCard.front);
    setEditBack(currentCard.back);
    setEditExampleSentence(currentCard.example_sentence || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deck || !currentCard || !canEditDeck) return;

    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");

      let updatedDocCards = [];
      const targetDeckId = currentCard.originDeckId || deck.id;
      const docRef = doc(db, "sets", targetDeckId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentCards = data.cards || [];
        updatedDocCards = currentCards.map((c: any) =>
          c.id === currentCard.id
            ? { ...c, front: editFront, back: editBack, example_sentence: editExampleSentence }
            : c,
        );
      } else {
        // Fallback for missing offline maps etc but this should mostly be exact match
        updatedDocCards = [
          { ...currentCard, front: editFront, back: editBack, example_sentence: editExampleSentence },
        ]; // dummy fallback
      }

      // Save to Firestore
      await updateDoc(docRef, {
        cards: updatedDocCards,
      });

      // Update local state ONLY on success
      store.updateCard(targetDeckId, currentCard.id, editFront, editBack, editExampleSentence);
      currentCard.front = editFront;
      currentCard.back = editBack;
      currentCard.example_sentence = editExampleSentence;

      setEditSuccessMessage("Đã cập nhật dữ liệu thẻ thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
      setIsEditing(false);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/`);
    } finally {
      setIsUpdatingCard(false);
    }
  };

  const handleAddCard = async () => {
    if (!deck || !canEditDeck) return;
    // Logic removed
    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, updateDoc, arrayUnion } = await import("firebase/firestore");

      const newCardObj: Flashcard = {
        id: `card_${uuidv4().substring(0, 8)}`,
        front: "Khái niệm mới",
        back: "Giải nghĩa chi tiết",
        subject: deck.subject || "general",
        mastery: 0,
        nextReview: Date.now(),
        isHard: false,
        example_sentence: "",
      };

      await updateDoc(doc(db, "sets", deck.id), {
        cards: arrayUnion(newCardObj),
      });

      store.addCardLocally(deck.id, newCardObj);
      setStudyQueue((prev) => [...prev, newCardObj]);

      setEditSuccessMessage("Đã thêm một thẻ mới vào bộ học tập!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/${deck.id}`);
    } finally {
      setIsUpdatingCard(false);
    }
  };

  const handleRemoveCard = async (targetCard: Flashcard) => {
    if (!deck || !canEditDeck) return;
    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");

      const targetDeckId = (targetCard as any).originDeckId || deck.id;
      const docRef = doc(db, "sets", targetDeckId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentCards = data.cards || [];
        const filteredCards = currentCards.filter(
          (c: any) => c.id !== targetCard.id,
        );
        await updateDoc(docRef, {
          cards: filteredCards,
        });
      }

      store.removeCardLocally(targetDeckId, targetCard.id);
      setStudyQueue((prev) => prev.filter((c) => c.id !== targetCard.id));

      setEditSuccessMessage("Đã xóa thẻ thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/`);
    } finally {
      setIsUpdatingCard(false);
    }
  };

  const handleVirtualPlayCard = useCallback((c: Flashcard) => {
    setStudyQueue(prevQueue => {
      const indexInQueue = prevQueue.findIndex((qCard) => qCard.id === c.id);
      if (indexInQueue !== -1) {
        setCurrentIndex(indexInQueue);
        setIsFlipped(false);
      }
      return prevQueue;
    });
  }, []);

  const filteredCards = useMemo(() => {
    if (!deck?.cards) return [];
    const query = listSearchQuery.toLowerCase().trim();
    if (!query) return deck.cards;
    return deck.cards.filter(
      (c) =>
        (c.front || "").toLowerCase().includes(query) ||
        (c.back || "").toLowerCase().includes(query) ||
        (c.wordForm || "").toLowerCase().includes(query)
    );
  }, [deck?.cards, listSearchQuery]);

  const handleSelectCardFromList = useCallback((card: Flashcard) => {
    if (!deck) return;
    
    let targetQueue = studyQueue;
    const indexInQueue = studyQueue.findIndex((qCard) => qCard.id === card.id);
    
    if (indexInQueue === -1) {
      targetQueue = deck.cards || [];
      setStudyQueue(targetQueue);
      setStudyMode("all");
      setFinished(false);
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
    }
    
    const finalIndex = targetQueue.findIndex((qCard) => qCard.id === card.id);
    if (finalIndex !== -1) {
      setCurrentIndex(finalIndex);
    }
    setIsFlipped(false);
    setIsListModalOpen(false);
  }, [deck, studyQueue, isPinned]);

  const handleVirtualEditCard = useCallback((c: Flashcard) => {
    setStudyQueue(prevQueue => {
      const indexInQueue = prevQueue.findIndex((qCard) => qCard.id === c.id);
      if (indexInQueue !== -1) {
        setCurrentIndex(indexInQueue);
      }
      return prevQueue;
    });
    setEditFront(c.front);
    setEditBack(c.back);
    setEditExampleSentence(c.example_sentence || "");
    setIsEditing(true);
    window.scrollTo({ top: 300, behavior: "smooth" });
  }, []);

  const handleVirtualDeleteCard = useCallback((c: Flashcard) => {
    handleRemoveCard(c);
  }, [handleRemoveCard]);

  if (finished) {
    const percentage =
      studyQueue.length > 0
        ? Math.round((sessionCorrectCount / studyQueue.length) * 100)
        : 0;
    const memoryProjection = Math.round(percentage * 0.7);

    // Compute Benchmark Stats
    const sessionCardsMasteryAvg = studyQueue.length
      ? Math.round(
          studyQueue.reduce((sum, c) => sum + (Number(c.mastery) || 0), 0) /
            studyQueue.length,
        )
      : 0;

    const currentDeckMasteryAvg = deck?.cards?.length
      ? Math.round(
          deck.cards.reduce(
            (sum: number, c: any) => sum + (c.mastery || 0),
            0,
          ) / deck.cards.length,
        )
      : 0;

    let weeklyAvgMastery = 0;
    if (user) {
      const allDecks = store.getDecks();
      const allCards = allDecks.flatMap((d) => d.cards || []);

      const userHistory = store.getReviewHistory(user.id);
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weeklyReviews = userHistory.filter(
        (r) => r.timestamp >= oneWeekAgo,
      );

      if (weeklyReviews.length > 0) {
        const reviewedCardIds = new Set(weeklyReviews.map((r) => r.cardId));
        const reviewedCards = allCards.filter((c) => reviewedCardIds.has(c.id));
        if (reviewedCards.length > 0) {
          weeklyAvgMastery = Math.round(
            reviewedCards.reduce((sum, c) => sum + (c.mastery || 0), 0) /
              reviewedCards.length,
          );
        }
      }

      if (weeklyAvgMastery === 0 && allCards.length > 0) {
        weeklyAvgMastery = Math.round(
          allCards.reduce((sum, c) => sum + (c.mastery || 0), 0) /
            allCards.length,
        );
      }
    }

    if (weeklyAvgMastery === 0) {
      weeklyAvgMastery = 50;
    }

    const deltaMastery = sessionCardsMasteryAvg - weeklyAvgMastery;

    return (
      <div className="flex items-center justify-center min-h-[80vh] py-8 animate-in zoom-in-95 duration-500 px-4">
        <div className="glass p-6 md:p-10 rounded-3xl max-w-5xl w-full space-y-8 relative z-10">
          {/* Header Section */}
          <div className="text-center space-y-2 relative">
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -20, y: 20 }}
              animate={{
                scale: [0, 1.2, 1],
                opacity: 1,
                rotate: [-20, 10, -5, 0],
                y: 0,
              }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 10,
              }}
              className="absolute -top-10 md:-top-16 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <span className="text-4xl md:text-5xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-lg">
                GREAT JOB!
              </span>
            </motion.div>
            <div className="mt-8 inline-flex items-center justify-center bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-sm font-bold border border-orange-500/20">
              🎉 HOÀN THÀNH PHIÊN HỌC
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-display text-zinc-800 dark:text-zinc-100 mt-4">
              Chúc Mừng Bạn Đã Học Xong!
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Metrics and Control Buttons */}
            <div className="lg:col-span-5 space-y-6">
              {/* Circular Percentage and quick view */}
              <div className="bg-zinc-200/50 dark:bg-zinc-800/40 p-6 rounded-2xl border border-orange-600/10 dark:border-orange-500/20 flex flex-col items-center">
                <div className="relative w-36 h-36 flex flex-col items-center justify-center mb-4">
                  <div className="absolute inset-0 bg-orange-500/10 rounded-full animate-pulse"></div>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 text-zinc-500 dark:text-zinc-400">
                    Tỷ lệ đúng
                  </span>
                  <span className="text-4xl font-display font-black text-orange-600 dark:text-orange-400">
                    {percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full text-center">
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-zinc-800 dark:text-zinc-200">
                      {studyQueue.length}
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Đã ôn
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-orange-600 dark:text-orange-400">
                      {Math.floor(sessionTimeSpent / 60) > 0
                        ? `${Math.floor(sessionTimeSpent / 60)}m `
                        : ""}
                      {sessionTimeSpent % 60}s
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Thời gian
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span
                      className={cn(
                        "block text-lg font-black",
                        sessionMasteryGained >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500",
                      )}
                    >
                      {sessionMasteryGained > 0 ? "+" : ""}
                      {sessionMasteryGained}
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Thông thạo
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-blue-600 dark:text-blue-400">
                      +{memoryProjection}%
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Ghi nhớ
                    </span>
                  </div>
                </div>
              </div>

              {/* Motivation quote card */}
              <div className="p-5 bg-zinc-200/40 dark:bg-zinc-800/20 rounded-2xl border-l-4 border-orange-500 text-left">
                <p className="font-serif italic text-sm opacity-85 leading-relaxed">
                  "{quote}"
                </p>
              </div>

              {/* Actions list */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={startReviewAll}
                  className="w-full px-5 py-3.5 rounded-xl bg-zinc-300/60 dark:bg-zinc-800/80 font-bold hover:bg-black/20 dark:hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm border border-zinc-400/20 dark:border-zinc-700/40"
                >
                  <RefreshCcw className="w-4 h-4 text-orange-500" />
                  Ôn tập lại từ đầu (Review All)
                </button>
                {weakCardIds.length > 0 && (
                  <button
                    onClick={startReviewXCards}
                    className="w-full px-5 py-3.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-500 hover:text-white transition flex items-center justify-center gap-2 text-sm border border-red-500/20"
                  >
                    <X className="w-4 h-4" />
                    Ôn tập thẻ X ({weakCardIds.length})
                  </button>
                )}
                <button
                  onClick={handleBack}
                  className="w-full px-5 py-3.5 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-600 transition shadow-lg flex items-center justify-center gap-2 text-sm border-none cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {isAdminMode ? "Trở về Admin View" : "Trở về Dashboard"}
                </button>
              </div>
            </div>

            {/* Right Column: Beautiful Interactive Session Progress Chart */}
            <div className="lg:col-span-7 bg-zinc-200/40 dark:bg-zinc-800/30 p-5 md:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-350 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-base font-display">
                    Biểu Đồ Tiến Trình Phiên Học
                  </h3>
                </div>
                <div className="flex gap-1 bg-zinc-300/40 dark:bg-zinc-900/50 p-1 rounded-lg self-start">
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 px-2 py-1 font-mono uppercase bg-orange-500/10 rounded-md">
                    Chính Xác & Độ Thông Thạo
                  </span>
                </div>
              </div>

              {/* The Chart container */}
              <div className="h-64 sm:h-72 w-full">
                {sessionHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={sessionHistory}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="accuracyGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f59e0b"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f59e0b"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="masteryGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#888888"
                        strokeOpacity={0.1}
                      />
                      <XAxis
                        dataKey="cardIndex"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        label={{
                          value: "Số thẻ học",
                          position: "insideBottom",
                          offset: -5,
                          fill: "#888888",
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(28, 25, 23, 0.95)",
                          borderColor: "#f59e0b",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "accuracy")
                            return [`${value}%`, "Độ chính xác tích lũy"];
                          if (name === "masteryChange")
                            return [
                              `${value > 0 ? "+" : ""}${value}`,
                              "Thay đổi thông thạo",
                            ];
                          return [value, name];
                        }}
                        labelFormatter={(label) =>
                          `Thẻ số ${label} (Mặt trước: "${sessionHistory[Number(label) - 1]?.front || ""}")`
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#accuracyGrad)"
                        name="accuracy"
                      />
                      <Area
                        type="monotone"
                        dataKey="masteryChange"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#masteryGrad)"
                        name="masteryChange"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-60 text-sm italic">
                    Không có đủ dữ liệu để dựng biểu đồ. Hãy thử học một vài thẻ
                    trước!
                  </div>
                )}
              </div>

              {/* Difficult Cards List */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Thẻ Bạn Cần Ôn Tập Lại (Điểm Yếu)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {sessionHistory.filter((item) => item.status === "incorrect")
                    .length > 0 ? (
                    sessionHistory
                      .filter((item) => item.status === "incorrect")
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl text-sm flex flex-col justify-between border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                        >
                          <div className="flex justify-between font-bold opacity-70 mb-2 border-b border-red-500/10 pb-1 text-red-700 dark:text-red-400">
                            <span>Card #{item.cardIndex}</span>
                            <span className="uppercase text-[10px] tracking-widest border border-red-500/30 px-1.5 rounded-sm">
                              Ghi nhớ lại
                            </span>
                          </div>
                          <p
                            className="font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2"
                            title={item.front}
                          >
                            {item.front}
                          </p>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-full p-4 text-center rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm font-medium">
                      Tuyệt vời! Bạn không gặp khó khăn với thẻ nào trong phiên
                      này.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Benchmark Card */}
          <div className="bg-zinc-200/40 dark:bg-zinc-800/20 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-300 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
                  <BarChart3 className="w-5 h-5 px-0.5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg font-display">
                    Bảng So Sánh Chỉ Số Thông Thạo (Benchmarks)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Đo lường sự tiến bộ của phiên này đối với phong độ thông
                    thạo hàng tuần của bạn
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {deltaMastery >= 0 ? (
                  <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-full border border-green-500/20">
                    ▲ Vượt chỉ số tuần: +{deltaMastery}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/20">
                    ▼ Dưới chỉ số tuần: {deltaMastery}%
                  </span>
                )}
              </div>
            </div>

            {/* Benchmark Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Current Session average card */}
              <div className="bg-zinc-300/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-400/10 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400">
                    Phiên học này
                  </span>
                  <div className="text-4xl font-extrabold font-display text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-500 dark:from-orange-400 dark:to-orange-300 mt-1">
                    {sessionCardsMasteryAvg}%
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                    Mức độ thông thạo trung bình các thẻ đã trả lời trong phiên
                    này.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold opacity-75">
                  <span>Đánh giá:</span>
                  <span
                    className={cn(
                      sessionCardsMasteryAvg >= 80
                        ? "text-green-600 dark:text-green-400"
                        : sessionCardsMasteryAvg >= 50
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-red-500",
                    )}
                  >
                    {sessionCardsMasteryAvg >= 80
                      ? "Xuất sắc (80%+)"
                      : sessionCardsMasteryAvg >= 50
                        ? "Khá giỏi (50%+)"
                        : "Cần rèn luyện thêm"}
                  </span>
                </div>
              </div>

              {/* Card 2: Weekly average card */}
              <div className="bg-zinc-300/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-400/10 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400">
                    Chỉ số Trung Bình Tuần
                  </span>
                  <div className="text-4xl font-extrabold font-display text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300 mt-1">
                    {weeklyAvgMastery}%
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                    Phong độ thông thạo bao gồm tất cả các thẻ bạn đã ôn trong
                    tuần qua.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold opacity-75">
                  <span>Trạng thái tuần:</span>
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                    Tăng trưởng ổn định
                  </span>
                </div>
              </div>

              {/* Card 3: Comparison and performance advice card */}
              <div className="bg-zinc-300/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-400/10 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400">
                    Phân Tích & Gợi Ý
                  </span>
                  <div className="mt-2">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold">
                      {deltaMastery > 0
                        ? `🎉 Thật tuyệt vời! Phiên học này của bạn vượt mức trung bình tuần (+${deltaMastery}%). Hãy luôn giữ nhịp độ này để bứt phá học tập!`
                        : deltaMastery === 0
                          ? `📈 Phong độ rất tốt! Chỉ số thông thạo phiên hôm nay khớp hoàn hảo với trung bình hoạt động tuần trước.`
                          : `💪 Chưa đạt trung bình tuần (thấp hơn ${Math.abs(deltaMastery)}%). Cố gắng rèn luyện lại với nút "Ôn tập thẻ X" để bứt phá điểm số!`}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-zinc-300 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        deltaMastery >= 0 ? "bg-green-500" : "bg-orange-500",
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(10, 50 + deltaMastery * 2))}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-bold mt-1 uppercase font-mono tracking-wider">
                    <span>Thấp hơn</span>
                    <span>Tương đương</span>
                    <span>Vượt trội</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual comparative bar scale */}
            <div className="bg-zinc-300/20 dark:bg-zinc-900/20 p-4 rounded-2xl border border-zinc-400/5 dark:border-zinc-800/50 space-y-4">
              <span className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                Thang So Sánh Điểm Số Trực Quan (%)
              </span>
              <div className="space-y-4">
                {/* Current Session Bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      Chỉ số Thông Thạo Phiên Học Nay
                    </span>
                    <span className="font-extrabold text-orange-600 dark:text-orange-400">
                      {sessionCardsMasteryAvg}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-300/50 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${sessionCardsMasteryAvg}%` }}
                    ></div>
                  </div>
                </div>

                {/* Weekly Average Bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      Chỉ số Trung Bình Hoạt Động Tuần (Weekly Average
                      Benchmark)
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                      {weeklyAvgMastery}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-300/50 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${weeklyAvgMastery}%` }}
                    ></div>
                  </div>
                </div>

                {/* Current Deck Bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      Chỉ số Thông Thạo Của Bộ Thẻ Đang Học (Deck Average)
                    </span>
                    <span className="font-extrabold text-zinc-650 dark:text-zinc-400">
                      {currentDeckMasteryAvg}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-300/50 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-400/60 dark:bg-zinc-600 rounded-full"
                      style={{ width: `${currentDeckMasteryAvg}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500 text-center max-w-md mx-auto p-4">
        <div className="text-4xl">🔒</div>
        <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-display">Quyền truy cập bị từ chối</div>
        <div className="text-sm text-zinc-500">Bộ học này là bộ thẻ cá nhân riêng tư. Chỉ người tạo mới được quyền truy cập học tập.</div>
        <button
          onClick={handleBack}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-black font-extrabold rounded-xl transition border-none cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500">
        <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <div>Đang tải phòng học...</div>
      </div>
    );

  if (!deck)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div>Không tìm thấy bộ thẻ (ID: {deckId || 'undefined'}).</div>
        <button
          onClick={handleBack}
          className="px-6 py-2 rounded-lg bg-orange-500 text-black font-bold hover:bg-orange-600 transition border-none cursor-pointer"
        >
          {isAdminMode ? "Về Admin View" : "Về Dashboard"}
        </button>
      </div>
    );

  if (!currentCard || studyQueue.length === 0)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div>No cards in this view.</div>
        <button
          onClick={startReviewAll}
          className="px-6 py-2 rounded-lg bg-orange-500 text-black font-bold hover:bg-orange-600 transition"
        >
          Quay lại bộ đầy đủ
        </button>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6 w-full max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-4">
            <div className="flex items-center justify-between sm:justify-start gap-4 flex-wrap">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 opacity-60 hover:opacity-100 transition w-fit bg-transparent border-none text-inherit cursor-pointer p-0 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              {showRemindToast && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm animate-in slide-in-from-top flex items-center gap-2">
                  <BellPlus className="w-4 h-4" />
                  Đã lưu vào danh sách nhắc nhở!
                </div>
              )}

              <button
                onClick={handleToggleMute}
                className="p-2 bg-zinc-200/60 dark:bg-zinc-800/50 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
                title={!isSoundEnabled ? "Unmute sounds" : "Mute sounds"}
                aria-label={!isSoundEnabled ? "Unmute sounds" : "Mute sounds"}
              >
                {!isSoundEnabled ? (
                  <VolumeX className="w-4 h-4 text-red-500" />
                ) : (
                  <Volume2 className="w-4 h-4 opacity-70" />
                )}
              </button>

              <button
                onClick={() => {
                   navigator.clipboard.writeText(window.location.href);
                   toast("Đã copy link! Gửi cho bạn bè để cùng học set này nhé.");
                }}
                className="flex items-center gap-1.5 p-2 px-3 bg-zinc-200/60 dark:bg-zinc-800/50 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition text-xs font-bold"
                title="Chia sẻ link"
              >
                <Share2 className="w-4 h-4" /> Share Link
              </button>
              <div className="flex items-center gap-2 bg-zinc-200/60 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full border border-orange-600/10 dark:border-orange-500/10">
                <Clock className="w-4 h-4 opacity-70" />
                <span className="font-mono font-bold text-sm min-w-[40px] text-center">
                  {formatTime(timerSeconds)}
                </span>
                <button
                  onClick={toggleTimer}
                  className="hover:text-orange-600 dark:hover:text-orange-400 transition"
                  title={isTimerRunning ? "Pause Timer" : "Start Pomodoro"}
                  aria-label={isTimerRunning ? "Pause Timer" : "Start Pomodoro"}
                >
                  {isTimerRunning ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                {isTimerFinished && (
                  <span className="text-xs text-green-500 font-bold animate-pulse ml-1 text-[10px] uppercase">
                    +25pts!
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleToggleOffline}
                className={cn(
                  "p-2 rounded-full transition flex items-center justify-center relative",
                  isOfflineSaved
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 font-bold"
                    : "bg-zinc-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
                )}
                title={isOfflineSaved ? "Xóa bản lưu ngoại tuyến" : "Tải xuống dùng khi ngoại tuyến"}
                aria-label="Toggle Offline Mode"
              >
                <div className={cn("w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5", isOfflineSaved ? "bg-emerald-500" : "bg-transparent")} />
                <Network className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportDeck}
                className="p-2 bg-zinc-200/60 dark:bg-zinc-800/50 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition text-zinc-600 dark:text-zinc-300"
                title="Xuất bộ thẻ (JSON)"
                aria-label="Export Deck"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={startReviewAll}
                className={cn(
                  "px-3 py-1 rounded text-sm font-bold transition",
                  studyMode === "all"
                    ? "bg-orange-500 text-black shadow"
                    : "bg-zinc-200/60 dark:bg-zinc-800/50 opacity-70",
                )}
              >
                Tất cả
              </button>
              <button
                onClick={startReviewXCards}
                className={cn(
                  "px-3 py-1 rounded text-sm font-bold transition flex items-center gap-1",
                  studyMode === "weak"
                    ? "bg-red-500 text-white shadow"
                    : "bg-zinc-200/60 dark:bg-zinc-800/50 opacity-70",
                )}
              >
                Thẻ X{" "}
                <span className="bg-black/20 px-1.5 rounded-full text-xs">
                  {weakCardIds.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setListSearchQuery("");
                  setIsListModalOpen(true);
                }}
                className="px-3 py-1 rounded text-sm font-bold bg-zinc-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition flex items-center gap-1.5 focus:outline-none cursor-pointer"
                title="Xem danh sách toàn bộ thẻ"
              >
                <Eye className="w-4 h-4 text-orange-500" />
                <span>Xem danh sách</span>
              </button>
              <button
                onClick={() => {
                  const newMode = !isClozeMode;
                  setIsClozeMode(newMode);
                  localStorage.setItem("study_cloze_mode", String(newMode));
                }}
                className={cn(
                  "px-3 py-1 rounded text-sm font-bold transition flex items-center gap-1.5 cursor-pointer",
                  isClozeMode
                    ? "bg-orange-500 text-black shadow"
                    : "bg-zinc-200/60 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 opacity-70 hover:opacity-100",
                )}
                title="Bật/Tắt chế độ đục lỗ (học qua câu ví dụ)"
              >
                <span>{isClozeMode ? "🟢 Đục lỗ" : "⚪ Đục lỗ"}</span>
              </button>
              {isClozeMode && !isFlipped && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHintRevealed((prev) => !prev);
                  }}
                  className={cn(
                    "px-3 py-1 rounded text-sm font-bold transition flex items-center gap-1.5 cursor-pointer animate-in zoom-in-95 duration-150",
                    isHintRevealed
                      ? "bg-blue-500 text-white shadow"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800",
                  )}
                  title="Hiện gợi ý chữ cái đầu của từ"
                >
                  <span>💡 Gợi ý</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-mono opacity-60 px-2 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Card {currentIndex + 1} of {studyQueue.length}
              </span>
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Bạn có chắc chắn muốn học lại từ đầu bộ học này không?")) {
                      setCurrentIndex(0);
                      if (deck) {
                        const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
                        localStorage.setItem(progressKey, "0");
                      }
                    }
                  }}
                  className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline bg-orange-500/10 dark:bg-orange-500/5 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                >
                  <RefreshCcw className="w-2.5 h-2.5" /> Học lại từ đầu
                </button>
              )}
            </div>
            <span>Sub: {currentCard.subject}</span>
          </div>

          <div
            className="perspective-1000 relative w-full min-h-[400px] h-[400px] md:h-[450px] cursor-pointer group"
            onClick={handleFlip}
          >
            <motion.div
              className="w-full h-full transform-style-3d rounded-3xl"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={isFixLagEnabled ? { duration: 0 } : {
                type: "spring",
                stiffness: 220,
                damping: 25,
                mass: 1,
              }}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl rounded-3xl text-center h-full overflow-y-auto w-full">
                <div className="w-full min-h-full flex flex-col items-center justify-center p-8">
                  {canEditDeck &&
                    !isEditing && (
                      <button
                        onClick={handleEditOpen}
                        className="absolute top-4 right-4 z-20 p-2 bg-zinc-300/60 dark:bg-zinc-800/80 rounded-full hover:bg-black/20 dark:hover:bg-white/20 transition"
                      >
                        <Edit3 className="w-5 h-5 text-blue-500" />
                      </button>
                    )}
                  {!isEditing ? (
                    <div className="relative flex flex-col items-center justify-center min-h-[60px] w-full px-8">
                      {currentCard?.wordForm && (
                        <span
                          className={cn(
                            "text-[12px] uppercase font-bold tracking-wider mb-2 px-3 py-1 rounded shadow-sm",
                            currentCard.wordForm
                              .toLowerCase()
                              .includes("noun") ||
                              currentCard.wordForm.toLowerCase() === "n"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"
                              : currentCard.wordForm
                                    .toLowerCase()
                                    .includes("verb") ||
                                  currentCard.wordForm.toLowerCase() === "v"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                                : currentCard.wordForm
                                      .toLowerCase()
                                      .includes("adj")
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50"
                                  : currentCard.wordForm
                                        .toLowerCase()
                                        .includes("adv")
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                                    : currentCard.wordForm
                                          .toLowerCase()
                                          .includes("idiom") ||
                                        currentCard.wordForm
                                          .toLowerCase()
                                          .includes("colloc")
                                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50"
                                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700",
                          )}
                        >
                          [{currentCard.wordForm}]
                        </span>
                      )}
                      {isClozeMode ? (
                        <div className="py-4 w-full flex justify-center items-center">
                          {renderStudyCloze()}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full relative">
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-center max-w-[85%]">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {currentCard?.front ||
                                (currentCard as any)?.word ||
                                "Chưa có nội dung mặt trước. Vui lòng cập nhật."}
                            </ReactMarkdown>
                          </h2>
                          {(() => {
                            const frontText = currentCard?.front || (currentCard as any)?.word || "";
                            const check = detectLanguage(frontText);
                            if (!check.isAvailable) return null;
                            return (
                              <button
                                onClick={(e) =>
                                  handleListen(e, frontText, check.locale)
                                }
                                className="shrink-0 p-2.5 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95"
                                title={`Nghe phát âm (${check.locale === "vi-VN" ? "Tiếng Việt" : "Tiếng Anh"}) [Phím L]`}
                                aria-label="Nghe phát âm"
                              >
                                <Volume2 className="w-5 h-5" />
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="w-full space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deleteCountdown !== null ? (
                        <div className="w-full p-6 bg-red-500/10 dark:bg-red-500/5 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-200">
                          <div className="p-3 bg-red-500/20 text-red-600 dark:text-red-400 rounded-full animate-bounce">
                            <AlertCircle className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Xác nhận xóa thẻ học</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Bạn có chắc chắn muốn xóa? Nút xác nhận sẽ mở sau <span className="font-extrabold text-red-500 text-sm animate-pulse">{deleteCountdown}s</span>
                            </p>
                          </div>
                          <div className="flex gap-3 w-full">
                            <button
                              onClick={(e) => cancelDeleteCountdown(e)}
                              className="flex-1 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              disabled={deleteCountdown > 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                executeActiveCardDeletion();
                              }}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition",
                                deleteCountdown > 0 
                                  ? "bg-red-500/30 text-red-500/50 cursor-not-allowed" 
                                  : "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                              )}
                            >
                              Xác nhận xóa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            className="w-full p-4 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-center"
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            placeholder="Mặt trước..."
                            rows={2}
                          />
                          <textarea
                            className="w-full p-4 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-sm text-center"
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            placeholder="Mặt sau..."
                            rows={3}
                          />
                          <textarea
                            className="w-full p-3 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-xs text-center animate-in slide-in-from-top-2 duration-200"
                            value={editExampleSentence}
                            onChange={(e) => setEditExampleSentence(e.target.value)}
                            placeholder="Câu ví dụ đục lỗ. Đặt từ cần đố trong ngoặc vuông, ví dụ: 'To [debunk] a myth is to prove it wrong.'..."
                            rows={2}
                          />
                          <div className="flex gap-3 w-full">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition text-sm cursor-pointer"
                            >
                              Lưu Thay Đổi
                            </button>
                            <button
                              onClick={(e) => startDeleteCountdown(e)}
                              className="py-2.5 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold transition text-sm flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Xóa thẻ
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl rounded-3xl text-center h-full overflow-y-auto w-full">
                <div className="w-full min-h-full flex flex-col items-center justify-center p-8 text-lg opacity-90">
                  {canEditDeck &&
                    !isEditing && (
                      <button
                        onClick={handleEditOpen}
                        className="absolute top-4 right-4 z-20 p-2 bg-zinc-300/60 dark:bg-zinc-800/80 rounded-full hover:bg-black/20 dark:hover:bg-white/20 transition"
                      >
                        <Edit3 className="w-5 h-5 text-blue-500" />
                      </button>
                    )}
                  {!isEditing ? (
                    <div className="w-full flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 py-4 relative">
                      <div className="max-w-[85%] text-center">
                        <ParsedTextContent
                          text={
                            currentCard?.back ||
                            (currentCard as any)?.meaning ||
                            "Chưa có thông tin mặt sau"
                          }
                        />
                      </div>
                      {(() => {
                        const backText = currentCard?.back || (currentCard as any)?.meaning || "";
                        const check = detectLanguage(backText);
                        if (!check.isAvailable) return null;
                        return (
                          <button
                            onClick={(e) =>
                              handleListen(e, backText, check.locale)
                            }
                            className="shrink-0 p-2.5 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95"
                            title={`Nghe phát âm (${check.locale === "vi-VN" ? "Tiếng Việt" : "Tiếng Anh"}) [Phím L]`}
                            aria-label="Nghe phát âm"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                        );
                      })()}
                    </div>
                  ) : (
                    <div
                      className="w-full space-y-4 bg-white dark:bg-black/90 p-4 rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deleteCountdown !== null ? (
                        <div className="w-full p-6 bg-red-500/10 dark:bg-red-500/5 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-200">
                          <div className="p-3 bg-red-500/20 text-red-600 dark:text-red-400 rounded-full animate-bounce">
                            <AlertCircle className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Xác nhận xóa thẻ học</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Bạn có chắc chắn muốn xóa? Nút xác nhận sẽ mở sau <span className="font-extrabold text-red-500 text-sm animate-pulse">{deleteCountdown}s</span>
                            </p>
                          </div>
                          <div className="flex gap-3 w-full">
                            <button
                              onClick={(e) => cancelDeleteCountdown(e)}
                              className="flex-1 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              disabled={deleteCountdown > 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                executeActiveCardDeletion();
                              }}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition",
                                deleteCountdown > 0 
                                  ? "bg-red-500/30 text-red-500/50 cursor-not-allowed" 
                                  : "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                              )}
                            >
                              Xác nhận xóa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            className="w-full p-3 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-base"
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            placeholder="Mặt trước..."
                            rows={2}
                          />
                          <textarea
                            className="w-full p-3 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-sm"
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            placeholder="Mặt sau..."
                            rows={3}
                          />
                          <textarea
                            className="w-full p-3 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-xs animate-in slide-in-from-top-2 duration-200"
                            value={editExampleSentence}
                            onChange={(e) => setEditExampleSentence(e.target.value)}
                            placeholder="Câu ví dụ đục lỗ. Đặt từ cần đố trong ngoặc vuông, ví dụ: 'To [debunk] a myth is to prove it wrong.'..."
                            rows={2}
                          />
                          <div className="flex gap-3 w-full">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition text-sm cursor-pointer"
                            >
                              Lưu Thay Đổi
                            </button>
                            <button
                              onClick={(e) => startDeleteCountdown(e)}
                              className="py-2.5 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold transition text-sm flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Xóa thẻ
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            {/* Buttons now ALWAYS SHOW on both front and back sides */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 border-orange-600/20 dark:border-orange-500/30">
              <div className="flex justify-center gap-4 md:gap-6 items-center flex-wrap">
                {/* Lùi Thẻ */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevCard();
                    }}
                    disabled={currentIndex === 0}
                    title="Quay lại thẻ trước [← khi chưa lật]"
                    aria-label="Quay lại thẻ trước"
                    className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition shadow-sm hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 flex flex-col items-center tracking-wider">
                    <span>Lùi thẻ</span>
                    <span className="text-[8px] opacity-70 font-mono">← chưa lật</span>
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => handleMark(false)}
                    title="Chưa thuộc (Đánh dấu X) [Phím Left khi đã lật]"
                    aria-label="Đánh dấu chưa thuộc"
                    className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm hover:scale-105 active:scale-95"
                  >
                    <X className="w-8 h-8" />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 tracking-widest">
                    <kbd className="px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded-md font-mono text-[9px]">
                      ←
                    </kbd>{" "}
                    Quên
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 mt-4">
                  <button
                    onClick={handleRemindLater}
                    title="Remind me later (Nhắc lại sau) [Phím Down]"
                    aria-label="Nhắc lại sau"
                    className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition shadow-sm hover:scale-105 active:scale-95"
                  >
                    <BellPlus className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 tracking-widest">
                    <kbd className="px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded-md font-mono text-[9px]">
                      ↓
                    </kbd>{" "}
                    Sau
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => handleMark(true)}
                    title="Đã thuộc (Đánh dấu Check) [Phím Right khi đã lật]"
                    aria-label="Đánh dấu đã thuộc"
                    className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition shadow-sm hover:scale-105 active:scale-95"
                  >
                    <Check className="w-8 h-8" />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 tracking-widest">
                    <kbd className="px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded-md font-mono text-[9px]">
                      →
                    </kbd>{" "}
                    Nhớ
                  </span>
                </div>

                {/* Tiến Thẻ */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextCard();
                    }}
                    title="Qua thẻ tiếp theo [→ khi chưa lật]"
                    aria-label="Qua thẻ tiếp theo"
                    className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 flex flex-col items-center tracking-wider">
                    <span>Kế tiếp</span>
                    <span className="text-[8px] opacity-70 font-mono">→ chưa lật</span>
                  </span>
                </div>
              </div>
              <div className="text-center mt-3 opacity-50 text-[11px] font-medium hidden sm:block">
                Mẹo: Nhấn{" "}
                <kbd className="px-1.5 py-0.5 bg-zinc-300 dark:bg-zinc-800 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-300 shadow-sm border border-zinc-400 dark:border-zinc-600">
                  Space
                </kbd>{" "}
                hoặc{" "}
                <kbd className="px-1.5 py-0.5 bg-zinc-300 dark:bg-zinc-800 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-300 shadow-sm border border-zinc-400 dark:border-zinc-600">
                  ↑
                </kbd>{" "}
                để lật thẻ,{" "}
                <kbd className="px-1.5 py-0.5 bg-zinc-300 dark:bg-zinc-800 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-300 shadow-sm border border-zinc-400 dark:border-zinc-600">
                  L
                </kbd>{" "}
                để nghe phát âm
              </div>
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleReportError}
                  className="text-[11px] font-medium text-red-500/80 hover:text-red-500 dark:text-red-400/80 dark:hover:text-red-400 transition flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-full"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Báo cáo lỗi thẻ
                </button>
              </div>
            </div>

            <div className="w-full h-px bg-orange-600/20 dark:bg-orange-500/30 my-2" />

            {/* Agent 2 Deep Extract Button */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {(!deepExplanation || isPinned) && (
                <button
                  onClick={handleAgent2}
                  disabled={isExtracting || cooldownRemaining > 0}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 glass rounded-xl text-md font-bold border border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10 transition text-orange-700 dark:text-orange-400 shadow-sm",
                    cooldownRemaining > 0 &&
                      "opacity-50 cursor-not-allowed border-orange-500/10",
                  )}
                >
                  <Sparkles
                    className={cn(
                      "w-5 h-5 text-orange-500",
                      cooldownRemaining > 0 && "animate-pulse",
                    )}
                  />
                  {isExtracting
                    ? "Đang Bóc Tách Chuyên Sâu..."
                    : cooldownRemaining > 0
                      ? `Sạc năng lượng AI (Chờ ${cooldownRemaining}s)...`
                      : "Bóc Tách Sâu (Agent 2)"}
                </button>
              )}

              {deepExplanation && (
                <div
                  className={cn(
                    "text-base animate-in fade-in leading-relaxed border-t-4 border-orange-500 shadow-lg bg-gradient-to-b from-orange-500/10 to-background",
                    isSerif ? "font-serif" : "font-sans",
                    isPinned
                      ? isMinimized
                        ? "fixed bottom-4 right-4 z-50 w-auto glass px-6 py-3 rounded-full cursor-pointer hover:scale-105 transition-transform"
                        : "fixed bottom-4 right-4 z-50 w-[90%] md:w-96 max-h-[50vh] overflow-y-auto glass p-6 rounded-2xl shadow-2xl"
                      : "glass p-6 xl:p-8 rounded-xl",
                  )}
                  onClick={() => {
                    if (isPinned && isMinimized) setIsMinimized(false);
                  }}
                >
                  {isPinned && isMinimized ? (
                    <div className="flex items-center justify-center font-bold text-orange-600 dark:text-orange-400 gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Agent 2</span>
                      <Maximize2 className="w-4 h-4 ml-2" />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-orange-600/20 dark:border-orange-500/30 sticky top-0 bg-background/80 backdrop-blur-md z-10 p-2 -mx-2 -mt-2">
                        <span className="font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                          <Sparkles className="w-5 h-5" />
                          Agent 2
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsSerif(!isSerif);
                            }}
                            className="p-2 bg-zinc-200/60 dark:bg-zinc-800/50 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition"
                            title="Toggle Font"
                          >
                            <Type className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsPinned(!isPinned);
                              if (isPinned) setIsMinimized(false);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition",
                              isPinned
                                ? "bg-orange-500 text-black shadow-sm"
                                : "bg-zinc-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10",
                            )}
                            title={isPinned ? "Unpin" : "Pin"}
                          >
                            {isPinned ? (
                              <PinOff className="w-4 h-4" />
                            ) : (
                              <Pin className="w-4 h-4" />
                            )}
                          </button>
                          {isPinned && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsMinimized(true);
                              }}
                              className="p-2 bg-zinc-200/60 dark:bg-zinc-800/50 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition"
                              title="Minimize"
                            >
                              <Minimize2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="opacity-95">
                        <ParsedTextContent text={deepExplanation} />
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const event = new CustomEvent("trigger-agent3", {
                              detail: {
                                message:
                                  "Hãy giải thích sâu hơn nữa, hoặc cho tôi ví dụ tình huống về nội dung thẻ này.",
                                context: `Thẻ hiện tại đang học:\nMặt trước: ${currentCard?.front || ""}\nMặt sau: ${currentCard?.back || ""}\nGiải thích Agent 2: ${deepExplanation}`,
                              },
                            });
                            window.dispatchEvent(event);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-sm font-medium text-orange-700 dark:text-orange-400 rounded-lg transition"
                        >
                          <Bot className="w-4 h-4" /> Hỏi tiếp Agent 3
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MỚI: FLASHCARD LIST MANAGER FOR TEACHER & ADMIN */}
          {canEditDeck && (
            <div className="glass p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-300">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-850">
                <div>
                  <h3 className="text-lg font-bold font-display flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                    <BrainCircuit className="w-5 h-5 text-orange-500" /> Quản lý
                    danh sách Thẻ ({deck?.cards.length})
                  </h3>
                  <p className="text-xs opacity-60">
                    Bổ sung hoặc loại bỏ các thẻ học trong bộ bài này
                  </p>
                </div>
                <button
                  onClick={handleAddCard}
                  disabled={isUpdatingCard}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm thẻ học
                </button>
              </div>

              {editSuccessMessage && (
                <div className="mb-4 bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border border-green-500/20">
                  <Check className="w-4 h-4 animate-bounce" />{" "}
                  {editSuccessMessage}
                </div>
              )}

              {/* DECK METADATA EDITOR */}
              <div className="mb-6 p-4 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/50 dark:border-zinc-700/30">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                    Thông tin bộ bài (Metadata)
                  </h4>
                  {!isEditingMetadata && canEditDeck ? (
                    <button
                      onClick={() => setIsEditingMetadata(true)}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditingMetadata(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-bold transition"
                    >
                      Hủy bỏ
                    </button>
                  )}
                </div>

                {!isEditingMetadata ? (
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-bold opacity-60">Tên bộ bài:</span>{" "}
                      {typeof deck?.title === "string"
                        ? deck.title
                        : JSON.stringify(deck?.title)}
                    </p>
                    <p className="text-sm">
                      <span className="font-bold opacity-60">
                        Phân loại (Category):
                      </span>{" "}
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                        {typeof deck?.subject === "string"
                          ? deck.subject
                          : deck?.subject
                            ? JSON.stringify(deck.subject)
                            : "Mặc định"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold opacity-60 uppercase mb-1 block">
                        Tên bộ bài
                      </label>
                      <input
                        type="text"
                        value={deckEditTitle}
                        onChange={(e) => setDeckEditTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        placeholder="Nhập tên bộ bài..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold opacity-60 uppercase mb-1 block">
                        Phân loại (Category)
                      </label>
                      {!isCreatingNewSubjectDeck ? (
                        <div className="flex gap-2">
                          <select
                            value={deckEditSubject}
                            onChange={(e) => {
                              if (e.target.value === "__NEW__") {
                                setIsCreatingNewSubjectDeck(true);
                                setDeckEditSubject("");
                              } else {
                                setDeckEditSubject(e.target.value);
                              }
                            }}
                            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-zinc-50 dark:bg-zinc-900"
                          >
                            <option value="">-- Chọn phân loại hiện có --</option>
                            {existingSubjects.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                            <option
                              value="__NEW__"
                              className="text-blue-600 dark:text-blue-400 font-bold"
                            >
                              + Thêm phân loại mới...
                            </option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewSubjectDeck(true);
                              setDeckEditSubject("");
                            }}
                            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition shadow-md shrink-0 focus:ring-2 focus:ring-blue-500 outline-none"
                            title="Thêm danh mục mới"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={deckEditSubject}
                            onChange={(e) => setDeckEditSubject(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Nhập danh mục mới (VD: Sinh học)"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewSubjectDeck(false);
                              setDeckEditSubject(existingSubjects[0] || "general");
                            }}
                            className="px-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-bold shrink-0"
                          >
                            Quay lại
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={handleUpdateDeckMetadata}
                        disabled={isSavingMetadata || !deckEditTitle.trim()}
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSavingMetadata ? (
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Lưu thông tin
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <VirtualizedFlashcardList
                cards={deck?.cards || []}
                onPlay={handleVirtualPlayCard}
                onEdit={handleVirtualEditCard}
                onDelete={handleVirtualDeleteCard}
                isUpdatingCard={isUpdatingCard}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-4 w-full space-y-6 lg:sticky lg:top-24 mt-6 lg:mt-0">
          {/* Quick Notes Scratchpad Card */}
          <div className="glass p-5 rounded-2xl border border-orange-600/10 dark:border-orange-500/10 shadow-lg flex flex-col space-y-3 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-orange-500" />
                <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 font-display uppercase tracking-wider">
                  Ghi chú nhanh
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono">
                {isNotesSaving ? (
                  <span className="text-orange-500 animate-pulse flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
                    Đang lưu...
                  </span>
                ) : lastNotesSavedTime ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                    <Check className="w-2.5 h-2.5" />
                    Đã lưu {lastNotesSavedTime}
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">Sẵn sàng</span>
                )}
              </div>
            </div>
            
            <textarea
              value={scratchpadText}
              onChange={(e) => setScratchpadText(e.target.value)}
              placeholder="✍️ Nhập nhanh kiến thức trọng tâm, mẹo nhớ, từ khóa vào đây để học lâu nhớ sâu..."
              className="w-full h-44 p-3 text-xs md:text-sm bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-250 dark:border-zinc-800/80 rounded-xl font-sans resize-none outline-none focus:ring-2 focus:ring-orange-500/40 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 leading-relaxed"
            />
            
            <div className="text-[9px] opacity-60 flex justify-between items-center px-1 font-mono">
              <span className="flex items-center gap-1">☁️ Tự động đồng bộ lên mây</span>
              <span>{scratchpadText.length} ký tự</span>
            </div>
          </div>

          <GlobalActivityFeed />
        </div>
      </div>

      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-50 dark:bg-zinc-900 border border-orange-600/20 dark:border-orange-500/30 rounded-2xl p-6 shadow-2xl max-w-4xl w-full flex flex-col h-[85vh]"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-display text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-orange-500 animate-pulse" /> Danh sách thẻ học
                </h3>
                <p className="text-xs opacity-60">
                  Bộ bài: <span className="font-bold">{deck?.title || "Chưa đặt tên"}</span> • Tổng số {deck?.cards?.length || 0} thẻ
                </p>
              </div>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                title="Đóng modal [Esc]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Actions / Search input */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Tìm kiếm mặt trước, mặt sau hoặc phân loại..."
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-800 text-sm text-zinc-850 dark:text-zinc-200"
                />
                <span className="absolute left-3.5 top-3.5 opacity-50 text-xs">🔍</span>
                {listSearchQuery && (
                  <button
                    onClick={() => setListSearchQuery("")}
                    className="absolute right-3.5 top-3 text-xs bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 px-2 py-0.5 rounded transition cursor-pointer text-zinc-700 dark:text-zinc-300"
                  >
                    Xóa
                  </button>
                )}
              </div>
              
              <div className="text-xs font-mono opacity-50 px-1 self-end sm:self-auto">
                Tìm thấy {filteredCards.length} thẻ khớp
              </div>
            </div>

            {/* Modal List Body */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3 scroll-smooth">
              {filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm opacity-60">Không tìm thấy thẻ học nào khớp với từ khóa của ngài.</p>
                  <button
                    onClick={() => setListSearchQuery("")}
                    className="mt-2 text-xs text-orange-500 hover:underline font-bold"
                  >
                    Xóa từ khóa tìm kiếm
                  </button>
                </div>
              ) : (
                filteredCards.map((card, idx) => {
                  const originalIndex = deck?.cards.findIndex((c) => c.id === card.id) ?? idx;
                  return (
                    <div
                      key={card.id}
                      className="p-4 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/40 dark:border-zinc-700/20 hover:border-orange-500/30 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="flex-1 space-y-2 min-w-0 w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300">
                            Thẻ #{originalIndex + 1}
                          </span>
                          {card.wordForm && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                              {card.wordForm}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-250 dark:border-zinc-800/80 text-zinc-850 dark:text-zinc-200 font-sans min-h-[50px] flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">Mặt trước (Front)</span>
                            <div className="text-sm select-text break-words">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {card.front || ""}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-250 dark:border-zinc-800/80 text-zinc-850 dark:text-zinc-200 font-sans min-h-[50px] flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">Mặt sau (Back)</span>
                            <div className="text-sm select-text break-words">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {card.back || ""}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectCardFromList(card)}
                        className="w-full md:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-black font-extrabold rounded-lg text-xs transition active:scale-95 shadow cursor-pointer self-stretch md:self-center"
                        title="Nhảy đến thẻ này để học ngay lập tức"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        Học thẻ này
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex justify-between items-center text-xs opacity-50">
              <span>Bấm nút "Học thẻ này" để bắt đầu ôn từ thẻ đó</span>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg font-bold transition text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
