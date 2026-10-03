// ══════════════════════════════════════════════
//  core/api-client.js — TMS Data Layer
//  Backed by an SQLite database on the server
//  (api.php + data/tms_database.sq3), with
//  localStorage used as an instant local cache /
//  offline fallback so the app keeps working the
//  moment it's opened even before the first server
//  round‑trip completes, and if api.php can't be
//  reached.
//
//  Loaded as a classic (non-module) script BEFORE
//  every other js/ file in index.php:
//      <script src="js/core/api-client.js"></script>
//      <script src="js/services/roles.js"></script>
//      <script src="js/services/stages.js"></script>
//      <script src="js/services/auth.js"></script>
//      ... (remaining service files)
//      <script src="js/app.js"></script>
//  Because all of these are classic scripts sharing
//  the same global scope, the `let`/`const` bindings
//  declared here (DB_KEYS, contacts, deals, tasks,
//  notes, activity, taskActivity, departments,
//  companies, users, files, loginLogs, counters) and
//  the functions below remain directly accessible to
//  every file loaded after this one — exactly as they
//  were when everything lived in one api.js.
//
//  SYNC MODEL (v2 — row-level, never "replace the table"):
//   The old client pushed its ENTIRE in-memory state and the server
//   did DELETE FROM <table> + re-INSERT. Any stale/empty/partial
//   copy (failed first load, old tab, offline cache, records written
//   server-side by auth.php/uploads) therefore erased real records.
//   Now we remember what the server last confirmed (syncBase) and send
//   ONLY the rows that were added/changed plus the ids that were
//   explicitly removed. Nothing is pushed until one successful load,
//   and loads/pushes are serialised so they can never interleave.
//
//  services/roles.js and services/stages.js declare
//  their own `roles` / `stages` globals the same way,
//  loaded immediately after this file so that load()/
//  save() below are already defined when they run.
// ══════════════════════════════════════════════

// Path to the PHP API endpoint (SQLite backend).
const API_ENDPOINT = 'api.php';

const DB_KEYS = {
    contacts: 'tms_employees',
    deals: 'tms_tasks',
    tasks: 'tms_announcements',
    notes: 'tms_notes',
    activity: 'tms_activity',
    taskActivity: 'tms_task_activity',   // ← per-task audit trail
    departments: 'tms_departments',
    companies: 'tms_companies',
    roles: 'tms_roles',
    stages: 'tms_stages',
    users: 'tms_users',
    files: 'tms_files',
    login_logs: 'tms_login_logs'  // ← Login monitoring
};

// ══════════════════════════════════════════════
//  AUTO-INCREMENT ID SEQUENCES
//  One counter per table, mirroring a SQL
//  AUTO_INCREMENT primary key. Persisted in the
//  SQLite database (counters table) and mirrored
//  to localStorage as a fallback.
//  Table names below map 1:1 to DB_KEYS above:
//    contacts    -> Employees
//    deals       -> Kanban Task
//    tasks       -> Announcements
//    notes       -> Notes
//    activity    -> Activity Log
//    taskActivity -> Task Activity (per-task audit trail)
//    departments -> Departments
//    companies   -> Companies
//    roles       -> Roles
//    stages      -> Stages
//    users       -> Users
//    files       -> Task Attachments
//    login_logs  -> Login Monitoring Logs
// ══════════════════════════════════════════════

const COUNTER_KEYS = {
    contacts: 'tms_employees_seq',
    deals: 'tms_tasks_seq',
    tasks: 'tms_announcements_seq',
    notes: 'tms_notes_seq',
    activity: 'tms_activity_seq',
    taskActivity: 'tms_task_activity_seq',
    departments: 'tms_departments_seq',
    companies: 'tms_companies_seq',
    roles: 'tms_roles_seq',
    stages: 'tms_stages_seq',
    users: 'tms_users_seq',
    files: 'tms_files_seq',
    login_logs: 'tms_login_logs_seq'  // ← Login logs counter
};

// Loads the unified counters object. Migrates forward from the old
// per-table localStorage keys (COUNTER_KEYS) the first time this runs,
// so upgrading an existing deployment doesn't reset activity IDs etc.
function loadCounters() {
    try {
        const existing = JSON.parse(localStorage.getItem('tms_counters'));
        if (existing && typeof existing === 'object') return existing;
    } catch {}
    const migrated = {};
    Object.keys(COUNTER_KEYS).forEach(table => {
        try { migrated[table] = parseInt(localStorage.getItem(COUNTER_KEYS[table]), 10) || 0; }
        catch { migrated[table] = 0; }
    });
    return migrated;
}

