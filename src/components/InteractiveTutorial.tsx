import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  HelpCircle, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Network, 
  Trophy, 
  Cpu, 
  Bot, 
  Sliders, 
  Download, 
  Users, 
  Award, 
  Type, 
  History, 
  Keyboard 
} from "lucide-react";

interface StepConfig {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface InteractiveTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export function InteractiveTutorial({ isOpen, onClose }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: StepConfig[] = [
    {
      title: "🌲 Cây Kỹ Năng Stoic (Stoicism Skill Tree)",
      description: "Nơi rèn luyện bản lĩnh, kỷ luật của một triết gia thực thụ! Ngài không phải học tập mù quáng, mỗi lượng kiến thức hay phần trắc nghiệm ngài rèn luyện trên các bộ thẻ học sẽ tích lũy mở khóa, liên kết rẽ nhánh các kỹ năng Stoicism cổ đại, bồi đắp chỉ số nội lực bền bỉ mỗi ngày.",
      icon: <Network className="w-6 h-6 text-emerald-500 animate-pulse" />
    },
    {
      title: "🏆 Đấu Trường Xếp Hạng (Leaderboard Tuần)",
      description: "Xem điểm số XP và thứ hạng chiến tích của ngài so với toàn bộ triết gia học thuật khác. Bảng xếp hạng cập nhật thời gian thực, tự động tôn vinh Top 3 kèm vầng hào quang rực rỡ nhất tuần. Thắng bại tại nỗ lực, hãy cống hiến hết mình nhé!",
      icon: <Trophy className="w-6 h-6 text-orange-500 animate-pulse" />
    },
    {
      title: "🔄 United Ingestion & Rotation Engine V8.0",
      description: "Cơ chế bóc tách Flashcard siêu tốc từ tài liệu, ảnh chụp, file PDF học thuật, ảnh chụp trang sách hoặc văn bản thô dán trực tiếp. Hệ thống sở hữu cụm cân bằng tải xoay tua liên tục hơn 20 Keys Gemini, OpenRouter, DeepInfra, tự ngắt mạch (Circuit Breaker) và 'Silent Bypass' không bao giờ lo sập mạng!",
      icon: <Cpu className="w-6 h-6 text-cyan-500 animate-pulse" />
    },
    {
      title: "🤖 Agent 2 & Agent 3 (Gia Sư AI & Bản Đồ Mind Map Động)",
      description: "Trò chuyện sâu sắc với Gia Sư AI Socrates (Agent 2) kích thích tư duy phản biện. Đặc biệt, Agent 3 cho phép ngài phác họa sơ đồ tư duy (MIND MAP) trực quan động cho bất kỳ khái niệm phức tạp nào chỉ với 1 cú click ngay tại góc học tập. Dữ liệu mượt mà, ghi nhớ x10!",
      icon: <Bot className="w-6 h-6 text-purple-500 animate-pulse" />
    },
    {
      title: "📝 Sinh Đề Kiểm Tra & Trắc Nghiệm AI Linh Hoạt",
      description: "Hãy thử sức với trình thi cử thông minh của Agent 3! Ngài được quyền tự do tuỳ chỉnh số lượng câu hỏi trắc nghiệm MCQ (từ 5 đến 40 câu) dựa trên chính danh sách các thẻ yếu hoặc bộ học phần của ngài để rà soát chính xác lỗ hổng kiến thức định kỳ.",
      icon: <HelpCircle className="w-6 h-6 text-red-500 animate-pulse" />
    },
    {
      title: "📊 Biểu Đồ Thống Kê Sắc Nét & Hoạt Động Feed",
      description: "Đọc vị mọi thói quen biểu đồ của ngài: Hệ thống bóng bong bóng phân rã XP thực chiến, Stoic Heatmap đúc kết lịch sử hằng ngày, và bảng hoạt động Real-time Activity Feed vinh danh những sự kiện học tập mới nhất của cộng đồng hăng hái.",
      icon: <Sliders className="w-6 h-6 text-orange-500 animate-pulse" />
    },
    {
      title: "💾 Xuất Thống Kê Học Tập & Bộ Thẻ Excel",
      description: "Ngài muốn lưu trữ?? Dễ như trở bàn tay! Cụm công cụ Exporter cho phép xuất nhanh toàn bộ nội dung bộ thẻ học ra định dạng JSON, Excel, hoặc tải báo cáo tóm tắt quá trình học Khắc Kỷ của ngài về máy để báo cáo giáo viên hoặc tự theo dõi.",
      icon: <Download className="w-6 h-6 text-blue-550 animate-pulse" />
    },
    {
      title: "👥 CoStudy Room (Học Realtime Đồng Đội)",
      description: "Đừng học đơn độc m nha! Nhấp vào banner CoStudy để bước thẳng vào phòng tự học đa nền tảng realtime cực hot, chia sẻ không khí học tập, bật camera ảo nhóm cùng bạn bè trực tuyến, tăng vọt động lực tập trung tuyệt đối.",
      icon: <Users className="w-6 h-6 text-indigo-500 animate-pulse" />
    },
    {
      title: "👤 Hồ Sơ Cá Nhân & Huy Chương Thành Tựu",
      description: "Kho kỷ vật rực lửa! Nơi vinh danh lòng cam kết Stoic kiên trung của ngài qua hệ thống Huy Chương Thành Tựu rực rỡ, Avatar thông minh dán ảnh tùy biến và theo dõi chuỗi ngày Streak dài bất tận ghi đậm dấu ấn cá nhân.",
      icon: <Award className="w-6 h-6 text-pink-500 animate-pulse" />
    },
    {
      title: "⚡ Chế Độ Siêu Mượt (Fix Lag) & Thiết Lập Cỡ Chữ",
      description: "Trải nghiệm bị đứng, giật hình trên máy yếu? Nhấn phím 'E' để bật ngay Chế độ Mượt (Eco Mode) triệt tiêu hiệu ứng nặng. Kéo thanh trượt slider Cỡ Chữ (Font Zoom) trong Menu Cài đặt để phóng to, thu nhỏ giao diện tự cân đối golden-ratio không vỡ layout!",
      icon: <Type className="w-6 h-6 text-green-400 animate-pulse" />
    },
    {
      title: "🕒 Lịch Sử Học Tập & Nhật Ký Kỳ Thi",
      description: "Nhật ký rèn luyện ghi chép tường tận từng câu hỏi ngài đã trả lời sai, các kì thi thử đã làm, số thẻ flashcard đã ôn tập ngắt quãng để ngài dễ dàng lục lại ôn tập sâu vào cuối tuần.",
      icon: <History className="w-6 h-6 text-teal-400 animate-pulse" />
    },
    {
      title: "⌨️ Phím Tắt Tiện Lợi & Cẩm Nang Sống Còn",
      description: "Sử dụng bàn phím như một Hacker học thuật! Nhấn phím '?' bất cứ lúc nào để mở toang kho Cẩm Nang Phím Tắt (Hotkeys) quyền lực: H về Home, U mở bóc tách AI, K mở cây kỹ năng, S mở cài đặt... Tiết kiệm 90% thao tác chuột rườm rà!",
      icon: <Keyboard className="w-6 h-6 text-zinc-300 animate-pulse" />
    }
  ];

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div id="tutorial-overlay-container" className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
      {/* Dimmed backdrop background */}
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-zinc-950/75 dark:bg-black/85 backdrop-blur-sm transition-all" 
          onClick={onClose}
        />
      </AnimatePresence>

      {/* Floating Tooltip card (Centered) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-50 bg-zinc-900 border border-zinc-800 dark:bg-zinc-950 dark:border-zinc-850 text-zinc-100 rounded-3xl p-6 md:p-8 shadow-[0_25px_65px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto scrollbar-thin w-full max-w-md mx-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 shadow-inner flex items-center justify-center">
              {currentStepData.icon}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] sm:text-xs text-orange-500 font-black uppercase tracking-widest block">
                TÍNH NĂNG {currentStep + 1} / {steps.length}
              </span>
              <h4 className="text-sm sm:text-base font-black leading-tight tracking-tight text-neutral-100 uppercase font-display">
                {currentStepData.title}
              </h4>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 transition cursor-pointer shrink-0"
            title="Đóng Hướng Dẫn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-2xl p-5 mb-8">
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-sans font-medium">
            {currentStepData.description}
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-1.5 mb-6 flex-wrap px-4">
          {steps.map((_, idx) => (
             <div 
               key={idx} 
               className={`h-1.5 rounded-full transition-all duration-300 ${
                 idx === currentStep ? "w-6 bg-orange-500" : "w-1.5 bg-zinc-700"
               }`} 
             />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
          <button
            onClick={onClose}
            className="text-zinc-400 font-bold hover:text-white text-xs sm:text-sm uppercase tracking-wider transition hover:underline cursor-pointer"
          >
            Bỏ qua (Skip)
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 sm:py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs sm:text-sm font-black text-zinc-200 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Quay lại
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-500 hover:opacity-90 text-zinc-950 text-xs sm:text-sm font-black transition-transform active:scale-95 shadow-lg shadow-orange-500/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isLastStep ? "Hoàn thành" : "Tiếp theo"}{" "}
              <ChevronRight className="w-4 h-4 font-bold" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
