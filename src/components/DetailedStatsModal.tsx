import React, { useMemo } from "react";
import { X, BarChart3, TrendingUp, HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line
} from "recharts";
import { store, ReviewRecord } from "../lib/store";

interface DetailedStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function DetailedStatsModal({ isOpen, onClose, userId }: DetailedStatsModalProps) {
  const chartData = useMemo(() => {
    if (!isOpen || !userId) return [];
    
    // Generate data for the last 7 days
    const history = store.getReviewHistory(userId) || [];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);
      
      const dayRecords = history.filter(
        (r) => r.timestamp >= d.getTime() && r.timestamp <= endOfDay.getTime()
      );
      
      // Calculate studied and mastered
      const uniqueStudied = new Set(dayRecords.map(r => r.cardId)).size;
      const uniqueMastered = new Set(
        dayRecords.filter(r => r.remembered && r.masteryChange > 0).map(r => r.cardId)
      ).size;
      
      data.push({
        name: `${d.getDate()}/${d.getMonth() + 1}`,
        "Đã học": uniqueStudied,
        "Master (Nhớ)": uniqueMastered
      });
    }
    
    return data;
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-600 dark:text-violet-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-zinc-900 dark:text-zinc-100">
                Thống Kê Chi Tiết (7 Ngày)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Theo dõi tiến độ thẻ Master và thẻ đã học mỗi ngày
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="w-full h-80 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHoc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMaster" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              <Area type="monotone" dataKey="Đã học" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorHoc)" />
              <Bar dataKey="Master (Nhớ)" fill="url(#colorMaster)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/10">
             <div className="text-violet-600 dark:text-violet-400 font-bold mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Tổng Học
             </div>
             <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200">
               {chartData.reduce((acc, curr) => acc + curr["Đã học"], 0)} <span className="text-sm font-medium opacity-60">thẻ</span>
             </div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
             <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Tổng Master
             </div>
             <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200">
               {chartData.reduce((acc, curr) => acc + curr["Master (Nhớ)"], 0)} <span className="text-sm font-medium opacity-60">thẻ</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
