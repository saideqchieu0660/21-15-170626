export const ALL_TITLES = [
  { id: "Công Dân Athens", levelReq: 1, desc: "Danh hiệu khởi đầu khi bạn vừa chập chững bước vào con đường triết học." },
  { id: "Học Giả Thư Viện", levelReq: 3, desc: "Đạt cấp 3. Bạn đã làm quen với tri thức của nhân loại." },
  { id: "Biện Thuyết Gia", levelReq: 6, desc: "Đạt cấp 6. Tinh hoa hội tụ, năng lực tranh luận và học thuật bắt đầu được bộc lộ." },
  { id: "Triết Gia Khắc Kỷ", levelReq: 10, desc: "Đạt cấp 10. Bạn đã là một bậc thầy kiên định trên con đường học vấn của mình." },
  { id: "Tế Tư Delphi", levelReq: 15, desc: "Đạt cấp 15. Ánh sáng tri thức rực rỡ tỏa ra từ trí tuệ của bạn." },
  { id: "Á Thần Olympus", levelReq: 20, desc: "Đạt cấp 20. Khả năng học phi thường khiến người khác trầm trồ như một huyền thoại sống." },
  { id: "Chân Lý Logos", levelReq: 30, desc: "Đạt cấp 30. Nắm giữ kiến thức cốt lõi, thấu hiểu mọi lăng kính của vũ trụ." },
  { id: "Quân Vương Triết Học", isCustom: true, desc: "Danh hiệu bí ẩn, siêu hiếm. Đổi thưởng từ Agora với mức giá đắt đỏ. Hiệu ứng: Chân lý 7 màu luân hồi." },
  { id: "Thủ Lĩnh Sparta", isCustom: true, desc: "Danh hiệu bất bại, độc nhất vô nhị. Đấu Trường vinh danh. Hiệu ứng: Ngọc lục bảo chiến thần." },
  { id: "Học Giả Bách Khoa", isCustom: true, desc: "Phong hiệu danh giá mua từ Agora. Vàng kim chói lọi rực rỡ." },
  { id: "Người Cầm Trịch Chân Lý", isCustom: true, desc: "Người nắm quyền định đoạt đúng sai trong vũ trụ tu thư. Khí tức uy viễn." },
  { id: "Hậu Duệ Của Aristotle", isCustom: true, desc: "Kế thừa ngọn lửa triết học thời đại. Sóng biển xanh lục bảo chuyển động." },
  { id: "Lãnh Chúa Thời Không", isCustom: true, desc: "Người thao túng bánh xe thời gian. Chuyển sắc ngân hà vô tận." },
  { id: "Thần Thoại Kỷ Nguyên Mới", isCustom: true, desc: "Sự hiện diện của ngài tạo nên lịch sử mới. Hào quang kim cương tối thượng." },
];

export const getUnlockedTitles = (level: number, currentTitle?: string, unlockedCustomTitles: string[] = []) => {
  const titles = ALL_TITLES.filter(t => !t.isCustom && level >= t.levelReq).map(t => t.id);
  if (currentTitle && ALL_TITLES.find(t => t.isCustom && t.id === currentTitle)) {
    if (!titles.includes(currentTitle)) titles.push(currentTitle);
  }
  unlockedCustomTitles.forEach(t => {
    if (!titles.includes(t)) titles.push(t);
  });
  return titles;
};

