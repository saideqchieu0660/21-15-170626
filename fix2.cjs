const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    content = content.replace(/React\.useEffect/g, 'useEffect');
    content = content.replace(/React\.useMemo/g, 'useMemo');
    content = content.replace(/React\.useCallback/g, 'useCallback');
    
    if (content !== original) {
      if (!content.includes('useEffect')) content = content.replace(/import React/, 'import React, { useEffect }');
      if (!content.includes('useMemo') && original.includes('React.useMemo')) content = content.replace(/import React/, 'import React, { useMemo }');
      if (!content.includes('useCallback') && original.includes('React.useCallback')) content = content.replace(/import React/, 'import React, { useCallback }');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
    }
  }
});
