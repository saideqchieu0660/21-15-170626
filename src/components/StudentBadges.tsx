import React, { useState, useEffect, useRef } from 'react';
import { Award, Zap, Star, Shield, Cpu, Book, Flame, Calendar, Clock, Lock, Sparkles, CheckCircle2, X, Download, Trophy, Crown, Compass, Hourglass, Activity, Medal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils.js';
import { triggerCelebration } from '../lib/celebration.js';
import { store } from '../lib/store';

const BADGES = [
  // 1. CHUỖI KHỔ TU (STREAK - Đăng nhập liên tiếp)
  {
    id: 'streak_3',
    name: 'Tia Sáng Động Thạch',
    desc: 'Chuỗi 3 ngày liên tiếp kiên trì học hỏi',
    req: 3,
    icon: Compass,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    gradient: 'from-sky-500/20 to-sky-400/5',
    type: 'streak' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '🔥 Mở khóa: Khung Vòng Ánh Sáng Động Thạch'
  },
  {
    id: 'streak_5',
    name: 'Khởi Sinh Tư Duy',
    desc: 'Bền vững tinh thần chuỗi 5 ngày đột phá',
    req: 5,
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-500/20 to-orange-500/5',
    type: 'streak' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Hồi 20% Năng lượng tinh thần'
  },
  {
    id: 'week_warrior',
    name: 'Chiến Binh Phalanx',
    desc: 'Chuỗi 7 ngày thiền định không đứt',
    req: 7,
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-500/20 to-red-500/5',
    type: 'streak' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Tặng 100 Điểm Kinh Nghiệm & Huy hiệu'
  },
  {
    id: 'streak_10',
    name: 'Ý Chí Khắc Kỷ',
    desc: 'Kỷ luật của bậc hiền triết suốt 10 ngày',
    req: 10,
    icon: Shield,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-500/20 to-orange-500/5',
    type: 'streak' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '🔥 Mở khóa: Khung Ý Chí Khắc Kỷ'
  },
  {
    id: 'streak_15',
    name: 'Học Giả Học Viện',
    desc: 'Chuỗi 15 ngày trường kỳ tích lũy',
    req: 15,
    icon: Shield,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    gradient: 'from-rose-500/20 to-orange-500/5',
    type: 'streak' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Nhận Phước Lành Tốc Độ Thấu Hiểu'
  },
  {
    id: 'monthly_sage',
    name: 'Hậu Duệ Socrates',
    desc: 'Bền bỉ học vấn quá 30 ngày đêm',
    req: 30,
    icon: Calendar,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/40',
    gradient: 'from-indigo-400/20 to-blue-600/10',
    type: 'streak' as const,
    span: 'col-span-2 sm:col-span-2 md:col-span-2 md:row-span-2 min-h-[15.5rem]',
    isVip: true,
    reward: '🔥 Danh xưng Hậu Duệ, x1.5 Quả Ngọt'
  },
  {
    id: 'streak_50',
    name: 'Bán Thần Kiến Tạo',
    desc: 'Chuỗi 50 ngày kiên trì rung động Olympus',
    req: 50,
    icon: Award,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/50',
    gradient: 'from-purple-500/30 through-indigo-500/20 to-transparent',
    type: 'streak' as const,
    span: 'col-span-2 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Mở khóa: Khung Hào Quang Bán Thần rực rỡ'
  },
  {
    id: 'streak_100',
    name: 'Vươn Tới Đỉnh Cực',
    desc: 'Chuỗi 100 ngày vượt qua mọi giới hạn con người',
    req: 100,
    icon: Crown,
    color: 'text-pink-500',
    bg: 'bg-pink-500/15',
    border: 'border-pink-500/50',
    gradient: 'from-pink-500/30 to-fuchsia-500/10',
    type: 'streak' as const,
    span: 'col-span-2 sm:col-span-2 md:col-span-4 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Sở hữu Vương Trượng của Zeus'
  },

  // 2. LINH THẠCH TÍCH LŨY (XP / Points)
  {
    id: 'points_100',
    name: 'Dân Tự Do Mới',
    desc: 'Đột phá tích lũy 100 Tinh Hoa tri thức',
    req: 100,
    icon: Book,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500/20 to-blue-400/5',
    type: 'points' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '🔥 Mở khóa: Khung Viền Tinh Thạch Học Giả'
  },
  {
    id: 'points_300',
    name: 'Hạt Giống Trí Tuệ',
    desc: 'Gom góp tích lũy 300 Tinh Hoa tinh khiết',
    req: 300,
    icon: Star,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    gradient: 'from-cyan-400/20 to-blue-500/5',
    type: 'points' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Thưởng x1.1 năng suất gặt hái'
  },
  {
    id: 'knowledge_seeker',
    name: 'Nhà Khảo Cổ',
    desc: 'Đột phá tích lũy 500 Tinh Hoa dồi dào',
    req: 500,
    icon: Star,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-400/20 to-orange-600/5',
    type: 'points' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Tặng Bản đồ Di Cáo Cổ Đại'
  },
  {
    id: 'scholar',
    name: 'Trụ Cột Thư Viện',
    desc: 'Đạt tới 1,000 Tinh Hoa khai mở kho báu',
    req: 1000,
    icon: Award,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    gradient: 'from-emerald-400/20 to-teal-600/10',
    type: 'points' as const,
    span: 'col-span-2 sm:col-span-2 md:col-span-2 md:row-span-2 min-h-[15.5rem]',
    isVip: true,
    reward: '🔥 Mở khóa: Viền Kim Long Cấp (Vàng Tuyền)'
  },
  {
    id: 'points_2000',
    name: 'Trưởng Tế Tri Thức',
    desc: 'Trí tuệ đạt tới 2,000 Tinh Hoa thăng cấp vinh dự',
    req: 2000,
    icon: Medal,
    color: 'text-rose-450',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/35',
    gradient: 'from-rose-500/20 to-pink-500/10',
    type: 'points' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Hào quang thông thái bảo mẫu vây quanh'
  },
  {
    id: 'ai_master',
    name: 'Bậc Thầy Kiến Tạo',
    desc: 'Hiển danh sở hữu 2,500 Tinh Hoa',
    req: 2500,
    icon: Cpu,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/50',
    gradient: 'from-teal-400/30 to-emerald-600/10',
    type: 'points' as const,
    span: 'col-span-2 sm:col-span-3 md:col-span-2 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Mở khóa danh hiệu Viện Trưởng Tiềm Năng'
  },
  {
    id: 'stoic',
    name: 'Triết Gia Khai Sáng',
    desc: 'Nỗ lực đỉnh cao gom 5,000 Tinh Hoa',
    req: 5000,
    icon: Shield,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/50',
    gradient: 'from-purple-400/30 via-fuchsia-500/20 to-pink-600/10',
    type: 'points' as const,
    span: 'col-span-2 sm:col-span-3 md:col-span-2 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Khung Ánh Sáng Khai Minh lấp lánh'
  },
  {
    id: 'points_10000',
    name: 'Trí Tuệ Vô Biên',
    desc: 'Hào quang bừng sáng gom hơn 10k Tinh Hoa đại diện',
    req: 10000,
    icon: Trophy,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/60',
    gradient: 'from-orange-400/30 via-orange-500/20 to-orange-550/10',
    type: 'points' as const,
    span: 'col-span-2 sm:col-span-4 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Tạc Tượng Parthenon Vinh Quang'
  },

  // 3. THỜI GIAN KHỔ LUYỆN TRONG TUẦN (TIME - Số phút học tập trong tuần)
  {
    id: 'time_15',
    name: 'Khởi Điểm Suy Ngẫm',
    desc: 'Tích lũy 15 phút rèn luyện tư duy tuần này',
    req: 15,
    icon: Clock,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-400/20 to-teal-400/5',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Tặng 30 Phiến Đá Rèn Tư Duy'
  },
  {
    id: 'time_30',
    name: 'Hành Giả Khảo Sát',
    desc: 'Tích lũy 30 phút nghiên cứu chiều sâu',
    req: 30,
    icon: Hourglass,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    gradient: 'from-sky-400/20 to-cyan-500/5',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Thưởng +20 Điểm Tích Lũy Bền Bỉ'
  },
  {
    id: 'time_60',
    name: 'Thiền Sư Chánh Niệm',
    desc: 'Tích lũy 60 phút tập trung cao độ',
    req: 60,
    icon: Hourglass,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-500/20 to-rose-450/5',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Ý chí tập trung +20%'
  },
  {
    id: 'time_120',
    name: 'Nhà Khởi xướng',
    desc: 'Bền bỉ nghiên cứu 120 phút (2 tiếng) tuần này',
    req: 120,
    icon: Activity,
    color: 'text-emerald-450',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-450/20 to-green-500/5',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '🔥 Mở khóa: Viền Vầng Sáng Sáng Thế (Hồng Đỏ)'
  },
  {
    id: 'time_180',
    name: 'Ẩn Sĩ Biện Chứng',
    desc: 'Đạt tới 3 tiếng (180 phút) mài giũa tuần này',
    req: 180,
    icon: Activity,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    gradient: 'from-violet-500/20 to-indigo-500/5',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Sắc phong "Kẻ Du Hành Kỷ Nguyên"'
  },
  {
    id: 'time_300',
    name: 'Người Kế Thừa Bất Diệt',
    desc: 'Vượt mốc 5 tiếng (300 phút) năng lượng dồi dào',
    req: 300,
    icon: Zap,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/40',
    gradient: 'from-rose-400/20 to-red-650/10',
    type: 'time' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Vinh danh Người Sáng Thế Kỷ Nguyên'
  },
  {
    id: 'time_600',
    name: 'Kho Tàng Hùng Biện',
    desc: 'Kỷ lục 10 tiếng (600 phút) nỗ lực phi thường',
    req: 600,
    icon: Cpu,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/15',
    border: 'border-fuchsia-100/30',
    gradient: 'from-fuchsia-500/30 via-purple-500/10 to-transparent',
    type: 'time' as const,
    span: 'col-span-2 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Tặng thêm Điểm Tích Cực x2'
  },

  // 4. NGỰ TRỊ NGÔI VƯƠNG (TOP 1 BXH TUẦN)
  {
    id: 'top1_1',
    name: 'Người Chiến Thắng',
    desc: 'Cất bước ngự trị vị thế Top 1 BXH Tuần',
    req: 1,
    icon: Trophy,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    gradient: 'from-orange-400/20 to-orange-600/5',
    type: 'top1' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Sắc phong Hào Quang Của Nike'
  },
  {
    id: 'top1_2',
    name: 'Lưỡng Cực Quyền Năng',
    desc: 'Tiếp tục rực cháy ngự trị vị trí Top 1 đỉnh cao 2 tuần',
    req: 2,
    icon: Medal,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    gradient: 'from-pink-400/20 to-orange-400/5',
    type: 'top1' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Ánh sáng thái dương chói lọi'
  },
  {
    id: 'top1_3',
    name: 'Tam Vị Quyền Uy',
    desc: 'Sừng sững 3 tuần bảo vệ ngôi hoàng kim Top 1',
    req: 3,
    icon: Crown,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    gradient: 'from-orange-400/20 to-orange-600/10',
    type: 'top1' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '🔥 Đội vương miện hoàng tộc vĩnh bảo'
  },
  {
    id: 'top1_5',
    name: 'Ngũ Giác Cầm Quyền',
    desc: 'Bất biến 5 tuần liên tục bước lên đỉnh Olympus',
    req: 5,
    icon: Trophy,
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    gradient: 'from-orange-400/35 to-rose-600/10',
    type: 'top1' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Huy hiệu Hóa Thân Thần Thánh'
  },
  {
    id: 'top1_10',
    name: 'Đế Vương Của Các Thế Kỷ',
    desc: 'Khắc cốt vương đại thống lĩnh BXH Top 1 suốt 10 tuần',
    req: 10,
    icon: Crown,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/60',
    gradient: 'from-orange-400/35 to-orange-700/20',
    type: 'top1' as const,
    span: 'col-span-2 sm:col-span-2 md:col-span-4 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Mở khóa: Hiệu ứng 7 Màu Đế Cung Ánh Dạng'
  },

  // 5. THÔNG THÁI BÌNH QUÂN (AVERAGE MASTERY - Mức độ thông thạo trung bình)
  {
    id: 'mastery_50',
    name: 'Giác Ngộ Tân Tiến',
    desc: 'Thuộc lĩnh độ thông thạo trung bình >= 50%',
    req: 50,
    icon: Medal,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    gradient: 'from-teal-400/20 to-cyan-500/5',
    type: 'mastery' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Đạt cảnh giới Tự Tin Khởi Điểm'
  },
  {
    id: 'mastery_80',
    name: 'Điêu Khắc Sự Hoàn Mỹ',
    desc: 'Độ thông thạo trung bình chạm đích >= 80%',
    req: 80,
    icon: Star,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    gradient: 'from-cyan-400/20 to-blue-500/5',
    type: 'mastery' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    reward: '✨ Tinh hoa trí lực bách nghệ tinh thông'
  },
  {
    id: 'mastery_95',
    name: 'Hiện Thân Sự Thông Thái',
    desc: 'Trí lực siêu việt >= 95% đáng nể',
    req: 95,
    icon: Sparkles,
    color: 'text-fuchsia-500',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/40',
    gradient: 'from-fuchsia-400/20 to-purple-600/10',
    type: 'mastery' as const,
    span: 'col-span-1 min-h-[12.5rem]',
    isVip: true,
    reward: '🔥 Mở khóa: Hiệu Ứng Lời Nguyền Từ Các Nữ Thần Số Mệnh (Hồng Tím Lấp Lánh)'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 30 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 20 } }
};

