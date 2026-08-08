// ══════════════════════════════════════════════
//  PROFILE — js/modules/profile.js
//  "My Profile" page: shows the logged-in user's own account + employee
//  details, lets them change their OWN password only, and surfaces a
//  personal slice of the data already loaded client-side (recent
//  activity, active tasks, pending comments/revisions).
//
//  Depends on: session.js (currentUser, getCurrentEmployeeId), notes.js
//  (getCurrentUserFullName, getNoteType, noteTypeBadge, getEmployeeNameById),
//  helpers.js (fmtDate, fmtShortDate, statusBadge, priorityBadge, toast),
//  activity.js (logActivity + whatever global holds the activity feed),
//  roles.js (getRoleName), departments.js (getDepartmentName). Loaded as
//  a classic script, shares the global scope — load AFTER users.js.
//
//  This module never lets a user change anyone's password but their own:
//  it looks up the record matching currentUser (by id, falling back to
//  username) inside the `users` array and only ever mutates that one row.
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

        const today = new Date().toISOString().slice(0, 10);
        listEl.innerHTML = myDeals.map(d => {
            const stageLabel = (typeof stages !== 'undefined' ? stages.find(s => s.key === d.stage)?.label : '') || d.stage || '';
            const isOverdue = d.due && d.due < today;
            return `
          <div class="task-item" style="cursor:pointer;" onclick="${typeof openDealViewOnly === 'function' ? `openDealViewOnly('${d.id}')` : `navigate('deals')`}">
            <div class="task-body">
              <div class="task-title">${d.title}</div>
              <div class="task-meta">
                <span class="task-due ${isOverdue ? 'overdue' : ''}">📅 ${(typeof fmtDate === 'function') ? fmtDate(d.due) : d.due}</span>
                <span class="task-assignee">🗂 ${stageLabel}</span>
                ${(typeof priorityBadge === 'function') ? priorityBadge(d.priority) : ''}
              </div>
            </div>
          </div>
        `;
        }).join('');
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

console.log('✅ Profile module loaded');