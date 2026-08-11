// ══════════════════════════════════════════════
//  DASHBOARD — js/modules/dashboard.js
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
//  UPDATED:
<<<<<<< HEAD
//  - Pagination moved to top of Recent Activity
//  - Scroll bars added to activity and tasks cards
=======
//  - My Active Tasks side‑by‑side with Recent Activity
//  - Recent Activity filtered to current user only
//  - Upcoming Announcements moved to a full‑width row below
>>>>>>> parent of a55392e (Major Dashboard changes)
=======
//  UPDATED: Uses renderRecentActivityList(10)
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
//  UPDATED: Uses renderRecentActivityList(10)
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
//  UPDATED: Uses renderRecentActivityList(10)
>>>>>>> parent of e6f06d4 (1.1.3 update)
// ══════════════════════════════════════════════

function renderDashboard() {
    const finalStageKeys = new Set(stages.filter(s => s.final).map(s => s.key));
    const todayStr = new Date().toISOString().slice(0, 10);

    // ── Get current employee ID ──
    const currentEmployeeId = currentUser?.employeeId || currentUser?.contactId;

    // ── Filter deals assigned to the current user ──
    let myDeals = [];
    if (currentEmployeeId) {
        myDeals = deals.filter(d => {
            if (d.contactIds && Array.isArray(d.contactIds) && d.contactIds.includes(currentEmployeeId)) return true;
            if (d.contactId && d.contactId === currentEmployeeId) return true;
            return false;
        });
    }

    // ── Compute my task stats ──
    const myActiveTasks = myDeals.filter(d => !finalStageKeys.has(d.stage)).length;
    const myCompletedTasks = myDeals.filter(d => finalStageKeys.has(d.stage)).length;
    const myOverdueTasks = myDeals.filter(d =>
        !finalStageKeys.has(d.stage) && d.due && d.due < todayStr
    ).length;

    // ── Pending announcements (global) ──
    const pendingAnnouncements = tasks.filter(t => !t.done).length;
    const overdueAnnouncements = tasks.filter(t => !t.done && t.due < todayStr).length;

    // ── Build stats grid (4 cards) ──
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

    // ── Rebuild the dashboard grid: two columns + full‑width upcoming ──
    rebuildDashboardGrid(myDeals.filter(d => !finalStageKeys.has(d.stage)));
}

// ── Rebuild the dashboard-grid with the new layout ────────────────────

