const fs = require('fs');

const file = 'src/pages/StudentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The replacement logic:
content = content.replace(/amber-/g, 'orange-');
content = content.replace(/yellow-/g, 'orange-');
content = content.replace(/stone-/g, 'zinc-'); // The user asked for "Deep obsidian/stone grey backgrounds (bg-zinc-900 / bg-neutral-950), completely replacing pure blacks"

fs.writeFileSync(file, content);
console.log('Replacement complete');
