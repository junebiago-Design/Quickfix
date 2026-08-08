// ══════════════════════════════════════════════
//  EMPLOYEE DIRECTORY — js/modules/employee-directory.js
//  Read-only employee list with login status and activity tracking
//  Uses SQLite backend via api.php
//  REAL‑TIME: updateEmployeeStatus() updates the
//  status indicator, last active, and duration
//  instantly when a login/logout event arrives.
// ══════════════════════════════════════════════

let filteredEmployees = [];
let employeeDirectorySearchTimeout = null;
let employeeDirectoryRefreshInterval = null;

/**
 * Main render function for Employee Directory page
 */
function renderEmployeeDirectory() {
    try {
        const container = document.getElementById('page-employee-directory');
        if (!container) return;
        
        // Clear any existing refresh interval
        if (employeeDirectoryRefreshInterval) {
            clearInterval(employeeDirectoryRefreshInterval);
            employeeDirectoryRefreshInterval = null;
        }
        
        // Ensure global data exists
        if (typeof contacts === 'undefined' || !contacts) {
            console.warn('Employee Directory: contacts not loaded yet');
            return;
        }
        
        // Populate filter dropdowns from current data
        populateEmployeeDirectoryFilters();
        
        // Apply filters and render
        filterEmployeeDirectory();
        
        // Start auto-refresh for online status (every 15 seconds)
        employeeDirectoryRefreshInterval = setInterval(async () => {
            const edPage = document.getElementById('page-employee-directory');
            if (edPage && edPage.classList.contains('active')) {
                // Only refresh if page is visible
                await refreshEmployeeLoginData();
                // Re-apply filters with fresh data
                filterEmployeeDirectory();
            }
        }, 15000);
        
    } catch (err) {
        console.error('Error rendering Employee Directory:', err);
        showEmployeeDirectoryError('Failed to load employee directory. Please refresh the page.');
    }
}

/**
 * Show error message in the employee directory
 */
function showEmployeeDirectoryError(message) {
    const tbody = document.getElementById('ed-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state" style="color:var(--danger, #dc3545);">
                        <span class="es-icon">⚠️</span>
                        <h3>Error Loading Data</h3>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

/**
 * Populate filter dropdowns for employee directory
 */
function populateEmployeeDirectoryFilters() {
    try {
        // Department filter
        const deptSelect = document.getElementById('ed-department-filter');
        if (deptSelect && typeof departments !== 'undefined') {
            const currentVal = deptSelect.value;
            deptSelect.innerHTML = '<option value="">All Departments</option>';
            const sortedDepts = [...departments].sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
            );
            sortedDepts.forEach(dept => {
                if (dept.id) {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name || 'Unnamed Department';
                    deptSelect.appendChild(option);
                }
            });
            if (currentVal) deptSelect.value = currentVal;
        }
        
        // Company filter
        const compSelect = document.getElementById('ed-company-filter');
        if (compSelect && typeof companies !== 'undefined') {
            const currentVal = compSelect.value;
            compSelect.innerHTML = '<option value="">All Companies</option>';
            const sortedComps = [...companies].sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
            );
            sortedComps.forEach(comp => {
                if (comp.id) {
                    const option = document.createElement('option');
                    option.value = comp.id;
                    option.textContent = comp.name || 'Unnamed Company';
                    compSelect.appendChild(option);
                }
            });
            if (currentVal) compSelect.value = currentVal;
        }
        
        // Role filter
        const roleSelect = document.getElementById('ed-role-filter');
        if (roleSelect && typeof roles !== 'undefined') {
            const currentVal = roleSelect.value;
            roleSelect.innerHTML = '<option value="">All Roles</option>';
            const sortedRoles = [...roles].sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
            );
            sortedRoles.forEach(role => {
                if (role.id) {
                    const option = document.createElement('option');
                    option.value = role.id;
                    option.textContent = role.name || 'Unnamed Role';
                    roleSelect.appendChild(option);
                }
            });
            if (currentVal) roleSelect.value = currentVal;
        }
        
        // Status filter - preserve current value
        const statusSelect = document.getElementById('ed-status-filter');
        if (statusSelect) {
            const currentVal = statusSelect.value;
            if (currentVal) statusSelect.value = currentVal;
        }
    } catch (err) {
        console.warn('Error populating filters:', err);
    }
}

