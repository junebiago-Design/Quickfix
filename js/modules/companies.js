// ══════════════════════════════════════════════
//  COMPANIES — js/modules/companies.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  COMPANIES
// ══════════════════════════════════════════════

function openCompanyModal(id) {
    if (isEmployee()) return;
    editingId = id || null;
    const c = id ? companies.find(x => x.id === id) : null;
    document.getElementById('company-modal-title').textContent = c ? 'Edit Company' : 'Add Company';
    document.getElementById('comp-name').value = c?.name || '';
    document.getElementById('comp-industry').value = c?.industry || '';
    document.getElementById('comp-phone').value = c?.phone || '';
    document.getElementById('comp-email').value = c?.email || '';
    document.getElementById('comp-website').value = c?.website || '';
    document.getElementById('comp-address').value = c?.address || '';
    document.getElementById('comp-status').value = c?.status || 'active';
    openModal('company-modal');
}

function saveCompany() {
    if (isEmployee()) return;
    const name = document.getElementById('comp-name').value.trim();
    if (!name) { toast('Company name is required.', 'error'); return; }

    // ── Duplicate check ──
    if (isCompanyNameTaken(name, editingId)) {
        toast('A company with this name already exists.', 'error');
        return;
    }

    const obj = {
        id: editingId || uid(),
        name,
        industry: document.getElementById('comp-industry').value.trim(),
        phone: document.getElementById('comp-phone').value.trim(),
        email: document.getElementById('comp-email').value.trim(),
        website: document.getElementById('comp-website').value.trim(),
        address: document.getElementById('comp-address').value.trim(),
        status: document.getElementById('comp-status').value,
        createdAt: editingId ? (companies.find(c => c.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
    };

    if (editingId) {
        companies = companies.map(c => c.id === editingId ? obj : c);
        logActivity(`Edited company <strong>${name}</strong>`, 'yellow');
    } else {
        companies.unshift(obj);
        logActivity(`Added company <strong>${name}</strong>`, 'accent');
    }
    saveAll();
    closeModal('company-modal');
    renderCompanies();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function deleteCompany(id) {
    if (isEmployee()) return;
    confirmDelete(`Delete company?`, () => {
        companies = companies.filter(x => x.id !== id);
        saveAll();
        toast('Company deleted.');
        renderCompanies();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

function renderCompanies() {
    const q = document.getElementById('company-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('company-filter-status')?.value || '';

    let list = companies.filter(c => c.name.toLowerCase().includes(q) && (!filt || c.status === filt));

    const tbody = document.getElementById('companies-tbody');
    if (!list.length) {
        tbody.innerHTML =
            `<tr><td colspan="8"><div class="empty-state"><h3>No companies found</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => {
        // An employee counts under this company if assigned to it directly,
        // OR indirectly through a department that belongs to this company.
        const deptIdsUnderCompany = departments.filter(d => d.companyId === c.id).map(d => d.id);
        const empIds = new Set(
            contacts
                .filter(e => e.company === c.id || deptIdsUnderCompany.includes(e.department))
                .map(e => e.id)
        );
        return `
    <tr>
      <td><span class="td-name">${c.name}</span></td>
      <td>${c.industry || '—'}</td>
      <td>${c.phone || '—'}</td>
      <td>${c.website || '—'}</td>
      <td>${empIds.size}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${fmtDate(c.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="icon-btn" onclick="openCompanyModal('${c.id}')">✎</button>
          <button class="icon-btn danger" onclick="deleteCompany('${c.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
    }).join('');
}