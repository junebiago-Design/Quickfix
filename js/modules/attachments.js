// ══════════════════════════════════════════════
//  ATTACHMENTS — js/modules/attachments.js
//  Part of app.js module split.
//  Depends on: js/api.js (files/activity tables, saveAll, save),
//  permissions.js (canUpload, isSystemAdmin), kanban.js
//  (isKanbanSuperuser, openModal/closeModal, getContactName, fmtDate),
//  and currentUser from session.js. Shares the global scope (classic
//  scripts) — mirrors notes.js's structure closely, per
//  upload_file_features.md ("replicate note.js modal").
//
//  The "Move task to" dropdown + deferred-save pattern (pendingUploadStageMove
//  / pendingNoteStageMove, getPendingStageMove/setPendingStageMove,
//  refreshDeferredStageActions) is shared between the Upload modal here
//  and the Note (comment/revision) modal in notes.js: selecting a stage
//  never moves the task immediately — it's staged locally and only
//  applied via moveDealStage() once the underlying save (file upload /
//  note) has actually succeeded. See saveFileUpload() below and
//  saveNote() in notes.js.
//
//  Files are NOT synced through the normal whole-db load/save cycle in
//  the usual sense — api.php exposes dedicated multipart endpoints
//  (uploadFile / deleteFile / updateFile / getTaskFiles / downloadFile)
//  that write straight to tms_files.json + tms_activity.json on the
//  server, because a <input type=file> can't ride along inside the
//  base64 JSON blob the rest of the app saves with. To keep the local
//  `files`/`activity` arrays (and therefore every future saveAll() call)
//  consistent with what the server just wrote, every function below
//  updates those two arrays locally right after a successful request —
//  see the comment on saveFileUpload() for the full explanation.
//
//  renderDealModalAttachments()/openUploadFromDealModal() (below) add an
//  inline Files & Attachments section directly to the Add/Edit Task
//  modal (index.html #deal-modal), hooked from navigation.js's
//  openModal('deal-modal') so it renders every time that modal opens —
//  previously uploading was only reachable via the separate card-level
//  "📎 Files" toggle (openFilesModal), never from inside the task form.
// ══════════════════════════════════════════════

const ATTACHMENT_TYPES = ['file', 'image'];

let currentDealFilesId = null;   // deal id the Files modal is currently open for
let currentFilesTab = 'file';    // 'file' | 'image' — which tab is active
let editingFileUploadDealId = null; // deal id the Upload modal is locked to
let pendingUploadStageMove = null;  // stage key selected in the Upload modal's move dropdown, applied on Save (not immediately — see renderStageActionsInto)
let currentNoteModalDealId = null;  // deal id the Note (comment/revision) modal's move dropdown is currently linked to, if any
let pendingNoteStageMove = null;    // stage key selected in the Note (comment/revision) modal's move dropdown, applied on Save (not immediately) — mirrors pendingUploadStageMove; consumed in notes.js's saveNote()

// ── Read helpers ──────────────────────────────────────────────────────

function getDealFiles(dealId, type) {
    return files.filter(f => f.taskId === dealId && (!type || f.type === type));
}

function getDealDocuments(dealId) { return getDealFiles(dealId, 'file'); }
function getDealImages(dealId)    { return getDealFiles(dealId, 'image'); }

function formatFileSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Permissions ───────────────────────────────────────────────────────
// Uploading ("add files") is a normal configurable stage permission
// (canUpload, resolved through role inheritance like grab/drop/edit).
// Viewing the list is NOT gated — anyone who can see the task can see
// what's attached to it, same as Notes. Editing (rename) and deleting an
// attachment are hard-restricted to the System Administrator role
// everywhere, deliberately outside the stage permission matrix — see
// deals.js's openDealViewOnly() header comment for the same rule stated
// on the read-only task viewer.

function canUploadOnStage(stageKey) {
    if (typeof isKanbanSuperuser === 'function' && isKanbanSuperuser()) return true;
    return typeof canUpload !== 'function' || canUpload(stageKey);
}

function canManageAttachments() {
    return typeof isSystemAdmin === 'function' ? isSystemAdmin() : (currentUser?.role === SYSTEM_ROLE_ID);
}

