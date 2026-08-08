// ══════════════════════════════════════════════
//  CONTACTS (EMPLOYEES) — js/modules/contacts.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════════════

function openContactModal(id) {
    if (isEmployee()) return;
    editingId = id || null;
    const c = id ? contacts.find(x => x.id === id) : null;
    document.getElementById('contact-modal-title').textContent = c ? 'Edit Employee' : 'Add Employee';
    document.getElementById('c-fname').value = c?.fname || '';
    document.getElementById('c-lname').value = c?.lname || '';
    document.getElementById('c-mname').value = c?.mname || '';
    document.getElementById('c-email').value = c?.email || '';
    document.getElementById('c-phone').value = c?.phone || '';
    populateCompanySelect(document.getElementById('c-company'), c?.company || '');
    populateDepartmentSelect(document.getElementById('c-department'), c?.department || '');

    // ✅ System Administrator is never offered here — an employee's
    // Contact role feeds a linked User account's role (users.js's
    // openUserModal#syncRoleToEmployee), and per the same rule applied
    // there, only the Users page can grant System Administrator (and
    // only to someone who already holds it). Never yanked out from under
    // a Contact record that already has it, though, so editing an
    // existing System Administrator's employee record doesn't silently
    // lose the option describing their own current role.
    const roleSel = document.getElementById('c-role');
    populateRoleSelect(roleSel, c?.role || '');
    if (c?.role !== SYSTEM_ROLE_ID) {
        const opt = roleSel.querySelector(`option[value="${SYSTEM_ROLE_ID}"]`);
        if (opt) opt.remove();
    }

    document.getElementById('c-status').value = c?.status || 'active';
    openModal('contact-modal');
}

