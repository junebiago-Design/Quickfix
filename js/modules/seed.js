// ══════════════════════════════════════════════
//  SEED — js/modules/seed.js
//  Part of app.js module split.
//  Depends on js/api.js (data layer) and other
//  js/modules/*.js files being loaded first per
//  index.html script order. Shares the global
//  scope (classic scripts).
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  SEED
// ══════════════════════════════════════════════

function seedIfEmpty() {
    if (departments.length === 0) {
        departments = [{ id: 'dep1', name: 'Engineering', desc: 'Core tech dev', status: 'active',
            companyId: 'comp1', createdAt: new Date().toISOString() }];
    }
    if (companies.length === 0) {
        companies = [{ id: 'comp1', name: 'TMS Global', industry: 'Software', phone: '123', status: 'active',
            createdAt: new Date().toISOString() }];
    }
    if (roles.length === 0) {
        roles = [{ id: 'role1', name: 'Employee', desc: 'Standard employee role', status: 'active',
            createdAt: new Date().toISOString() }];
    }
    saveAll();
}