/**
 * Force refresh login data from server - ALWAYS fetches fresh data
 * This ensures logout status is reflected immediately
 */
async function refreshEmployeeLoginData() {
    try {
        // Always fetch fresh from server with cache-busting
        const response = await fetch(`${API_ENDPOINT}?action=getLoginLogs&limit=500&_=${Date.now()}`, { 
            cache: 'no-store'
        });
        const data = await response.json();
        if (data && data.ok && data.logs) {
            window.loginLogs = data.logs;
            // Update localStorage cache
            try {
                localStorage.setItem('tms_login_logs', JSON.stringify(window.loginLogs));
            } catch (e) {
                // Ignore localStorage errors
            }
            return window.loginLogs;
        }
    } catch (err) {
        console.warn('Could not refresh login data from server:', err);
    }
    
    // Fallback: try to load from localStorage
    try {
        const stored = localStorage.getItem('tms_login_logs');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                window.loginLogs = parsed;
                return parsed;
            }
        }
    } catch (e) {
        // Ignore localStorage errors
    }
    
    // If all else fails, initialize as empty array
    if (typeof window.loginLogs === 'undefined') {
        window.loginLogs = [];
    }
    return window.loginLogs;
}

/**
 * Fetch login logs from server for employee status
 * Now ALWAYS fetches fresh data to reflect logout status
 */
async function fetchEmployeeLoginData() {
    // Always fetch fresh data from server - this ensures logout status is reflected
    return await refreshEmployeeLoginData();
}

/**
 * Filter employees based on all criteria
 */
async function filterEmployeeDirectory() {
    try {
        const search = document.getElementById('ed-search')?.value?.toLowerCase() || '';
        const departmentId = document.getElementById('ed-department-filter')?.value || '';
        const companyId = document.getElementById('ed-company-filter')?.value || '';
        const roleId = document.getElementById('ed-role-filter')?.value || '';
        const status = document.getElementById('ed-status-filter')?.value || '';
        
        // Ensure contacts exists
        if (typeof contacts === 'undefined' || !contacts) {
            console.warn('Employee Directory: contacts not available');
            return;
        }
        
        // Always fetch the latest login data from server
        await fetchEmployeeLoginData();
        
        // Get all employees
        let employeeList = [...contacts];
        if (status) {
            employeeList = employeeList.filter(c => c.status === status);
        }
        
        // Apply filters
        filteredEmployees = employeeList.filter(employee => {
            // Search filter - search across multiple fields
            if (search) {
                const searchable = [
                    employee.fname || '',
                    employee.lname || '',
                    employee.email || '',
                    employee.phone || '',
                    getDepartmentName(employee.department),
                    getCompanyName(employee.company),
                    getRoleName(employee.role)
                ].join(' ').toLowerCase();
                if (!searchable.includes(search)) return false;
            }
            
            // Department filter
            if (departmentId && employee.department !== departmentId) return false;
            
            // Company filter
            if (companyId && employee.company !== companyId) return false;
            
            // Role filter
            if (roleId && employee.role !== roleId) return false;
            
            return true;
        });
        
        // Sort by last name
        filteredEmployees.sort((a, b) => {
            const nameA = `${a.lname || ''} ${a.fname || ''}`.trim();
            const nameB = `${b.lname || ''} ${b.fname || ''}`.trim();
            return nameA.localeCompare(nameB);
        });
        
        // Update count and render
        updateEmployeeDirectoryStats();
        renderEmployeeDirectoryTable();
    } catch (err) {
        console.error('Error filtering employee directory:', err);
        showEmployeeDirectoryError('Error loading employee data. Please refresh the page.');
    }
}

/**
 * Update employee directory statistics
 */
