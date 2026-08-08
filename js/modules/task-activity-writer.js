// ══════════════════════════════════════════════
//  TASK ACTIVITY WRITER — js/modules/task-activity-writer.js
//  Central logging function for all task‑related actions.
//
//  Ensures every task event (create, move, comment, revision, delete)
//  is recorded in BOTH the per‑task audit trail (`taskActivity` global)
//  and the main dashboard activity feed (`activity` via `logActivity`).
//
//  Dependencies (must be loaded before this file):
//    - api.js        (provides uid(), saveAll(), globals)
//    - activity.js   (provides logActivity(), getEmployeeFullName, etc.)
//    - The global arrays: taskActivity, activity, contacts, deals
//    - currentUser (set by session)
//
//  Usage:
//    logTaskActivity(taskId, 'moved', { title: 'Task X', stage: 'done', fromStage: 'todo' });
//    logTaskActivity(taskId, 'comment', { title: 'Task X', stage: 'inprogress', linkedEmployeeId: 'emp123', comment: 'Please check' });
// ══════════════════════════════════════════════

(function() {
    'use strict';

    // Ensure required globals exist (but don't break if missing)
    if (typeof taskActivity === 'undefined') {
        console.warn('task-activity-writer: global `taskActivity` not found.');
    }
    if (typeof activity === 'undefined') {
        console.warn('task-activity-writer: global `activity` not found.');
    }
    if (typeof logActivity !== 'function') {
        console.warn('task-activity-writer: `logActivity` function not found. Dashboard feed will not be updated.');
    }

    // Elapsed ms from an ISO timestamp to now, or null if the timestamp is
    // missing/malformed — never NaN. A stray NaN here would still
    // round-trip through JSON.stringify fine (it becomes `null`), but it's
    // wrong to store and confusing to display, so validate at the source
    // instead of downstream.
    function safeDurationMs(startedAtIso) {
        if (!startedAtIso) return null;
        const parsed = Date.parse(startedAtIso);
        return isNaN(parsed) ? null : (Date.now() - parsed);
    }

    /**
     * Central logging function for task activities.
     * 
     * @param {string} taskId - The ID of the task.
     * @param {string} action - One of: 'created', 'moved', 'comment', 'revision', 'deleted'.
     * @param {Object} data - Additional data:
     *   - title (string): Task title (optional, will be looked up from deals if omitted)
     *   - stage (string): Target stage key (required for moved/created)
     *   - fromStage (string): Previous stage key (for move actions, to build the "from → to" message)
     *   - linkedEmployeeId (string): Employee ID linked to comment/revision
     *   - comment (string): Comment text (for comment action)
     *   - revision (string): Revision request text (for revision action)
     *   - color (string): Color for the dashboard activity entry (default: 'accent')
     */
    window.logTaskActivity = function(taskId, action, data) {
        if (!taskId) {
            console.error('logTaskActivity: taskId is required');
            return;
        }
        if (!action) {
            console.error('logTaskActivity: action is required');
            return;
        }

        const now = new Date().toISOString();

        // ── Get task title (from data or from deals array) ──
        let title = data && data.title;
        if (!title && typeof deals !== 'undefined') {
            const task = deals.find(d => d.id === taskId);
            if (task) title = task.title || '';
        }
        title = title || '';

        // ── Get actor details from currentUser ──
        // Use existing helpers if available, otherwise build from currentUser.
        let actorFname = '',
            actorLname = '',
            actorFullName = '',
            actorDisplayName = '';

        if (typeof getActorDisplayName === 'function') {
            actorDisplayName = getActorDisplayName(); // returns "Last, First"
        }
        if (typeof getActorFullName === 'function') {
            actorFullName = getActorFullName(); // returns "First Last"
        }

        // Fallback: manually extract from currentUser
        if (!actorDisplayName && typeof currentUser !== 'undefined' && currentUser) {
            if (currentUser.employeeId && typeof contacts !== 'undefined') {
                const contact = contacts.find(c => c.id === currentUser.employeeId);
                if (contact) {
                    actorFname = contact.fname || '';
                    actorLname = contact.lname || '';
                    actorDisplayName = `${actorLname}, ${actorFname}`;
                    actorFullName = `${actorFname} ${actorLname}`.trim();
                }
            }
            if (!actorDisplayName && currentUser.name) {
                const parts = currentUser.name.trim().split(/\s+/);
                if (parts.length > 1) {
                    actorLname = parts.pop();
                    actorFname = parts.join(' ');
                    actorDisplayName = `${actorLname}, ${actorFname}`;
                    actorFullName = `${actorFname} ${actorLname}`.trim();
                } else {
                    actorFname = parts[0] || '';
                    actorDisplayName = actorFullName = actorFname;
                }
            }
            if (!actorDisplayName && currentUser.username) {
                actorDisplayName = actorFullName = currentUser.username;
            }
        }
        if (!actorDisplayName) {
            actorDisplayName = 'Unknown';
            actorFullName = 'Unknown';
        }

        // ── Get linked employee name (if any) ──
        let linkedEmployeeName = '';
        if (data && data.linkedEmployeeId) {
            const linkedId = data.linkedEmployeeId;
            if (typeof getEmployeeFullName === 'function') {
                linkedEmployeeName = getEmployeeFullName(linkedId);
            } else if (typeof contacts !== 'undefined') {
                const contact = contacts.find(c => c.id === linkedId);
                if (contact) {
                    linkedEmployeeName = `${contact.fname || ''} ${contact.lname || ''}`.trim();
                }
            }
            if (!linkedEmployeeName) linkedEmployeeName = linkedId;
        }

        // ── Build the taskActivity entry ──
        const entry = {
            id: (typeof uid === 'function') ? uid() : String(Date.now()) + Math.random().toString(16).slice(2),
            taskId: taskId,
            title: title,
            action: action,
            stage: data && data.stage ? data.stage : null,
            createdAt: now,
            linkedEmployee: data && data.linkedEmployeeId ? data.linkedEmployeeId : null,
            fname: actorFname || actorFullName.split(' ')[0] || '',
            lname: actorLname || (actorFullName.split(' ').slice(1).join(' ')) || '',
            // Extra fields (optional, for future use)
            comment: data && data.comment ? data.comment : null,
            revision: data && data.revision ? data.revision : null,
            fromStage: data && data.fromStage ? data.fromStage : null,
        };

        // Push to taskActivity (newest first)
        if (typeof taskActivity !== 'undefined' && Array.isArray(taskActivity)) {
            taskActivity.unshift(entry);
            // Optionally trim length
            if (taskActivity.length > 1000) taskActivity.length = 1000;
        } else {
            console.warn('logTaskActivity: global `taskActivity` not available, entry not saved.');
        }

        // ── Archive detection: final(✓) stage → another final(✓) stage ──
        // A task that's already sitting in a stage flagged Final
        // (checkmark) in the Stage editor, then moved DIRECTLY to another
        // Final stage (e.g. Done → Archived), is being archived — not
        // "completed again". Archived tasks drop out of the Task/Completed
        // pipeline chips entirely (renderKanban.js) rather than counting
        // toward either one.
        if (action === 'moved' && data && data.fromStage && data.stage && typeof stages !== 'undefined' && typeof deals !== 'undefined') {
            const fromStageObj = stages.find(s => s.key === data.fromStage);
            const toStageObj = stages.find(s => s.key === data.stage);
            if (fromStageObj?.final && toStageObj?.final) {
                const dealForArchive = deals.find(d => d.id === taskId);
                if (dealForArchive && !dealForArchive.archived) {
                    dealForArchive.archived = true;
                    dealForArchive.archivedAt = now;
                    if (typeof taskActivity !== 'undefined' && Array.isArray(taskActivity)) {
                        taskActivity.unshift({
                            id: (typeof uid === 'function') ? uid() : String(Date.now()) + Math.random().toString(16).slice(2),
                            taskId: dealForArchive.id,
                            title: dealForArchive.title,
                            action: 'archived',
                            stage: data.stage,
                            fromStage: data.fromStage,
                            createdAt: now,
                            fname: actorFname || actorFullName.split(' ')[0] || '',
                            lname: actorLname || (actorFullName.split(' ').slice(1).join(' ')) || '',
                        });
                        if (taskActivity.length > 1000) taskActivity.length = 1000;
                    }
                }
            }
        }

        // ── Assignee lifecycle: Active ⇄ Completed ──
        // Independent of the generic audit entry above. For EACH employee
        // assigned to the task, checks whether the stage it just landed in
        // is one their role can act on:
        //   ACTIVE    — stage is visible to their role (canViewStage) AND
        //               Grab is enabled for their role on that stage
        //               (canGrab). Opens a per-employee clock, stored on
        //               the deal itself (deal.employeeActive[contactId]).
        //   COMPLETED — the task moves to a stage NOT visible to their
        //               role while that employee's clock was running.
        //               Closes the clock, writes a "Completed" row to the
        //               Task Activity trail (Employee Lastname, Firstname
        //               + elapsed time) and a matching line to the Recent
        //               Activity feed.
        // Only stage-bearing actions can open or close a window. The
        // actor (mover) info is threaded through to recordAssigneeCompletion
        // so the Completed row also records WHO performed the move that
        // triggered it — an audit trail need distinct from the assignee
        // whose task got completed, since they're frequently different
        // people (an admin/coordinator dragging a card that isn't theirs).
        if ((action === 'created' || action === 'moved') && data && data.stage && typeof deals !== 'undefined') {
            const dealRef = deals.find(d => d.id === taskId);
            if (dealRef) {
                processAssigneeLifecycle(dealRef, data.stage, {
                    fname: actorFname || actorFullName.split(' ')[0] || '',
                    lname: actorLname || (actorFullName.split(' ').slice(1).join(' ')) || '',
                });
            }
        }

        // ── Also log to the main dashboard activity feed ──
        // Build a human-readable message WITHOUT actor prefix (logActivity will add it)
        let message = '';
        const stageLabel = (data && data.stage) ? (() => {
            if (typeof stages !== 'undefined') {
                const s = stages.find(st => st.key === data.stage);
                return s ? s.label : data.stage;
            }
            return data.stage;
        })() : '';

        const fromStageLabel = (data && data.fromStage) ? (() => {
            if (typeof stages !== 'undefined') {
                const s = stages.find(st => st.key === data.fromStage);
                return s ? s.label : data.fromStage;
            }
            return data.fromStage;
        })() : '';

        let color = (data && data.color) ? data.color : 'accent';

        switch (action) {
            case 'created':
                message = `Added task <strong>${title}</strong>${stageLabel ? ' to ' + stageLabel : ''}`;
                color = color || 'purple';
                break;
            case 'moved':
                if (fromStageLabel && stageLabel) {
                    message = `Moved task <strong>${title}</strong> from ${fromStageLabel} → ${stageLabel}`;
                } else if (stageLabel) {
                    message = `Moved task <strong>${title}</strong> to ${stageLabel}`;
                } else {
                    message = `Moved task <strong>${title}</strong>`;
                }
                color = color || 'orange';
                break;
            case 'comment':
                if (linkedEmployeeName) {
                    message = `created comment for ${linkedEmployeeName} to task <strong>${title}</strong>`;
                } else {
                    message = `created comment on task <strong>${title}</strong>`;
                }
                color = color || 'accent';
                break;
            case 'revision':
                if (linkedEmployeeName) {
                    message = `created Request Revision for ${linkedEmployeeName} to task <strong>${title}</strong>`;
                } else {
                    message = `created Revision on task <strong>${title}</strong>`;
                }
                color = color || 'orange';
                break;
            case 'deleted':
                message = `Deleted task <strong>${title}</strong>${stageLabel ? ' (was in ' + stageLabel + ')' : ''}`;
                color = color || 'red';
                break;
            default:
                message = `Action "${action}" on task <strong>${title}</strong>`;
                color = color || 'accent';
        }

        // Use logActivity if available (it will prefix with actor name)
        if (typeof logActivity === 'function') {
            logActivity(message, color);
        } else {
            console.warn('logTaskActivity: logActivity not available, dashboard feed not updated.');
        }

        // ── Persist changes ──
        // saveAll() is called inside logActivity, so we don't need to call it again.
        // But if taskActivity was updated without logActivity, we still need to save.
        // Since logActivity calls saveAll, it will persist both activity and all other tables.
        // However, if logActivity is missing, we need to save manually.
        if (typeof logActivity !== 'function' && typeof saveAll === 'function') {
            saveAll();
        }
    };

    // ── Assignee lifecycle helpers (Active ⇄ Completed) ──
    // See the comment at the call site above for the rule. A stage that's
    // visible but has Grab off neither opens nor closes an employee's
    // window — only visibility (in vs. out) closes an open window; Grab
    // only gates whether a window can OPEN in the first place. Silently
    // no-ops if permissions.js (canViewStage/canGrab) isn't loaded yet.
    function processAssigneeLifecycle(deal, stageKey, mover) {
        if (!deal || !stageKey) return;
        if (typeof canViewStage !== 'function') return;
        if (typeof contacts === 'undefined') return;

        const assigneeIds = (deal.contactIds && deal.contactIds.length) ? deal.contactIds : (deal.contactId ? [deal.contactId] : []);
        if (!assigneeIds.length) {
            // Not necessarily an error — plenty of tasks sit unassigned for
            // a while — so this is console-only, no toast, to avoid
            // spamming the person every time an unassigned task moves.
            console.warn(`logTaskActivity: task "${deal.title}" (${deal.id}) has no assignees — Active/Completed lifecycle tracking skipped.`);
            return;
        }

        if (!deal.employeeActive) deal.employeeActive = {};
        if (!deal.completions) deal.completions = {};
        const now = new Date().toISOString();

        assigneeIds.forEach(cid => {
            const contact = contacts.find(c => c.id === cid);
            if (!contact) {
                // This one IS a data-integrity problem worth surfacing —
                // an assignee ID on the task doesn't resolve to any
                // contact record, so tracking silently can't run for them.
                console.warn(`logTaskActivity: task "${deal.title}" (${deal.id}) has assignee ID "${cid}" with no matching contact record — lifecycle tracking skipped for that assignee.`);
                if (typeof toast === 'function') {
                    toast(`Task "${deal.title}": an assigned employee record is missing — its Active/Completed tracking was skipped.`, 'error');
                }
                return;
            }
            const role = contact.role;
            const visible = canViewStage(stageKey, role);
            const grabOk = (typeof canGrab === 'function') ? canGrab(stageKey, role) : true;
            const wasActive = !!deal.employeeActive[cid];

            if (!wasActive && visible && grabOk) {
                deal.employeeActive[cid] = now; // opens this employee's active window
                delete deal.completions[cid]; // back in a visible+grab stage = active again, not completed
                return;
            }

            if (wasActive && !visible) {
                const startedAt = deal.employeeActive[cid];
                delete deal.employeeActive[cid]; // closes it
                recordAssigneeCompletion(deal, contact, safeDurationMs(startedAt), stageKey, mover);
            }
        });
    }

    // Writes the "Completed" row to the Task Activity trail — Employee
    // Lastname, Firstname is the ASSIGNEE whose window just closed, not
    // whoever dragged the card — plus a matching Recent Activity line, and
    // stamps deal.completions[contactId] so the Kanban card badge and the
    // per-user Completed/Pending counters (navigation.js#updateBadges)
    // can read it back without re-deriving it from the activity log.
    // `mover` ({fname,lname}, optional) is whoever actually performed the
    // move that triggered this — recorded separately from the assignee for
    // audit reference, since they're frequently different people. Omitted
    // (or blank) when this was caught by reconcileTaskLifecycle() instead
    // of an explicit move — there's no specific mover to credit there.
    function recordAssigneeCompletion(deal, contact, durationMs, stageKey, mover) {
        const fname = contact.fname || '';
        const lname = contact.lname || '';
        const roleName = (typeof getRoleName === 'function') ? getRoleName(contact.role) : (contact.role || '');

        if (!deal.completions) deal.completions = {};
        deal.completions[contact.id] = {
            role: contact.role || '',
            roleName,
            completedAt: new Date().toISOString(),
        };

        // ── Dedup guard ──
        // deal.completions is the fast-path flag, but it lives on the deal
        // object itself — if a background reload (session.js's 5s
        // auto-refresh, or navigate()'s reloadAllData()) ever wins a race
        // against saveAll() and hands back a stale `deals` array that's
        // missing this flag, reconcileTaskLifecycle() would see
        // "not completed" again on the very next render and call back in
        // here. The flag would get reset either way (harmless), but
        // without this guard it would ALSO push a brand new taskActivity
        // row and Recent Activity line every single time that happens —
        // the actual "infinite activity log" symptom. taskActivity itself
        // isn't subject to that same race (it's only ever appended to,
        // never overwritten wholesale by a reload), so it's the reliable
        // source of truth for "have we already logged this one." If a
        // 'completed' row already exists for this exact task+employee,
        // the flag is still refreshed above, but nothing new gets logged.
        const alreadyLogged = (typeof taskActivity !== 'undefined' && Array.isArray(taskActivity))
            && taskActivity.some(e => e.action === 'completed' && e.taskId === deal.id && e.linkedEmployee === contact.id);
        if (alreadyLogged) return;

        if (typeof taskActivity !== 'undefined' && Array.isArray(taskActivity)) {
            taskActivity.unshift({
                id: (typeof uid === 'function') ? uid() : String(Date.now()) + Math.random().toString(16).slice(2),
                taskId: deal.id,
                title: deal.title,
                action: 'completed',
                stage: stageKey,
                createdAt: new Date().toISOString(),
                linkedEmployee: contact.id,
                fname,
                lname,
                durationMs,
                // Audit reference: who actually moved the card, distinct
                // from the assignee (fname/lname above) whose task closed.
                movedByFname: (mover && mover.fname) || '',
                movedByLname: (mover && mover.lname) || '',
            });
            if (taskActivity.length > 1000) taskActivity.length = 1000;
        }

        if (typeof logTaskCompletionActivity === 'function') {
            logTaskCompletionActivity(lname, fname, deal.title);
        } else {
            console.warn('recordAssigneeCompletion: logTaskCompletionActivity not found — Recent Activity not updated.');
        }
    }

    // ── Reconciliation: catches state that "moved"/"created" events never saw ──
    // processAssigneeLifecycle() above only reacts to an explicit
    // create/move event. Two common situations slip past it entirely:
    //   1. A task was already sitting in a stage before that stage's
    //      "Visible to" role list was edited to exclude the assignee's
    //      role — no move happened, so nothing ever fired.
    //   2. A deal.stage got set some other way that never called
    //      logTaskActivity (seed/import data, a bulk edit, etc).
    // This walks every deal and brings deal.employeeActive / deal.completions
    // back in sync with each assignee's CURRENT stage visibility, so the
    // Kanban badges and Completed/Pending counters are always correct
    // even if no lifecycle event ever ran for this exact transition. Safe
    // to call as often as needed — a no-op once state already matches.
    // Returns true if it changed anything (caller can decide to persist).
    function reconcileTaskLifecycle() {
        if (typeof deals === 'undefined' || typeof contacts === 'undefined') return false;
        if (typeof canViewStage !== 'function') return false;
        let changed = false;

        deals.forEach(deal => {
            const assigneeIds = (deal.contactIds && deal.contactIds.length) ? deal.contactIds : (deal.contactId ? [deal.contactId] : []);
            if (!assigneeIds.length) return;
            if (!deal.employeeActive) deal.employeeActive = {};
            if (!deal.completions) deal.completions = {};

            assigneeIds.forEach(cid => {
                const contact = contacts.find(c => c.id === cid);
                if (!contact) return; // missing-contact warning already surfaced elsewhere
                const role = contact.role;
                const visible = canViewStage(deal.stage, role);
                const grabOk = (typeof canGrab === 'function') ? canGrab(deal.stage, role) : true;
                const isActive = !!deal.employeeActive[cid];
                const isCompleted = !!deal.completions[cid];

                if (!visible && !isCompleted) {
                    // Sitting somewhere this role can't see, but nothing
                    // ever closed it out. Use the recorded start time if
                    // there is one; otherwise there's no real "active"
                    // duration to report.
                    const startedAt = deal.employeeActive[cid] || null;
                    delete deal.employeeActive[cid];
                    recordAssigneeCompletion(deal, contact, safeDurationMs(startedAt), deal.stage);
                    changed = true;
                    return;
                }

                if (visible && grabOk && isCompleted) {
                    // Back in a visible+grab stage — reopen the window.
                    delete deal.completions[cid];
                    deal.employeeActive[cid] = new Date().toISOString();
                    changed = true;
                    return;
                }

                if (visible && grabOk && !isActive && !isCompleted) {
                    // Visible+grab but was never started (e.g. an assignee
                    // added after the task already landed here).
                    deal.employeeActive[cid] = new Date().toISOString();
                    changed = true;
                }
            });
        });

        return changed;
    }
    window.reconcileTaskLifecycle = reconcileTaskLifecycle;

    // ── Additional convenience functions (optional) ──
    // These can be called directly from other parts of the app.

    window.logTaskCreated = function(taskId, title, stage) {
        logTaskActivity(taskId, 'created', { title, stage });
    };

    window.logTaskMoved = function(taskId, title, fromStage, toStage) {
        logTaskActivity(taskId, 'moved', { title, stage: toStage, fromStage });
    };

    window.logTaskCommented = function(taskId, title, stage, linkedEmployeeId, commentText) {
        logTaskActivity(taskId, 'comment', { title, stage, linkedEmployeeId, comment: commentText });
    };

    window.logTaskRevision = function(taskId, title, stage, linkedEmployeeId, revisionText) {
        logTaskActivity(taskId, 'revision', { title, stage, linkedEmployeeId, revision: revisionText });
    };

    window.logTaskDeleted = function(taskId, title, stage) {
        logTaskActivity(taskId, 'deleted', { title, stage });
    };

})();