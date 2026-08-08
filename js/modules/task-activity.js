// ══════════════════════════════════════════════
//  TASK ACTIVITY — js/modules/task-activity.js
//  Full per-task audit trail: every "created", "moved", "comment",
//  "revision", and "deleted" entry logged against a task (kv key
//  "task_activity" / tms_task_activity.json), newest first, batched
//  50-at-a-time with pagination controls ABOVE the table, and two
//  independent search filters (task title, employee name).
//
//  The source feed only stores the stage a task landed IN at each
//  step — it doesn't store "from -> to" directly. So for every "moved"
//  entry this module walks that task's own timeline chronologically
//  and diffs it against whatever entry (created/moved/comment/
//  revision) came immediately before it, to get both the stage it
//  moved FROM and how long it sat there before this move.
//
//  Depends on: helpers.js (fmtDate, getContactName), globals `stages`
//  (stage key -> label) and the task-activity array itself, tried here
//  under a few plausible names since api.js (which loads it) wasn't
//  available when this module was written — adjust
//  getTaskActivityFeed() if your actual global is named differently.
// ══════════════════════════════════════════════

const TASK_ACTIVITY_PAGE_SIZE = 50;
let taskActivityPage = 1;

function getTaskActivityFeed() {
    if (typeof taskActivity !== 'undefined' && Array.isArray(taskActivity)) return taskActivity;
    if (typeof taskActivityLog !== 'undefined' && Array.isArray(taskActivityLog)) return taskActivityLog;
    if (typeof taskActivities !== 'undefined' && Array.isArray(taskActivities)) return taskActivities;
    if (typeof dealActivity !== 'undefined' && Array.isArray(dealActivity)) return dealActivity;
    if (typeof task_activity !== 'undefined' && Array.isArray(task_activity)) return task_activity;
    return [];
}

function taskActivityStageLabel(key) {
    if (!key) return '—';
    const s = (typeof stages !== 'undefined') ? stages.find(x => x.key === key) : null;
    return s ? s.label : key;
}

function fmtDuration(ms) {
    if (ms == null || isNaN(ms) || ms < 0) return '';
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (!d && m) parts.push(`${m}m`);
    if (!d && !h && !m) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}

// { entryId -> { fromStage, ms } } for every "moved" entry across all tasks.
function computeTaskActivityTransitions(entries) {
    const byTask = {};
    entries.forEach(e => {
        (byTask[e.taskId] || (byTask[e.taskId] = [])).push(e);
    });
    const info = {};
    Object.values(byTask).forEach(list => {
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        for (let i = 0; i < list.length; i++) {
            const cur = list[i];
            if (cur.action !== 'moved') continue;
            const prev = list[i - 1];
            info[cur.id] = {
                fromStage: prev ? prev.stage : null,
                ms: prev ? (new Date(cur.createdAt) - new Date(prev.createdAt)) : null,
            };
        }
    });
    return info;
}

function taskActivityActionBadge(action) {
    const map = {
        created: 'badge-success',
        moved: 'badge-info',
        comment: 'badge-comment',
        revision: 'badge-revision',
        deleted: 'badge-lost',
        completed: 'badge-success',
        archived: 'badge-lost',
    };
    return `<span class="badge ${map[action] || 'badge-info'}">${action}</span>`;
}

