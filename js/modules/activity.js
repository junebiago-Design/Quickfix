// ══════════════════════════════════════════════
//  ACTIVITY — js/modules/activity.js
//  ADDED: renderRecentActivityList(limit) for dashboard
// ══════════════════════════════════════════════

const ACTIVITY_MAX_ENTRIES = 200;
const ACTIVITY_PER_PAGE = 20;

// Pagination state
let activityCurrentPage = 1;
let activityTotalPages = 1;

// ── DEDUPLICATION CACHE ──────────────────────────────────────────────
let displayedActivityIds = new Set();

const ACTIVITY_CATEGORY_RULES = [
    { category: 'permission', icon: '🔐', test: m => /permission/i.test(m) },
    { category: 'revision', icon: '📝', test: m => /revision/i.test(m) },
    { category: 'comment', icon: '💬', test: m => /comment/i.test(m) },
    { category: 'role', icon: '🧩', test: m => /\brole\b/i.test(m) },
    { category: 'stage', icon: '📋', test: m => /\bstage\b/i.test(m) },
    { category: 'task', icon: '◈', test: m => /\btask\b/i.test(m) },
    { category: 'task-move', icon: '<i class="bi bi-arrow-up-right-square"></i>', test: m => /\bmoved\b/i.test(m) },
    { category: 'file', icon: '📎', test: m => /\bfile\b/i.test(m) },
    { category: 'done', icon: '✅', test: m => /done|confirm|revised|confirms/i.test(m) },
];

function inferActivityCategory(message) {
    const plain = (message || '').replace(/<[^>]*>/g, '');
    const rule = ACTIVITY_CATEGORY_RULES.find(r => r.test(plain));
    return rule ? { category: rule.category, icon: rule.icon } : { category: 'general', icon: '•' };
}

function getCurrentEmployeeId() {
    if (typeof currentUser === 'undefined' || !currentUser) return null;
    return currentUser.contactId || currentUser.employeeId || null;
}

function getEmployeeNameById(id) {
    if (typeof contacts === 'undefined') return 'Unknown';
    const contact = contacts.find(c => c.id === id);
    if (!contact) return 'Unknown';
    return `${contact.lname}, ${contact.fname}`;
}

function getEmployeeFullName(id) {
    if (typeof contacts === 'undefined') return 'Unknown';
    const contact = contacts.find(c => c.id === id);
    if (!contact) return 'Unknown';
    return `${contact.fname} ${contact.lname}`;
}

function getActorDisplayName() {
    if (typeof currentUser === 'undefined' || !currentUser) return '';

    if (currentUser.employeeId && typeof contacts !== 'undefined') {
        const contact = contacts.find(c => c.id === currentUser.employeeId);
        if (contact) return `${contact.lname}, ${contact.fname}`;
    }

    if (currentUser.name) {
        const parts = currentUser.name.trim().split(/\s+/);
        if (parts.length > 1) {
            const lname = parts.pop();
            return `${lname}, ${parts.join(' ')}`;
        }
        return currentUser.name;
    }

    return currentUser.username || '';
}

function getActorFullName() {
    if (typeof currentUser === 'undefined' || !currentUser) return '';

    if (currentUser.employeeId && typeof contacts !== 'undefined') {
        const contact = contacts.find(c => c.id === currentUser.employeeId);
        if (contact) return `${contact.fname} ${contact.lname}`;
    }

    return currentUser.name || currentUser.username || '';
}