export const getLevelInfo = (xp: number) => {
  const currentLevel = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
  const currentLevelXp = Math.pow(currentLevel - 1, 2) * 50;
  const nextLevelXp = Math.pow(currentLevel, 2) * 50;
  
  const xpIntoCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercentage = Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNextLevel) * 100));

  let title = "Công Dân Athens";
  if (currentLevel >= 3) title = "Học Giả Thư Viện";
  if (currentLevel >= 6) title = "Biện Thuyết Gia";
  if (currentLevel >= 10) title = "Triết Gia Khắc Kỷ";
  if (currentLevel >= 15) title = "Tế Tư Delphi";
  if (currentLevel >= 20) title = "Á Thần Olympus";
  if (currentLevel >= 30) title = "Chân Lý Logos";

  let titleColor = "text-zinc-500 font-medium";
  let badgeColors = "from-zinc-400 to-zinc-500 text-zinc-900";
  
  if (currentLevel >= 3) {
    titleColor = "text-blue-500 font-semibold drop-shadow-sm";
    badgeColors = "from-blue-400 to-blue-500 text-white shadow-blue-500/20";
  }
  if (currentLevel >= 6) {
    titleColor = "text-purple-500 font-bold drop-shadow-sm";
    badgeColors = "from-purple-400 to-purple-600 text-white shadow-purple-500/30";
  }
  if (currentLevel >= 10) {
    titleColor = "text-orange-500 font-extrabold drop-shadow-md";
    badgeColors = "from-orange-400 to-orange-500 text-white shadow-orange-500/40";
  }
  if (currentLevel >= 15) {
    titleColor = "text-red-500 font-black drop-shadow-md animate-pulse";
    badgeColors = "from-rose-500 to-red-600 text-white shadow-red-500/50";
  }
  if (currentLevel >= 20) {
    titleColor = "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-600 font-black drop-shadow-[0_2px_10px_rgba(249,115,22,0.6)] animate-pulse";
    badgeColors = "from-orange-300 via-orange-500 to-red-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.8)] ring-2 ring-orange-400/50";
  }
  if (currentLevel >= 30) {
    titleColor = "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-fuchsia-500 to-orange-400 font-black drop-shadow-[0_2px_15px_rgba(217,70,239,0.8)]";
    badgeColors = "from-blue-500 via-purple-500 to-orange-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.8)] ring-2 ring-fuchsia-400/80 animate-rainbow-bg";
  }

  return {
    currentLevel,
    currentLevelXp,
    nextLevelXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
    title,
    titleColor,
    badgeColors
  };
};

export const getCustomTitleTextClass = (title?: string, fallbackClass?: string) => {
  if (title === "Quân Vương Triết Học") {
    // 7 colors
    return "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 via-green-500 via-blue-500 to-purple-500 animate-rainbow-text font-black drop-shadow-[0_2px_15px_rgba(239,68,68,0.5)]";
  }
  if (title === "Thủ Lĩnh Sparta") {
    return "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-emerald-500 font-black drop-shadow-[0_2px_10px_rgba(16,185,129,0.5)]";
  }
  if (title === "Học Giả Bách Khoa") {
    return "text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-yellow-400 to-orange-600 font-black drop-shadow-[0_2px_15px_rgba(250,204,21,0.5)]";
  }
  if (title === "Người Cầm Trịch Chân Lý") {
    return "text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-black drop-shadow-[0_2px_15px_rgba(56,189,248,0.5)] tracking-widest";
  }
  if (title === "Hậu Duệ Của Aristotle") {
    return "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-500 font-black drop-shadow-[0_2px_20px_rgba(20,184,166,0.6)] animate-pulse";
  }
  if (title === "Lãnh Chúa Thời Không") {
    return "text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-red-500 font-black animate-rainbow-bg bg-size-200 drop-shadow-[0_5px_20px_rgba(168,85,247,0.7)]";
  }
  if (title === "Thần Thoại Kỷ Nguyên Mới") {
    return "text-white font-black drop-shadow-[0_0_20px_rgba(255,255,255,1)] animate-pulse tracking-[0.15em] bg-clip-text bg-gradient-to-b from-white to-neutral-500";
  }
  return title ? "text-orange-600 dark:text-orange-400 font-bold drop-shadow-sm" : (fallbackClass || "");
};

