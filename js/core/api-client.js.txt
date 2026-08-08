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
function nextId(table) {
    const seq = (parseInt(counters[table], 10) || 0) + 1;
    counters[table] = seq;
    saveCounters();
    return String(seq);
}

// ── localStorage cache (instant, synchronous, offline-safe) ──
function load(key) {
    try { return JSON.parse(localStorage.getItem(DB_KEYS[key])) || []; } catch { return []; }
}

function save(key, data) {
    localStorage.setItem(DB_KEYS[key], JSON.stringify(data));
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
//  SERVER SYNC (SQLite via api.php)
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
    counters = db.counters || counters;

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
    }
}

// Fetches the full database from the server (SQLite). On the very
// first run (no tables exist yet), api.php creates and seeds them
// before responding, so seeding happens automatically on first load.
// Called once at startup (see init.js) and can be called manually
// (e.g., when re‑establishing a connection after a socket drop).
async function initDB() {
    try {
        const res = await fetch(`${API_ENDPOINT}?action=load`, { cache: 'no-store' });
        const out = await res.json();
        if (!out || !out.ok || !out.db) throw new Error('Unexpected response from api.php');
        applyDb(out.db);
        window._tmsServerOnline = true;
        console.log('TMS: connected to SQLite database (api.php).');
    } catch (err) {
        window._tmsServerOnline = false;
        console.warn('TMS: api.php unreachable — running on local (localStorage) data only.', err);
        // contacts/deals/etc. were already populated synchronously from
        // localStorage above, so the app remains fully usable.
    }
}

// Re‑fetches the database from the server. Used for manual sync
// (e.g., after a Socket.IO reconnect) or when the user explicitly
// reloads the page. No longer called automatically by a timer.
async function reloadAllData() {
    try {
        const res = await fetch(`${API_ENDPOINT}?action=load`, { cache: 'no-store' });
        const out = await res.json();
        if (!out || !out.ok || !out.db) throw new Error('Unexpected response from api.php');
        applyDb(out.db);
        window._tmsServerOnline = true;
    } catch (err) {
        window._tmsServerOnline = false;
        contacts = load('contacts');
        deals = load('deals');
        tasks = load('tasks');
        notes = load('notes');
        activity = load('activity');
        departments = load('departments');
        companies = load('companies');
        roles = loadRoles();
        stages = loadStages();
        users = load('users');
        files = load('files');
        loginLogs = load('login_logs');  // ← Reload login logs from localStorage
        counters = loadCounters();
    }
}

// Pushes the full in-memory state to the server so it's written to
// the SQLite database. Sent as multipart/form-data with the JSON payload
// base64-encoded inside a normal form field (NOT a raw JSON body) —
// this dodges shared-hosting WAFs (seen on InfinityFree) that flag
// raw '{"' patterns in POST bodies. Fire-and-forget: localStorage has
// already been updated synchronously by saveAll(), so the UI never
// waits on this network round trip.
async function pushToServer() {
    try {
        const payload = utf8ToBase64(JSON.stringify({ db: currentDbSnapshot() }));
        const form = new FormData();
        form.append('action', 'save');
        form.append('payload', payload);
        const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
        const out = await res.json();
        if (!out || !out.ok) throw new Error((out && out.error) || 'save failed');
        window._tmsServerOnline = true;
    } catch (err) {
        window._tmsServerOnline = false;
        console.warn('TMS: could not save to api.php this time — data is still safe in localStorage.', err);
    }
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