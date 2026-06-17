import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Xác nhận", cancelText = "Hủy", isDestructive = false }: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border-2 border-zinc-200 dark:border-zinc-800 p-6 overflow-hidden flex flex-col gap-6"
        >
          <div className="flex justify-between items-start">
             <div className="flex gap-3 items-center">
                 <div className={`p-3 rounded-2xl ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                    <AlertTriangle className="w-6 h-6" />
                 </div>
                 <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white leading-tight">
                    {title}
                 </h2>
             </div>
             <button 
                 onClick={onClose}
                 className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400"
             >
                 <X className="w-5 h-5" />
             </button>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
             {message}
          </p>
          <div className="flex items-center gap-3 justify-end mt-2">
             <button 
                onClick={onClose}
                className="px-5 py-3 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
             >
                {cancelText}
             </button>
             <button 
                onClick={() => {
                   onConfirm();
                   onClose();
                }}
                className={`px-5 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 ${isDestructive ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' : 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 shadow-zinc-900/20 dark:shadow-white/20'}`}
             >
                {confirmText}
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