function getDealStageKey(dealId) {
    return deals.find(d => d.id === dealId)?.stage || null;
}

// ── Files / Images modal (replicates the Deal Notes modal) ────────────

function openFilesModal(dealId) {
    currentDealFilesId = dealId;
    currentFilesTab = 'file';
    const deal = deals.find(d => d.id === dealId);
    const titleEl = document.getElementById('deal-files-modal-title');
    if (titleEl) titleEl.textContent = deal ? `Files — ${deal.title}` : 'Files';
    renderFilesModalList();
    updateFilesUploadButtonState();
    renderFilesModalStageActions();
    openModal('deal-files-modal');
}

function switchFilesTab(tab) {
    currentFilesTab = tab;
    document.querySelectorAll('#deal-files-modal .deal-notes-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tab));
    renderFilesModalList();
}

function updateFilesUploadButtonState() {
    const btn = document.getElementById('deal-files-upload-btn');
    if (!btn || !currentDealFilesId) return;
    const stageKey = getDealStageKey(currentDealFilesId);
    const allowed = canUploadOnStage(stageKey);
    btn.disabled = !allowed;
    btn.title = allowed ? '' : "You don't have Upload permission in this stage";
}

function renderFilesModalList() {
    if (!currentDealFilesId) return;
    const employee = typeof isEmployee === 'function' ? isEmployee() : false;
    const canManage = canManageAttachments();

    // Preferred markup: separate #deal-files-modal-list-file /
    // -list-image containers switched via tabs (see rbac-modals.html /
    // file-modals.html). Falls back to a single combined list if only
    // #deal-files-modal-list exists.
    const fileListEl = document.getElementById('deal-files-modal-list-file');
    const imageListEl = document.getElementById('deal-files-modal-list-image');

    if (fileListEl || imageListEl) {
        if (fileListEl) fileListEl.style.display = currentFilesTab === 'file' ? '' : 'none';
        if (imageListEl) imageListEl.style.display = currentFilesTab === 'image' ? '' : 'none';
        if (fileListEl) fileListEl.innerHTML = fileListHTML(getDealDocuments(currentDealFilesId), employee, canManage);
        if (imageListEl) imageListEl.innerHTML = fileListHTML(getDealImages(currentDealFilesId), employee, canManage);
        return;
    }

    const combinedEl = document.getElementById('deal-files-modal-list');
    if (!combinedEl) return;
    const list = currentFilesTab === 'image' ? getDealImages(currentDealFilesId) : getDealDocuments(currentDealFilesId);
    combinedEl.innerHTML = fileListHTML(list, employee, canManage);
}

function fileListHTML(list, employee, canManage) {
    if (!list.length) {
        return `<div class="deal-notes-empty">No files uploaded yet.</div>`;
    }
    return list.map(f => `
    <div class="deal-note-item">
      <div class="deal-note-item-main" onclick="viewFile('${f.id}')">
        <div class="deal-note-item-title">${f.title}</div>
        <div class="deal-note-item-preview">${(f.extension || '').toUpperCase()} · ${formatFileSize(f.size)} · ${fmtDate(f.uploadedDate || f.createdAt)}</div>
      </div>
      <div class="deal-note-item-actions">
        <button class="icon-btn" style="width:22px;height:22px;font-size:0.65rem;" onclick="event.stopPropagation();viewFile('${f.id}')" title="View">👁</button>
        ${(employee || !canManage) ? '' : `
        <button class="icon-btn" style="width:22px;height:22px;font-size:0.65rem;" onclick="event.stopPropagation();renameFile('${f.id}')" title="Rename">✎</button>
        <button class="icon-btn danger" style="width:22px;height:22px;font-size:0.65rem;" onclick="event.stopPropagation();deleteFile('${f.id}')" title="Delete">🗑</button>`}
      </div>
    </div>
  `).join('');
}

// ── Move-to-stage + Comment/Revision quick actions ─────────────────────
// Replicates the same block from deals.js's openDealViewOnly() so the
// Files modal, Upload modal, and Note (comment/revision) modal all
// offer the identical "Move task to" dropdown as the read-only Task
// Details viewer. Generic over which container it renders into and
// which modal the dropdown/buttons should close first, since each of
// those is a separate modal that needs it.
//
// deferMove: when true (Upload modal + Note/Comment/Revision modal),
// selecting a stage does NOT move the task immediately — it just
// records the choice in the modal's pending-move variable (looked up
// via getPendingStageMove/setPendingStageMove below, keyed by
// modalIdToClose) and shows a hint. The actual move happens once the
// underlying save succeeds: saveFileUpload() for the Upload modal,
// saveNote() for the Note modal — so a stage change never races ahead
// of (or gets abandoned by) a save that's still in flight or fails.
function getPendingStageMove(modalIdToClose) {
    if (modalIdToClose === 'file-upload-modal') return pendingUploadStageMove;
    if (modalIdToClose === 'note-modal') return pendingNoteStageMove;
    return null;
}

function setPendingStageMove(modalIdToClose, value) {
    if (modalIdToClose === 'file-upload-modal') pendingUploadStageMove = value;
    else if (modalIdToClose === 'note-modal') pendingNoteStageMove = value;
}

// Re-renders whichever deferred modal's stage-actions block after its
// pending selection changes, keeping the dropdown/hint in sync.
function refreshDeferredStageActions(modalIdToClose) {
    if (modalIdToClose === 'file-upload-modal') renderFileUploadModalStageActions();
    else if (modalIdToClose === 'note-modal') renderNoteModalStageActions(currentNoteModalDealId);
}

function buildMoveDropdownHTML(d, modalIdToClose, deferMove) {
    const superuser = isKanbanSuperuser();
    // Grab: can I take the task OUT of its current stage?
    const canGrabCurrent = superuser || typeof canGrab !== 'function' || canGrab(d.stage);
    // Drop: can I put the task INTO a given stage? (filters the options)
    const canDropOnStage = (stageKey) => superuser || typeof canDrop !== 'function' || canDrop(stageKey);

    // Which option shows as selected: the pending (not-yet-applied)
    // choice in deferred mode, otherwise the task's actual current stage.
    const pendingMove = deferMove ? getPendingStageMove(modalIdToClose) : null;
    const selectedStage = pendingMove || d.stage;

    // Build the dropdown options: include current stage (always) + any stage where Drop is allowed
    const stageOptions = stages
        .filter(s => s.key === d.stage || canDropOnStage(s.key))
        .map(s => `<option value="${s.key}" ${s.key === selectedStage ? 'selected' : ''}>${s.label}</option>`)
        .join('');

    // If no Grab, disable the dropdown completely
    const dropdownDisabled = !canGrabCurrent ? 'disabled' : '';
    const disabledHint = !canGrabCurrent
        ? `<span style="font-size:0.75rem; color:var(--red); display:block; margin-top:4px;">⛔ You don't have Grab permission – you cannot move this task out of its current stage.</span>`
        : '';

    const pendingHint = (pendingMove && pendingMove !== d.stage)
        ? `<span style="font-size:0.75rem; color:var(--text3); display:block; margin-top:4px;">Will move to "${stages.find(s => s.key === pendingMove)?.label || pendingMove}" once you save.</span>`
        : '';

    const dropdownOnchange = deferMove
        ? `setPendingStageMove('${modalIdToClose}', this.value); refreshDeferredStageActions('${modalIdToClose}');`
        : `moveDealStage('${d.id}', this.value); refreshStageActionsAfterMove('${modalIdToClose}');`;

    return `
        <div style="margin-top:12px; width:100%;">
            <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:4px;">Move task to:</label>
            <select style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg3); color:var(--text); font-size:0.9rem; cursor:${canGrabCurrent ? 'pointer' : 'not-allowed'};"
                ${dropdownDisabled}
                onchange="${dropdownOnchange}">
                ${stageOptions}
            </select>
            ${disabledHint}
            ${pendingHint}
            ${canGrabCurrent && !stageOptions.length ? `<span style="font-size:0.75rem; color:var(--text3);">No other stages available to move to.</span>` : ''}
        </div>
    `;
}

function buildCommentRevisionButtonsHTML(d, modalIdToClose) {
    const superuser = isKanbanSuperuser();
    const canCommentHere = superuser || typeof canComment !== 'function' || canComment(d.stage);
    const canRevisionHere = superuser || typeof canRevision !== 'function' || canRevision(d.stage);

    if (!canCommentHere && !canRevisionHere) return '';
    return `
        <div style="margin-top:12px; width:100%; display:flex; flex-direction:column; gap:8px;">
            ${canCommentHere ? `<button class="btn btn-primary" style="width:100%;" onclick="closeModal('${modalIdToClose}'); openNoteModal(null,'${d.id}','comment');">+ Add Comment</button>` : ''}
            ${canRevisionHere ? `<button class="btn btn-primary" style="width:100%;" onclick="closeModal('${modalIdToClose}'); openNoteModal(null,'${d.id}','revision');">+ Add Revision</button>` : ''}
        </div>
    `;
}

// containerId gets: move dropdown, and — unless includeButtons is false —
// the + Add Comment / + Add Revision buttons too. The note (comment/
// revision) modal passes includeButtons:false since it IS the add-
// comment/add-revision action; showing those buttons inside themselves
// would be circular.
function renderStageActionsInto(containerId, dealId, modalIdToClose, deferMove = false, includeButtons = true) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!dealId) { el.innerHTML = ''; return; }

    const d = deals.find(x => x.id === dealId);
    if (!d) { el.innerHTML = ''; return; }

    const moveDropdown = buildMoveDropdownHTML(d, modalIdToClose, deferMove);
    const actionButtons = includeButtons ? buildCommentRevisionButtonsHTML(d, modalIdToClose) : '';

    el.innerHTML = moveDropdown + actionButtons;
}

