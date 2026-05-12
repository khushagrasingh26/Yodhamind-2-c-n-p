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

  var volumeStorageKey = 'ym_game_volume';
  var globalVolume = localStorage.getItem(volumeStorageKey);
  globalVolume = globalVolume === null ? 1.0 : parseFloat(globalVolume);

  window.ymGlobalVolume = globalVolume;

  function updateMediaVolume() {
    var media = document.querySelectorAll('audio, video');
    for (var i = 0; i < media.length; i++) {
      media[i].muted = !enabled;
      media[i].volume = globalVolume;
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
    '.ym-sound-container {',
    '  position: fixed;',
    '  top: calc(env(safe-area-inset-top, 0px) + var(--ym-topbar-height, 60px) + 12px);',
    '  left: 14px;',
    '  z-index: 1200;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  background: rgba(15, 23, 42, 0.88);',
    '  border: 1px solid rgba(148, 163, 184, 0.5);',
    '  border-radius: 999px;',
    '  padding: 6px 12px;',
    '  box-shadow: 0 8px 18px rgba(2, 6, 23, 0.35);',
    '}',
    '.ym-sound-toggle {',
    '  background: transparent;',
    '  border: none;',
    '  color: #f8fafc;',
    '  font: 700 13px/1 "Segoe UI", Tahoma, sans-serif;',
    '  cursor: pointer;',
    '  padding: 0;',
    '}',
    '.ym-sound-slider {',
    '  width: 60px;',
    '  accent-color: #93c5fd;',
    '}',
    '@media (max-width: 640px) {',
    '  .ym-sound-container {',
    '    left: 12px;',
    '    top: calc(env(safe-area-inset-top, 0px) + var(--ym-topbar-height, 60px) + 10px);',
    '    padding: 5px 11px;',
    '  }',
    '  .ym-sound-toggle { font-size: 12px; }',
    '  .ym-sound-slider { width: 50px; }',
    '}',
  ].join('\n');

  var styleTag = document.createElement('style');
  styleTag.id = 'ym-sound-toggle-style';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var container = document.createElement('div');
  container.className = 'ym-sound-container';
  document.body.appendChild(container);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ym-sound-toggle';
  container.appendChild(btn);

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ym-sound-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = globalVolume;
  container.appendChild(slider);

  function renderButton() {
    btn.textContent = enabled ? '\uD83D\uDD0A' : '\uD83D\uDD08';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    slider.style.display = enabled ? 'block' : 'none';
  }

  btn.addEventListener('click', function () {
    enabled = !enabled;
    localStorage.setItem(storageKey, enabled ? '1' : '0');
    renderButton();
    updateMediaVolume();
    updateAudioContexts();
  });

  slider.addEventListener('input', function() {
    globalVolume = parseFloat(slider.value);
    window.ymGlobalVolume = globalVolume;
    localStorage.setItem(volumeStorageKey, globalVolume);
    updateMediaVolume();
    
    // Dispatch a custom event so Web Audio API games can update their GainNodes
    window.dispatchEvent(new CustomEvent('ymVolumeChanged', { detail: globalVolume }));
  });

  renderButton();
  updateMediaVolume();
  updateAudioContexts();
})();

