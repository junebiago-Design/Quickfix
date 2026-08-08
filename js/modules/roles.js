// ══════════════════════════════════════════════
//  ROLES — js/modules/roles.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  ROLES
// ══════════════════════════════════════════════

function openRoleModal(id) {
    if (isEmployee()) return;
    editingId = id || null;
    const r = id ? roles.find(x => x.id === id) : null;
    document.getElementById('role-modal-title').textContent = r ? 'Edit Role' : 'Add Role';
    document.getElementById('role-name').value = r?.name || '';
    document.getElementById('role-desc').value = r?.desc || '';
    document.getElementById('role-status').value = r?.status || 'active';

    // ✅ Global Task-page capability, not a per-stage permission — see
    // canAddStage() in kanban.js. System Administrator always has it, so
    // the checkbox is forced on and locked for that row.
    const canAddStageEl = document.getElementById('role-can-add-stage');
    if (canAddStageEl) {
        const isSystemRole = id === SYSTEM_ROLE_ID;
        canAddStageEl.checked = isSystemRole ? true : !!r?.canAddStage;
        canAddStageEl.disabled = isSystemRole;
    }

    // ✅ Role inheritance (RBAC). Optional in the DOM — only wired up if
    // an #role-inherits-from <select> exists in index.html, so this is
    // safe to load even before that markup is added. The built-in System
    // Administrator role can't inherit from anything (it's the root), and
    // a role can't inherit from itself.
    const inheritSel = document.getElementById('role-inherits-from');
    if (inheritSel) {
        const isSystemRole = id === SYSTEM_ROLE_ID;
        inheritSel.innerHTML = '<option value="">— None —</option>' +
            roles.filter(x => x.id !== id).map(x =>
                `<option value="${x.id}" ${r?.inheritsFrom === x.id ? 'selected' : ''}>${x.name}</option>`
            ).join('');
        inheritSel.value = r?.inheritsFrom || '';
        inheritSel.disabled = isSystemRole;
    }

    openModal('role-modal');
}