function rebuildDashboardGrid(activeDeals) {
    const grid = document.querySelector('#page-dashboard .dashboard-grid');
    if (!grid) return;

    // Clear existing content
    grid.innerHTML = '';

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    // ── Column 1: Recent Activity with top pagination & scroll ──
=======
    // ── Column 1: Recent Activity (filtered to current user) ──
>>>>>>> parent of a55392e (Major Dashboard changes)
=======
    // ── Column 1: Recent Activity (limit 10) ──
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    // ── Column 1: Recent Activity (limit 10) ──
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    // ── Column 1: Recent Activity (limit 10) ──
>>>>>>> parent of e6f06d4 (1.1.3 update)
    const activityCol = document.createElement('div');
    activityCol.className = 'card';
    activityCol.innerHTML = `
        <div class="card-header">
            <span>My Recent Activity</span>
            <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="dashboard-activity-count"></span>
        </div>
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
        <div class="card-body">
            <ul class="activity-list" id="dashboard-activity-list">
                <li class="empty-state" style="padding:40px 20px;">
                    <span class="es-icon">◌</span>
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
                    <p>No activity yet from your account.</p>
                </li>
            </ul>
>>>>>>> parent of a55392e (Major Dashboard changes)
=======
                    <p>No activity yet. Start by adding employees or tasks.</p>
                </li>
            </ul>
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
                    <p>No activity yet. Start by adding employees or tasks.</p>
                </li>
            </ul>
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
                    <p>No activity yet. Start by adding employees or tasks.</p>
                </li>
            </ul>
>>>>>>> parent of e6f06d4 (1.1.3 update)
        </div>
    `;
    grid.appendChild(activityCol);

    // ── Column 2: My Active Tasks ──
    const tasksCol = document.createElement('div');
    tasksCol.className = 'card';
    tasksCol.innerHTML = `
        <div class="card-header">
            <span>My Active Tasks</span>
            <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="dashboard-my-tasks-count"></span>
        </div>
        <div class="card-body" id="dashboard-my-tasks-body"></div>
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    dashboardActivityPage = 1;
=======
>>>>>>> parent of a55392e (Major Dashboard changes)
    renderDashboardActivityList();
=======
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
    // Render the 10 most recent activities using the new helper
    if (typeof renderRecentActivityList === 'function') {
        renderRecentActivityList(10, 'dashboard-activity-list', 'dashboard-activity-count');
    } else {
        // fallback
        renderDashboardActivityListFallback();
    }
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
    renderDashboardMyTasksContent(activeDeals);
    renderDashboardUpcoming();
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
// ── Render dashboard activity list with top pagination ──
=======
// ── Render filtered activity (current user only) ──────────────────────

>>>>>>> parent of a55392e (Major Dashboard changes)
function renderDashboardActivityList() {
=======
// Fallback in case renderRecentActivityList isn't available
function renderDashboardActivityListFallback() {
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
// Fallback in case renderRecentActivityList isn't available
function renderDashboardActivityListFallback() {
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
// Fallback in case renderRecentActivityList isn't available
function renderDashboardActivityListFallback() {
>>>>>>> parent of e6f06d4 (1.1.3 update)
    const listEl = document.getElementById('dashboard-activity-list');
    const countEl = document.getElementById('dashboard-activity-count');
    if (!listEl) return;

    // Get current user's full name for filtering
    const fullName = (typeof getCurrentUserFullName === 'function') ? getCurrentUserFullName() : '';
    const empId = (typeof getCurrentEmployeeId === 'function') ? getCurrentEmployeeId() : (currentUser?.employeeId || null);

    let filtered = [];
    if (typeof activity !== 'undefined' && Array.isArray(activity)) {
        filtered = activity.filter(a => {
            const msg = a.message || a.text || '';
            // Match by employee ID if available, otherwise by name in message
            if (empId) {
                // Check if the activity's actor is the current user (if actor info exists)
                if (a.actorId && a.actorId === empId) return true;
                // Fallback: check if the message contains the full name
                if (fullName && msg.includes(fullName)) return true;
                return false;
            }
            // If no empId, fallback to name match
            return fullName && msg.includes(fullName);
        });
    }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
>>>>>>> parent of a55392e (Major Dashboard changes)
=======
    if (countEl) countEl.textContent = allActivity.length;

    if (!allActivity.length) {
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    if (countEl) countEl.textContent = allActivity.length;

    if (!allActivity.length) {
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    if (countEl) countEl.textContent = allActivity.length;

    if (!allActivity.length) {
>>>>>>> parent of e6f06d4 (1.1.3 update)
        listEl.innerHTML = `<li class="empty-state" style="padding:40px 20px;">
            <span class="es-icon">◌</span>
            <p>No activity yet from your account.</p>
        </li>`;
        return;
    }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
    // Sort newest first
    const sorted = filtered.slice().sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sorted.slice(0, 20); // limit to 20

>>>>>>> parent of a55392e (Major Dashboard changes)
=======
    const sorted = allActivity.sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sorted.slice(0, 10);

>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    const sorted = allActivity.sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sorted.slice(0, 10);

>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
    const sorted = allActivity.sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sorted.slice(0, 10);

>>>>>>> parent of e6f06d4 (1.1.3 update)
    const timeFn = (typeof fmtRelativeTime === 'function') ? fmtRelativeTime :
                   (typeof fmtShortDate === 'function') ? fmtShortDate :
                   (iso => iso || '');

    listEl.innerHTML = displayItems.map(a => {
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
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
// ── Render My Active Tasks content (cards) ────────────────────────────

>>>>>>> parent of a55392e (Major Dashboard changes)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
function renderDashboardMyTasksContent(activeDeals) {
    const bodyEl = document.getElementById('dashboard-my-tasks-body');
    const countEl = document.getElementById('dashboard-my-tasks-count');
    if (!bodyEl) return;

    if (countEl) countEl.textContent = activeDeals.length;

    if (!activeDeals.length) {
        bodyEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">📋</span><p>No active tasks assigned to you.</p></div>`;
        return;
    }

    // Use profileDealCardHTML if available, else fallback
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

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
// ── Render Upcoming Announcements ──
=======
// ── Render Upcoming Announcements (global) ────────────────────────────

>>>>>>> parent of a55392e (Major Dashboard changes)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
>>>>>>> parent of e6f06d4 (1.1.3 update)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
window.dashboardGoToActivityPage = dashboardGoToActivityPage;
window.renderDashboardMyTasks = renderDashboardMyTasks;

console.log('✅ Dashboard module loaded (pagination top, scroll added)');
=======
window.renderDashboardMyTasks = renderDashboardMyTasks; // kept for compatibility

console.log('✅ Dashboard module loaded (new layout: My Recent Activity + My Active Tasks side‑by‑side)');
>>>>>>> parent of a55392e (Major Dashboard changes)
=======
window.renderDashboardMyTasks = renderDashboardMyTasks;
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
window.renderDashboardMyTasks = renderDashboardMyTasks;
>>>>>>> parent of e6f06d4 (1.1.3 update)
=======
window.renderDashboardMyTasks = renderDashboardMyTasks;
>>>>>>> parent of e6f06d4 (1.1.3 update)
