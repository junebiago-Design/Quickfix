// ══════════════════════════════════════════════
//  PROFILE — js/modules/profile.js
//  UPDATED: My Active Tasks now rendered as
//  deal cards (matching kanban.js design).
// ══════════════════════════════════════════════

// ── Small local helpers (defensive) ───────────────────────────────────

function profileGetMyUserRecord() {
    if (!currentUser || typeof users === 'undefined') return null;
    return users.find(u => u.id === currentUser.id) ||
           users.find(u => u.username === currentUser.username) ||
           null;
}

function profileGetMyEmployeeRecord() {
    const empId = (typeof getCurrentEmployeeId === 'function') ? getCurrentEmployeeId() : (currentUser?.employeeId || null);
    if (!empId || typeof contacts === 'undefined') return null;
    return contacts.find(c => c.id === empId) || null;
}

function profileGetActivityFeed() {
    if (typeof activity !== 'undefined' && Array.isArray(activity)) return activity;
    if (typeof activityLog !== 'undefined' && Array.isArray(activityLog)) return activityLog;
    if (typeof activities !== 'undefined' && Array.isArray(activities)) return activities;
    return [];
}

function profileGetMyRecentActivity(limit) {
    const fullName = (typeof getCurrentUserFullName === 'function') ? getCurrentUserFullName() : '';
    const feed = profileGetActivityFeed();
    if (!fullName || !feed.length) return [];
    return feed
        .filter(a => (a.message || '').includes(fullName))
        .slice(0, limit || 15);
}

function profileGetMyDeals() {
    const empId = (typeof getCurrentEmployeeId === 'function') ? getCurrentEmployeeId() : (currentUser?.employeeId || null);
    if (!empId || typeof deals === 'undefined') return [];
    return deals.filter(d => {
        const ids = (d.contactIds && d.contactIds.length) ? d.contactIds : (d.contactId ? [d.contactId] : []);
        return ids.includes(empId);
    });
}

function profileGetMyPendingNotes() {
    const empId = (typeof getCurrentEmployeeId === 'function') ? getCurrentEmployeeId() : (currentUser?.employeeId || null);
    if (!empId || typeof notes === 'undefined') return [];
    return notes.filter(n => (n.authorId === empId || n.contactId === empId) && n.done !== true);
}

function profileInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Deal card HTML (matching kanban.js style) ─────────────────────────

function profileDealCardHTML(d) {
    const dealContactIds = (d.contactIds && d.contactIds.length) ? d.contactIds : (d.contactId ? [d.contactId] : []);
    const currentEmpId = (typeof getCurrentEmployeeId === 'function') ? getCurrentEmployeeId() : null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdue = d.due && d.due < todayStr;

    // Assignee badges
    const assigneeBadges = dealContactIds.map(id => {
        const contact = contacts.find(c => c.id === id);
        if (!contact) return '';
        const isCurrentUser = id === currentEmpId;
        return `<span class="assignee-badge ${isCurrentUser ? 'current-user-assignee' : ''}" title="${contact.fname} ${contact.lname}">
            ${isCurrentUser ? '⭐ ' : ''}${contact.fname} ${contact.lname}
        </span>`;
    }).filter(Boolean).join(' ');

    // Notes count
    const dealNotes = notes.filter(n => n.dealId === d.id);
    const revisionCount = dealNotes.filter(n => getNoteType(n) === 'revision').length;
    const commentCount = dealNotes.filter(n => getNoteType(n) === 'comment').length;
    const doneCount = dealNotes.filter(n => n.done === true).length;
    const notesBadge = dealNotes.length ?
        `<span class="deal-notes-count">${dealNotes.length} ${doneCount > 0 ? `(✓${doneCount})` : ''}</span>` :
        '';

    // Files count (if available)
    let filesCount = 0;
    if (typeof getDealFiles === 'function') {
        filesCount = getDealFiles(d.id).length;
    }

    // Stage label
    const stageLabel = stages.find(s => s.key === d.stage)?.label || d.stage || '';

    return `
        <div class="deal-card" style="cursor:pointer;" onclick="${typeof openDealViewOnly === 'function' ? `openDealViewOnly('${d.id}')` : `navigate('deals')`}">
            <div class="deal-card-title">${d.title}</div>
            ${d.desc ? `<div class="deal-card-desc">${d.desc}</div>` : ''}

            <div class="deal-card-assignees">
                ${assigneeBadges || '<span class="text-muted" style="font-size:0.7rem;">Unassigned</span>'}
            </div>

            ${d.department ? `<div class="deal-card-company">🏢 ${getDepartmentName(d.department)}</div>` : ''}
            ${stageLabel ? `<div class="deal-card-company">🗂 ${stageLabel}</div>` : ''}

            <div class="deal-card-meta">
                <span class="task-due ${isOverdue ? 'overdue' : ''}" style="font-family:'DM Mono',monospace;">📅 ${fmtDate(d.due)}</span>
                ${priorityBadge(d.priority)}
            </div>

            <div class="deal-card-notes-row">
                <span class="deal-notes-toggle" style="cursor:default;">
                    <span>💬 Notes</span>
                    ${notesBadge}
                </span>
                ${typeof getDealFiles === 'function' ? `
                <span class="deal-notes-toggle" style="cursor:default;">
                    <span>📎 Files</span>
                    <span class="deal-notes-count">${filesCount}</span>
                </span>` : ''}
            </div>
        </div>
    `;
}

