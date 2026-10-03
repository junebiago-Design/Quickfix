// ══════════════════════════════════════════════
//  INIT — js/modules/init.js (must load last)
//  Bootstraps the application:
//    1. Establishes user session (via initSession)
//    2. Loads the JSON database (via initDB)
//    3. Calls enterApp() to render the UI
// ══════════════════════════════════════════════

function showSyncBanner(message) {
    try {
        var bar = document.createElement('div');
        bar.id = 'tms-sync-banner';
        bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;padding:10px 16px;' +
            'background:#b45309;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center;';
        bar.textContent = message;
        var close = document.createElement('button');
        close.textContent = '×';
        close.style.cssText = 'margin-left:12px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer;';
        close.onclick = function () { bar.remove(); };
        bar.appendChild(close);
        document.body.appendChild(bar);
        // Remove automatically as soon as a retry succeeds.
        var t = setInterval(function () {
            if (window._tmsLoaded) { bar.remove(); clearInterval(t); }
        }, 2000);
    } catch (e) { /* banner is best-effort */ }
}

(async function initApp() {
    let user = null;

    // If currentUser already exists (e.g. from window.__tmsUser)
    if (
        typeof currentUser !== 'undefined' &&
        currentUser &&
        currentUser.id
    ) {
        user = currentUser;
    } else {
        // Otherwise, fetch session
        if (typeof initSession === 'function') {
            user = await initSession();
        }
    }

    if (!user) {
        window.location.replace('login.html');
        return;
    }

    // Load data from server. initDB() resolves true on success, false if the
    // server couldn't be reached / returned something unexpected. It never
    // pushes anything until a load has succeeded, so a failed load can't
    // overwrite the database — but the user must be told instead of silently
    // seeing stale or empty data.
    const loaded = await initDB();
    if (!loaded) {
        console.error('TMS: initial load failed:', window._tmsLastError || 'unknown error');
        showSyncBanner('Could not load the latest data from the server' +
            (window._tmsLastError ? ' (' + window._tmsLastError.slice(0, 120) + ')' : '') +
            '. Showing cached data — changes are kept on this device and will sync automatically once the server responds.');
    }

    // Enter the application
    if (typeof enterApp === 'function') {
        enterApp();
    } else {
        console.error('enterApp() not defined – check session.js');
    }

    // Start live updates
    if (typeof startRealtimeSync === 'function') {
        startRealtimeSync();
    }
})();