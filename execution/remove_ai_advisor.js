/**
 * execution/remove_ai_advisor.js — Strip AI Advisor link from all sidebar instances
 * Run: node execution/remove_ai_advisor.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['pages', 'games', 'tools'];

let count = 0;

DIRS.forEach(dir => {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  files.forEach(file => {
    const fp = path.join(dirPath, file);
    let html = fs.readFileSync(fp, 'utf-8');

    if (html.includes('AI Advisor')) {
      // Remove the AI Advisor sidebar link line
      html = html.replace(/\s*<a href="\/chat" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">🤖<\/span>AI Advisor<\/a>\s*\n?/g, '\n');
      fs.writeFileSync(fp, html, 'utf-8');
      count++;
      console.log(`  ✅ Removed AI Advisor from ${file}`);
    }
  });
});

console.log(`\n📊 Cleaned ${count} files`);
