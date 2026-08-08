// ══════════════════════════════════════════════
//  NOTES — js/modules/notes.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  NOTES
// ══════════════════════════════════════════════

let activeNoteId = null;

// ── Comments vs. Revisions (Phase 7) ──────────────────────────────────
// Both live in the single `notes` table, distinguished by a `type` field
// ('comment' | 'revision') instead of separate storage, per the client
// spec. Notes saved before this feature existed have no `type` — treat
// those as plain 'comment' so nothing already stored disappears from
// either view.
function getNoteType(n) {
    return n?.type === 'revision' ? 'revision' : 'comment';
}

function getDealComments(dealId) {
    return notes.filter(n => n.dealId === dealId && getNoteType(n) === 'comment');
}

function getDealRevisions(dealId) {
    return notes.filter(n => n.dealId === dealId && getNoteType(n) === 'revision');
}

// Resolves the stage a note's linked task currently sits in, for
// permission checks (a note not linked to any task is unrestricted).
function getNoteStageKey(n) {
    const deal = n?.dealId ? deals.find(d => d.id === n.dealId) : null;
    return deal?.stage || null;
}

function canActOnNoteType(type, stageKey) {
    if (!stageKey) return true; // not linked to a task in any stage — unrestricted
    if (typeof isKanbanSuperuser === 'function' && isKanbanSuperuser()) return true;
    const checker = type === 'revision' ? canRevision : canComment;
    return typeof checker !== 'function' || checker(stageKey);
}

// ✅ Get current user's contact/employee ID
function getCurrentEmployeeId() {
    if (!currentUser) return null;
    return currentUser.contactId || currentUser.employeeId || null;
}

// ✅ Get current user's full name (Lastname, Firstname format)
function getCurrentUserFullName() {
    if (!currentUser) return '';
    const contactId = getCurrentEmployeeId();
    if (contactId) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) return `${contact.lname}, ${contact.fname}`;
    }
    return currentUser.name || currentUser.username || '';
}

// ✅ Get current user's fname and lname
function getCurrentUserFnameLname() {
    if (!currentUser) return { fname: '', lname: '' };
    const contactId = getCurrentEmployeeId();
    if (contactId) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) return { fname: contact.fname || '', lname: contact.lname || '' };
    }
    const name = currentUser.name || currentUser.username || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
        const lname = parts.pop();
        return { fname: parts.join(' '), lname };
    }
    return { fname: name, lname: '' };
}

// ✅ Get employees assigned to a task
function getTaskAssignedEmployees(dealId) {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return [];
    const contactIds = (deal.contactIds && deal.contactIds.length) ? deal.contactIds : (deal.contactId ? [deal.contactId] : []);
    return contacts.filter(c => contactIds.includes(c.id) && c.status === 'active');
}

// ✅ Get employee name by ID (returns "Lastname, Firstname")
function getEmployeeNameById(id) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return 'Unknown';
    return `${contact.lname}, ${contact.fname}`;
}

// ✅ Get employee full name (Firstname Lastname) for display
function getEmployeeFullName(id) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return 'Unknown';
    return `${contact.fname} ${contact.lname}`;
}

