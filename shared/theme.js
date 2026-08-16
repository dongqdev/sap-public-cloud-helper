// Shared light/dark/system theme toggle for popup.html and options.html.
// Loaded first in <head>, before any stylesheet, so the stored preference
// is applied to <html data-theme> before first paint (no flash of the
// wrong theme). localStorage is used instead of chrome.storage because the
// read must be synchronous and this is a per-device UI preference, not
// data worth syncing across machines.
(function () {
  var STORAGE_KEY = 'sap-helper-theme'; // 'system' | 'light' | 'dark'
  var root = document.documentElement;

  function getStored() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch (e) {
      return 'system';
    }
  }

  function apply(mode) {
    if (mode === 'light' || mode === 'dark') {
      root.setAttribute('data-theme', mode);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  // Apply immediately, before CSS/paint.
  apply(getStored());

  var ICONS = {
    system:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    light:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>',
  };

  var LABELS = {
    system: '테마: 시스템 설정 따름',
    light: '테마: 라이트 모드',
    dark: '테마: 다크 모드',
  };

  var NEXT = { system: 'light', light: 'dark', dark: 'system' };

  function wireToggle() {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    function render(mode) {
      btn.innerHTML = ICONS[mode];
      btn.title = LABELS[mode];
      btn.setAttribute('aria-label', LABELS[mode]);
    }

    var current = getStored();
    render(current);

    btn.addEventListener('click', function () {
      current = NEXT[current] || 'system';
      apply(current);
      render(current);
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch (e) {
        /* storage unavailable, theme just won't persist */
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireToggle);
  } else {
    wireToggle();
  }
})();