function updateEmployeeDirectoryStats() {
    try {
        const total = filteredEmployees.length;
        const active = filteredEmployees.filter(e => e.status === 'active').length;
        const inactive = filteredEmployees.filter(e => e.status === 'inactive').length;
        const online = filteredEmployees.filter(e => {
            try {
                const status = getEmployeeLoginStatus(e.id);
                return status && status.isOnline === true && e.status === 'active';
            } catch (err) {
                return false;
            }
        }).length;
        
        const totalEl = document.getElementById('ed-total-count');
        if (totalEl) totalEl.textContent = total;
        
        const activeEl = document.getElementById('ed-active-count');
        if (activeEl) activeEl.textContent = active;
        
        const inactiveEl = document.getElementById('ed-inactive-count');
        if (inactiveEl) inactiveEl.textContent = inactive;
        
        const onlineEl = document.getElementById('ed-online-count');
        if (onlineEl) onlineEl.textContent = online;
    } catch (err) {
        console.warn('Error updating stats:', err);
    }
}

/**
 * Get employee login status and last activity from loginLogs
 * Now uses the latest data from window.loginLogs which is refreshed on each filter
 */
function getEmployeeLoginStatus(employeeId) {
    try {
        if (!employeeId) return { status: 'Never Logged In', lastActive: null, duration: null, isOnline: false };
        
        // Find user account linked to this employee
        const user = (typeof users !== 'undefined' && users) ? users.find(u => u.employeeId === employeeId) : null;
        if (!user) return { status: 'No Account', lastActive: null, duration: null, isOnline: false };
        
        // Find login logs for this user from the global loginLogs
        const logs = (typeof window.loginLogs !== 'undefined' && window.loginLogs) ? window.loginLogs : [];
        const userLogs = logs.filter(log => log.userId === user.id);
        if (!userLogs.length) return { status: 'Never Logged In', lastActive: null, duration: null, isOnline: false };
        
        // Sort by login time (newest first)
        const sortedLogs = [...userLogs].sort((a, b) => 
            new Date(b.loginTime) - new Date(a.loginTime)
        );
        
        const latest = sortedLogs[0];
        
        // Check if currently logged in - uses logoutTime field from server
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
        const loginTime = new Date(latest.loginTime);
        const isOnline = !latest.logoutTime && latest.status === 'success' && loginTime > thirtyMinAgo;
        
        // Calculate duration of current session if online
        let duration = null;
        if (isOnline && latest.loginTime) {
            duration = calculateEmployeeDuration(latest.loginTime, new Date().toISOString());
        } else if (latest.logoutTime) {
            duration = calculateEmployeeDuration(latest.loginTime, latest.logoutTime);
        }
        
        // Get last activity time
        let lastActive = latest.loginTime;
        if (!isOnline && latest.logoutTime) {
            lastActive = latest.logoutTime;
        }
        
        return {
            status: isOnline ? 'Online' : 'Offline',
            lastActive: lastActive,
            duration: duration,
            isOnline: isOnline,
            loginTime: latest.loginTime,
            logoutTime: latest.logoutTime
        };
    } catch (err) {
        console.warn('Error getting login status for employee:', employeeId, err);
        return { status: 'Error', lastActive: null, duration: null, isOnline: false };
    }
}

/**
 * Calculate duration between two ISO timestamp strings
 */
