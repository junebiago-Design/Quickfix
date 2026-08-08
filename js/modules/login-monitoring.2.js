// ══════════════════════════════════════════════
//  login-monitoring.js — Login Monitoring Module
//  Renders login logs with filtering by employee,
//  department, company, and date range. Supports
//  report export with current filters.
//  Integrated with existing TMS data structures.
// ══════════════════════════════════════════════

// ── Global State ──────────────────────────────────────────────────────
let filteredLoginLogs = [];
let loginStats = null;
let loginLogsCache = [];

// ── Initialization ────────────────────────────────────────────────────

/**
 * Main render function for login monitoring page
 * Called by navigation system when page is shown
 */
async function renderLoginMonitoring() {
    const container = document.getElementById('page-login-monitoring');
    if (!container) return;
    
    // Show loading state
    showLoginLoading();
    
    try {
        // Populate filter dropdowns with current data
        populateFilterDropdowns();
        
        // Fetch fresh data from server
        await refreshLoginData();
        
        // Apply filters and render
        filterLoginLogs();
    } catch (err) {
        console.error('Failed to render login monitoring:', err);
        showLoginError('Failed to load login data. Please try again.');
    }
}

/**
 * Show loading state in the login monitoring page
 */
function showLoginLoading() {
    const tbody = document.getElementById('lm-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <span class="es-icon">⏳</span>
                        <h3>Loading login data...</h3>
                        <p>Please wait while we fetch the latest login records.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

/**
 * Show error state in the login monitoring page
 */
function showLoginError(message) {
    const tbody = document.getElementById('lm-tbody');
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

// ── Data Fetching ─────────────────────────────────────────────────────

/**
 * Refresh login data from server
 */
async function refreshLoginData() {
    try {
        // Fetch logs with default limit
        const logs = await getLoginLogs({ limit: 500 });
        if (logs && Array.isArray(logs)) {
            loginLogsCache = logs;
            // Also update the global loginLogs from api.js
            window.loginLogs = logs;
        } else {
            // Fallback to cached data
            loginLogsCache = window.loginLogs || [];
        }
        
        // Fetch stats
        const stats = await getLoginStats();
        if (stats) {
            loginStats = stats;
        }
    } catch (err) {
        console.warn('Failed to refresh login data, using cached:', err);
        loginLogsCache = window.loginLogs || [];
    }
}

// ── Filter Dropdown Population ──────────────────────────────────────

/**
 * Populate filter dropdowns with employees, departments, companies
 * Uses global data from api.js (contacts, users, departments, companies)
 */
function populateFilterDropdowns() {
    // Employee filter - only show contacts that have user accounts
    const empSelect = document.getElementById('lm-employee-filter');
    if (empSelect) {
        const currentVal = empSelect.value;
        empSelect.innerHTML = '<option value="">All Employees</option>';
        
        // Get users that have employee IDs
        const usersWithEmployees = users.filter(u => u.employeeId);
        
        // Sort contacts by name
        const sortedContacts = [...contacts].sort((a, b) => {
            const nameA = `${a.fname || ''} ${a.lname || ''}`.trim();
            const nameB = `${b.fname || ''} ${b.lname || ''}`.trim();
            return nameA.localeCompare(nameB);
        });
        
        sortedContacts.forEach(contact => {
            // Check if this contact has a user account
            const hasUser = usersWithEmployees.some(u => u.employeeId === contact.id);
            if (hasUser) {
                const option = document.createElement('option');
                option.value = contact.id;
                const fullName = `${contact.fname || ''} ${contact.lname || ''}`.trim();
                option.textContent = fullName || contact.email || contact.id;
                empSelect.appendChild(option);
            }
        });
        
        if (currentVal) empSelect.value = currentVal;
    }
    
    // Department filter
    const deptSelect = document.getElementById('lm-department-filter');
    if (deptSelect) {
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
    const compSelect = document.getElementById('lm-company-filter');
    if (compSelect) {
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
}

// ── Filter Logic ─────────────────────────────────────────────────────

/**
 * Filter login logs based on all filter criteria
 * Called by onchange/oninput events from filter controls
 */
function filterLoginLogs() {
    const search = document.getElementById('lm-search')?.value?.toLowerCase() || '';
    const status = document.getElementById('lm-status-filter')?.value || '';
    const employeeId = document.getElementById('lm-employee-filter')?.value || '';
    const departmentId = document.getElementById('lm-department-filter')?.value || '';
    const companyId = document.getElementById('lm-company-filter')?.value || '';
    const dateFrom = document.getElementById('lm-date-from')?.value || '';
    const dateTo = document.getElementById('lm-date-to')?.value || '';
    
    // Use cached logs or global
    const logs = loginLogsCache.length > 0 ? loginLogsCache : (window.loginLogs || []);
    
    // Apply filters
    filteredLoginLogs = logs.filter(log => {
        // Skip invalid logs
        if (!log || typeof log !== 'object') return false;
        
        // Search filter - search across multiple fields
        if (search) {
            const searchable = [
                log.username || '',
                log.userId || '',
                log.ipAddress || '',
                log.country || '',
                log.city || '',
                log.deviceType || '',
                log.browser || '',
                log.os || ''
            ].join(' ').toLowerCase();
            if (!searchable.includes(search)) return false;
        }
        
        // Status filter
        if (status && log.status !== status) return false;
        
        // Employee filter - find user by employee ID
        if (employeeId) {
            const user = users.find(u => u.employeeId === employeeId);
            if (!user || log.userId !== user.id) return false;
        }
        
        // Department filter - find employee's department
        if (departmentId) {
            const user = users.find(u => u.id === log.userId);
            if (!user) return false;
            const contact = contacts.find(c => c.id === user.employeeId);
            if (!contact || contact.departmentId !== departmentId) return false;
        }
        
        // Company filter - find employee's company
        if (companyId) {
            const user = users.find(u => u.id === log.userId);
            if (!user) return false;
            const contact = contacts.find(c => c.id === user.employeeId);
            if (!contact || contact.companyId !== companyId) return false;
        }
        
        // Date range filter
        if (dateFrom) {
            try {
                const logDate = new Date(log.loginTime);
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (logDate < fromDate) return false;
            } catch (e) {
                // Invalid date, skip filter
            }
        }
        if (dateTo) {
            try {
                const logDate = new Date(log.loginTime);
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (logDate > toDate) return false;
            } catch (e) {
                // Invalid date, skip filter
            }
        }
        
        return true;
    });
    
    // Sort by login time (newest first)
    filteredLoginLogs.sort((a, b) => {
        try {
            return new Date(b.loginTime) - new Date(a.loginTime);
        } catch (e) {
            return 0;
        }
    });
    
    // Update stats and render
    updateLoginStats();
    renderLoginLogsTable();
}

/**
 * Reset all filters to default values
 */
function resetLoginFilters() {
    document.getElementById('lm-search').value = '';
    document.getElementById('lm-status-filter').value = '';
    document.getElementById('lm-employee-filter').value = '';
    document.getElementById('lm-department-filter').value = '';
    document.getElementById('lm-company-filter').value = '';
    document.getElementById('lm-date-from').value = '';
    document.getElementById('lm-date-to').value = '';
    filterLoginLogs();
}

// ── Stats Update ─────────────────────────────────────────────────────

/**
 * Update login statistics based on filtered data
 */
function updateLoginStats() {
    const total = filteredLoginLogs.length;
    const failed = filteredLoginLogs.filter(l => l.status === 'failed').length;
    const success = total - failed;
    const uniqueUsers = new Set(filteredLoginLogs.map(l => l.userId).filter(id => id)).size;
    
    // Last 24 hours from filtered data
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24 = filteredLoginLogs.filter(l => {
        try {
            return new Date(l.loginTime) > oneDayAgo;
        } catch (e) {
            return false;
        }
    });
    
    // Update UI
    const totalEl = document.getElementById('lm-total');
    const rateEl = document.getElementById('lm-success-rate');
    const failedEl = document.getElementById('lm-failed');
    const usersEl = document.getElementById('lm-unique-users');
    const last24El = document.getElementById('lm-last24');
    const countEl = document.getElementById('lm-count');
    
    if (totalEl) totalEl.textContent = total;
    if (rateEl) rateEl.textContent = total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
    if (failedEl) failedEl.textContent = failed;
    if (usersEl) usersEl.textContent = uniqueUsers;
    if (last24El) last24El.textContent = last24.length;
    if (countEl) countEl.textContent = `${filteredLoginLogs.length} records`;
    
    // Update badge in sidebar
    const badge = document.getElementById('badge-login-logs');
    if (badge) {
        const failedCount = loginLogsCache.filter(l => l.status === 'failed').length;
        badge.textContent = failedCount > 0 ? failedCount : '0';
        badge.style.display = failedCount > 0 ? 'inline-block' : 'none';
    }
}

// ── Table Rendering ──────────────────────────────────────────────────

/**
 * Render the login logs table
 */
function renderLoginLogsTable() {
    const tbody = document.getElementById('lm-tbody');
    if (!tbody) return;
    
    if (filteredLoginLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <span class="es-icon">🔐</span>
                        <h3>No login logs found</h3>
                        <p>${loginLogsCache.length === 0 ? 
                            'Login activity will appear here as users log in.' : 
                            'Try adjusting your filters to see more results.'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    // Show up to 200 records for performance
    const displayLogs = filteredLoginLogs.slice(0, 200);
    
    displayLogs.forEach(log => {
        // Get user and contact info
        const user = users.find(u => u.id === log.userId);
        const contact = user ? contacts.find(c => c.id === user.employeeId) : null;
        
        // Build display name
        let displayName = log.username || 'Unknown';
        if (contact) {
            const fullName = `${contact.fname || ''} ${contact.lname || ''}`.trim();
            if (fullName) displayName = fullName;
        }
        
        // Status badge
        const statusClass = log.status === 'success' ? 'success' : 'danger';
        const statusIcon = log.status === 'success' ? '✅' : '❌';
        
        // Duration
        let duration = 'Active';
        if (log.logoutTime) {
            const seconds = calculateDuration(log.loginTime, log.logoutTime);
            duration = formatDuration(seconds);
        } else if (log.sessionDuration) {
            duration = formatDuration(log.sessionDuration);
        }
        
        // Location
        let location = 'Unknown';
        if (log.country) {
            location = log.country;
            if (log.city) location += `, ${log.city}`;
        }
        
        // Login time
        let loginTime = 'Unknown';
        try {
            loginTime = formatDateTime(log.loginTime);
        } catch (e) {
            loginTime = log.loginTime || 'Unknown';
        }
        
        html += `
            <tr>
                <td><strong>${displayName}</strong></td>
                <td>${loginTime}</td>
                <td><span class="badge badge-${statusClass}">${statusIcon} ${log.status}</span></td>
                <td><code style="font-size:0.75rem;">${log.ipAddress || 'Unknown'}</code></td>
                <td>${location}</td>
                <td>${log.deviceType || 'Unknown'}</td>
                <td>${log.browser || 'Unknown'}</td>
                <td>${duration}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ── Export Functions ──────────────────────────────────────────────────

/**
 * Export filtered login logs as report (CSV)
 */
function exportLoginReport() {
    if (filteredLoginLogs.length === 0) {
        showToast('No logs to export. Try adjusting your filters.', 'warning');
        return;
    }
    
    // Get filter context for report header
    const employeeId = document.getElementById('lm-employee-filter')?.value || '';
    const departmentId = document.getElementById('lm-department-filter')?.value || '';
    const companyId = document.getElementById('lm-company-filter')?.value || '';
    const dateFrom = document.getElementById('lm-date-from')?.value || '';
    const dateTo = document.getElementById('lm-date-to')?.value || '';
    
    // Build filter description
    let filterDesc = [];
    const emp = contacts.find(c => c.id === employeeId);
    if (emp) filterDesc.push(`Employee: ${emp.fname || ''} ${emp.lname || ''}`.trim());
    const dept = departments.find(d => d.id === departmentId);
    if (dept) filterDesc.push(`Department: ${dept.name}`);
    const comp = companies.find(c => c.id === companyId);
    if (comp) filterDesc.push(`Company: ${comp.name}`);
    if (dateFrom) filterDesc.push(`From: ${dateFrom}`);
    if (dateTo) filterDesc.push(`To: ${dateTo}`);
    const filterText = filterDesc.length ? ` (Filters: ${filterDesc.join(', ')})` : '';
    
    // Generate CSV
    const headers = ['Username', 'Login Time', 'Status', 'IP Address', 'Location', 'Device', 'Browser', 'OS', 'Duration'];
    const rows = filteredLoginLogs.map(log => {
        const user = users.find(u => u.id === log.userId);
        const contact = user ? contacts.find(c => c.id === user.employeeId) : null;
        let username = log.username || 'Unknown';
        if (contact) {
            const fullName = `${contact.fname || ''} ${contact.lname || ''}`.trim();
            if (fullName) username = fullName;
        }
        
        let duration = 'Active';
        if (log.logoutTime) {
            const seconds = calculateDuration(log.loginTime, log.logoutTime);
            duration = formatDuration(seconds);
        } else if (log.sessionDuration) {
            duration = formatDuration(log.sessionDuration);
        }
        
        let location = 'Unknown';
        if (log.country) {
            location = log.country;
            if (log.city) location += `, ${log.city}`;
        }
        
        let loginTime = 'Unknown';
        try {
            loginTime = new Date(log.loginTime).toLocaleString('en-US', { 
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) {
            loginTime = log.loginTime || 'Unknown';
        }
        
        return [
            username,
            loginTime,
            log.status || 'Unknown',
            log.ipAddress || 'Unknown',
            location,
            log.deviceType || 'Unknown',
            log.browser || 'Unknown',
            log.os || 'Unknown',
            duration
        ];
    });
    
    // Build CSV with header
    let csv = '# Login Monitoring Report\n';
    csv += `# Generated: ${new Date().toLocaleString()}\n`;
    csv += `# Total Logs: ${filteredLoginLogs.length}\n`;
    csv += `# ${filterText}\n`;
    csv += '# \n';
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    // Download
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `login_report_${date}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${filteredLoginLogs.length} login records`, 'success');
    } catch (err) {
        showToast('Failed to export report: ' + err.message, 'error');
    }
}

/**
 * Export current view as PDF-friendly HTML report
 */
function exportLoginReportHTML() {
    if (filteredLoginLogs.length === 0) {
        showToast('No logs to export. Try adjusting your filters.', 'warning');
        return;
    }
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Login Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f5f5f5; padding: 8px 12px; text-align: left; border: 1px solid #ddd; }
                td { padding: 8px 12px; border: 1px solid #ddd; }
                .success { color: #28a745; }
                .failed { color: #dc3545; }
            </style>
        </head>
        <body>
            <h1>Login Monitoring Report</h1>
            <div class="meta">
                Generated: ${new Date().toLocaleString()}<br>
                Total Logs: ${filteredLoginLogs.length}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Login Time</th>
                        <th>Status</th>
                        <th>IP Address</th>
                        <th>Location</th>
                        <th>Device</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredLoginLogs.slice(0, 100).forEach(log => {
        const user = users.find(u => u.id === log.userId);
        const contact = user ? contacts.find(c => c.id === user.employeeId) : null;
        let username = log.username || 'Unknown';
        if (contact) {
            const fullName = `${contact.fname || ''} ${contact.lname || ''}`.trim();
            if (fullName) username = fullName;
        }
        
        let duration = 'Active';
        if (log.logoutTime) {
            const seconds = calculateDuration(log.loginTime, log.logoutTime);
            duration = formatDuration(seconds);
        }
        
        let location = 'Unknown';
        if (log.country) {
            location = log.country;
            if (log.city) location += `, ${log.city}`;
        }
        
        const statusClass = log.status === 'success' ? 'success' : 'failed';
        
        html += `
            <tr>
                <td>${username}</td>
                <td>${formatDateTime(log.loginTime)}</td>
                <td class="${statusClass}">${log.status}</td>
                <td>${log.ipAddress || 'Unknown'}</td>
                <td>${location}</td>
                <td>${log.deviceType || 'Unknown'}</td>
                <td>${duration}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // Open in new window for printing/saving as PDF
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        showToast('Please allow popups to export HTML report.', 'warning');
    }
}

// ── Utility Functions ────────────────────────────────────────────────

/**
 * Format ISO datetime for display
 */
function formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return 'Unknown';
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
 * Calculate duration between two ISO timestamp strings
 */
function calculateDuration(start, end) {
    try {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (isNaN(startTime) || isNaN(endTime)) return 0;
        return Math.floor((endTime - startTime) / 1000);
    } catch (e) {
        return 0;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Fallback: alert if toast container doesn't exist
        console.log(`[${type}] ${message}`);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Clear old login logs (30+ days old)
 */
async function clearLoginLogsUI() {
    if (!confirm('This will delete all login logs older than 30 days. This action cannot be undone. Are you sure?')) return;
    
    try {
        const result = await clearLoginLogs(30);
        if (result && result.ok) {
            showToast(`Deleted ${result.deleted} old login logs`, 'success');
            await refreshLoginData();
            filterLoginLogs();
        } else {
            showToast('Failed to clear old logs', 'error');
        }
    } catch (err) {
        showToast('Error clearing logs: ' + err.message, 'error');
    }
}

/**
 * Get login statistics summary for dashboard widget
 */
function getLoginStatsSummary() {
    const total = loginLogsCache.length;
    const failed = loginLogsCache.filter(l => l.status === 'failed').length;
    const success = total - failed;
    
    // Last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = loginLogsCache.filter(l => {
        try {
            return new Date(l.loginTime) > sevenDaysAgo;
        } catch (e) {
            return false;
        }
    });
    
    return {
        total,
        failed,
        success,
        successRate: total > 0 ? Math.round((success / total) * 100) : 0,
        lastWeek: lastWeek.length,
        activeUsers: new Set(loginLogsCache.map(l => l.userId).filter(id => id)).size
    };
}

// ── Auto-init on Page Load ──────────────────────────────────────────

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if login monitoring page exists and is active
    const lmPage = document.getElementById('page-login-monitoring');
    if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
        setTimeout(renderLoginMonitoring, 100);
    }
});

// Also hook into the global navigate function if it exists
if (typeof navigate === 'function') {
    const originalNavigate = window.navigate;
    window.navigate = function(page) {
        originalNavigate(page);
        if (page === 'login-monitoring') {
            setTimeout(function() {
                if (typeof renderLoginMonitoring === 'function') {
                    renderLoginMonitoring();
                }
            }, 100);
        }
    };
}

// Hook into reloadAllData for refresh
if (typeof reloadAllData === 'function') {
    const originalReload = window.reloadAllData;
    window.reloadAllData = function() {
        return originalReload.apply(this, arguments).then(function() {
            const lmPage = document.getElementById('page-login-monitoring');
            if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
                renderLoginMonitoring();
            }
        });
    };
}

// ── Expose functions globally ──────────────────────────────────────

window.renderLoginMonitoring = renderLoginMonitoring;
window.filterLoginLogs = filterLoginLogs;
window.resetLoginFilters = resetLoginFilters;
window.exportLoginReport = exportLoginReport;
window.exportLoginReportHTML = exportLoginReportHTML;
window.clearLoginLogsUI = clearLoginLogsUI;
window.getLoginStatsSummary = getLoginStatsSummary;
window.refreshLoginData = refreshLoginData;
window.showToast = showToast;

console.log('✅ Login Monitoring module loaded');