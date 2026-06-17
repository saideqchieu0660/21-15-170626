import fs from 'fs';

function replaceInFile(filePath: string, replacements: [string, string][]) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [search, replace] of replacements) {
        content = content.split(search).join(replace); // no regexp issues
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

replaceInFile('src/pages/TeacherDashboard.tsx', [
    ['Tu Vi (Level Cảnh Giới)', 'Cấp độ (Level)']
]);
// Let's also search for anything like "Cảnh Giới" everywhere.