function openNoteModal(id, dealId, type) {
    const n = id ? notes.find(x => x.id === id) : null;
    const noteType = getNoteType(n || { type });
    const stageKey = n ? getNoteStageKey(n) : (dealId ? deals.find(d => d.id === dealId)?.stage : null);

    if (!canActOnNoteType(noteType, stageKey)) {
        toast(`You do not have ${noteType === 'revision' ? 'Revision' : 'Comment'} permission in this stage.`, 'error');
        return;
    }

    editingId = id || null;
    editingNoteType = noteType;

    // Opening the Note modal (fresh add, edit, or re-open) always clears
    // any leftover pending stage-move selection from a previous session —
    // mirrors openFileUploadModal's reset of pendingUploadStageMove.
    if (typeof pendingNoteStageMove !== 'undefined') pendingNoteStageMove = null;
    document.getElementById('note-modal-title').textContent =
        n ? `Edit ${noteType === 'revision' ? 'Revision' : 'Comment'}` : `Add ${noteType === 'revision' ? 'Revision' : 'Comment'}`;
    document.getElementById('n-title').value = n?.title || '';
    document.getElementById('n-content').value = n?.content || '';
    
    // ✅ Set done checkbox
    const doneCheckbox = document.getElementById('n-done');
    if (doneCheckbox) doneCheckbox.checked = !!n?.done;

    const typeSel = document.getElementById('n-type');
    if (typeSel) typeSel.value = noteType;

    // ✅ Filter linked employee dropdown based on task assignees
    const presetDealId = n?.dealId || dealId || '';
    const assignedEmployees = presetDealId ? getTaskAssignedEmployees(presetDealId) : [];
    
    const selC = document.getElementById('n-contact');
    selC.innerHTML = '<option value="">— None —</option>';
    
    // Show assigned employees first
    assignedEmployees.forEach(c => {
        const selected = n?.contactId === c.id ? 'selected' : '';
        selC.innerHTML += `<option value="${c.id}" ${selected}>${c.fname} ${c.lname} (Assigned)</option>`;
    });
    
    // Then show other employees (who are not assigned to the task)
    contacts.forEach(c => {
        if (!assignedEmployees.find(a => a.id === c.id)) {
            const selected = n?.contactId === c.id ? 'selected' : '';
            selC.innerHTML += `<option value="${c.id}" ${selected}>${c.fname} ${c.lname}</option>`;
        }
    });

    const selD = document.getElementById('n-deal');
    selD.innerHTML = '<option value="">— None —</option>' +
        deals.map(d => `<option value="${d.id}" ${presetDealId===d.id?'selected':''}>${d.title}</option>`).join('');

    // Lock the link when adding a fresh note directly from a deal card,
    // so the linked task can't be accidentally changed.
    const lockLink = !id && !!dealId;
    selD.disabled = lockLink;
    const lockHint = document.getElementById('n-deal-lock-hint');
    if (lockHint) lockHint.style.display = lockLink ? 'block' : 'none';

    // ✅ Display author info in modal
    const authorDisplay = document.getElementById('n-author-display');
    if (authorDisplay) {
        const currentName = getCurrentUserFullName();
        authorDisplay.textContent = currentName || 'Current User';
    }
    const dateDisplay = document.getElementById('n-date-display');
    if (dateDisplay) {
        dateDisplay.textContent = n ? new Date(n.createdAt).toLocaleString() : 'Now';
    }

    // Move-to-stage dropdown — only meaningful when this comment/revision
    // is linked to a task. renderNoteModalStageActions() (attachments.js)
    // clears the container when presetDealId is empty, so nothing shows
    // for notes opened from the general Notes page.
    if (typeof renderNoteModalStageActions === 'function') renderNoteModalStageActions(presetDealId);

    openModal('note-modal');
}

let editingNoteType = 'comment';