function saveCounters() {
    try { localStorage.setItem('tms_counters', JSON.stringify(counters)); } catch {}
}

// Returns the next auto-increment id for a table, as a string (so it
// drop-in replaces the old uid() strings used throughout app.js — no
// type mismatches against HTML <select> values or existing
// .find(x => x.id === id) comparisons).
// ── localStorage cache (instant, synchronous, offline-safe) ──
function load(key) {
    try { return JSON.parse(localStorage.getItem(DB_KEYS[key])) || []; } catch { return []; }
}

function save(key, data) {
    // A full/blocked localStorage must never stop the server push that follows.
    try { localStorage.setItem(DB_KEYS[key], JSON.stringify(data)); }
    catch (err) { console.warn(`TMS: could not cache "${key}" locally`, err); }
}

let contacts = load('contacts');
let deals = load('deals');
let tasks = load('tasks');
let notes = load('notes');
let activity = load('activity');
let taskActivity = load('taskActivity');   // ← loaded from localStorage
let departments = load('departments');
let companies = load('companies');
let users = load('users');
let files = load('files');
let loginLogs = load('login_logs');  // ← Login logs
let counters = loadCounters();

// NOTE: `roles` and `stages` are declared in services/roles.js and
// services/stages.js respectively (each owns its own seed/load logic).
// Those files load immediately after this one, so load()/save() above
// are already defined by the time they run.

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ══════════════════════════════════════════════
//  SERVER SYNC (SQLite via api.php) — row-level delta sync
// ══════════════════════════════════════════════

// UTF-8 safe base64 encode. Plain btoa() throws on non-Latin1
// characters (names/notes with accents, emoji, etc).
function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function currentDbSnapshot() {
    return {
        contacts, deals, tasks, notes, activity, taskActivity,
        departments, companies, roles, stages, users, files,
        login_logs: loginLogs,  // ← Include login logs
        counters
    };
}

(function () {
// Everything below is private to this closure so generic names (rowId, enqueue,
// setTable, retryDelay, ...) can never collide with other js/ files that share
// the global scope. Globals like `contacts`, `deals`, `roles` are still used directly.

function nextId(table) {
    // Never trust the counter alone: rows delivered by another user (Socket.IO,
    // reload, replay) don't bump this browser's counter, and reusing their id
    // used to silently overwrite their record. Also look at the table itself.
    let max = parseInt(counters[table], 10) || 0;
    tableRef(table).forEach(r => {
        const id = r && r.id;
        if (id !== undefined && id !== null && /^\d+$/.test(String(id))) max = Math.max(max, parseInt(id, 10));
    });
    const seq = max + 1;
    counters[table] = seq;
    saveCounters();
    return String(seq);
}

// Tables the client may write. login_logs is intentionally NOT here: it is
// owned by the server (auth.php writes logins/logouts), so a browser copy
// must never be pushed back — that is what used to erase login history and
// reset "logoutTime" values.
const SYNC_TABLES = ['contacts', 'deals', 'tasks', 'notes', 'activity', 'taskActivity',
                     'departments', 'companies', 'roles', 'stages', 'users', 'files'];
// Immutable log tables: new rows are added, nothing is ever deleted/edited remotely.
const APPEND_ONLY = new Set(['activity', 'taskActivity']);

const SYNC_BASE_KEY = 'tms_sync_base';
const BACKUP_KEY = 'tms_backup_before_sync';

function tableRef(t) {
    switch (t) {
        case 'contacts': return contacts;
        case 'deals': return deals;
        case 'tasks': return tasks;
        case 'notes': return notes;
        case 'activity': return activity;
        case 'taskActivity': return taskActivity;
        case 'departments': return departments;
        case 'companies': return companies;
        case 'roles': return roles;
        case 'stages': return stages;
        case 'users': return users;
        case 'files': return files;
    }
    return [];
}

function setTable(t, arr) {
    switch (t) {
        case 'contacts': contacts = arr; break;
        case 'deals': deals = arr; break;
        case 'tasks': tasks = arr; break;
        case 'notes': notes = arr; break;
        case 'activity': activity = arr; break;
        case 'taskActivity': taskActivity = arr; break;
        case 'departments': departments = arr; break;
        case 'companies': companies = arr; break;
        case 'roles': roles = arr; break;
        case 'stages': stages = arr; break;
        case 'users': users = arr; break;
        case 'files': files = arr; break;
    }
}

// Same key the server uses: `id`, or `key` for stages.
function rowId(row) {
    if (!row || typeof row !== 'object') return null;
    const id = (row.id !== undefined && row.id !== null) ? row.id : row.key;
    return (id === undefined || id === null || id === '') ? null : String(id);
}

// Small 2x32-bit content hash — lets us store "what the server has" compactly
// in localStorage and tell which rows changed without keeping full copies.
function hashRow(row) {
    const s = JSON.stringify(row);
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = ((h1 * 33) ^ c) >>> 0;
        h2 = ((h2 * 31) + c) >>> 0;
    }
    return h1.toString(36) + h2.toString(36) + s.length.toString(36);
}

// syncBase = { table: { id: hash } } — what the server last confirmed.
// null means "this browser has never synced with the v2 protocol".
function loadSyncBase() {
    try {
        const b = JSON.parse(localStorage.getItem(SYNC_BASE_KEY));
        if (b && typeof b === 'object') return b;
    } catch {}
    return null;
}
function persistSyncBase() {
    try { localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(syncBase)); } catch {}
}
function buildSyncBase(src) {
    const base = {};
    SYNC_TABLES.forEach(t => {
        base[t] = {};
        (src[t] || []).forEach(row => { const id = rowId(row); if (id !== null) base[t][id] = hashRow(row); });
    });
    return base;
}
let syncBase = loadSyncBase();

