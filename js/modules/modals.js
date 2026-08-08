// ══════════════════════════════════════════════
//  MODALS — js/modules/modals.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer), permissions.js (hasStagePermission,
//  getStagePermissionsMap, diffStagePermissionReductions,
//  computeStagePermissionReductionImpact, STAGE_PERMISSION_TYPES),
//  roles.js (getRoleName), and kanban.js (isAdministratorRoleSafe,
//  renderKanban) being loaded first per index.html script order. Shares
//  the global scope (classic scripts).
//
//  Extracted from kanban.js so the Stage Permission modal — a distinct
//  UI surface, not board rendering — has its own module. Behavior is
//  unchanged; only the file it lives in moved.
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  STAGE PERMISSION MODAL — Phase 5/6/13
//  Dynamic Role × [permission type] matrix for one stage, columns driven
//  by STAGE_PERMISSION_TYPES/STAGE_PERMISSION_LABELS (permissions.js) —
//  currently Grab, Drop, Edit, Comment, Revision, Upload, Stage Edit.
//  Reads/writes stage.permissions via permissions.js. Expects
//  index.html to provide:
//    #stage-permission-modal, #stage-permission-modal-title,
//    #stage-permission-thead (a <thead> the column headers render into),
//    #stage-permission-tbody (a <tbody> the matrix rows render into).
//  If that markup isn't present yet, these functions are no-ops beyond
//  logging a console warning — they never throw.
// ══════════════════════════════════════════════

// ✅ REMOVED duplicate declaration - using global STAGE_PERMISSION_TYPES from permissions.js
// const STAGE_PERMISSION_TYPES = ['grab', 'drop', 'edit', 'comment', 'revision', 'upload']; // ❌ REMOVED

let editingStagePermissionKey = null;
let stagePermissionDraft = {}; // { roleId: { grab, drop, edit, comment, revision, upload } }

function openStagePermissionModal(key) {
    if (!isAdministratorRoleSafe()) return;
    const modal = document.getElementById('stage-permission-modal');
    if (!modal) { console.warn('Stage Permission modal markup not found (#stage-permission-modal).'); return; }
    editingStagePermissionKey = key;
    loadStagePermissions(key);
    const stage = stages.find(s => s.key === key);
    const titleEl = document.getElementById('stage-permission-modal-title');
    if (titleEl) titleEl.textContent = stage ? `Permissions — ${stage.label}` : 'Stage Permissions';
    renderStagePermissionModal(key);
    openModal('stage-permission-modal');
}

// Loads the stage's current permission map (migrating the legacy
// roles-list shape if needed) into a working draft so edits in the modal
// don't mutate live data until Save is pressed.
function loadStagePermissions(key) {
    const stage = stages.find(s => s.key === key);
    const map = (typeof getStagePermissionsMap === 'function') ? getStagePermissionsMap(stage) : (stage?.permissions || {});
    stagePermissionDraft = {};
    roles.forEach(r => {
        const existing = map[r.id] || {};
        // Generic over STAGE_PERMISSION_TYPES (permissions.js) rather than
        // a hardcoded field list, so a new permission type — like
        // 'stageEdit' — is included in the draft automatically instead of
        // silently missing.
        stagePermissionDraft[r.id] = STAGE_PERMISSION_TYPES.reduce((acc, p) => {
            acc[p] = !!existing[p];
            return acc;
        }, {});
    });
    return stagePermissionDraft;
}

