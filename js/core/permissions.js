// ══════════════════════════════════════════════
//  PERMISSIONS — js/core/permissions.js
//  Centralized Stage-Based Role-Based Access Control (RBAC) engine.
//  Part of app.js module split.
//
//  Two independent layers gate a Kanban stage:
//
//  1. VISIBILITY — can this role see the stage COLUMN on the board at
//     all? Governed by canViewStage(), driven by the stage's role list
//     (stage.roles / getStageRoles(), edited via the "Visible to" role
//     rows in the Stage modal). No roles selected = visible to everyone
//     (default). This is an allow-list, not a permissions matrix.
//
//  2. ACTIONS — for a role that CAN see the stage, what can it do to
//     tasks while they sit in it: Grab (move out), Drop (move in), Edit
//     (edit/delete task details), Comment, Revision, Upload — and,
//     separately, two controls over the stage COLUMN itself rather than
//     the tasks inside it: Stage Edit (rename/recolor/delete the stage)
//     and Reorder (drag the stage column to a new position on the
//     board). 'edit', 'stageEdit', and 'reorder' are intentionally
//     independent of each other. This is hasStagePermission() and the
//     STAGE_PERMISSION_TYPES matrix below. The two layers are otherwise
//     unrelated: a visible stage can still restrict every action.
//
//  This file is the ONLY place that should read a stage's `permissions`
//  map, its `roles` visibility list, or walk role inheritance. Every
//  other module (kanban.js, notes.js, modals.js, deals.js, activity.js)
//  must call the functions here instead of re-implementing permission
//  logic.
//
//  Depends on: roles.js (getRoleById, SYSTEM_ROLE_ID), globals for
//  `stages`, `deals`, `contacts`, `currentUser`. Loaded as a classic
//  script, shares the global scope — load this BEFORE roles.js/kanban.js
//  consume it, but AFTER globals.js defines `stages`/`currentUser`.
// ══════════════════════════════════════════════

const STAGE_PERMISSION_TYPES = ['grab', 'drop', 'edit', 'comment', 'revision', 'upload', 'stageEdit', 'reorder'];

// Column labels for the Stage Permissions matrix (index.html
// #stage-permission-tbody / #stage-permission-modal thead). Kept here,
// next to STAGE_PERMISSION_TYPES, so the two never drift out of sync —
// whatever renders the matrix should map over STAGE_PERMISSION_TYPES and
// look up its label here rather than hardcoding column names.
const STAGE_PERMISSION_LABELS = {
    grab: 'Grab',
    drop: 'Drop',
    edit: 'Edit',
    comment: 'Comment',
    revision: 'Revision',
    upload: 'Upload',
    stageEdit: 'Stage Edit',
    reorder: 'Reorder',
};

// ── Role resolution helpers ──────────────────────────────────────────

function getCurrentUserRoleId() {
    return (typeof currentUser !== 'undefined' && currentUser?.role) || '';
}

// System Administrator is the one role that always has every permission,
// everywhere, unconditionally — it never consults the permissions map.
function isSystemAdmin(roleId) {
    const rid = roleId || getCurrentUserRoleId();
    return rid === SYSTEM_ROLE_ID || rid === 'admin';
}

// "Administrator" per the client spec = a role literally named
// Administrator, OR any role whose inheritance chain resolves back to
// System Administrator (and hasn't been explicitly restricted below it).
function isAdministratorRole(roleId) {
    const rid = roleId || getCurrentUserRoleId();
    if (!rid) return false;
    if (isSystemAdmin(rid)) return true;
    const role = (typeof getRoleById === 'function') ? getRoleById(rid) : null;
    if (role && (role.name || '').trim().toLowerCase() === 'administrator') return true;
    return getRoleInheritanceChain(rid).includes(SYSTEM_ROLE_ID);
}

// Walks role.inheritsFrom pointers up to the root, returning
// [roleId, parentId, grandparentId, ...]. Cycle-safe.
function getRoleInheritanceChain(roleId) {
    const chain = [];
    const seen = new Set();
    let current = roleId;
    while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        const role = (typeof getRoleById === 'function') ? getRoleById(current) : null;
        current = role?.inheritsFrom || null;
    }
    return chain;
}

// ── Stage permission map ─────────────────────────────────────────────

// Migrates the legacy `stage.roles` allow-list (all-or-nothing access,
// no per-permission granularity) into the new shape on the fly. Returns
// {} for a legacy stage that had no `roles` restriction at all — an empty
// map is a signal to hasStagePermission() to fall through to "everyone
// allowed", matching the old behavior exactly.
function getStagePermissionsMap(stage) {
    if (stage?.permissions) return stage.permissions;
    const legacyRoles = (typeof getStageRoles === 'function') ? getStageRoles(stage) : (stage?.roles || []);
    if (!legacyRoles.length) return {};
    const map = {};
    legacyRoles.forEach(rid => {
        map[rid] = {};
        STAGE_PERMISSION_TYPES.forEach(p => { map[rid][p] = true; });
    });
    return map;
}

// Core resolver. Does `roleId` have `permission` on `stage`, honoring
// role inheritance? Walks the role's chain (self -> parent -> ...) and
// uses the first explicit true/false found; unset the whole way up
// defaults to false. Legacy stages with no permissions map at all default
// to true (everyone allowed), matching pre-RBAC behavior.
function hasStagePermission(stageOrKey, roleId, permission) {
    if (!STAGE_PERMISSION_TYPES.includes(permission)) return false;
    const stage = typeof stageOrKey === 'string'
        ? (typeof stages !== 'undefined' ? stages.find(s => s.key === stageOrKey) : null)
        : stageOrKey;
    if (!stage) return true;

    const rid = roleId || getCurrentUserRoleId();
    if (isSystemAdmin(rid)) return true;

    const map = getStagePermissionsMap(stage);
    if (!Object.keys(map).length) return true; // legacy "open" stage

    const chain = getRoleInheritanceChain(rid);
    for (const r of chain) {
        const entry = map[r];
        if (entry && typeof entry[permission] === 'boolean') return entry[permission];
    }
    return false;
}