function saveRole() {
    if (isEmployee()) return;
    const name = document.getElementById('role-name').value.trim();
    if (!name) { toast('Role name is required.', 'error'); return; }

    // A role can't inherit from itself or introduce a cycle.
    let inheritsFrom = document.getElementById('role-inherits-from')?.value || '';
    if (editingId && inheritsFrom) {
        if (inheritsFrom === editingId) {
            toast('A role cannot inherit from itself.', 'error');
            return;
        }
        if (wouldCreateInheritanceCycle(editingId, inheritsFrom)) {
            toast('That would create a circular role inheritance chain.', 'error');
            return;
        }
    }

    const obj = {
        id: editingId || uid(),
        name,
        desc: document.getElementById('role-desc').value.trim(),
        status: document.getElementById('role-status').value,
        inheritsFrom: editingId === SYSTEM_ROLE_ID ? '' : inheritsFrom,
        canAddStage: editingId === SYSTEM_ROLE_ID ? true : !!document.getElementById('role-can-add-stage')?.checked,
        createdAt: editingId ? (roles.find(r => r.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
    };


    if (editingId) {
        const prev = roles.find(r => r.id === editingId);
        roles = roles.map(r => r.id === editingId ? obj : r);
        logActivity(`Edited role <strong>${name}</strong>`, 'yellow');
        if ((prev?.inheritsFrom || '') !== (obj.inheritsFrom || '')) {
            const fromName = obj.inheritsFrom ? getRoleName(obj.inheritsFrom) : 'None';
            logActivity(`Changed inheritance for role <strong>${name}</strong> to <strong>${fromName}</strong>`, 'purple');
        }
        if (!!prev?.canAddStage !== !!obj.canAddStage) {
            logActivity(`${obj.canAddStage ? 'Granted' : 'Revoked'} Add Stage permission for role <strong>${name}</strong>`, 'purple');
        }
        toast('Role updated.', 'success');
    } else {
        roles.unshift(obj);
        logActivity(`Added role <strong>${name}</strong>`, 'accent');
        toast('Role added.', 'success');
    }
    saveAll();
    closeModal('role-modal');
    renderRoles();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function deleteRole(id) {
    if (isEmployee()) return;
    if (id === SYSTEM_ROLE_ID) {
        toast('This is a built-in system role and cannot be deleted.', 'error');
        return;
    }
    const r = roles.find(x => x.id === id);
    const childRoles = roles.filter(x => x.inheritsFrom === id);
    if (childRoles.length) {
        toast(`Cannot delete "${r?.name}" — ${childRoles.map(c => c.name).join(', ')} inherit${childRoles.length === 1 ? 's' : ''} permissions from it. Change their inheritance first.`, 'error');
        return;
    }
    const assignedCount = contacts.filter(c => c.role === id).length;

    if (assignedCount > 0) {
        confirmDelete(
            `"${r?.name}" is assigned to ${assignedCount} employee${assignedCount > 1 ? 's' : ''}. Delete anyway and mark ${assignedCount > 1 ? 'them' : 'that employee'} as Unassigned?`,
            () => {
                contacts = contacts.map(c => c.role === id ? { ...c, role: '' } : c);
                roles = roles.filter(x => x.id !== id);
                logActivity(`Deleted role <strong>${r?.name}</strong>`, 'red');
                saveAll();
                toast('Role deleted. Affected employees marked as Unassigned.');
                renderRoles();
                renderContacts();
                updateBadges();
                if (currentPage === 'dashboard') renderDashboard();
            }
        );
        return;
    }

    confirmDelete(`Delete role "${r?.name}"?`, () => {
        roles = roles.filter(x => x.id !== id);
        logActivity(`Deleted role <strong>${r?.name}</strong>`, 'red');
        saveAll();
        toast('Role deleted.');
        renderRoles();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

function renderRoles() {
    const q = document.getElementById('role-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('role-filter-status')?.value || '';

    let list = roles.filter(r => r.name.toLowerCase().includes(q) && (!filt || r.status === filt));

    const tbody = document.getElementById('roles-tbody');
    if (!list.length) {
        tbody.innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><h3>No roles found</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(r => {
        const empCount = contacts.filter(c => c.role === r.id).length;
        const isSystem = r.id === SYSTEM_ROLE_ID;
        return `
    <tr>
      <td><span class="td-name">${r.name}</span> ${isSystem ? `<span title="Built-in role — cannot be deleted, bypasses all filters" style="margin-left:6px;font-size:0.65rem;padding:1px 6px;border-radius:10px;background:var(--accent-soft, rgba(99,102,241,0.12));color:var(--text2);white-space:nowrap;">🔒 System</span>` : ''}</td>
      <td>${r.desc || '—'}</td>
      <td>${empCount}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="icon-btn" onclick="openRoleModal('${r.id}')">✎</button>
          ${isSystem ? `<button class="icon-btn" disabled title="Built-in role — cannot be deleted" style="opacity:0.4;cursor:not-allowed;">🔒</button>` : `<button class="icon-btn danger" onclick="deleteRole('${r.id}')">🗑</button>`}
        </div>
      </td>
    </tr>
  `;
    }).join('');
}

// ══════════════════════════════════════════════
//  ROLE INHERITANCE — source of truth for stage-based RBAC.
//  Consumed by permissions.js (which resolves per-stage permission
//  checks) and by the Stage Permission modal (which needs a role list
//  and per-role inheritance chain to render the matrix).
// ══════════════════════════════════════════════

function getRoles() {
    return roles;
}

function getRoleById(id) {
    return roles.find(r => r.id === id) || null;
}

// True for the built-in System Administrator role, or when no roleId is
// passed and the signed-in user holds it — full access to everything,
// unconditionally, everywhere.
function isSystemAdministrator(roleId) {
    const rid = roleId || currentUser?.role;
    return rid === SYSTEM_ROLE_ID || rid === 'admin';
}

// True for a role literally named "Administrator", or any role whose
// inheritance chain resolves back to System Administrator.
function isAdministrator(roleId) {
    const rid = roleId || currentUser?.role;
    if (!rid) return false;
    if (isSystemAdministrator(rid)) return true;
    const role = getRoleById(rid);
    if (role && (role.name || '').trim().toLowerCase() === 'administrator') return true;
    return getRoleInheritanceChainSafe(rid).includes(SYSTEM_ROLE_ID);
}

// Local, dependency-order-safe copy of the chain walk (permissions.js
// defines the canonical getRoleInheritanceChain — this just guards
// against roles.js being loaded before permissions.js).
function getRoleInheritanceChainSafe(roleId) {
    if (typeof getRoleInheritanceChain === 'function') return getRoleInheritanceChain(roleId);
    const chain = [];
    const seen = new Set();
    let current = roleId;
    while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        current = getRoleById(current)?.inheritsFrom || null;
    }
    return chain;
}

// Would setting `roleId`.inheritsFrom = `newParentId` create a cycle?
// (e.g. A inherits B, B inherits A). Walks newParentId's existing chain
// looking for roleId.
function wouldCreateInheritanceCycle(roleId, newParentId) {
    if (!newParentId) return false;
    let current = newParentId;
    const seen = new Set();
    while (current && !seen.has(current)) {
        if (current === roleId) return true;
        seen.add(current);
        current = getRoleById(current)?.inheritsFrom || null;
    }
    return false;
}

// Rolls up what a role can do on a given stage across all five
// permission types, honoring inheritance — a convenience summary for UI
// (e.g. a role detail panel). Real enforcement always goes through
// hasStagePermission() in permissions.js, not this rollup.
function getInheritedPermissions(roleId, stageKey) {
    if (typeof stages === 'undefined') return null;
    const stage = stages.find(s => s.key === stageKey);
    if (!stage || typeof hasStagePermission !== 'function') return null;
    const result = {};
    STAGE_PERMISSION_TYPES.forEach(p => { result[p] = hasStagePermission(stage, roleId, p); });
    return result;
}