function saveNote() {
    const title = document.getElementById('n-title').value.trim();
    const content = document.getElementById('n-content').value.trim();
    if (!title || !content) { toast('Title and content required.', 'error'); return; }

    const dealId = document.getElementById('n-deal').value;
    const type = document.getElementById('n-type')?.value || editingNoteType || 'comment';
    const stageKey = dealId ? deals.find(d => d.id === dealId)?.stage : null;

    if (!canActOnNoteType(type, stageKey)) {
        toast(`You do not have ${type === 'revision' ? 'Revision' : 'Comment'} permission in this stage.`, 'error');
        return;
    }

    // ✅ Auto-set author to current user
    const currentContactId = getCurrentEmployeeId();
    const doneCheckbox = document.getElementById('n-done');
    const isDone = doneCheckbox ? doneCheckbox.checked : false;
    const { fname, lname } = getCurrentUserFnameLname();

    // ✅ Get linked employee name for activity message
    const linkedEmployeeId = document.getElementById('n-contact').value || currentContactId || '';

    const obj = {
        id: editingId || uid(),
        title: title,
        content: content,
        type: type,
        contactId: linkedEmployeeId,
        dealId: dealId,
        done: isDone,
        authorId: currentContactId || '',
        authorFname: fname,
        authorLname: lname,
        createdAt: editingId ? (notes.find(n => n.id === editingId)?.createdAt || new Date().toISOString()) :
            new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const label = type === 'revision' ? 'Revision' : 'Comment';
    const displayLabel = type === 'revision' ? 'Request Revision' : 'comment';
    const authorName = `${lname}, ${fname}`.trim() || 'System';
    
    if (editingId) {
        notes = notes.map(n => n.id === editingId ? obj : n);
        logActivity(`Updated ${label.toLowerCase()} <strong>${title}</strong>`, 'yellow');
        toast(`${label} updated.`, 'success');
    } else {
        notes.unshift(obj);
        
        // ✅ Log to task activity log using the writer – no manual logActivity
        if (dealId && typeof logTaskActivity === 'function') {
            const actionType = type === 'revision' ? 'revision' : 'comment';
            const taskTitle = deals.find(d => d.id === dealId)?.title || '';
            // Pass stageKey and linkedEmployeeId inside the data object
            logTaskActivity(dealId, actionType, {
                title: taskTitle,
                stage: stageKey,
                linkedEmployeeId: linkedEmployeeId
            });
        }
        // The writer already logs to the main activity feed, so we do NOT call logActivity here.
        toast(`${label} added.`, 'success');
    }
    
    // ✅ Save and refresh
    saveAll();

    // Apply the deferred stage move (if one was selected in this modal's
    // dropdown) only now that the comment/revision itself is fully saved
    // — see the deferMove doc comment on renderNoteModalStageActions in
    // attachments.js. Mirrors the same pattern in saveFileUpload().
    if (typeof pendingNoteStageMove !== 'undefined' && pendingNoteStageMove && dealId) {
        moveDealStage(dealId, pendingNoteStageMove);
        pendingNoteStageMove = null;
    }

    closeModal('note-modal');
    activeNoteId = obj.id;
    renderNotes();
    if (currentPage === 'dashboard') renderDashboard();
    if (currentPage === 'deals') renderKanban();
    if (currentDealNotesId) renderDealNotesModalList();
    // ✅ Pending (kanban.js#getUserTaskCounts) counts open/undone notes on
    // a task — adding one can flip a task in or out of Pending for its
    // assignee, so the sidebar/dashboard/profile counters need a refresh
    // here too, not just the Kanban board.
    if (typeof updateBadges === 'function') updateBadges();
}

function deleteNote(id) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    const type = getNoteType(n);
    const stageKey = getNoteStageKey(n);
    if (!canActOnNoteType(type, stageKey)) {
        toast(`You do not have ${type === 'revision' ? 'Revision' : 'Comment'} permission in this stage.`, 'error');
        return;
    }
    const label = type === 'revision' ? 'Revision' : 'Comment';
    confirmDelete(`Delete ${label.toLowerCase()} "${n?.title}"?`, () => {
        notes = notes.filter(x => x.id !== id);
        if (activeNoteId === id) activeNoteId = null;
        saveAll();
        logActivity(`${label} deleted: <strong>${n.title}</strong>`, 'red');
        toast(`${label} deleted.`);
        renderNotes();
        if (currentPage === 'dashboard') renderDashboard();
        if (currentPage === 'deals') renderKanban();
        if (currentDealNotesId) renderDealNotesModalList();
        // ✅ Same reasoning as saveNote() — deleting a note can change
        // whether a task counts as Pending for its assignee.
        if (typeof updateBadges === 'function') updateBadges();
    });
}

// ── Real-time granular updates (called from js/modules/socket-handler.js) ──
// Unlike saveNote()/deleteNote(), these do NOT call saveAll() or logActivity()
// — the write and its activity entry were already made by whoever originally
// triggered the change; we're just reflecting the result into this client's
// in-memory `notes` array and refreshing whatever's currently on screen.

function addNote(note) {
    if (!note || !note.id) return;
    if (notes.some(n => n.id === note.id)) { updateNote(note.id, note); return; }
    notes.unshift(note);

    if (currentPage === 'notes') renderNotes();
    if (currentPage === 'deals') renderKanban();
    if (currentDealNotesId && note.dealId === currentDealNotesId) renderDealNotesModalList();
    if (currentPage === 'dashboard') renderDashboard();
    if (typeof updateBadges === 'function') updateBadges();
}

function updateNote(id, newData) {
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) { addNote({ ...newData, id }); return; }
    notes[idx] = { ...notes[idx], ...newData };
    const dealId = notes[idx].dealId;

    if (currentPage === 'notes') renderNotes();
    if (currentPage === 'deals') renderKanban();
    if (currentDealNotesId && currentDealNotesId === dealId) renderDealNotesModalList();
    if (typeof updateBadges === 'function') updateBadges();
}