// Counters only ever move forward: merge with max() and never let a smaller
// number replace a larger one (that is how ids got reused and rows overwritten).
function mergeCounters(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return;
    Object.keys(src).forEach(k => {
        counters[k] = Math.max(parseInt(counters[k], 10) || 0, parseInt(src[k], 10) || 0);
    });
}
// Also make sure no counter is below the highest numeric id already in its table.
function reconcileCounters() {
    SYNC_TABLES.forEach(t => {
        let max = 0;
        tableRef(t).forEach(row => {
            const id = rowId(row);
            if (id !== null && /^\d+$/.test(id)) max = Math.max(max, parseInt(id, 10));
        });
        if ((parseInt(counters[t], 10) || 0) < max) counters[t] = max;
    });
}

// Applies a { contacts, deals, ... } object (as returned by api.php)
// onto the in-memory tables AND mirrors it into localStorage, so the
// app is fully usable offline on the next load even without the server.
function applyDb(db, { mirrorToLocalStorage = true } = {}) {
    contacts = db.contacts || [];
    deals = db.deals || [];
    tasks = db.tasks || [];
    notes = db.notes || [];
    activity = db.activity || [];
    taskActivity = db.taskActivity || [];
    departments = db.departments || [];
    companies = db.companies || [];
    roles = (db.roles && db.roles.length) ? db.roles : loadRoles();
    stages = (db.stages && db.stages.length) ? db.stages : loadStages();
    users = db.users || [];
    files = db.files || [];
    loginLogs = db.login_logs || [];  // ← Load login logs
    mergeCounters(db.counters);
    reconcileCounters();

    // Base = exactly what the SERVER holds (not our in-memory arrays, which may
    // contain locally-seeded default roles/stages the server has not seen yet —
    // those must still be pushed).
    syncBase = buildSyncBase(db);

    if (mirrorToLocalStorage) {
        save('contacts', contacts);
        save('deals', deals);
        save('tasks', tasks);
        save('notes', notes);
        save('activity', activity);
        save('taskActivity', taskActivity);
        save('departments', departments);
        save('companies', companies);
        save('roles', roles);
        save('stages', stages);
        save('users', users);
        save('files', files);
        save('login_logs', loginLogs);  // ← Save login logs
        saveCounters();
        persistSyncBase();
    }
}

// ── Safety nets ──────────────────────────────────────────────

function countLocalRows() {
    return SYNC_TABLES.reduce((n, t) => n + tableRef(t).length, 0);
}

// If the server copy is much smaller than what this browser has cached (or this
// browser has never synced before), keep ONE rolling snapshot of the local cache
// before it is overwritten, so nothing is unrecoverable. Restore from the
// console with restoreLocalBackup().
function backupLocalIfShrinking(serverDb) {
    try {
        const localN = countLocalRows();
        const serverN = SYNC_TABLES.reduce((n, t) => n + ((serverDb[t] || []).length), 0);
        const shrinking = localN >= 10 && serverN < localN * 0.8;
        if (!(shrinking || (syncBase === null && localN > 0))) return;
        const prev = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
        if (prev && prev.rows > localN) return;   // keep the bigger (more complete) backup
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), rows: localN, db: currentDbSnapshot() }));
        console.warn(`TMS: server data (${serverN} rows) is smaller than this browser's cache (${localN} rows). ` +
                     `A backup of the local copy was saved; run restoreLocalBackup() in the console to push it back.`);
    } catch {}
}

