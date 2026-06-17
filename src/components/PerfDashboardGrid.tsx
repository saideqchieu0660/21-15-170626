import React from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { Sparkles, Activity, Shield, Zap, TrendingUp, Trophy } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  delayIndex: number;
}

const FastMetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  accentColor,
  delayIndex,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1], // Custom fast cubic-bezier for snappy response
        delay: Math.min(delayIndex * 0.05, 0.3), // Strictly bounded stagger delay cap
      }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      // Hardware acceleration triggers
      className="relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-orange-500/50 dark:hover:border-orange-400/50 shadow-md hover:shadow-xl transition-colors duration-300 transform-gpu will-change-transform-opacity cursor-pointer group"
      id={`perf-card-${delayIndex}`}
    >
      {/* Dynamic hardware-accelerated CSS gradient overlay to replace heavy real-time lights */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none transform-gpu"
        style={{
          background: `radial-gradient(circle 120px at 50% 10%, ${accentColor}15, transparent)`,
        }}
      />
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 transform-gpu group-hover:scale-105 transition-transform duration-300">
          <Icon className="w-6 h-6 text-zinc-800 dark:text-zinc-200" />
        </div>
        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-full">
          {change}
        </span>
      </div>

      <div className="relative z-10 space-y-1">
        <h3 className="text-sm font-medium tracking-tight text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
        <p className="text-2xl font-display font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          {value}
        </p>
      </div>

      {/* Decorative high-performance glowing micro border line matching theme */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 transform-gpu"
        style={{
          backgroundImage: `linear-gradient(to right, ${accentColor}, transparent)`,
        }}
      />
    </motion.div>
  );
};

export default function PerfDashboardGrid() {
  const dummyMetrics = [
    {
      title: 'Học phần đã hoàn thành',
      value: '24 Bộ Thẻ',
      change: '+15.4%',
      icon: Trophy,
      accentColor: '#f59e0b', // Amber-500
    },
    {
      title: 'Tỷ lệ ghi nhớ (Retention)',
      value: '91.8%',
      change: '+4.2%',
      icon: Activity,
      accentColor: '#10b981', // Emerald-500
    },
    {
      title: 'Độ chính xác trung bình',
      value: '88% Score',
      change: '+12.1%',
      icon: Zap,
      accentColor: '#3b82f6', // Blue-500
    },
    {
      title: 'Hệ thống bảo mật & Đồng bộ',
      value: 'Đã bảo vệ',
      change: '100% OK',
      icon: Shield,
      accentColor: '#8b5cf6', // Violet-500
    },
  ];

  return (
    <div className="w-full py-8 space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
          <h2 className="text-lg font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500 uppercase tracking-widest">
            Bảng Điều Khiển Năng Suất
          </h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          GPU-Accelerated Core // 60FPS Refresh Rate Lock
        </p>
      </div>

      <LayoutGroup id="dashboard-performance-group">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dummyMetrics.map((metric, idx) => (
            <FastMetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              change={metric.change}
              icon={metric.icon}
              accentColor={metric.accentColor}
              delayIndex={idx}
            />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