// ── Stage visibility (separate from the action matrix above) ────────

// Can `roleId` see this stage COLUMN on the board at all? Driven by the
// stage's role list (stage.roles, via getStageRoles() — the same list
// edited from the Stage modal's "Visible to" role rows), NOT the
// `permissions` action matrix. No roles selected = visible to everyone,
// matching the modal's own placeholder copy. System Administrator always
// sees every stage. Honors role inheritance, same as hasStagePermission().
function canViewStage(stageOrKey, roleId) {
    const stage = typeof stageOrKey === 'string'
        ? (typeof stages !== 'undefined' ? stages.find(s => s.key === stageOrKey) : null)
        : stageOrKey;
    if (!stage) return true;

    const rid = roleId || getCurrentUserRoleId();
    if (isSystemAdmin(rid)) return true;

    const allowedRoles = (typeof getStageRoles === 'function') ? getStageRoles(stage) : (stage.roles || []);
    if (!allowedRoles.length) return true; // no restriction set = visible to all

    const chain = getRoleInheritanceChain(rid);
    return chain.some(r => allowedRoles.includes(r));
}

function canGrab(stage, roleId)     { return hasStagePermission(stage, roleId, 'grab'); }
function canDrop(stage, roleId)     { return hasStagePermission(stage, roleId, 'drop'); }
function canEdit(stage, roleId)     { return hasStagePermission(stage, roleId, 'edit'); }
function canComment(stage, roleId)  { return hasStagePermission(stage, roleId, 'comment'); }
function canRevision(stage, roleId) { return hasStagePermission(stage, roleId, 'revision'); }
// Can this role edit the STAGE ITSELF — rename it, recolor it, or
// delete it — as opposed to canEdit() above, which governs
// editing/deleting TASK cards while they sit in the stage. Wire this
// into whatever renders the stage column header's edit/delete controls
// (kanban.js) in place of an unconditional admin check.
function canEditStage(stage, roleId) { return hasStagePermission(stage, roleId, 'stageEdit'); }
// Can this role drag-and-drop this stage column to a new position on the
// board? Deliberately separate from canEditStage() — a role can be
// allowed to rename/recolor a stage without being allowed to move its
// position (or vice versa). Checked against the stage being PICKED UP
// (the one whose position is changing), same convention as canGrab()
// only checking the source stage for a task move.
function canReorderStage(stage, roleId) { return hasStagePermission(stage, roleId, 'reorder'); }
// ✅ Attachments — file uploads. This is a normal configurable stage
// permission like the others above. Deletion of an uploaded file is
// deliberately NOT part of this matrix: it's hard-restricted to the
// System Administrator role everywhere, per spec — see
// attachments.js's canDeleteAttachment(), which checks isSystemAdmin()
// directly and never consults this permission map.
function canUpload(stage, roleId)   { return hasStagePermission(stage, roleId, 'upload'); }

// Coarse "can this user do ANYTHING in this stage" check — kept for
// call sites that only need to decide whether to show a generic
// affordance (e.g. the drag handle) rather than a specific permission.
function canActOnStageGranular(stageOrKey, roleId) {
    return STAGE_PERMISSION_TYPES.some(p => hasStagePermission(stageOrKey, roleId, p));
}

// ── Stage Permission modal support ───────────────────────────────────

// One row per known role, with each permission resolved (including
// inheritance) — this is exactly what the Permission Matrix table needs.
function buildStagePermissionMatrix(stage) {
    if (typeof roles === 'undefined') return [];
    return roles.map(r => {
        const row = { roleId: r.id, roleName: r.name, inheritsFrom: r.inheritsFrom || '' };
        STAGE_PERMISSION_TYPES.forEach(p => { row[p] = hasStagePermission(stage, r.id, p); });
        return row;
    });
}

// Diffs an old vs. new permissions map and reports which roles LOST
// which permissions (additions are never flagged — only reductions need
// the warning dialog per the client spec).
function diffStagePermissionReductions(oldMap, newMap) {
    const reductions = [];
    const roleIds = new Set([...Object.keys(oldMap || {}), ...Object.keys(newMap || {})]);
    roleIds.forEach(rid => {
        const removed = STAGE_PERMISSION_TYPES.filter(p => {
            const before = !!(oldMap?.[rid]?.[p]);
            const after = !!(newMap?.[rid]?.[p]);
            return before && !after;
        });
        if (removed.length) reductions.push({ roleId: rid, removed });
    });
    return reductions;
}

// For the warning dialog: which tasks (by assignee role) and which
// employees are affected by a set of reductions in a given stage.
function computeStagePermissionReductionImpact(stageKey, reductions) {
    const roleIdsAffected = new Set(reductions.map(r => r.roleId));
    const roleOf = cid => contacts.find(c => c.id === cid)?.role;

    const affectedTasks = (typeof deals !== 'undefined' ? deals : [])
        .filter(d => d.stage === stageKey)
        .filter(d => {
            const contactIds = (d.contactIds && d.contactIds.length) ? d.contactIds : (d.contactId ? [d.contactId] : []);
            return contactIds.some(cid => roleIdsAffected.has(roleOf(cid)));
        });

    const affectedUsers = (typeof contacts !== 'undefined' ? contacts : [])
        .filter(c => roleIdsAffected.has(c.role));

    return { affectedTasks, affectedUsers };
}