// Manual recovery: loads the saved local backup and pushes every row back to the server.
function restoreLocalBackup() {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) { console.warn('TMS: no local backup found.'); return false; }
    const { db } = JSON.parse(raw);
    applyDb(db);
    syncBase = buildSyncBase({});   // empty base ⇒ every row counts as "changed" ⇒ all are pushed
    persistSyncBase();
    saveAll();
    return true;
}

// ── Change detection ─────────────────────────────────────────

// Compares memory with syncBase and returns only what the server needs:
// rows that are new/changed, and ids that were present at last sync but are
// now gone. `sent` remembers the hashes so we mark exactly these as synced
// afterwards (edits made while the request is in flight stay "pending").
function computeChanges() {
    const changes = {}, sent = {};
    let count = 0;
    SYNC_TABLES.forEach(t => {
        const base = (syncBase && syncBase[t]) || {};
        const latest = new Map();
        tableRef(t).forEach(row => { const id = rowId(row); if (id !== null) latest.set(id, row); });

        const upsert = [], created = [], hashes = {};
        latest.forEach((row, id) => {
            const h = hashRow(row);
            if (base[id] !== h) {
                upsert.push(row); hashes[id] = h;
                if (base[id] === undefined && !APPEND_ONLY.has(t)) created.push(id);   // brand-new row
            }
        });
        const del = APPEND_ONLY.has(t) ? [] : Object.keys(base).filter(id => !latest.has(id));

        if (upsert.length || del.length) {
            changes[t] = { upsert, created, delete: del };
            sent[t] = { hashes, deleted: del };
            count += upsert.length + del.length;
        }
    });
    return { changes, sent, count };
}

function markSynced(sent, conflicts) {
    if (!syncBase) syncBase = {};
    conflicts = conflicts || {};
    Object.keys(sent).forEach(t => {
        const b = syncBase[t] = syncBase[t] || {};
        const skip = new Set((conflicts[t] || []).map(String));
        Object.keys(sent[t].hashes).forEach(id => { if (!skip.has(id)) b[id] = sent[t].hashes[id]; });
        sent[t].deleted.forEach(id => { delete b[id]; });
    });
    persistSyncBase();
}

// Re-applies locally pending edits (captured before a reload) on top of fresh
// server data so a reload/reconnect never discards unsynced work.
function replayChanges(changes) {
    Object.keys(changes).forEach(t => {
        let arr = tableRef(t).slice();
        const del = new Set(changes[t].delete || []);
        if (del.size) arr = arr.filter(r => !del.has(rowId(r)));
        const created = new Set(changes[t].created || []);
        (changes[t].upsert || []).forEach(row => {
            const id = rowId(row);
            const idx = arr.findIndex(r => rowId(r) === id);
            if (idx >= 0 && created.has(id) && row.id !== undefined && hashRow(arr[idx]) !== hashRow(row)) {
                // Someone else already owns this id on the server: keep THEIR row and
                // give ours a fresh id instead of overwriting it.
                setTable(t, arr);
                const newId = nextId(t);
                console.warn(`TMS: id ${id} in "${t}" was taken by another user's record — saved yours as ${newId}.`);
                row.id = newId;
                arr.push(row);
            } else if (idx >= 0) {
                arr[idx] = row;
            } else {
                arr.push(row);
            }
        });
        setTable(t, arr);
    });
}

    // Parses an api.php response. If PHP printed a warning/notice before the JSON
    // (misconfigured host), recover the JSON part instead of failing the whole load.
    function parseApiResponse(text, status) {
        try { return JSON.parse(text); } catch {}
        const i = text.indexOf('{"ok"');
        if (i > 0) { try { return JSON.parse(text.slice(i)); } catch {} }
        throw new Error(`api.php did not return JSON (HTTP ${status}): ${text.slice(0, 200)}`);
    }

// ── Serialised network operations ────────────────────────────
// Loads and pushes run strictly one at a time. Previously overlapping saves
// could arrive out of order (older snapshot landing last) and a load could
// replace the arrays while a save was half-built.
let syncChain = Promise.resolve();
let pushQueued = false;
let retryTimer = null, retryDelay = 5000;