// ── Main render ───────────────────────────────────────────────────────

function renderProfile() {
    try {
        if (!currentUser) {
            console.warn('renderProfile: no currentUser');
            return;
        }

        const myUser = profileGetMyUserRecord();
        const emp = profileGetMyEmployeeRecord();

        const displayName = emp ? `${emp.fname} ${emp.lname}` : (currentUser.name || currentUser.username);
        const roleName = (typeof getRoleName === 'function') ? getRoleName(currentUser.role) : (currentUser.roleName || currentUser.role || '—');

        // Header
        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl) avatarEl.textContent = profileInitials(displayName);
        const nameEl = document.getElementById('profile-fullname');
        if (nameEl) nameEl.textContent = displayName;
        const usernameEl = document.getElementById('profile-username');
        if (usernameEl) usernameEl.textContent = '@' + (currentUser.username || myUser?.username || '');
        const roleEl = document.getElementById('profile-role');
        if (roleEl) roleEl.textContent = roleName;
        const statusBadgeEl = document.getElementById('profile-status-badge');
        if (statusBadgeEl) {
            const status = myUser?.status || emp?.status || 'active';
            statusBadgeEl.innerHTML = (typeof statusBadge === 'function') ? statusBadge(status) :
                `<span class="badge badge-${status === 'active' ? 'active' : 'inactive'}">${status}</span>`;
        }

        // Employee details
        const detailsEl = document.getElementById('profile-employee-details');
        if (detailsEl) {
            if (emp) {
                const companyName = (typeof getCompanyName === 'function') ? getCompanyName(emp.company) : (emp.company || '—');
                const deptName = (typeof getDepartmentName === 'function') ? getDepartmentName(emp.department) : (emp.department || '—');
                detailsEl.innerHTML = `
                    <div><span class="text-muted">Email</span><br>${emp.email || '—'}</div>
                    <div><span class="text-muted">Phone</span><br>${emp.phone || '—'}</div>
                    <div><span class="text-muted">Company</span><br>${companyName || '—'}</div>
                    <div><span class="text-muted">Department</span><br>${deptName || '—'}</div>
                    <div><span class="text-muted">Employee Status</span><br>${(typeof statusBadge === 'function') ? statusBadge(emp.status) : (emp.status || '—')}</div>
                    <div><span class="text-muted">Joined</span><br>${(typeof fmtDate === 'function') ? fmtDate(emp.createdAt) : (emp.createdAt || '—')}</div>
                `;
            } else {
                detailsEl.innerHTML = `<div style="grid-column:1/-1;color:var(--text3);">No linked employee record for this account.</div>`;
            }
        }

        renderProfileTasks();
        renderProfileNotes();
        renderProfileActivity();
    } catch (err) {
        console.error('Error in renderProfile:', err);
        const container = document.getElementById('page-profile');
        if (container) {
            container.innerHTML = `<div class="empty-state" style="padding:40px;"><span class="es-icon">⚠️</span><h3>Error loading profile</h3><p>${err.message}</p></div>`;
        }
    }
}

// ── Render My Active Tasks as deal cards ─────────────────────────────

function renderProfileTasks() {
    const listEl = document.getElementById('profile-tasks-list');
    const countEl = document.getElementById('profile-tasks-count');
    if (!listEl) return;

    try {
        const myDeals = profileGetMyDeals();
        if (countEl) countEl.textContent = myDeals.length;

        if (!myDeals.length) {
            listEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">📋</span><p>No tasks assigned to you.</p></div>`;
            return;
        }

        // Render each deal as a card (similar to kanban.js)
        listEl.innerHTML = myDeals.map(d => profileDealCardHTML(d)).join('');
    } catch (err) {
        console.error('Error in renderProfileTasks:', err);
        listEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">⚠️</span><p>Error loading tasks</p></div>`;
    }
}