const BadgeCard = ({ badge, val, unlocked, progress }: any) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const Icon = badge.icon;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!unlocked) return;
    if (badge.onExport) {
       badge.onExport(badge.id); // Trigger export modal
    }
  };

  const user = store.getCurrentUser();
  const userName = user?.name || "Học Giả";

  return (
    <motion.div 
      variants={itemVariants}
      className={cn("group w-full h-full relative cursor-pointer [perspective:1000px]", badge.span)}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative transition-[transform] duration-700 [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
         {/* FRONT FACE */}
         <div 
           className={cn(
             "absolute top-0 left-0 w-full h-full p-4 lg:p-6 flex flex-col justify-between rounded-2xl transition-all duration-500 backface-hidden [transform:rotateY(0deg)] bg-white dark:bg-zinc-900 border-2",
             unlocked 
               ? `${badge.border} shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 group-hover:scale-[1.02]`
               : "bg-zinc-200/50 dark:bg-zinc-800/80 border-zinc-300/30 dark:border-zinc-700/50 grayscale opacity-85 group-hover:grayscale-[0.4] group-hover:opacity-100 group-hover:-translate-y-1" 
           )}
         >
              {unlocked && (
                 <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10 dark:opacity-20 pointer-events-none rounded-2xl", badge.gradient)} />
              )}
              
              {unlocked && badge.isVip && (
                 <div className="absolute -inset-10 bg-gradient-to-r from-orange-500/20 via-orange-500/20 to-red-500/20 blur-2xl animate-pulse pointer-events-none" />
              )}

              {!unlocked && (
                 <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="w-[150%] h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent absolute top-0 -left-[100%] animate-[shimmer_2600ms_infinite_linear]" />
                 </div>
              )}

              <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                  <div className="flex items-start justify-between">
                      <div className={cn(
                          "p-3 rounded-2xl shadow-sm border", 
                          unlocked ? `${badge.bg} ${badge.border}` : "bg-zinc-300/50 dark:bg-zinc-700/50 border-transparent"
                      )}>
                         <Icon className={cn("w-7 h-7 md:w-9 md:h-9", unlocked ? badge.color : "text-zinc-500")} />
                      </div>
                      {unlocked ? (
                          badge.isVip ? <Sparkles className="w-6 h-6 text-orange-500 animate-[bounce_2s_infinite]" /> : <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 drop-shadow-md" />
                      ) : (
                          <div className="p-2 bg-zinc-300/50 dark:bg-zinc-700/50 rounded-full transition-colors drop-shadow-sm">
                             <Lock className="w-3 h-3 md:w-4 md:h-4 text-zinc-500" />
                          </div>
                      )}
                  </div>

                  <div className="space-y-1.5 mt-auto">
                      <h4 className={cn("font-black tracking-tight text-base md:text-lg leading-tight", unlocked ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 group-hover:text-orange-600 transition-colors")}>
                         {badge.name}
                      </h4>
                      
                      <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-black/5 dark:border-white/5 backdrop-blur-sm">
                         <span className={cn("text-xs font-semibold truncate max-w-[80%]", unlocked ? (badge.isVip ? "text-orange-600 dark:text-orange-400 font-bold" : badge.colorStr || "text-zinc-750 dark:text-zinc-200") : "text-zinc-500")}>
                            {badge.desc}
                         </span>
                         {!unlocked && (
                            <span className="text-[10px] font-bold font-mono text-zinc-500">{Math.floor(progress)}%</span>
                         )}
                      </div>
                      
                      {!unlocked && (
                         <div className="h-1.5 w-full bg-zinc-350 dark:bg-zinc-750 rounded-full overflow-hidden mt-2 relative">
                             <motion.div 
                                className="absolute h-full bg-gradient-to-r from-zinc-400 to-orange-500 rounded-full" 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                             />
                         </div>
                      )}
                  </div>
              </div>
         </div>

         {/* BACK FACE */}
         <div className={cn(
             "absolute top-0 left-0 w-full h-full p-4 lg:p-6 flex flex-col justify-between rounded-2xl transition-all duration-500 backface-hidden [transform:rotateY(180deg)]",
             unlocked 
               ? `bg-zinc-900 dark:bg-black border-2 border-zinc-800`
               : "bg-zinc-800 dark:bg-zinc-900 border-2 border-zinc-700"
           )}
         >
              <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-transparent z-0 rounded-2xl"></div>
              
              <div className="relative z-10 flex flex-col h-full items-center text-center justify-between">
                 <div className="w-full">
                   <h4 className="font-bold text-white uppercase tracking-widest text-[10px] lg:text-xs mb-1 opacity-70">
                      Tiến Trình Đạt Được
                   </h4>
                   <div className="font-mono text-xl lg:text-2xl font-black text-white/95">
                      {val} <span className="text-xs opacity-50">/ {badge.req}</span>
                   </div>
                 </div>

                 <div className="w-full space-y-3 mt-auto">
                    {badge.reward && (
                       <div className="text-[10px] lg:text-xs text-white/80 bg-white/10 p-2 rounded-lg border border-white/5 backdrop-blur-sm italic">
                          Đặc quyền Vinh Dự:<br/>
                          <span className="font-bold text-orange-400">{badge.reward}</span>
                       </div>
                    )}
                    
                    <div className="flex gap-2">
                        <button 
                          disabled={!unlocked}
                          className={cn(
                             "flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2",
                             unlocked 
                               ? "bg-orange-500 text-black hover:bg-orange-400 active:scale-95 shadow-[0_0_12px_rgba(234,179,8,0.3)]"
                               : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                          )}
                        >
                           {unlocked ? <><Zap className="w-3.5 h-3.5"/> Nhận Thưởng</> : <><Lock className="w-3.5 h-3.5"/> Chưa Đạt</>}
                        </button>

                        {unlocked && (
                          <button
                             onClick={handleDownload}
                             className="px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-orange-500 border border-zinc-600 shadow-sm"
                               title="Tải xuống huy chương PDF"
                          >
                             <Download className="w-4 h-4"/>
                          </button>
                        )}
                    </div>
                 </div>
              </div>
         </div>
      </motion.div>
    </motion.div>
  )
}

import { AchievementCard } from './AchievementCardExport';

export const StudentBadges = ({ 
  points = 0, 
  streak = 0, 
  top1Weeks = 0, 
  studyMinutesThisWeek = 0, 
  averageMastery = 0 
}: { 
  points: number; 
  streak: number; 
  top1Weeks?: number; 
  studyMinutesThisWeek?: number; 
  averageMastery?: number; 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "streak" | "points" | "time" | "top1" | "mastery">("all");
  const unlockedIdsRef = useRef<string[]>([]);
  const [unlockedIdsStore, setUnlockedIdsStore] = useState<string[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<typeof BADGES[0] | null>(null);
  const [showExportView, setShowExportView] = useState(false);
  const isFirstRender = useRef(true);

  const getValForBadge = (b: typeof BADGES[0]) => {
    switch (b.type) {
      case 'streak': return streak;
      case 'points': return points;
      case 'time': return studyMinutesThisWeek;
      case 'top1': return top1Weeks;
      case 'mastery': return averageMastery;
      default: return 0;
    }
  };

  useEffect(() => {
    const currentUnlocked = BADGES.filter(b => getValForBadge(b) >= b.req).map(b => b.id);
    
    if (isFirstRender.current) {
       unlockedIdsRef.current = currentUnlocked;
       setUnlockedIdsStore(currentUnlocked);
       isFirstRender.current = false;
       return;
    }

    const newUnlocks = currentUnlocked.filter(id => !unlockedIdsRef.current.includes(id));
    
    if (newUnlocks.length > 0) {
       const badgeToCelebrate = BADGES.find(b => b.id === newUnlocks[0]);
       if (badgeToCelebrate) {
          triggerCelebration();
          setNewlyUnlocked(badgeToCelebrate);
       }
       unlockedIdsRef.current = currentUnlocked;
       setUnlockedIdsStore(currentUnlocked);
    }
  }, [points, streak, top1Weeks, studyMinutesThisWeek, averageMastery]);

  const filteredBadges = BADGES.filter(b => selectedCategory === 'all' || b.type === selectedCategory);
  
  const totalUnlockedCount = BADGES.filter(b => getValForBadge(b) >= b.req).length;
  const totalPercent = Math.round((totalUnlockedCount / BADGES.length) * 100);

  const closeModal = () => setNewlyUnlocked(null);

  const categories = [
    { id: "all" as const, label: "Tất Cả", desc: "Toàn bộ" },
    { id: "streak" as const, label: "Khổ Hạnh 🔥", desc: "Đăng nhập" },
    { id: "points" as const, label: "Tinh Hoa 💎", desc: "Tích lũy" },
    { id: "time" as const, label: "Nhẫn Nại ⏳", desc: "Thời gian học" },
    { id: "top1" as const, label: "Hào Quang 👑", desc: "Top 1 BXH" },
    { id: "mastery" as const, label: "Thông Thái 🎓", desc: "Độ thông thạo" },
  ];

  return (
    <div className="glass p-6 md:p-8 rounded-3xl space-y-8 relative overflow-hidden">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
      `}</style>
      
        {/* Top statistics section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-zinc-200/50 dark:border-zinc-800/80 pb-6">
         <div className="space-y-1">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl md:text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500 flex items-center gap-3">
                <Award className="w-8 h-8 text-orange-500" /> Điện Thờ Vinh Hiển
              </h3>
              <button 
                onClick={() => setShowExportView(true)}
                className="hidden sm:flex px-4 py-1.5 rounded-full text-xs font-bold border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-colors shadow-sm items-center gap-2"
              >
                 <Download className="w-3.5 h-3.5" /> Thẻ Vinh Danh
              </button>
            </div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 italic">Mỗi danh hiệu đạt được chứng minh nỗ lực tri thức phi thường.</p>
            <button 
                onClick={() => setShowExportView(true)}
                className="sm:hidden mt-2 px-4 py-1.5 rounded-full text-xs font-bold border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-colors shadow-sm flex inline-flex items-center gap-2"
              >
                 <Download className="w-3.5 h-3.5" /> Thẻ Vinh Danh
            </button>
         </div>

         {/* Live stat grid */}
         <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-4xl w-full xl:w-auto">
            <div className="px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-black flex flex-col justify-center items-center gap-0.5 text-center shadow-inner">
               <span className="opacity-65 font-medium">Tinh Hoa</span>
               <div className="flex items-center gap-1 font-mono text-sm">
                  <Book className="w-4 h-4 text-blue-500" /> {points} PTS
               </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-black flex flex-col justify-center items-center gap-0.5 text-center shadow-inner">
               <span className="opacity-65 font-medium">Chuỗi Vững Vàng</span>
               <div className="flex items-center gap-1 font-mono text-sm">
                  <Flame className="w-4 h-4 text-orange-500" /> {streak} Đêm
               </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-black flex flex-col justify-center items-center gap-0.5 text-center shadow-inner">
               <span className="opacity-65 font-medium">Khổ Tu Tuần</span>
               <div className="flex items-center gap-1 font-mono text-sm">
                  <Clock className="w-4 h-4 text-emerald-500" /> {studyMinutesThisWeek} Phút
               </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-black flex flex-col justify-center items-center gap-0.5 text-center shadow-inner">
               <span className="opacity-65 font-medium">Đế Vương Top 1</span>
               <div className="flex items-center gap-1 font-mono text-sm">
                  <Crown className="w-4 h-4 text-orange-500" /> {top1Weeks} Tuần
               </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-black flex flex-col justify-center items-center gap-0.5 text-center shadow-inner col-span-2 sm:col-span-1">
               <span className="opacity-65 font-medium">Thông Thái</span>
               <div className="flex items-center gap-1 font-mono text-sm">
                  <Sparkles className="w-4 h-4 text-purple-500" /> {averageMastery}%
               </div>
            </div>
         </div>
      </div>

      {/* Progress tracking summary */}
      <div className="bg-zinc-100/50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="space-y-1">
            <h4 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
               Tỷ lệ mở khóa Điện Thờ: <span className="font-mono text-orange-600 dark:text-orange-400 font-extrabold">{totalUnlockedCount}</span> / {BADGES.length} danh hiệu ({totalPercent}%)
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
               Hoàn thành xuất sắc toàn bộ chặng đường khảo cứu triết học để đạt danh vị "Khắc Kỷ Chi Thượng Thừa" đỉnh phong.
            </p>
         </div>
         <div className="w-full md:w-64">
            <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/30 dark:border-zinc-700/40 rounded-full overflow-hidden relative">
               <motion.div 
                  className="absolute h-full bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalPercent}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
               />
            </div>
         </div>
      </div>

      {/* Categories select pills */}
      <div className="flex flex-wrap gap-2 pt-2">
         {categories.map((cat) => (
            <button
               key={cat.id}
               onClick={() => setSelectedCategory(cat.id)}
               className={cn(
                  "px-4 py-2 text-xs font-extrabold rounded-xl transition duration-200 border cursor-pointer",
                  selectedCategory === cat.id
                     ? "bg-zinc-900 border-zinc-950 text-white dark:bg-white dark:border-white dark:text-black shadow-md scale-105"
                     : "bg-white/40 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
               )}
            >
               {cat.label}
            </button>
         ))}
      </div>

      {/* Grid displays achievements */}
      <AnimatePresence mode="popLayout">
         <motion.div 
            layout
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 auto-rows-fr"
         >
            {filteredBadges.map(badge => {
               const val = getValForBadge(badge);
               const unlocked = val >= badge.req;
               const progress = Math.min(100, (val / badge.req) * 100);
               
               return (
                  <BadgeCard 
                     key={badge.id}
                     badge={{...badge, onExport: () => setShowExportView(true)}}
                     val={val}
                     unlocked={unlocked}
                     progress={progress}
                  />
               );
            })}
         </motion.div>
      </AnimatePresence>

      {/* Export / Carousel View */}
      {showExportView && (
         <AchievementCard
            points={points}
            streak={streak}
            unlockedBadges={BADGES.filter(b => getValForBadge(b) >= b.req)}
            onClose={() => setShowExportView(false)}
         />
      )}

      {/* modal celebrating newly unlocked badge */}
      {newlyUnlocked && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl max-w-sm w-full relative shadow-2xl border border-orange-500/30 animate-in zoom-in-95 duration-500 overflow-hidden text-center">
               <button onClick={closeModal} className="absolute top-4 right-4 p-2 bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-full transition">
                  <X className="w-5 h-5" />
               </button>
               
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent pointer-events-none" />
               
               <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className={cn("p-5 rounded-2xl shadow-xl", newlyUnlocked.bg, newlyUnlocked.border)}>
                     <newlyUnlocked.icon className={cn("w-14 h-14", newlyUnlocked.color, newlyUnlocked.isVip && "animate-bounce")} />
                  </div>
                  
                  <div className="space-y-2">
                     <span className="text-xs font-bold text-orange-500 tracking-widest uppercase">DANH HIỆU THỜI KHẮC HUYỀN THOẠI</span>
                     <h2 className="text-2xl font-black text-zinc-900 dark:text-white font-display">
                        {newlyUnlocked.name}
                     </h2>
                     <p className="text-zinc-600 dark:text-zinc-300 opacity-80 leading-relaxed text-sm">
                        Bạn đã xuất sắc giành được danh hiệu danh giá: <strong className={newlyUnlocked.color}>{newlyUnlocked.desc}</strong>!
                     </p>
                     {newlyUnlocked.reward && (
                        <div className="border border-orange-500/20 bg-orange-500/5 p-2 rounded-lg mt-1 text-xs">
                           Nhận báu vật: <strong className="text-orange-600 dark:text-orange-400">{newlyUnlocked.reward}</strong>
                        </div>
                     )}
                  </div>
                  
                  <button onClick={closeModal} className="mt-4 px-6 py-3 bg-orange-500 text-black font-bold rounded-xl hover:bg-orange-600 transition hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(234,179,8,0.3)] w-full flex items-center justify-center gap-2">
                     <Award className="w-5 h-5" /> Vinh Danh Của Thánh Thần!
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
