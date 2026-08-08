// ══════════════════════════════════════════════
//  INIT — js/modules/init.js (must load last)
//  Bootstraps the application:
//    1. Establishes user session (via initSession)
//    2. Loads the JSON database (via initDB)
//    3. Calls enterApp() to render the UI
// ══════════════════════════════════════════════

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

    // Load data from server
    await initDB();

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
