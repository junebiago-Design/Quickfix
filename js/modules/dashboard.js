// ══════════════════════════════════════════════
//  DASHBOARD — js/modules/dashboard.js
//  UPDATED:
//  - Pagination moved to top of Recent Activity
//  - Scroll bars added to activity and tasks cards
// ══════════════════════════════════════════════

// ── Pagination state for dashboard activity ──
let dashboardActivityPage = 1;
const DASHBOARD_ACTIVITY_PER_PAGE = 10;

function renderDashboard() {
    const finalStageKeys = new Set(stages.filter(s => s.final).map(s => s.key));
    const todayStr = new Date().toISOString().slice(0, 10);

    const currentEmployeeId = currentUser?.employeeId || currentUser?.contactId;

    let myDeals = [];
    if (currentEmployeeId) {
        myDeals = deals.filter(d => {
            if (d.contactIds && Array.isArray(d.contactIds) && d.contactIds.includes(currentEmployeeId)) return true;
            if (d.contactId && d.contactId === currentEmployeeId) return true;
            return false;
        });
    }

    const myActiveTasks = myDeals.filter(d => !finalStageKeys.has(d.stage)).length;
    const myCompletedTasks = myDeals.filter(d => finalStageKeys.has(d.stage)).length;
    const myOverdueTasks = myDeals.filter(d =>
        !finalStageKeys.has(d.stage) && d.due && d.due < todayStr
    ).length;

    const pendingAnnouncements = tasks.filter(t => !t.done).length;
    const overdueAnnouncements = tasks.filter(t => !t.done && t.due < todayStr).length;

    const stats = [
        { icon: '📋', val: myActiveTasks, label: 'My Active Tasks', color: 'var(--purple)' },
        { icon: '✓', val: myCompletedTasks, label: 'My Completed Tasks', color: 'var(--green)' },
        { icon: '⚠️', val: myOverdueTasks, label: 'My Overdue Tasks', color: myOverdueTasks > 0 ? 'var(--red)' : 'var(--yellow)' },
        { icon: '📢', val: pendingAnnouncements, label: 'Pending Announcements', color: overdueAnnouncements > 0 ? 'var(--red)' : 'var(--yellow)' },
    ];

    document.getElementById('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--card-accent:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

    rebuildDashboardGrid(myDeals.filter(d => !finalStageKeys.has(d.stage)));
}

function rebuildDashboardGrid(activeDeals) {
    const grid = document.querySelector('#page-dashboard .dashboard-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // ── Column 1: Recent Activity with top pagination & scroll ──
    const activityCol = document.createElement('div');
    activityCol.className = 'card';
    activityCol.innerHTML = `
        <div class="card-header">
            <span>Recent Activity</span>
            <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="dashboard-activity-count"></span>
        </div>
        <div class="card-body" style="padding:0 16px 16px;">
            <div id="dashboard-activity-pagination-top" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:8px;">
                <!-- Pagination controls will be rendered here -->
            </div>
            <div class="activity-scroll-container" style="max-height:400px;overflow-y:auto;padding-right:4px;">
                <ul class="activity-list" id="dashboard-activity-list" style="margin:0;padding:0;">
                    <li class="empty-state" style="padding:40px 20px;">
                        <span class="es-icon">◌</span>
                        <p>No activity yet. Start by adding employees or tasks.</p>
                    </li>
                </ul>
            </div>
        </div>
    `;
    grid.appendChild(activityCol);

    // ── Column 2: My Active Tasks with scroll ──
    const tasksCol = document.createElement('div');
    tasksCol.className = 'card';
    tasksCol.innerHTML = `
        <div class="card-header">
            <span>My Active Tasks</span>
            <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="dashboard-my-tasks-count"></span>
        </div>
        <div class="card-body" style="padding:0 16px 16px;max-height:400px;overflow-y:auto;">
            <div id="dashboard-my-tasks-body"></div>
        </div>
    `;
    grid.appendChild(tasksCol);

    // ── Full‑width row: Upcoming Announcements ──
    const upcomingCol = document.createElement('div');
    upcomingCol.className = 'card';
    upcomingCol.style.gridColumn = '1 / -1';
    upcomingCol.innerHTML = `
        <div class="card-header">
            <span>Upcoming Announcements</span>
        </div>
        <div class="card-body" id="dashboard-upcoming-body"></div>
    `;
    grid.appendChild(upcomingCol);

    // ── Populate columns ──
    dashboardActivityPage = 1;
    renderDashboardActivityList();
    renderDashboardMyTasksContent(activeDeals);
    renderDashboardUpcoming();
}

// ── Render dashboard activity list with top pagination ──
function renderDashboardActivityList() {
    const listEl = document.getElementById('dashboard-activity-list');
    const countEl = document.getElementById('dashboard-activity-count');
    const paginationEl = document.getElementById('dashboard-activity-pagination-top');
    if (!listEl) return;

    let allActivity = [];
    if (typeof activity !== 'undefined' && Array.isArray(activity)) {
        allActivity = activity.slice();
    }

    allActivity.sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));

    const total = allActivity.length;
    const totalPages = Math.ceil(total / DASHBOARD_ACTIVITY_PER_PAGE) || 1;

    if (dashboardActivityPage < 1) dashboardActivityPage = 1;
    if (dashboardActivityPage > totalPages) dashboardActivityPage = totalPages;

    const start = (dashboardActivityPage - 1) * DASHBOARD_ACTIVITY_PER_PAGE;
    const end = Math.min(start + DASHBOARD_ACTIVITY_PER_PAGE, total);
    const pageItems = allActivity.slice(start, end);

    if (countEl) countEl.textContent = total;

    if (!total) {
        listEl.innerHTML = `<li class="empty-state" style="padding:40px 20px;">
            <span class="es-icon">◌</span>
            <p>No activity yet. Start by adding employees or tasks.</p>
        </li>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const timeFn = (typeof fmtRelativeTime === 'function') ? fmtRelativeTime :
                   (typeof fmtShortDate === 'function') ? fmtShortDate :
                   (iso => iso || '');

    listEl.innerHTML = pageItems.map(a => {
        let colorClass = a.color || 'accent';
        if (a.category === 'revision') colorClass = 'revision';
        else if (a.category === 'comment') colorClass = 'comment';
        else if (a.category === 'permission') colorClass = 'permission';
        else if (a.category === 'file') colorClass = 'file';
        else if (a.category === 'done') colorClass = 'success';
        else if (a.category === 'task-move') colorClass = 'task-move';
        return `
            <li class="activity-item activity-${colorClass}">
                <span class="activity-icon" title="${a.category || 'general'}">${a.icon || '•'}</span>
                <span class="activity-message">${a.message || a.text || ''}</span>
                <span class="activity-time">${timeFn(a.createdAt || a.ts)}</span>
            </li>
        `;
    }).join('');

    // ── Render pagination at top ──
    if (paginationEl) {
        if (totalPages <= 1) {
            paginationEl.innerHTML = `<span style="font-size:0.75rem;color:var(--text3);">Showing all ${total} entries</span>`;
        } else {
            const startNum = start + 1;
            const endNum = end;
            paginationEl.innerHTML = `
                <span style="font-size:0.75rem;color:var(--text3);">${startNum}–${endNum} of ${total}</span>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-ghost" onclick="dashboardGoToActivityPage(${dashboardActivityPage - 1})" ${dashboardActivityPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
                    <button class="btn btn-sm btn-ghost" onclick="dashboardGoToActivityPage(${dashboardActivityPage + 1})" ${dashboardActivityPage >= totalPages ? 'disabled' : ''}>Next ›</button>
                </div>
            `;
        }
    }
}

// ── Navigate dashboard activity to a specific page ──
function dashboardGoToActivityPage(page) {
    let allActivity = [];
    if (typeof activity !== 'undefined' && Array.isArray(activity)) {
        allActivity = activity.slice();
    }
    const total = allActivity.length;
    const totalPages = Math.ceil(total / DASHBOARD_ACTIVITY_PER_PAGE) || 1;
    if (page < 1 || page > totalPages) return;
    dashboardActivityPage = page;
    renderDashboardActivityList();
}

// ── Render My Active Tasks content (cards) with scroll ──
function renderDashboardMyTasksContent(activeDeals) {
    const bodyEl = document.getElementById('dashboard-my-tasks-body');
    const countEl = document.getElementById('dashboard-my-tasks-count');
    if (!bodyEl) return;

    if (countEl) countEl.textContent = activeDeals.length;

    if (!activeDeals.length) {
        bodyEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">📋</span><p>No active tasks assigned to you.</p></div>`;
        return;
    }

    let html;
    if (typeof profileDealCardHTML === 'function') {
        html = activeDeals.map(d => profileDealCardHTML(d)).join('');
    } else {
        html = activeDeals.map(d => `
            <div class="deal-card" style="cursor:pointer;" onclick="openDealViewOnly('${d.id}')">
                <div class="deal-card-title">${d.title}</div>
                ${d.desc ? `<div class="deal-card-desc">${d.desc}</div>` : ''}
                <div class="deal-card-meta">
                    <span class="task-due">📅 ${fmtDate(d.due)}</span>
                    ${priorityBadge(d.priority)}
                </div>
            </div>
        `).join('');
    }
    bodyEl.innerHTML = html;
}

