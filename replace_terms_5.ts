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
    ['Điểm Tu Vi & Tiên Ấn', 'Điểm Kinh Nghiệm & Huy hiệu'],
    ['Tu Vi Chân Nguyên', 'Điểm Kinh Nghiệm']
]);

// TeacherDashboard.tsx
replaceInFile('src/pages/TeacherDashboard.tsx', [
    ['Tu Vi (Level Cảnh Giới)', 'Cấp độ (Level)']
]);
