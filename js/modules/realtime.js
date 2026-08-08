// ══════════════════════════════════════════════
//  REALTIME — js/modules/realtime.js
//  Live updates via Server-Sent Events (api.php?action=stream).
//
//  Whenever any browser/tab saves (kanban move, note, revision,
//  upload, activity log, etc. — anything that goes through
//  saveAll()/pushToServer() in api.js), the server marks which
//  tables changed. This module listens for that and quietly
//  reloadAllData() + re-renders whatever page is currently open,
//  so every connected user sees changes within ~1-2 seconds without
//  refreshing the page or waiting on a fixed polling interval.
//
//  Depends on: reloadAllData()/window._tmsServerOnline (api.js),
//  renderPage()/currentPage/updateBadges() (navigation.js), and
//  optionally closeModal() (navigation.js) which this module wraps
//  so a pending update isn't lost, just deferred until the modal
//  the user is actively working in gets closed.
//
//  Load this AFTER api.js and navigation.js, and call
//  startRealtimeSync() once the user is authenticated and the app
//  has entered (init.js does this automatically after enterApp()).
//
//  Requires PHP-FPM/Nginx on a VPS with long-running requests
//  allowed (Hostinger KVM2 ✅). Not supported on shared hosts like
//  InfinityFree that kill/buffer long PHP requests — on those hosts
//  this module fails silently and the app just keeps using its
//  normal periodic poll.
// ══════════════════════════════════════════════

let _tmsEventSource = null;
let _tmsLastEventTs = null;
let _tmsRefreshPending = false;
let _tmsRefreshTimer = null;
let _tmsRealtimeConnected = false;

// Which tables actually need a re-render of the CURRENT page vs. ones
// that are safe to silently absorb into memory (e.g. login_logs, which
// only the Login Monitoring page cares about, and that page re-fetches
// its own data anyway). Keeps this from re-rendering the whole page on
// every login/logout across the company.
const REALTIME_PAGE_RENDER_MAP = {
    deals: ['deals', 'dashboard'],
    notes: ['deals', 'notes', 'dashboard'],
    taskActivity: ['task-activity', 'deals', 'dashboard'],
    activity: ['notes', 'dashboard'],
    files: ['deals'],
    contacts: ['contacts', 'employee-directory', 'dashboard'],
    tasks: ['tasks', 'dashboard'],
    departments: ['departments'],
    companies: ['companies'],
    roles: ['roles'],
    users: ['users'],
    login_logs: ['login-monitoring'],
};

/**
 * True while the user is mid-interaction in a way that a silent
 * background re-render would disrupt: a card/column drag in progress,
 * or any modal currently open. We don't drop the update in that case —
 * we just wait and re-check shortly instead of forcing it through.
 */
function _tmsIsBusy() {
    if (document.getElementById('kanban-board')?.classList.contains('dnd-active')) return true;
    if (document.querySelector('.modal.open')) return true;
    return false;
}

function _tmsScheduleRefresh(changedTables) {
    _tmsRefreshPending = true;
    if (_tmsRefreshTimer) return; // a refresh check is already scheduled

    const attempt = () => {
        _tmsRefreshTimer = null;
        if (_tmsIsBusy()) {
            // Try again shortly rather than dropping the update.
            _tmsRefreshTimer = setTimeout(attempt, 1500);
            return;
        }
        _tmsRefreshPending = false;
        _tmsApplyRefresh(changedTables);
    };

    // Small debounce so a burst of several saves in a row (e.g. a drag
    // that also writes a taskActivity entry) triggers one refresh, not
    // several back-to-back re-renders.
    _tmsRefreshTimer = setTimeout(attempt, 350);
}

async function _tmsApplyRefresh(changedTables) {
    if (typeof reloadAllData !== 'function') return;
    try {
        await reloadAllData();
    } catch (err) {
        console.warn('TMS realtime: reloadAllData failed', err);
        return;
    }

    if (typeof updateBadges === 'function') updateBadges();

    if (typeof renderPage !== 'function' || typeof currentPage === 'undefined') return;

    // If we don't recognize any of the changed tables, be safe and just
    // re-render whatever's open.
    const relevantPages = new Set();
    (changedTables || []).forEach(t => {
        (REALTIME_PAGE_RENDER_MAP[t] || []).forEach(p => relevantPages.add(p));
    });
    if (!relevantPages.size || relevantPages.has(currentPage)) {
        renderPage(currentPage);
    }
}

function _tmsHandleUpdateEvent(evt) {
    let payload;
    try { payload = JSON.parse(evt.data); } catch { return; }
    if (payload && typeof payload.ts === 'number') _tmsLastEventTs = payload.ts;
    _tmsScheduleRefresh((payload && payload.tables) || []);
}

/**
 * Opens (or re-opens) the SSE connection. Safe to call more than once —
 * an existing connection is closed first.
 */
function startRealtimeSync() {
    if (typeof EventSource === 'undefined') {
        console.warn('TMS realtime: this browser has no EventSource support — falling back to normal polling only.');
        return;
    }

    if (_tmsEventSource) {
        _tmsEventSource.close();
        _tmsEventSource = null;
    }

    const endpoint = (typeof API_ENDPOINT !== 'undefined' ? API_ENDPOINT : 'api.php');
    const url = endpoint + '?action=stream' + (_tmsLastEventTs ? ('&since=' + encodeURIComponent(_tmsLastEventTs)) : '');

    const es = new EventSource(url);
    _tmsEventSource = es;

    es.addEventListener('update', _tmsHandleUpdateEvent);

    es.onopen = () => {
        _tmsRealtimeConnected = true;
        window._tmsRealtimeConnected = true;
    };

    // The server intentionally ends the connection every ~55s to recycle
    // the PHP-FPM worker; the browser's built-in EventSource retry (~3s
    // default) reconnects automatically, so onerror here just tracks
    // status — it does not need to manually reconnect.
    es.onerror = () => {
        _tmsRealtimeConnected = false;
        window._tmsRealtimeConnected = false;
    };
}

function stopRealtimeSync() {
    if (_tmsEventSource) {
        _tmsEventSource.close();
        _tmsEventSource = null;
    }
    _tmsRealtimeConnected = false;
    window._tmsRealtimeConnected = false;
}

// If a refresh got deferred because a modal was open, flush it as soon
// as that modal closes, instead of waiting for the next SSE event.
// Wraps the existing closeModal() from navigation.js rather than
// duplicating it.
if (typeof closeModal === 'function' && !closeModal.__tmsWrapped) {
    const _origCloseModal = closeModal;
    closeModal = function (id) {
        _origCloseModal(id);
        if (_tmsRefreshPending && !_tmsIsBusy()) {
            clearTimeout(_tmsRefreshTimer);
            _tmsRefreshTimer = null;
            _tmsApplyRefresh([]); // tables unknown at this point — refresh whatever's open, to be safe
            _tmsRefreshPending = false;
        }
    };
    closeModal.__tmsWrapped = true;
}

// Pause the underlying connection while the tab is hidden (saves a
// PHP-FPM worker slot for every backgrounded tab) and reconnect the
// moment it becomes visible again, catching up via ?since=.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopRealtimeSync();
    } else if (typeof currentUser !== 'undefined' && currentUser) {
        startRealtimeSync();
    }
});
