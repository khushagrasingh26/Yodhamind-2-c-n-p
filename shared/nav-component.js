/**
 * shared/nav-component.js — YodhaMind Navigation Enhancer
 * ══════════════════════════════════════════════════════════
 *
 * Drop this script at the END of <body> on every page.
 * Requires shared/storage.js to be loaded first.
 *
 *   <script src="/shared/storage.js"></script>
 *   <script src="/shared/nav-component.js"></script>   ← last before </body>
 *
 * What it does automatically:
 *   1. Scroll shadow  — adds .scrolled class to #navbar on scroll
 *   2. Streak pill    — shows/injects streak count in nav
 *   3. Active links   — highlights current page in both desktop + mobile nav
 *   4. ESC to close   — closes any open .modal-overlay on Escape
 *   5. Page fade-in   — smooth opacity transition on load
 *   6. Smooth nav     — 180ms fade-out before internal link navigation
 *   7. Pending badge  — red dot on mobile Support link if pending bookings
 *   8. Wellness badge — populates any .ym-wellness-badge element with score
 *
 * No configuration needed — everything is auto-detected from the DOM.
 */

/* global window, document, YM */

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────── */

  function $(sel, ctx)  { return (ctx || document).querySelector(sel);   }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /* ══════════════════════════════════════════
     1. SCROLL SHADOW
  ══════════════════════════════════════════ */

  function initScrollShadow() {
    const nav = $('#navbar');
    if (!nav) return;

    function update() {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }

    window.addEventListener('scroll', update, { passive: true });
    update(); // apply immediately on load
  }

  /* ══════════════════════════════════════════
     2. STREAK PILL
     Looks for an existing #streakPill / .streak-pill.
     If found → updates the count and shows it.
     If not found → injects one into .nav-right.
  ══════════════════════════════════════════ */

  function initStreakPill() {
    if (typeof YM === 'undefined') return;

    const streak = YM.getStreak();
    if (!streak || streak.current < 1) return;

    // Try existing element
    var pill = $('#streakPill') || $('.streak-pill');

    if (pill) {
      // Update number inside pill
      var numEl = pill.querySelector('#streakNum, .streak-num, span');
      if (numEl) numEl.textContent = streak.current;
      pill.classList.remove('hidden');
      pill.classList.add('show');
      pill.style.display = 'flex';
      return;
    }

    // Inject new pill
    var container = $('#navbar .nav-right') ||
                    $('#navbar .nav-controls') ||
                    $('#navbar .nav-container');
    if (!container) return;

    pill = document.createElement('div');
    pill.id        = 'ym-streak-pill';
    pill.className = 'streak-pill';
    pill.style.cssText = [
      'display:flex', 'align-items:center', 'gap:5px',
      'background:white', 'border:1px solid rgba(124,92,191,0.2)',
      'padding:6px 14px', 'border-radius:50px',
      'font-size:0.83rem', 'font-weight:700', 'color:#7C5CBF',
      'font-family:inherit'
    ].join(';');

    pill.innerHTML = '🔥 <span>' + streak.current + '</span>-day streak';

    // Insert before the last child (usually the CTA button)
    var lastChild = container.children[container.children.length - 1];
    if (lastChild) {
      container.insertBefore(pill, lastChild);
    } else {
      container.appendChild(pill);
    }
  }

  /* ══════════════════════════════════════════
     3. ACTIVE LINK HIGHLIGHTING
  ══════════════════════════════════════════ */

  function initActiveLinks() {
    var page = currentPage();

    $$('nav a, .nav-links a, .mobile-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('/').pop().split('?')[0];
      if (href && href === page) {
        link.classList.add('active');
      }
    });
  }

  /* ══════════════════════════════════════════
     4. ESC KEY — close any open modal
  ══════════════════════════════════════════ */

  function initEscapeHandler() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.modal-overlay.open, .confirm-overlay.open, .setup-overlay.open')
        .forEach(function (el) { el.classList.remove('open'); });
    });
  }

  /* ══════════════════════════════════════════
     5. PAGE FADE-IN
  ══════════════════════════════════════════ */

  function initFadeIn() {
    if (document.body.dataset.ymTransition) return; // already done
    document.body.style.opacity    = '0';
    document.body.style.transition = 'opacity 0.22s ease';

    // Two rAF calls to ensure the initial opacity is painted first
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.style.opacity = '1';
      });
    });

    document.body.dataset.ymTransition = '1';
  }

  /* ══════════════════════════════════════════
     6. SMOOTH INTERNAL NAVIGATION
     180ms fade-out before following a local link.
  ══════════════════════════════════════════ */

  function initSmoothNav() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;

      var href = link.getAttribute('href') || '';

      // Only handle simple relative .html links
      if (href.startsWith('http')   ||
          href.startsWith('//')     ||
          href.startsWith('#')      ||
          href.startsWith('tel:')   ||
          href.startsWith('mailto:')) return;

      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (link.target === '_blank') return;

      e.preventDefault();

      document.body.style.opacity    = '0';
      document.body.style.transition = 'opacity 0.18s ease';

      setTimeout(function () {
        window.location.href = href;
      }, 180);
    });
  }

  /* ══════════════════════════════════════════
     7. PENDING BOOKING BADGE
     Red dot on mobile Support link if any
     ym_student_bookings are pending.
  ══════════════════════════════════════════ */

  function initBookingBadge() {
    if (typeof YM === 'undefined') return;

    var bookings = YM.get('ym_student_bookings', []);
    var pending  = bookings.filter(function (b) { return b.status === 'pending'; }).length;
    if (!pending) return;

    var mobileNav   = $('.mobile-nav');
    if (!mobileNav) return;

    var supportLink = null;
    $$('a', mobileNav).forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('connect') !== -1) supportLink = a;
    });

    if (!supportLink) return;

    var dot = document.createElement('span');
    dot.style.cssText = [
      'position:absolute', 'top:2px', 'right:4px',
      'width:8px', 'height:8px', 'border-radius:50%',
      'background:#EF4444', 'border:1.5px solid white',
      'pointer-events:none'
    ].join(';');

    supportLink.style.position = 'relative';
    supportLink.appendChild(dot);
  }

  /* ══════════════════════════════════════════
     8. WELLNESS BADGE
     Populates .ym-wellness-badge elements if any.
  ══════════════════════════════════════════ */

  function initWellnessBadge() {
    if (typeof YM === 'undefined') return;

    $$('.ym-wellness-badge').forEach(function (el) {
      var ws = YM.getCachedWellnessScore();
      if (!ws) return;
      el.textContent = ws.score !== undefined ? ws.score : ws.total;
      if (ws.color) el.style.color = ws.color;
      el.title = 'Wellness: ' + (ws.label || '');
    });
  }

  /* ══════════════════════════════════════════
     9. PRIVACY CONSENT BANNER
     Injects a consent banner if not accepted.
  ══════════════════════════════════════════ */

  function initPrivacyBanner() {
    if (localStorage.getItem('ym_privacy_consent') === 'true') return;

    var banner = document.createElement('div');
    banner.id = 'ym-privacy-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'background:var(--ink, #1a1625)', 'color:#fff', 'padding:16px 20px',
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'gap:20px', 'z-index:9999', 'font-size:0.85rem', 'font-family:inherit',
      'box-shadow:0 -4px 20px rgba(0,0,0,0.1)'
    ].join(';');

    // Handle mobile stacking
    if (window.innerWidth < 600) {
      banner.style.flexDirection = 'column';
      banner.style.textAlign = 'center';
      banner.style.paddingBottom = '80px'; // clear mobile nav
    }

    banner.innerHTML = `
      <div>
        <strong>Privacy Notice:</strong> We use local storage to save your progress and provide emergency crisis support if needed.
        <a href="privacy.html" style="color:var(--accent, #56CFB2);text-decoration:underline;margin-left:6px;">Read Policy</a>
      </div>
      <button id="ym-privacy-btn" style="
        background:var(--accent, #56CFB2); color:var(--ink, #1a1625);
        border:none; padding:8px 18px; border-radius:8px; font-weight:700;
        cursor:pointer; white-space:nowrap; font-family:inherit;
      ">Got it</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('ym-privacy-btn').addEventListener('click', function() {
      localStorage.setItem('ym_privacy_consent', 'true');
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease';
      setTimeout(function() { banner.remove(); }, 300);
    });
  }

  /* ══════════════════════════════════════════
     INIT — run on DOMContentLoaded
  ══════════════════════════════════════════ */

  
  /* ══════════════════════════════════════════
     10. GLOBAL BREATHING MODAL
  ══════════════════════════════════════════ */
  function initGlobalBreathingModal() {
    if (document.getElementById('breathModal')) return; // already injected
    
    // Inject HTML
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = `<!-- Breathing Modal -->
    <div class="breath-modal-overlay" id="breathModal">
        <div class="breath-modal-content">
            <button class="close-modal" id="closeBreathModal" aria-label="Close modal">&times;</button>
            <div class="modal-header">
                <h3>Calm Breathing</h3>
                <button class="sound-toggle" id="soundToggle" aria-label="Toggle ambient sound">🔈</button>
            </div>
            
            <div class="breath-visual-container">
                <div class="breath-glow" id="breathGlow"></div>
                <div class="breath-circle" id="breathCircle">
                    <!-- The exact liquid canvas blob from outside -->
                    <canvas id="modalSpiritCanvas" width="360" height="360"></canvas>
                </div>
            </div>`;
    document.body.appendChild(modalWrapper.firstElementChild);
    
    // Inject logic
    /* ── Interactive Spirit Breathing Logic ── */
        
        const breathModal = document.getElementById('breathModal');
        const closeBreathModal = document.getElementById('closeBreathModal');
        const startBreathBtn = document.getElementById('startBreathBtn');
        const patternBtn = document.getElementById('patternBtn');
        const breathText = document.getElementById('breathText');
        const breathCircle = document.getElementById('breathCircle');
        const breathGlow = document.getElementById('breathGlow');
        const soundToggle = document.getElementById('soundToggle');

        let isBreathing = false;
        let breathTimeout;
        let audioCtx, masterGain, synthFilter;
        let isSoundOn = false;

        /* ── Liquid Modal Spirit Animation ── */
        const modalCanvas = document.getElementById('modalSpiritCanvas');
        const modalCtx = modalCanvas.getContext('2d');
        let modalTime = 0;
        let spiritState = 'default';
        let faceOffsetY = 0;
        let targetFaceOffset = 0;
        let isModalBlinking = false;
        let modalBlinkCountdown = 280;

        function drawModalBlob(cx, cy, baseR, fill, speed, complexity) {
            modalCtx.fillStyle = fill;
            modalCtx.beginPath();
            for (let i = 0; i <= Math.PI * 2; i += 0.1) {
                const r = baseR
                    + Math.sin(i * 3 + modalTime * speed) * (5 * complexity)
                    + Math.cos(i * 5 - modalTime * speed) * (5 * complexity)
                    + Math.sin(i * 7 + modalTime) * (2 * complexity);
                const x = cx + Math.cos(i) * r;
                const y = cy + Math.sin(i) * r;
                i === 0 ? modalCtx.moveTo(x, y) : modalCtx.lineTo(x, y);
            }
            modalCtx.closePath(); modalCtx.fill();
        }

        function animateModalSpirit() {
            const w = modalCanvas.width, h = modalCanvas.height;
            const cx = w / 2, cy = h / 2;
            
            modalCtx.clearRect(0, 0, w, h);
            modalTime += 0.015;

            modalCtx.shadowColor = 'rgba(124,92,191,0.35)'; 
            modalCtx.shadowBlur = 25;
            modalCtx.shadowOffsetY = 10;
            
            const body = modalCtx.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 80);
            body.addColorStop(0, '#56CFB2'); 
            body.addColorStop(1, '#7C5CBF');
            
            drawModalBlob(cx, cy, 88, body, 0.5, 0.4);
            
            modalCtx.shadowBlur = 0;
            modalCtx.shadowOffsetY = 0;

            faceOffsetY += (targetFaceOffset - faceOffsetY) * 0.1;
            modalCtx.save();
            modalCtx.translate(0, faceOffsetY);
            modalCtx.fillStyle = 'white';
            modalCtx.strokeStyle = 'white';
            modalCtx.lineCap = 'round';
            modalCtx.lineJoin = 'round';

            modalBlinkCountdown--;
            if (modalBlinkCountdown <= 0 && spiritState === 'default') {
                isModalBlinking = true; 
                modalBlinkCountdown = Math.random() * 200 + 150;
                setTimeout(() => isModalBlinking = false, 150);
            }

            if (spiritState === 'inhale') {
                modalCtx.beginPath(); modalCtx.ellipse(cx - 30, cy - 12, 11, 17, 0, 0, Math.PI*2); modalCtx.fill();
                modalCtx.beginPath(); modalCtx.ellipse(cx + 30, cy - 12, 11, 17, 0, 0, Math.PI*2); modalCtx.fill();
                modalCtx.lineWidth = 3.5;
                modalCtx.beginPath(); modalCtx.arc(cx, cy + 14, 5, 0, Math.PI*2); modalCtx.stroke();
            } else if (spiritState === 'hold') {
                modalCtx.lineWidth = 4;
                modalCtx.beginPath(); modalCtx.moveTo(cx - 42, cy - 6); modalCtx.quadraticCurveTo(cx - 30, cy - 16, cx - 18, cy - 6); modalCtx.stroke();
                modalCtx.beginPath(); modalCtx.moveTo(cx + 18, cy - 6); modalCtx.quadraticCurveTo(cx + 30, cy - 16, cx + 42, cy - 6); modalCtx.stroke();
                
                modalCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                modalCtx.beginPath(); modalCtx.ellipse(cx - 44, cy + 6, 8, 4, 0, 0, Math.PI*2); modalCtx.fill();
                modalCtx.beginPath(); modalCtx.ellipse(cx + 44, cy + 6, 8, 4, 0, 0, Math.PI*2); modalCtx.fill();

                modalCtx.lineWidth = 3;
                modalCtx.beginPath(); modalCtx.arc(cx, cy + 6, 3, 0, Math.PI, false); modalCtx.stroke();
            } else if (spiritState === 'exhale') {
                modalCtx.lineWidth = 4;
                modalCtx.beginPath(); modalCtx.moveTo(cx - 40, cy - 12); modalCtx.quadraticCurveTo(cx - 30, cy - 4, cx - 20, cy - 12); modalCtx.stroke();
                modalCtx.beginPath(); modalCtx.moveTo(cx + 20, cy - 12); modalCtx.quadraticCurveTo(cx + 30, cy - 4, cx + 40, cy - 12); modalCtx.stroke();
                
                modalCtx.lineWidth = 3;
                modalCtx.beginPath(); modalCtx.arc(cx, cy + 12, 4, 0, Math.PI*2); modalCtx.stroke();
                
                modalCtx.lineWidth = 2.5;
                modalCtx.strokeStyle = `rgba(255, 255, 255, ${0.2 + 0.8 * Math.sin(modalTime * 8)})`;
                modalCtx.beginPath(); modalCtx.moveTo(cx, cy + 22); modalCtx.lineTo(cx, cy + 32); modalCtx.stroke();
            } else {
                if (!isModalBlinking) {
                    modalCtx.fillStyle = 'white';
                    modalCtx.beginPath(); modalCtx.ellipse(cx - 30, cy - 9, 9, 14, 0, 0, Math.PI * 2); modalCtx.fill();
                    modalCtx.beginPath(); modalCtx.ellipse(cx + 30, cy - 9, 9, 14, 0, 0, Math.PI * 2); modalCtx.fill();
                    
                    modalCtx.fillStyle = 'rgba(255,255,255,0.8)';
                    modalCtx.beginPath(); modalCtx.arc(cx - 25, cy - 14, 3.5, 0, Math.PI * 2); modalCtx.fill();
                    modalCtx.beginPath(); modalCtx.arc(cx + 35, cy - 14, 3.5, 0, Math.PI * 2); modalCtx.fill();
                } else {
                    modalCtx.lineWidth = 3.5;
                    modalCtx.beginPath(); modalCtx.moveTo(cx - 40, cy - 4); modalCtx.quadraticCurveTo(cx - 30, cy + 6, cx - 20, cy - 4); modalCtx.stroke();
                    modalCtx.beginPath(); modalCtx.moveTo(cx + 20, cy - 4); modalCtx.quadraticCurveTo(cx + 30, cy + 6, cx + 40, cy - 4); modalCtx.stroke();
                }
                
                modalCtx.strokeStyle = 'white';
                modalCtx.lineWidth = 2.5;
                modalCtx.beginPath(); modalCtx.moveTo(cx - 6, cy + 12); modalCtx.quadraticCurveTo(cx, cy + 16, cx + 6, cy + 12); modalCtx.stroke();
            }
            modalCtx.restore();

            // 3D Gloss / Specular Highlight
            modalCtx.save();
            drawModalBlob(cx, cy, 88, 'transparent', 0.5, 0.4); 
            modalCtx.clip();
            
            const highlight = modalCtx.createRadialGradient(cx - 40, cy - 40, 0, cx, cy, 120);
            highlight.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
            highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
            modalCtx.fillStyle = highlight;
            modalCtx.fill();
            modalCtx.restore();

            requestAnimationFrame(animateModalSpirit);
        }
        animateModalSpirit();

        // Initialize Audio
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = audioCtx.createGain();
                masterGain.gain.value = 0;
                masterGain.connect(audioCtx.destination);

                const osc1 = audioCtx.createOscillator();
                const osc2 = audioCtx.createOscillator();
                osc1.type = 'sine'; osc2.type = 'sine';
                
                osc1.frequency.value = 174; 
                osc2.frequency.value = 178;

                synthFilter = audioCtx.createBiquadFilter();
                synthFilter.type = 'lowpass';
                synthFilter.frequency.value = 300;

                osc1.connect(synthFilter);
                osc2.connect(synthFilter);
                synthFilter.connect(masterGain);
                
                osc1.start(); osc2.start();
            }
        }

        // Event Listeners
        soundToggle.addEventListener('click', () => {
            if (!audioCtx) initAudio();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            isSoundOn = !isSoundOn;
            soundToggle.textContent = isSoundOn ? '🔊' : '🔈';
            if (isSoundOn && isBreathing) {
                masterGain.gain.setTargetAtTime(0.15, audioCtx.currentTime, 1);
            } else if (!isSoundOn && masterGain) {
                masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 1);
            }
        });

        
        closeBreathModal.addEventListener('click', () => {
            breathModal.classList.remove('active');
            stopBreathing();
        });

        const sleep = ms => new Promise(r => { breathTimeout = setTimeout(r, ms); });

        async function startBreathingCycle() {
            if (isBreathing) return stopBreathing();
            isBreathing = true;
            startBreathBtn.textContent = 'Pause';

            if (isSoundOn && !audioCtx) initAudio();
            if (isSoundOn && audioCtx) {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                masterGain.gain.setTargetAtTime(0.15, audioCtx.currentTime, 1);
            }

            try {
                while (isBreathing) {
                    // 1. INHALE (4s)
                    spiritState = 'inhale';
                    targetFaceOffset = -8;
                    breathText.style.opacity = '0';
                    await sleep(300);
                    if (!isBreathing) break;
                    breathText.textContent = 'Inhale...';
                    breathText.style.opacity = '1';

                    breathCircle.style.transition = 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)';
                    breathGlow.style.transition = 'transform 4s cubic-bezier(0.4, 0, 0.2, 1), opacity 4s ease';
                    breathCircle.style.transform = 'scale(2.2)';
                    breathGlow.style.transform = 'scale(2.6)';
                    breathGlow.style.opacity = '0.8';

                    if (isSoundOn && synthFilter) synthFilter.frequency.setTargetAtTime(800, audioCtx.currentTime, 2);

                    await sleep(4000);
                    if (!isBreathing) break;

                    // 2. HOLD (4s)
                    spiritState = 'hold';
                    targetFaceOffset = -4;
                    breathText.style.opacity = '0';
                    await sleep(300);
                    if (!isBreathing) break;
                    breathText.textContent = 'Hold...';
                    breathText.style.opacity = '1';

                    breathCircle.style.transition = 'transform 4s linear';
                    breathCircle.style.transform = 'scale(2.25)';

                    await sleep(4000);
                    if (!isBreathing) break;

                    // 3. EXHALE (6s)
                    spiritState = 'exhale';
                    targetFaceOffset = 8;
                    breathText.style.opacity = '0';
                    await sleep(300);
                    if (!isBreathing) break;
                    breathText.textContent = 'Exhale...';
                    breathText.style.opacity = '1';

                    breathCircle.style.transition = 'transform 6s cubic-bezier(0.4, 0, 0.2, 1)';
                    breathGlow.style.transition = 'transform 6s cubic-bezier(0.4, 0, 0.2, 1), opacity 6s ease';
                    breathCircle.style.transform = 'scale(1)';
                    breathGlow.style.transform = 'scale(1)';
                    breathGlow.style.opacity = '0.3';

                    if (isSoundOn && synthFilter) synthFilter.frequency.setTargetAtTime(300, audioCtx.currentTime, 3);

                    await sleep(6000);
                }
            } catch (e) {}
        }

        function stopBreathing() {
            isBreathing = false;
            clearTimeout(breathTimeout);
            spiritState = 'default';
            targetFaceOffset = 0;
            startBreathBtn.textContent = 'Start 4-4-6 Breath';
            breathText.style.opacity = '0';
            
            setTimeout(() => {
                breathText.textContent = 'Ready when you are';
                breathText.style.opacity = '1';
            }, 300);

            breathCircle.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)';
            breathGlow.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 1s ease';
            breathCircle.style.transform = 'scale(1)';
            breathGlow.style.transform = 'scale(1)';
            breathGlow.style.opacity = '0.3';

            if (masterGain) masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 1);
        }

        startBreathBtn.addEventListener('click', startBreathingCycle);
        patternBtn.addEventListener('click', () => {
            const patterns = ['4-7-8 Breath', 'Box Breathing', 'Coherence Breath'];
            const random = patterns[Math.floor(Math.random() * patterns.length)];
            startBreathBtn.textContent = `Start ${random}`;
        });
    
    // Global delegation
    window.openBreathingModal = function() {
        // Because of dynamically inserted HTML, re-detect if needed or it's already bound from the logic above
        if (typeof breathModal !== 'undefined' && breathModal) {
             breathModal.classList.add('active');
        } else {
             const m = document.getElementById('breathModal');
             if(m) m.classList.add('active');
        }
    };
    
    // Intercept clicks on links going to spirit-breathing-tool.html OR .spirit-container
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href]');
        if (link && link.getAttribute('href') && link.getAttribute('href').includes('spirit-breathing-tool.html')) {
            e.preventDefault();
            window.openBreathingModal();
            return;
        }
        
        // hero spirit container
        if (e.target.closest('#spiritContainer') || e.target.closest('.open-breath-modal')) {
            e.preventDefault();
            window.openBreathingModal();
        }
    });

  }

  function init() {
    initGlobalBreathingModal();
    initScrollShadow();
    initActiveLinks();
    initEscapeHandler();
    initFadeIn();
    initSmoothNav();
    initPrivacyBanner();

    // YM-dependent features — retry after a tick in case
    // storage.js is deferred or loaded async
    initStreakPill();
    initBookingBadge();
    initWellnessBadge();

    setTimeout(function () {
      initStreakPill();    // second pass for pages that init YM after DOMContentLoaded
      initWellnessBadge();
    }, 500);

    // ── BFCache Fix ──────────────────────────────────────────
    // Handle back button navigation (restoring from cache)
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        document.body.style.opacity = '1';
        // Re-trigger AOS if present
        if (window.AOS) window.AOS.refresh();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
