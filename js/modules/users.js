// ══════════════════════════════════════════════
//  USERS — js/modules/users.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════

function openUserModal(id, presetEmployeeId) {
    if (isEmployee()) return;
    editingId = id || null;
    const u = id ? users.find(x => x.id === id) : null;
    // "Enrolling" = opened from the Employee page's new "Enroll User"
    // button (contacts.js), for a brand-new user tied to that specific
    // employee — as opposed to "Register User" on the Users page, which
    // can make a standalone account with no employee link at all.
    const enrolling = !editingId && !!presetEmployeeId;
    document.getElementById('user-modal-title').textContent = u ? 'Edit User' : (enrolling ? 'Enroll User' : 'Register User');
    document.getElementById('user-username').value = u?.username || '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').placeholder = u ? 'Leave blank to keep current password' : '';
    document.getElementById('user-status').value = u?.status || 'active';

    const employeeSel = document.getElementById('user-employee');
    const roleSel = document.getElementById('user-role');

    populateContactSelect(employeeSel, u?.employeeId || presetEmployeeId || '');
    // ✅ Enrolling a specific employee pins the link — this modal can't be
    // used to retarget it to someone else. Register User (no preset) can
    // still freely pick (or skip) an employee.
    employeeSel.disabled = enrolling;

    // ✅ A user account linked to an employee always mirrors that
    // employee's Contact role — the User form's role field is a read-only
    // reflection of it here, not an independent setting, so the two can
    // never drift apart. Re-syncs whenever the linked employee changes
    // (including live, if picked from the Users page's own dropdown).
    // Only a standalone account with no linked employee gets a freely
    // editable role.
    function syncRoleToEmployee() {
        const linkedId = employeeSel.value;
        const linkedContact = linkedId ? contacts.find(c => c.id === linkedId) : null;

        // System Administrator is never offered when enrolling a specific
        // employee from the Employee page — only the Users page can grant
        // it, and only to someone who already holds it themselves. Never
        // yanked out from under a record that already has it, though, so
        // editing an existing System Administrator doesn't silently lose
        // the option that describes their own current role.
        const currentIsSystemAdmin = (typeof isSystemAdministrator === 'function') && isSystemAdministrator();
        const keepSystemAdminOption = (u?.role === SYSTEM_ROLE_ID) || (!enrolling && currentIsSystemAdmin);

        populateRoleSelect(roleSel, linkedContact ? linkedContact.role : (u?.role || ''));
        if (!keepSystemAdminOption) {
            const opt = roleSel.querySelector(`option[value="${SYSTEM_ROLE_ID}"]`);
            if (opt) opt.remove();
        }

        if (linkedContact) {
            roleSel.value = linkedContact.role || '';
            roleSel.disabled = true;
        } else {
            roleSel.disabled = false;
        }
    }

    syncRoleToEmployee();
    employeeSel.onchange = syncRoleToEmployee;

    openModal('user-modal');
}

function saveUser() {
    if (isEmployee()) return;
    const username = document.getElementById('user-username').value.trim();
    if (!username) { toast('Username is required.', 'error'); return; }

    const existing = editingId ? users.find(u => u.id === editingId) : null;
    const newPassword = document.getElementById('user-password').value;
    if (!editingId && !newPassword) { toast('Password is required.', 'error'); return; }

    const obj = {
        id: editingId || uid(),
        username,
        password: newPassword ? newPassword : (existing?.password || ''),
        employeeId: document.getElementById('user-employee').value,
        role: document.getElementById('user-role').value,
        status: document.getElementById('user-status').value,
        createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (editingId) {
        users = users.map(u => u.id === editingId ? obj : u);
        logActivity(`Edited user <strong>${username}</strong>`, 'yellow');
        toast('User updated.', 'success');
    } else {
        users.unshift(obj);
        logActivity(`Registered user <strong>${username}</strong>`, 'accent');
        toast('User registered.', 'success');
    }
    saveAll();
    closeModal('user-modal');
    renderUsers();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function deleteUser(id) {
    if (isEmployee()) return;
    const u = users.find(x => x.id === id);
    confirmDelete(`Delete user "${u?.username}"?`, () => {
        users = users.filter(x => x.id !== id);
        logActivity(`Deleted user <strong>${u?.username}</strong>`, 'red');
        saveAll();
        toast('User deleted.');
        renderUsers();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

function renderUsers() {
    const q = document.getElementById('user-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('user-filter-status')?.value || '';

    let list = users.filter(u => u.username.toLowerCase().includes(q) && (!filt || u.status === filt));

    const tbody = document.getElementById('users-tbody');
    if (!list.length) {
        tbody.innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="es-icon">🔑</span><h3>No users found</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(u => `
    <tr>
      <td><span class="td-name">${u.username}</span></td>
      <td>${u.employeeId ? getContactName(u.employeeId) : '—'}</td>
      <td>${getRoleName(u.role)}</td>
      <td>${statusBadge(u.status)}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="icon-btn" onclick="openUserModal('${u.id}')">✎</button>
          <button class="icon-btn danger" onclick="deleteUser('${u.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

