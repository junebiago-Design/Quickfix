// ══════════════════════════════════════════════
//  HELPERS — js/modules/helpers.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
    return fmtDate(iso);
}

// ✅ activity.js's renderActivityList() looks for fmtRelativeTime()
// specifically (falling back to a plain fmtDate() if it's missing, which
// is why Recent Activity was showing full dates instead of "just now" /
// "5m ago" / etc.). Same relative-time logic as fmtShortDate above —
// aliased under the name activity.js expects.
function fmtRelativeTime(iso) {
    return fmtShortDate(iso);
}

function initials(name) {
    return (name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function statusBadge(s) {
    return `<span class="badge badge-${s}">${s}</span>`;
}

function priorityBadge(p) {
    return `<span class="badge badge-${p}">${p}</span>`;
}

function avatarEl(name) {
    return `<div class="avatar">${initials(name)}</div>`;
}

function getContactName(id) {
    const c = contacts.find(x => x.id === id);
    return c ? `${c.fname} ${c.lname}` : '—';
}

function getDepartmentName(id) {
    const d = departments.find(x => x.id === id);
    return d ? d.name : '—';
}

function getCompanyName(id) {
    const c = companies.find(x => x.id === id);
    return c ? c.name : '—';
}

function getRoleName(id) {
    const r = roles.find(x => x.id === id);
    return r ? r.name : 'Unassigned';
}

function populateRoleSelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— Select —</option>' +
        roles.map(r => `<option value="${r.id}" ${selected === r.id ? 'selected' : ''}>${r.name}</option>`)
        .join('');
    if (selected && !roles.find(r => r.id === selected)) {
        selectEl.insertAdjacentHTML('beforeend', `<option value="${selected}" selected>${selected} (legacy)</option>`);
    }
}

function populateDepartmentSelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— Select —</option>' +
        departments.map(d => `<option value="${d.id}" ${selected === d.id ? 'selected' : ''}>${d.name}</option>`)
        .join('');
    if (selected && !departments.find(d => d.id === selected)) {
        selectEl.insertAdjacentHTML('beforeend', `<option value="${selected}" selected>${selected} (legacy)</option>`);
    }
}

function populateContactSelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— Select —</option>' +
        contacts.map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${c.fname} ${c.lname}</option>`)
        .join('');
    if (selected && !contacts.find(c => c.id === selected)) {
        selectEl.insertAdjacentHTML('beforeend', `<option value="${selected}" selected>${selected} (legacy)</option>`);
    }
}

// When an employee's Department is chosen in the Add/Edit Employee modal,
// auto-fill the Company field from that department's linked company —
// this is what actually "connects" employee -> department -> company,
// so an employee counts under the right company even if picked via department.
function syncContactCompanyFromDepartment() {
    const depSel = document.getElementById('c-department');
    const compSel = document.getElementById('c-company');
    if (!depSel || !compSel) return;
    const dep = departments.find(d => d.id === depSel.value);
    if (dep && dep.companyId) {
        compSel.value = dep.companyId;
    }
}

function populateCompanySelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— Select —</option>' +
        companies.map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${c.name}</option>`).join(
        '');
    if (selected && !companies.find(c => c.id === selected)) {
        selectEl.insertAdjacentHTML('beforeend', `<option value="${selected}" selected>${selected} (legacy)</option>`);
    }
}

// ══════════════════════════════════════════════
//  DUPLICATE VALIDATION HELPERS
// ══════════════════════════════════════════════

function isCompanyNameTaken(name, excludeId) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return companies.some(c => c.name.trim().toLowerCase() === lower && c.id !== excludeId);
}

function isDepartmentNameTaken(name, excludeId) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return departments.some(d => d.name.trim().toLowerCase() === lower && d.id !== excludeId);
}

function isRoleNameTaken(name, excludeId) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return roles.some(r => r.name.trim().toLowerCase() === lower && r.id !== excludeId);
}

function isContactEmailTaken(email, excludeId) {
    const trimmed = email.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return contacts.some(c => c.email.trim().toLowerCase() === lower && c.id !== excludeId);
}

/**
 * Check if a contact's full name (first + last) is already taken.
 * Case‑insensitive, trims whitespace, excludes the current record when editing.
 */
function isContactNameTaken(fname, lname, excludeId) {
    const trimmedF = fname.trim();
    const trimmedL = lname.trim();
    if (!trimmedF || !trimmedL) return false;
    const lowerFull = `${trimmedF} ${trimmedL}`.toLowerCase();
    return contacts.some(c => {
        const full = `${c.fname.trim()} ${c.lname.trim()}`.toLowerCase();
        return full === lowerFull && c.id !== excludeId;
    });
}

function isDealTitleTaken(title, excludeId) {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return deals.some(d => d.title.trim().toLowerCase() === lower && d.id !== excludeId);
}

function isUsernameTaken(username, excludeId) {
    const trimmed = username.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return users.some(u => u.username.trim().toLowerCase() === lower && u.id !== excludeId);
}

/**
 * Check if a given employee already has a user account linked.
 */
function employeeHasUser(employeeId) {
    if (!employeeId) return false;
    return users.some(u => u.employeeId === employeeId);
}