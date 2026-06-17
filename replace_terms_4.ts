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

// StudentBadges.tsx
replaceInFile('src/components/StudentBadges.tsx', [
    ['Linh Thạch', 'Tinh Hoa'],
    ['Tu vi', 'Trí tuệ'],
    ['Tu luyện', 'Nỗ lực'],
    ['Kim quang vạn trượng', 'Hào quang bừng sáng']
]);

// TeacherDashboard.tsx
replaceInFile('src/pages/TeacherDashboard.tsx', [
    ['Thiền Viện Ban Phát Tu Vi & Linh Thạch', 'Viện Nguyên Lão - Bàn Giao Cấp Độ & Tinh Hoa'],
    ['Linh Thạch', 'Tinh Hoa'],
    ['tu vi', 'cấp độ'],
    ['Thiền Viện', 'Viện Nguyên Lão'],
    ['Đã thi triển đại pháp thành công!', 'Thành công!'],
    ['Ban phát thành công', 'Đã ban tặng']
]);
