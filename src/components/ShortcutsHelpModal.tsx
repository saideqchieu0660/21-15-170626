import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Keyboard, 
  BookOpen, 
  Zap, 
  HelpCircle, 
  Compass, 
  Sliders, 
  Trophy, 
  User, 
  Tv, 
  Flame, 
  Award, 
  Cpu, 
  Sparkles, 
  LayoutDashboard,
  BrainCircuit,
  Volume2,
  Maximize2
} from "lucide-react";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"keys" | "handbook" | "engine">("keys");

  if (!isOpen) return null;

  const shortcutsList = [
    { key: "H", desc: "Bay thẳng về góc học tập (Tab Ôn Tập & Duyệt Flashcard)", icon: <BookOpen className="w-4 h-4 text-emerald-500" /> },
    { key: "U", desc: "Mở Đầu Não AI - Trình bóc tách Flashcard (V3 Engine)", icon: <Cpu className="w-4 h-4 text-cyan-500" /> },
    { key: "R", desc: "Xem Bảng Xếp Hạng tuần (Leaderboard khốc liệt)", icon: <Trophy className="w-4 h-4 text-orange-500" /> },
    { key: "K", desc: "Mở Cây Kỹ Năng rèn luyện Stoicism (Skill Tree)", icon: <BrainCircuit className="w-4 h-4 text-indigo-500" /> },
    { key: "C", desc: "Vào Phòng Học Cinematic (Phòng Cyberpunk mờ ảo)", icon: <Tv className="w-4 h-4 text-purple-500" /> },
    { key: "O", desc: "Phòng Học Nhóm CoStudy (Học realtime cùng ae)", icon: <LayoutDashboard className="w-4 h-4 text-pink-500" /> },
    { key: "A", desc: "Xem Kho Thành Tựu & Huy chương rực lửa", icon: <Award className="w-4 h-4 text-orange-500" /> },
    { key: "P", desc: "Xem Cài đặt trang cá nhân của ngài (Profile)", icon: <User className="w-4 h-4 text-blue-500" /> },
    { key: "M", desc: "Biểu đồ thông thạo & Heatmap chuyên sâu (Chart & Stats)", icon: <Sliders className="w-4 h-4 text-zinc-400" /> },
    { key: "S", desc: "Mở/Đóng nhanh Menu Cài đặt hệ sinh thái", icon: <Sliders className="w-4 h-4 text-orange-500 animate-pulse" /> },
    { key: "E", desc: "Bật/Tắt Chế độ Mượt (Fix Lag khẩn cấp)", icon: <Zap className="w-4 h-4 text-green-500" /> },
    { key: "F", desc: "Bật/Tắt chế độ Toàn Màn Hình (Fullscreen)", icon: <Maximize2 className="w-4 h-4 text-teal-500" /> },
    { key: "?", desc: "Mở hoặc tắt nhanh Cẩm nang cứu nguy này", icon: <HelpCircle className="w-4 h-4 text-red-500" /> },
  ];

  return (
    <div id="shortcuts-modal-overlay" className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Blurred dark overlay backdrop */}
      <div 
        id="shortcuts-modal-backdrop"
        className="fixed inset-0 bg-zinc-950/80 dark:bg-black/95 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      <motion.div
        id="shortcuts-modal-container"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-3xl h-[650px] max-h-[92vh] bg-zinc-900 border border-zinc-800 dark:bg-zinc-950 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col font-sans text-zinc-100"
      >
        {/* Decorative ambient gradient glowing on top */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-orange-500 via-orange-400 to-rose-500 opacity-80" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <Keyboard className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
                Hệ Thống Phím Tắt & Cẩm Nang Sử Dụng
              </h3>
              <p className="text-xs text-zinc-400 font-medium font-sans">Bí kíp rèn kỷ luật và làm chủ hệ thống Henosis Web của ngài</p>
            </div>
          </div>
          <button 
            id="close-shortcuts-modal-header"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 px-8 py-3 bg-zinc-900/50 dark:bg-zinc-900/40 border-b border-zinc-800/60 overflow-x-auto shrink-0">
          <button
            id="tab-btn-keys"
            onClick={() => setActiveSubTab("keys")}
            className={`py-2 px-4 rounded-xl text-xs font-black tracking-tight transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === "keys"
                ? "bg-orange-500 text-zinc-950 shadow-md"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Hệ Thống Phím Tắt (Hotkeys)
          </button>
          <button
            id="tab-btn-handbook"
            onClick={() => setActiveSubTab("handbook")}
            className={`py-2 px-4 rounded-xl text-xs font-black tracking-tight transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === "handbook"
                ? "bg-orange-500 text-zinc-950 shadow-md"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Cẩm Nang Sống Còn Chống Lag & Menu
          </button>
          <button
            id="tab-btn-engine"
            onClick={() => setActiveSubTab("engine")}
            className={`py-2 px-4 rounded-xl text-xs font-black tracking-tight transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === "engine"
                ? "bg-orange-500 text-zinc-950 shadow-md"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Đầu Não AI United Engine Chi Tiết
          </button>
        </div>

        {/* Modal content body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeSubTab === "keys" && (
              <motion.div
                key="keys-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {shortcutsList.map((item) => (
                  <div 
                    key={item.key} 
                    className="flex items-center justify-between p-4 bg-zinc-900/60 dark:bg-zinc-900/30 border border-zinc-850 dark:border-zinc-900/60 rounded-2xl hover:border-zinc-750 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-zinc-800 dark:bg-zinc-900 rounded-lg">
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-zinc-300 leading-snug">{item.desc}</span>
                    </div>
                    <kbd className="px-2.5 py-1 text-xs font-mono font-black bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded-lg shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </motion.div>
            )}

            {activeSubTab === "handbook" && (
              <motion.div
                key="handbook-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Fix Lag Section */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold">
                    <Zap className="w-5 h-5 text-green-500 shrink-0" />
                    <span>⚡ HƯỚNG DẪN DIỆT GIẬT LAG TRIỆT ĐỂ (FIX LAG)</span>
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed font-sans space-y-2">
                    <p>
                      Ngài có thấy hiệu ứng lướt card hoặc mây trôi rực rỡ ở phòng học Cyberpunk bị chậm, đơ đơ? Đúng rồi, do phần cứng GPU/RAM của ngài đang gánh chịu cấu hình đồ họa cao cấp của hệ thống không?
                    </p>
                    <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 mt-2">
                      <span className="text-white font-bold block mb-1">👉 Cách xử lý siêu tốc:</span>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                        <li>Ấn phím <kbd className="px-1.5 py-0.5 font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded">E</kbd> trên bàn phím để kích hoạt ngay <strong>Chế Độ Mượt (Eco Mode)</strong>.</li>
                        <li>Hoặc ấn phím <kbd className="px-1.5 py-0.5 font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded">S</kbd> mở menu cài đặt, sau đó bật thủ công nút gạt <strong>Chế độ Mượt (Eco Mode / Fix Lag)</strong>.</li>
                        <li>Ngay lập tức, hệ thống sẽ tắt sạch hiệu ứng tuyết rơi, các hạt canvas nền động lững lờ, giảm độ phân giải chuyển cảnh phức tạp. Trả lại cho ngài một giao diện tĩnh mướt rượt, tải siêu nhanh và tiết kiệm pin tối đa!</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Font Size Section */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <Sliders className="w-5 h-5 text-cyan-500 shrink-0" />
                    <span>🔍 ĐIỀU CHỈNH CỠ CHỮ LINH HOẠT</span>
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed font-sans space-y-2">
                    <p>
                      Đừng để mỏi mắt phá vỡ nhịp điệu học tập của ngài. Hệ thống đã tích hợp bộ zoom giao diện thông minh ngay trong tầm tay.
                    </p>
                    <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                      <span className="text-white font-bold block mb-1">👉 Các bước tuỳ chỉnh:</span>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                        <li>Ấn phím <kbd className="px-1.5 py-0.5 font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded">S</kbd> để kéo trực tiếp menu cài đặt từ góc phải màn hình.</li>
                        <li>Tại mục <strong>Cỡ Chữ (Font Zoom)</strong>, ngài kéo thanh trượt Slider để tùy chỉnh kích thước mong muốn (từ nhỏ gọn 80% đến siêu to 130%).</li>
                        <li>Henosis áp dụng <strong>Công Nghệ Auto-Scaling Dynamic Base Layout</strong>. Khi tăng cỡ chữ, hệ thống tự động dãn cách paddings, margins, và chiều cao của thẻ tương ứng theo tỉ lệ vàng, đảm bảo giao diện luôn cân đối hoàn mĩ và không bị vỡ layout.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Comprehensive Modules Guide */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                  <div className="flex items-center gap-2 text-orange-500 font-bold">
                    <Compass className="w-5 h-5 text-orange-500 shrink-0" />
                    <span>🧭 CẨM NANG LÀM CHỦ CÁC CHỨC NĂNG CỦA HENOSIS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-orange-500 font-display font-black text-xs block flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" /> 🏆 Leaderboard (Bảng Xếp Hạng)
                      </span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Nơi tranh tài vương quyền của đấu trường học tập. Mỗi khi ngài ôn luyện thẻ, vượt qua các câu hỏi trắc nghiệm, tạo tài liệu hoặc tương tác với Socrates AI, ngài đều được cộng điểm XP. Bảng xếp hạng sẽ tự động cập nhật realtime để vinh danh Top 3 kèm vầng hào quang rực rỡ nhất tuần!
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-indigo-400 font-display font-black text-xs block flex items-center gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5" /> 🌳 Skill Tree (Cây Kỹ Năng)
                      </span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Bản đồ rèn luyện kỷ luật Stoicism độc nhất vô nhị. Ngài không phải học một cách vô hướng, mà rẽ nhánh mở khóa các kỹ năng từ cơ bản đến thượng thừa nhờ lượng từ vựng và chủ đề học tích lũy. Mối nhánh kỹ năng tương ứng với thông số học tập thực của chính bộ thẻ ngài đang sở hữu.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-purple-400 font-display font-black text-xs block flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5" /> 🍿 Study Room (Cinematic & CoStudy Room)
                      </span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Chìm đắm tuyệt đối vào thế giới tập trung:
                        <br />
                        - <strong>Cinematic Space</strong>: Mưa rơi rì rào Cyberpunk mờ ảo, nhạc lofi du dương kèm âm gõ phím kích thích tập trung sâu.
                        <br />
                        - <strong>CoStudy Group</strong>: Tạo phòng, bật camera ảo kéo anh em vào học bài realtime cực đồng đội và hăng hái!
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-blue-400 font-display font-black text-xs block flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> 👤 Profile & Achievements (Cá Nhân & Kho Kỷ Vật)
                      </span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Góc cá tính của riêng ngài! Cập nhật avatar siêu nhanh thông qua Canvas chuyển đổi ảnh thông minh, thay đổi biệt hiệu phong cách, và theo dõi bộ sưu tập <strong>Huy Chương Thành Tựu</strong> danh giá ghi dấu cam kết học tập trọn đời của ngài.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-1 md:col-span-2">
                      <span className="text-emerald-400 font-display font-black text-xs block flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" /> 📊 Biểu Đồ Thống Kê & Bản Đồ Sứ Mệnh (Chart & Heatmap)
                      </span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Đọc vị tiến trình của ngài qua số liệu thực: <strong>Biểu đồ bong bóng XP phân bổ</strong> trực quan hóa những ngách kiến thức ngài đang thống trị. Kèm theo là <strong>Stoic Heatmap Lịch Sử</strong> ghi nhận chi tiết tần suất học tập mỗi ngày. Hãy tô xanh tất cả các ngày, đừng cho phép bản thân để đứt chuỗi phong độ (Streak)!
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === "engine" && (
              <motion.div
                key="engine-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Intro */}
                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <BrainCircuit className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="text-md font-display font-black text-white">
                        V8.0 UNITED ROTATION ENGINE — GIẢI THÍCH CHI TIẾT
                      </h4>
                      <p className="text-xs text-zinc-405">Kiến trúc cân bằng tải, xoay vòng khóa API và cơ chế miễn nhiễm lỗi 403/404</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-zinc-300 leading-relaxed font-sans space-y-3">
                    <p>
                      Hệ thống Henosis tích hợp bộ xử lý đầu não <strong>United Ingestion and Rotation Engine V8.0</strong> siêu đỉnh nhằm giải quyết bài toán sập băng thông, giới hạn hạn ngạch hoặc lỗi API nhà cung cấp (OpenRouter/Gemini/Groq/DeepInfra).
                    </p>
                    <p>
                      Khi ngài nộp văn bản lớn, tài liệu học thuật hoặc ảnh chụp, hệ thống sẽ tự động bẻ sườn và vận hành thông qua các công nghệ cốt lõi sau:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-orange-500 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-orange-500 shrink-0 animate-pulse" />
                        ⚙️ Micro-Slicing Content Boundary
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Tài liệu của ngài dài hàng trăm trang? United Engine sẽ tự động chia nhỏ mỏng văn bản thành từng phần hợp lý (Slices) khớp khít với dung lượng <strong>Context Window</strong> của AI Model mà không làm gãy ngữ cảnh của từ vựng hay đoạn hội thoại, triệt tiêu lỗi mất mát thông tin.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-cyan-400 uppercase tracking-wider">
                        <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                        🔄 Round-Robin Key Rotation Matrix
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Xếp xen kẽ hàng chục khóa dự phòng (Interleaved Keys Pool). Hệ thống liên tục thăm dò trạng thái khóa. Nếu một khóa dính lỗi 429 (Rate Limit) hay hết quota, thuật toán tự đẩy khóa đó vào hàng đợi làm nguội (Cooling Map trong 60 giây) và lập tức xoay tua sang khóa tiếp theo để hoàn thành tiến trình.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-green-400 uppercase tracking-wider">
                        <Zap className="w-4 h-4 text-green-400 shrink-0" />
                        🛡️ Watertight Silent Bypass Guard
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Công nghệ đột phá của phiên bản V8.0! Khi gọi OpenRouter gặp lỗi tài khoản trả phí buộc (402, 403, 404, hoặc bị ngừng hỗ trợ tài khoản miễn phí), United Engine tự động nhận diện thông qua bộ lọc thông minh, thực thi **Silent Bypass**. Hệ thống không ném lỗi ra màn hình gây gián đoạn cho ngài, mà lặng lẽ chuyển sang luồng dự bị mượt mà!
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-400 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                        🤖 OpenAI GPT-OSS-120B Integration
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Đầu não OpenRouter giờ đây liên kết trực tiếp tới siêu mô hình học thuật miễn phí <strong>openai/gpt-oss-120b</strong>, mang lại hiệu ứng dịch nghĩa mượt như nhung, thiết lập câu hỏi mang tính gợi mở tuyệt hảo đặc thù cho phương pháp Socrates truyền thống.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stoic Quote Footer */}
                <div className="text-center italic text-zinc-500 text-[10px] uppercase font-bold tracking-wider font-sans">
                  "Chất lượng trí tuệ của ngài sẽ phụ thuộc hoàn toàn vào mức độ tích lũy bền bỉ và sự tập trung của ngài qua từng ngày" — Marcus Aurelius
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-zinc-950 dark:bg-black/40 border-t border-zinc-800 flex justify-between items-center text-xs shrink-0">
          <span className="text-zinc-500 font-mono text-[10px] uppercase font-bold">
            💡 Mẹo Stoic: Ấn phím <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded text-[9px] font-mono">?</kbd> để đóng nhanh cẩm nang này
          </span>
          <button
            id="close-shortcuts-modal-footer"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-zinc-950 font-black transition-transform active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            Đã Hiểu, Chiến Tiếp!
          </button>
        </div>
      </motion.div>
    </div>
  );
}
