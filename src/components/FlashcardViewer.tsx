import React, { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase"; 

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  example_sentence?: string;
}

export interface FlashcardViewerProps {
  deckId: string;
  userId: string;
  deckCards: Flashcard[];
}

export default function FlashcardViewer({ deckId, userId, deckCards }: FlashcardViewerProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isClozeMode, setIsClozeMode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHintRevealed, setIsHintRevealed] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset flip and hint state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setIsHintRevealed(false);
  }, [currentCardIndex]);

  useEffect(() => {
    let isMounted = true;
    const fetchProgress = async () => {
      try {
        if (!userId || !deckId) return;
        const deckRef = doc(db, `users/${userId}/decks`, deckId);
        const snap = await getDoc(deckRef);
        let startIdx = 0;
        
        if (snap.exists()) {
          const data = snap.data();
          if (data.lastStudiedIndex && data.lastStudiedIndex > 0) {
            startIdx = data.lastStudiedIndex;
            setToastMessage(`Resumed from card ${startIdx + 1}`);
            setTimeout(() => setToastMessage(null), 3000);
          }
        }
        if (isMounted) {
            setCurrentCardIndex(Math.min(startIdx, Math.max(0, deckCards.length - 1)));
        }
      } catch (err) {
        console.error("Failed to load progress", err);
        if (isMounted) setCurrentCardIndex(0);
      }
    };
    fetchProgress();
    return () => { isMounted = false; };
  }, [deckId, userId, deckCards.length]);

  const syncIndexToFirestore = useCallback((index: number) => {
    if (!userId || !deckId) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    // 2-Second Debounce Mechanism
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const deckRef = doc(db, `users/${userId}/decks`, deckId);
        await updateDoc(deckRef, { lastStudiedIndex: index });
      } catch (err) {
        console.error("Failed to sync progress", err);
      }
    }, 2000);
  }, [deckId, userId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleNext = () => {
    if (currentCardIndex < deckCards.length - 1) {
      const newIdx = currentCardIndex + 1;
      setCurrentCardIndex(newIdx);
      syncIndexToFirestore(newIdx);
    }
  };

  const handlePrev = () => {
    if (currentCardIndex > 0) {
      const newIdx = currentCardIndex - 1;
      setCurrentCardIndex(newIdx);
      syncIndexToFirestore(newIdx);
    }
  };

  if (currentCardIndex === -1) {
    return <div className="p-8 text-center animate-pulse text-zinc-500">Loading deck progress...</div>;
  }
  if (!deckCards || deckCards.length === 0) {
    return <div className="p-8 text-center text-zinc-500">No cards available in this deck.</div>;
  }

  const activeCard = deckCards[currentCardIndex];

  const renderClozeSentence = () => {
    if (!activeCard.example_sentence) return null;
    
    // Finding [targetWord]
    const regex = /\[(.*?)\]/;
    const match = activeCard.example_sentence.match(regex);
    
    if (!match) return activeCard.example_sentence;
    
    const targetWord = match[1];
    const sentenceBefore = activeCard.example_sentence.substring(0, match.index);
    const sentenceAfter = activeCard.example_sentence.substring(match.index! + match[0].length);
    
    const hint = targetWord.charAt(0) + "_".repeat(targetWord.length - 1);
    
    return (
        <p className="text-xl sm:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {sentenceBefore}
            <span className={`px-2 py-0.5 rounded ${isFlipped ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-bold" : "bg-zinc-200 dark:bg-zinc-700 text-transparent"}`}>
                {isFlipped ? targetWord : (isHintRevealed ? hint : "________")}
            </span>
            {sentenceAfter}
        </p>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4 sm:p-8 w-full max-w-2xl mx-auto space-y-6">
      
      {/* Sleek Minimal UI Toast */}
      {toastMessage && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-4 px-4 py-2 bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold rounded-full shadow-lg animate-in fade-in slide-in-from-top-4 z-50">
          {toastMessage}
        </div>
      )}

      {/* Controls: Cloze Toggle & Hint */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsClozeMode(!isClozeMode)}
          className={`text-[10px] font-bold px-3 py-1 rounded-full border transition cursor-pointer ${
            isClozeMode ? "bg-orange-500 text-black border-orange-500" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
          }`}
        >
          {isClozeMode ? "🟢 Đang bật: Chế độ đục lỗ" : "⚪ Chế độ đục lỗ"}
        </button>
        {isClozeMode && !isFlipped && (
          <button
            onClick={() => setIsHintRevealed(true)}
            className="text-[10px] font-bold px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 transition cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            💡 Gợi ý
          </button>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full">
         <div className="flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-widest">
            <span>Progress</span>
            <span>{currentCardIndex + 1} / {deckCards.length}</span>
         </div>
         <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((currentCardIndex + 1) / deckCards.length) * 100}%` }}
            />
         </div>
      </div>

      {/* Card UI */}
      <div 
        className="cursor-pointer w-full aspect-[4/3] sm:aspect-[3/2] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl flex flex-col items-center justify-center text-center p-8 sm:p-12 transition-transform active:scale-98"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {isClozeMode && activeCard.example_sentence ? (
             renderClozeSentence()
        ) : (
             <h2 className="text-2xl sm:text-4xl font-display font-bold text-zinc-900 dark:text-zinc-100 mb-6 leading-tight">
               {isFlipped ? activeCard.back : activeCard.front}
             </h2>
        )}
        
        {/* Only show separator and meaning if not in Cloze Mode or flipped */}
        {!(isClozeMode && !isFlipped && activeCard.example_sentence) && (
            <>
                <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-6" />
                <p className="text-lg sm:text-xl font-medium text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
                  {isFlipped ? (isClozeMode ? activeCard.front : activeCard.front) : activeCard.back}
                </p>
            </>
        )}
      </div>



      {/* Controls */}
      <div className="flex items-center gap-4 w-full">
        <button 
          onClick={handlePrev} 
          disabled={currentCardIndex === 0} 
          className="flex-1 px-6 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button 
          onClick={handleNext} 
          disabled={currentCardIndex === deckCards.length - 1} 
          className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
