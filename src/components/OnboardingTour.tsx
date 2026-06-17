import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check, Compass } from "lucide-react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

interface Step {
  title: string;
  content: string;
}

const TOUR_STEPS: Step[] = [
  {
    title: "Chào Mừng Đến Với Henosis!",
    content: "Đây là trang tổng quan nơi bạn có thể bắt đầu hành trình học tập. Hãy làm quen với các tính năng tuyệt vời ở đây nhé.",
  },
  {
    title: "Trang Học Tập & Khám Phá Kho Tàng",
    content: "Chọn bộ thẻ yêu thích và nhấn 'Bắt đầu học' để trải nghiệm các phương pháp rèn luyện trí nhớ và hệ thống ôn tập ngắt quãng độc đáo.",
  },
  {
    title: "Chế Độ Co-Study & Phân Tích",
    content: "Tham gia phòng học chung (Co-Study), trò chuyện với Agent hỗ trợ AI của chúng tôi và theo dõi 'Biểu đồ thông thạo' để tối ưu hóa việc học.",
  },
  {
    title: "Bảng Xếp Hạng & Lịch Sử",
    content: "Luôn kiểm tra bảng xếp hạng để cọ xát với các học viên khác, và theo dõi phần Lịch sử để nhìn lại chặn đường đã cố gắng của bản thân.",
  }
];

export function OnboardingTour({ onComplete }: { onComplete?: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
     let mounted = true;
     let unsubscribe = () => {};
     
     const checkTourStatus = async (uid: string) => {
         try {
             const docRef = doc(db, "user_preferences", uid);
             const snap = await getDoc(docRef);
             if (mounted) {
                 if (snap.exists() && snap.data().skipOnboarding) {
                     if (onComplete) onComplete();
                 } else {
                     setIsVisible(true);
                 }
             }
         } catch (e) {
             console.error("Error reading user_preferences onboarding data:", e);
             if (mounted) setIsVisible(true);
         }
     };

     import("firebase/auth").then(({ onAuthStateChanged }) => {
         if (!mounted) return;
         unsubscribe = onAuthStateChanged(auth, (usr) => {
             if (usr) {
                 checkTourStatus(usr.uid);
             }
         });
     });

     return () => {
         mounted = false;
         unsubscribe();
     };
  }, [onComplete]);

  const saveSkipPreference = async () => {
      if (auth.currentUser) {
          try {
             await setDoc(doc(db, "user_preferences", auth.currentUser.uid), {
                 skipOnboarding: true
             }, { merge: true });
          } catch (e) {
             console.error("Khong the luu tuy chon Onboarding", e);
          }
      }
  };

  const handleClose = () => {
      setIsVisible(false);
      if (onComplete) onComplete();
  };

  const handleSkipOrFinish = async () => {
      setIsVisible(false);
      if (onComplete) onComplete();
      await saveSkipPreference();
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];

  return (
     <AnimatePresence>
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         >
           <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative border border-zinc-200 dark:border-zinc-800"
            >
               <button onClick={handleSkipOrFinish} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-black/5 dark:bg-white/5 rounded-full p-1.5 transition">
                 <X className="w-5 h-5" />
               </button>
               
               <div className="mb-6">
                  <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 text-[10px] font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 w-fit mb-4">
                     <Compass className="w-3.5 h-3.5" />
                     Hướng dẫn người mới ({currentStep + 1}/{TOUR_STEPS.length})
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mb-3 font-display tracking-tight text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {step.content}
                  </p>
               </div>

               <div className="flex flex-col sm:flex-row items-center justify-end mt-8 border-t border-zinc-100 dark:border-zinc-800 pt-5 gap-4">
                  <div className="flex items-center justify-end w-full sm:w-auto gap-2">
                     <button 
                         onClick={handleSkipOrFinish}
                         className="p-2 md:px-3 rounded-xl border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium transition text-sm h-10"
                     >
                        Bỏ qua
                     </button>
                     {currentStep > 0 && (
                        <button 
                          onClick={() => setCurrentStep(prev => prev - 1)}
                          className="p-2 md:px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center font-medium shadow-sm h-10 min-w-[40px] text-sm"
                        >
                          <ChevronLeft className="w-4 h-4" /> <span className="hidden md:inline ml-1">Lùi lại</span>
                        </button>
                     )}
                     
                     <button 
                       onClick={() => {
                          if (currentStep === TOUR_STEPS.length - 1) {
                             handleSkipOrFinish();
                          } else {
                             setCurrentStep(prev => prev + 1);
                          }
                       }}
                       className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-orange-500 text-white dark:text-zinc-900 px-4 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-md h-10 w-full sm:w-auto"
                     >
                        {currentStep === TOUR_STEPS.length - 1 ? (
                           <>Bắt đầu học <Check className="w-4 h-4"/></>
                        ) : (
                           <>Tiếp tục <ChevronRight className="w-4 h-4"/></>
                        )}
                     </button>
                  </div>
               </div>
           </motion.div>
        </motion.div>
     </AnimatePresence>
  );
}
