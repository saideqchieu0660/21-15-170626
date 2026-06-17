import { useState } from "react";
import { Flame, Target } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { store } from "../lib/store";
import { motion, AnimatePresence } from "motion/react";

// Mock study data for the last 7 days
const data = [
  { day: 'T2', count: 20 },
  { day: 'T3', count: 35 },
  { day: 'T4', count: 18 },
  { day: 'T5', count: 45 },
  { day: 'T6', count: 30 },
  { day: 'T7', count: 50 },
  { day: 'CN', count: 40 },
];

const MILESTONES = [3, 7, 14, 30, 50, 100, 365, 1000];

export function StreakDisplay() {
  const [showChart, setShowChart] = useState(false);
  const user = store.getCurrentUser();
  if (!user || user.streak === undefined) return null;

  const currentStreak = user.streak;
  const nextMilestone = MILESTONES.find(m => m > currentStreak) || currentStreak + 100;
  const remainingDays = nextMilestone - currentStreak;
  const progressPercent = Math.min((currentStreak / nextMilestone) * 100, 100);

  return (
    <div className="relative" onMouseEnter={() => setShowChart(true)} onMouseLeave={() => setShowChart(false)}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold text-sm cursor-help transition-all hover:bg-orange-500/20">
        <Flame className="w-4 h-4 fill-current animate-pulse" />
        <span>{currentStreak}</span>
      </div>
      
      <AnimatePresence>
        {showChart && (
          <motion.div 
             initial={{ opacity: 0, y: 10, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 10, scale: 0.95 }}
             transition={{ duration: 0.2 }}
             className="absolute top-10 right-0 w-72 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-4 z-50 flex flex-col gap-4"
          >
            {/* Milestone Progress Section */}
            <div>
               <div className="flex justify-between items-end mb-2">
                 <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                   <Target className="w-3.5 h-3.5" /> Mục tiêu tiếp theo
                 </h4>
                 <span className="text-xs font-bold text-orange-500">{currentStreak} / {nextMilestone}</span>
               </div>
               
               <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progressPercent}%` }}
                   transition={{ duration: 1, ease: "easeOut" }}
                   className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                 />
               </div>
               <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 text-right">
                 Còn <strong className="text-orange-500">{remainingDays} ngày</strong> để đạt cột mốc mới!
               </p>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />
            
            {/* Chart Section */}
            <div className="h-32">
               <h4 className="text-xs font-semibold mb-2 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Hoạt động 7 ngày qua</h4>
               <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={data}>
                     <XAxis dataKey="day" tick={{fontSize: 10, fill: '#888'}} tickLine={false} axisLine={false} />
                     <Tooltip 
                         cursor={{fill: 'transparent'}}
                         contentStyle={{borderRadius: '8px', border: 'none', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '12px'}}
                         itemStyle={{color: '#fff'}}
                     />
                     <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