// ── Render Upcoming Announcements ──
function renderDashboardUpcoming() {
    const upEl = document.getElementById('dashboard-upcoming-body');
    if (!upEl) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = tasks.filter(t => !t.done).sort((a, b) => a.due > b.due ? 1 : -1).slice(0, 6);

    if (!upcoming.length) {
        upEl.innerHTML = `<div class="empty-state" style="padding:40px 20px;"><span class="es-icon">✓</span><h3>All caught up!</h3><p>No pending announcements.</p></div>`;
        return;
    }

    upEl.innerHTML = upcoming.map(t => {
        const isOverdue = t.due < todayStr;
        return `<div class="task-preview-item" onclick="viewAnnouncement('${t.id}')" style="cursor:pointer;">
            <span style="color:${t.priority==='high'?'var(--red)':t.priority==='medium'?'var(--yellow)':'var(--green)'};font-size:1rem;">●</span>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:0.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
                <div class="task-due ${isOverdue?'overdue':''}">${isOverdue?'Overdue · ':'Due '}${fmtDate(t.due)}</div>
            </div>
            ${priorityBadge(t.priority)}
        </div>`;
    }).join('');
}

// Expose globally
window.renderDashboard = renderDashboard;
window.dashboardGoToActivityPage = dashboardGoToActivityPage;
window.renderDashboardMyTasks = renderDashboardMyTasks;

console.log('✅ Dashboard module loaded (pagination top, scroll added)');