export const BORDERS_REGISTRY = [
  { id: "none", label: "Mặc định (Không viền)", color: "" },
  { id: "bronze", label: "Huy hiệu Đồng", color: "ring-4 ring-[#cd7f32] shadow-[0_0_15px_rgba(205,127,50,0.5)]" },
  { id: "silver", label: "Huy hiệu Bạc", color: "ring-4 ring-[#c0c0c0] shadow-[0_0_15px_rgba(192,192,192,0.5)]" },
  { id: "gold", label: "Huy hiệu Vàng", color: "ring-4 ring-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.5)]" },
  { id: "diamond", label: "Huy hiệu Kim Cương", color: "ring-4 ring-[#00ffff] shadow-[0_0_20px_rgba(0,255,255,0.6)] animate-pulse" },
  { id: "streak_3", label: "Vòng Ánh Sáng Động Thạch", color: "ring-4 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]" },
  { id: "points_100", label: "Viền Tinh Thạch Học Giả", color: "ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]" },
  { id: "streak_10", label: "Khung Ý Chí Khắc Kỷ", color: "ring-4 ring-orange-500/80 shadow-[0_0_20px_rgba(234,179,8,0.5)]" },
  { id: "points_1000", label: "Viền Kim Long Cấp", color: "ring-4 ring-[#ffd700] ring-offset-2 ring-offset-transparent shadow-[0_0_20px_rgba(255,215,0,0.5)]" },
  { id: "streak_50", label: "Hào Quang Bán Thần", color: "border-4 border-transparent bg-gradient-to-br from-purple-400 to-fuchsia-600 bg-clip-border shadow-[0_0_30px_rgba(192,132,252,0.6)] animate-pulse" },
  { id: "mastery_95", label: "Lời Nguyền Từ Các Nữ Thần", color: "border-4 border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.7)]" },
  { id: "top1_10", label: "Đế Cung Ánh Sáng", color: "ring-[6px] ring-orange-400 shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-rainbow-bg" },
  { id: "time_600", label: "Vầng Sáng Sáng Thế", color: "ring-4 ring-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse" },
];

export const getCustomTitleBadgeClass = (title?: string, fallbackClass?: string) => {
  if (title === "Quân Vương Triết Học") {
    return "bg-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 via-green-500 via-blue-500 to-purple-500 font-black ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-rainbow-text";
  }
  if (title === "Thủ Lĩnh Sparta") {
    return "bg-emerald-950 text-emerald-400 font-black ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
  }
  if (title === "Học Giả Bách Khoa") {
    return "bg-orange-950 text-orange-400 font-black ring-2 ring-orange-500/80 shadow-[0_0_20px_rgba(245,158,11,0.4)]";
  }
  if (title === "Người Cầm Trịch Chân Lý") {
    return "bg-indigo-950 text-cyan-400 font-black ring-2 ring-cyan-500/80 shadow-[0_0_20px_rgba(34,211,238,0.5)] tracking-wide";
  }
  if (title === "Hậu Duệ Của Aristotle") {
    return "bg-teal-950 text-teal-300 font-black ring-2 ring-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.6)] animate-pulse";
  }
  if (title === "Lãnh Chúa Thời Không") {
    return "bg-black text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-red-500 font-black ring-2 ring-fuchsia-500/80 shadow-[0_0_25px_rgba(217,70,239,0.6)] animate-rainbow-bg bg-size-200";
  }
  if (title === "Thần Thoại Kỷ Nguyên Mới") {
    return "bg-zinc-900 text-white font-black ring-4 ring-white/80 shadow-[0_0_30px_rgba(255,255,255,1)] animate-pulse tracking-widest";
  }
  return title ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold" : (fallbackClass || "");
};

export const getUnlockedBorders = (points: number, streak: number, top1Weeks: number, studyTime: number, mastery: number, currentBorder?: string, unlockedCustomBorders?: string[]) => {
  const unlocked = ["none"];
  if (streak >= 3) unlocked.push("streak_3");
  if (points >= 100) unlocked.push("points_100");
  if (streak >= 10) unlocked.push("streak_10");
  if (points >= 1000) unlocked.push("points_1000");
  if (streak >= 50) unlocked.push("streak_50");
  if (mastery >= 95) unlocked.push("mastery_95");
  if (top1Weeks >= 10) unlocked.push("top1_10");
  if (studyTime >= 600) unlocked.push("time_600");

  if (unlockedCustomBorders && Array.isArray(unlockedCustomBorders)) {
    unlockedCustomBorders.forEach(b => {
      if (!unlocked.includes(b)) unlocked.push(b);
    });
  }

  if (currentBorder && !unlocked.includes(currentBorder)) {
    // legacy borders or specially granted
    unlocked.push(currentBorder);
    if (!BORDERS_REGISTRY.find(b => b.id === currentBorder)) {
      BORDERS_REGISTRY.push({
         id: currentBorder,
         label: `Đặc biệt: ${currentBorder}`,
         color: "ring-4 ring-zinc-400 shadow-xl"
      });
    }
  }

  return BORDERS_REGISTRY.filter(b => unlocked.includes(b.id));
};

export const getAvatarBorderClass = (borderId?: string) => {
  if (!borderId || borderId === "none") return "";
  const found = BORDERS_REGISTRY.find(b => b.id === borderId);
  return found ? found.color : "";
};

