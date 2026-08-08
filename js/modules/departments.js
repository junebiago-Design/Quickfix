// ══════════════════════════════════════════════
//  DEPARTMENTS — js/modules/departments.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  DEPARTMENTS
// ══════════════════════════════════════════════

function openDepartmentModal(id) {
    if (isEmployee()) return;
    editingId = id || null;
    const d = id ? departments.find(x => x.id === id) : null;
    document.getElementById('department-modal-title').textContent = d ? 'Edit Department' : 'Add Department';
    document.getElementById('dep-name').value = d?.name || '';
    document.getElementById('dep-desc').value = d?.desc || '';
    document.getElementById('dep-status').value = d?.status || 'active';

    populateCompanySelect(document.getElementById('dep-company'), d?.companyId || '');

    const sel = document.getElementById('dep-manager');
    sel.innerHTML = '<option value="">— None —</option>' +
        contacts.map(c => `<option value="${c.id}" ${d?.managerId===c.id?'selected':''}>${c.fname} ${c.lname}</option>`)
        .join('');

    openModal('department-modal');
}

function saveDepartment() {
    if (isEmployee()) return;
    const name = document.getElementById('dep-name').value.trim();
    if (!name) { toast('Department name is required.', 'error'); return; }

    const obj = {
        id: editingId || uid(),
        name,
        desc: document.getElementById('dep-desc').value.trim(),
        companyId: document.getElementById('dep-company').value,
        managerId: document.getElementById('dep-manager').value,
        status: document.getElementById('dep-status').value,
        createdAt: editingId ? (departments.find(d => d.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
    };

    if (editingId) {
        departments = departments.map(d => d.id === editingId ? obj : d);
        logActivity(`Edited department <strong>${name}</strong>`, 'yellow');
    } else {
        departments.unshift(obj);
        logActivity(`Added department <strong>${name}</strong>`, 'accent');
    }
    saveAll();
    closeModal('department-modal');
    renderDepartments();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function deleteDepartment(id) {
    if (isEmployee()) return;
    const d = departments.find(x => x.id === id);
    confirmDelete(`Delete department "${d?.name}"?`, () => {
        departments = departments.filter(x => x.id !== id);
        saveAll();
        toast('Department deleted.');
        renderDepartments();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

function renderDepartments() {
    const q = document.getElementById('department-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('department-filter-status')?.value || '';

    let list = departments.filter(d => d.name.toLowerCase().includes(q) && (!filt || d.status === filt));

    const tbody = document.getElementById('departments-tbody');
    if (!list.length) {
        tbody.innerHTML =
            `<tr><td colspan="8"><div class="empty-state"><h3>No departments found</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(d => {
        const empCount = contacts.filter(c => c.department === d.id).length;
        return `
    <tr>
      <td><span class="td-name">${d.name}</span></td>
      <td>${d.desc || '—'}</td>
      <td>${d.companyId ? getCompanyName(d.companyId) : '—'}</td>
      <td>${d.managerId ? getContactName(d.managerId) : '—'}</td>
      <td>${empCount}</td>
      <td>${statusBadge(d.status)}</td>
      <td>${fmtDate(d.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="icon-btn" onclick="openDepartmentModal('${d.id}')">✎</button>
          <button class="icon-btn danger" onclick="deleteDepartment('${d.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
    }).join('');
}

