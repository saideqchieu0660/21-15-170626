const fs = require('fs');
const glob = require('glob'); // Not available out of box usually, use pure node
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
    content = content.replace(/React\.useState/g, 'useState');
    content = content.replace(/React\.useRef/g, 'useRef');
    content = content.replace(/React\.useMemo/g, 'useMemo');
    content = content.replace(/React\.useCallback/g, 'useCallback');
    
    // We also need to ensure they are imported.
    if (content !== original) {
      if (!content.includes('useEffect')) content = content.replace(/import React/, 'import React, { useEffect }');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
    }
  }
});
