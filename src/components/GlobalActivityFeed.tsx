import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, getDocs, where, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Save, Plus, Trash2, Edit2, X, Check, Activity, Flame, Trophy, MessageSquare, AlertCircle, RefreshCw, Pin, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { store, User } from '../lib/store';

interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: 'note' | 'streak' | 'match' | 'custom';
  userRole?: string;
  reactions?: Record<string, string[]>;
  isPinned?: boolean;
  isGlobalBroadcast?: boolean;
}

interface FeedItemRowProps {
  item: FeedItem;
  currentUserId?: string;
  userRole?: string;
  onDelete?: (id: string) => void;
  onReact?: (itemId: string, emoji: string) => void;
  onTogglePin?: (itemId: string, isPinned: boolean) => void;
}

const EMOJIS = ['👍', '❤️', '🔥', '👏', '💡', '🎉', '💪', '🚀', '😂', '💯', '🤩', '📚'];

const FeedItemRow = React.memo<FeedItemRowProps>(({ item, currentUserId, userRole, onDelete, onReact, onTogglePin }) => {
  const [showPicker, setShowPicker] = useState(false);
  const isMine = item.userId === currentUserId;
  const canDelete = isMine || userRole === 'admin' || userRole === 'Admin' || userRole === 'teacher';
  const isAdminUser = userRole === 'admin' || userRole === 'Admin';
  
  let typeIcon = <MessageSquare className="w-4 h-4 text-orange-500" />;
  let typeBg = "bg-orange-500/10 border-orange-500/20";
  
  if (item.type === 'streak') {
    typeIcon = <Flame className="w-4 h-4 text-orange-500" />;
    typeBg = "bg-orange-500/10 border-orange-500/20";
  } else if (item.type === 'match') {
    typeIcon = <Trophy className="w-4 h-4 text-orange-500 animate-pulse" />;
    typeBg = "bg-orange-500/10 border-orange-500/20";
  } else if (item.type === 'custom') {
    typeIcon = <Activity className="w-4 h-4 text-blue-500" />;
    typeBg = "bg-blue-500/10 border-blue-500/20";
  }

  const roleBadge = item.userRole && item.userRole !== 'student' ? (
    <span className={cn(
      "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
      (item.userRole === 'admin' || item.userRole === 'Admin') ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-purple-500/20 text-purple-500 border border-purple-500/30"
    )}>
      {item.userRole}
    </span>
  ) : null;

  return (
    <motion.div
      layout
      id={`feed-item-${item.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative flex gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300 content-visibility-auto gpu-accelerated",
        item.isPinned
          ? "bg-orange-500/10 dark:bg-orange-500/[0.05] border-orange-500/40 shadow-md ring-1 ring-orange-500/25"
          : isMine 
            ? "bg-orange-500/5 dark:bg-orange-500/[0.03] border-orange-500/30 shadow-inner" 
            : "bg-white/40 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700/50"
      )}
    >
      {item.isPinned && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-black text-orange-600 dark:text-orange-450 uppercase tracking-widest bg-orange-550/10 px-1.5 py-0.5 rounded shadow-sm">
          <Pin className="w-2.5 h-2.5 fill-orange-600 dark:fill-orange-500" />
          <span>Ghim</span>
        </div>
      )}

      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border", typeBg)}>
        {typeIcon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">
              {item.userName}
            </span>
            {roleBadge}
            {isMine && (
              <span className="text-[9px] bg-orange-500 text-black px-1 py-0.2 rounded-full font-extrabold uppercase scale-90">
                You
              </span>
            )}
          </div>
          <span className="text-[8.5px] opacity-40 font-mono">
            {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed overflow-hidden markdown-body pr-2">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {item.content}
          </ReactMarkdown>
        </div>

        {/* Reactions and Delete control buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
          {/* Reaction bubbles */}
          {Object.entries(item.reactions || {}).map(([emoji, userIds]) => {
            if (!Array.isArray(userIds) || userIds.length === 0) return null;
            const hasReacted = currentUserId && userIds.includes(currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => onReact?.(item.id, emoji)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition border cursor-pointer",
                  hasReacted
                    ? "bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400"
                    : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200/50 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-300 hover:border-zinc-300"
                )}
                title={`Thả bởi: ${userIds.length} người`}
              >
                <span>{emoji}</span>
                <span>{userIds.length}</span>
              </button>
            );
          })}

          {/* New reaction popover picker */}
          {currentUserId && (
            <div className="relative flex items-center">
              <button 
                onClick={() => setShowPicker(prev => !prev)}
                className={cn(
                  "flex items-center justify-center w-5.5 h-5.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-[10px] text-zinc-500 hover:text-zinc-800 transition cursor-pointer border-none",
                  showPicker && "bg-orange-500/20 text-orange-600"
                )}
                title="Bày tỏ cảm xúc"
              >
                +
              </button>
              
              {/* Floating Emojis Popup */}
              <AnimatePresence>
                {showPicker && (
                  <>
                    {/* Invisible background overlay to close picker on click outside */}
                    <div 
                      className="fixed inset-0 z-10 cursor-default bg-transparent" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPicker(false);
                      }} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 5 }}
                      className="absolute bottom-full left-0 mb-1 grid grid-cols-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl p-1.5 gap-1.5 z-20 origin-bottom-left ring-4 ring-black/5 min-w-[172px]"
                    >
                      {EMOJIS.map(emoji => {
                        const userIds = item.reactions?.[emoji] || [];
                        const hasReacted = currentUserId && userIds.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReact?.(item.id, emoji);
                              setShowPicker(false);
                            }}
                            className={cn(
                              "w-6 h-6 flex items-center justify-center text-xs hover:scale-130 transition-transform duration-100 cursor-pointer border-none bg-transparent rounded-full",
                              hasReacted && "bg-orange-500/20"
                            )}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex-1" />

          {/* Pin/Unpin action */}
          {isAdminUser && (
            <button
              onClick={() => onTogglePin?.(item.id, !!item.isPinned)}
              className={cn(
                "p-1 rounded transition cursor-pointer border-none bg-transparent",
                item.isPinned 
                  ? "text-orange-500 hover:text-zinc-400" 
                  : "text-zinc-400 hover:text-orange-550"
              )}
              title={item.isPinned ? "Bỏ ghim chia sẻ này" : "Ghim chia sẻ này"}
            >
              <Pin className={cn("w-3.5 h-3.5", item.isPinned && "fill-orange-500")} />
            </button>
          )}

          {/* Delete action */}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm("Bạn có chắc chắn muốn xóa tin chia sẻ này không?")) {
                  onDelete?.(item.id);
                }
              }}
              className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent"
              title="Xóa chia sẻ này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

FeedItemRow.displayName = 'FeedItemRow';

export function GlobalActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastSubmissions, setLastSubmissions] = useState<number[]>([]);
  const [sendToGlobal, setSendToGlobal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const currentUser = store.getCurrentUser();

  // Throttle helper to prevent spamming
  const checkSpam = useCallback(() => {
    const now = Date.now();
    const recent = lastSubmissions.filter(t => now - t < 10000); // 10 seconds sliding window
    if (recent.length >= 3) {
      return false; // blocks if more than 3 requests in 10s
    }
    setLastSubmissions(prev => [...prev.filter(t => now - t < 10000), now]);
    return true;
  }, [lastSubmissions]);

  useEffect(() => {
    setIsLoading(true);
    // Fetch last 100 order by timestamp descending to capture pinned and active feeds
    const q = query(
      collection(db, "global_activity_feed"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: FeedItem[] = [];
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      
      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        if (data.timestamp) {
          docs.push({
            id: snapshotDoc.id,
            userId: data.userId || '',
            userName: data.userName || 'Anonymous',
            content: data.content || '',
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : (data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()),
            type: data.type || 'note',
            userRole: data.userRole || 'student',
            reactions: data.reactions || {},
            isPinned: data.isPinned === true,
            isGlobalBroadcast: data.isGlobalBroadcast === true
          });
        }
      });

      // Fetch local offline backup items
      const localFeedStr = localStorage.getItem('local_global_activity_feed') || '[]';
      let localFeed: FeedItem[] = [];
      try {
        localFeed = JSON.parse(localFeedStr);
      } catch (e) {}

      // Filter out deleted posts
      const deletedList: string[] = JSON.parse(localStorage.getItem('deleted_feed_ids') || '[]');

      // Merge local elements and firebase elements (deduplicated by ID)
      const mergedMap = new Map<string, FeedItem>();
      
      localFeed.forEach(item => {
        if (!deletedList.includes(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      docs.forEach(item => {
        if (!deletedList.includes(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      // Filter to include items within the last 24 hours OR if pinned, sort by timestamp
      const mergedList = Array.from(mergedMap.values())
        .filter(item => item.isPinned || item.timestamp >= twentyFourHoursAgo)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      setItems(mergedList);
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.warn("Firestore error in GlobalActivityFeed, falling back to local cached storage items:", err);
      setIsLoading(false);
      
      const localFeedStr = localStorage.getItem('local_global_activity_feed') || '[]';
      let localFeed: FeedItem[] = [];
      try {
        localFeed = JSON.parse(localFeedStr);
      } catch (e) {}
      
      const deletedList: string[] = JSON.parse(localStorage.getItem('deleted_feed_ids') || '[]');
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = localFeed
        .filter(item => !deletedList.includes(item.id))
        .filter(item => item.isPinned || item.timestamp >= twentyFourHoursAgo)
        .sort((a, b) => b.timestamp - a.timestamp);

      setItems(filtered);
    });

    return () => unsubscribe();
  }, []);

  const handleAddActivity = useCallback(async () => {
    if (!newContent.trim() || isSending) return;
    
    // Spam Protection
    if (!checkSpam()) {
      setError("Bạn đang gửi tin quá nhanh. Vui lòng dừng lại vài giây!");
      return;
    }

    if (!currentUser) {
      setError("Vui lòng đăng nhập để gửi tin!");
      return;
    }

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'Admin';
    const isGlobal = isAdmin && sendToGlobal;

    if (isGlobal) {
      const confirmSend = window.confirm("Bạn có chắc chắn muốn phát tin nhắn này toàn server làm thông báo khẩn cấp không? Nó sẽ hiển thị trên trang chủ của mọi học viên trong vòng 48 giờ.");
      if (!confirmSend) return;
    }

    setIsSending(true);

    // Pre-generate a Firebase Document Reference to ensure the mock ID and firestore Doc share the exact same ID
    const colRef = collection(db, "global_activity_feed");
    const newDocRef = doc(colRef);
    const docId = newDocRef.id;

    const newLocalItem: FeedItem = {
      id: docId,
      userId: currentUser.id,
      userName: currentUser.name || "Học viên",
      content: newContent.trim(),
      timestamp: Date.now(),
      type: isGlobal ? 'custom' : 'note',
      userRole: currentUser.role || 'student',
      reactions: {},
      isPinned: isGlobal ? true : false,
      isGlobalBroadcast: isGlobal
    };

    // Optimistic UI update
    setItems(prev => [newLocalItem, ...prev]);

    // Save in local storage custom backup
    try {
      const existingStr = localStorage.getItem('local_global_activity_feed') || '[]';
      const parsed: FeedItem[] = JSON.parse(existingStr);
      parsed.unshift(newLocalItem);
      localStorage.setItem('local_global_activity_feed', JSON.stringify(parsed.slice(0, 100)));
    } catch (e) {}

    try {
      setError(null);
      await setDoc(newDocRef, {
        userId: currentUser.id,
        userName: currentUser.name || "Học viên",
        content: newContent.trim(),
        timestamp: Date.now(),
        type: isGlobal ? 'custom' : 'note',
        userRole: currentUser.role || 'student',
        reactions: {},
        isPinned: isGlobal ? true : false,
        isGlobalBroadcast: isGlobal
      });
      setSendToGlobal(false);
    } catch (err: any) {
      console.warn("Firestore save failed, using local offline backup:", err);
    } finally {
      setIsSending(false);
    }

    setNewContent('');
    setIsAdding(false);
  }, [newContent, checkSpam, currentUser, sendToGlobal, isSending]);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic delete
    setItems(prev => prev.filter(item => item.id !== id));

    // Store in deleted IDs local registry
    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem('deleted_feed_ids') || '[]');
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('deleted_feed_ids', JSON.stringify(deletedList));
      }
    } catch (e) {}

    // Delete from LocalStorage backup
    try {
      const existingStr = localStorage.getItem('local_global_activity_feed') || '[]';
      const parsed: FeedItem[] = JSON.parse(existingStr);
      const filtered = parsed.filter(item => item.id !== id);
      localStorage.setItem('local_global_activity_feed', JSON.stringify(filtered));
    } catch (e) {}

    // Optional Firestore delete
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, "global_activity_feed", id));
    } catch (err) {
      console.warn("Could not delete from Firestore:", err);
    }
  }, []);

  const handleReact = useCallback(async (itemId: string, emoji: string) => {
    if (!currentUser) return;
    const userId = currentUser.id;

    // 1. Snappy UI state change with unique binding check
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const reactions = { ...item.reactions };
      const userList = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = userList.indexOf(userId);
      if (idx > -1) {
        userList.splice(idx, 1);
      } else {
        userList.push(userId);
      }
      
      const uniqueUsers = Array.from(new Set(userList));
      if (uniqueUsers.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = uniqueUsers;
      }
      return { ...item, reactions };
    }));

    // 2. Persist reaction to LocalStorage offline backup
    try {
      const existingStr = localStorage.getItem('local_global_activity_feed') || '[]';
      const parsed: FeedItem[] = JSON.parse(existingStr);
      const updated = parsed.map(item => {
        if (item.id !== itemId) return item;
        const reactions = { ...item.reactions };
        const userList = reactions[emoji] ? [...reactions[emoji]] : [];
        const idx = userList.indexOf(userId);
        if (idx > -1) {
          userList.splice(idx, 1);
        } else {
          userList.push(userId);
        }
        
        const uniqueUsers = Array.from(new Set(userList));
        if (uniqueUsers.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = uniqueUsers;
        }
        return { ...item, reactions };
      });
      localStorage.setItem('local_global_activity_feed', JSON.stringify(updated));
    } catch (e) {}

    // 3. Try to sync to Firestore in background using atomic transactions (uniquely bound logic)
    try {
      const { doc, runTransaction } = await import('firebase/firestore');
      const docRef = doc(db, "global_activity_feed", itemId);
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const currentReactions = data.reactions || {};
        const userList = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        const idx = userList.indexOf(userId);
        
        if (idx > -1) {
          userList.splice(idx, 1);
        } else {
          userList.push(userId);
        }
        
        const uniqueUsers = Array.from(new Set(userList));
        if (uniqueUsers.length === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = uniqueUsers;
        }
        
        transaction.update(docRef, { reactions: currentReactions });
      });
    } catch (err) {
      console.warn("Could not sync reaction to Firestore via transaction (expected on restricted setups):", err);
    }
  }, [currentUser]);

  const handleTogglePin = useCallback(async (itemId: string, currentPinned: boolean) => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'Admin';
    if (!isAdmin) return;

    const newPinnedState = !currentPinned;

    // 1. Snappy UI update
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, isPinned: newPinnedState };
    }));

    // 2. Local storage backup update
    try {
      const existingStr = localStorage.getItem('local_global_activity_feed') || '[]';
      const parsed: FeedItem[] = JSON.parse(existingStr);
      const updated = parsed.map(item => {
        if (item.id !== itemId) return item;
        return { ...item, isPinned: newPinnedState };
      });
      localStorage.setItem('local_global_activity_feed', JSON.stringify(updated));
    } catch (e) {}

    // 3. Sync to Firestore
    try {
      await updateDoc(doc(db, "global_activity_feed", itemId), { isPinned: newPinnedState });
    } catch (err) {
      console.warn("Could not sync pin status to Firestore:", err);
    }
  }, [currentUser]);

  // Clean local notes when we mount this global activity feed (transitioning cache seamlessly)
  useEffect(() => {
    localStorage.removeItem('henosis_quick_notes');
  }, []);

  const pinnedItems = useMemo(() => items.filter(item => item.isPinned), [items]);

  const renderInnerContent = (maximized: boolean) => (
    <>
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-orange-600/10 dark:border-orange-500/20">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500 animate-pulse shrink-0" />
          <h3 className="text-md font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500">
            Bảng Tin Hoạt Động Chung
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 dark:hover:text-orange-900 border border-orange-500/30 hover:bg-orange-500 hover:text-white transition group cursor-pointer"
              title="Chia sẻ trạng thái"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
          <button
            onClick={() => setIsMaximized(!maximized)}
            className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 dark:hover:text-orange-900 border border-orange-500/30 hover:bg-orange-500 hover:text-white transition group cursor-pointer animate-in fade-in"
            title={maximized ? "Thu nhỏ bảng tin" : "Phóng to bảng tin (80%)"}
          >
            {maximized ? (
              <Minimize2 className="w-4 h-4 group-hover:scale-95 transition-transform" />
            ) : (
              <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick-access Ribbon of Pinned Items */}
      {pinnedItems.length > 0 && (
        <div className="mb-3 p-2.5 bg-orange-500/10 dark:bg-orange-500/[0.04] border border-orange-500/30 rounded-xl flex flex-col gap-1.5 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-black text-orange-700 dark:text-orange-450 uppercase tracking-wider">
            <Pin className="w-3 h-3 animate-bounce shrink-0 text-orange-600 dark:text-orange-450 fill-orange-650 dark:fill-orange-500" />
            <span>TIN GHIM ({pinnedItems.length})</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar scroll-smooth snap-x">
            {pinnedItems.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  const element = document.getElementById(`feed-item-${p.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('ring-4', 'ring-orange-500/70', 'scale-[1.02]', 'duration-500');
                    setTimeout(() => {
                      element.classList.remove('ring-4', 'ring-orange-500/70', 'scale-[1.02]');
                    }, 2500);
                  }
                }}
                className="snap-start shrink-0 flex flex-col gap-0.5 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-zinc-950/80 border border-zinc-200/50 dark:border-zinc-800/80 hover:border-orange-500/40 text-left text-[10px] w-[160px] cursor-pointer transition-all hover:scale-[1.01] active:scale-95 shadow-xs"
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-100 truncate block max-w-[70px]">
                    {p.userName}
                  </span>
                  <span className="text-[7.5px] opacity-40 font-mono">
                    {new Date(p.timestamp).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
                <span className="text-zinc-600 dark:text-zinc-300 line-clamp-1 truncate w-full">
                  {p.content}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-3">
        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-xl p-3 border border-orange-500/40 shadow-inner"
            >
              <textarea
                autoFocus
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleAddActivity();
                  }
                }}
                placeholder="Share a thought or note... (Markdown supported)"
                className="w-full bg-transparent border-none outline-none resize-none text-xs min-h-[70px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              />
              {(currentUser?.role === 'admin' || currentUser?.role === 'Admin') && (
                <div className="flex items-center gap-2 mb-2 p-1.5 bg-red-500/10 dark:bg-red-500/20 rounded-lg text-red-500 dark:text-red-400 border border-red-500/20">
                  <input
                    type="checkbox"
                    id="send-global-broadcast"
                    checked={sendToGlobal}
                    onChange={(e) => setSendToGlobal(e.target.checked)}
                    className="w-3.5 h-3.5 accent-red-500 rounded cursor-pointer"
                  />
                  <label htmlFor="send-global-broadcast" className="text-[9.5px] font-black uppercase tracking-wide cursor-pointer select-none flex items-center gap-1.5">
                    <span>📢 Gửi thông báo toàn Server (Hiện trang chủ trong 48h)</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-2 border-t border-orange-500/10 pt-2">
                <button onClick={() => setIsAdding(false)} disabled={isSending} className="p-1 px-2 text-[10px] font-bold text-zinc-500 hover:text-red-500 transition-colors disabled:opacity-40">
                  Hủy
                </button>
                <button 
                  onClick={handleAddActivity} 
                  disabled={isSending}
                  className="py-1 px-3 bg-orange-500 text-zinc-900 dark:text-orange-900 font-bold text-[10px] rounded-lg shadow-md hover:bg-orange-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isSending ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-zinc-900" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )} 
                  {isSending ? "Đang gửi..." : "Gửi tin (Ctrl+Enter)"}
                </button>
              </div>
            </motion.div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
              <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-xs">Đang đồng bộ bảng tin...</span>
            </div>
          ) : items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center opacity-60 py-10 text-[11px] italic border-2 border-dashed border-zinc-300 dark:border-zinc-700/50 rounded-xl"
            >
              Chưa có chia sẻ nào trong 24 giờ qua. Hãy là người chia sẻ đầu tiên!
            </motion.div>
          ) : (
            items.map(item => (
              <FeedItemRow
                key={item.id}
                item={item}
                currentUserId={currentUser?.id}
                userRole={currentUser?.role}
                onDelete={handleDelete}
                onReact={handleReact}
                onTogglePin={handleTogglePin}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  );

  return (
    <>
      {isMaximized ? (
        <>
          {/* Layout placeholder to preserve visual grids structure */}
          <section className="glass p-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-md flex flex-col h-[600px] rounded-2xl relative overflow-hidden items-center justify-center text-center">
            <Activity className="w-8 h-8 text-orange-500 animate-pulse mb-2" />
            <h3 className="text-sm font-display font-black text-orange-757 dark:text-orange-200">
              Bảng Tin Hoạt Động Chung
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Đang phóng to bảng tin (80%)...
            </p>
            <button
              onClick={() => setIsMaximized(false)}
              className="mt-4 px-3 py-1.5 bg-orange-500 text-zinc-900 dark:text-orange-900 text-xs font-bold rounded-lg hover:bg-orange-600 transition cursor-pointer"
            >
              Thu nhỏ lại
            </button>
          </section>

          {/* Render the full interactive widget inside a Body-level portal */}
          {createPortal(
            <>
              <div 
                className="fixed inset-0 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md z-[990] transition-all duration-300 ease-out animate-in fade-in cursor-pointer"
                onClick={() => setIsMaximized(false)}
              />
              <section className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[90vh] sm:w-[80vw] sm:h-[80vh] z-[1000] bg-white dark:bg-zinc-950 shadow-2xl rounded-2xl p-6 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col transition-all duration-300 overflow-hidden animate-in zoom-in-95">
                {renderInnerContent(true)}
              </section>
            </>,
            document.body
          )}
        </>
      ) : (
        <section className="glass p-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-md transition-all duration-300 flex flex-col h-[600px] rounded-2xl">
          {renderInnerContent(false)}
        </section>
      )}
    </>
  );
}