function removeNote(id) {
    const n = notes.find(x => x.id === id);
    notes = notes.filter(x => x.id !== id);
    if (activeNoteId === id) activeNoteId = null;

    if (currentPage === 'notes') renderNotes();
    if (currentPage === 'deals') renderKanban();
    if (currentDealNotesId && (!n || currentDealNotesId === n.dealId)) renderDealNotesModalList();
    if (typeof updateBadges === 'function') updateBadges();
}

function renderNotes() {
    const q = document.getElementById('note-search')?.value.toLowerCase() || '';
    const currentUserId = getCurrentEmployeeId();

    // ✅ Filter notes: show only notes where current user is the author OR the linked employee
    let list = notes.filter(n => {
        // Search filter
        const matchesSearch = n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        
        // ✅ Visibility filter: only show notes where current user is author or linked employee
        const isAuthor = n.authorId === currentUserId;
        const isLinkedEmployee = n.contactId === currentUserId;
        return isAuthor || isLinkedEmployee;
    });

    const countEl = document.getElementById('notes-count');
    if (countEl) countEl.textContent = list.length;

    const listEl = document.getElementById('notes-list');
    if (!listEl) return;
    
    if (!list.length) {
        listEl.innerHTML =
            `<div class="empty-state" style="padding:40px 20px;"><span class="es-icon">◫</span><p>${notes.length ? 'No results.' : 'No notes yet.'}</p></div>`;
        const detailEl = document.getElementById('note-detail');
        if (detailEl) {
            detailEl.innerHTML = `<div class="empty-state" style="height:100%;"><span class="es-icon">◫</span><h3>No notes</h3></div>`;
        }
        return;
    }

    if (!activeNoteId || !list.find(n => n.id === activeNoteId)) {
        activeNoteId = list[0]?.id || null;
    }

    listEl.innerHTML = list.map(n => {
        // ✅ Check if note is "done" for the current user
        const isDone = n.done === true;
        const isAuthor = n.authorId === currentUserId;
        const doneClass = isDone ? 'note-done' : '';
        const doneBadge = isDone ? '<span class="badge badge-success" style="font-size:0.6rem;margin-left:4px;">✓ Done</span>' : '';
        // ✅ Show author name if not current user
        const authorDisplay = isAuthor ? 'You' : (n.authorId ? getEmployeeNameById(n.authorId) : 'Unknown');
        
        return `
    <div class="note-list-item ${n.id === activeNoteId ? 'active' : ''} ${doneClass}" onclick="selectNote('${n.id}')">
      <div class="note-list-title">${n.title} ${noteTypeBadge(n)} ${doneBadge}</div>
      <div class="note-list-preview">${n.content.slice(0,60)}…</div>
      <div class="note-list-meta" style="font-size:0.65rem;color:var(--text3);margin-top:2px;">
        ✍️ ${authorDisplay}
        <span>📅 ${fmtShortDate(n.createdAt)}</span>
      </div>
    </div>
  `}).join('');

    renderNoteDetail();
}

// Comment/Revision badge (Phase 9 — UI enhancement).
function noteTypeBadge(n) {
    const type = getNoteType(n);
    return type === 'revision'
        ? `<span title="Revision" style="margin-left:4px;font-size:0.65rem;padding:1px 6px;border-radius:10px;background:var(--accent-soft, rgba(245,158,11,0.15));color:var(--text2);white-space:nowrap;">📝 Revision</span>`
        : `<span title="Comment" style="margin-left:4px;font-size:0.65rem;padding:1px 6px;border-radius:10px;background:var(--accent-soft, rgba(99,102,241,0.12));color:var(--text2);white-space:nowrap;">💬 Comment</span>`;
}

function selectNote(id) {
    activeNoteId = id;
    renderNotes();
}

