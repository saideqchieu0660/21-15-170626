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

// ExportStudyReport.tsx
replaceInFile('src/components/ExportStudyReport.tsx', [
    ['Mày có thể chọn', 'Ngài có thể chọn']
]);

// Agent3Widget.tsx
replaceInFile('src/components/Agent3Widget.tsx', [
    ['Tao sẽ gặng hỏi', 'Tôi sẽ sử dụng phương pháp triết học'],
    ['Mày chưa có', 'Ngài chưa có'],
    ['Mày chưa chọn', 'Ngài chưa chọn']
]);

// ShortcutsHelpModal.tsx
replaceInFile('src/components/ShortcutsHelpModal.tsx', [
    ['Tao đã', 'Hệ thống đã']
]);

// DocumentConverter.tsx
replaceInFile('src/components/DocumentConverter.tsx', [
    ['Mày là AI', 'Ngươi là AI'] // Instructions for the AI, so "Ngươi"
]);

// AdminKeysDashboard.tsx
replaceInFile('src/pages/AdminKeysDashboard.tsx', [
    ['Mày không', 'Ngài không']
]);

// StudentDashboard.tsx
replaceInFile('src/pages/StudentDashboard.tsx', [
    ['Mày vừa mở khóa', 'Ngài vừa mở khóa']
]);

// TeacherDashboard.tsx
replaceInFile('src/pages/TeacherDashboard.tsx', [
    ['Chính Mày', 'Bản Thân']
]);
