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
    ['tao mới được', 'tôi mới được'],
    ['mày v', 'ngài v']
]);

// ShortcutsHelpModal.tsx
replaceInFile('src/components/ShortcutsHelpModal.tsx', [
    ['cho mày một', 'cho ngài một'],
    ['riêng mày', 'riêng ngài']
]);

// StudentBadges.tsx
replaceInFile('src/components/StudentBadges.tsx', [
    ['Tối Thượng Chí Tôn', 'Triết Gia Tối Thượng'],
    ['Chí Tôn Vô Cực', 'Ánh Sáng Khai Minh'],
    ['Chí Tôn Vô Biên', 'Trí Tuệ Vô Biên']
]);

// xp.ts
replaceInFile('src/utils/xp.ts', [
    ['Chí Tôn Kiếm Ma', 'Quân Vương Triết Học']
]);

