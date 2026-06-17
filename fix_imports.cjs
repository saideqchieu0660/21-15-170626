const fs = require('fs');

function addImport(filePath, toAdd) {
  let content = fs.readFileSync(filePath, 'utf8');
  toAdd.forEach(imp => {
    if (!content.includes(imp + ',') && !content.includes(', ' + imp) && !content.includes(imp + ' }')) {
       content = content.replace(/import React(?:, \{[^}]*\})?/, match => {
          if (match === 'import React') return 'import React, { ' + imp + ' }';
          return match.replace(/\}$/, ', ' + imp + ' }');
       });
    }
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

addImport('src/components/Agent3Widget.tsx', ['useMemo']);
addImport('src/components/ManualFlashcardImporter.tsx', ['useEffect', 'useMemo']);
addImport('src/components/SkillTreeGraph.tsx', ['useMemo']);
addImport('src/components/VerifyEmailScreen.tsx', ['useEffect']);
addImport('src/pages/AdminCreateCards.tsx', ['useMemo']);
addImport('src/pages/AdminKeysDashboard.tsx', ['useMemo']);
addImport('src/pages/CoStudyRoom.tsx', ['useCallback']);
addImport('src/pages/SetupProfileScreen.tsx', ['useEffect']);
addImport('src/pages/TeacherDashboard.tsx', ['useMemo']);
