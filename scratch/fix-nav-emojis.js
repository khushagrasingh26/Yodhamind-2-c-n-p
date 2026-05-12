const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dirs = ['pages', 'games', 'tools'];

const svg = (pathData) => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>`;

const replacements = [
  { from: '<span class="ym-sidebar__link-icon">🏠</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">📊</span>', to: `<span class="ym-sidebar__link-icon">${svg('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">🎮</span>', to: `<span class="ym-sidebar__link-icon">${svg('<line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">📋</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">📝</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">🌬️</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">⏱️</span>', to: `<span class="ym-sidebar__link-icon">${svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">💬</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')}</span>` },
  { from: '<span class="ym-sidebar__link-icon">📞</span>', to: `<span class="ym-sidebar__link-icon">${svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>')}</span>` }
];

let totalFixed = 0;

for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) continue;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const r of replacements) {
      content = content.split(r.from).join(r.to);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed nav emojis: ${file}`);
      totalFixed++;
    }
  }
}

// Also process index.html and any other root files
const rootFiles = ['index.html', 'dev_admin.html'];
for (const file of rootFiles) {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const r of replacements) {
      content = content.split(r.from).join(r.to);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed nav emojis: ${file}`);
      totalFixed++;
    }
  }
}

console.log(`\nFixed ${totalFixed} files - Emojis replaced with SVGs`);
