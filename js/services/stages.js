// ══════════════════════════════════════════════
//  services/stages.js — TMS Kanban Stages
//  Loaded as a classic script right after
//  core/api-client.js (needs load()/save() from
//  that file, already defined by the time this
//  parses since it's included later in index.html).
// ══════════════════════════════════════════════

function loadStages() {
    let s = load('stages');
    if (!s || !s.length) {
        s = [
            { key: 'todo', label: 'To Do', color: '#4f8ef7', final: false },
            { key: 'inprogress', label: 'In Progress', color: '#a78bfa', final: false },
        ];
        save('stages', s);
    }
    return s;
}
let stages = loadStages();
