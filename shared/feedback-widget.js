/**
 * YodhaMind Feedback Widget
 * Self-contained floating feedback button + bottom-sheet modal
 * Mobile-first: large touch targets, bottom-sheet UX, safe-area aware
 */
(function() {
  // Prevent double-init
  if (document.getElementById('ym-feedback-widget')) return;

  // ── Inject CSS ──
  const style = document.createElement('style');
  style.textContent = `
    /* Floating Feedback Button */
    #ym-feedback-btn {
      position: fixed;
      bottom: max(24px, env(safe-area-inset-bottom, 24px));
      left: 20px;
      z-index: 1100;
      background: linear-gradient(135deg, #7C5CBF, #56CFB2);
      color: white;
      border: none;
      padding: 12px 22px;
      border-radius: 50px;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      box-shadow: 0 8px 28px rgba(124, 92, 191, 0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
      min-height: 48px;
      -webkit-tap-highlight-color: transparent;
    }
    #ym-feedback-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 36px rgba(124, 92, 191, 0.5);
    }
    #ym-feedback-btn:active {
      transform: scale(0.95);
    }

    /* Bottom Sheet Backdrop */
    #ym-feedback-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 10, 40, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 2100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    #ym-feedback-backdrop.open {
      opacity: 1;
      pointer-events: all;
    }

    /* Bottom Sheet */
    #ym-feedback-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 2200;
      background: white;
      border-radius: 28px 28px 0 0;
      padding: 20px 24px max(28px, env(safe-area-inset-bottom, 28px));
      max-width: 600px;
      margin: 0 auto;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.32, 1.2, 0.64, 1);
      box-shadow: 0 -10px 50px rgba(0,0,0,0.15);
      max-height: 85dvh;
      overflow-y: auto;
    }
    #ym-feedback-backdrop.open #ym-feedback-sheet {
      transform: translateY(0);
    }

    /* Handle */
    .ym-fb-handle {
      width: 40px; height: 4px;
      background: rgba(0,0,0,0.1);
      border-radius: 2px;
      margin: 0 auto 18px;
    }

    .ym-fb-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #2D2D2D;
      margin-bottom: 6px;
    }
    .ym-fb-subtitle {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 20px;
    }

    /* Star Rating */
    .ym-fb-stars {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 18px;
    }
    .ym-fb-star {
      width: 48px; height: 48px;
      font-size: 2rem;
      background: #F0EBF8;
      border: 2px solid rgba(124, 92, 191, 0.15);
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .ym-fb-star.selected {
      background: linear-gradient(135deg, #7C5CBF, #56CFB2);
      border-color: transparent;
      transform: scale(1.1);
      box-shadow: 0 4px 14px rgba(124, 92, 191, 0.3);
    }
    .ym-fb-star:active {
      transform: scale(0.9);
    }

    /* Text area */
    .ym-fb-textarea {
      width: 100%;
      min-height: 100px;
      padding: 14px 16px;
      border: 1.5px solid rgba(0,0,0,0.1);
      border-radius: 16px;
      font-family: inherit;
      font-size: 0.92rem;
      color: #2D2D2D;
      background: #F0EBF8;
      resize: none;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    .ym-fb-textarea:focus {
      border-color: #7C5CBF;
      background: white;
    }
    .ym-fb-textarea::placeholder {
      color: #94a3b8;
    }

    /* Submit */
    .ym-fb-submit {
      width: 100%;
      padding: 15px;
      background: linear-gradient(135deg, #7C5CBF, #56CFB2);
      color: white;
      border: none;
      border-radius: 16px;
      font-family: inherit;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      min-height: 52px;
      box-shadow: 0 8px 24px rgba(124, 92, 191, 0.25);
      transition: opacity 0.2s, transform 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .ym-fb-submit:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .ym-fb-submit:active {
      transform: scale(0.97);
    }
    .ym-fb-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Success state */
    .ym-fb-success {
      text-align: center;
      padding: 20px 0;
    }
    .ym-fb-success-icon {
      font-size: 3rem;
      margin-bottom: 12px;
    }
    .ym-fb-success-text {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D2D2D;
      margin-bottom: 6px;
    }
    .ym-fb-success-sub {
      font-size: 0.85rem;
      color: #64748b;
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      #ym-feedback-btn {
        bottom: max(80px, calc(env(safe-area-inset-bottom, 20px) + 70px));
        left: 16px;
        padding: 10px 18px;
        font-size: 0.82rem;
      }
    }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ──
  const widget = document.createElement('div');
  widget.id = 'ym-feedback-widget';
  widget.innerHTML = `
    <button id="ym-feedback-btn" aria-label="Send Feedback">
      💬 Feedback
    </button>
    <div id="ym-feedback-backdrop">
      <div id="ym-feedback-sheet">
        <div class="ym-fb-handle"></div>
        <div id="ym-fb-form-view">
          <div class="ym-fb-title">Share Your Feedback</div>
          <div class="ym-fb-subtitle">Help us make YodhaMind better for you 💛</div>
          <div class="ym-fb-stars" id="ym-fb-stars">
            <button class="ym-fb-star" data-val="1">😞</button>
            <button class="ym-fb-star" data-val="2">😐</button>
            <button class="ym-fb-star" data-val="3">🙂</button>
            <button class="ym-fb-star" data-val="4">😊</button>
            <button class="ym-fb-star" data-val="5">🤩</button>
          </div>
          <textarea class="ym-fb-textarea" id="ym-fb-text" placeholder="Tell us what you think, suggest features, report bugs..." maxlength="1000"></textarea>
          <button class="ym-fb-submit" id="ym-fb-submit">Send Feedback</button>
        </div>
        <div id="ym-fb-success-view" class="ym-fb-success" style="display:none;">
          <div class="ym-fb-success-icon">🎉</div>
          <div class="ym-fb-success-text">Thank you!</div>
          <div class="ym-fb-success-sub">Your feedback means the world to us.</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  // ── Logic ──
  let selectedRating = 0;
  const btn = document.getElementById('ym-feedback-btn');
  const backdrop = document.getElementById('ym-feedback-backdrop');
  const submitBtn = document.getElementById('ym-fb-submit');
  const starsContainer = document.getElementById('ym-fb-stars');
  const textArea = document.getElementById('ym-fb-text');
  const formView = document.getElementById('ym-fb-form-view');
  const successView = document.getElementById('ym-fb-success-view');

  function openSheet() {
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    btn.style.display = 'none';
  }

  function closeSheet() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    btn.style.display = 'flex';
    // Reset after close animation
    setTimeout(() => {
      formView.style.display = '';
      successView.style.display = 'none';
      selectedRating = 0;
      textArea.value = '';
      starsContainer.querySelectorAll('.ym-fb-star').forEach(s => s.classList.remove('selected'));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
    }, 350);
  }

  btn.addEventListener('click', openSheet);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet();
  });

  // Star selection
  starsContainer.addEventListener('click', (e) => {
    const star = e.target.closest('.ym-fb-star');
    if (!star) return;
    selectedRating = parseInt(star.dataset.val);
    starsContainer.querySelectorAll('.ym-fb-star').forEach((s, i) => {
      s.classList.toggle('selected', parseInt(s.dataset.val) <= selectedRating);
    });
  });

  // Submit
  submitBtn.addEventListener('click', async () => {
    if (selectedRating === 0 && !textArea.value.trim()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const SB_URL = 'https://qbrdfnhksqoaagstvdzk.supabase.co';
      const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicmRmbmhrc3FvYWFnc3R2ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODc5NDcsImV4cCI6MjA4ODM2Mzk0N30.GHhXkO63AMUrRSUHW9GtjD27AjBDZ1PIsfeBWRgNqgQ';

      const resp = await fetch(`${SB_URL}/rest/v1/platform_feedback`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          rating: selectedRating || null,
          message: textArea.value.trim() || null,
          page: window.location.pathname,
          user_agent: navigator.userAgent.substring(0, 200),
          created_at: new Date().toISOString()
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }
    } catch (err) {
      console.warn('Feedback save failed:', err);
      alert('Error saving feedback: ' + err.message);
    }

    // Show success regardless
    formView.style.display = 'none';
    successView.style.display = 'block';

    // Auto-close after 2s
    setTimeout(closeSheet, 2000);
  });
})();
