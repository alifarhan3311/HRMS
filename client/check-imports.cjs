const fs = require('fs');
const path = require('path');

function findFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      findFiles(full, results);
    } else if (e.isFile() && (e.name.endsWith('.jsx') || e.name.endsWith('.js'))) {
      results.push(full);
    }
  }
  return results;
}

const srcDir = path.join(__dirname, 'src');
const files = findFiles(srcDir);
const issues = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/from\s+['"](\.[^'"]+)['"]/);
    if (!match) return;
    const rel = match[1];
    const dir = path.dirname(f);
    const resolved = path.resolve(dir, rel);
    const exts = ['', '.jsx', '.js', '.ts', '.tsx'];
    const suffixes = ['', '/index.jsx', '/index.js'];
    const allTries = [];
    exts.forEach(e => allTries.push(resolved + e));
    suffixes.forEach(s => allTries.push(resolved + s));
    const exists = allTries.some(p => {
      try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; }
    }) || fs.existsSync(resolved);
    if (!exists) {
      issues.push(f.replace(srcDir + path.sep, '') + ':' + (idx + 1) + ' -> ' + rel);
    }
  });
}

if (issues.length === 0) {
  console.log('OK: No broken relative imports found');
} else {
  console.log('BROKEN IMPORTS (' + issues.length + '):');
  issues.forEach(i => console.log('  ' + i));
}
