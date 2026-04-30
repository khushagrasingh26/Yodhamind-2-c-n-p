/**
 * execution/update_nav.js — Patch all HTML pages with new YodhaMind nav
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Deterministic script that:
 *   1. Finds all .html files in /pages, /games, /tools
 *   2. Injects <link> to shared/nav.css if missing
 *   3. Replaces or injects the new topbar + sidebar HTML
 *   4. Adds supabase-auth.js script tag before </body>
 *
 * Run: node execution/update_nav.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ── Directories to scan ────────────────────── */
const DIRS = ['pages', 'games', 'tools'];

/* ── The new topbar HTML ────────────────────── */
function getTopbarHTML(relPrefix) {
  // relPrefix: '../' for pages inside /pages, /games, /tools
  return `
    <!-- ═══════════ YM SIDEBAR ═══════════ -->
    <div class="ym-sidebar-backdrop" id="ymSidebarBackdrop"></div>
    <aside class="ym-sidebar" id="ymSidebar">
      <div class="ym-sidebar__header">
        <span style="font-size:1.4rem;">🧠</span>
        <span class="ym-sidebar__logo">YodhaMind</span>
      </div>
      <nav class="ym-sidebar__nav">
        <div class="ym-sidebar__section-label">Navigate</div>
        <a href="/" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">🏠</span>Home</a>
        <a href="/dashboard" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">📊</span>Dashboard</a>
        <a href="/games" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">🎮</span>Mind Gym</a>
        <a href="/assessment" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">📋</span>Self Assessment</a>
        <a href="/journal" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">📝</span>Journal</a>
        <div class="ym-sidebar__divider"></div>
        <div class="ym-sidebar__section-label">Wellness</div>
        <a href="/tools/spirit-breathing-tool.html" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">🌬️</span>Breathing</a>
        <a href="/tools/Focusrealm.html" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">⏱️</span>Focus Timer</a>
        <a href="/community" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">💬</span>Community</a>
        <div class="ym-sidebar__divider"></div>
        <div class="ym-sidebar__section-label">Support</div>
        <a href="tel:9152987821" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">📞</span>iCall: 9152987821</a>
        <a href="tel:18602662345" class="ym-sidebar__link"><span class="ym-sidebar__link-icon">📞</span>Vandrevala: 1860-266-2345</a>
      </nav>
      <div class="ym-sidebar__footer">
        © 2026 YodhaMind<br>
        Made with 💛 for Indian students<br>
        <a href="/pages/privacy.html">Privacy Policy</a>
      </div>
    </aside>

    <!-- ═══════════ YM TOPBAR ═══════════ -->
    <header class="ym-topbar" id="ymTopbar">
      <button class="ym-topbar__hamburger" id="ymHamburger" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      <a href="/" class="ym-topbar__logo">
        <span class="ym-topbar__logo-icon">🧠</span>
        YodhaMind
      </a>
      <div class="ym-topbar__right">
        <button class="ym-auth-btn" id="ymAuthBtn">Sign In</button>
        <img class="ym-avatar" id="ymAvatar" src="" alt="User avatar" />
        <div class="ym-avatar-fallback" id="ymAvatarFallback"></div>
      </div>
    </header>
`;
}

/* ── CSS link tag ────────────────────────────── */
function getCSSLink(relPrefix) {
  return `<link rel="stylesheet" href="${relPrefix}shared/nav.css" />`;
}

/* ── Script tags to add before </body> ──────── */
function getScriptTags(relPrefix) {
  return `
    <script src="${relPrefix}shared/supabase-auth.js"></script>
    <script>
      /* ── Sidebar toggle ── */
      (function() {
        var hamburger = document.getElementById('ymHamburger');
        var sidebar = document.getElementById('ymSidebar');
        var backdrop = document.getElementById('ymSidebarBackdrop');
        var topbar = document.getElementById('ymTopbar');

        function toggleSidebar() {
          var isOpen = sidebar.classList.contains('open');
          sidebar.classList.toggle('open');
          backdrop.classList.toggle('open');
          hamburger.classList.toggle('open');
          document.body.style.overflow = isOpen ? '' : 'hidden';
        }

        if (hamburger) hamburger.addEventListener('click', toggleSidebar);
        if (backdrop) backdrop.addEventListener('click', toggleSidebar);

        /* ── Scroll shadow ── */
        if (topbar) {
          window.addEventListener('scroll', function() {
            topbar.classList.toggle('scrolled', window.scrollY > 10);
          }, { passive: true });
        }

        /* ── Highlight active sidebar link ── */
        var currentPath = window.location.pathname;
        document.querySelectorAll('.ym-sidebar__link').forEach(function(link) {
          var href = link.getAttribute('href');
          if (href === currentPath || (href !== '/' && currentPath.indexOf(href) === 0)) {
            link.classList.add('active');
          }
        });
      })();
    </script>`;
}

/* ══════════════════════════════════════════════
   PROCESSING LOGIC
══════════════════════════════════════════════ */
let totalFiles = 0;
let updatedFiles = 0;
let skippedFiles = [];

function processFile(filePath, relPrefix) {
  totalFiles++;
  let html = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const fileName = path.basename(filePath);

  // Skip student_auth.html — it has its own full-page auth flow
  if (fileName === 'student_auth.html') {
    skippedFiles.push(filePath);
    console.log(`  ⏭  SKIP ${fileName} (has own auth flow)`);
    return;
  }

  // ── 1. Inject nav.css link ──────────────────
  if (!html.includes('nav.css')) {
    // Insert before </head>
    html = html.replace('</head>', `    ${getCSSLink(relPrefix)}\n</head>`);
    modified = true;
  }

  // ── 2. Remove old <nav id="navbar"> ... </nav> block ──
  // Matches <nav ...> through </nav>  (non-greedy, first match)
  const oldNavRegex = /\s*<nav[\s\S]*?<\/nav>\s*/i;
  if (oldNavRegex.test(html) && !html.includes('ym-topbar')) {
    html = html.replace(oldNavRegex, '\n');
    modified = true;
  }

  // ── 3. Inject new topbar + sidebar after <body> ──
  if (!html.includes('ym-topbar')) {
    html = html.replace(/<body[^>]*>/i, function(match) {
      return match + '\n' + getTopbarHTML(relPrefix);
    });
    modified = true;
  }

  // ── 4. Add supabase-auth.js before </body> ──
  if (!html.includes('supabase-auth.js')) {
    html = html.replace('</body>', getScriptTags(relPrefix) + '\n</body>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, html, 'utf-8');
    updatedFiles++;
    console.log(`  ✅ UPDATED ${fileName}`);
  } else {
    console.log(`  ⏩ NO CHANGE ${fileName} (already up to date)`);
  }
}

/* ══════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════ */
console.log('\n🔧 YodhaMind — Nav Patcher');
console.log('═'.repeat(50));

DIRS.forEach(function(dir) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`\n⚠️  Directory not found: ${dir}/`);
    return;
  }

  console.log(`\n📂 Processing ${dir}/`);

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  files.forEach(function(file) {
    processFile(path.join(dirPath, file), '../');
  });
});

console.log('\n' + '═'.repeat(50));
console.log(`📊 Summary: ${updatedFiles}/${totalFiles} files updated`);
if (skippedFiles.length) {
  console.log(`⏭  Skipped: ${skippedFiles.map(f => path.basename(f)).join(', ')}`);
}
console.log('✨ Done!\n');
