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
    ['của mày để', 'của ngài để'],
    ['của mày cực kỳ tuyệt vời', 'của ngài cực kỳ tuyệt vời']
]);

// ShortcutsHelpModal.tsx
replaceInFile('src/components/ShortcutsHelpModal.tsx', [
    ['của mày', 'của ngài'],
    ['mày thấy', 'ngài thấy'],
    ['mày muốn xem', 'ngài muốn xem'],
    ['mày kéo thanh trượt', 'ngài kéo thanh trượt'],
    ['khi mày ôn luyện', 'khi ngài ôn luyện'],
    ['mày đều được cộng', 'ngài đều được cộng'],
    ['Mày không phải học', 'Ngài không phải học'],
    ['mày đang sở hữu', 'ngài đang sở hữu'],
    ['mày qua số liệu thực', 'ngài qua số liệu thực'],
    ['mày đang thống trị', 'ngài đang thống trị'],
    ['Khi mày nộp văn bản', 'Khi ngài nộp văn bản'],
    ['gián đoạn cho mày', 'gián đoạn cho ngài'],
    ['Chất lượng trí tuệ của ngài', 'Chất lượng trí tuệ của ngài'],
    ['sự tập trung của ngài', 'sự tập trung của ngài'] // We just replaced 'của mày' with 'của ngài', so handled.
]);

// DocumentConverter.tsx
replaceInFile('src/components/DocumentConverter.tsx', [
    ['kiểm tra kết nối mạng của mày', 'kiểm tra kết nối mạng của ngài'],
    ['do mày vừa nhập', 'do ngài vừa nhập']
]);
