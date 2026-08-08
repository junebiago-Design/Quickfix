// ══════════════════════════════════════════════
//  services/roles.js — TMS Roles
//  Loaded as a classic script right after
//  core/api-client.js (needs load()/save() from
//  that file, already defined by the time this
//  parses since it's included later in index.html).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  BUILT-IN SYSTEM ROLE
//  A fixed role, baked into the app rather than
//  user-created. Anyone assigned this role is a
//  superuser: they bypass the stage "Visible To
//  Roles" restriction AND the topbar employee
//  task-assignment filter, seeing every stage and
//  every task regardless of who they're viewing as.
//  It cannot be deleted from the Roles page (see
//  deleteRole() in app.js) and is re-seeded here on
//  every load in case it's ever missing, exactly
//  like the default stages above are.
// ══════════════════════════════════════════════
const SYSTEM_ROLE_ID = 'role_system_admin';

function loadRoles() {
    let r = load('roles');
    if (!Array.isArray(r)) r = [];
    if (!r.find(x => x.id === SYSTEM_ROLE_ID)) {
        r.unshift({
            id: SYSTEM_ROLE_ID,
            name: 'System Administrator',
            desc: 'Built-in role. Cannot be deleted. Sees every task and stage regardless of other filters.',
            status: 'active',
            system: true,
            createdAt: new Date().toISOString(),
        });
        save('roles', r);
    }
    return r;
}
let roles = loadRoles();
