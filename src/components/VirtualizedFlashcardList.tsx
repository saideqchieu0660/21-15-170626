import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Play, Edit3, Trash2 } from "lucide-react";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  wordForm?: string;
  [key: string]: any;
}

interface FlashcardRowProps {
  card: Flashcard;
  index: number;
  onPlay: (card: Flashcard) => void;
  onEdit: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
  isUpdatingCard: boolean;
}

const FlashcardRow = React.memo(function FlashcardRow({
  card,
  index,
  onPlay,
  onEdit,
  onDelete,
  isUpdatingCard
}: FlashcardRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Auto-hide confirmation after 3 seconds
  useEffect(() => {
    if (confirmingDelete) {
      const timeout = setTimeout(() => setConfirmingDelete(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [confirmingDelete]);

  if (confirmingDelete) {
    return (
      <div 
        className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-lg border border-red-500/30 flex justify-between items-center gap-3 transition-colors h-[52px]"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">Bạn có chắc chắn muốn xóa thẻ này?</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setConfirmingDelete(false)}
            className="px-2 py-1 text-[10px] font-bold rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => {
              setConfirmingDelete(false);
              onDelete(card);
            }}
            disabled={isUpdatingCard}
            className="px-2 py-1 text-[10px] font-bold rounded bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="p-2 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-lg border border-zinc-200/40 dark:border-zinc-700/20 flex justify-between items-center gap-3 hover:border-orange-500/20 transition-colors h-[52px]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold font-mono opacity-40">
            #{index + 1}
          </span>
          {card.wordForm && (
            <span className="text-[9px] bg-zinc-250 dark:bg-zinc-700 px-1 py-0.2 rounded text-zinc-600 dark:text-zinc-400">
              {card.wordForm}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-2 text-xs text-zinc-700 dark:text-zinc-300">
          <p className="truncate"><span className="font-semibold opacity-50 mr-1 text-[10px]">F:</span>{card.front}</p>
          <p className="truncate opacity-80"><span className="font-semibold opacity-50 mr-1 text-[10px]">B:</span>{card.back}</p>
        </div>
      </div>

      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={() => onPlay(card)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-750 opacity-70 hover:opacity-100 transition-opacity"
          title="Học thẻ này"
        >
          <Play className="w-3.5 h-3.5 text-green-500" />
        </button>
        <button
          onClick={() => onEdit(card)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-750 opacity-70 hover:opacity-100 transition-opacity"
          title="Chỉnh sửa nhanh"
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-500" />
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={isUpdatingCard}
          className="p-1 rounded hover:bg-red-500/10 text-red-500 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
          title="Xóa thẻ"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

interface VirtualizedFlashcardListProps {
  cards: Flashcard[];
  onPlay: (card: Flashcard) => void;
  onEdit: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
  isUpdatingCard: boolean;
}

export const VirtualizedFlashcardList = React.memo(function VirtualizedFlashcardList({
  cards,
  onPlay,
  onEdit,
  onDelete,
  isUpdatingCard
}: VirtualizedFlashcardListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(320); // max-h-80 is 320px

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerHeight(el.clientHeight || 320);

    const handleScroll = () => {
      // Use requestAnimationFrame to prevent layout thrashing and main thread blockage
      window.requestAnimationFrame(() => {
        if (el) {
          setScrollTop(el.scrollTop);
        }
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    
    // Fallback/Resize Observer to dynamically adjust height if view changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height || 320);
      }
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const ROW_HEIGHT = 56; // 52px component + 4px gap/space
  const overscan = 5; // buffer rows above and below

  const { totalHeight, visibleItems, startOffset } = useMemo(() => {
    const totalCount = cards.length;
    const totalHeight = totalCount * ROW_HEIGHT;
    
    // Find startIndex and endIndex based on scrollTop
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
    const endIndex = Math.min(totalCount - 1, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT) + overscan);
    
    const visibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (cards[i]) {
        visibleItems.push({
          card: cards[i],
          index: i
        });
      }
    }

    const startOffset = startIndex * ROW_HEIGHT;

    return {
      totalHeight,
      visibleItems,
      startOffset
    };
  }, [cards, scrollTop, containerHeight]);

  return (
    <div 
      ref={containerRef}
      className="max-h-80 overflow-y-auto pr-1 select-none w-full scroll-smooth"
      style={{ position: 'relative' }}
    >
      <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
        <div 
          className="space-y-[4px] w-full"
          style={{ 
            transform: `translateY(${startOffset}px)`, 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0 
          }}
        >
          {visibleItems.map(({ card, index }) => (
            <FlashcardRow
              key={card.id}
              card={card}
              index={index}
              onPlay={onPlay}
              onEdit={onEdit}
              onDelete={onDelete}
              isUpdatingCard={isUpdatingCard}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
