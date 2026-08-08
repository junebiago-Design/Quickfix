// ══════════════════════════════════════════════
//  login-monitoring-init.js — Integration Helper
//  Ensures login monitoring works with existing
//  navigation and data refresh systems.
// ══════════════════════════════════════════════

(function() {
    'use strict';

    // ── Check if login monitoring module is loaded ──
    if (typeof renderLoginMonitoring !== 'function') {
        console.warn('Login monitoring module not loaded. Make sure login-monitoring.js is included.');
        return;
    }

    // ── Hook into navigation system ──
    // The navigation system in navigation.js calls navigate(page)
    // We need to ensure login-monitoring renders when its page is shown
    if (typeof navigate === 'function') {
        const originalNavigate = window.navigate;
        window.navigate = function(page) {
            // Call original navigate first
            if (typeof originalNavigate === 'function') {
                originalNavigate(page);
            }
            
            // If navigating to login-monitoring, render it
            if (page === 'login-monitoring') {
                setTimeout(function() {
                    if (typeof renderLoginMonitoring === 'function') {
                        renderLoginMonitoring();
                    }
                }, 100);
            }
        };
        console.log('✅ Login monitoring hooked into navigation system');
    }

    // ── Hook into data refresh system ──
    // reloadAllData() is called periodically to sync with server
    if (typeof reloadAllData === 'function') {
        const originalReload = window.reloadAllData;
        window.reloadAllData = function() {
            return Promise.resolve(originalReload.apply(this, arguments))
                .then(function() {
                    // Check if login monitoring page is active
                    const lmPage = document.getElementById('page-login-monitoring');
                    if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
                        renderLoginMonitoring();
                    }
                    return Promise.resolve();
                })
                .catch(function(err) {
                    console.warn('Error in reloadAllData hook:', err);
                    return Promise.resolve();
                });
        };
        console.log('✅ Login monitoring hooked into data refresh system');
    }

    // ── Auto-initialize on DOM ready ──
    document.addEventListener('DOMContentLoaded', function() {
        // Check if login monitoring page exists and is active
        const lmPage = document.getElementById('page-login-monitoring');
        if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
            setTimeout(renderLoginMonitoring, 200);
        }
    });

    // ── Handle page visibility change (user returns to tab) ──
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            const lmPage = document.getElementById('page-login-monitoring');
            if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
                // Refresh data when user returns to the tab
                if (typeof refreshLoginData === 'function') {
                    refreshLoginData().then(function() {
                        if (typeof filterLoginLogs === 'function') {
                            filterLoginLogs();
                        }
                    });
                }
            }
        }
    });

    // ── Add helper to refresh login monitoring from console ──
    window.refreshLoginMonitoring = function() {
        if (typeof renderLoginMonitoring === 'function') {
            renderLoginMonitoring();
            console.log('🔄 Login monitoring refreshed');
        } else {
            console.error('Login monitoring module not loaded');
        }
    };

    console.log('✅ Login monitoring integration complete');
})();