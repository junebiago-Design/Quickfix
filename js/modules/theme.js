// ══════════════════════════════════════════════
//  THEME — js/modules/theme.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════

function applyTheme(theme) {
    const knob = document.getElementById('theme-toggle-knob');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (knob) knob.textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        if (knob) knob.textContent = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('tms_theme', next); } catch {}
}

(function initTheme() {
    let saved = 'dark';
    try { saved = localStorage.getItem('tms_theme') || 'dark'; } catch {}
    applyTheme(saved);
})();

