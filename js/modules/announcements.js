// ══════════════════════════════════════════════
//  ANNOUNCEMENTS — js/modules/announcements.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  ANNOUNCEMENTS
// ══════════════════════════════════════════════

function openTaskModal(id) {
    if (isEmployee()) return;
    editingId = id || null;
    const t = id ? tasks.find(x => x.id === id) : null;
    document.getElementById('task-modal-title').textContent = t ? 'Edit Announcement' : 'Add Announcement';
    document.getElementById('t-title').value = t?.title || '';
    document.getElementById('t-desc').value = t?.desc || '';
    document.getElementById('t-due').value = t?.due || new Date().toISOString().slice(0, 10);
    document.getElementById('t-priority').value = t?.priority || 'medium';
    document.getElementById('t-assignee').value = t?.assignee || '';

    const sel = document.getElementById('t-contact');
    sel.innerHTML = '<option value="">— None —</option>' +
        contacts.map(c => `<option value="${c.id}" ${t?.contactId===c.id?'selected':''}>${c.fname} ${c.lname}</option>`)
        .join('');

    openModal('task-modal');
}

function saveTask() {
    if (isEmployee()) return;
    const title = document.getElementById('t-title').value.trim();
    const due = document.getElementById('t-due').value;
    if (!title || !due) { toast('Title and due date required.', 'error'); return; }

    const obj = {
        id: editingId || uid(),
        title,
        desc: document.getElementById('t-desc').value.trim(),
        due,
        priority: document.getElementById('t-priority').value,
        assignee: document.getElementById('t-assignee').value.trim(),
        contactId: document.getElementById('t-contact').value,
        done: editingId ? (tasks.find(t => t.id === editingId)?.done || false) : false,
        createdAt: editingId ? (tasks.find(t => t.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
    };

    if (editingId) {
        tasks = tasks.map(t => t.id === editingId ? obj : t);
        logActivity(`Updated announcement <strong>${title}</strong>`, 'yellow');
        toast('Announcement updated.', 'success');
    } else {
        tasks.unshift(obj);
        logActivity(`Added announcement <strong>${title}</strong>`, 'green');
        toast('Announcement added.', 'success');
    }
    saveAll();
    closeModal('task-modal');
    renderTasks();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
}

function toggleTask(id) {
    if (isEmployee()) return;
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    logActivity(t.done ? `Published announcement <strong>${t.title}</strong>` :
        `Unpublished announcement <strong>${t.title}</strong>`, t.done ? 'green' : 'yellow');
    saveAll();
    renderTasks();
    updateBadges();
    if (currentPage === 'dashboard') renderDashboard();
    toast(t.done ? 'Announcement published.' : 'Announcement unpublished.', 'success');
}

function viewAnnouncement(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const cname = t.contactId ? getContactName(t.contactId) : '';
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = !t.done && t.due < today;

    document.getElementById('view-announcement-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:1rem;">${t.title}</div>
      ${priorityBadge(t.priority)}
    </div>
    ${t.desc ? `<p style="color:var(--text2);font-size:0.88rem;line-height:1.5;margin-bottom:16px;">${t.desc}</p>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:0.83rem;">
      <div><span class="text-muted">Due Date</span><br>
        <span class="${isOverdue?'text-red':''}">${fmtDate(t.due)}${isOverdue?' (Overdue)':''}</span>
      </div>
      <div><span class="text-muted">Status</span><br>
        <span class="badge badge-${t.done?'active':'inactive'}">${t.done?'Published':'Unpublished'}</span>
      </div>
      ${t.assignee ? `<div><span class="text-muted">Posted By</span><br>${t.assignee}</div>` : ''}
      ${cname ? `<div><span class="text-muted">Related Employee</span><br>${cname}</div>` : ''}
    </div>
  `;
    openModal('view-announcement-modal');

    if (!t.done) {
        t.done = true;
        logActivity(`Auto-checked announcement <strong>${t.title}</strong> as read`, 'green');
        saveAll();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
        if (currentPage === 'tasks') renderTasks();
    }
}

function deleteTask(id) {
    if (isEmployee()) return;
    const t = tasks.find(x => x.id === id);
    confirmDelete(`Delete announcement "${t?.title}"?`, () => {
        tasks = tasks.filter(x => x.id !== id);
        saveAll();
        toast('Announcement deleted.');
        renderTasks();
        updateBadges();
        if (currentPage === 'dashboard') renderDashboard();
    });
}

function renderTasks() {
    const employee = isEmployee();
    const q = document.getElementById('task-search')?.value.toLowerCase() || '';
    const filt = document.getElementById('task-filter')?.value || '';
    const today = new Date().toISOString().slice(0, 10);

    const addBtn = document.getElementById('tasks-add-btn');
    if (addBtn) addBtn.style.display = employee ? 'none' : '';

    let list = tasks.filter(t => {
        const match = t.title.toLowerCase().includes(q) || (t.assignee || '').toLowerCase().includes(q);
        if (!match) return false;
        if (filt === 'todo') return !t.done;
        if (filt === 'done') return t.done;
        if (filt === 'high') return t.priority === 'high' && !t.done;
        if (filt === 'overdue') return !t.done && t.due < today;
        return true;
    });

    list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const po = { high: 0, medium: 1, low: 2 };
        if (!a.done && po[a.priority] !== po[b.priority]) return po[a.priority] - po[b.priority];
        return a.due > b.due ? 1 : -1;
    });

    const el = document.getElementById('task-list');
    if (!list.length) {
        el.innerHTML =
            `<div class="empty-state"><span class="es-icon">📢</span><h3>${tasks.length?'No matching announcements':'No announcements yet'}</h3><p>${tasks.length?'Try a different filter.':'Add your first announcement to get started.'}</p></div>`;
        return;
    }

    el.innerHTML = list.map(t => {
        const isOverdue = !t.done && t.due < today;
        const cname = t.contactId ? getContactName(t.contactId) : '';
        return `
      <div class="task-item ${t.done ? 'done' : ''}">
        <div class="task-check" ${employee ? 'style="cursor:default;pointer-events:none;"' : `onclick="event.stopPropagation(); toggleTask('${t.id}')"`}>
          ${t.done ? '<span style="color:#fff;font-size:0.75rem;">✓</span>' : ''}
        </div>
        <div class="task-body" style="cursor:pointer;" onclick="viewAnnouncement('${t.id}')">
          <div class="task-title">${t.title}</div>
          ${t.desc ? `<div style="font-size:0.78rem;color:var(--text3);margin:3px 0;">${t.desc}</div>` : ''}
          <div class="task-meta">
            <span class="task-due ${isOverdue?'overdue':''}">📅 ${fmtDate(t.due)}</span>
            ${t.assignee ? `<span class="task-assignee">👤 ${t.assignee}</span>` : ''}
            ${cname ? `<span class="task-assignee">🔗 ${cname}</span>` : ''}
            ${priorityBadge(t.priority)}
          </div>
        </div>
        ${employee ? '' : `
        <div class="actions" style="align-self:flex-start;margin-top:2px;">
          <button class="icon-btn" onclick="openTaskModal('${t.id}')">✎</button>
          <button class="icon-btn danger" onclick="deleteTask('${t.id}')">🗑</button>
        </div>`}
      </div>
    `;
    }).join('');
}

