// ══════════════════════════════════════════════
//  SOCKET HANDLER — js/modules/socket-handler.js
//  (with debug logs for activity:new and reload button)
// ══════════════════════════════════════════════

(function() {
    'use strict';

    // ── Global counter for pending updates ──
    window.pendingUpdates = 0;

    function updateReloadBadge() {
        const btn = document.getElementById('reload-btn');
        const badge = document.getElementById('reload-badge');
        console.log('[DEBUG] updateReloadBadge called, pendingUpdates:', window.pendingUpdates, 'btn:', btn, 'badge:', badge);

        if (!btn || !badge) {
            console.warn('[DEBUG] Reload button or badge not found in DOM');
            return;
        }

        if (window.pendingUpdates > 0) {
            btn.style.display = 'inline-flex';
            badge.textContent = window.pendingUpdates;
            badge.style.display = 'inline-block';
            console.log('[DEBUG] Button shown with count:', window.pendingUpdates);
        } else {
            btn.style.display = 'none';
            badge.style.display = 'none';
            console.log('[DEBUG] Button hidden');
        }
    }

    window.resetPendingUpdates = function() {
        window.pendingUpdates = 0;
        updateReloadBadge();
    };

    // ── Configuration ──────────────────────────────────────────────────
    const SOCKET_PATH = '/apps/socket.io/';
    const SOCKET_URL = window.__socketUrl || 'https://tms.ghcoor.com';
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.startsWith('10.') ||
                        window.location.hostname.endsWith('.local');

    const SOCKET_OPTIONS = {
        path: SOCKET_PATH,
        transports: isLocalhost ? ['websocket'] : ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: isLocalhost ? 10000 : 20000,
        autoConnect: true,
        forceNew: false
    };

    function getCurrentUserId() {
        if (typeof currentUser !== 'undefined' && currentUser) {
            return currentUser.id || currentUser.username || null;
        }
        if (window.__tmsUser) {
            return window.__tmsUser.id || window.__tmsUser.username || null;
        }
        return null;
    }

    function getCurrentUserContactId() {
        if (typeof currentUser !== 'undefined' && currentUser) {
            return currentUser.contactId || currentUser.employeeId || null;
        }
        if (window.__tmsUser) {
            return window.__tmsUser.contactId || window.__tmsUser.employeeId || null;
        }
        return null;
    }

    const CURRENT_USER_ID = getCurrentUserId();
    const CURRENT_CONTACT_ID = getCurrentUserContactId();

    if (typeof io === 'undefined') {
        console.warn('socket-handler: socket.io client library not loaded — real-time updates disabled');
        const script = document.createElement('script');
        script.src = `${SOCKET_URL}${SOCKET_PATH}socket.io.js`;
        script.onload = function() {
            console.log('socket-handler: Socket.IO client loaded dynamically, reinitializing...');
            setTimeout(initSocket, 100);
        };
        script.onerror = function() {
            console.warn('socket-handler: Failed to load Socket.IO client dynamically');
        };
        document.head.appendChild(script);
        return;
    }

    function initSocket() {
        if (typeof io === 'undefined') {
            console.warn('socket-handler: socket.io still not available');
            return;
        }

        console.log(`socket-handler: Connecting to ${SOCKET_URL} with path ${SOCKET_PATH}`);
        console.log(`socket-handler: Localhost mode: ${isLocalhost ? 'YES (WebSocket only)' : 'NO (polling + WebSocket)'}`);
        console.log(`socket-handler: Transport: ${SOCKET_OPTIONS.transports.join(', ')}`);

        const socket = io(SOCKET_URL, SOCKET_OPTIONS);
        window.__tmsSocket = socket;

        function wasTriggeredByCurrentUser(data) {
            if (!data) return false;
            if (data.originatorId) return data.originatorId === CURRENT_USER_ID;
            if (data.originatorContactId) return data.originatorContactId === CURRENT_CONTACT_ID;
            if (data.userId) return data.userId === CURRENT_USER_ID;
            if (data.contactId) return data.contactId === CURRENT_CONTACT_ID;
            if (data.actorId) return data.actorId === CURRENT_USER_ID || data.actorId === CURRENT_CONTACT_ID;
            return false;
        }

        function call(fnName, ...args) {
            if (typeof window[fnName] === 'function') {
                try {
                    window[fnName](...args);
                } catch (err) {
                    console.error(`socket-handler: error calling ${fnName}`, err);
                }
            } else {
                console.debug(`socket-handler: function ${fnName} not found`);
            }
        }

        function updateUI(fnName, ...args) {
            call(fnName, ...args);
        }

        function showNotification(message, type = 'info') {
            if (typeof NotificationManager !== 'undefined' && NotificationManager.show) {
                NotificationManager.show(message, type);
            } else if (typeof showNotification === 'function') {
                showNotification(message, type);
            } else if (typeof toast === 'function') {
                toast(message, type);
            } else {
                console.log(`[${type}] ${message}`);
            }
        }

        function capitalize(s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
        }

        // ── Socket lifecycle ──
        socket.on('connect', () => {
            console.log('✅ socket-handler: connected', socket.id);
            socket.emit('authenticate', {
                userId: CURRENT_USER_ID,
                contactId: CURRENT_CONTACT_ID,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('welcome', (data) => {
            console.log('📨 Welcome from server:', data);
        });

        socket.on('authenticated', (data) => {
            console.log('🔐 Authenticated successfully:', data);
        });

        socket.on('connect_error', (err) => {
            console.warn('socket-handler: connect_error', err.message);
            if (isLocalhost && err.message.includes('WebSocket')) {
                console.log('socket-handler: WebSocket failed on localhost, trying polling fallback...');
                socket.io.opts.transports = ['polling', 'websocket'];
                setTimeout(() => socket.connect(), 1000);
                return;
            }
            if (err.message.includes('polling')) {
                console.log('socket-handler: Retrying with websocket only...');
                socket.io.opts.transports = ['websocket'];
                socket.connect();
            }
        });

        socket.on('disconnect', (reason) => {
            if (reason === 'io server disconnect') {
                console.warn('socket-handler: server disconnected, reconnecting...');
                socket.connect();
            } else {
                console.warn('socket-handler: disconnected', reason);
            }
        });

        // ── ACTIVITY: NEW ── (with debug logs)
        socket.on('activity:new', (data) => {
            console.log('🔔 [DEBUG] activity:new event received:', data);

            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own activity:new event');
                return;
            }

            // Update the activity feed
            updateUI('prependActivity', data);

            // Increment and show the reload button
            window.pendingUpdates++;
            console.log('[DEBUG] pendingUpdates incremented to:', window.pendingUpdates);
            updateReloadBadge();

            // Optional: reload Kanban if needed (skip for some categories)
            const ENTITY_COVERED_CATEGORIES = new Set([
                'task', 'task-move', 'comment', 'revision', 'done', 'file', 'role'
            ]);
            if (!ENTITY_COVERED_CATEGORIES.has(data.category)) {
                if (typeof window.currentPage !== 'undefined' && window.currentPage === 'kanban') {
                    if (typeof window.RealtimeSync !== 'undefined' && window.RealtimeSync.reloadData) {
                        window.RealtimeSync.reloadData();
                    }
                }
            }
        });

        // ── Other event handlers (deal:*, note:*, etc.) are unchanged ──
        // (omitted for brevity, but you should keep the full list from your original file)

        // ── Expose debug helpers ──
        window.__tmsSocketDebug = {
            currentUserId: CURRENT_USER_ID,
            currentContactId: CURRENT_CONTACT_ID,
            wasTriggeredByCurrentUser: wasTriggeredByCurrentUser,
            socketId: socket.id,
            connected: socket.connected,
            url: SOCKET_URL,
            path: SOCKET_PATH,
            isLocalhost: isLocalhost,
            transports: SOCKET_OPTIONS.transports
        };

        console.log(`✅ socket-handler: initialized (userId: ${CURRENT_USER_ID || 'none'}, contactId: ${CURRENT_CONTACT_ID || 'none'})`);
        console.log(`✅ socket-handler: connecting to ${SOCKET_URL}${SOCKET_PATH}`);
        console.log(`✅ socket-handler: Localhost mode: ${isLocalhost ? 'ENABLED (WebSocket-only)' : 'DISABLED (standard)'}`);

        window.addEventListener('beforeunload', function() {
            if (socket && socket.connected) socket.disconnect();
        });

        return socket;
    }

    if (typeof io !== 'undefined') {
        initSocket();
    }

    window.addEventListener('pagehide', function () {
        const activeSocket = window.__tmsSocket;
        if (activeSocket && activeSocket.connected) {
            console.log('socket-handler: page hidden, disconnecting socket');
            activeSocket.disconnect();
        }
    });

    window.addEventListener('pageshow', function (event) {
        const activeSocket = window.__tmsSocket;
        if (event.persisted && activeSocket && !activeSocket.connected) {
            console.log('socket-handler: restored from back-forward cache, reconnecting');
            activeSocket.connect();
        }
    });

})();