function renderNoteDetail() {
    const n = notes.find(x => x.id === activeNoteId);
    const el = document.getElementById('note-detail');
    if (!n || !el) return;

    const cname = n.contactId ? getContactName(n.contactId) : '';
    const dname = n.dealId ? deals.find(d => d.id === n.dealId)?.title : '';
    // ✅ Use stored author name or look up by ID
    const authorName = n.authorId ? getEmployeeNameById(n.authorId) : 'Unknown';
    const isDone = n.done === true;
    const currentUserId = getCurrentEmployeeId();
    const isLinkedEmployee = n.contactId === currentUserId;
    const isAuthor = n.authorId === currentUserId;
    const canToggleDone = isLinkedEmployee || isAuthor;

    el.innerHTML = `
    <div class="notes-detail-header">
      <div>
        <div style="font-weight:700;font-size:0.95rem;">${n.title} ${noteTypeBadge(n)}</div>
        <div style="font-size:0.8rem;color:var(--text3);margin-top:4px;">
          <span>✍️ ${authorName}</span>
          ${cname ? `<span style="margin-left:8px;">👤 ${cname}</span>` : ''}
          ${dname ? `<span style="margin-left:8px;">📋 ${dname}</span>` : ''}
          <span style="margin-left:8px;">📅 ${fmtDate(n.createdAt)}</span>
        </div>
        ${isDone ? `<span class="badge badge-success" style="margin-top:4px;">✅ Done</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${canToggleDone ? `
          <label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleNoteDone('${n.id}', this.checked)" />
            Done
          </label>
        ` : ''}
        <button class="icon-btn" onclick="openNoteModal('${n.id}')">✎</button>
        <button class="icon-btn danger" onclick="deleteNote('${n.id}')">🗑</button>
      </div>
    </div>
    <div class="notes-detail-body" style="${isDone ? 'opacity:0.6;text-decoration:line-through;' : ''}">
      <div class="note-content-text">${n.content}</div>
    </div>
  `;
}

// ✅ Toggle note done status with enhanced activity logging
function toggleNoteDone(id, checked) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    
    // ✅ Only log if actually changing state
    if (n.done !== checked) {
        n.done = checked;
        n.updatedAt = new Date().toISOString();
        
        // ✅ Get task details for activity logging
        const taskTitle = n.dealId ? deals.find(d => d.id === n.dealId)?.title || '' : '';
        const noteType = getNoteType(n);
        
        if (checked) {
            // ✅ Marked as Done
            if (noteType === 'revision') {
                // ✅ Revision done: "MELANIE Checker revised/updated the task PAYROLL 2026-0701 TO 2026-0715 revision request of SALE INVOICE, JONELL"
                if (typeof logRevisionDone === 'function') {
                    logRevisionDone(taskTitle, n.title, n.authorId, n.contactId);
                } else {
                    // Fallback if logRevisionDone doesn't exist
                    const authorName = n.authorId ? getEmployeeNameById(n.authorId) : 'Unknown';
                    const actorName = getCurrentUserFullName();
                    logActivity(`${actorName} revised/updated the task <strong>${taskTitle}</strong> revision request of ${authorName}`, 'success');
                }
            } else {
                // ✅ Comment done: "MELANIE Checker confirms the task PAYROLL 2026-0701 TO 2026-0715 comment of SALE INVOICE, JONELL"
                if (typeof logCommentDone === 'function') {
                    logCommentDone(taskTitle, n.title, n.authorId, n.contactId);
                } else {
                    // Fallback if logCommentDone doesn't exist
                    const authorName = n.authorId ? getEmployeeNameById(n.authorId) : 'Unknown';
                    const actorName = getCurrentUserFullName();
                    logActivity(`${actorName} confirms the task <strong>${taskTitle}</strong> comment of ${authorName}`, 'success');
                }
            }
        } else {
            // ✅ Unchecked (reopened)
            const action = noteType === 'revision' ? 'reopened revision' : 'reopened comment';
            const actorName = getCurrentUserFullName();
            logActivity(`${actorName} ${action}: <strong>${n.title}</strong> on task <strong>${taskTitle}</strong>`, 'yellow');
        }
        
        saveAll();
        renderNotes();
        if (currentPage === 'deals') renderKanban();
        if (currentDealNotesId) renderDealNotesModalList();
        // ✅ This is the fix for "resolved my open comments/revisions but
        // Pending still shows 2" — marking a note done/undone changes
        // whether its task counts as Pending (getUserTaskCounts checks
        // notes with done !== true), but nothing here was refreshing the
        // sidebar/dashboard/profile counters, only the Kanban board (and
        // only if you happened to be on that page).
        if (typeof updateBadges === 'function') updateBadges();
    }
}