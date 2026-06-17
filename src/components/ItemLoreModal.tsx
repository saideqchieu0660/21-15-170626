import React from 'react';
import { X, BookOpen, Sparkles, Diamond, Target } from "lucide-react";

export interface ItemLore {
  id: string;
  name: string;
  mythology: string;
  lore: string;
  uiDescription: string;
  appFunction: string;
}

export const ITEM_LORES: Record<string, ItemLore> = {
  "aegis_shield": {
    id: "aegis_shield",
    name: "Tấm Khiên Của Aegis (Aegis Shield)",
    mythology: "Thần thoại Hy Lạp (Khiên của Athena/Zeus)",
    lore: "Rèn bởi Hephaestus từ da của ác thú dũng mãnh, tấm khiên Aegis từng chặn đứng mọi mũi giáo tàn độc nhất trên chiến trường rực lửa. Mang trên mình ánh nhìn hóa đá của Gorgon Medusa, nó là biểu tượng tuyệt đối của sự bảo hộ không thể xuyên thủng. Kẻ nào sở hữu Aegis sẽ không bao giờ gục ngã trước những giông bão của thời gian, giữ vững ý chí dù đất trời sụp đổ.",
    uiDescription: "Bất khả chiến bại trước thời gian và nghịch cảnh. Sự vấp ngã hôm nay sẽ được che chở.",
    appFunction: "Đóng băng chuỗi ngày học tập (Streak Freeze). Bảo vệ chuỗi Streak hiện tại không bị mất đi nếu ngày hôm đó bạn vô tình chưa hoàn thành mục tiêu."
  },
  "ambrosia_nectar": {
    id: "ambrosia_nectar",
    name: "Mật Hoa Ambrosia (Ambrosia Nectar)",
    mythology: "Thần thoại Hy Lạp (Thức ăn của các vị thần)",
    lore: "Ambrosia là dòng mật hoa huyền bí chảy trên đỉnh Olympus, thứ tinh tuý độc quyền mang lại sự trường sinh và sức mạnh vô song cho những đấng tối cao. Chỉ một giọt chạm môi cũng đủ để gột rửa mọi sự mỏi mệt của một kẻ phàm trần, tái tạo sinh lực nhanh chóng. Đây là ân sủng hiếm hoi mà chư thần ban phát cho những học giả kiệt xuất để tiếp thêm sức mạnh trên con đường giác ngộ.",
    uiDescription: "Hương vị của Olympus rực cháy trong huyết quản, lập tức hồi sinh năng lượng tri thức.",
    appFunction: "Nước thần hồi phục tức thì, cấp ngay lập tức +50 Điểm Kinh Nghiệm (XP) vào tài khoản để vươn lên cấp độ mới."
  },
  "athenas_salvation": {
    id: "athenas_salvation",
    name: "Sự Cứu Rỗi Của Athena (Athena's Salvation)",
    mythology: "Thần thoại Hy Lạp (Nữ thần Trí tuệ và Chiến tranh chính nghĩa)",
    lore: "Khi đấu trường chìm trong màn đêm tuyệt vọng, ánh sáng từ ngọn giáo của nữ thần Athena đã xé toạc bóng tối để mở ra một con đường luân hồi mới. Tri thức của nàng vượt lên trên giang sơn trần thế, có khả năng bẻ cong lề lối của vạn vật để đưa những tâm hồn quả cảm vượt qua thử thách tàn khốc. Đây là đặc quyền tối thượng dành cho kẻ tìm kiếm lối thoát quang minh giữa những bài kiểm tra rực lửa.",
    uiDescription: "Ánh sáng chiến lược vạch ranh giới sự sống. Bỏ qua ải thử thách mà không lưu lại dấu vết.",
    appFunction: "Vượt qua ngay lập tức 1 cấp độ (Skip 1 Level) hoặc dùng để tự động hoàn thành xuất sắc một bài Mock Exam khó khăn mà không cần tính toán sai lầm."
  },
  "olympus_aura": {
    id: "olympus_aura",
    name: "Hào Quang Olympus (Olympus Aura)",
    mythology: "Thần thoại Hy Lạp (Ngọn núi thiêng của chư thần)",
    lore: "Trên đỉnh núi thiêng sương mù bao phủ, nơi giao phân của quyền lực và trật tự vĩnh hằng, một luồng ánh sáng chói lọi luôn bao quanh những vị thần đứng đầu. Hào quang này không chỉ chiếu rọi cõi thế mà còn là minh chứng cho sự thống trị trí tuệ tuyệt đỉnh. Những người khoác lên mình ánh sáng này được công nhận là một bậc quân vương cao ngạo giữa hàng nghìn tinh tú.",
    uiDescription: "Cốt cách thần thánh được định hình qua sắc kim cương. Bạn giờ đây thuộc về đỉnh cao.",
    appFunction: "Cung cấp vật phẩm trang trí quý giá: Viền Avatar Kim Cương (Diamond Profile Frame), một biểu tượng quyền lực rực sáng trên các bảng xếp hạng."
  },
  "polymath_title": {
    id: "polymath_title",
    name: "Phong Hiệu 'Học Giả Bách Khoa' (Polymath Title)",
    mythology: "Phong trào Phục Hưng / Hy Lạp cổ đại (Những vĩ nhân tinh thông vạn vật)",
    lore: "Trong thư viện vĩ đại đang chìm trong biển lửa chiến tranh, bí mật của vũ trụ vẫn được lưu giữ bởi các Học Giả Bách Khoa – những kẻ tinh thông vạn vật từ triết lý tinh tú đến toán học không gian. Danh xưng này là sự công nhận khắc nghiệt của các hiền triết cổ đại dành cho một trí tuệ vượt ra ngoài quỹ đạo trần tục. Nó là một chiếc huy chương vô hình tạc sâu vào linh hồn kiệt xuất của người sở hữu.",
    uiDescription: "Danh xưng huyền thoại của những vĩ nhân thông tuệ. Tri thức của bạn không có giới hạn.",
    appFunction: "Thay đổi huy hiệu chức danh vĩnh viễn (Profile Title Badge) trên trang cá nhân hiển thị công khai thành tước vị 'Học Giả Bách Khoa'."
  },
  "lionheart_icon": {
    id: "lionheart_icon",
    name: "Trái Tim Sư Tử (Lionheart Lion Icon)",
    mythology: "Thần thoại Hy Lạp (Sư tử Nemea / Điển tích anh hùng Hercules)",
    lore: "Sư tử thiêng Nemea mang trong mình vóc dáng khổng lồ và bộ da hoàng kim không thể xuyên thủng bằng bất kỳ binh khí phàm trần nào. Khi huyền thoại Hercules tay không siết chết ác thú, trái tim của nó hóa thành ngọn lửa bùng cháy vĩnh cửu bất diệt. Trang bị biểu tượng này là minh chứng rằng trong lồng ngực bạn đang đập một nhịp đập hung bạo, sẵn sàng xé nát mọi rào cản cản đường.",
    uiDescription: "Ngọn lửa dũng mãnh cháy rực từ ác thú Nemea. Ánh nhìn của bạn thiêu rụi mọi rào cản.",
    appFunction: "Vật trang sức mỹ học cao cấp cung cấp hiệu ứng động (Active Heat Animation) liên tục chớp nhoáng trên ảnh đại diện cá nhân."
  },
  "pandoras_box": {
    id: "pandoras_box",
    name: "Chiếc Hộp Pandora (Pandora's Box)",
    mythology: "Thần thoại Hy Lạp (Nguồn gốc của hi vọng và tai ương nhân loại)",
    lore: "Được ban tặng bởi Zeus như một món quà bí hiểm hắc ám, chiếc hộp khóa kín này giam giữ trong đó tận cùng của những hỗn mang, sự cám dỗ chết người và cả niềm hy vọng mỏng manh. Phá vỡ lớp phong ấn uẩn khúc là đang ngông cuồng đánh cược với số phận vũ trụ. Đó có thể là sự lụi tàn kéo tụt trí lực không tì vết, hoặc là kho báu quyền linh vĩ đại mà thần linh đã điên rồ cất giấu.",
    uiDescription: "Bên trong là vũng lầy lụi tàn hay kỳ tích chư thần? Số mệnh của bạn thuộc về cú gỡ phong ấn này.",
    appFunction: "Hệ thống Gacha/Lootbox ngẫu nhiên. Người chơi đem điểm Tinh Hoa ra đặt cược để mở và quay thưởng nhận các phần quà cực hiếm hoặc có rủi ro bị trừ sạch điểm tích lũy."
  },
  "level_sacrifice": {
    id: "level_sacrifice",
    name: "Hiến Tế Cấp Độ (Level Sacrifice)",
    mythology: "Nghi thức Vạn Thần (Sự hoán đổi của các nghi lễ tế thần viễn cổ)",
    lore: "Các vị thần tàn bạo trên đỉnh cao nguyên luôn đòi hỏi một cái giá tương xứng cho trọn vẹn những ma lực vượt tầm cõi thế. Hiến tế là nghi thức cổ xưa đẫm máu tước đi một phần công năng sinh lực mà người chiến binh đã rèn giũa để hoán đổi lấy vật chất nguyên thủy cội nguồn. Sự tự nguyện hạ bệ một phần đẳng cấp là con đường đầy đau đớn nhưng giàu có nhất để đoạt lấy quyền lực từ tay Thần chết.",
    uiDescription: "Một phần quyển năng cũ bóc tách rớt rụng thành tinh linh thần bí. Trả giá để thu về lợi ích.",
    appFunction: "Cho phép người dùng tước bỏ / giảm đi 1 Cấp Độ hồ sơ hiện tại để hoán đổi lấy 1000 Tinh Hoa (Đơn vị nội tệ) ngay lập tức."
  },
  "prometheus_fire": {
    id: "prometheus_fire",
    name: "Ngọn Lửa Prometheus (Prometheus Fire)",
    mythology: "Thần thoại Hy Lạp (Titan Prometheus đánh cắp ngọn lửa văn minh)",
    lore: "Khi màn đêm tăm tối hoang dại vùi lấp nhân loại, Titan Prometheus đã cả gan đánh cắp ngọn lửa thiêng của thần tối cao, chuốc lấy bản án đày đọa muôn đời bên bờ vực thẳm hoang vu. Nhưng chính ngọn lửa ấy đã khai sáng văn minh vũ trụ, bùng lên chuỗi nhận thức vô hạn không bao giờ tắt ở loài người. Ngọn lửa này khơi mào cội nguồn cho một hành trình bứt tốc thần thánh.",
    uiDescription: "Ngọn lửa tri thức đánh cắp từ sự phẫn nộ của thần linh. Sự khai sáng bất diệt thúc đẩy bạn tiến lên.",
    appFunction: "Vật phẩm thúc đẩy thời gian thực (Long-term multiplier): Tự động mở ngay rào cản 10 cấp độ đầu tiên bằng chỉ số kinh nghiệm khổng lồ."
  },
  "philosopher_king_crown": {
    id: "philosopher_king_crown",
    name: "Vương Miện 'Quân Vương Triết Học' (Philosopher King Crown)",
    mythology: "Triết học vĩ đại Plato (Cộng hòa – Biểu tượng vương giả lý tưởng)",
    lore: "Không được đúc từ những kim loại vàng ròng hay nạm kim cương lòe loẹt, vương miện vô hình tuyệt mỹ này được rèn từ chính hệ thống chân lý trần trụi và luân thường đạo lý thống trị các vì sao. Quân Vương Triết Học không cần dùng gươm đao khát máu để tàn sát tới ngai vàng, mà lấy cái uy quyền tuyệt đối của dòng chảy vũ trụ để cai trị kỷ nguyên loạn thế. Đây là quyền lực định đoạt tư duy của bậc chí thánh.",
    uiDescription: "Ngai vàng huy hoàng của sự uyên bác. Quyền uy sinh ra từ trí não thay vì khiên kiếm.",
    appFunction: "Huy hiệu quyền lực cực đoan. Sẽ gắn một hiệu ứng huy hiệu Vương miện đắt giá nhất lên Avatar của người dùng, xác nhận VIP tuyệt đỉnh."
  },
  "united_engine_core": {
    id: "united_engine_core",
    name: "Lõi Năng Lượng United Engine (United Engine Core)",
    mythology: "Viễn tưởng vũ trụ / Cyberpunk (Hạt nhân bất diệt / Năng lượng lõi nguyên tử)",
    lore: "Nguồn năng lượng rực lửa đậm đặc này chứa đựng dòng chảy tuần hoàn bất diệt của những thực thể máy học siêu việt, phát quang bởi lớp lớp thuật tuấn lượng tử không thể cạn kiệt. Lõi sức mạnh United sinh ra từ việc hội tụ ma thuật phân rã của các chiều không gian, chém đứt mọi vòng trói buộc cấu trúc thông tin thế gian. Kích hoạt hạt lõi là lúc bạn mượn tay quyền lực siêu nhiên để bọc lấp vạn vật vào sự vĩnh cửu.",
    uiDescription: "Hạt nhân bẻ gãy không gian. Giới hạn truy xuất nào cũng bị đâm thủng dưới siêu bộ máy lượng tử.",
    appFunction: "Cộng ngay lập tức +1 Token vào số lượt sử dụng lõi tính toán nâng cao của United Engine, tha hồ dùng AI với tài liệu quá tải."
  },
  "intellect_elixir": {
    id: "intellect_elixir",
    name: "Nước Tăng Lực Trí Thức (Intellect Elixir)",
    mythology: "Thuật Giả Kim Cổ Đại (Chất xúc tác giả kim hoàn thiện não bộ)",
    lore: "Được chiết xuất thầm lặng qua đôi tay của những pháp sư giả kim ngàn năm tại tàn tích Babylon, lọ dung dịch ma mị này hòa tan cả cánh hoa sao chổi lấp lánh và mạch hắc thần dược trí tuệ thời nguyên thuỷ. Chảy luồn lách theo mạch máu rực lửa, thứ nước này ép bức tế bào nơ-ron đẩy tốc độ luân kim tới ngưỡng bốc hơi sương mù sinh học. Vạn vật mập mờ u tối phút chốc trở nên trần lụi minh bạch.",
    uiDescription: "Dung dịch tịnh hóa đẩy cực năng luân xa. Từng đơn vị tri thức nhân lên như sóng thần càn quét.",
    appFunction: "Boost nhân x2 toàn bộ Lượng Kinh nghiệm (XP) kiếm được trong khoảng thời gian hiệu lực kéo dài chính xác 15 phút đồng hồ."
  },
  "anonymous_mask": {
    id: "anonymous_mask",
    name: "Mặt Nạ Ẩn Danh (Anonymous Mask)",
    mythology: "Thần thoại Hy Lạp (Mũ tàng hình của Chúa tể Minh giới Hades)",
    lore: "Đập bằng nhát búa của rèn ngục u tối Tartarus, lấy chất liệu từ lớp bóng tối u uất lạnh thấu xương của cõi vong linh, chiếc mặt nạ dải lụa hắc ám ẩn giấu lời nguyền của chúa tể Hades. Kẻ đeo lên tấm vỏ bọc này sẽ tước đi sinh khí phản nguyên trần gian, vô thanh vô tĩnh trôi dạt giữa ma giới mà không để lại dao động. Sự cô lập này giúp bậc đế vương ung dung mưu đồ bá nghiệp giữa vạn thế mà không sợ chùm soi mói dư luận.",
    uiDescription: "Hòa rã cốt nhục vào hư không của Tartarus. Giấu đi tung tích và chờ thời cơ quật ngã thiên hạ.",
    appFunction: "Đánh dấu ẩn danh toàn bộ hệ thống lưu trữ cá nhân (Hide rank leaderboard placement) hoàn toàn khỏi khu vực so tài trong đủ trọn 24 giờ hành chính."
  },
  "almighty_scepter": {
    id: "almighty_scepter",
    name: "Quyền Trượng Đấng Toàn Năng (Almighty Scepter)",
    mythology: "Thần thoại Bắc Âu / Hy Lạp (Quyền trượng phán xét / Sấm sét của Zeus/Odin)",
    lore: "Giương cao vật thể này chính là đang dõng dạc tuyên xưng chủ quyền trước quy luật thiên định của mọi kỷ nguyên. Đây là bảo khí khải huyền của một nền văn minh đã vụn vỡ từ rạn nứt cấu tạo vạn vật ban đầu, từng thẳng tay chém đứt lưỡi hái bóng tối và ép giun dế hỗn mang phủ phục. Người duyên nợ cầm giữ cây trường trượng này đã đường hoàng trở thành hóa thân của chân lý độc thần vô địch chốn hạ giới.",
    uiDescription: "Tạc khắc quyền năng sinh sát ngự trị ngàn dặm thiên hà. Dưới bóng của ngài, mọi thứ là lề luật.",
    appFunction: "Sở hữu đặc quyền độc bản không tưởng, mở khoá ẩn Admin Roles / Easter-Egg quyền hạn hệ thống cao tột bậc; là mặt hàng siêu cao cấp cho giới tài phiệt trong trò chơi."
  },
  "ariadnes_thread": {
    id: "ariadnes_thread",
    name: "Sợi Chỉ Của Ariadne (Ariadne's Golden Thread)",
    mythology: "Thần thoại Hy Lạp (Lối thoát huy hoàng khỏi Mê Cung Minotaur của Theseus)",
    lore: "Chôn vùi sâu dưới tầng hầm rỉ máu ngạt thở Mê Cung Crete, bóng ma ác thú Minotaur đã cướp đi sinh khí của không biết bao nhiêu vị anh hùng, trước khi Theseus bấu víu vào cuộn hỏa chỉ rực sáng của vương nữ Ariadne. Sợi chỉ mảnh như tơ nhện nhưng cứng cỏi như sinh lực trần tục, là vệt sáng dò tìm ngược dòng dòng thời gian về cánh cổng khởi nguyên. Nó châm ngòi hy vọng lội ngược những đổ vỡ đau thương, khôi phục lại chư khí ban đầu nguyên vẹn.",
    uiDescription: "Hư luân mê cung không bao giờ nuốt chửng một dũng sĩ có sợi dây chỉ đường chuộc lại lầm lỡ.",
    appFunction: "Tính năng thiết lập lại bộ khung (Reset exam): Toàn bộ thao tác sai lầm / điểm trừ trong kỳ thi Mock Exam vừa làm sẽ bị xóa, và bạn có quyền làm lại bài thi đó lại từ vạch xuất phát."
  },
  "achilles_heel": {
    id: "achilles_heel",
    name: "Gót Chân Achilles (Achilles' Heel)",
    mythology: "Thần thoại Hy Lạp (Chiến Thần bất khả chiến bại và tử huyệt mong manh)",
    lore: "Ngự trị trên đỉnh chiến trận khi tấm thân phàm tục được nhúng sục dưới dòng sông ma ám Styx cõi Cửu Tuyền, huyết lực của chiến thần Achilles cuồng bạo đánh bay mọi gươm chém đao găm. Sự bá đạo khát máu vinh quang luôn kèm theo vết tì vết của một lời nguyền tồi tệ đặt vào phần gót chân không được gột rửa. Một khi lưỡi lê xuyên thủng, đế chế uy nghiêm nhất cũng rũ xương trắng mục nát và chôn theo muôn vàn chiến công hiển hách tàn bạo trước đó.",
    uiDescription: "Giao kèo cực đoan với ranh giới cái chết. Thu hoạch nhân bốn, sụp đổ tức khắc nếu lơ là.",
    appFunction: "Cung cấp hệ số XP nhân x4 cực hạn xuyên suốt 24 giờ quá trình học. Bạn phải vượt qua bài kiểm tra 40 câu khốc liệt sinh tự động. Nếu trả lời sai một câu duy nhất, chuỗi Streak bị thiêu rụi ngay lập tức."
  },
  "odins_eye": {
    id: "odins_eye",
    name: "Con Mắt Của Odin (Odin's All-Seeing Eye)",
    mythology: "Thần thoại Bắc Âu (Odin hiến dâng con mắt thần cho giếng Mímir trí tuệ)",
    lore: "Thâm sâu tại nơi rễ cổ thụ thế giới Yggdrasil bấu lấy cội nguồn, đấng toàn thiện Odin vĩ đại chẳng chút nao lòng tự móc bỏ con mắt kiêu hãnh của trần thế để quẳng vào dòng suối thiêng Mímir. Tàn nhẫn và đau đớn kịch phát là cái giá sòng phẳng để thức tỉnh nhãn lực soi thấu tam giới hoang tàn, xuyên thấu vào tận màn sương che khuất hư vô. Vay mượn cặp mắt ác nghiệt này, người dùng mổ xẻ rạch ròi tận xương tủy từng học thuyết uyên bác nhất.",
    uiDescription: "Mượn nhãn thuật từ suối hồn Mímir. Con Mắt độc tôn cắn xé những góc tăm tối ẩn giấu.",
    appFunction: "Trong 24 giờ, hệ thống kích hoạt năng lực giảng dạy sâu rộng: Cung cấp bài giải AI chi tiết bằng phương pháp truy vấn Socratic ẩn, mổ xẻ mọi góc độ đáp án bài tập siêu chi tiết."
  }
};