// Renders into the Files list modal (#deal-files-modal-stage-actions).
// Immediate mode — moving here isn't blocked on any pending save.
function renderFilesModalStageActions() {
    renderStageActionsInto('deal-files-modal-stage-actions', currentDealFilesId, 'deal-files-modal', false);
}

// Renders into the Upload form modal (#file-upload-modal-stage-actions).
// Deferred mode — see the deferMove doc comment above.
function renderFileUploadModalStageActions() {
    renderStageActionsInto('file-upload-modal-stage-actions', editingFileUploadDealId, 'file-upload-modal', true);
}

// Renders into the Note (Add/Edit Comment or Revision) modal
// (#note-modal-stage-actions). Called from notes.js's openNoteModal() —
// dropdown only (includeButtons:false), since this modal IS the add-
// comment/add-revision action already. Deferred mode — mirrors the
// Upload modal: selecting a stage here only records the choice in
// pendingNoteStageMove and shows a hint; the actual moveDealStage()
// call happens inside notes.js's saveNote(), right after the
// comment/revision has been saved (saveAll() succeeded), so a stage
// change never fires ahead of (or independently of) whether the note
// was actually saved. Only ever shows when the note is linked to a
// task (dealId present) — renderStageActionsInto no-ops the container
// otherwise, so it stays empty for notes opened from the general Notes
// page.
function renderNoteModalStageActions(dealId) {
    currentNoteModalDealId = dealId || null;
    renderStageActionsInto('note-modal-stage-actions', dealId, 'note-modal', true, false);
}

