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

  /* ══════════════════════════════════════════
     11. MOBILE BOTTOM TAB BAR
  ══════════════════════════════════════════ */
  function initBottomTabBar() {
    if (document.querySelector('.ym-bottom-tab-bar')) return; // already exists

    var bar = document.createElement('nav');
    bar.className = 'ym-bottom-tab-bar';
    bar.setAttribute('aria-label', 'Main navigation');

    var tabs = [
      { href: '/', label: 'Home', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
      { href: '/assessment', label: 'Check In', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
      { href: '/games', label: 'Gym', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' },
      { href: '/journal', label: 'Journal', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
      { href: '/dashboard', label: 'You', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }
    ];

    var currentPath = window.location.pathname;

    tabs.forEach(function(tab) {
      var a = document.createElement('a');
      a.href = tab.href;
      a.className = 'ym-tab-item';
      a.setAttribute('aria-label', tab.label);

      // Match active tab
      if (tab.href === currentPath ||
          (tab.href === '/' && (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/pages/index.html'))) ||
          (tab.href !== '/' && currentPath.indexOf(tab.href) === 0)) {
        a.classList.add('active');
      }

      a.innerHTML = tab.icon + '<span>' + tab.label + '</span>';
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
  }

  /* ══════════════════════════════════════════
     12. PERSISTENT CRISIS FOOTER BAR
  ══════════════════════════════════════════ */
  function initCrisisBar() {
    // Don't add on admin/auth pages
    if (window.location.pathname.indexOf('dev_admin') !== -1 ||
        window.location.pathname.indexOf('student_auth') !== -1) return;
    if (document.querySelector('.ym-crisis-bar')) return; // already exists

    var bar = document.createElement('div');
    bar.className = 'ym-crisis-bar';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Mental health crisis support');
    bar.innerHTML = [
      '<span class="ym-crisis-bar__text">\u{1F198} In crisis?</span>',
      '<a href="tel:9152987821" class="ym-crisis-bar__link">iCall: 9152987821</a>',
      '<span class="ym-crisis-bar__sep" aria-hidden="true">\u00B7</span>',
      '<a href="tel:18602662345" class="ym-crisis-bar__link">Vandrevala: 1860-266-2345</a>',
      '<span class="ym-crisis-bar__sep" aria-hidden="true">\u00B7</span>',
      '<a href="tel:104" class="ym-crisis-bar__link">104 (toll-free)</a>'
    ].join('');

    document.body.appendChild(bar);
  }

  /* ══════════════════════════════════════════
     13. SKIP-TO-CONTENT LINK
  ══════════════════════════════════════════ */
  function initSkipLink() {
    if (document.querySelector('.skip-link')) return; // already exists

    // Create skip link
    var link = document.createElement('a');
    link.href = '#main-content';
    link.className = 'skip-link';
    link.textContent = 'Skip to main content';
    document.body.insertBefore(link, document.body.firstChild);

    // Add id="main-content" to the first <main> or first <section> after header
    var main = document.querySelector('main');
    if (main && !main.id) {
      main.id = 'main-content';
    } else if (!main) {
      // Find first section after header/topbar
      var firstSection = document.querySelector('.ym-topbar ~ section, header ~ section, nav ~ section');
      if (firstSection && !firstSection.id) {
        firstSection.id = 'main-content';
      }
    }
  }

  /* ══════════════════════════════════════════
     14. DARK MODE THEME TOGGLE
  ══════════════════════════════════════════ */
  function initThemeToggle() {
    // Apply saved theme immediately (before paint)
    var saved = localStorage.getItem('ym_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Don't inject if already exists
    if (document.getElementById('ym-theme-toggle')) return;

    var rightArea = $('.ym-topbar__right');
    if (!rightArea) return;

    var btn = document.createElement('button');
    btn.id = 'ym-theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('aria-pressed', saved === 'dark' ? 'true' : 'false');
    btn.style.cssText = [
      'background:none', 'border:none', 'cursor:pointer', 'padding:8px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'border-radius:50%', 'transition:background 0.2s',
      'color:var(--ym-text)', 'width:40px', 'height:40px'
    ].join(';');

    function getIcon(isDark) {
      return isDark
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                 (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.innerHTML = getIcon(isDark);

    btn.addEventListener('click', function () {
      var currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var newTheme = currentlyDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('ym_theme', newTheme);
      btn.innerHTML = getIcon(!currentlyDark);
      btn.setAttribute('aria-pressed', (!currentlyDark).toString());
    });

    // Hover effect
    btn.addEventListener('mouseenter', function () {
      btn.style.background = 'var(--ym-soft)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.background = 'none';
    });

    // Insert before auth button
    var authBtn = rightArea.querySelector('.ym-auth-btn, .ym-avatar');
    if (authBtn) {
      rightArea.insertBefore(btn, authBtn);
    } else {
      rightArea.appendChild(btn);
    }
  }

  /* ══════════════════════════════════════════
     15. ONBOARDING FLOW (first-time visitors)
  ══════════════════════════════════════════ */
  function initOnboarding() {
    // Only show on homepage
    var path = window.location.pathname;
    var isHome = path === '/' || path === '/index.html' || path.endsWith('/pages/index.html');
    if (!isHome) return;
    if (localStorage.getItem('ym_onboarded')) return;

    // Inject overlay
    var overlay = document.createElement('div');
    overlay.id = 'ym-onboarding';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Welcome to YodhaMind');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(14,11,20,0.85)',
      'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
      'z-index:3000', 'display:flex', 'align-items:flex-end',
      'justify-content:center', 'padding:0', 'opacity:0',
      'transition:opacity 0.4s ease'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'background:var(--ym-surface, #fff)', 'color:var(--ym-text, #1a1625)',
      'border-radius:24px 24px 0 0', 'padding:32px 24px 40px',
      'width:100%', 'max-width:480px', 'max-height:90vh',
      'overflow-y:auto', 'transform:translateY(30px)',
      'transition:transform 0.4s cubic-bezier(0.32,1.2,0.64,1)'
    ].join(';');

    card.innerHTML = [
      '<div style="height:4px;background:var(--ym-border,#e8e3f0);border-radius:4px;margin-bottom:32px;overflow:hidden;">',
      '  <div id="ob-progress" style="height:100%;background:var(--ym-primary,#7C5CBF);border-radius:4px;transition:width 0.4s ease;width:33%"></div>',
      '</div>',
      '<div id="ob-step-1" class="ob-step" style="display:block;">',
      '  <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--ym-text-light,#9b8bb4);margin-bottom:8px;">Let\'s personalise your experience</p>',
      '  <h2 style="font-size:22px;font-weight:700;margin-bottom:24px;line-height:1.3;">What\'s been hardest lately?</h2>',
      '  <div style="display:flex;flex-direction:column;gap:10px;">',
      '    <button class="ob-opt" data-value="stress" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\ude24 Exam stress</button>',
      '    <button class="ob-opt" data-value="sleep" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\ude34 Sleep & rest</button>',
      '    <button class="ob-opt" data-value="motivation" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83e\udeb4 Low motivation</button>',
      '    <button class="ob-opt" data-value="anxiety" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\ude30 Anxiety & overthinking</button>',
      '    <button class="ob-opt" data-value="all" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83c\udf0a Everything at once</button>',
      '  </div>',
      '</div>',
      '<div id="ob-step-2" class="ob-step" style="display:none;">',
      '  <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--ym-text-light,#9b8bb4);margin-bottom:8px;">Good to know</p>',
      '  <h2 style="font-size:22px;font-weight:700;margin-bottom:24px;line-height:1.3;">How often do you want to check in?</h2>',
      '  <div style="display:flex;flex-direction:column;gap:10px;">',
      '    <button class="ob-opt" data-value="daily" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83c\udf05 Every day</button>',
      '    <button class="ob-opt" data-value="weekly" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\udcc5 A few times a week</button>',
      '    <button class="ob-opt" data-value="whenever" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\udcad When I remember</button>',
      '  </div>',
      '</div>',
      '<div id="ob-step-3" class="ob-step" style="display:none;">',
      '  <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--ym-text-light,#9b8bb4);margin-bottom:8px;">One last thing</p>',
      '  <h2 style="font-size:22px;font-weight:700;margin-bottom:24px;line-height:1.3;">What would help you most right now?</h2>',
      '  <div style="display:flex;flex-direction:column;gap:10px;">',
      '    <button class="ob-opt" data-dest="/assessment" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\udcca Understand my mental state</button>',
      '    <button class="ob-opt" data-dest="/tools/spirit-breathing-tool.html" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83c\udf2c\ufe0f Calm down right now</button>',
      '    <button class="ob-opt" data-dest="/games" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83c\udfae Mental reset with a game</button>',
      '    <button class="ob-opt" data-dest="/journal" style="background:var(--ym-soft,#f0eafa);border:2px solid transparent;border-radius:14px;padding:14px 18px;text-align:left;font-size:16px;font-weight:500;color:var(--ym-text,#1a1625);cursor:pointer;transition:all 0.2s;min-height:52px;font-family:inherit;">\ud83d\udcd4 Write how I\'m feeling</button>',
      '  </div>',
      '</div>',
      '<button id="ob-skip" style="display:block;margin:24px auto 0;background:none;border:none;color:var(--ym-text-light,#9b8bb4);font-size:13px;font-weight:500;cursor:pointer;padding:8px 16px;font-family:inherit;">Skip for now</button>'
    ].join('\n');

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      });
    });

    // Desktop: center card
    if (window.innerWidth >= 600) {
      overlay.style.alignItems = 'center';
      card.style.borderRadius = '24px';
    }

    var step = 1;
    var answers = {};
    var progressMap = { 1: '33%', 2: '66%', 3: '100%' };

    // Hover effects for option buttons
    overlay.addEventListener('mouseover', function (e) {
      var btn = e.target.closest('.ob-opt');
      if (btn) {
        btn.style.borderColor = 'var(--ym-primary, #7C5CBF)';
        btn.style.background = 'var(--ym-border, #e8dcf7)';
      }
    });
    overlay.addEventListener('mouseout', function (e) {
      var btn = e.target.closest('.ob-opt');
      if (btn) {
        btn.style.borderColor = 'transparent';
        btn.style.background = 'var(--ym-soft, #f0eafa)';
      }
    });

    overlay.addEventListener('click', function (e) {
      var btn = e.target.closest('.ob-opt');
      if (!btn) return;

      if (step === 1) {
        answers.concern = btn.dataset.value;
        goToStep(2);
      } else if (step === 2) {
        answers.frequency = btn.dataset.value;
        goToStep(3);
      } else if (step === 3) {
        localStorage.setItem('ym_onboarded', '1');
        localStorage.setItem('ym_concern', answers.concern || '');
        localStorage.setItem('ym_frequency', answers.frequency || '');
        closeOnboarding();
        var dest = btn.dataset.dest || '/assessment';
        window.location.href = dest;
      }
    });

    // Skip button
    var skipBtn = document.getElementById('ob-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        localStorage.setItem('ym_onboarded', '1');
        closeOnboarding();
      });
    }

    function goToStep(n) {
      document.getElementById('ob-step-' + step).style.display = 'none';
      step = n;
      document.getElementById('ob-step-' + step).style.display = 'block';
      document.getElementById('ob-progress').style.width = progressMap[n];
    }

    function closeOnboarding() {
      overlay.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      setTimeout(function () { overlay.remove(); }, 400);
    }
  }

  /* ══════════════════════════════════════════
     16. PWA INIT (Fix 18)
  ══════════════════════════════════════════ */
  function initPWA() {
    // Inject manifest link if not present
    if (!document.querySelector('link[rel="manifest"]')) {
      var manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      });
    }
  }

  function init() {
    // initThemeToggle();  // Dark mode removed
    initSkipLink();
    initBottomTabBar();
    // initCrisisBar();    // Crisis bar removed
    initGlobalBreathingModal();
    initScrollShadow();
    initActiveLinks();
    initEscapeHandler();
    initFadeIn();
    initSmoothNav();
    initPrivacyBanner();
    initOnboarding();
    initPWA();

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
