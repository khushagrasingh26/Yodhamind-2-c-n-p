const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dirs = ['pages', 'games', 'tools'];

// Lucide/Phosphor style SVGs with matching stroke/fill
const svg = (pathData) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon">${pathData}</svg>`;

// Map emojis to SVG directly. Since they might be followed by whitespace, we just replace the character.
const replacements = [
  { emoji: '🏠', svg: svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>') },
  { emoji: '📊', svg: svg('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>') },
  { emoji: '🎮', svg: svg('<line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>') },
  { emoji: '📋', svg: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/>') },
  { emoji: '📝', svg: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>') },
  { emoji: '🌬️', svg: svg('<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>') },
  { emoji: '⏱️', svg: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>') },
  { emoji: '💬', svg: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>') },
  { emoji: '📞', svg: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>') },
  { emoji: '👥', svg: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>') },
  { emoji: '🧘', svg: svg('<path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 20h4l1.5 -3"/><path d="M18 20h-4l-1.4 -3.3"/><path d="M15 15l2 2.5"/><path d="M10 15l-2.5 2.5"/><path d="M12 17v-4"/><path d="M12 13l2.5 -3.5"/><path d="M12 13l-2.5 -3.5"/>') },
  { emoji: '🧠', svg: svg('<path d="M9.5 2h5l1.5 3h3l-1.5 4l1.5 4l-3 4v3h-5l-1.5 -3l-3 3h-5v-3l-3 -4l1.5 -4l-1.5 -4h3l1.5 -3h5"/><path d="M12 2v20"/><path d="M12 12h5"/><path d="M12 8h4"/><path d="M12 16h3"/><path d="M12 12h-5"/><path d="M12 8h-4"/><path d="M12 16h-3"/>') },
  { emoji: '❤️', svg: svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>') },
  { emoji: '⚙️', svg: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>') }
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
      content = content.split(r.emoji).join(r.svg);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed emojis in: ${dir}/${file}`);
      totalFixed++;
    }
  }
}

// Also process index.html, JS files with UI, etc.
const rootFiles = ['index.html', 'shared/supabase-auth.js'];
for (const file of rootFiles) {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const r of replacements) {
      content = content.split(r.emoji).join(r.svg);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed emojis in: ${file}`);
      totalFixed++;
    }
  }
}

console.log(`\nFixed ${totalFixed} files globally!`);