function saveContact() {
    if (isEmployee()) return;
    const fname = document.getElementById('c-fname').value.trim();
    const lname = document.getElementById('c-lname').value.trim();
    const email = document.getElementById('c-email').value.trim();
    if (!fname || !lname || !email) { toast('Please fill required fields.', 'error'); return; }

    const obj = {
        id: editingId || uid(),
        fname,
        lname,
        mname: document.getElementById('c-mname').value.trim(),
        email,
        phone: document.getElementById('c-phone').value.trim(),
        company: document.getElementById('c-company').value.trim(),
        department: document.getElementById('c-department').value,
        role: document.getElementById('c-role').value,
        status: document.getElementById('c-status').value,
        createdAt: editingId ? (contacts.find(c => c.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
    };

    if (editingId) {
        contacts = contacts.map(c => c.id === editingId ? obj : c);
        logActivity(`Edited employee <strong>${fname} ${lname}</strong>`, 'yellow');
        toast('Employee updated.', 'success');
    } else {
        contacts.unshift(obj);
        logActivity(`Added employee <strong>${fname} ${lname}</strong>`, 'accent');
        toast('Employee added.', 'success');
    }
    saveAll();
    closeModal('contact-modal');
    renderContacts();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function deleteContact(id) {
    if (isEmployee()) return;
    const c = contacts.find(x => x.id === id);
    confirmDelete(`Delete employee "${c?.fname} ${c?.lname}"? This cannot be undone.`, () => {
        contacts = contacts.filter(x => x.id !== id);
        logActivity(`Deleted employee <strong>${c?.fname} ${c?.lname}</strong>`, 'red');
        saveAll();
        toast('Employee deleted.');
        renderContacts();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

// ── Real-time granular updates (called from js/modules/socket-handler.js) ──
// Unlike saveContact()/deleteContact(), these do NOT call saveAll() or
// logActivity() — the write and its activity entry were already made by
// whoever originally triggered the change; we're just reflecting the
// result into this client's in-memory `contacts` array and re-rendering
// the table if it's currently on screen.

function addContact(contact) {
    if (!contact || !contact.id) return;
    if (contacts.some(c => c.id === contact.id)) { updateContact(contact.id, contact); return; }
    contacts.unshift(contact);
    if (currentPage === 'contacts') renderContacts();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function updateContact(id, newData) {
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) { addContact({ ...newData, id }); return; }
    contacts[idx] = { ...contacts[idx], ...newData };
    if (currentPage === 'contacts') renderContacts();
    // A contact's role/department/status can affect stage visibility and
    // card assignee labels, so keep the board in sync too if it's open.
    if (currentPage === 'deals' && typeof renderKanban === 'function') renderKanban();
    updateBadges();
}

function removeContact(id) {
    contacts = contacts.filter(c => c.id !== id);
    if (currentPage === 'contacts') renderContacts();
    if (currentPage === 'deals' && typeof renderKanban === 'function') renderKanban();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}
function renderContacts() {
    const q = document.getElementById('contact-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('contact-filter-status')?.value || '';

    let list = contacts.filter(c => {
        const compName = getCompanyName(c.company);
        const depName = getDepartmentName(c.department);
        const roleName = getRoleName(c.role);
        const match = `${c.fname} ${c.lname} ${c.email} ${compName} ${depName} ${roleName}`.toLowerCase().includes(q);
        const sf = !filt || c.status === filt;
        return match && sf;
    });

    const tbody = document.getElementById('contacts-tbody');
    const countLabel = document.getElementById('contact-count-label');
    if (countLabel) countLabel.textContent = `${list.length} employee${list.length === 1 ? '' : 's'}`;

    if (!list.length) {
        tbody.innerHTML =
            `<tr><td colspan="9"><div class="empty-state"><span class="es-icon">👤</span><h3>${contacts.length?'No results':'No employees yet'}</h3><p>${contacts.length?'Try a different filter.':'Click "Add Employee" to get started.'}</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => {
        return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;">${avatarEl(c.fname+' '+c.lname)}<span class="td-name">${c.fname} ${c.lname}</span></div></td>
      <td class="td-mono">${c.email}</td>
      <td class="td-mono">${c.phone || '—'}</td>
      <td>${getCompanyName(c.company)}</td>
      <td>${getDepartmentName(c.department)}</td>
      <td>${c.role ? getRoleName(c.role) : 'Unassigned'}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="td-mono" style="color:var(--text3);font-size:0.75rem;">${fmtDate(c.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="icon-btn" title="Edit" onclick="openContactModal('${c.id}')">✎</button>
          <button class="icon-btn danger" title="Delete" onclick="deleteContact('${c.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
    }).join('');
}
// ── Export Contacts Report (CSV) ──────────────────────────────────────────

/**
 * Export the currently filtered employee list to a CSV file.
 * Uses the same filter logic as renderContacts() (search + status).
 */
window.exportContactsReport = function() {
    const q = document.getElementById('contact-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('contact-filter-status')?.value || '';

    // Apply the same filters as renderContacts()
    let list = contacts.filter(c => {
        const compName = getCompanyName(c.company);
        const depName = getDepartmentName(c.department);
        const roleName = getRoleName(c.role);
        const match = `${c.fname} ${c.lname} ${c.email} ${compName} ${depName} ${roleName}`.toLowerCase().includes(q);
        const sf = !filt || c.status === filt;
        return match && sf;
    });

    if (!list.length) {
        if (typeof toast === 'function') {
            toast('No employees to export. Try adjusting your filters.', 'warning');
        } else {
            console.warn('No employees to export.');
        }
        return;
    }

    // Build CSV rows
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Department', 'Role', 'Status', 'Added'];
    const rows = list.map(c => {
        const name = `${c.fname || ''} ${c.lname || ''}`.trim();
        const company = getCompanyName(c.company);
        const department = getDepartmentName(c.department);
        const role = c.role ? getRoleName(c.role) : 'Unassigned';
        const status = c.status || '';
        const added = c.createdAt ? fmtDate(c.createdAt) : '';

        return [name, c.email || '', c.phone || '', company, department, role, status, added];
    });

    // Build CSV string with metadata header
    let csv = '# Employee Report\n';
    csv += `# Generated: ${new Date().toLocaleString()}\n`;
    csv += `# Total Records: ${list.length}\n`;
    if (q) csv += `# Filter: Search contains "${q}"\n`;
    if (filt) csv += `# Filter: Status = "${filt}"\n`;
    csv += '# \n';
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Download
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `employees_report_${date}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (typeof toast === 'function') {
            toast(`Exported ${list.length} employee records`, 'success');
        }
    } catch (err) {
        if (typeof toast === 'function') {
            toast('Failed to export report: ' + err.message, 'error');
        } else {
            console.error('Export failed:', err);
        }
    }
};