function enqueue(fn) {
    const p = syncChain.then(fn);
    syncChain = p.catch(() => {});
    return p;
}

function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (window._tmsLoaded) pushToServer(); else reloadAllData();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
}

async function doPush() {
    // Never push before one successful load: until then memory may just be a
    // stale localStorage copy, and pushing it was the original data-loss bug.
    if (!window._tmsLoaded) return false;
    const { changes, sent, count } = computeChanges();
    if (!count) return true;
    try {
        const payload = utf8ToBase64(JSON.stringify({ v: 2, changes, counters }));
        const form = new FormData();
        form.append('action', 'save');
        form.append('payload', payload);
        const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
        const text = await res.text();
        const out = parseApiResponse(text, res.status);
        if (!out || !out.ok) throw new Error((out && out.error) || 'save failed');
        const conflicts = out.conflicts && typeof out.conflicts === 'object' ? out.conflicts : {};
        markSynced(sent, conflicts);
        mergeCounters(out.counters);
        saveCounters();
        window._tmsServerOnline = true;
        retryDelay = 5000;
        if (Object.keys(conflicts).length) {
            // Server refused to overwrite someone else's rows. Pull their data and
            // re-save ours under new ids (see replayChanges). No flush, no loop.
            enqueue(() => doLoad({ flush: false }));
        }
        return true;
    } catch (err) {
        window._tmsServerOnline = false;
        console.warn('TMS: could not save to api.php this time — change is kept locally and will be retried.', err);
        scheduleRetry();
        return false;
    }
}

async function doLoad({ flush = true } = {}) {
    try {
        // Send anything still pending first, so the server copy we fetch includes it.
        if (flush && window._tmsLoaded) await doPush();

        const res = await fetch(`${API_ENDPOINT}?action=load`, { cache: 'no-store' });
        const text = await res.text();
        const out = parseApiResponse(text, res.status);
        if (!out || !out.ok || !out.db || !Array.isArray(out.db.contacts)) {
            throw new Error((out && out.error) || 'Unexpected response from api.php');
        }

        // Unsynced local edits (made offline / before this load finished).
        const pending = syncBase ? computeChanges() : null;

        backupLocalIfShrinking(out.db);
        applyDb(out.db);
        window._tmsLoaded = true;
        window._tmsServerOnline = true;
        retryDelay = 5000;
        console.log('TMS: connected to SQLite database (api.php).');

        if (pending && pending.count) {
            replayChanges(pending.changes);
            saveAll();            // mirrors locally + queues the push
        }
        return true;
    } catch (err) {
        window._tmsServerOnline = false;
        window._tmsLastError = String(err && err.message || err);
        console.error('TMS: could not load from api.php — showing cached local data only; nothing is pushed until a load succeeds. Reason:', err);
        scheduleRetry();
        return false;
    }
}

// Fetches the full database from the server (SQLite). On the very first run
// api.php creates and seeds the tables once. Called at startup (see init.js).
function initDB() { return enqueue(() => doLoad()); }

// Re-fetches the database from the server (manual sync, Socket.IO reconnect, ...).
// Pending local edits are pushed first and re-applied afterwards.
function reloadAllData() { return enqueue(() => doLoad()); }

// Fire-and-forget: localStorage has already been updated synchronously by
// saveAll(), so the UI never waits on this. Multiple calls coalesce into one push.
function pushToServer() {
    if (pushQueued) return syncChain;
    pushQueued = true;
    return enqueue(() => { pushQueued = false; return doPush(); });
}

function saveAll() {
    save('contacts', contacts);
    save('deals', deals);
    save('tasks', tasks);
    save('notes', notes);
    save('activity', activity);
    save('taskActivity', taskActivity);
    save('departments', departments);
    save('companies', companies);
    save('roles', roles);
    save('stages', stages);
    save('users', users);
    save('files', files);
    save('login_logs', loginLogs);  // ← Save login logs
    saveCounters();
    pushToServer();
}

window.addEventListener('online', () => {
    if (window._tmsLoaded) pushToServer(); else reloadAllData();
});

// ── Public API (the ONLY globals this sync layer adds) ───────────────────
window.nextId = nextId;
window.applyDb = applyDb;
window.initDB = initDB;
window.reloadAllData = reloadAllData;
window.pushToServer = pushToServer;
window.saveAll = saveAll;
window.restoreLocalBackup = restoreLocalBackup;
window.tmsWhenSynced = function () { return syncChain; };   // resolves when queued loads/saves finish
})();