function renderProfileNotes() {
    const listEl = document.getElementById('profile-notes-list');
    const countEl = document.getElementById('profile-notes-count');
    if (!listEl) return;

    try {
        const pending = profileGetMyPendingNotes();
        if (countEl) countEl.textContent = pending.length;

        if (!pending.length) {
            listEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">◫</span><p>Nothing pending — you're all caught up.</p></div>`;
            return;
        }

        listEl.innerHTML = pending.map(n => {
            const taskTitle = n.dealId && typeof deals !== 'undefined' ? (deals.find(d => d.id === n.dealId)?.title || '') : '';
            const badge = (typeof noteTypeBadge === 'function') ? noteTypeBadge(n) : '';
            return `
          <div class="note-list-item" style="cursor:pointer;" onclick="navigate('notes'); if (typeof selectNote === 'function') selectNote('${n.id}');">
            <div class="note-list-title">${n.title} ${badge}</div>
            ${taskTitle ? `<div class="note-list-preview">On task: ${taskTitle}</div>` : ''}
          </div>
        `;
        }).join('');
    } catch (err) {
        console.error('Error in renderProfileNotes:', err);
        listEl.innerHTML = `<div class="empty-state" style="padding:30px 20px;"><span class="es-icon">⚠️</span><p>Error loading notes</p></div>`;
    }
}

function renderProfileActivity() {
    const listEl = document.getElementById('profile-activity-list');
    const countEl = document.getElementById('profile-activity-count');
    if (!listEl) return;

    try {
        const items = profileGetMyRecentActivity(15);
        if (countEl) countEl.textContent = items.length;

        if (!items.length) {
            listEl.innerHTML = `<li class="empty-state" style="padding:40px 20px;"><span class="es-icon">◌</span><p>No activity yet from your account.</p></li>`;
            return;
        }

        const timeFn = (typeof fmtRelativeTime === 'function') ? fmtRelativeTime :
                       (typeof fmtShortDate === 'function') ? fmtShortDate :
                       (iso => iso || '');

        listEl.innerHTML = items.map(a => `
            <li class="activity-item activity-${a.color || 'accent'}">
                <span class="activity-icon">${a.icon || '•'}</span>
                <div class="activity-message">${a.message || ''}</div>
                <span class="activity-time">${timeFn(a.createdAt)}</span>
            </li>
        `).join('');
    } catch (err) {
        console.error('Error in renderProfileActivity:', err);
        listEl.innerHTML = `<li class="empty-state" style="padding:40px 20px;"><span class="es-icon">⚠️</span><p>Error loading activity</p></li>`;
    }
}

// ── Self-service password change ─────────────────────────────────────

function changeMyPassword() {
    try {
        const currentInput = document.getElementById('profile-current-password');
        const newInput = document.getElementById('profile-new-password');
        const confirmInput = document.getElementById('profile-confirm-password');

        const currentVal = currentInput?.value || '';
        const newVal = newInput?.value || '';
        const confirmVal = confirmInput?.value || '';

        const myUser = profileGetMyUserRecord();
        if (!myUser) { toast('Could not find your user account.', 'error'); return; }

        if (!currentVal || !newVal || !confirmVal) {
            toast('Please fill in all password fields.', 'error');
            return;
        }
        if (myUser.password !== currentVal) {
            toast('Current password is incorrect.', 'error');
            return;
        }
        if (newVal.length < 4) {
            toast('New password must be at least 4 characters.', 'error');
            return;
        }
        if (newVal !== confirmVal) {
            toast('New passwords do not match.', 'error');
            return;
        }
        if (newVal === currentVal) {
            toast('New password must be different from the current password.', 'error');
            return;
        }

        myUser.password = newVal;
        saveAll();

        const fullName = (typeof getCurrentUserFullName === 'function') ? getCurrentUserFullName() : (currentUser.name || currentUser.username);
        logActivity(`${fullName} updated their password`, 'yellow');
        toast('Password updated successfully.', 'success');

        if (currentInput) currentInput.value = '';
        if (newInput) newInput.value = '';
        if (confirmInput) confirmInput.value = '';
    } catch (err) {
        console.error('Error changing password:', err);
        toast('An error occurred while changing password.', 'error');
    }
}

// Expose globally
window.renderProfile = renderProfile;
window.changeMyPassword = changeMyPassword;

console.log('✅ Profile module loaded (with deal-card style tasks)');