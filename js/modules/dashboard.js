// ══════════════════════════════════════════════
//  DASHBOARD — js/modules/dashboard.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════

function renderDashboard() {
    const finalStageKeys = new Set(stages.filter(s => s.final).map(s => s.key));
    const completedTasks = deals.filter(d => finalStageKeys.has(d.stage)).length;
    const pendingAnnouncements = tasks.filter(t => !t.done).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(t => !t.done && t.due < todayStr).length;

    const stats = [
        { icon: '👥', val: contacts.length, label: 'Total Employees', color: 'var(--accent)' },
        { icon: '📋', val: deals.length, label: 'Active Tasks', color: 'var(--purple)' },
        { icon: '✓', val: completedTasks, label: 'Completed Tasks', color: 'var(--green)' },
        { icon: '📢', val: pendingAnnouncements, label: 'Pending Announcements', color: overdue > 0 ?
                'var(--red)' : 'var(--yellow)' },
        { icon: '🛡️', val: roles.length, label: 'Total Roles', color: 'var(--purple)' },
    ];

    document.getElementById('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--card-accent:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

    // ✅ Recent Activity is rendered by renderActivityList() in activity.js
    // — that's the single source of truth for the #activity-list /
    // #activity-count markup (icons, categories, relative timestamps).
    // This used to duplicate that rendering inline using the older
    // {text, ts} entry field names, which is why it showed "undefined":
    // logActivity() has written {message, createdAt, ...} entries for a
    // while now, so a.text/a.ts were always empty here.
    renderActivityList();

    const upcoming = tasks.filter(t => !t.done).sort((a, b) => a.due > b.due ? 1 : -1).slice(0, 6);
    const upEl = document.getElementById('upcoming-tasks');
    if (!upcoming.length) {
        upEl.innerHTML =
            `<div class="empty-state" style="padding:40px 20px;"><span class="es-icon">✓</span><h3>All caught up!</h3><p>No pending tasks.</p></div>`;
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

