import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Crown, Sparkles, Award, Star, X, CheckCircle2, Trophy, Compass, Shield, Flame, Activity, Hourglass, Calendar, Book, Clock, Cpu, Lock, Layers } from 'lucide-react';
import { store } from '../lib/store';

// A mapping to get actual lucide components by name or predefined id if needed
// We'll rely on passing the icons if possible, or mapping them
const ICONS: Record<string, any> = {
  Compass, Flame, Shield, Calendar, Award, Star, Sparkles, Book, Clock, Activity, Hourglass, Cpu
};

interface AchievementCardProps {
  points: number;
  streak: number;
  unlockedBadges: any[];
  onClose: () => void;
}

export const AchievementCard = ({ points, streak, unlockedBadges, onClose }: AchievementCardProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const exportAllRef = useRef<HTMLDivElement>(null);
  const user = store.getCurrentUser();
  const userName = user?.name || "Học Giả";

  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? unlockedBadges.length - 1 : prev - 1));
  };
  
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === unlockedBadges.length - 1 ? 0 : prev + 1));
  };

  const currentBadge = unlockedBadges[currentIndex];

  const handleExportPDF = async (mode: 'single' | 'all') => {
    const targetRef = mode === 'single' ? captureRef.current : exportAllRef.current;
    if (!targetRef) return;
    
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      // Đợi font loading và render
      await document.fonts.ready;
      
      // Chờ thêm một chút để đảm bảo ảnh trong DOM đã được decode
      const images = Array.from(targetRef.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; // Đảm bảo không bị treo nếu ảnh lỗi
        });
      }));

      await new Promise(resolve => setTimeout(resolve, 800)); // Thêm thời gian chờ dự phòng (delay thêm một chút)

      // Temporarily bring the element to viewport but behind everything to ensure browser renders it properly
      const originalTop = targetRef.style.top;
      const originalLeft = targetRef.style.left;
      const originalZIndex = targetRef.style.zIndex;
      const originalPosition = targetRef.style.position;
      const originalOpacity = targetRef.style.opacity;
      const originalDisplay = targetRef.style.display;
      const originalPointerEvents = targetRef.style.pointerEvents;
      
      targetRef.style.position = 'absolute';
      targetRef.style.top = '0px';
      targetRef.style.left = '0px';
      targetRef.style.zIndex = '-9999';
      targetRef.style.opacity = '1';
      targetRef.style.display = 'flex';
      targetRef.style.pointerEvents = 'none';

      // Force browser to recalculate layout
      targetRef.getBoundingClientRect();
      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(targetRef, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#09090b', // bg-zinc-950
        logging: false,
        onclone: (clonedDoc) => {
          // If any cloned elements need adjustments to ensure they are visible
          const clonedEl = clonedDoc.getElementById(targetRef.id);
          if (clonedEl) {
             clonedEl.style.position = 'relative';
             clonedEl.style.top = '0';
             clonedEl.style.left = '0';
          }
        }
      });

      // Trả element về chỗ cũ
      targetRef.style.position = originalPosition;
      targetRef.style.top = originalTop;
      targetRef.style.left = originalLeft;
      targetRef.style.zIndex = originalZIndex;
      targetRef.style.opacity = originalOpacity;
      targetRef.style.display = originalDisplay;
      targetRef.style.pointerEvents = originalPointerEvents;

      const imgData = canvas.toDataURL('image/png', 1.0);

      let pdfWidth = 800;
      let pdfHeight = mode === 'single' ? 500 : targetRef.offsetHeight;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`henosis-achievements-${mode}-${user?.id || 'export'}-${Date.now()}.pdf`);
      
    } catch (err) {
      console.error('Export failed:', err);
      if (err instanceof Error) {
         console.warn(`Tải xuống thất bại. Chi tiết lỗi: ${err.message}`);
      } else {
         console.warn('Tải xuống thất bại. Lỗi kết xuất hình ảnh.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      
      {/* KHUNG ẨN CHỨA TOÀN BỘ DANH SÁCH (Dành cho Export "Tất Cả") */}
      <div 
        ref={exportAllRef} 
        className="fixed bg-zinc-950 border border-zinc-800"
        style={{ width: '800px', position: 'fixed', top: '-10000px', left: '-10000px', display: 'flex', flexDirection: 'column', padding: '40px', zIndex: -100 }}
      >
        <div className="flex items-center justify-center mb-8 text-center pb-8 border-b border-zinc-800 border-dashed">
          <div className="flex flex-col items-center">
             <Crown className="w-16 h-16 text-orange-500 mb-4" />
             <h2 className="text-xl font-bold text-zinc-400 mb-1 tracking-widest uppercase">HỒ SƠ VINH DANH TOÀN TẬP</h2>
             <h1 className="text-4xl font-black text-white">{userName}</h1>
             <div className="flex gap-6 mt-4">
               <div className="flex items-center gap-2 text-zinc-300">
                 <Star className="w-5 h-5 text-yellow-500" />
                 <span className="font-bold">{points.toLocaleString()} XP</span>
               </div>
               <div className="flex items-center gap-2 text-zinc-300">
                 <Trophy className="w-5 h-5 text-emerald-500" />
                 <span className="font-bold">{unlockedBadges.length} Huy Chương</span>
               </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6" style={{ width: '100%' }}>
          {unlockedBadges.map((badge, idx) => (
             <div key={idx} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex items-start gap-4">
               <div className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-xl ${badge.border || 'border-zinc-700'} ${badge.bg || 'bg-zinc-800'}`}>
                 {badge.icon ? (
                   <badge.icon className={`w-8 h-8 ${badge.color || 'text-white'}`} />
                 ) : (
                   <Award className="w-8 h-8 text-zinc-400" />
                 )}
               </div>
               <div>
                  <h4 className="text-xl font-bold text-white mb-1">{badge.name}</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-2">{badge.desc}</p>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Đạt Chuẩn
                  </div>
               </div>
             </div>
          ))}
        </div>
        
        <div className="mt-12 pt-8 border-t border-zinc-800 border-dashed text-center">
            <p className="text-sm text-zinc-600 font-mono tracking-widest uppercase">
              COSTUDY HENOSIS • {(new Date()).toLocaleDateString('vi-VN')}
            </p>
        </div>
      </div>

      {/* KHUNG ẨN CHỨA SINGLE LAYOUT ĐỂ XUẤT PDF CỐ ĐỊNH = 800px */}
      <div
        ref={captureRef}
        className="fixed bg-zinc-950 border border-zinc-800 flex-row overflow-hidden"
        style={{ width: '800px', height: '500px', position: 'fixed', top: '-10000px', left: '-10000px', display: 'flex', zIndex: -100 }}
      >
          {/* Cột trái: Tổng quan User */}
          <div className="w-1/3 p-8 border-r border-zinc-900 bg-gradient-to-br from-zinc-950 to-black flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-orange-500/5 pointer-events-none"></div>
            <Crown className="w-16 h-16 text-orange-500 mb-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
            <h2 className="text-xl font-bold text-zinc-400 mb-1 tracking-widest uppercase text-center">HỒ SƠ VINH DANH</h2>
            <h1 className="text-3xl font-black text-white text-center mb-6">{userName}</h1>
            <div className="w-full space-y-4 relative z-10">
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Star className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Tổng Điểm</p>
                  <p className="text-white font-black text-xl">{points.toLocaleString()} XP</p>
                </div>
              </div>
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Flame className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Chuỗi Ngày</p>
                  <p className="text-white font-black text-xl">{streak} Ngày</p>
                </div>
              </div>
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Trophy className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Huy Chương</p>
                  <p className="text-white font-black text-xl">{unlockedBadges.length} Đã Đạt</p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
              COSTUDY HENOSIS • {(new Date()).toLocaleDateString('vi-VN')}
            </div>
          </div>

          {/* Cột phải: Carousel Huy Chương (Phiên bản tĩnh ko có AnimatePresence) */}
          <div className="w-2/3 bg-black flex flex-col justify-center items-center relative overflow-hidden p-8">
            {unlockedBadges.length === 0 ? (
              <div className="text-center text-zinc-600 flex flex-col items-center gap-4">
                <Lock className="w-16 h-16 opacity-50" />
                <p className="font-bold text-lg">Chưa có huy chương nào để hiển thị.</p>
              </div>
            ) : (
              <>
                <div className="absolute top-8 left-8">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Award className="w-6 h-6 text-orange-500" /> Bộ Sưu Tập Tinh Hoa
                  </h3>
                </div>

                <div className="w-full max-w-sm mt-8 relative z-10">
                   <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative">
                         <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl pointer-events-none"></div>
                         <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-6 shadow-2xl border-2 ${currentBadge?.border || 'border-zinc-700'} ${currentBadge?.bg || 'bg-zinc-800'}`}>
                           {currentBadge?.icon ? (
                             <currentBadge.icon className={`w-12 h-12 ${currentBadge.color || 'text-white'}`} />
                           ) : (
                             <Award className="w-12 h-12 text-zinc-400" />
                           )}
                         </div>
                         <h4 className="text-2xl font-black text-white mb-2">{currentBadge?.name}</h4>
                         <p className="text-zinc-400 font-medium mb-4">{currentBadge?.desc}</p>
                         <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4" /> Đã Mở Khóa Đạt Chuẩn
                         </div>
                   </div>
                </div>
                
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 z-20">
                  <span className="text-zinc-500 font-bold bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    {currentIndex + 1} / {unlockedBadges.length}
                  </span>
                </div>
              </>
            )}
          </div>
      </div>

      {/* KHUNG RESPONSIVE HIỂN THỊ TRỰC TIẾP CHO NGƯỜI DÙNG */}
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto overflow-y-auto no-scrollbar rounded-t-3xl mt-auto md:mt-0">
        
        {/* Nút Đóng */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Giao diện Xem Trước (Desktop + Mobile Layout) */}
        <div className="w-full flex flex-col md:flex-row min-h-[500px] relative bg-zinc-950">
          {/* Cột trái: Tổng quan User */}
          <div className="w-full md:w-1/3 p-6 md:p-8 border-b md:border-b-0 md:border-r border-zinc-900 bg-gradient-to-br from-zinc-950 to-black flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-orange-500/5 pointer-events-none"></div>
            
            <Crown className="w-12 h-12 md:w-16 md:h-16 text-orange-500 mb-3 md:mb-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
            
            <h2 className="text-sm md:text-xl font-bold text-zinc-400 mb-1 tracking-widest uppercase text-center">HỒ SƠ VINH DANH</h2>
            <h1 className="text-2xl md:text-3xl font-black text-white text-center mb-6">{userName}</h1>
            
            <div className="w-full space-y-3 md:space-y-4 relative z-10">
              <div className="bg-zinc-900/50 p-3 md:p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Star className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                <div>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase">Tổng Điểm</p>
                  <p className="text-white font-black text-lg md:text-xl">{points.toLocaleString()} XP</p>
                </div>
              </div>
              
              <div className="bg-zinc-900/50 p-3 md:p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Flame className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
                <div>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase">Chuỗi Ngày</p>
                  <p className="text-white font-black text-lg md:text-xl">{streak} Ngày</p>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-3 md:p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                <Trophy className="w-6 h-6 md:w-8 md:h-8 text-emerald-500" />
                <div>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase">Huy Chương</p>
                  <p className="text-white font-black text-lg md:text-xl">{unlockedBadges.length} Đã Đạt</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 md:mt-8 text-[9px] md:text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
              COSTUDY HENOSIS • {(new Date()).toLocaleDateString('vi-VN')}
            </div>
          </div>

          {/* Cột phải: Carousel Huy Chương */}
          <div className="w-full md:w-2/3 bg-black flex flex-col items-center relative p-6 pb-24 md:p-8 md:justify-center overflow-hidden min-h-[350px] md:min-h-auto">
            {unlockedBadges.length === 0 ? (
              <div className="text-center text-zinc-600 flex flex-col items-center gap-4 my-auto">
                <Lock className="w-12 h-12 md:w-16 md:h-16 opacity-50" />
                <p className="font-bold text-base md:text-lg">Chưa có huy chương nào để hiển thị.</p>
              </div>
            ) : (
              <>
                <div className="md:absolute md:top-8 md:left-8 mb-6 w-full text-center md:text-left">
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                    <Award className="w-5 h-5 md:w-6 md:h-6 text-orange-500" /> Bộ Sưu Tập Tinh Hoa
                  </h3>
                </div>

                <div className="w-full max-w-sm relative z-10">
                   <AnimatePresence mode="wait">
                      <motion.div
                        key={currentBadge?.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-2xl relative"
                      >
                         <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl pointer-events-none"></div>
                         
                         <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-2xl border-2 ${currentBadge?.border || 'border-zinc-700'} ${currentBadge?.bg || 'bg-zinc-800'}`}>
                           {currentBadge?.icon ? (
                             <currentBadge.icon className={`w-10 h-10 md:w-12 md:h-12 ${currentBadge.color || 'text-white'}`} />
                           ) : (
                             <Award className="w-10 h-10 md:w-12 md:h-12 text-zinc-400" />
                           )}
                         </div>

                         <h4 className="text-xl md:text-2xl font-black text-white mb-2">{currentBadge?.name}</h4>
                         <p className="text-sm md:text-base text-zinc-400 font-medium mb-4">{currentBadge?.desc}</p>
                         
                         <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" /> Đã Mở Khóa Đạt Chuẩn
                         </div>
                      </motion.div>
                   </AnimatePresence>
                </div>
                
                <div className="absolute bottom-24 top-auto md:top-auto md:bottom-8 left-0 right-0 flex justify-center gap-4 z-20">
                  <span className="text-zinc-500 text-sm md:text-base font-bold bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    {currentIndex + 1} / {unlockedBadges.length}
                  </span>
                </div>
              </>
            )}

            {/* Cấu Trúc Khung Điều Khiển Ẩn / Menu Option (Mobile moved up slightly) */}
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-between p-2 md:p-8 top-12 md:top-0">
               {unlockedBadges.length > 1 && (
                 <>
                   <button onClick={prevSlide} className="pointer-events-auto p-2 md:p-3 bg-black/50 hover:bg-black text-white rounded-full border border-zinc-800 transition active:scale-90">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                   </button>
                   <button onClick={nextSlide} className="pointer-events-auto p-2 md:p-3 bg-black/50 hover:bg-black text-white rounded-full border border-zinc-800 transition active:scale-90">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                   </button>
                 </>
               )}
            </div>

            <div className="absolute bottom-4 left-0 right-0 z-50 pointer-events-auto flex flex-col items-center gap-2 md:bottom-8 md:right-8 md:pb-0 md:left-auto md:items-end">
                <AnimatePresence>
                    {showExportMenu && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex flex-col w-56 overflow-hidden origin-bottom mb-2 md:mb-0 md:origin-bottom-right"
                        >
                            <button
                                onClick={() => handleExportPDF('single')}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 rounded-xl transition text-left"
                            >
                                <Trophy className="w-4 h-4 text-orange-500" /> Thành Tựu Hiện Tại
                            </button>
                            <button
                                onClick={() => handleExportPDF('all')}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 rounded-xl transition text-left"
                            >
                                <Layers className="w-4 h-4 text-yellow-500" /> Toàn Bộ Thành Tựu
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className="flex items-center justify-center w-[90%] md:w-auto gap-2 bg-orange-500 hover:bg-orange-400 text-black px-6 py-3 rounded-2xl font-black transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50"
                >
                  {isExporting ? (
                    <><Hourglass className="w-4 h-4 animate-spin" /> <span className="md:hidden">Đang Xuất PDF...</span><span className="hidden md:inline">Đang Kết Xuất PDF...</span></>
                  ) : (
                    <><Download className="w-4 h-4 md:w-5 md:h-5" /> <span className="md:hidden">Xuất PDF</span><span className="hidden md:inline">Tải Xuống (PDF)</span></>
                  )}
                </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
