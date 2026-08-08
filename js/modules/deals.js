// ══════════════════════════════════════════════
//  DEALS — js/modules/deals.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer), permissions.js (canEdit), and
//  kanban.js (isKanbanSuperuser, deal-modal field ids, openModal/
//  closeModal) being loaded first per index.html script order. Shares
//  the global scope (classic scripts).
//
//  Extracted from kanban.js so the read-only Task Details viewer — a
//  distinct UI surface, not board rendering — has its own module.
//  Behavior is unchanged; only the file it lives in moved.
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  READ-ONLY TASK VIEWER
//  Fallback "View Task" experience for a user who lacks Edit permission
//  on the task's current stage: view-only details, comments, revisions,
//  timeline, and Close — no Save/Delete/Edit. Reuses the existing task
//  detail markup where possible; if index.html hasn't added a dedicated
//  #deal-view-modal yet, falls back to opening the edit modal with its
//  inputs disabled and Save/Delete hidden.
// ══════════════════════════════════════════════

// ── MOVE TO dropdown builder (shared by the kanban card and this viewer) ──
// Permission-aware: only offers stages the current user has Drop permission
// on, and only renders at all if the user has Grab permission on the deal's
// current stage — the exact pair of checks moveDealStage() enforces, so
// this can never present an option the actual move call would reject.
// opts.afterMove: extra JS to run (as a string) right after moveDealStage()
// fires, e.g. to close the modal the dropdown lives in.
function buildDealMoveDropdownHTML(d, opts) {
    opts = opts || {};
    if (typeof stages === 'undefined') return '';
    const stage = stages.find(s => s.key === d.stage);
    if (!stage) return '';

    const superuser = (typeof isKanbanSuperuser === 'function') ? isKanbanSuperuser() : false;
    const canGrabHere = superuser || typeof canGrab !== 'function' || canGrab(stage);
    if (!canGrabHere) return '';

    const moveToStages = stages.filter(s =>
        s.key !== d.stage &&
        (superuser || typeof canDrop !== 'function' || canDrop(s)) &&
        (typeof canViewStage !== 'function' || canViewStage(s))
    );
    if (!moveToStages.length) return '';

    const afterMove = opts.afterMove || '';
    return `
      <div class="deal-view-move-row" style="width:100%;margin-top:10px;">
        <select class="deal-card-move-select" style="width:100%;" title="Move to another stage"
          onchange="if(this.value){ moveDealStage('${d.id}', this.value); ${afterMove} } this.selectedIndex=0;">
          <option value="">↪ Move to…</option>
          ${moveToStages.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
        </select>
      </div>
    `;
}

function openDealViewOnly(id) {
    const d = deals.find(x => x.id === id);
    if (!d) return;

    const viewModal = document.getElementById('deal-view-modal');
    if (viewModal) {
        const titleEl = document.getElementById('deal-view-modal-title');
        if (titleEl) titleEl.textContent = d.title;
        const bodyEl = document.getElementById('deal-view-modal-body');
        if (bodyEl) {
            const cname = ((d.contactIds && d.contactIds.length) ? d.contactIds : (d.contactId ? [d.contactId] : []))
                .map(cid => getContactName(cid)).filter(Boolean).join(', ');
            const dealNotesCount = (typeof notes !== 'undefined') ? notes.filter(n => n.dealId === d.id).length : 0;
            const moveDropdownHTML = buildDealMoveDropdownHTML(d, { afterMove: `closeModal('deal-view-modal');` });
            bodyEl.innerHTML = `
        <div class="deal-view-field"><strong>Description:</strong> ${d.desc || '—'}</div>
        <div class="deal-view-field"><strong>Due:</strong> ${fmtDate(d.due)}</div>
        <div class="deal-view-field"><strong>Priority:</strong> ${d.priority}</div>
        <div class="deal-view-field"><strong>Assigned to:</strong> ${cname || '—'}</div>
        <div class="deal-view-field" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openDealNotesModal('${d.id}')">💬 Comments &amp; Revisions (${dealNotesCount})</button>
          ${typeof openDealFilesModal === 'function' ? `<button class="btn btn-ghost btn-sm" onclick="openDealFilesModal('${d.id}')">📎 Files</button>` : ''}
        </div>
        ${moveDropdownHTML}
      `;
        }
        openModal('deal-view-modal');
        return;
    }

    // Fallback: reuse the edit modal DOM, but strip it down to view-only.
    editingId = id;
    const titleEl2 = document.getElementById('deal-modal-title');
    if (titleEl2) titleEl2.textContent = `View Task (read-only) — ${d.title}`;
    ['d-title', 'd-desc', 'd-due', 'd-priority', 'd-department', 'd-role', 'd-stage'].forEach(fid => {
        const el = document.getElementById(fid);
        if (!el) return;
        if (fid === 'd-title') el.value = d.title;
        if (fid === 'd-desc') el.value = d.desc || '';
        if (fid === 'd-due') el.value = d.due;
        if (fid === 'd-priority') el.value = d.priority || 'medium';
        el.disabled = true;
    });
    document.querySelectorAll('#deal-modal .btn-primary, #deal-modal .deal-modal-save-btn, #deal-modal .deal-modal-delete-btn')
        .forEach(btn => { btn.style.display = 'none'; });

    // Fallback modal has no dedicated body container to append into, so the
    // move-to row is inserted (and re-inserted fresh each open) right after
    // the title, tagged with an id so openDealModal() can strip it back out
    // before the same DOM is reused for real editing.
    const existingMoveRow = document.getElementById('deal-view-move-fallback-row');
    if (existingMoveRow) existingMoveRow.remove();
    const moveDropdownHTML2 = buildDealMoveDropdownHTML(d, { afterMove: `closeModal('deal-modal');` });
    if (moveDropdownHTML2 && titleEl2) {
        titleEl2.insertAdjacentHTML('afterend',
            moveDropdownHTML2.replace('class="deal-view-move-row"', 'id="deal-view-move-fallback-row" class="deal-view-move-row"'));
    }

    openModal('deal-modal');
}
