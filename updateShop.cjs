const fs = require('fs');

let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

const itemsData = [
  { term: "Item 1: Streak Freeze", id: "aegis_shield", name: "Tấm Khiên Của Aegis (Bảo Vệ Streak)" },
  { term: "Item 2: XP Potion", id: "ambrosia_nectar", name: "Mật Hoa Ambrosia (50 XP)" },
  { term: "Item 3: Level Up", id: "athenas_salvation", name: "Sự Cứu Rỗi Của Athena (Bỏ Qua & Lên Cấp)" },
  { term: "Item 4: custom avatar border Diamond", id: "olympus_aura", name: "Hào Quang Olympus (Viền Cương)" },
  { term: "Item 5: Title \"Kỳ Tài\"", id: "polymath_title", name: "Phong Hiệu 'Học Giả Bách Khoa'" },
  { term: "Item 6: School Lover Toggle", id: "lionheart_icon", name: "Trái Tim Sư Tử (Biểu tượng nhiệt huyết)" },
  { term: "Item 7: Rương Báu Hư Không", id: "pandoras_box", name: "Chiếc Hộp Pandora" },
  { term: "Item 9: Cấm Thuật Hiến Tế", id: "level_sacrifice", name: "Hiến Tế Cấp Độ" },
  { term: "Item 8 [UPDATED]: Ngọn Lửa Prometheus", id: "prometheus_fire", name: "Ngọn Lửa Prometheus (Thử Thách Streak 10 Ngày)" },
  { term: "Item 9 [NEW]: Quân Vương Triết Học", id: "philosopher_king_crown", name: "Vương Miện 'Quân Vương Triết Học'" },
  { term: "Item 10 [NEW]: United Engine Code", id: "united_engine_core", name: "Lõi Năng Lượng United Engine" },
  { term: "Item 11: Nước Tăng Lực Tri Thức", id: "intellect_elixir", name: "Nước Tăng Lực Trí Thức" },
  { term: "Item 12: Mặt Nạ Ẩn Danh", id: "anonymous_mask", name: "Mặt Nạ Ẩn Danh" },
  { term: "Item 13: Quyền Trượng Đấng Toàn Năng", id: "almighty_scepter", name: "Quyền Trượng Đấng Toàn Năng (Role Admin)" }
];

itemsData.forEach(item => {
  const searchTerm = item.term;
  const regex = new RegExp(`(\\{/\\* ${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\s*<div[^>]*>\\s*<div[^>]*>\\s*<div>\\s*<div className="flex items-center justify-between mb-4">\\s*<span[^>]*>\\s*<[^>]*>\\s*</span>)\\s*(<span[^>]*>[^<]*</span>)`, 'g');
  
  if(code.indexOf(searchTerm) !== -1) {
    code = code.replace(regex, (match, prefix, suffix) => {
      return `${prefix}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setActiveLoreItem("${item.id}")} className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Tìm hiểu thêm
                    </button>
                    ${suffix.trim()}
                  </div>`;
    });
  }
});

fs.writeFileSync('src/pages/StudentDashboard.tsx', code, 'utf8');
console.log('Update finished.');
