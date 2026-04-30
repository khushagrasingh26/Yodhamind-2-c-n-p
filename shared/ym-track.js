/**
 * shared/ym-track.js — YodhaMind Analytics Tracking Client
 * ══════════════════════════════════════════════════════════
 *
 * Lightweight client-side event tracking for the developer analytics dashboard.
 *
 * Features:
 *   - Automatic session ID management (sessionStorage)
 *   - Anonymous ID via browser fingerprint (localStorage)
 *   - Event batching (queue + flush every 5 seconds)
 *   - Automatic page view tracking
 *   - Context enrichment (device, browser, page)
 *   - beforeunload flush to prevent data loss
 *   - Deduplication (debounce per element)
 *
 * Usage:
 *   <script src="/shared/ym-track.js"></script>
 *
 *   // Automatic: PAGE_VIEWED fires on load
 *   // Manual:
 *   YMTrack.event('GAME_STARTED', { game_id: 'yodha_match' });
 *   YMTrack.event('CTA_CLICKED', { cta_id: 'hero_dashboard', cta_text: 'Open Dashboard' });
 */

/* global window, document, navigator, sessionStorage, localStorage, fetch */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────── */
  var ENDPOINT    = '/api/track';
  var FLUSH_MS    = 5000;          // flush every 5 seconds
  var MAX_BATCH   = 30;            // max events per request
  var DEBOUNCE_MS = 500;           // min gap between same-element clicks

  /* ── Allowed event names (validation) ───── */
  var ALLOWED_EVENTS = [
    'SESSION_STARTED', 'SESSION_ENDED', 'PAGE_VIEWED',
    'AUTH_MODAL_OPENED', 'AUTH_GOOGLE_CLICKED', 'AUTH_COMPLETED', 'AUTH_FAILED', 'SIGN_OUT',
    'GAME_PAGE_VIEWED', 'MOOD_FILTER_SELECTED',
    'GAME_CLICKED', 'GAME_STARTED', 'GAME_COMPLETED', 'GAME_ABANDONED',
    'ASSESSMENT_STARTED', 'ASSESSMENT_COMPLETED', 'ASSESSMENT_ABANDONED',
    'MOOD_LOGGED', 'JOURNAL_CREATED',
    'BREATHING_MODAL_OPENED', 'BREATHING_STARTED', 'BREATHING_COMPLETED',
    'COMMUNITY_VIEWED', 'POST_CREATED', 'POST_RELATED',
    'CTA_CLICKED', 'NAV_LINK_CLICKED', 'CRISIS_LINK_CLICKED',
    'COUNSELOR_PROFILE_VIEWED', 'BOOKING_COMPLETED'
  ];

  /* ── State ───────────────────────────────── */
  var queue       = [];
  var flushTimer  = null;
  var lastClicks  = {};   // element debounce tracking
  var sessionId   = null;
  var anonymousId = null;
  var sessionStart = Date.now();

  /* ── Helpers ─────────────────────────────── */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function getSessionId() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem('ym_session_id');
      if (!sessionId) {
        sessionId = 'ses_' + generateId();
        sessionStorage.setItem('ym_session_id', sessionId);
      }
    } catch (e) {
      sessionId = 'ses_' + generateId();
    }
    return sessionId;
  }

  function getAnonymousId() {
    if (anonymousId) return anonymousId;
    try {
      anonymousId = localStorage.getItem('ym_anon_id');
      if (!anonymousId) {
        anonymousId = 'anon_' + generateId();
        localStorage.setItem('ym_anon_id', anonymousId);
      }
    } catch (e) {
      anonymousId = 'anon_' + generateId();
    }
    return anonymousId;
  }

  function getUserId() {
    try {
      var cached = localStorage.getItem('ym_supabase_user');
      if (cached) {
        var data = JSON.parse(cached);
        return data.email || null; // use email as identifier since we don't have UUID client-side
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function getDeviceType() {
    var w = window.innerWidth || 0;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function getContext() {
    return {
      page_url:        window.location.pathname,
      page_title:      document.title,
      referrer:         document.referrer || '',
      device_type:     getDeviceType(),
      screen_width:    window.screen ? window.screen.width : 0,
      viewport:        (window.innerWidth || 0) + 'x' + (window.innerHeight || 0),
      user_agent:      navigator.userAgent.slice(0, 200),
      timezone:        Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown',
      language:        navigator.language || 'en'
    };
  }

  /* ── Core: enqueue event ────────────────── */
  function trackEvent(eventName, properties) {
    if (!eventName) return;

    // Validate event name
    if (ALLOWED_EVENTS.indexOf(eventName) === -1) {
      if (typeof console !== 'undefined') {
        console.warn('[YMTrack] Unknown event: ' + eventName);
      }
      return;
    }

    var evt = {
      event_name:   eventName,
      session_id:   getSessionId(),
      anonymous_id: getAnonymousId(),
      user_id:      getUserId(),
      timestamp:    new Date().toISOString(),
      properties:   properties || {},
      context:      getContext()
    };

    queue.push(evt);

    // Flush immediately if queue is large
    if (queue.length >= MAX_BATCH) {
      flush();
    }
  }

  /* ── Flush: send batched events ─────────── */
  function flush() {
    if (queue.length === 0) return;

    var batch = queue.splice(0, MAX_BATCH);

    // Use sendBeacon for reliability (especially on page unload)
    if (navigator.sendBeacon) {
      var blob = new Blob(
        [JSON.stringify({ events: batch })],
        { type: 'application/json' }
      );
      var sent = navigator.sendBeacon(ENDPOINT, blob);
      if (!sent) {
        // Fallback to fetch if sendBeacon fails
        sendViaFetch(batch);
      }
    } else {
      sendViaFetch(batch);
    }
  }

  function sendViaFetch(batch) {
    try {
      fetch(ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ events: batch }),
        keepalive: true
      }).catch(function () {
        // Silent fail — analytics should never break the app
      });
    } catch (e) {
      // Silent fail
    }
  }

  /* ── Auto-flush timer ───────────────────── */
  function startFlushTimer() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(flush, FLUSH_MS);
  }

  /* ── Auto page view ─────────────────────── */
  function trackPageView() {
    var pageName = window.location.pathname;
    trackEvent('PAGE_VIEWED', {
      page: pageName,
      title: document.title
    });

    // Special page-level events
    if (pageName === '/games' || pageName === '/games.html') {
      trackEvent('GAME_PAGE_VIEWED', {});
    }
    if (pageName === '/community' || pageName === '/community.html') {
      trackEvent('COMMUNITY_VIEWED', {});
    }
  }

  /* ── Session tracking ───────────────────── */
  function trackSessionStart() {
    sessionStart = Date.now();
    trackEvent('SESSION_STARTED', {
      is_authenticated: !!getUserId()
    });
  }

  /* ── CTA click auto-tracking ────────────── */
  function setupAutoTracking() {
    document.addEventListener('click', function (e) {
      var target = e.target.closest('a, button');
      if (!target) return;

      var now = Date.now();
      var key = (target.id || target.className || target.textContent || '').slice(0, 50);

      // Debounce
      if (lastClicks[key] && now - lastClicks[key] < DEBOUNCE_MS) return;
      lastClicks[key] = now;

      // CTA buttons (primary actions)
      if (target.classList.contains('btn-cta') ||
          target.classList.contains('btn-white') ||
          target.classList.contains('btn-secondary')) {
        trackEvent('CTA_CLICKED', {
          cta_text: (target.textContent || '').trim().slice(0, 60),
          cta_href: target.href || '',
          cta_page: window.location.pathname
        });
      }

      // Crisis links
      if (target.href && (
        target.href.indexOf('tel:9152987821') !== -1 ||
        target.href.indexOf('tel:18602662345') !== -1 ||
        target.href.indexOf('tel:1860266') !== -1
      )) {
        trackEvent('CRISIS_LINK_CLICKED', {
          helpline: target.textContent.trim().slice(0, 40),
          source_page: window.location.pathname
        });
      }

      // Game card clicks
      if (target.classList.contains('game-card') || target.closest('.game-card')) {
        var card = target.closest('.game-card') || target;
        var gameHref = card.href || card.getAttribute('href') || '';
        var gameMatch = gameHref.match(/\/games\/([^.]+)/);
        trackEvent('GAME_CLICKED', {
          game_id: gameMatch ? gameMatch[1] : gameHref,
          game_href: gameHref
        });
      }

      // Auth button
      if (target.id === 'ymAuthBtn' || target.classList.contains('ym-auth-btn')) {
        trackEvent('AUTH_MODAL_OPENED', {});
      }

      // Google sign-in button
      if (target.id === 'ymGoogleBtn' || target.closest('#ymGoogleBtn')) {
        trackEvent('AUTH_GOOGLE_CLICKED', {});
      }

      // Navigation links in sidebar
      if (target.classList.contains('ym-sidebar__link')) {
        trackEvent('NAV_LINK_CLICKED', {
          nav_text: (target.textContent || '').trim().slice(0, 40),
          nav_href: target.href || ''
        });
      }
    }, true); // capture phase
  }

  /* ── beforeunload: flush + session end ──── */
  function setupUnloadHandlers() {
    var ended = false;
    function onUnload() {
      if (ended) return;
      ended = true;
      var duration = Date.now() - sessionStart;
      trackEvent('SESSION_ENDED', {
        duration_ms: duration,
        pages_viewed: queue.filter(function (e) { return e.event_name === 'PAGE_VIEWED'; }).length
      });
      flush();
    }

    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        flush(); // flush on tab switch, but don't end session
      }
    });
  }

  /* ── Initialization ─────────────────────── */
  function init() {
    // Skip on dev-admin page to avoid self-tracking
    if (window.location.pathname.indexOf('dev-admin') !== -1 ||
        window.location.pathname.indexOf('dev_admin') !== -1) {
      return;
    }

    getSessionId();
    getAnonymousId();
    trackSessionStart();
    trackPageView();
    setupAutoTracking();
    setupUnloadHandlers();
    startFlushTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ─────────────────────────── */
  window.YMTrack = {
    event: trackEvent,
    flush: flush,
    getSessionId: getSessionId
  };

}());
