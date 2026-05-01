/**
 * shared/supabase-auth.js — YodhaMind Supabase Auth Module
 * ══════════════════════════════════════════════════════════
 *
 * Handles:
 *   1. Supabase client initialization (loads CDN if needed)
 *   2. Auth state detection (session check on load)
 *   3. Google OAuth sign-in via modal
 *   4. Auth modal injection & lifecycle
 *   5. User avatar rendering in topbar
 *   6. Sign-out
 *
 * Load AFTER nav.css and storage.js:
 *   <script src="/shared/supabase-auth.js"></script>
 */

/* global window, document, localStorage */

(function () {
  'use strict';

  /* ── Supabase Config ────────────────────────── */
  var SB_URL = 'https://qbrdfnhksqoaagstvdzk.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicmRmbmhrc3FvYWFnc3R2ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODc5NDcsImV4cCI6MjA4ODM2Mzk0N30.GHhXkO63AMUrRSUHW9GtjD27AjBDZ1PIsfeBWRgNqgQ';

  var sb = null;   // Supabase client instance
  var currentUser = null;

  /* ── Helpers ────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  /* ── Ensure Supabase JS is loaded ──────────── */
  function ensureSupabase(callback) {
    if (window.supabase && window.supabase.createClient) {
      if (!sb) sb = window.supabase.createClient(SB_URL, SB_KEY);
      callback();
      return;
    }

    // Load from CDN
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function () {
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      callback();
    };
    script.onerror = function () {
      console.warn('[YM Auth] Failed to load Supabase SDK');
    };
    document.head.appendChild(script);
  }

  /* ══════════════════════════════════════════════
     INJECT AUTH MODAL into DOM
     Uses native DOM with nav.css classes — no iframe.
  ══════════════════════════════════════════════ */
  function injectAuthModal() {
    if ($('.ym-auth-modal-backdrop')) return; // already injected

    var html = [
      '<div class="ym-auth-modal-backdrop" id="ymAuthBackdrop">',
      '  <div class="ym-auth-modal">',
      '    <button class="ym-auth-modal__close" id="ymAuthClose" aria-label="Close">✕</button>',
      '    <div class="ym-auth-modal__content">',
      '      <div class="ym-auth-modal__logo">🧠</div>',
      '      <div class="ym-auth-modal__title">Welcome to YodhaMind</div>',
      '      <div class="ym-auth-modal__subtitle">Sign in to access your wellness journey</div>',
      '      <div class="ym-auth-modal__error" id="ymAuthError"></div>',
      '      <button class="ym-google-btn" id="ymGoogleBtn">',
      '        <svg width="20" height="20" viewBox="0 0 24 24">',
      '          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>',
      '          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>',
      '          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>',
      '          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>',
      '        </svg>',
      '        <span id="ymGoogleBtnText">Continue with Google</span>',
      '      </button>',
      '      <div class="ym-auth-modal__footer">',
      '        By continuing, you agree to our<br>',
      '        <a href="#">Terms of Service</a> · <a href="#">Privacy Policy</a>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);

    // Bind close events
    $('#ymAuthClose').addEventListener('click', closeAuthModal);
    $('#ymAuthBackdrop').addEventListener('click', function (e) {
      if (e.target === this) closeAuthModal();
    });

    // Bind Google sign-in
    $('#ymGoogleBtn').addEventListener('click', doGoogleSignIn);
  }

  /* ══════════════════════════════════════════════
     INJECT AVATAR DROPDOWN
  ══════════════════════════════════════════════ */
  function injectAvatarDropdown() {
    if ($('.ym-avatar-dropdown')) return;

    var isAdmin = false;
    try {
      var cached = JSON.parse(localStorage.getItem('ym_supabase_user') || '{}');
      if (cached.role === 'admin') isAdmin = true;
    } catch(e) {}

    var html = [
      '<div class="ym-avatar-dropdown" id="ymAvatarDropdown">',
      '  <div class="ym-avatar-dropdown__header">',
      '    <div class="ym-avatar-dropdown__name" id="ymDropdownName">User</div>',
      '    <div class="ym-avatar-dropdown__email" id="ymDropdownEmail">user@email.com</div>',
      '  </div>',
      '  <a href="/student-dashboard" class="ym-avatar-dropdown__item">📊 My Dashboard</a>',
      isAdmin ? '  <a href="/dev-admin" class="ym-avatar-dropdown__item" id="ymAdminDropdownLink">⚙️ Developer Dashboard</a>' : '',
      '  <a href="/dashboard" class="ym-avatar-dropdown__item">🏠 Wellness Hub</a>',
      '  <a href="/journal" class="ym-avatar-dropdown__item">📝 Journal</a>',
      '  <div class="ym-avatar-dropdown__divider"></div>',
      '  <button class="ym-avatar-dropdown__item ym-avatar-dropdown__item--danger" id="ymSignOutBtn">🚪 Sign Out</button>',
      '</div>'
    ].join('\n');

    var topbar = $('.ym-topbar');
    if (!topbar) return;

    var container = document.createElement('div');
    container.innerHTML = html;
    topbar.appendChild(container.firstElementChild);

    $('#ymSignOutBtn').addEventListener('click', doSignOut);

    // Close dropdown on outside click
    document.addEventListener('click', function (e) {
      var dropdown = $('#ymAvatarDropdown');
      var avatar = $('.ym-avatar') || $('.ym-avatar-fallback');
      if (dropdown && dropdown.classList.contains('open')) {
        if (!dropdown.contains(e.target) && e.target !== avatar) {
          dropdown.classList.remove('open');
        }
      }
    });
  }

  /* ══════════════════════════════════════════════
     OPEN / CLOSE AUTH MODAL
  ══════════════════════════════════════════════ */
  function openAuthModal() {
    injectAuthModal();
    var backdrop = $('#ymAuthBackdrop');
    if (backdrop) {
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeAuthModal() {
    var backdrop = $('#ymAuthBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      // Reset error state
      var err = $('#ymAuthError');
      if (err) { err.classList.remove('show'); err.textContent = ''; }
    }
  }

  /* ══════════════════════════════════════════════
     GOOGLE SIGN-IN
  ══════════════════════════════════════════════ */
  function doGoogleSignIn() {
    if (!sb) return;

    var btn = $('#ymGoogleBtn');
    var btnText = $('#ymGoogleBtnText');
    if (!btn || !btnText) return;

    // Loading state
    btn.classList.add('loading');
    btnText.innerHTML = '<div class="ym-spinner"></div>';

    var redirectUrl = window.location.origin + '/student-auth';

    sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    }).then(function (result) {
      if (result.error) throw result.error;
      // Page will redirect to Google
    }).catch(function (err) {
      // Revert
      btn.classList.remove('loading');
      btnText.textContent = 'Continue with Google';

      var errEl = $('#ymAuthError');
      if (errEl) {
        errEl.textContent = err.message || 'Sign-in failed. Please try again.';
        errEl.classList.add('show');
      }
      console.error('[YM Auth] Google sign-in error:', err);
    });
  }

  /* ══════════════════════════════════════════════
     SIGN OUT
  ══════════════════════════════════════════════ */
  function doSignOut() {
    if (!sb) return;

    sb.auth.signOut().then(function () {
      currentUser = null;
      localStorage.removeItem('ym_supabase_user');
      renderAuthState(null);

      // Close dropdown
      var dd = $('#ymAvatarDropdown');
      if (dd) dd.classList.remove('open');

      // Redirect to home
      window.location.href = '/';
    }).catch(function (err) {
      console.error('[YM Auth] Sign-out error:', err);
    });
  }

  /* ══════════════════════════════════════════════
     RENDER AUTH STATE
     Updates topbar based on user session.
  ══════════════════════════════════════════════ */
  function renderAuthState(user) {
    var authBtn = $('.ym-auth-btn');
    var avatar = $('.ym-avatar');
    var avatarFallback = $('.ym-avatar-fallback');

    if (user) {
      // Logged in — hide Sign In, show avatar
      if (authBtn) authBtn.style.display = 'none';

      var meta = user.user_metadata || {};
      var avatarUrl = meta.avatar_url || meta.picture || '';
      var name = meta.full_name || meta.name || user.email.split('@')[0] || 'User';
      var initials = name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);

      if (avatar) {
        if (avatarUrl) {
          avatar.src = avatarUrl;
          avatar.alt = name;
          avatar.style.display = 'block';
          if (avatarFallback) avatarFallback.style.display = 'none';
        } else {
          avatar.style.display = 'none';
          if (avatarFallback) {
            avatarFallback.textContent = initials;
            avatarFallback.style.display = 'flex';
          }
        }

        // Click to toggle dropdown
        var clickTarget = avatarUrl ? avatar : avatarFallback;
        if (clickTarget) {
          clickTarget.onclick = function (e) {
            e.stopPropagation();
            injectAvatarDropdown();
            var dd = $('#ymAvatarDropdown');
            if (dd) {
              dd.classList.toggle('open');
              // Populate
              var nameEl = $('#ymDropdownName');
              var emailEl = $('#ymDropdownEmail');
              if (nameEl) nameEl.textContent = name;
              if (emailEl) emailEl.textContent = user.email || '';
            }
          };
        }
      }

      // Check if admin and inject links
      if (sb && user) {
        sb.from('users').select('role').eq('id', user.id).single()
          .then(function(res) {
            if (!res.error && res.data && res.data.role === 'admin') {
              // Check if admin and inject links
              // Add to sidebar nav
              var sidebarNav = $('.ym-sidebar__nav');
              if (sidebarNav && !$('#ymAdminSidebarLink')) {
                var adminLink = document.createElement('a');
                adminLink.href = '/dev-admin';
                adminLink.className = 'ym-sidebar__link';
                adminLink.id = 'ymAdminSidebarLink';
                adminLink.innerHTML = '<span class="ym-sidebar__link-icon">⚙️</span>Developer Dashboard';
                var dashboardLink = sidebarNav.querySelector('a[href="/dashboard"]');
                if (dashboardLink) dashboardLink.after(adminLink);
                else sidebarNav.appendChild(adminLink);
              }

              // Also cache role so injectAvatarDropdown can use it
              try {
                var cached = JSON.parse(localStorage.getItem('ym_supabase_user') || '{}');
                cached.role = 'admin';
                localStorage.setItem('ym_supabase_user', JSON.stringify(cached));
              } catch(e) {}
            }
          });
      }

      // Cache user for quick load
      try {
        localStorage.setItem('ym_supabase_user', JSON.stringify({
          email: user.email,
          name: name,
          avatar_url: avatarUrl,
          initials: initials
        }));
      } catch(e) { /* ignore */ }

    } else {
      // Logged out — show Sign In, hide avatar
      if (authBtn) authBtn.style.display = 'inline-flex';
      if (avatar) avatar.style.display = 'none';
      if (avatarFallback) avatarFallback.style.display = 'none';

      localStorage.removeItem('ym_supabase_user');
    }
  }

  /* ══════════════════════════════════════════════
     QUICK RENDER FROM CACHE
     Shows avatar immediately before async session check.
  ══════════════════════════════════════════════ */
  function quickRenderFromCache() {
    try {
      var cached = localStorage.getItem('ym_supabase_user');
      if (!cached) return;

      var data = JSON.parse(cached);
      var authBtn = $('.ym-auth-btn');
      var avatar = $('.ym-avatar');
      var avatarFallback = $('.ym-avatar-fallback');

      if (authBtn) authBtn.style.display = 'none';

      if (data.avatar_url && avatar) {
        avatar.src = data.avatar_url;
        avatar.alt = data.name || 'User';
        avatar.style.display = 'block';
      } else if (avatarFallback) {
        avatarFallback.textContent = data.initials || 'U';
        avatarFallback.style.display = 'flex';
      }
    } catch(e) { /* ignore */ }
  }

  /* ══════════════════════════════════════════════
     CHECK SESSION on page load
  ══════════════════════════════════════════════ */
  function checkSession() {
    ensureSupabase(function () {
      sb.auth.getSession().then(function (result) {
        if (result.error) {
          console.warn('[YM Auth] Session check error:', result.error.message);
          renderAuthState(null);
          return;
        }

        var session = result.data.session;
        if (session && session.user) {
          currentUser = session.user;
          renderAuthState(session.user);
          closeAuthModal(); // close if open
        } else {
          renderAuthState(null);
        }
      }).catch(function (err) {
        console.warn('[YM Auth] Session check failed:', err);
        renderAuthState(null);
      });

      // Listen for auth state changes
      sb.auth.onAuthStateChange(function (_event, session) {
        if (session && session.user) {
          currentUser = session.user;
          renderAuthState(session.user);
        } else {
          currentUser = null;
          renderAuthState(null);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════
     BIND TOPBAR AUTH BUTTON
  ══════════════════════════════════════════════ */
  function bindAuthButton() {
    var authBtn = $('.ym-auth-btn');
    if (authBtn) {
      authBtn.addEventListener('click', function () {
        openAuthModal();
      });
    }
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    quickRenderFromCache();
    bindAuthButton();
    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Expose for external use ──────────────── */
  window.YMAuth = {
    openModal:  openAuthModal,
    closeModal: closeAuthModal,
    signOut:    doSignOut,
    getUser:    function () { return currentUser; }
  };

}());