// Called right after moveDealStage() from a non-deferred dropdown's
// onchange (see renderStageActionsInto above). In practice that's only
// the Files modal now — the Upload modal and the Note modal both defer
// via getPendingStageMove/setPendingStageMove + refreshDeferredStageActions
// instead, so their branches here are kept only as a safety net in case
// something renders either of those two dropdowns in immediate mode.
// moveDealStage() already re-renders the kanban board/dashboard behind
// the modal; this just refreshes whatever depends on the task's stage
// INSIDE the still-open modal — the move dropdown itself
// (options/current-selection change), the Upload permission gate
// (canUploadOnStage can flip with the new stage), and the file list's
// Upload button state. The modal is deliberately left open so a move
// doesn't interrupt whatever the user was doing — same single action,
// no extra click to reopen it.
function refreshStageActionsAfterMove(modalIdToClose) {
    if (modalIdToClose === 'deal-files-modal') {
        renderFilesModalList();
        updateFilesUploadButtonState();
        renderFilesModalStageActions();
    } else if (modalIdToClose === 'file-upload-modal') {
        renderFileUploadModalStageActions();
    } else if (modalIdToClose === 'note-modal') {
        renderNoteModalStageActions(currentNoteModalDealId);
    }
}

// Opens the stored file. Images render fine directly in a new tab, so
// those still open straight from /uploads. Everything else (PDF, Word,
// Excel, PowerPoint, CSV, TXT) routes through luckySheet.html — an
// online document viewer that wraps Microsoft's Office Online Viewer,
// with a download-fallback message if a given file type can't be
// previewed. api.php's action=downloadFile deliberately forces
// Content-Disposition:attachment for the "download" use case and isn't
// what "view" wants for either path here.
function viewFile(id) {
    const f = files.find(x => x.id === id);
    if (!f) return;

    if (f.type === 'image') {
        window.open(f.path, '_blank', 'noopener');
        return;
    }

    // Route through api.php's serveFile action instead of hitting the
    // static /uploads/... path directly. InfinityFree's anti-bot/hotlink
    // protection on free hosting frequently blocks direct static-file
    // fetches from non-browser clients — which is exactly what Microsoft's
    // Office Online Viewer (used below, via luckySheet.html) is. Those
    // requests get served a challenge/error page instead of the real
    // file, which Office Online then reports as "not publicly
    // accessible". api.php?action=serveFile is a normal dynamic PHP
    // request, not subject to that same static-asset restriction, and it
    // sets the correct Content-Type + `Content-Disposition: inline` (see
    // api.php) so the viewer can reliably identify the file.
    const serveUrl = new URL(`${API_ENDPOINT}?action=serveFile&id=${encodeURIComponent(f.id)}`, window.location.href).href;
    const viewerUrl = `luckySheet.html?file=${encodeURIComponent(serveUrl)}&name=${encodeURIComponent(f.title || f.originalFilename || 'Document')}&ext=${encodeURIComponent(f.extension || '')}`;
    window.open(viewerUrl, '_blank', 'noopener');
}

