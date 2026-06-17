const fs = require('fs');

const file = 'src/pages/StudentDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldClass = 'bg-stone-100/80 dark:bg-zinc-950/40 border border-amber-600/20 dark:border-amber-500/30 backdrop-blur-md shadow-xl text-zinc-900 dark:text-zinc-100';

const newClass = 'bg-black/[0.02] dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] dark:border-amber-500/30 border-amber-600/20 shadow-[0_8px_32px_0_rgba(215,180,120,0.15)] dark:shadow-[inset_0_1px_1px_rgba(245,158,11,0.1),0_8px_32px_0_rgba(0,0,0,0.7)] text-stone-800 dark:text-stone-200 transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(245,158,11,0.15)]';

code = code.split(oldClass).join(newClass);

// Headings
const baseHeading = 'font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500';

code = code.replace(/text-4xl font-display font-bold/g, `text-4xl ${baseHeading}`);
code = code.replace(/text-3xl font-display font-bold/g, `text-3xl ${baseHeading}`);
code = code.replace(/text-2xl font-display font-bold/g, `text-2xl ${baseHeading}`);
code = code.replace(/text-xl font-display font-bold/g, `text-xl ${baseHeading}`);

fs.writeFileSync(file, code);

// App.tsx header
const appFile = 'src/App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

appCode = appCode.replace(
  'bg-stone-100/80 dark:bg-zinc-950/40 border-b border-amber-600/20 dark:border-amber-500/30 backdrop-blur-md shadow-xl text-zinc-900 dark:text-zinc-100',
  'bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/[0.05] dark:border-white/[0.08] dark:border-amber-500/30 border-amber-600/20 backdrop-blur-md shadow-[0_8px_32px_0_rgba(215,180,120,0.15)] dark:shadow-[inset_0_1px_1px_rgba(245,158,11,0.1),0_8px_32px_0_rgba(0,0,0,0.7)] text-stone-800 dark:text-stone-200 transition-all duration-500 ease-out'
);

fs.writeFileSync(appFile, appCode);

console.log('Successfully completed Rewrite');