function taskActivityDetails(e, transitions) {
    if (e.action === 'created') {
        return `Task created${e.stage ? ` in <strong>${taskActivityStageLabel(e.stage)}</strong>` : ''}`;
    }
    if (e.action === 'moved') {
        const t = transitions[e.id] || {};
        const fromLabel = t.fromStage ? taskActivityStageLabel(t.fromStage) : '—';
        const toLabel = taskActivityStageLabel(e.stage);
        const dur = fmtDuration(t.ms);
        return `Moved <strong>${fromLabel}</strong> → <strong>${toLabel}</strong>${dur ? ` · took ${dur}` : ''}`;
    }
    if (e.action === 'comment') {
        const who = e.linkedEmployee && typeof getContactName === 'function' ? getContactName(e.linkedEmployee) : '';
        return `Added a comment${who ? ` for ${who}` : ''}`;
    }
    if (e.action === 'revision') {
        const who = e.linkedEmployee && typeof getContactName === 'function' ? getContactName(e.linkedEmployee) : '';
        return `Requested a revision${who ? ` from ${who}` : ''}`;
    }
    if (e.action === 'deleted') {
        return `Task deleted${e.stage ? ` (was in <strong>${taskActivityStageLabel(e.stage)}</strong>)` : ''}`;
    }
    if (e.action === 'completed') {
        // e.fname/e.lname here is the ASSIGNEE whose active window closed
        // (task-activity-writer.js#recordAssigneeCompletion), already
        // shown in the Employee column — this cell adds the elapsed
        // active time, where it moved out to, and — for audit reference —
        // who actually performed the move, when that's known (blank when
        // this was caught by the reconciliation pass instead of a live
        // move, since there's no specific mover to credit then).
        const dur = fmtDuration(e.durationMs);
        const toLabel = e.stage ? taskActivityStageLabel(e.stage) : '';
        const moverLabel = (e.movedByLname || e.movedByFname) ? `${e.movedByLname || ''}, ${e.movedByFname || ''}`.replace(/^,\s*/, '').trim() : '';
        return `Task left the stages visible to this employee's role${toLabel ? ` (moved to <strong>${toLabel}</strong>)` : ''}${dur ? ` · active for ${dur}` : ''}${moverLabel ? ` · moved by <strong>${moverLabel}</strong>` : ''}`;
    }
    if (e.action === 'archived') {
        const fromLabel = e.fromStage ? taskActivityStageLabel(e.fromStage) : '—';
        const toLabel = e.stage ? taskActivityStageLabel(e.stage) : '—';
        return `Archived — moved between two Final stages: <strong>${fromLabel}</strong> → <strong>${toLabel}</strong>`;
    }
    return e.action || '—';
}

function renderTaskActivity(goToPage) {
    const tbody = document.getElementById('ta-tbody');
    if (!tbody) return;

    if (goToPage) taskActivityPage = goToPage;

    const qTitle = (document.getElementById('ta-search-title')?.value || '').toLowerCase().trim();
    const qEmployee = (document.getElementById('ta-search-employee')?.value || '').toLowerCase().trim();

    const all = getTaskActivityFeed();
    const transitions = computeTaskActivityTransitions(all);

    let list = all.filter(e => {
        if (qTitle && !(e.title || '').toLowerCase().includes(qTitle)) return false;
        if (qEmployee) {
            const empName = `${e.fname || ''} ${e.lname || ''}`.toLowerCase();
            if (!empName.includes(qEmployee)) return false;
        }
        return true;
    });

    // Newest first
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalCount = list.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / TASK_ACTIVITY_PAGE_SIZE));
    if (taskActivityPage > totalPages) taskActivityPage = totalPages;
    if (taskActivityPage < 1) taskActivityPage = 1;

    const start = (taskActivityPage - 1) * TASK_ACTIVITY_PAGE_SIZE;
    const pageItems = list.slice(start, start + TASK_ACTIVITY_PAGE_SIZE);

    const countEl = document.getElementById('ta-count');
    if (countEl) countEl.textContent = `${totalCount} record${totalCount === 1 ? '' : 's'}`;

    renderTaskActivityPagination(totalPages);

    if (!pageItems.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="es-icon">🕓</span><h3>No activity found</h3><p>Try a different search.</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = pageItems.map(e => {
        const empName = (e.fname || e.lname) ? `${e.fname || ''} ${e.lname || ''}`.trim() : '—';
        const d = new Date(e.createdAt);
        const timeStr = isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `
      <tr>
        <td style="white-space:nowrap;">
          <div style="font-family:'DM Mono',monospace;font-size:0.78rem;">${(typeof fmtDate === 'function') ? fmtDate(e.createdAt) : e.createdAt}</div>
          <div class="text-muted" style="font-size:0.7rem;">${timeStr}</div>
        </td>
        <td><span class="td-name">${e.title || '—'}</span></td>
        <td>${empName}</td>
        <td>${taskActivityActionBadge(e.action)}</td>
        <td style="font-size:0.82rem;color:var(--text2);">${taskActivityDetails(e, transitions)}</td>
      </tr>
    `;
    }).join('');
}

