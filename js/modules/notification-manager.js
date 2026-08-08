// ══════════════════════════════════════════════
//  NOTIFICATION MANAGER — js/core/notification-manager.js
//  Centralized, deduplicated toast/notification management
//  
//  Features:
//  - Debouncing: Prevents duplicate notifications within 3 seconds
//  - Priority levels: info, success, warning, error, login, logout
//  - Queue management: Prevents notification spam
//  - Console fallback: Works even if toast container doesn't exist
//  - Session tracking: Differentiates between users
// ══════════════════════════════════════════════

(function() {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────────
    const CONFIG = {
        DEBOUNCE_MS: 3000,           // Minimum time between identical notifications
        MAX_QUEUE_SIZE: 20,          // Maximum notifications in queue
        DISPLAY_DURATION: 4000,      // How long to show each toast (ms)
        FADE_DURATION: 300,          // Fade out animation duration (ms)
        MAX_STORED_KEYS: 100,        // Clean up old debounce keys
    };

    // ── State ──────────────────────────────────────────────────────────
    let recentNotifications = {};
    let notificationQueue = [];
    let isProcessingQueue = false;
    let currentUserId = null;

    // ── Helper: Get current user ID ──────────────────────────────────
    function getCurrentUserId() {
        if (currentUserId) return currentUserId;
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUserId = currentUser.id || currentUser.username || 'anonymous';
        }
        return currentUserId || 'anonymous';
    }

    // ── Helper: Create unique notification key ──────────────────────
    function getNotificationKey(message, type) {
        const userId = getCurrentUserId();
        const normalizedMessage = String(message || '').trim().toLowerCase();
        return `${userId}|${normalizedMessage}|${type || 'info'}`;
    }

    // ── Helper: Clean up old debounce entries ──────────────────────
    function cleanupDebounceKeys() {
        const keys = Object.keys(recentNotifications);
        if (keys.length > CONFIG.MAX_STORED_KEYS) {
            // Remove oldest entries (by timestamp)
            const sorted = keys.sort((a, b) => recentNotifications[a] - recentNotifications[b]);
            const toRemove = sorted.slice(0, keys.length - CONFIG.MAX_STORED_KEYS);
            toRemove.forEach(key => delete recentNotifications[key]);
        }
    }

    // ── Core: Should we show this notification? ─────────────────────
    function shouldShowNotification(message, type) {
        if (!message) return false;
        
        const key = getNotificationKey(message, type);
        const now = Date.now();
        const lastShown = recentNotifications[key];
        
        // Debounce check
        if (lastShown && (now - lastShown) < CONFIG.DEBOUNCE_MS) {
            console.debug(`[NotificationManager] Debounced: "${message}" (${type}) - ${Math.round((now - lastShown) / 1000)}s ago`);
            return false;
        }
        
        // Update timestamp
        recentNotifications[key] = now;
        cleanupDebounceKeys();
        return true;
    }

    // ── Core: Get toast container ────────────────────────────────────
    function getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            // Create container if it doesn't exist
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 420px;
                width: 100%;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    // ── Core: Create toast element ──────────────────────────────────
    function createToastElement(message, type = 'info') {
        const el = document.createElement('div');
        
        // Map type to CSS class and icon
        const typeMap = {
            'success': { class: 'toast-success', icon: '✓', color: 'var(--green, #28a745)' },
            'error': { class: 'toast-error', icon: '✕', color: 'var(--red, #dc3545)' },
            'warning': { class: 'toast-warning', icon: '⚠', color: 'var(--yellow, #ffc107)' },
            'login': { class: 'toast-login', icon: '🔓', color: 'var(--accent, #4f8ef7)' },
            'logout': { class: 'toast-logout', icon: '🔒', color: 'var(--text3, #6c757d)' },
            'info': { class: 'toast-info', icon: 'ℹ', color: 'var(--accent, #4f8ef7)' },
        };
        
        const mapping = typeMap[type] || typeMap.info;
        
        el.className = `toast ${mapping.class || ''}`;
        el.style.cssText = `
            background: var(--bg2, #1e1e2e);
            color: var(--text, #f0f0f0);
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 4px solid ${mapping.color};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.9rem;
            animation: toast-in 0.3s ease forwards;
            pointer-events: auto;
            cursor: default;
            backdrop-filter: blur(8px);
            background: rgba(30, 30, 46, 0.92);
        `;
        
        // Add icon
        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = `
            font-size: 1.1rem;
            flex-shrink: 0;
            width: 24px;
            text-align: center;
        `;
        iconSpan.textContent = mapping.icon;
        el.appendChild(iconSpan);
        
        // Add message
        const msgSpan = document.createElement('span');
        msgSpan.style.cssText = `
            flex: 1;
            word-break: break-word;
        `;
        msgSpan.innerHTML = message;
        el.appendChild(msgSpan);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--text3, #999);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 0 4px;
            opacity: 0.6;
            transition: opacity 0.2s;
            flex-shrink: 0;
        `;
        closeBtn.textContent = '×';
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.6';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            removeToastElement(el);
        };
        el.appendChild(closeBtn);
        
        // Auto-remove after duration
        el._timeoutId = setTimeout(() => {
            removeToastElement(el);
        }, CONFIG.DISPLAY_DURATION);
        
        return el;
    }

    // ── Core: Remove toast element with animation ──────────────────
    function removeToastElement(el) {
        if (!el || !el.parentNode) return;
        
        // Clear auto-remove timeout
        if (el._timeoutId) {
            clearTimeout(el._timeoutId);
            el._timeoutId = null;
        }
        
        // Fade out animation
        el.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => {
            if (el.parentNode) {
                el.remove();
            }
        }, CONFIG.FADE_DURATION);
    }

    // ── Core: Process notification queue ────────────────────────────
    function processQueue() {
        if (isProcessingQueue || notificationQueue.length === 0) return;
        
        isProcessingQueue = true;
        
        // Process up to 3 notifications at a time (to prevent flooding)
        const batchSize = Math.min(3, notificationQueue.length);
        const batch = notificationQueue.splice(0, batchSize);
        
        const container = getToastContainer();
        
        batch.forEach(({ message, type }) => {
            const el = createToastElement(message, type);
            container.appendChild(el);
        });
        
        isProcessingQueue = false;
        
        // Process next batch if queue still has items
        if (notificationQueue.length > 0) {
            setTimeout(processQueue, 500);
        }
    }

    // ── Public API: Show notification ───────────────────────────────
    function showNotification(message, type = 'info', immediate = false) {
        if (!message) {
            console.warn('[NotificationManager] showNotification called with empty message');
            return;
        }
        
        // Sanitize: remove HTML tags for the debounce key but keep for display
        const plainMessage = String(message).replace(/<[^>]*>/g, '').trim();
        if (!plainMessage) {
            console.warn('[NotificationManager] showNotification called with only HTML tags');
            return;
        }
        
        // Debounce check
        if (!shouldShowNotification(plainMessage, type)) {
            return;
        }
        
        // Add to queue
        notificationQueue.push({ message, type });
        
        // Trim queue if too large
        if (notificationQueue.length > CONFIG.MAX_QUEUE_SIZE) {
            notificationQueue = notificationQueue.slice(-CONFIG.MAX_QUEUE_SIZE);
        }
        
        // Process immediately if requested, otherwise queue
        if (immediate) {
            processQueue();
        } else {
            // Small delay to batch multiple notifications
            if (!isProcessingQueue) {
                setTimeout(processQueue, 100);
            }
        }
    }

    // ── Public API: Clear all notifications ─────────────────────────
    function clearAllNotifications() {
        const container = getToastContainer();
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => removeToastElement(toast));
        notificationQueue = [];
        isProcessingQueue = false;
    }

    // ── Public API: Force show (bypass debounce) ────────────────────
    function forceShowNotification(message, type = 'info') {
        if (!message) return;
        
        // Force add to queue without debounce check
        const key = getNotificationKey(message, type);
        recentNotifications[key] = Date.now();
        cleanupDebounceKeys();
        
        notificationQueue.push({ message, type });
        if (!isProcessingQueue) {
            setTimeout(processQueue, 50);
        }
    }

    // ── Public API: Show temporary notification ─────────────────────
    function showTempNotification(message, type = 'info', duration = 2000) {
        const container = getToastContainer();
        const el = createToastElement(message, type);
        
        // Override duration
        if (el._timeoutId) {
            clearTimeout(el._timeoutId);
        }
        el._timeoutId = setTimeout(() => {
            removeToastElement(el);
        }, duration);
        
        container.appendChild(el);
    }

    // ── Public API: Get status ──────────────────────────────────────
    function getNotificationStats() {
        return {
            queueSize: notificationQueue.length,
            debounceKeys: Object.keys(recentNotifications).length,
            isProcessing: isProcessingQueue,
            currentUserId: getCurrentUserId(),
        };
    }

    // ── Public API: Reset state ─────────────────────────────────────
    function resetNotificationManager() {
        recentNotifications = {};
        notificationQueue = [];
        isProcessingQueue = false;
        currentUserId = null;
        clearAllNotifications();
    }

    // ── Inject CSS animations ──────────────────────────────────────
    function injectStyles() {
        const styleId = 'notification-manager-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes toast-in {
                from {
                    opacity: 0;
                    transform: translateX(40px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }
            
            @keyframes toast-out {
                from {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateX(40px) scale(0.95);
                }
            }
            
            .toast {
                animation: toast-in 0.3s ease forwards;
            }
            
            .toast.toast-success { border-left-color: var(--green, #28a745) !important; }
            .toast.toast-error { border-left-color: var(--red, #dc3545) !important; }
            .toast.toast-warning { border-left-color: var(--yellow, #ffc107) !important; }
            .toast.toast-login { border-left-color: var(--accent, #4f8ef7) !important; }
            .toast.toast-logout { border-left-color: var(--text3, #6c757d) !important; }
            .toast.toast-info { border-left-color: var(--accent, #4f8ef7) !important; }
            
            @media (max-width: 480px) {
                #toast-container {
                    max-width: 90%;
                    right: 5%;
                    bottom: 10px;
                }
                .toast {
                    font-size: 0.85rem !important;
                    padding: 10px 12px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Legacy compatibility: Override global toast() ──────────────
    function overrideGlobalToast() {
        if (typeof window.toast === 'function') {
            // Store original for emergency
            window._originalToast = window.toast;
        }
        
        // Replace with our version
        window.toast = function(message, type = 'info') {
            // Map legacy type names
            const typeMap = {
                'success': 'success',
                'error': 'error',
                'warning': 'warning',
                'danger': 'error',
                'info': 'info',
                'login': 'login',
                'logout': 'logout',
                'accent': 'info',
                'green': 'success',
                'red': 'error',
                'yellow': 'warning',
                'orange': 'warning',
                'purple': 'info',
            };
            const mappedType = typeMap[type] || 'info';
            showNotification(message, mappedType);
        };
        
        console.log('[NotificationManager] Overrode global toast() function');
    }

    // ── Initialize ──────────────────────────────────────────────────
    function initNotificationManager() {
        injectStyles();
        overrideGlobalToast();
        
        // Log initialization
        console.log(`✅ Notification Manager initialized (debounce: ${CONFIG.DEBOUNCE_MS}ms, queue: ${CONFIG.MAX_QUEUE_SIZE})`);
    }

    // ── Expose Public API ──────────────────────────────────────────
    window.NotificationManager = {
        show: showNotification,
        forceShow: forceShowNotification,
        showTemp: showTempNotification,
        clear: clearAllNotifications,
        reset: resetNotificationManager,
        getStats: getNotificationStats,
        config: CONFIG,
    };

    // Also expose individual functions for convenience
    window.showNotification = showNotification;
    window.forceShowNotification = forceShowNotification;
    window.clearAllNotifications = clearAllNotifications;

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotificationManager);
    } else {
        initNotificationManager();
    }

})();