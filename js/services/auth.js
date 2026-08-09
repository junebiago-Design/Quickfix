// ══════════════════════════════════════════════
//  services/auth.js — TMS Auth & Login Monitoring
//  Loaded as a classic script after core/api-client.js
//  (needs API_ENDPOINT, loginLogs, and save() from
//  that file, already defined by the time this parses
//  since it's included later in index.html).
// ══════════════════════════════════════════════

// Hashes a plaintext password for storage. Uses the Web Crypto
// SubtleCrypto SHA-256 digest when available (HTTPS/localhost —
// a "secure context"). Falls back to a simple non-cryptographic
// hash on plain-HTTP hosts (e.g. some shared hosting) where
// crypto.subtle is not exposed by the browser, so registration
// still works everywhere; upgrade to HTTPS for real security.
async function hashPassword(password) {
    if (window.crypto && window.crypto.subtle && window.isSecureContext) {
        try {
            const enc = new TextEncoder().encode(password);
            const buf = await window.crypto.subtle.digest('SHA-256', enc);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {}
    }
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = (hash * 31 + password.charCodeAt(i)) >>> 0;
    }
    return 'h' + hash.toString(16);
}

// ══════════════════════════════════════════════
//  LOGIN MONITORING FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Fetch login logs from the server with optional filters
 * @param {Object} options - Filter options
 * @param {number} options.limit - Max number of logs to return (default: 100)
 * @param {string} options.status - Filter by status ('success' or 'failed')
 * @param {string} options.userId - Filter by user ID
 * @param {string} options.username - Filter by username (partial match)
 * @returns {Promise<Array>} Array of login log entries
 */
async function getLoginLogs(options = {}) {
    const { limit = 100, status = null, userId = null, username = null } = options;
    
    try {
        let url = `${API_ENDPOINT}?action=getLoginLogs&limit=${limit}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;
        if (userId) url += `&userId=${encodeURIComponent(userId)}`;
        if (username) url += `&username=${encodeURIComponent(username)}`;
        
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        
        if (data && data.ok) {
            loginLogs = data.logs || [];
            save('login_logs', loginLogs);
            return loginLogs;
        }
    } catch (err) {
        console.warn('Could not fetch login logs from server, using cached data', err);
    }
    
    return loginLogs;
}

/**
 * Get login statistics from the server
 * @returns {Promise<Object>} Login statistics
 */
async function getLoginStats() {
    try {
        const res = await fetch(`${API_ENDPOINT}?action=getLoginStats`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.ok) {
            return data.stats;
        }
        return null;
    } catch (err) {
        console.warn('Could not fetch login stats', err);
        return null;
    }
}

/**
 * Get a single login log entry by ID
 * @param {string} id - The log entry ID
 * @returns {Promise<Object|null>} The log entry or null
 */
async function getLoginLogById(id) {
    try {
        const res = await fetch(`${API_ENDPOINT}?action=getLoginLog&id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.ok) {
            return data.log;
        }
        return null;
    } catch (err) {
        console.warn('Could not fetch login log', err);
        return null;
    }
}

/**
 * Clear old login logs (admin function)
 * @param {number} days - Delete logs older than this many days (default: 30)
 * @returns {Promise<Object>} Result with count of deleted logs
 */
async function clearLoginLogs(days = 30) {
    try {
        const res = await fetch(`${API_ENDPOINT}?action=clearLoginLogs&days=${days}`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.ok) {
            // Refresh local cache after clearing
            await getLoginLogs({ limit: 100 });
            return data;
        }
        return null;
    } catch (err) {
        console.warn('Could not clear login logs', err);
        return null;
    }
}

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
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
 * @param {string} start - Start time ISO string
 * @param {string} end - End time ISO string
 * @returns {number} Duration in seconds
 */
function calculateDuration(start, end) {
    try {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        return Math.floor((endTime - startTime) / 1000);
    } catch (e) {
        return 0;
    }
}

/**
 * Get login logs for a specific user
 * @param {string} userId - User ID
 * @returns {Array} Array of log entries for the user
 */

function getLogsByUser(userId) {
    return loginLogs.filter(log => log.userId === userId);
}

/**
 * Get failed login attempts
 * @returns {Array} Array of failed login logs
 */
function getFailedLogins() {
    return loginLogs.filter(log => log.status === 'failed');
}

/**
 * Get successful login attempts
 * @returns {Array} Array of successful login logs
 */

function getSuccessfulLogins() {
    return loginLogs.filter(log => log.status === 'success');
}

/**
 * Get login statistics from local data
 * @returns {Object} Local statistics
 */
function getLocalLoginStats() {
    const total = loginLogs.length;
    const failed = loginLogs.filter(l => l.status === 'failed').length;
    const success = total - failed;
    const uniqueUsers = new Set(loginLogs.map(l => l.userId).filter(id => id)).size;
    
    // Get last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24 = loginLogs.filter(l => new Date(l.loginTime) > oneDayAgo);
    
    // Get active sessions (no logout within last 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeSessions = loginLogs.filter(l => 
        l.status === 'success' && 
        !l.logoutTime && 
        new Date(l.loginTime) > thirtyMinAgo
    );
    
    return {
        total,
        failed,
        success,
        successRate: total > 0 ? Math.round((success / total) * 100 * 100) / 100 : 0,
        uniqueUsers,
        last24Hours: last24.length,
        activeSessions: activeSessions.length
    };
}

/**
 * Export login logs to CSV format
 * @param {Array} logs - Array of log entries (defaults to all loginLogs)
 * @returns {string} CSV formatted string
 */
function exportLoginLogsToCSV(logs = loginLogs) {
    const headers = ['Username', 'Login Time', 'Status', 'IP Address', 'Location', 'Device', 'Browser', 'OS', 'Duration'];
    
    const rows = logs.map(log => {
        const duration = log.logoutTime ? 
            formatDuration(calculateDuration(log.loginTime, log.logoutTime)) : 
            'Active';
        
        const location = log.country ? 
            `${log.country}${log.city ? ', ' + log.city : ''}` : 
            'Unknown';
        
        return [
            log.username || 'Unknown',
            new Date(log.loginTime).toLocaleString(),
            log.status,
            log.ipAddress || 'Unknown',
            location,
            log.deviceType || 'Unknown',
            log.browser || 'Unknown',
            log.os || 'Unknown',
            duration
        ];
    });
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    return csv;
}

/**
 * Download login logs as CSV file
 * @param {Array} logs - Array of log entries
 * @param {string} filename - Output filename
 */
function downloadLoginLogsCSV(logs = loginLogs, filename = null) {
    if (!filename) {
        const date = new Date().toISOString().split('T')[0];
        filename = `login_logs_${date}.csv`;
    }
    
    const csv = exportLoginLogsToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