// ── Upload modal (replicates the Note modal, per upload_file_features.md) ──

function openFileUploadModal(dealId) {
    const stageKey = getDealStageKey(dealId);
    if (!canUploadOnStage(stageKey)) {
        toast('You do not have Upload permission in this stage.', 'error');
        return;
    }
    editingFileUploadDealId = dealId;
    pendingUploadStageMove = null;

    document.getElementById('f-title').value = '';
    const typeSel = document.getElementById('f-type');
    if (typeSel) typeSel.value = 'file';
    onFileUploadTypeChange();

    const fileInput = document.getElementById('f-upload');
    if (fileInput) fileInput.value = '';

    // Linked employee — locked to the current user, display only.
    const empEl = document.getElementById('f-contact');
    if (empEl) {
        const contactId = currentUser?.contactId || currentUser?.employeeId || '';
        const name = (typeof getContactName === 'function' && contactId) ? getContactName(contactId) : (currentUser?.name || currentUser?.username || 'Me');
        empEl.value = name;
    }

    // Linked task — locked to the deal this was opened from.
    const dealEl = document.getElementById('f-deal');
    const deal = deals.find(d => d.id === dealId);
    if (dealEl) dealEl.value = deal ? deal.title : '';

    renderFileUploadModalStageActions();

    openModal('file-upload-modal');
}

function onFileUploadTypeChange() {
    const typeSel = document.getElementById('f-type');
    const fileInput = document.getElementById('f-upload');
    if (!typeSel || !fileInput) return;
    fileInput.accept = typeSel.value === 'image'
        ? '.jpg,.jpeg,.png,.gif,.webp,.svg'
        : '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx';
}

