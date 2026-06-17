const fs = require('fs');
const file = 'src/pages/StudentDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const baseBtn = 'bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition transform hover:scale-105 shrink-0 w-full md:w-auto';
const glowBtn = 'relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 shrink-0 w-full md:w-auto before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700';

code = code.replace(baseBtn, glowBtn);

const btn2 = 'bg-yellow-500 text-black w-full py-3 rounded-xl text-lg font-bold hover:bg-yellow-600 hover:shadow-yellow-500/40 shadow-lg transition transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none';
const glowBtn2 = 'relative overflow-hidden group bg-yellow-500 text-black w-full py-3 rounded-xl text-lg font-bold hover:bg-yellow-600 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700';

code = code.replace(btn2, glowBtn2);

fs.writeFileSync(file, code);

console.log('Button glows added');
