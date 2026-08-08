// ══════════════════════════════════════════════
//  REALTIME SYNC MANAGER — js/modules/realtime-sync.js
//
//  WHY THIS FILE EXISTS
//  socket-handler.js reacts to events like "deal:updated" by patching
//  only the one object it was told about (deals[idx] = {...deals[idx],
//  ...newData}). If the change on the server also touched anything
//  else — permissions, another client's edit, notes, assignees,
//  contacts, roles — the receiving browser's global arrays (deals,
//  contacts, notes, stages, roles, companies, departments, users)
//  never get refreshed. On localhost this is invisible because there's
//  no real concurrency; on Hostinger with real multi-user traffic it
//  shows up as clients rendering stale data after the first patch.
//
//  This module adds ONE job: RealtimeSync.reloadData() re-fetches the
//  full dataset from api.php and replaces the global arrays IN PLACE
//  (same array reference — so any other module already holding a
//  reference to `deals` etc. sees the fresh contents too), then calls
//  renderKanban()/updateBadges()/renderDashboard(). Rapid-fire socket
//  events are coalesced into a single reload via debouncing.
//
//  LOAD ORDER: after your api helper (if any) and BEFORE
//  socket-handler.js in index.php.
//
//  VERIFIED against api.php: GET api.php?action=load returns
//  { ok: true, db: { <table>: [...rows] } } for each table in TABLES
//  (contacts, deals, tasks, notes, activity, taskActivity, departments,
//  companies, roles, stages, users, files, counters, login_logs).
//  Also confirmed: every write path (the 'save' action, and 'uploadFile')
//  commits to SQLite BEFORE calling notifySocketServer(), so there is no
//  write/notify race — by the time a client's socket event fires, the row
//  it's about to reload is already committed server-side.
//
//  ⚠️ ONE REMAINING ASSUMPTION: the 'tasks' table broadcasts under the
//  'announcement' event prefix (see BROADCAST_ENTITY_TABLES in api.php),
//  so it's mapped to window.announcements below. I don't have
//  announcements.js to confirm that's the actual global variable name —
//  if it's called something else, fix the 'tasks' line in FIELD_MAP.
// ══════════════════════════════════════════════

(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────
    const ENDPOINT = window.__tmsApiUrl || 'api.php';
    const LOAD_ACTION = 'load';

    // Multiple socket events firing within this window (e.g. a save
    // that triggers deal:updated + activity:new + task-activity:new)
    // trigger only ONE reload, not one per event.
    const DEBOUNCE_MS = 250;

    // globalVarName -> table name as returned under payload.db in
    // api.php's 'load' action. Only tables that matter for renderKanban()
    // and its related pages are included here — append-only log tables
    // (activity, taskActivity, login_logs) already get their new rows
    // pushed directly via their own socket events (activity:new etc.) and
    // don't need a full-table reload; files/counters aren't part of the
    // stale-data problem this module fixes.
    const FIELD_MAP = {
        deals: 'deals',
        contacts: 'contacts',
        notes: 'notes',
        stages: 'stages',
        roles: 'roles',
        companies: 'companies',
        departments: 'departments',
        users: 'users',
        announcements: 'tasks' // ⚠️ see note above — verify global var name
    };

    let debounceTimer = null;
    let inFlight = null;
    let pendingRerun = false;

    // ── Core: fetch fresh dataset from server ────────────────────────
    function doReload() {
        if (inFlight) {
            // Already loading — run again once this one finishes instead
            // of firing overlapping requests.
            pendingRerun = true;
            return inFlight;
        }

        inFlight = fetch(`${ENDPOINT}?action=${LOAD_ACTION}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Load failed: HTTP ' + res.status);
                return res.json();
            })
            .then(function (payload) {
                applyPayload(payload);
                return payload;
            })
            .catch(function (err) {
                console.error('RealtimeSync: reload failed', err);
            })
            .finally(function () {
                inFlight = null;
                if (pendingRerun) {
                    pendingRerun = false;
                    doReload();
                }
            });

        return inFlight;
    }

    // ── Replace in-memory global arrays with server truth ────────────
    // Mutates arrays in place (length = 0, then push) so other modules
    // holding the SAME array reference see fresh data automatically.
    function applyPayload(payload) {
        if (!payload || typeof payload !== 'object' || payload.ok !== true || !payload.db) {
            console.warn('RealtimeSync: load endpoint returned no usable data', payload);
            return;
        }

        Object.keys(FIELD_MAP).forEach(function (globalName) {
            const table = FIELD_MAP[globalName];
            const incoming = payload.db[table];
            if (!Array.isArray(incoming)) return;

            if (Array.isArray(window[globalName])) {
                window[globalName].length = 0;
                Array.prototype.push.apply(window[globalName], incoming);
            } else {
                window[globalName] = incoming;
            }
        });

        // Re-render everything that depends on the refreshed arrays.
        if (typeof window.renderKanban === 'function') {
            window.renderKanban();
        }
        if (typeof window.updateBadges === 'function') {
            window.updateBadges();
        }
        if (window.currentPage === 'dashboard' && typeof window.renderDashboard === 'function') {
            window.renderDashboard();
        }

        console.debug('RealtimeSync: applied fresh data from server', {
            deals: Array.isArray(window.deals) ? window.deals.length : 'n/a'
        });
    }

    // ── Public API ────────────────────────────────────────────────────
    // reloadData(): debounced — call this from every socket event handler.
    function reloadData() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doReload, DEBOUNCE_MS);
    }

    // reloadDataNow(): no debounce, returns a promise. Useful right after
    // the current user's own saveAll(), or for a manual "refresh" button.
    function reloadDataNow() {
        clearTimeout(debounceTimer);
        return doReload();
    }

    window.RealtimeSync = {
        reloadData: reloadData,
        reloadDataNow: reloadDataNow
    };

    console.log('✅ RealtimeSync manager loaded');
})();
