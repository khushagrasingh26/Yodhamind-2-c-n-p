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
      if (!sb) {
        sb = window.supabase.createClient(SB_URL, SB_KEY);
        window._supabase = sb;
      }
      callback();
      return;
    }

    // Load from CDN
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function () {
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      window._supabase = sb;
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
      '      <div class="ym-auth-modal__logo"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><path d="M9.5 2h5l1.5 3h3l-1.5 4l1.5 4l-3 4v3h-5l-1.5 -3l-3 3h-5v-3l-3 -4l1.5 -4l-1.5 -4h3l1.5 -3h5"/><path d="M12 2v20"/><path d="M12 12h5"/><path d="M12 8h4"/><path d="M12 16h3"/><path d="M12 12h-5"/><path d="M12 8h-4"/><path d="M12 16h-3"/></svg></div>',
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
      '      <div class="ym-auth-divider">or</div>',
      '      <input type="email" id="ymAuthEmail" class="ym-auth-input" placeholder="Email address">',
      '      <input type="password" id="ymAuthPassword" class="ym-auth-input" placeholder="Password">',
      '      <button class="ym-email-btn" id="ymEmailSignInBtn">Sign In with Email</button>',
      '      <button class="ym-email-btn secondary" id="ymEmailSignUpBtn">Sign Up</button>',
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

    // Bind Email sign-in and sign-up
    $('#ymEmailSignInBtn').addEventListener('click', doEmailSignIn);
    $('#ymEmailSignUpBtn').addEventListener('click', doEmailSignUp);
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
      '  <a href="/student-dashboard" class="ym-avatar-dropdown__item"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg> My Dashboard</a>',
      isAdmin ? '  <a href="/dev-admin" class="ym-avatar-dropdown__item" id="ymAdminDropdownLink"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Developer Dashboard</a>' : '',
      '  <a href="/dashboard" class="ym-avatar-dropdown__item"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Wellness Hub</a>',
      '  <a href="/journal" class="ym-avatar-dropdown__item"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> Journal</a>',
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
     EMAIL SIGN-IN / SIGN-UP
  ══════════════════════════════════════════════ */
  function doEmailSignIn() {
    if (!sb) return;

    var email = $('#ymAuthEmail').value.trim();
    var password = $('#ymAuthPassword').value;
    var btn = $('#ymEmailSignInBtn');
    var errEl = $('#ymAuthError');

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter both email and password.';
        errEl.classList.add('show');
      }
      return;
    }

    if (errEl) errEl.classList.remove('show');
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    sb.auth.signInWithPassword({
      email: email,
      password: password
    }).then(function (result) {
      btn.textContent = 'Sign In with Email';
      btn.disabled = false;
      if (result.error) throw result.error;
      // Success is handled by onAuthStateChange in checkSession
    }).catch(function (err) {
      btn.textContent = 'Sign In with Email';
      btn.disabled = false;
      if (errEl) {
        errEl.textContent = err.message || 'Invalid email or password.';
        errEl.classList.add('show');
      }
    });
  }

  function doEmailSignUp() {
    if (!sb) return;

    var email = $('#ymAuthEmail').value.trim();
    var password = $('#ymAuthPassword').value;
    var btn = $('#ymEmailSignUpBtn');
    var errEl = $('#ymAuthError');

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter both email and password.';
        errEl.classList.add('show');
      }
      return;
    }

    if (errEl) errEl.classList.remove('show');
    btn.textContent = 'Signing up...';
    btn.disabled = true;

    sb.auth.signUp({
      email: email,
      password: password
    }).then(function (result) {
      btn.textContent = 'Sign Up';
      btn.disabled = false;
      if (result.error) throw result.error;
      if (errEl) {
        // Many times Supabase requires email confirmation
        errEl.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
        errEl.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        errEl.style.color = '#4ade80';
        errEl.textContent = 'Success! You can now sign in (or check your email for confirmation).';
        errEl.classList.add('show');
      }
    }).catch(function (err) {
      btn.textContent = 'Sign Up';
      btn.disabled = false;
      if (errEl) {
        errEl.style.backgroundColor = '';
        errEl.style.borderColor = '';
        errEl.style.color = '';
        errEl.textContent = err.message || 'Sign-up failed.';
        errEl.classList.add('show');
      }
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
                adminLink.innerHTML = '<span class="ym-sidebar__link-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ym-nav-icon"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span>Developer Dashboard';
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