function renderTaskActivityPagination(totalPages) {
    const el = document.getElementById('ta-pagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    el.innerHTML = `
        <button class="icon-btn" ${taskActivityPage <= 1 ? 'disabled' : ''} onclick="renderTaskActivity(${taskActivityPage - 1})" title="Previous 50">‹</button>
        <span class="text-muted" style="font-size:0.78rem;">Page ${taskActivityPage} of ${totalPages}</span>
        <button class="icon-btn" ${taskActivityPage >= totalPages ? 'disabled' : ''} onclick="renderTaskActivity(${taskActivityPage + 1})" title="Next 50">›</button>
    `;
}

// ══════════════════════════════════════════════
//  EXPORT TASK ACTIVITY REPORT (CSV)
//  Uses the same filter logic as renderTaskActivity
// ══════════════════════════════════════════════

function exportTaskActivityReport() {
    const qTitle = (document.getElementById('ta-search-title')?.value || '').toLowerCase().trim();
    const qEmployee = (document.getElementById('ta-search-employee')?.value || '').toLowerCase().trim();

    const all = getTaskActivityFeed();
    const transitions = computeTaskActivityTransitions(all);

    // Apply the same filters as renderTaskActivity()
    let list = all.filter(e => {
        if (qTitle && !(e.title || '').toLowerCase().includes(qTitle)) return false;
        if (qEmployee) {
            const empName = `${e.fname || ''} ${e.lname || ''}`.toLowerCase();
            if (!empName.includes(qEmployee)) return false;
        }
        return true;
    });

    // Newest first
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!list.length) {
        // Use the global toast function if available
        if (typeof toast === 'function') {
            toast('No task activity to export. Try adjusting your filters.', 'warning');
        } else {
            console.warn('No task activity to export.');
        }
        return;
    }

    // Build CSV rows
    const headers = ['Date', 'Time', 'Task', 'Employee', 'Action', 'Details'];
    const rows = list.map(e => {
        const d = new Date(e.createdAt);
        const dateStr = isNaN(d) ? e.createdAt : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
        const timeStr = isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const empName = (e.fname || e.lname) ? `${e.fname || ''} ${e.lname || ''}`.trim() : '—';
        const action = e.action || '—';
        const details = taskActivityDetails(e, transitions).replace(/<[^>]*>/g, ''); // strip HTML tags

        return [dateStr, timeStr, e.title || '—', empName, action, details];
    });

    // Build CSV string
    let csv = '# Task Activity Report\n';
    csv += `# Generated: ${new Date().toLocaleString()}\n`;
    csv += `# Total Records: ${list.length}\n`;
    if (qTitle) csv += `# Filter: Title contains "${qTitle}"\n`;
    if (qEmployee) csv += `# Filter: Employee contains "${qEmployee}"\n`;
    csv += '# \n';
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Download
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `task_activity_report_${date}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (typeof toast === 'function') {
            toast(`Exported ${list.length} task activity records`, 'success');
        }
    } catch (err) {
        if (typeof toast === 'function') {
            toast('Failed to export report: ' + err.message, 'error');
        } else {
            console.error('Export failed:', err);
        }
    }
}

// ── Expose globally ──────────────────────────────────────────────────
window.exportTaskActivityReport = exportTaskActivityReport;

console.log('✅ Task Activity module loaded with export function');