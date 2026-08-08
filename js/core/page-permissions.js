// ══════════════════════════════════════════════
//  PAGE PERMISSIONS — js/core/page-permissions.js
//  Sidebar/Navigation-level Role-Based Access Control.
//
//  This is the exact same pattern as permissions.js's Stage-Based RBAC
//  (role inheritance chain, first explicit true/false wins, legacy/
//  unconfigured = open), just applied to sidebar NAV PAGES instead of
//  Kanban stages:
//
//    Stage RBAC   -> stage.permissions[roleId][grab|drop|edit|...]
//    Page RBAC    -> role.pageAccess[pageKey]  (boolean)
//
//  One deliberate difference from the stage engine: an unconfigured page
//  is LOCKED DOWN by default (false), not open. New or custom roles see
//  nothing beyond Dashboard/My Profile until an admin explicitly checks
//  a box for them on the Page Access screen.
//
//  It replaces the old hardcoded rule in session.js's renderNavigation()
//  (`if (currentUser.role === 'employee') hide these 5 pages`) with a
//  configurable-per-role matrix, editable from the new "Page Access"
//  sidebar page (see index.html #page-page-access + roles.js wiring).
//
//  Depends on: roles.js / permissions.js (getRoleById, getRoleById,
//  getRoleInheritanceChain, isSystemAdmin, SYSTEM_ROLE_ID), globals for
//  `roles`, `currentUser`. Load AFTER permissions.js and roles.js, and
//  BEFORE navigation.js (renderNavigation() calls hasPageAccess()).
// ══════════════════════════════════════════════

// Every restrictable sidebar page, in the same order they render in the
// sidebar. Keys must match `data-page` in index.html and the `pages`
// object in navigation.js.
const NAV_PAGES = [
    { key: 'deals', label: 'Task' },
     { key: 'employee-directory', label: 'Employee Directory' }, 
    { key: 'contacts', label: 'Employee' },
    { key: 'departments', label: 'Departments' },
    { key: 'companies', label: 'Companies' },
    { key: 'roles', label: 'Roles' },
    { key: 'users', label: 'Users' },
    { key: 'tasks', label: 'Announcement' },
    { key: 'notes', label: 'Notes' },
    { key: 'task-activity', label: 'Task Activity' },
    { key: 'login-monitoring', label: 'Login Monitoring' }
    
];

// Always visible to any logged-in user, regardless of role config —
// there's no meaningful way to "lock a user out" of their own landing
// page or profile.
const ALWAYS_VISIBLE_PAGES = ['dashboard', 'profile'];

// The Page Access matrix itself is hard-restricted to System
// Administrator, exactly like attachment deletion in attachments.js
// (canDeleteAttachment() checks isSystemAdmin() directly and never
// consults a configurable map) — otherwise a role could grant itself
// more access.
const PAGE_ACCESS_ADMIN_ONLY_PAGE = 'page-access';

// Core resolver. Can `roleId` see `pageKey` in the sidebar / navigate to
// it directly? Walks the role's inheritance chain (self -> parent -> …)
// and uses the first explicit true/false found on role.pageAccess.
// Unlike hasStagePermission()'s "legacy stage" fallback, an unconfigured
// page is LOCKED DOWN (false) by default — new/custom roles see nothing
// beyond dashboard and their own profile until an admin explicitly
// grants access from the Page Access screen. Only System Administrator
// bypasses this.
function hasPageAccess(pageKey, roleId) {
    const rid = roleId || getCurrentUserRoleId();

    if (ALWAYS_VISIBLE_PAGES.includes(pageKey)) return true;
    if (isSystemAdmin(rid)) return true;
    if (pageKey === PAGE_ACCESS_ADMIN_ONLY_PAGE) return false;

    const chain = getRoleInheritanceChain(rid);
    for (const r of chain) {
        const role = getRoleById(r);
        const entry = role?.pageAccess?.[pageKey];
        if (typeof entry === 'boolean') return entry;
    }
    return false; // locked down until an admin explicitly grants access
}

// Rolls up page access for every known role — exactly what the Page
// Access matrix table needs, mirroring buildStagePermissionMatrix() in
// permissions.js.
function buildPageAccessMatrix() {
    if (typeof roles === 'undefined') return [];
    return roles.map(r => {
        const row = { roleId: r.id, roleName: r.name, inheritsFrom: r.inheritsFrom || '', isSystem: r.id === SYSTEM_ROLE_ID };
        NAV_PAGES.forEach(p => { row[p.key] = hasPageAccess(p.key, r.id); });
        return row;
    });
}