function logActivity(message, color) {
    if (typeof activity === 'undefined') { console.warn('logActivity: global `activity` array not found.'); return; }
    const actorName = getActorDisplayName();
    
    let fullMessage = message;
    if (actorName && !message.startsWith(actorName)) {
        fullMessage = `${actorName} ${message}`;
    }
    const { category, icon } = inferActivityCategory(fullMessage);

    const entry = {
        id: (typeof uid === 'function') ? uid() : String(Date.now()) + Math.random().toString(16).slice(2),
        message: fullMessage,
        color: color || 'accent',
        category,
        icon,
        createdAt: new Date().toISOString(),
        actorRole: (typeof currentUser !== 'undefined' && currentUser?.role) || '',
    };

    displayedActivityIds.add(entry.id);
    
    activity.unshift(entry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (typeof saveAll === 'function') saveAll();
    
    activityCurrentPage = 1;
    renderActivityList();
    if (typeof updateBadges === 'function') updateBadges();
}

function logNoteActivity(type, title, dealId, linkedEmployeeId, color) {
    if (typeof activity === 'undefined') { console.warn('logNoteActivity: global `activity` array not found.'); return; }
    
    const actorName = getActorDisplayName();
    const displayLabel = type === 'revision' ? 'Request Revision' : 'comment';
    const taskTitle = dealId ? (typeof deals !== 'undefined' ? deals.find(d => d.id === dealId)?.title || '' : '') : '';
    const linkedEmployeeName = linkedEmployeeId ? getEmployeeFullName(linkedEmployeeId) : '';
    
    let message = '';
    if (taskTitle && linkedEmployeeName) {
        message = `${actorName} created ${displayLabel} for ${linkedEmployeeName} to task <strong>${taskTitle}</strong>`;
    } else if (taskTitle) {
        message = `${actorName} created ${displayLabel} to task <strong>${taskTitle}</strong>`;
    } else if (linkedEmployeeName) {
        message = `${actorName} created ${displayLabel} for ${linkedEmployeeName}`;
    } else {
        message = `${actorName} created ${displayLabel}`;
    }
    
    const { category, icon } = inferActivityCategory(message);
    const entry = {
        id: (typeof uid === 'function') ? uid() : String(Date.now()).concat(Math.random().toString(16).slice(2)),
        message: message,
        color: color || (type === 'revision' ? 'orange' : 'accent'),
        category: type === 'revision' ? 'revision' : 'comment',
        icon: type === 'revision' ? '📝' : '💬',
        createdAt: new Date().toISOString(),
        actorRole: (typeof currentUser !== 'undefined' && currentUser?.role) || '',
    };

    displayedActivityIds.add(entry.id);
    activity.unshift(entry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (typeof saveAll === 'function') saveAll();
    
    activityCurrentPage = 1;
    renderActivityList();
    if (typeof updateBadges === 'function') updateBadges();
}

function logCommentDone(taskTitle, commentTitle, commentAuthorId, linkedEmployeeId) {
    if (typeof activity === 'undefined') { console.warn('logCommentDone: global `activity` array not found.'); return; }
    
    const actorName = getActorDisplayName();
    const commentAuthorName = commentAuthorId ? getEmployeeNameById(commentAuthorId) : 'Unknown';
    
    let message = '';
    if (commentAuthorName && taskTitle) {
        message = `${actorName} confirms the task <strong>${taskTitle}</strong> comment of ${commentAuthorName}`;
    } else if (taskTitle) {
        message = `${actorName} confirms the comment on task <strong>${taskTitle}</strong>`;
    } else {
        message = `${actorName} confirmed a comment`;
    }
    
    const entry = {
        id: (typeof uid === 'function') ? uid() : String(Date.now()).concat(Math.random().toString(16).slice(2)),
        message: message,
        color: 'success',
        category: 'done',
        icon: '✅',
        createdAt: new Date().toISOString(),
        actorRole: (typeof currentUser !== 'undefined' && currentUser?.role) || '',
    };

    displayedActivityIds.add(entry.id);
    activity.unshift(entry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (typeof saveAll === 'function') saveAll();
    
    activityCurrentPage = 1;
    renderActivityList();
    if (typeof updateBadges === 'function') updateBadges();
}

// Logged when a task moves out of the area an assigned employee's role
// can see (task-activity-writer.js#processAssigneeLifecycle).
function logTaskCompletionActivity(lname, fname, taskTitle) {
    if (typeof activity === 'undefined') { console.warn('logTaskCompletionActivity: global `activity` array not found.'); return; }

    const employeeLabel = `${lname || ''}, ${fname || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '').trim() || 'Unknown';
    const message = `${employeeLabel} Completed <strong>${taskTitle || 'a task'}</strong>`;

    const entry = {
        id: (typeof uid === 'function') ? uid() : String(Date.now()).concat(Math.random().toString(16).slice(2)),
        message,
        color: 'success',
        category: 'done',
        icon: '✅',
        createdAt: new Date().toISOString(),
        actorRole: (typeof currentUser !== 'undefined' && currentUser?.role) || '',
    };

    displayedActivityIds.add(entry.id);
    activity.unshift(entry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (typeof saveAll === 'function') saveAll();

    activityCurrentPage = 1;
    renderActivityList();
    if (typeof updateBadges === 'function') updateBadges();
}

function logRevisionDone(taskTitle, revisionTitle, revisionAuthorId, linkedEmployeeId) {
    if (typeof activity === 'undefined') { console.warn('logRevisionDone: global `activity` array not found.'); return; }
    
    const actorName = getActorDisplayName();
    const revisionAuthorName = revisionAuthorId ? getEmployeeNameById(revisionAuthorId) : 'Unknown';
    
    let message = '';
    if (revisionAuthorName && taskTitle) {
        message = `${actorName} revised/updated the task <strong>${taskTitle}</strong> revision request of ${revisionAuthorName}`;
    } else if (taskTitle) {
        message = `${actorName} revised/updated the task <strong>${taskTitle}</strong>`;
    } else {
        message = `${actorName} completed a revision`;
    }
    
    const entry = {
        id: (typeof uid === 'function') ? uid() : String(Date.now()).concat(Math.random().toString(16).slice(2)),
        message: message,
        color: 'success',
        category: 'done',
        icon: '✅',
        createdAt: new Date().toISOString(),
        actorRole: (typeof currentUser !== 'undefined' && currentUser?.role) || '',
    };

    displayedActivityIds.add(entry.id);
    activity.unshift(entry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (typeof saveAll === 'function') saveAll();
    
    activityCurrentPage = 1;
    renderActivityList();
    if (typeof updateBadges === 'function') updateBadges();
}

function getActivity(category) {
    if (typeof activity === 'undefined') return [];
    return category ? activity.filter(a => a.category === category) : activity;
}

function getActivityCount(category) {
    return getActivity(category).length;
}

// Get paginated activity data
function getPaginatedActivity() {
    if (typeof activity === 'undefined' || !activity.length) {
        return { items: [], total: 0, currentPage: 1, totalPages: 1 };
    }

    const sorted = activity.slice().sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));

    const total = sorted.length;
    const totalPages = Math.ceil(total / ACTIVITY_PER_PAGE);
    
    if (activityCurrentPage < 1) activityCurrentPage = 1;
    if (activityCurrentPage > totalPages) activityCurrentPage = totalPages;
    
    const start = (activityCurrentPage - 1) * ACTIVITY_PER_PAGE;
    const end = start + ACTIVITY_PER_PAGE;
    const items = sorted.slice(start, end);
    
    return {
        items,
        total,
        currentPage: activityCurrentPage,
        totalPages: totalPages > 0 ? totalPages : 1
    };
}

// Render activity with pagination (used on the dedicated activity page)
function renderActivityList() {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    const countEl = document.getElementById('activity-count');
    const paginationEl = document.getElementById('activity-pagination');
    
    const { items, total, currentPage, totalPages } = getPaginatedActivity();
    
    if (countEl) {
        countEl.textContent = total > 0 ? `${total} total` : '';
    }

    if (!total) {
        listEl.innerHTML = `
            <li class="empty-state" style="padding:40px 20px;">
                <span class="es-icon">◌</span>
                <p>No activity yet. Start by adding employees or tasks.</p>
            </li>`;
        if (paginationEl) paginationEl.innerHTML = '';
        displayedActivityIds.clear();
        return;
    }

    // Render items
    listEl.innerHTML = items.map(a => {
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
                <span class="activity-time">${(typeof fmtRelativeTime === 'function') ? fmtRelativeTime(a.createdAt || a.ts) : (typeof fmtDate === 'function' ? fmtDate(a.createdAt || a.ts) : (a.createdAt || a.ts))}</span>
            </li>
        `;
    }).join('');

    if (paginationEl) {
        paginationEl.innerHTML = buildSimplifiedPagination(currentPage, totalPages, total);
    }
}

// ── NEW: Render a simple list of recent activity (no pagination) ──
// Used by the dashboard to show the latest N entries.
function renderRecentActivityList(limit = 10, containerId = 'dashboard-activity-list', countId = 'dashboard-activity-count') {
    const listEl = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    if (!listEl) return;

    let allActivity = [];
    if (typeof activity !== 'undefined' && Array.isArray(activity)) {
        allActivity = activity.slice();
    }

    if (countEl) countEl.textContent = allActivity.length;

    if (!allActivity.length) {
        listEl.innerHTML = `<li class="empty-state" style="padding:40px 20px;">
            <span class="es-icon">◌</span>
            <p>No activity yet. Start by adding employees or tasks.</p>
        </li>`;
        return;
    }

    // Sort newest first and take the limit
    const sorted = allActivity.sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sorted.slice(0, limit);

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

// Insert a remotely-created activity entry
function prependActivity(activityEntry) {
    if (typeof activity === 'undefined' || !activityEntry) return;
    
    if (activity.some(a => a.id === activityEntry.id)) return;
    if (displayedActivityIds.has(activityEntry.id)) return;

    displayedActivityIds.add(activityEntry.id);
    
    activity.unshift(activityEntry);
    if (activity.length > ACTIVITY_MAX_ENTRIES) {
        const removed = activity.splice(ACTIVITY_MAX_ENTRIES);
        removed.forEach(e => displayedActivityIds.delete(e.id));
    }

    if (activityCurrentPage === 1) {
        renderActivityList();
    } else {
        const countEl = document.getElementById('activity-count');
        if (countEl) countEl.textContent = `${activity.length} total`;
        const paginationEl = document.getElementById('activity-pagination');
        if (paginationEl) {
            const totalPages = Math.max(1, Math.ceil(activity.length / ACTIVITY_PER_PAGE));
            paginationEl.innerHTML = buildSimplifiedPagination(activityCurrentPage, totalPages, activity.length);
        }
    }

    if (typeof updateBadges === 'function') updateBadges();
}

function buildSimplifiedPagination(currentPage, totalPages, total) {
    if (totalPages <= 1) {
        return `<span style="font-size:0.75rem;color:var(--text3);">Showing all ${total} logs</span>`;
    }
    
    const start = (currentPage - 1) * ACTIVITY_PER_PAGE + 1;
    const end = Math.min(currentPage * ACTIVITY_PER_PAGE, total);
    
    let html = `<span style="font-size:0.75rem;color:var(--text3);margin-right:12px;">Showing ${start}–${end} of ${total}</span>`;
    
    html += `<button class="btn btn-sm btn-ghost" onclick="goToActivityPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>‹ Prev</button>`;
    html += `<button class="btn btn-sm btn-ghost" onclick="goToActivityPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Next ›</button>`;
    
    return html;
}

function goToActivityPage(page) {
    if (typeof activity === 'undefined') return;
    const total = activity.length;
    const totalPages = Math.ceil(total / ACTIVITY_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    activityCurrentPage = page;
    renderActivityList();
}

function resetActivityPagination() {
    activityCurrentPage = 1;
    renderActivityList();
}

function renderFilteredActivityList(filterFn) {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    const filtered = typeof filterFn === 'function' ? activity.filter(filterFn) : activity;

    if (!filtered.length) {
        listEl.innerHTML = `
            <li class="empty-state" style="padding:40px 20px;">
                <span class="es-icon">◌</span>
                <p>No activity matches your filter.</p>
            </li>`;
        return;
    }

    const sortedFiltered = filtered.slice().sort((a, b) => new Date(b.createdAt || b.ts) - new Date(a.createdAt || a.ts));
    const displayItems = sortedFiltered.slice(0, 50);

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
                <span class="activity-time">${(typeof fmtRelativeTime === 'function') ? fmtRelativeTime(a.createdAt || a.ts) : (typeof fmtDate === 'function' ? fmtDate(a.createdAt || a.ts) : (a.createdAt || a.ts))}</span>
            </li>
        `;
    }).join('');
}

function clearActivityCache() {
    displayedActivityIds.clear();
    renderActivityList();
}

// ── DASHBOARD AUTO‑REFRESH ────────────────────────────────────────────
let dashboardActivityRefreshInterval = null;

function startDashboardActivityAutoRefresh() {
    if (dashboardActivityRefreshInterval) clearInterval(dashboardActivityRefreshInterval);
    dashboardActivityRefreshInterval = setInterval(async () => {
        const dashPage = document.getElementById('page-dashboard');
        if (!dashPage || !dashPage.classList.contains('active')) return;
        if (typeof reloadAllData !== 'function') return;
        
        await reloadAllData();
        // Re-render the dashboard activity list (and other parts if needed)
        if (typeof renderDashboard === 'function') {
            renderDashboard();
        } else {
            renderActivityList();
        }
        if (typeof updateBadges === 'function') updateBadges();
    }, 15000);
}

if (typeof document !== 'undefined') {
    startDashboardActivityAutoRefresh();
}

// ── EXPOSE GLOBALS ─────────────────────────────────────────────────────
window.startDashboardActivityAutoRefresh = startDashboardActivityAutoRefresh;
window.logActivity = logActivity;
window.logNoteActivity = logNoteActivity;
window.logCommentDone = logCommentDone;
window.logRevisionDone = logRevisionDone;
window.logTaskCompletionActivity = logTaskCompletionActivity;
window.renderActivityList = renderActivityList;
window.renderRecentActivityList = renderRecentActivityList; // new export
window.prependActivity = prependActivity;
window.goToActivityPage = goToActivityPage;
window.resetActivityPagination = resetActivityPagination;
window.getPaginatedActivity = getPaginatedActivity;
window.clearActivityCache = clearActivityCache;