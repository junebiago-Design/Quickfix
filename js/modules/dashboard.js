// ══════════════════════════════════════════════
//  DASHBOARD — js/modules/dashboard.js
//  UPDATED: Stat cards now show only user‑specific
//  task counts (Active, Completed, Overdue) and
//  global Pending Announcements.
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

    // ── Build stats grid (only 4 cards now) ──
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

    // ✅ Recent Activity (rendered by activity.js)
    renderActivityList();

    // ── Upcoming announcements (global) ──
    const upcoming = tasks.filter(t => !t.done).sort((a, b) => a.due > b.due ? 1 : -1).slice(0, 6);
    const upEl = document.getElementById('upcoming-tasks');
    if (!upcoming.length) {
        upEl.innerHTML =
            `<div class="empty-state" style="padding:40px 20px;"><span class="es-icon">✓</span><h3>All caught up!</h3><p>No pending announcements.</p></div>`;
    } else {
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
}