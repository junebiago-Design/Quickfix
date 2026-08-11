// ══════════════════════════════════════════════
//  NAVIGATION & SHELL UI — js/modules/navigation.js
//  (pages, navigate, sidebar, modals, toast, reloadData)
//  UPDATED: reloadData() resets pending updates badge.
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
const pages = {
    dashboard: { title: 'Dashboard', sub: 'Overview of your workspace' },
    'employee-directory': { title: 'Employee Directory', sub: 'Browse all employees and their login status' },
    contacts: { title: 'Employee', sub: 'Manage your employees' },
    deals: { title: 'Task', sub: 'Kanban task board' },
    tasks: { title: 'Announcement', sub: 'Manage and publish announcements' },
    notes: { title: 'Notes & Activity', sub: 'Logs and notes' },
    'task-activity': { title: 'Task Activity', sub: 'Full audit trail of every task, with time-in-stage' },
    departments: { title: 'Departments', sub: 'Manage company departments' },
    companies: { title: 'Companies', sub: 'Manage companies' },
    roles: { title: 'Roles', sub: 'Manage employee roles' },
    users: { title: 'Users', sub: 'Manage system user accounts' },
    'page-access': { title: 'Page Access', sub: 'Control which roles can see which sidebar pages' },
    profile: { title: 'My Profile', sub: 'Your account and activity' },
    'login-monitoring': { title: 'Login Monitoring', sub: 'Monitor user login activity and security' }
};
let currentPage = 'dashboard';

function navigate(page) {
    if (typeof hasPageAccess === 'function' && !hasPageAccess(page)) {
        toast("You don't have access to that page.", 'error');
        if (page !== 'dashboard') navigate('dashboard');
        return;
    }
    if (currentPage === 'page-access' && page !== 'page-access' && typeof pendingPageAccessEdits !== 'undefined') {
        pendingPageAccessEdits = {};
    }
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    const info = pages[page];
    document.getElementById('topbar-title').textContent = info.title;
    document.getElementById('topbar-sub').textContent = info.sub;
    currentPage = page;
    closeSidebar();
    renderPage(page);
    if (page !== 'page-access') {
        reloadAllData().then(() => {
            if (currentPage === page) renderPage(page);
        });
    }
}

function renderPage(p) {
    if (p === 'dashboard') renderDashboard();
    else if (p === 'employee-directory') renderEmployeeDirectory();
    else if (p === 'contacts') renderContacts();
    else if (p === 'deals') renderKanban();
    else if (p === 'tasks') renderTasks();
    else if (p === 'notes') renderNotes();
    else if (p === 'task-activity') renderTaskActivity(1);
    else if (p === 'departments') renderDepartments();
    else if (p === 'companies') renderCompanies();
    else if (p === 'roles') renderRoles();
    else if (p === 'users') renderUsers();
    else if (p === 'page-access') renderPageAccessMatrix();
    else if (p === 'profile') renderProfile();
    else if (p === 'login-monitoring') renderLoginMonitoring();
    updateBadges();
}

function updateBadges() {
    if (typeof reconcileTaskLifecycle === 'function') {
        const changed = reconcileTaskLifecycle();
        if (changed && typeof saveAll === 'function') saveAll();
    }
    document.getElementById('badge-contacts').textContent = contacts.length;
    const finalStageKeys = new Set(stages.filter(s => s.final).map(s => s.key));
    document.getElementById('badge-deals').textContent = deals.filter(d => !finalStageKeys.has(d.stage)).length;
    const pending = tasks.filter(t => !t.done).length;
    document.getElementById('badge-tasks').textContent = pending;
    document.getElementById('badge-departments').textContent = departments.length;
    document.getElementById('badge-companies').textContent = companies.length;
    document.getElementById('badge-roles').textContent = roles.length;
    document.getElementById('badge-users').textContent = users.length;
    if (typeof getUserTaskCounts === 'function' && typeof getCurrentEmployeeId === 'function') {
        const myEmployeeId = getCurrentEmployeeId();
        const { completed: myCompleted, pending: myPending } = myEmployeeId ? getUserTaskCounts(myEmployeeId) : { completed: 0, pending: 0 };
        [
            ['badge-my-completed', myCompleted], ['badge-my-pending', myPending],
            ['dash-my-completed', myCompleted], ['dash-my-pending', myPending],
            ['profile-my-completed', myCompleted], ['profile-my-pending', myPending],
        ].forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }
}

// ══════════════════════════════════════════════
//  SIDEBAR
// ══════════════════════════════════════════════
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}

// ══════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════
let editingId = null;

function openModal(id) {
    const el = document.getElementById(id);
    if (!el) { console.error(`openModal: no element with id "${id}" found in the page.`); return; }
    el.classList.add('open');
    el.addEventListener('click', function outsideClick(e) {
        if (e.target === el) { closeModal(id);
            el.removeEventListener('click', outsideClick); }
    });
    if (id === 'deal-modal' && typeof renderDealModalAttachments === 'function') {
        renderDealModalAttachments();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    editingId = null;
}

function confirmDelete(text, cb) {
    document.getElementById('confirm-text').textContent = text;
    document.getElementById('confirm-ok').onclick = () => { cb();
        closeModal('confirm-modal'); };
    openModal('confirm-modal');
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    let iconHtml;
    if (type === 'login') {
        iconHtml = `<span class="status-indicator online"><span class="pulse-ring"></span><span class="pulse-dot-large"></span></span>`;
    } else if (type === 'logout') {
        iconHtml = `<span class="status-indicator offline"><span class="offline-dot"></span></span>`;
    } else {
        iconHtml = `<span>${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span>`;
    }
    el.innerHTML = `${iconHtml}<span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.animation = 'toast-out 0.3s forwards';
        setTimeout(() => el.remove(), 300); }, 3000);
}

// ──────────────────────────────────────────────
//  RELOAD DATA (UPDATED: resets badge)
// ──────────────────────────────────────────────
function reloadData() {
    if (typeof window.resetPendingUpdates === 'function') {
        window.resetPendingUpdates();
    }
    toast('Refreshing data…', 'info');
    renderPage(currentPage);
    reloadAllData()
        .then(() => {
            if (currentPage) renderPage(currentPage);
            toast('Data refreshed.', 'success');
        })
        .catch(() => {
            toast('Failed to refresh data.', 'error');
        });
}

window.reloadData = reloadData;