function calculateEmployeeDuration(start, end) {
    try {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (isNaN(startTime) || isNaN(endTime)) return null;
        return Math.floor((endTime - startTime) / 1000);
    } catch (e) {
        return null;
    }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatEmployeeDuration(seconds) {
    if (!seconds || seconds < 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

/**
 * Get status indicator HTML (large pulse for online, static red for offline)
 */
function getStatusIndicator(employeeId) {
    try {
        const loginInfo = getEmployeeLoginStatus(employeeId);
        
        if (loginInfo && loginInfo.isOnline) {
            // Large green pulse indicator
            return `
                <span class="status-indicator online" title="Online - Currently active">
                    <span class="pulse-ring"></span>
                    <span class="pulse-dot-large"></span>
                </span>
            `;
        } else {
            // Static red indicator
            return `
                <span class="status-indicator offline" title="Offline - Not currently active">
                    <span class="offline-dot"></span>
                </span>
            `;
        }
    } catch (err) {
        // Fallback: show offline indicator
        return `
            <span class="status-indicator offline" title="Status unknown">
                <span class="offline-dot"></span>
            </span>
        `;
    }
}

/**
 * Get current employee ID safely
 */
function getCurrentEmployeeIdSafe() {
    try {
        if (typeof getCurrentEmployeeId === 'function') {
            return getCurrentEmployeeId();
        }
        if (typeof currentUser !== 'undefined' && currentUser) {
            return currentUser.contactId || currentUser.employeeId || null;
        }
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Render the employee directory table
 */
function renderEmployeeDirectoryTable() {
    try {
        const tbody = document.getElementById('ed-tbody');
        if (!tbody) return;
        
        if (filteredEmployees.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <span class="es-icon">👤</span>
                            <h3>No employees found</h3>
                            <p>${contacts && contacts.length === 0 ? 'No employees have been added yet.' : 'Try adjusting your filters to see more results.'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Get current user's employee ID for highlighting
        const currentEmployeeId = getCurrentEmployeeIdSafe();
        
        let html = '';
        filteredEmployees.forEach(employee => {
            const fullName = `${employee.fname || ''} ${employee.lname || ''}`.trim();
            const isCurrentUser = employee.id === currentEmployeeId;
            
            // Get status indicator (online/offline)
            const statusIndicator = getStatusIndicator(employee.id);
            
            // Get login info for last active and duration
            const loginInfo = getEmployeeLoginStatus(employee.id);
            
            // Last active time
            let lastActiveDisplay = '—';
            if (loginInfo && loginInfo.lastActive) {
                try {
                    lastActiveDisplay = typeof fmtRelativeTime === 'function' 
                        ? fmtRelativeTime(loginInfo.lastActive)
                        : (typeof fmtShortDate === 'function' ? fmtShortDate(loginInfo.lastActive) : loginInfo.lastActive);
                } catch (e) {
                    lastActiveDisplay = loginInfo.lastActive;
                }
            }
            
            // Duration
            let durationDisplay = '—';
            if (loginInfo && loginInfo.duration !== null) {
                durationDisplay = formatEmployeeDuration(loginInfo.duration);
            }
            
            // Login time display
            let loginTimeDisplay = '—';
            if (loginInfo && loginInfo.loginTime) {
                try {
                    loginTimeDisplay = typeof fmtDate === 'function' 
                        ? fmtDate(loginInfo.loginTime)
                        : new Date(loginInfo.loginTime).toLocaleDateString();
                } catch (e) {
                    loginTimeDisplay = loginInfo.loginTime;
                }
            }
            
            // Employee status badge
            const statusClass = employee.status === 'active' ? 'success' : 'inactive';
            const statusLabel = employee.status === 'active' ? 'Active' : 'In-Active';
            
            // ⭐ ADD data‑employee‑id for real‑time updates
            html += `
                <tr class="${isCurrentUser ? 'current-user-row' : ''}" data-employee-id="${employee.id}" style="${isCurrentUser ? 'background:var(--accent-soft, rgba(99,102,241,0.08));' : ''}">
                    <td>
                        <div style="display:flex;align-items:center;gap:12px;">
                            ${statusIndicator}
                            ${avatarEl(fullName)}
                            <div>
                                <span class="td-name">${fullName}</span>
                                ${isCurrentUser ? ' <span class="badge badge-info" style="font-size:0.6rem;">You</span>' : ''}
                                <div style="font-size:0.7rem;color:var(--text3);">${employee.email || '—'}</div>
                            </div>
                        </div>
                    </td>
                    <td>${getDepartmentName(employee.department)}</td>
                    <td>${getCompanyName(employee.company)}</td>
                    <td>${employee.role ? getRoleName(employee.role) : 'Unassigned'}</td>
                    <td style="font-size:0.8rem;">${lastActiveDisplay}</td>
                    <td style="font-size:0.8rem;">${durationDisplay}</td>
                    <td>${loginTimeDisplay}</td>
                    <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch (err) {
        console.error('Error rendering table:', err);
        showEmployeeDirectoryError('Error rendering employee data. Please refresh the page.');
    }
}

/**
 * Reset all filters to default values
 */
function resetEmployeeDirectoryFilters() {
    try {
        document.getElementById('ed-search').value = '';
        document.getElementById('ed-department-filter').value = '';
        document.getElementById('ed-company-filter').value = '';
        document.getElementById('ed-role-filter').value = '';
        document.getElementById('ed-status-filter').value = '';
        filterEmployeeDirectory();
    } catch (err) {
        console.warn('Error resetting filters:', err);
    }
}

/**
 * Refresh employee directory data from server
 * Now also refreshes login data
 */
async function refreshEmployeeDirectory() {
    try {
        // First refresh login data from server
        await refreshEmployeeLoginData();
        // Then reload all data
        if (typeof reloadAllData === 'function') {
            await reloadAllData();
        }
        // Re-apply filters with fresh data
        await filterEmployeeDirectory();
    } catch (err) {
        console.warn('Error refreshing employee directory:', err);
    }
}

// ── ⭐ REAL‑TIME: UPDATE SINGLE EMPLOYEE STATUS ──
function updateEmployeeStatus(employeeId, status) {
    if (!employeeId) return;
    const page = document.getElementById('page-employee-directory');
    if (!page || !page.classList.contains('active')) return;
    
    // Find the row for this employee using data attribute
    const row = document.querySelector(`#ed-tbody tr[data-employee-id="${employeeId}"]`);
    if (!row) {
        // If row not found (filtered out), we can re‑render the whole table
        // (filters might have hidden this employee, but we can still update the cache)
        // We'll just refresh the whole table to keep it simple.
        filterEmployeeDirectory();
        return;
    }
    
    // Update the status indicator cell (first cell contains the status indicator)
    const firstCell = row.querySelector('td:first-child');
    if (!firstCell) return;
    
    const isOnline = status === 'online';
    const indicatorHtml = isOnline ? `
        <span class="status-indicator online" title="Online - Currently active">
            <span class="pulse-ring"></span>
            <span class="pulse-dot-large"></span>
        </span>
    ` : `
        <span class="status-indicator offline" title="Offline - Not currently active">
            <span class="offline-dot"></span>
        </span>
    `;
    
    // Replace the first child (the status indicator) – it's inside a div
    const div = firstCell.querySelector('div');
    if (div) {
        const existingIndicator = div.querySelector('.status-indicator');
        if (existingIndicator) {
            existingIndicator.outerHTML = indicatorHtml;
        }
    }
    
    // Update Last Active and Duration columns
    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
        // 5th cell is Last Active (index 4)
        // 6th cell is Duration (index 5)
        if (isOnline) {
            cells[4].textContent = 'Just now';
            cells[5].textContent = 'Active';
        } else {
            cells[4].textContent = '—';
            cells[5].textContent = '—';
        }
    }
}

// ── Handle page visibility change to refresh when user returns ──
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        const edPage = document.getElementById('page-employee-directory');
        if (edPage && edPage.classList.contains('active')) {
            refreshEmployeeLoginData().then(() => {
                filterEmployeeDirectory();
            });
        }
    }
});

// ── Clean up interval when page changes ──
if (typeof navigate === 'function') {
    const originalNavigate = window.navigate;
    window.navigate = function(page) {
        if (page !== 'employee-directory' && employeeDirectoryRefreshInterval) {
            clearInterval(employeeDirectoryRefreshInterval);
            employeeDirectoryRefreshInterval = null;
        }
        if (typeof originalNavigate === 'function') {
            originalNavigate(page);
        }
        if (page === 'employee-directory') {
            setTimeout(function() {
                if (typeof renderEmployeeDirectory === 'function') {
                    renderEmployeeDirectory();
                }
            }, 50);
        }
    };
}

// ── Expose functions globally ──
window.renderEmployeeDirectory = renderEmployeeDirectory;
window.filterEmployeeDirectory = filterEmployeeDirectory;
window.resetEmployeeDirectoryFilters = resetEmployeeDirectoryFilters;
window.refreshEmployeeDirectory = refreshEmployeeDirectory;
window.refreshEmployeeLoginData = refreshEmployeeLoginData;
window.getEmployeeLoginStatus = getEmployeeLoginStatus;
window.formatEmployeeDuration = formatEmployeeDuration;
window.updateEmployeeStatus = updateEmployeeStatus;

console.log('✅ Employee Directory module loaded with real‑time updates');