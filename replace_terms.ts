import fs from 'fs';

function replaceInFile(filePath: string, replacements: [string, string][]) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [search, replace] of replacements) {
        content = content.replace(new RegExp(search, 'g'), replace);
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

// StudentDashboard.tsx
replaceInFile('src/pages/StudentDashboard.tsx', [
    ['Trình duyệt của mày không hỗ trợ', 'Trình duyệt của ngài không hỗ trợ'],
    ['Mày cần bật quyền thông báo', 'Ngài cần bật quyền thông báo'],
    ['thì tao mới gửi nhắc nhở được', 'thì hệ thống mới gửi nhắc nhở được'],
    ['Học bài giữ streak nhé mày!', 'Hãy giữ vững ngọn lửa tri thức nhé!'],
    ['Ví điểm của mày:', 'Túi Tinh Hoa:'],
    ['Truyền công thành công! Thiên Băng Thần Giáp đã được pháp lực của mày kích hoạt bảo vệ 1 ngày!', 'Thành công! Quyền Trượng Khắc Kỷ đã được kích hoạt, bảo vệ chuỗi ngày học của ngài!'],
    ['Đạo tâm của mày đã mang sẵn lòng nhiệt huyết', 'Tâm trí của ngài đã mang sẵn ngọn lửa nhiệt huyết'],
    ['Thiếu hụt Linh thạch rồi mày hỡi!', 'Ngài chưa đủ Tinh Hoa (Aether)!'],
    ['Xích Tâm Ấn của mày', 'Khí chất của ngài'],
    ['Thiếu Tinh Hoa \\(Aether\\) mất rồi mày ơi. Chăm chỉ học thêm đi!', 'Nguồn Tinh Hoa chưa đủ. Hãy tiếp tục trau dồi tri thức nhé!'],
    ['Cố lên mày! Tao đang theo dõi streak của mày.', 'Thần linh đang dõi theo hành trình chinh phục đỉnh cao của ngài.'],
    ['khẳng định tri thức tuyệt đỉnh của mày!', 'khẳng định tri thức tuyệt đỉnh của ngài!'],
    ['Tri thức của mày đã đạt', 'Tri thức của ngài đã đạt'],
    ['mày muốn xem nhiều thông tin hơn', 'ngài muốn xem nhiều thông tin hơn'],
    ['tài khoản hiện tại của mày', 'tài khoản hiện tại của ngài']
]);

// DocumentConverter.tsx
replaceInFile('src/components/DocumentConverter.tsx', [
    ['mày có thể bóc tách', 'ngài có thể bóc tách'],
    ['định tuyến mày sang Gemini Web', 'định tuyến ngài sang Gemini Web'],
]);

// InteractiveTutorial.tsx
replaceInFile('src/components/InteractiveTutorial.tsx', [
    ['Mày không phải học tập', 'Ngài không phải học tập'],
    ['phần trắc nghiệm mày cày bừa', 'phần trắc nghiệm ngài rèn luyện'],
    ['chiến tích của mày so với', 'chiến tích của ngài so với'],
    ['lo mà cày đi m nha!', 'hãy cống hiến hết mình nhé!'],
    ['cho phép mày phác họa', 'cho phép ngài phác họa'],
    ['Mày được quyền', 'Ngài được quyền'],
    ['của mày để', 'của ngài để'],
    ['của mày: Hệ thống', 'của ngài: Hệ thống'],
    ['Mày muốn lưu trữ?', 'Ngài muốn lưu trữ?'],
    ['Stoic của mày', 'Khắc Kỷ của ngài'],
    ['mày qua hệ thống', 'ngài qua hệ thống'],
    ['câu hỏi mày đã', 'câu hỏi ngài đã'],
    ['để mày dễ dàng', 'để ngài dễ dàng']
]);

// StudyRoom.tsx
replaceInFile('src/pages/StudyRoom.tsx', [
    ['từ khóa của mày', 'từ khóa của ngài']
]);

// SetupProfileScreen.tsx
replaceInFile('src/pages/SetupProfileScreen.tsx', [
    ['database của mày', 'dữ liệu của ngài']
]);

// TeacherDashboard.tsx
replaceInFile('src/pages/TeacherDashboard.tsx', [
    ['Thượng nhân Admin ơi! Tại đây mày có thể trực tiếp truyền thụ thần thông: tăng giảm <strong>Tu Vi \\(Level/Cảnh Giới\\)</strong> và <strong>Linh Thạch \\(PT/Points\\)</strong> cho chính mày hoặc tùy chọn bất cứ thành viên nào trong danh sách. Hệ thống sẽ tự động cập nhật đồng bộ tức thời lên Tiên Giới \\(Firestore\\)!', 'Kính chào Admin! Tại đây ngài có thể điều chỉnh <strong>Cấp độ (Level)</strong> và <strong>Tinh Hoa (Points)</strong> cho chính mình hoặc những triết gia khác trong danh sách. Hệ thống sẽ lưu lại thần tích này!']
]);

// App.tsx
replaceInFile('src/App.tsx', [
    ['Trình duyệt của mày không hỗ trợ', 'Trình duyệt của ngài không hỗ trợ'],
    ['Học bài giữ streak nhé mày', 'Hãy nỗ lực giữ streak nhé'],
    ['Ê mày ơi! Hôm nay chưa làm flashcard ôn tập nào đâu đấy. Vào học giữ streak ngay đi nào', 'Ngài ơi, hôm nay ngài chưa ôn luyện flashcard nào. Hãy thắp lại ngọn lửa tri thức ngay!'],
    ['thành công \\$\\{fixedCount\\} thành phần chữ bị mờ rồi đó nha mày!', 'thành công ${fixedCount} thành phần bị mờ.'],
    ['Ngon rồi, không tìm thấy thành phần nào bị mờ cần sửa nữa đâu mày ơi!', 'Khá khen, không tìm thấy thành phần nào bị mờ cần sửa nữa!'],
    ['thử lại xem sao mày.', 'vui lòng thử lại.'],
    ['Tao quét toàn bộ màn hình thấy chữ hiển thị cực kỳ ngon nghẻ, đủ tương phản cho mày học bài thoải mái nha!', 'Hệ thống đã quét toàn bộ và tất cả văn bản đều đủ độ tương phản cho hành trình học thuật của ngài!'],
    ['Nếu mày bị lệch tiến trình', 'Nếu ngài bị lệch tiến trình']
]);
