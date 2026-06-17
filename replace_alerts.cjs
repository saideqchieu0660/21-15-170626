const fs = require('fs');
const files = [
  'src/pages/StudentDashboard.tsx',
  'src/pages/AdminKeysDashboard.tsx',
  'src/pages/AdminCreateCards.tsx',
  'src/pages/StudyRoom.tsx',
  'src/pages/TeacherDashboard.tsx',
  'src/App.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add import { toast } from 'sonner'; if not present
    if (!content.includes("import { toast } from 'sonner';") && !content.includes('import { toast } from "sonner";')) {
      content = 'import { toast } from "sonner";\n' + content;
    }
    
    content = content.replace(/alert\(/g, "toast(");
    fs.writeFileSync(file, content);
  }
}