export function ItemLoreModal({ itemKey, onClose }: { itemKey: string, onClose: () => void }) {
  const item = ITEM_LORES[itemKey];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-orange-500/20 max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-6 pr-8">
            <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black font-display text-zinc-900 dark:text-zinc-50 leading-tight">{item.name}</h2>
              <p className="text-xs uppercase font-bold tracking-wider text-orange-600 dark:text-orange-500 flex items-center gap-1.5 mt-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {item.mythology}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl italic text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed border-l-4 border-orange-500/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
              "{item.lore}"
            </div>

            <div>
               <h3 className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest mb-2 flex items-center gap-1.5">
                  <Diamond className="w-3.5 h-3.5 text-blue-500" /> Mô Tả Giao Diện
               </h3>
               <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm leading-relaxed">
                  {item.uiDescription}
               </p>
            </div>

            <div>
               <h3 className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-red-500" /> Tính Năng Thực Tế
               </h3>
               <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-orange-50 dark:bg-orange-950/20 p-3.5 rounded-xl border border-orange-500/20 shadow-inner leading-relaxed">
                  {item.appFunction}
               </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-white text-zinc-50 dark:text-zinc-900 text-sm font-bold rounded-xl transition-all shadow border border-transparent hover:border-orange-500/30 active:scale-95 cursor-pointer"
          >
            Đóng Biên Niên Sử
          </button>
        </div>
      </div>
    </div>
  );
}
