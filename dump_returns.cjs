const fs = require('fs');
const contents = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');
const lines = contents.split('\n');
for (let i = 199; i < 1200; i++) {
  if (lines[i].includes('return') && !lines[i].includes('() =>') && !lines[i].includes('=> return')) {
    console.log((i+1) + ": " + lines[i]);
  }
}
