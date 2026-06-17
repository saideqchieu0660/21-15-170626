import React, { useState, useEffect, useRef , useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db, FirebaseListenerManager } from "../lib/firebase";
import { store } from "../lib/store";
import { getAvatarBorderClass } from "../utils/xp";
import { motion, AnimatePresence } from "motion/react";
import { Users, Clock, ArrowLeft, Play, Pause, RefreshCw, Award, Target, ThumbsUp, ListTodo, Plus, Check, Trash2, Headphones, Sparkles, Volume2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { v4 as uuidv4 } from "uuid";

interface ActiveUser {
  id: string;
  name: string;
  status: "focusing" | "break";
  joinedAt: number;
  lastActive?: number;
  task?: string;
  nudgeFrom?: string;
  nudgeAt?: number;
  xp?: number;
  avatarBorder?: string;
}



interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

const AMBIENT_TRACKS = [
  { id: "none", name: "Tắt âm thanh", url: "" },
  { id: "rain", name: "Tiếng mưa", url: "https://actions.google.com/sounds/v1/water/rain_on_roof.ogg" },
  { id: "cafe", name: "Quán Cafe", url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg" },
  { id: "nature", name: "Thiên nhiên", url: "https://actions.google.com/sounds/v1/ambiences/meadow_morning.ogg" }
];

export default function CoStudyRoom() {
  useEffect(() => {
    document.title = "Henosis - Co-Study Room";
  }, []);

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isFocusing, setIsFocusing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [cycles, setCycles] = useState(0);
  const [task, setTask] = useState("");
  
  // Gamification & Features
  const [earnedXp, setEarnedXp] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [ambientTrack, setAmbientTrack] = useState(AMBIENT_TRACKS[0]);
  
  const lastNudgeAtRef = useRef(0);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);

  const currentUser = store.getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
     if (audioRef.current) {
        audioRef.current.pause();
        if (ambientTrack.id !== "none") {
           audioRef.current.src = ambientTrack.url;
           audioRef.current.volume = 0.5;
           audioRef.current.load();
           const playPromise = audioRef.current.play();
           if (playPromise !== undefined) {
              playPromise.catch(e => console.log("Audio play blocked", e));
           }
        }
     }
  }, [ambientTrack]);

  useEffect(() => {
    if (!currentUser) return;
    
    const roomRef = collection(db, "costudy_room");
    const userDocRef = doc(db, "costudy_room", currentUser.id);
    
    // Join room
    setDoc(userDocRef, {
      name: currentUser.name,
      status: "focusing",
      joinedAt: Date.now(),
      lastActive: Date.now(),
      task: "Đang học...",
      avatarBorder: currentUser.avatarBorder || "none"
    }).catch(console.error);

    // Heartbeat to keep user alive
    const heartbeat = setInterval(() => {
      updateDoc(userDocRef, { lastActive: Date.now() }).catch(() => {});
    }, 10000);

    const handleBeforeUnload = () => {
      deleteDoc(userDocRef).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Listen to others
    const unsub = onSnapshot(roomRef, (snapshot) => {
      const users: ActiveUser[] = [];
      const now = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as ActiveUser;
        // Filter out ghost users (inactive for > 25 seconds)
        const lastAct = data.lastActive || data.joinedAt || 0;
        const timeDiff = now - lastAct;
        if (timeDiff > 25000) {
          // Attempt to clean up ghost users if we catch them and they are older than 60s (as per firestore rules)
          if (docSnap.id !== currentUser.id && timeDiff > 65000) {
             deleteDoc(doc(db, "costudy_room", docSnap.id)).catch(() => {});
          }
          return;
        }
        users.push({ id: docSnap.id, ...data });
        
        // Check for nudge to me
        if (docSnap.id === currentUser.id && data.nudgeAt && data.nudgeFrom && data.nudgeAt > lastNudgeAtRef.current) {
           lastNudgeAtRef.current = data.nudgeAt;
           setNudgeToast(`${data.nudgeFrom} vừa đập tay động viên bạn! 🙌`);
           setTimeout(() => setNudgeToast(null), 4000);
        }
      });
      setActiveUsers(users);
    });
    
    FirebaseListenerManager.add("CoStudyRoom", unsub);

    return () => {
      unsub();
      FirebaseListenerManager.remove("CoStudyRoom");
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      deleteDoc(userDocRef).catch(console.error);
    };
  }, [currentUser]); // Remove mode dependency so we don't reconnect constantly

  // Handle network reconnect with throttle
  useEffect(() => {
    let reconnectThrottle: NodeJS.Timeout | null = null;

    const handleReconnect = async () => {
       if (reconnectThrottle) return;
       console.log("[CoStudyRoom] Smart Re-sync triggered by network reconnect.");
       
       if (currentUser) {
          try {
             const { doc, updateDoc } = await import("firebase/firestore");
             const userDocRef = doc(db, "costudy_room", currentUser.id);
             await updateDoc(userDocRef, { lastActive: Date.now() });
             console.log("[CoStudyRoom] Ghost-prevention heartbeat successfully pushed after reconnect");
          } catch (e) {
             console.error("[CoStudyRoom] Failed to push heartbeat on reconnect", e);
          }
       }

       reconnectThrottle = setTimeout(() => {
          reconnectThrottle = null;
       }, 15000); // Throttler 15s to prevent redundant blasts
    };

    window.addEventListener('app-network-reconnect', handleReconnect);
    return () => {
       window.removeEventListener('app-network-reconnect', handleReconnect);
       if (reconnectThrottle) clearTimeout(reconnectThrottle);
    };
  }, [currentUser]);

  // Update status/task separately
  useEffect(() => {
    if (!currentUser) return;
    const userDocRef = doc(db, "costudy_room", currentUser.id);
    updateDoc(userDocRef, { 
       status: mode === "focus" ? "focusing" : "break",
       task: task || "Đang học...",
       lastActive: Date.now()
    }).catch(e => console.error("Update error:", e));
  }, [mode, task, currentUser]);

  // Gamification: Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFocusing && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          // Gamification: Earn 1 XP every 60 seconds of focus
          if (mode === "focus" && next > 0 && next % 60 === 0) {
             setEarnedXp(xp => xp + 1);
             if (currentUser?.id) {
               store.updateCurrentUser({ points: (store.getCurrentUser()?.points || 0) + 1 });
               updateDoc(doc(db, "costudy_room", currentUser.id), { xp: earnedXp + 1 }).catch(() => {});
             }
          }
          return next;
        });
      }, 1000);
    } else if (isFocusing && timeLeft === 0) {
      setIsFocusing(false);
      // Give 5 XP bonus on finishing a focus pomodoro
      if (mode === "focus" && currentUser?.id) {
        setEarnedXp(xp => xp + 5);
        store.updateCurrentUser({ points: (store.getCurrentUser()?.points || 0) + 5 });
        updateDoc(doc(db, "costudy_room", currentUser.id), { xp: earnedXp + 5 }).catch(() => {});
      }

      if (mode === "focus") {
        setMode("break");
        setTimeLeft(5 * 60); 
        setCycles(prev => prev + 1);
      } else {
        setMode("focus");
        setTimeLeft(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isFocusing, timeLeft, mode]);

  const toggleTimer = () => {
    setIsFocusing(!isFocusing);
  };
  const resetTimer = () => {
    setIsFocusing(false);
    setTimeLeft(mode === "focus" ? 25 * 60 : 5 * 60);
  };

  const sendNudge = (targetId: string) => {
    if (!currentUser) return;
    updateDoc(doc(db, "costudy_room", targetId), { 
      nudgeFrom: currentUser.name, 
      nudgeAt: Date.now() 
    }).catch(console.error);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks([...tasks, { id: uuidv4(), text: newTaskText.trim(), done: false }]);
    setNewTaskText("");
  };

  const toggleTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const calculateProgress = () => {
    const total = mode === "focus" ? 25 * 60 : 5 * 60;
    return ((total - timeLeft) / total) * 100;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 md:p-8 space-y-6 w-full max-w-full overflow-x-hidden">
      <audio ref={audioRef} loop />
      
      {/* Nudge Toast Notification */}
      <AnimatePresence>
         {nudgeToast && (
            <motion.div
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-3 drop-shadow-xl"
            >
               <Sparkles className="w-5 h-5 animate-pulse" />
               {nudgeToast}
            </motion.div>
         )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 opacity-60 hover:opacity-100 transition font-bold"
        >
          <ArrowLeft className="w-5 h-5" /> Trở về
        </button>
        <div className="flex items-center gap-4">
           <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-4 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-sm">
             <Award className="w-4 h-4" /> {earnedXp} XP 
             <span className="text-xs opacity-60 font-medium">Phiên này</span>
           </div>
           <h2 className="text-2xl font-display font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2 hidden md:flex">
             <Users className="w-6 h-6" /> Tự Học Chung
           </h2>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 flex-1">
        <div className="md:col-span-2 glass rounded-3xl p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden group">
           {/* Mobile Top Bar */}
           <div className="flex md:hidden items-center justify-between w-full mb-6 z-28 gap-4">
             {/* Mobile Sound Control Widget */}
             <div className="flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
                <Headphones className="w-4 h-4 text-zinc-500" />
                <select 
                  className="bg-transparent outline-none text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer appearance-none pr-4"
                  value={ambientTrack.id}
                  onChange={(e) => setAmbientTrack(AMBIENT_TRACKS.find(t => t.id === e.target.value) || AMBIENT_TRACKS[0])}
                >
                   {AMBIENT_TRACKS.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                   ))}
                </select>
             </div>
             {/* Mobile Checklist Toggle Widget */}
             <button 
                onClick={() => setShowChecklist(!showChecklist)}
                className={cn("p-2.5 rounded-xl transition shadow-sm backdrop-blur-md border", showChecklist ? "bg-orange-500 text-white border-orange-600" : "bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800")}
                title="Checklist công việc"
             >
                <ListTodo className="w-5 h-5" />
             </button>
           </div>
           
           {/* Ambient Sound Control Widget */}
           <div className="absolute top-6 left-6 z-20 hidden md:flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
              <Headphones className="w-4 h-4 text-zinc-500" />
              <select 
                className="bg-transparent outline-none text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer appearance-none pr-4"
                value={ambientTrack.id}
                onChange={(e) => setAmbientTrack(AMBIENT_TRACKS.find(t => t.id === e.target.value) || AMBIENT_TRACKS[0])}
              >
                 {AMBIENT_TRACKS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                 ))}
              </select>
           </div>
           
           {/* Checklist Toggle Widget */}
           <div className="absolute top-6 right-6 z-20 hidden md:block">
              <button 
                 onClick={() => setShowChecklist(!showChecklist)}
                 className={cn("p-3 rounded-xl transition shadow-sm backdrop-blur-md border", showChecklist ? "bg-orange-500 text-white border-orange-600" : "bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800")}
                 title="Checklist công việc"
              >
                 <ListTodo className="w-5 h-5" />
              </button>
           </div>

           {/* Floating Checklist Panel */}
           <AnimatePresence>
             {showChecklist && (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
                   className="absolute top-24 right-4 md:top-20 md:right-6 z-30 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
                >
                   <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                     <span className="font-bold text-sm flex items-center gap-2"><ListTodo className="w-4 h-4 text-orange-500" /> Nhiệm vụ rèn luyện</span>
                     <button onClick={() => setShowChecklist(false)} className="opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
                   </div>
                   <div className="p-3 flex-1 overflow-y-auto space-y-2">
                     {tasks.length === 0 ? (
                        <p className="text-xs text-center opacity-50 py-4">Chưa có nhiệm vụ nào. Thêm mục tiêu nhỏ để hoàn thành!</p>
                     ) : (
                        tasks.map(t => (
                           <div key={t.id} className="flex items-start gap-2 group">
                              <button onClick={() => toggleTask(t.id)} className={cn("mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition", t.done ? "bg-green-500 border-green-500 text-white" : "border-zinc-400 dark:border-zinc-600")}>
                                 {t.done && <Check className="w-3 h-3" />}
                              </button>
                              <span className={cn("text-sm flex-1", t.done && "line-through opacity-50")}>{t.text}</span>
                              <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition"><Trash2 className="w-3 h-3" /></button>
                           </div>
                        ))
                     )}
                   </div>
                   <form onSubmit={handleAddTask} className="p-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                     <input 
                       type="text" 
                       value={newTaskText} 
                       onChange={e => setNewTaskText(e.target.value)} 
                       className="flex-1 text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg outline-none" 
                       placeholder="Nhiệm vụ mới..." 
                     />
                     <button type="submit" disabled={!newTaskText.trim()} className="p-2 bg-orange-500 text-white rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                   </form>
                </motion.div>
             )}
           </AnimatePresence>

           <div className="w-full max-w-sm mb-8 z-10 transition-all duration-300">
              <div className="flex items-center gap-2 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl p-3 border border-zinc-300 dark:border-zinc-700 shadow-inner focus-within:ring-2 ring-orange-500/50">
                 <Target className="w-5 h-5 text-orange-600 ml-2" />
                 <input 
                    type="text" 
                    value={task} 
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="Bạn đang tập trung vào việc gì?"
                    className="bg-transparent border-none focus:ring-0 w-full font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                 />
              </div>
           </div>

           <div className="z-10 flex gap-4 mb-12">
             <button 
                onClick={() => { setMode("focus"); setTimeLeft(25 * 60); setIsFocusing(false); }}
                className={cn("px-6 py-2 rounded-full font-bold transition", mode === "focus" ? "bg-orange-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 opacity-60 hover:opacity-100")}
             >
                Pomodoro (25p)
             </button>
             <button 
                onClick={() => { setMode("break"); setTimeLeft(5 * 60); setIsFocusing(false); }}
                className={cn("px-6 py-2 rounded-full font-bold transition", mode === "break" ? "bg-green-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 opacity-60 hover:opacity-100")}
             >
                Nghỉ ngơi (5p)
             </button>
          </div>

          <div className="relative group w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-12 z-10">
             <svg className="absolute inset-0 w-full h-full -rotate-90">
               <circle cx="50%" cy="50%" r="48%" className="stroke-zinc-200 dark:stroke-zinc-800 fill-none stroke-[8px]" />
               <motion.circle 
                 cx="50%" cy="50%" r="48%" 
                 className={cn("fill-none stroke-[8px] transition-all", mode === "focus" ? "stroke-orange-500" : "stroke-green-500")}
                 strokeDasharray="300%"
                 strokeDashoffset={`${300 - (calculateProgress() / 100) * 300}%`}
                 initial={{ strokeDashoffset: "300%" }}
                 animate={{ strokeDashoffset: `${300 - (calculateProgress() / 100) * 300}%` }}
               />
             </svg>
             <div className="text-6xl md:text-8xl font-mono font-bold tracking-tighter tabular-nums drop-shadow-md text-zinc-800 dark:text-zinc-100 flex items-center justify-center">
                 {formatTime(timeLeft)}
             </div>
          </div>

          <div className="flex items-center gap-6 z-10">
             <button 
                onClick={resetTimer}
                className="p-4 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
             >
                <RefreshCw className="w-6 h-6" />
             </button>
             <button 
                onClick={toggleTimer}
                className={cn("p-6 rounded-full text-white shadow-xl hover:scale-105 transition", isFocusing ? "bg-red-500 hover:bg-red-600" : (mode === "focus" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"))}
             >
                {isFocusing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
             </button>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 md:p-8 flex flex-col h-full relative">
           <h3 className="text-xl font-bold border-b border-orange-600/20 dark:border-orange-500/30 pb-4 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2"><Users className="w-5 h-5 text-orange-500" /> Hiện diện</span>
              <span className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-bold">
                 {activeUsers.length} Online
              </span>
           </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              <AnimatePresence>
                {(activeUsers || []).map((user, idx) => {
                   if (!user) return null;
                   return (
                   <motion.div 
                     key={user.id || `anon-${idx}`} 
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 transition group"
                   >
                      <div className="flex items-center gap-3">
                         <div className={cn(
                           "w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold uppercase shadow-sm shrink-0 relative",
                           getAvatarBorderClass(user.avatarBorder)
                         )}>
                            {user.name?.charAt(0) || "U"}
                         </div>
                         <div className="min-w-0 pr-2">
                            <p className="font-bold text-sm truncate">
                              {user.name || "Người dùng ẩn danh"} {user.id === currentUser?.id && <span className="text-xs font-normal opacity-50 ml-1">(Bạn)</span>}
                            </p>
                            <span className="block text-xs font-medium text-orange-600 dark:text-orange-400 truncate mt-0.5">
                               {user.task?.trim() ? `🎯 ${user.task}` : "Đang tập trung..."}
                            </span>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                         {user.xp && user.xp > 0 ? (
                           <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                             {user.xp} XP
                           </div>
                         ) : null}
                         
                         {user.id !== currentUser?.id && (
                            <button 
                               onClick={() => sendNudge(user.id)}
                               className="p-2 bg-zinc-200/60 dark:bg-zinc-700 rounded-lg text-orange-600 hover:bg-orange-500 hover:text-white transition opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                               title="Gửi đập tay động viên"
                            >
                               <ThumbsUp className="w-4 h-4" />
                            </button>
                         )}
                      </div>
                   </motion.div>
                   );
                })}
              </AnimatePresence>
           </div>
        </div>
      </div>
    </div>
  );
}
