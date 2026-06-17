const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/pages/Login.tsx',
  'src/pages/TeacherDashboard.tsx',
  'src/pages/StudyRoom.tsx',
  'src/components/Agent3Widget.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace card classes
  content = content.replace(/bg-stone-100\/80 dark:bg-zinc-950\/40 border border-amber-600\/20 dark:border-amber-500\/30 backdrop-blur-md shadow-xl text-zinc-900 dark:text-zinc-100/g, 'glass');

  // Title styles
  content = content.replace(/text-4xl font-display font-bold/g, 'text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');
  content = content.replace(/text-3xl font-display font-bold/g, 'text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');
  content = content.replace(/text-2xl font-display font-bold/g, 'text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');

  // Buttons
  content = content.replace(/className=\"bg-yellow-500 hover:bg-yellow-600/g, 'className="relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 shadow-[0_4px_12px_rgba(245,158,11,0.5)] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 ');

  fs.writeFileSync(file, content);
}
console.log('Update complete across files');
