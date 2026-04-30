(function () {
  'use strict';

  if (window.__ymGameSoundToggleMounted) return;
  window.__ymGameSoundToggleMounted = true;

  // Untangle already has its own dedicated sound toggle button.
  if (document.getElementById('btn-sound')) return;

  var storageKey = 'ym_game_sound_enabled';
  var enabled = localStorage.getItem(storageKey);
  enabled = enabled === null ? true : enabled === '1';

  var contexts = [];

  function registerContext(ctx) {
    if (!ctx) return;
    contexts.push(ctx);
    if (!enabled && typeof ctx.suspend === 'function' && ctx.state !== 'closed') {
      ctx.suspend().catch(function () {});
    }
  }

  function wrapAudioContext(name) {
    var Original = window[name];
    if (!Original || Original.__ymWrappedAudioContext) return;

    function WrappedAudioContext() {
      var ctx = new Original();
      registerContext(ctx);
      return ctx;
    }

    WrappedAudioContext.prototype = Original.prototype;
    WrappedAudioContext.__ymWrappedAudioContext = true;
    window[name] = WrappedAudioContext;
  }

  wrapAudioContext('AudioContext');
  wrapAudioContext('webkitAudioContext');

  function updateMediaMute() {
    var media = document.querySelectorAll('audio, video');
    for (var i = 0; i < media.length; i++) {
      media[i].muted = !enabled;
    }
  }

  function updateAudioContexts() {
    for (var i = 0; i < contexts.length; i++) {
      var ctx = contexts[i];
      if (!ctx || ctx.state === 'closed') continue;
      if (!enabled && typeof ctx.suspend === 'function') {
        ctx.suspend().catch(function () {});
      }
      if (enabled && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
    }
  }

  var css = [
    '.ym-sound-toggle {',
    '  position: fixed;',
    '  top: calc(env(safe-area-inset-top, 0px) + var(--ym-topbar-height, 60px) + 12px);',
    '  left: 14px;',
    '  z-index: 1200;',
    '  border: 1px solid rgba(148, 163, 184, 0.5);',
    '  border-radius: 999px;',
    '  padding: 9px 12px;',
    '  background: rgba(15, 23, 42, 0.88);',
    '  color: #f8fafc;',
    '  font: 700 13px/1 "Segoe UI", Tahoma, sans-serif;',
    '  cursor: pointer;',
    '  box-shadow: 0 8px 18px rgba(2, 6, 23, 0.35);',
    '}',
    '@media (max-width: 640px) {',
    '  .ym-sound-toggle {',
    '    left: 12px;',
    '    top: calc(env(safe-area-inset-top, 0px) + var(--ym-topbar-height, 60px) + 10px);',
    '    padding: 8px 11px;',
    '    font-size: 12px;',
    '  }',
    '}',
    '.ym-sound-toggle:focus-visible {',
    '  outline: 3px solid #93c5fd;',
    '  outline-offset: 2px;',
    '}',
  ].join('\n');

  var styleTag = document.createElement('style');
  styleTag.id = 'ym-sound-toggle-style';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ym-sound-toggle';
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  document.body.appendChild(btn);

  function renderButton() {
    btn.textContent = enabled ? 'Sound: On' : 'Sound: Off';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  btn.addEventListener('click', function () {
    enabled = !enabled;
    localStorage.setItem(storageKey, enabled ? '1' : '0');
    renderButton();
    updateMediaMute();
    updateAudioContexts();
  });

  renderButton();
  updateMediaMute();
  updateAudioContexts();
})();
