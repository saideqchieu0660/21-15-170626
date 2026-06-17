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

// Agent3Widget.tsx
replaceInFile('src/components/Agent3Widget.tsx', [
    ['mày đây', 'ngài đây'],
    ['mày', 'ngài'],
    ['của ngài đây', 'của ngài'],
    ['tao là Agent 3', 'Tôi là Học giả AI trí tuệ'],
    ['Tao là Agent 3', 'Tôi là Học giả AI trí tuệ'],
    ['Bắn câu hỏi đi, tao trả lời thẳng tuột rôm rốp, ko bao giờ hỏi ngược hay gợi mở dông dài!', 'Mời ngài đặt câu hỏi. Tôi sẽ cung cấp câu trả lời trực tiếp và cặn kẽ!'],
    ['để tao băm mindmap ngay! Đóng điện ra lệnh đi m!', 'tôi sẽ phác họa sơ đồ tư duy ngay lập tức. Mời ngài ra lệnh!'],
    ['để tao băm', 'tôi sẽ phác họa'],
    ['tao băm phát một ra sơ đồ liền', 'tôi sẽ phác họa sơ đồ ra ngay'],
    ['Đóng điện ra lệnh đi m!', 'Mời ngài đưa ra chỉ thị!'],
    ['tiếng ngài-tao cực bựa', 'thông điệp trang trọng'],
    ['Từ giờ tao sẽ trả lời thẳng tuột', 'Từ giờ tôi sẽ trả lời trực tiếp'],
    ['bằng xưng xô ngài/tao', 'với sự tôn trọng'],
    ['Bộ học mới của tao', 'Bộ học mới'],
    ['chuẩn xưng hô \'ngài/tao\'', 'giọng điệu hoàng gia']
]);

// ShortcutsHelpModal.tsx
replaceInFile('src/components/ShortcutsHelpModal.tsx', [
    ['Ngài thấy hiệu ứng', 'Ngài có thấy hiệu ứng'],
    ['của ngài', 'của ngài'],
    ['đang quá tải hiệu ứng đồ họa cao cấp của tao đấy!', 'đang gánh chịu cấu hình đồ họa cao cấp của hệ thống không?'],
    ['Mày thấy hiệu ứng', 'Ngài có thấy hiệu ứng'],
    ['của tao đấy', 'của hệ thống đấy']
]);

// StudentDashboard.tsx
replaceInFile('src/pages/StudentDashboard.tsx', [
    ['tao sẽ trừ', 'hệ thống sẽ thu lại']
]);

// App.tsx
replaceInFile('src/App.tsx', [
    ['Mày cần cấp quyền', 'Ngài cần cấp quyền'],
    ['tao mới nhắc', 'hệ thống mới nhắc'],
    ['Mày vừa chỉnh', 'Ngài vừa điều chỉnh'],
    ['khiến tao quét ra', 'khiến hệ thống phát hiện ra'],
    ['cho ngài học bài', 'cho ngài học tập'],
    ['nha ngài', 'thưa ngài'],
    ['ngài ơi', 'thưa ngài']
]);
