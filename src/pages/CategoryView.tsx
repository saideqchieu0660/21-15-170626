import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Deck, store } from '../lib/store';
import { DeckList } from '../components/DeckList';
import { ArrowLeft, Loader2, Sparkles, User, RefreshCw, Home } from 'lucide-react';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function CategoryView() {
  const { categoryName } = useParams();
  const decodedCategory = decodeURIComponent(categoryName || "");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!decodedCategory) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "sets"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allDecks: Deck[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Deck));
      const targetCategory = decodedCategory.trim().toUpperCase();
      const filtered = allDecks.filter(d => String(d.subject || "Khác").trim().toUpperCase() === targetCategory);
      setDecks(filtered);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching decks snapshot:", error);
      toast.error("Lỗi khi tải danh mục");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [decodedCategory]);

  return (
    <div className="min-h-screen pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* HEADER TỰ ĐỘNG CHUẨN UX GREEK */}
      <div className="relative isolate px-6 py-10 sm:py-16 sm:px-16 overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center text-center shadow-2xl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-orange-400 text-xs font-semibold uppercase tracking-widest mb-2 shadow-inner">
            <Sparkles className="w-4 h-4" />
            <span>Danh mục chia sẻ</span>
          </div>
          <h1 className="font-serif italic text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            {decodedCategory}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-lg mt-2 font-medium tracking-wide">
            Đã tìm thấy <strong className="text-orange-400 font-bold">{decks.length}</strong> bộ học trong danh mục này. Hãy chọn bộ học bạn muốn tham gia.
          </p>

          <button onClick={() => navigate('/dashboard')} className="mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-zinc-900 font-bold text-sm tracking-wide hover:bg-orange-500 hover:text-white transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
             <Home className="w-5 h-5" />
             Về Dashboard
          </button>
        </motion.div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-zinc-500">
           <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
           <p className="font-medium animate-pulse text-sm uppercase tracking-widest">Đang tải danh mục...</p>
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-20 px-4 glass rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl flex flex-col items-center justify-center gap-4">
           <p className="text-2xl font-serif italic text-zinc-500 dark:text-zinc-400">Không tìm thấy bộ học nào ở danh mục này.</p>
           <button onClick={() => navigate('/dashboard')} className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-orange-600 text-white font-bold tracking-wide rounded-xl transition-all">Quay lại Dashboard</button>
        </div>
      ) : (
        <div className="glass p-6 md:p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl">
           <DeckList decks={decks} showSearch={true} groupBySubject={true} />
        </div>
      )}
    </div>
  );
}