// ✅ Unsaved-edit tracking. navigate('page-access') re-renders this page
// a moment after the initial paint once its background reloadAllData()
// call resolves, and the 5s auto-refresh poll (session.js) does the same
// for whichever page is currently active. Both used to rebuild every
// checkbox straight from saved role data — silently reverting anything
// you'd unchecked but not yet saved. pendingPageAccessEdits holds your
// in-progress toggles so re-renders show them instead, until Save
// (which clears it) or you navigate away (also cleared, so a stale
// edit can't leak into your next visit).
let pendingPageAccessEdits = {}; // roleId -> { pageKey: bool }

// Renders the matrix into #page-access-tbody (built dynamically since
// the column set — NAV_PAGES — is defined in JS, not static markup).
function renderPageAccessMatrix() {
    const thead = document.getElementById('page-access-thead');
    const tbody = document.getElementById('page-access-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '<tr><th>Role</th>' + NAV_PAGES.map(p => `<th>${p.label}</th>`).join('') + '</tr>';

    const matrix = buildPageAccessMatrix();
    if (!matrix.length) {
        tbody.innerHTML = `<tr><td colspan="${NAV_PAGES.length + 1}"><div class="empty-state"><h3>No roles yet</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = matrix.map(row => {
        const cells = NAV_PAGES.map(p => {
            const pending = pendingPageAccessEdits[row.roleId]?.[p.key];
            const isChecked = typeof pending === 'boolean' ? pending : row[p.key];
            const checked = isChecked ? 'checked' : '';
            const disabled = row.isSystem ? 'disabled' : '';
            return `<td style="text-align:center;"><input type="checkbox" data-role="${row.roleId}" data-page="${p.key}" ${checked} ${disabled}></td>`;
        }).join('');
        const sysBadge = row.isSystem
            ? ` <span title="System Administrator always sees every page" style="margin-left:6px;font-size:0.65rem;padding:1px 6px;border-radius:10px;background:var(--accent-soft, rgba(99,102,241,0.12));color:var(--text2);white-space:nowrap;">🔒 Full Access</span>`
            : '';
        return `<tr><td><span class="td-name">${row.roleName}</span>${sysBadge}</td>${cells}</tr>`;
    }).join('');

    // Delegated listener, bound once per tbody element (innerHTML
    // rebuilds above replace the checkboxes but not the tbody itself,
    // so this survives re-renders without stacking duplicate handlers).
    if (!tbody.dataset.paBound) {
        tbody.addEventListener('change', e => {
            const cb = e.target;
            if (!cb.matches('input[type="checkbox"][data-role]')) return;
            const rid = cb.dataset.role;
            const page = cb.dataset.page;
            if (!pendingPageAccessEdits[rid]) pendingPageAccessEdits[rid] = {};
            pendingPageAccessEdits[rid][page] = cb.checked;
        });
        tbody.dataset.paBound = '1';
    }
}

// Reads the checkbox grid, writes role.pageAccess for every non-system
// role, persists, and re-renders the sidebar in case the change affects
// the currently signed-in user's own role.
function savePageAccess() {
    if (!isSystemAdmin()) { toast('Only the System Administrator can change page access.', 'error'); return; }

    const boxes = document.querySelectorAll('#page-access-tbody input[type="checkbox"][data-role]');
    const updates = {}; // roleId -> { pageKey: bool }
    boxes.forEach(cb => {
        const rid = cb.dataset.role;
        const page = cb.dataset.page;
        if (!updates[rid]) updates[rid] = {};
        updates[rid][page] = cb.checked;
    });

    roles = roles.map(r => {
        if (r.id === SYSTEM_ROLE_ID || !updates[r.id]) return r;
        return { ...r, pageAccess: { ...(r.pageAccess || {}), ...updates[r.id] } };
    });

    pendingPageAccessEdits = {}; // now matches saved data — stop overriding renders

    saveAll();
    logActivity('Updated page access permissions', 'purple');
    toast('Page access updated.', 'success');


    renderPageAccessMatrix();
    if (typeof renderNavigation === 'function') renderNavigation();
}