async function saveFileUpload() {
    const dealId = editingFileUploadDealId;
    if (!dealId) return;
    const stageKey = getDealStageKey(dealId);
    if (!canUploadOnStage(stageKey)) {
        toast('You do not have Upload permission in this stage.', 'error');
        return;
    }

    const title = document.getElementById('f-title').value.trim();
    const fileInput = document.getElementById('f-upload');
    const file = fileInput?.files?.[0];
    if (!file) { toast('Please choose a file to upload.', 'error'); return; }

    const saveBtn = document.getElementById('file-upload-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Uploading…'; }

    try {
        const contactId = currentUser?.contactId || currentUser?.employeeId || '';
        const actorName = (typeof getContactName === 'function' && contactId) ? getContactName(contactId) : (currentUser?.name || currentUser?.username || '');
        const actorRole = (typeof getRoleName === 'function' && currentUser?.role) ? getRoleName(currentUser.role) : '';

        const form = new FormData();
        form.append('action', 'uploadFile');
        form.append('taskId', dealId);
        form.append('file', file);
        form.append('title', title);
        form.append('uploadedBy', contactId);
        form.append('actorName', actorName);
        form.append('actorRole', actorRole);

        const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
        const out = await res.json();
        if (!out || !out.ok) throw new Error((out && out.error) || 'Upload failed');

        // ── Keep local state consistent (see file header comment) ──
        // api.php already wrote the record to tms_files.json and logged
        // an activity entry directly to tms_activity.json. Mirror both
        // into the local arrays so the NEXT unrelated saveAll() (which
        // pushes the whole db, files/activity included) doesn't clobber
        // what the server just wrote with a stale local copy.

// Keep browser state synchronized.
// The API already saved the attachment and activity to SQLite.
files.unshift(out.file);
save('files', files);

activity.unshift({
    id: 'local_' + uid(),
    message: `${actorName ? actorName + ' ' : ''}uploaded a file: ${out.file.title}`,
    color: 'accent',
    category: 'file',
    icon: '📎',
    createdAt: new Date().toISOString(),
    actorRole,
});

save('activity', activity);

// The upload API already saved the attachment and activity to SQLite.
// Avoid pushing the entire CRM database again.
// saveAll();
// Do not push the entire CRM database again.
// saveAll();

        // Apply the deferred stage move (if one was selected in this
        // modal's dropdown) only now that the upload itself is fully
        // saved — see the deferMove doc comment on renderStageActionsInto.
        if (pendingUploadStageMove) {
            moveDealStage(dealId, pendingUploadStageMove);
            pendingUploadStageMove = null;
        }

        toast('File uploaded.', 'success');
        closeModal('file-upload-modal');
        currentFilesTab = out.file.type;
        renderFilesModalList();
        updateFilesUploadButtonState();
        if (typeof renderDealModalAttachments === 'function') renderDealModalAttachments();
        if (currentDealNotesId === dealId || currentDealFilesId === dealId) { /* stays open, already re-rendered above */ }
        if (typeof renderKanban === 'function') renderKanban();
        if (currentPage === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    } catch (err) {
        console.error(err);
        toast(err.message || 'Upload failed.', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

// ── Inline Files & Attachments (Add/Edit Task modal) ────────────────────
// Lets a user attach files directly from the Add/Edit Task form
// (index.html #deal-modal), instead of requiring the task to be saved
// and reopened through the separate Files modal (openFilesModal) first.
// Only meaningful once the task actually exists (editingId set) — a
// brand-new, not-yet-saved task has no id to attach files to, so this
// shows a "save first" hint instead. Triggered from navigation.js's
// openModal('deal-modal') so it renders every time that modal opens.

function renderDealModalAttachments() {
    const group = document.getElementById('deal-modal-attachments-group');
    const hint = document.getElementById('deal-modal-attachments-hint');
    const listEl = document.getElementById('deal-modal-attachments-list');
    const uploadBtn = document.getElementById('deal-modal-upload-btn');
    if (!group || !hint || !listEl) return; // markup not present — no-op, never throws

    const dealId = (typeof editingId !== 'undefined') ? editingId : null;
    if (!dealId) {
        group.style.display = 'none';
        hint.style.display = '';
        return;
    }
    group.style.display = '';
    hint.style.display = 'none';

    const list = getDealFiles(dealId);
    listEl.innerHTML = list.length
        ? list.map(f => `
        <div class="deal-note-item">
          <div class="deal-note-item-main" onclick="viewFile('${f.id}')">
            <div class="deal-note-item-title">${f.type === 'image' ? '🖼' : '📄'} ${f.title}</div>
            <div class="deal-note-item-preview">${(f.extension || '').toUpperCase()} · ${formatFileSize(f.size)} · ${fmtDate(f.uploadedDate || f.createdAt)}</div>
          </div>
        </div>
      `).join('')
        : `<div class="deal-notes-empty">No files uploaded yet.</div>`;

    if (uploadBtn) {
        const allowed = canUploadOnStage(getDealStageKey(dealId));
        uploadBtn.disabled = !allowed;
        uploadBtn.title = allowed ? '' : "You don't have Upload permission in this stage";
    }
}

// Called by the modal's "⬆ Upload File" button. Captures the task id
// into a local variable BEFORE closing the deal modal — closeModal()
// resets the shared `editingId` global to null for every modal, so
// chaining closeModal('deal-modal') and openFileUploadModal(editingId)
// in one onclick would pass null instead of the actual task id.
function openUploadFromDealModal() {
    const dealId = editingId;
    closeModal('deal-modal');
    openFileUploadModal(dealId);
}

// ── Rename (System Administrator only) ─────────────────────────────────

async function renameFile(id) {
    if (!canManageAttachments()) {
        toast('Only a System Administrator can rename attachments.', 'error');
        return;
    }
    const f = files.find(x => x.id === id);
    if (!f) return;
    const newTitle = window.prompt('Rename file:', f.title);
    if (newTitle === null) return; // cancelled
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === f.title) return;

    try {
        const form = new FormData();
        form.append('action', 'updateFile');
        form.append('id', id);
        form.append('title', trimmed);
        form.append('actorName', currentUser?.name || currentUser?.username || '');
        form.append('actorRole', (typeof getRoleName === 'function' && currentUser?.role) ? getRoleName(currentUser.role) : '');

        const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
        const out = await res.json();
        if (!out || !out.ok) throw new Error((out && out.error) || 'Rename failed');

        files = files.map(x => x.id === id ? out.file : x);
        save('files', files);
        saveAll();
        toast('File renamed.', 'success');
        renderFilesModalList();
        if (typeof renderDealModalAttachments === 'function') renderDealModalAttachments();
    } catch (err) {
        console.error(err);
        toast(err.message || 'Rename failed.', 'error');
    }
}

// ── Delete (System Administrator only) ──────────────────────────────────

function deleteFile(id) {
    if (!canManageAttachments()) {
        toast('Only a System Administrator can delete attachments.', 'error');
        return;
    }
    const f = files.find(x => x.id === id);
    if (!f) return;
    confirmDelete(`Delete file "${f.title}"? This cannot be undone.`, async () => {
        try {
            const form = new FormData();
            form.append('action', 'deleteFile');
            form.append('id', id);
            form.append('actorName', currentUser?.name || currentUser?.username || '');
            form.append('actorRole', (typeof getRoleName === 'function' && currentUser?.role) ? getRoleName(currentUser.role) : '');

            const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
            const out = await res.json();
            if (!out || !out.ok) throw new Error((out && out.error) || 'Delete failed');

            files = files.filter(x => x.id !== id);
            save('files', files);

            activity.unshift({
                id: 'local_' + uid(),
                message: `${(currentUser?.name || currentUser?.username || '')} deleted a file: ${f.title}`.trim(),
                color: 'red',
                category: 'file',
                icon: '📎',
                createdAt: new Date().toISOString(),
                actorRole: (typeof getRoleName === 'function' && currentUser?.role) ? getRoleName(currentUser.role) : '',
            });
            save('activity', activity);
            saveAll();

            toast('File deleted.');
            renderFilesModalList();
            if (typeof renderDealModalAttachments === 'function') renderDealModalAttachments();
            if (typeof renderKanban === 'function') renderKanban();
        } catch (err) {
            console.error(err);
            toast(err.message || 'Delete failed.', 'error');
        }
    });
}
