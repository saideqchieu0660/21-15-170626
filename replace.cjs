const fs = require('fs');
let content = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

// Replace card classes with glass
content = content.replace(/bg-stone-100\/80 dark:bg-zinc-950\/40 border border-amber-600\/20 dark:border-amber-500\/30 backdrop-blur-md shadow-xl text-zinc-900 dark:text-zinc-100/g, 'glass');

// Apply title colors
content = content.replace(/text-3xl font-display font-bold/g, 'text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');
content = content.replace(/text-4xl font-display font-bold/g, 'text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');
content = content.replace(/text-2xl font-display font-bold/g, 'text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500');

// Apply glow effect to buttons
// Just replacing some button classes
content = content.replace(/className=\"bg-yellow-500 hover:bg-yellow-600 text-black hover:scale-105\"/g, 'className="relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg hover:scale-[1.02] transition-all duration-500 font-bold before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700"');

content = content.replace(/bg-yellow-500 hover:bg-yellow-600 text-black hover:scale-105/g, 'relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg hover:scale-[1.02] transition-all duration-500 font-bold before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700');

fs.writeFileSync('src/pages/StudentDashboard.tsx', content);
console.log('Done replacement');
