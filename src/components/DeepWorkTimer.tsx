import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, RotateCcw, Coffee, Lock } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const DeepWorkTimer = () => {
    const [isEnabled, setIsEnabled] = useState(localStorage.getItem('henosis_deepwork') === 'true');
    const [mode, setMode] = useState<'work' | 'break'>('work');
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 mins by default
    const [isActive, setIsActive] = useState(false);
    const [isBreakLocked, setIsBreakLocked] = useState(false);
    const location = useLocation();

    // Work: 25 mins, Break: 5 mins
    const WORK_TIME = 25 * 60;
    const BREAK_TIME = 5 * 60;

    useEffect(() => {
        const handleToggle = () => {
            const enabled = localStorage.getItem('henosis_deepwork') === 'true';
            setIsEnabled(enabled);
            if (!enabled) {
                setIsActive(false);
                setIsBreakLocked(false);
                setMode('work');
                setTimeLeft(WORK_TIME);
            }
        };
        window.addEventListener('henosis-deepwork-toggled', handleToggle);
        return () => window.removeEventListener('henosis-deepwork-toggled', handleToggle);
    }, [WORK_TIME]);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(t => t - 1);
            }, 1000);
        } else if (isActive && timeLeft === 0) {
            // Time is up!
            if (mode === 'work') {
                setMode('break');
                setTimeLeft(BREAK_TIME);
                setIsBreakLocked(true); // Lock the screen to enforce break
                try {
                    new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
                } catch(e) {}
            } else {
                setMode('work');
                setTimeLeft(WORK_TIME);
                setIsBreakLocked(false); // Unlock
                setIsActive(false);
                try {
                    new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3').play().catch(() => {});
                } catch(e) {}
            }
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft, mode, BREAK_TIME, WORK_TIME]);

    if (!isEnabled) return null;

    const toggleTimer = () => setIsActive(!isActive);
    const stopTimer = () => {
        setIsActive(false);
        setMode('work');
        setTimeLeft(WORK_TIME);
        setIsBreakLocked(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Only show in specific routes or globally? Often best to just show globally except maybe Login.
    if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/setup') {
        return null;
    }

    return (
        <>
            {/* The Floating Widget */}
            <motion.div 
                drag 
                dragConstraints={{ left: 0, right: window.innerWidth - 200, top: 0, bottom: window.innerHeight - 100 }}
                dragElastic={1}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="fixed bottom-6 left-6 z-[900] cursor-grab active:cursor-grabbing"
            >
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-200 shadow-xl dark:border-zinc-800 p-4 flex flex-col gap-3 min-w-[180px]">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                            {mode === 'work' ? <Lock className="w-3.5 h-3.5 text-orange-500" /> : <Coffee className="w-3.5 h-3.5 text-blue-500" />}
                            {mode === 'work' ? 'Deep Work' : 'Nghỉ Ngơi'}
                        </span>
                        <span>{isActive ? '⏳' : '⏸️'}</span>
                    </div>
                    
                    <div className="text-3xl font-mono font-bold text-center text-zinc-900 dark:text-zinc-100 tabular-nums my-1 select-none">
                        {formatTime(timeLeft)}
                    </div>
                    
                    <div className="flex items-center justify-center gap-2">
                        <button 
                            onClick={toggleTimer} 
                            className={`p-2 rounded-xl transition-all shadow-sm ${isActive ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                        >
                            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button 
                            onClick={stopTimer} 
                            className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-all hover:bg-zinc-300 dark:hover:bg-zinc-700 shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="text-[10px] text-center text-zinc-400 font-medium">
                        Kéo thả để di chuyển
                    </div>
                </div>
            </motion.div>

            {/* The Enforced Break Screen Lock */}
            <AnimatePresence>
                {isBreakLocked && (
                    <motion.div 
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-6 text-center shadow-2xl"
                        style={{ pointerEvents: 'all' }}
                    >
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-md w-full flex flex-col items-center gap-6"
                        >
                            <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                <Coffee className="w-10 h-10 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-display font-bold text-white mb-2">Đã Đến Giờ Nghỉ!</h2>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    Thư giãn mắt. Hãy đứng lên và vươn vai. Ngành khoa học kognitive yêu cầu ngài nghỉ ngơi để não bộ củng cố kiến thức. 
                                </p>
                            </div>
                            
                            <div className="text-6xl font-mono font-black text-blue-400 tabular-nums">
                                {formatTime(timeLeft)}
                            </div>
                            
                            <div className="mt-8 flex flex-col gap-3 w-full">
                                <button 
                                    onClick={() => {
                                        setIsBreakLocked(false);
                                        setMode('work');
                                        setTimeLeft(WORK_TIME);
                                        setIsActive(false);
                                    }}
                                    className="w-full py-4 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition font-bold"
                                >
                                    Bỏ qua giờ nghỉ (Không khuyến khích)
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
