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

replaceInFile('src/pages/StudentDashboard.tsx', [
    ['Mày đang sử dụng tài khoản tạm thời', 'Ngài đang sử dụng tài khoản tạm thời'],
    ['Lỗi khi cầu khấn tiên giới kết ấn', 'Lỗi khi giao tiếp với đền thờ Olympus'],
    ['Luyện Pháp Bảo', 'Nhận Hào Quang'],
    ['Đã Khắc Ấn', 'Đã Sở Hữu'],
    ['Nuốt Đan', 'Uống Mật Hoa'],
    ['Bản tôn đã max cấp vinh dự đỉnh khung diamond rồi \\(Level \\>\\= 10\\)!', 'Ngài đã đạt cấp độ tối thượng (Level >= 10)!'],
    ['Tiên ấn lấp lánh', 'Mở khóa hào quang']
]);