function renderStagePermissionModal(key) {
    const thead = document.getElementById('stage-permission-thead');
    const tbody = document.getElementById('stage-permission-tbody');
    if (!tbody) return;
    const stage = stages.find(s => s.key === key);

    // ✅ Was previously never rendered — #stage-permission-thead had no
    // code writing to it anywhere, so the matrix showed no column
    // headers. Built from STAGE_PERMISSION_LABELS (permissions.js) so it
    // never drifts from STAGE_PERMISSION_TYPES again.
    if (thead) {
        const labels = (typeof STAGE_PERMISSION_LABELS !== 'undefined') ? STAGE_PERMISSION_LABELS : {};
        thead.innerHTML = '<tr><th>Role</th>' +
            STAGE_PERMISSION_TYPES.map(p => `<th>${labels[p] || p}</th>`).join('') + '</tr>';
    }

    // STAGE_PERMISSION_TYPES comes from permissions.js and includes 'upload'
    tbody.innerHTML = roles.map(r => {
        const isSystem = r.id === SYSTEM_ROLE_ID;
        const draft = stagePermissionDraft[r.id] || {};
        const inheritLabel = r.inheritsFrom ? ` <span style="font-size:0.65rem;color:var(--text3);">inherits ${getRoleName(r.inheritsFrom)}</span>` : '';
        const cells = STAGE_PERMISSION_TYPES.map(p => {
            const checked = isSystem ? true : !!draft[p];
            const disabled = isSystem; // System Administrator is always full-access
            return `<td style="text-align:center;">
        <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
               onchange="updateStagePermissionDraft('${r.id}','${p}',this.checked)" />
      </td>`;
        }).join('');
        return `<tr>
      <td>${r.name}${isSystem ? ' 🔒' : ''}${inheritLabel}</td>
      ${cells}
    </tr>`;
    }).join('');

    void stage; // reserved for future per-stage header context
}

function updateStagePermissionDraft(roleId, permission, checked) {
    if (roleId === SYSTEM_ROLE_ID) return; // always full access, not editable
    if (!stagePermissionDraft[roleId]) stagePermissionDraft[roleId] = {};
    stagePermissionDraft[roleId][permission] = !!checked;
}

// Builds the final permissions map to persist: System Administrator is
// always injected as full-access regardless of the draft, so the map is
// self-contained (doesn't rely on isSystemAdmin() special-casing forever).
// Built generically off STAGE_PERMISSION_TYPES so a new permission type
// is included automatically instead of needing this hardcoded each time.
function buildFinalStagePermissionsMap() {
    const finalMap = {
        [SYSTEM_ROLE_ID]: STAGE_PERMISSION_TYPES.reduce((acc, p) => { acc[p] = true; return acc; }, {})
    };
    Object.keys(stagePermissionDraft).forEach(rid => {
        if (rid === SYSTEM_ROLE_ID) return;
        finalMap[rid] = { ...stagePermissionDraft[rid] };
    });
    return finalMap;
}

function saveStagePermissions() {
    if (!editingStagePermissionKey) return;
    const stage = stages.find(s => s.key === editingStagePermissionKey);
    if (!stage) return;

    const oldMap = (typeof getStagePermissionsMap === 'function') ? getStagePermissionsMap(stage) : (stage.permissions || {});
    const newMap = buildFinalStagePermissionsMap();

    const reductions = (typeof diffStagePermissionReductions === 'function')
        ? diffStagePermissionReductions(oldMap, newMap)
        : [];

    if (reductions.length) {
        const impact = (typeof computeStagePermissionReductionImpact === 'function')
            ? computeStagePermissionReductionImpact(stage.key, reductions)
            : { affectedTasks: [], affectedUsers: [] };
        const lines = reductions.map(r =>
            `${getRoleName(r.roleId)}: removed ${r.removed.join(', ')}`
        ).join('\n');
        confirmDelete(
            `Permission Warning — "${stage.label}"\n\n` +
            `${lines}\n\n` +
            `Affected tasks: ${impact.affectedTasks.length}\n` +
            `Affected users: ${impact.affectedUsers.length}\n\n` +
            `Users will keep viewing this stage, but will lose the removed actions on it.`,
            () => commitStagePermissionSave(stage, oldMap, newMap, reductions)
        );
        return;
    }

    commitStagePermissionSave(stage, oldMap, newMap, reductions);
}

function commitStagePermissionSave(stage, oldMap, newMap, reductions) {
    stage.permissions = newMap;
    saveAll();

    logActivity(`Updated stage permissions for <strong>${stage.label}</strong>`, 'purple');
    reductions.forEach(r => {
        logActivity(
            `Removed ${r.removed.join(', ')} permission${r.removed.length === 1 ? '' : 's'} for <strong>${getRoleName(r.roleId)}</strong> on stage <strong>${stage.label}</strong>`,
            'red'
        );
    });

    toast('Stage permissions saved.', 'success');
    closeModal('stage-permission-modal');
    editingStagePermissionKey = null;
    renderKanban();
}
