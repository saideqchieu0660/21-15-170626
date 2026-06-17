import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Book } from 'lucide-react';
import { store, Deck } from '../lib/store';

export const EditDeckModal = ({ 
  isOpen, 
  onClose, 
  deckId, 
  initialTitle, 
  initialSubject,
  onSaveSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  deckId: string;
  initialTitle: string;
  initialSubject: string;
  onSaveSuccess: () => void;
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [subject, setSubject] = useState(initialSubject);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setSubject(initialSubject);
    }
  }, [isOpen, initialTitle, initialSubject]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) return;
    setIsSaving(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const docRef = doc(db, "sets", deckId);
      await updateDoc(docRef, {
        title: title.trim(),
        subject: subject.trim(),
      });

      // Update locally
      const currentDecks = store.getDecks();
      const existIdx = currentDecks.findIndex((d) => d.id === deckId);
      if (existIdx >= 0) {
        currentDecks[existIdx].title = title.trim();
        currentDecks[existIdx].subject = subject.trim();
        if (typeof (store as any).setDecksLocally === "function") {
          (store as any).setDecksLocally([...currentDecks]);
        }
      }
      onSaveSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toast-dispatch', { detail: "Lỗi khi lưu thông tin. Vui lòng thử lại." }));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <Book className="w-5 h-5 text-orange-500" />
              Sửa Hình Thức Học Phần
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Tên Bộ Thẻ</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                placeholder="Nhập tên bộ thẻ..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Môn Học / Danh Mục</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                placeholder="Ví dụ: math, history, tiếng anh..."
                required
              />
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Đang Lưu..." : <><Save className="w-4 h-4" /> Lưu Thay Đổi</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
