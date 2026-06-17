const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/gemini-2\.5-flash/g, 'gemini-1.5-flash');
fs.writeFileSync('server.ts', code);
console.log('Replaced all gemini-2.5-flash with gemini-1.5-flash');
