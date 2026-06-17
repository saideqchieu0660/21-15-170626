const fs = require('fs');
const file = 'src/pages/StudentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The replacement logic:
content = content.replace(/amber-/g, 'orange-');
content = content.replace(/yellow-/g, 'orange-');

fs.writeFileSync(file, content);

const file2 = 'src/App.tsx';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(/amber-/g, 'orange-');
content2 = content2.replace(/yellow-/g, 'orange-');
fs.writeFileSync(file2, content2);

console.log('Replacement complete');
