// ══════════════════════════════════════════════
//  SOCKET HANDLER — js/modules/socket-handler.js
//  Connects to the Socket.IO server and routes incoming events to
//  the granular UI update functions exposed by other modules.
//  Loaded after socket.io.js and after the modules it references.
//
//  FIXED: Added originator filtering to prevent "echo" notifications
//  - Events triggered by the current user are ignored
//  - Uses NotificationManager for centralized notifications
//  - Silent UI updates for remote events
//  - HOSTINGER DEPLOYMENT READY
//  - LOCALHOST FIX: Force WebSocket transport to bypass Cloudflare Access
//  - ADDED: Pending updates badge with show/hide for reload button
// ══════════════════════════════════════════════

(function() {
    'use strict';

    // ── Global counter for pending updates (activity:new) ──
    window.pendingUpdates = 0;

    function updateReloadBadge() {
        const btn = document.getElementById('reload-btn');
        const badge = document.getElementById('reload-badge');
        if (!btn || !badge) return;

        if (window.pendingUpdates > 0) {
            btn.style.display = 'inline-flex';
            badge.textContent = window.pendingUpdates;
            badge.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
            badge.style.display = 'none';
        }
    }

    // Make reset function globally accessible
    window.resetPendingUpdates = function() {
        window.pendingUpdates = 0;
        updateReloadBadge();
    };

    // ── Configuration ──────────────────────────────────────────────────
    const SOCKET_PATH = '/apps/socket.io/';
    const SOCKET_URL = window.__socketUrl || 'https://tms.ghcoor.com';

    // ── LOCALHOST FIX ────────────────────────────────────────────────
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.startsWith('10.') ||
                        window.location.hostname.endsWith('.local');

    // ── Socket.IO Connection Options ──────────────────────────────────
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

    // ── Get current user ID for filtering ────────────────────────────
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

    // ── Check if Socket.IO is available ──────────────────────────────
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

    // ── Initialize Socket ─────────────────────────────────────────────
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

        // ── Helper: Was this event triggered by the current user? ────────
        function wasTriggeredByCurrentUser(data) {
            if (!data) return false;
            if (data.originatorId) return data.originatorId === CURRENT_USER_ID;
            if (data.originatorContactId) return data.originatorContactId === CURRENT_CONTACT_ID;
            if (data.userId) return data.userId === CURRENT_USER_ID;
            if (data.contactId) return data.contactId === CURRENT_CONTACT_ID;
            if (data.actorId) return data.actorId === CURRENT_USER_ID || data.actorId === CURRENT_CONTACT_ID;
            return false;
        }

        // ── Helper: Safe call to global functions ────────────────────────
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

        // ──────────────────────────────────────────────────────────────────
        //  SOCKET LIFECYCLE EVENTS
        // ──────────────────────────────────────────────────────────────────

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

        socket.on('reconnect_attempt', (attempt) => {
            console.debug(`socket-handler: reconnect attempt ${attempt}`);
        });

        socket.on('reconnect_failed', () => {
            console.warn('socket-handler: reconnect failed — real-time updates disabled');
        });

        socket.on('disconnect', (reason) => {
            if (reason === 'io server disconnect') {
                console.warn('socket-handler: server disconnected, reconnecting...');
                socket.connect();
            } else {
                console.warn('socket-handler: disconnected', reason);
            }
        });

        socket.on('error', (err) => {
            console.error('socket-handler: socket error', err);
        });

        // ──────────────────────────────────────────────────────────────────
        //  DEALS / KANBAN EVENTS
        // ──────────────────────────────────────────────────────────────────

        socket.on('deal:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own deal:created event');
                return;
            }
            updateUI('appendDealCard', data, data.stage);
            updateUI('updateBadges');
            showNotification(`New task: ${data.title || 'a task'}`, 'info');
        });

        socket.on('deal:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI('updateDealCard', data.id, data);
            updateUI('updateBadges');
        });

        socket.on('deal:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own deal:deleted event');
                return;
            }
            updateUI('removeDealCard', data.id);
            updateUI('updateBadges');
            showNotification(`Task deleted: ${data.title || 'a task'}`, 'warning');
        });

        socket.on('deal:stage-changed', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own deal:stage-changed event');
                return;
            }
            updateUI('updateStageColumn', data.fromStage);
            updateUI('updateStageColumn', data.toStage);
            updateUI('updateBadges');
            const fromLabel = data.fromStageLabel || data.fromStage;
            const toLabel = data.toStageLabel || data.toStage;
            showNotification(`Task "${data.title || 'a task'}" moved: ${fromLabel} → ${toLabel}`, 'info');
        });

        // ──────────────────────────────────────────────────────────────────
        //  ACTIVITY FEED EVENTS
        // ──────────────────────────────────────────────────────────────────

        socket.on('activity:new', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own activity:new event');
                return;
            }
            updateUI('prependActivity', data);

            // ── Increment pending updates and show badge/button ──
            window.pendingUpdates++;
            updateReloadBadge();

            // ── Minimal Kanban realtime refresh ──
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

        // ──────────────────────────────────────────────────────────────────
        //  NOTES / COMMENTS / REVISIONS
        // ──────────────────────────────────────────────────────────────────

        socket.on('note:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own note:created event');
                return;
            }
            updateUI('addNote', data);
            updateUI('updateBadges');
            const noteTitle = data.title || 'a note';
            const noteType = data.type === 'revision' ? 'Revision' : 'Comment';
            showNotification(`${noteType} added: ${noteTitle}`, data.type === 'revision' ? 'warning' : 'info');
        });

        socket.on('note:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI('updateNote', data.id, data);
            updateUI('updateBadges');
        });

        socket.on('note:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own note:deleted event');
                return;
            }
            updateUI('removeNote', data.id);
            updateUI('updateBadges');
            showNotification(`Note deleted: ${data.title || 'a note'}`, 'warning');
        });

        // ──────────────────────────────────────────────────────────────────
        //  ANNOUNCEMENTS
        // ──────────────────────────────────────────────────────────────────

        socket.on('announcement:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own announcement:created event');
                return;
            }
            updateUI('addAnnouncement', data);
            updateUI('updateBadges');
            showNotification(`New announcement: ${data.title || 'an announcement'}`, 'success');
        });

        socket.on('announcement:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI('updateAnnouncement', data.id, data);
            updateUI('updateBadges');
        });

        socket.on('announcement:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own announcement:deleted event');
                return;
            }
            updateUI('removeAnnouncement', data.id);
            updateUI('updateBadges');
        });

        // ──────────────────────────────────────────────────────────────────
        //  CONTACTS / EMPLOYEES
        // ──────────────────────────────────────────────────────────────────

        socket.on('contact:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own contact:created event');
                return;
            }
            updateUI('addContact', data);
            updateUI('updateBadges');
            const name = data.fname && data.lname ? `${data.fname} ${data.lname}` : 'an employee';
            showNotification(`New employee: ${name}`, 'success');
        });

        socket.on('contact:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI('updateContact', data.id, data);
            updateUI('updateBadges');
        });

        socket.on('contact:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own contact:deleted event');
                return;
            }
            updateUI('removeContact', data.id);
            updateUI('updateBadges');
            const name = data.fname && data.lname ? `${data.fname} ${data.lname}` : 'an employee';
            showNotification(`Employee deleted: ${name}`, 'warning');
        });

        // ──────────────────────────────────────────────────────────────────
        //  DEPARTMENTS, COMPANIES, USERS, ROLES
        // ──────────────────────────────────────────────────────────────────

        socket.on('department:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own department:created event');
                return;
            }
            updateUI(`add${capitalize('department')}Record`, data);
            updateUI('updateBadges');
            showNotification(`New department: ${data.name || 'a department'}`, 'success');
        });
        socket.on('department:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI(`update${capitalize('department')}Record`, data.id, data);
            updateUI('updateBadges');
        });
        socket.on('department:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own department:deleted event');
                return;
            }
            updateUI(`delete${capitalize('department')}Record`, data.id);
            updateUI('updateBadges');
        });

        socket.on('company:created', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own company:created event');
                return;
            }
            updateUI(`add${capitalize('company')}Record`, data);
            updateUI('updateBadges');
            showNotification(`New company: ${data.name || 'a company'}`, 'success');
        });
        socket.on('company:updated', (data) => {
            if (wasTriggeredByCurrentUser(data)) return;
            updateUI(`update${capitalize('company')}Record`, data.id, data);
            updateUI('updateBadges');
        });
        socket.on('company:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own company:deleted event');
                return;
            }
            updateUI(`delete${capitalize('company')}Record`, data.id);
            updateUI('updateBadges');
        });

        // ──────────────────────────────────────────────────────────────────
        //  LOGIN MONITORING / EMPLOYEE DIRECTORY
        // ──────────────────────────────────────────────────────────────────

        socket.on('login:success', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own login:success event');
                return;
            }
            if (typeof NotificationManager !== 'undefined') {
                const name = data.employeeName || data.username || 'Someone';
                NotificationManager.show(`${name} logged in`, 'login');
            }
            updateUI('appendLoginLog', data, 'login');
            updateUI('updateEmployeeStatus', data.employeeId, 'online');
        });

        socket.on('login:failed', (data) => {
            if (typeof NotificationManager !== 'undefined') {
                const name = data.employeeName || data.username || 'Someone';
                const reason = data.failureReason ? ` (${data.failureReason})` : '';
                NotificationManager.show(`Failed login attempt: ${name}${reason}`, 'error');
            }
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own login:failed UI update');
                return;
            }
            updateUI('appendLoginLog', data, 'login');
        });

        socket.on('logout', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own logout event');
                return;
            }
            if (typeof NotificationManager !== 'undefined') {
                const name = data.employeeName || data.username || 'Someone';
                NotificationManager.show(`${name} logged out`, 'logout');
            }
            updateUI('appendLoginLog', data, 'logout');
            updateUI('updateEmployeeStatus', data.employeeId, 'offline');
        });

        // ──────────────────────────────────────────────────────────────────
        //  FILES / ATTACHMENTS
        // ──────────────────────────────────────────────────────────────────

        socket.on('file:uploaded', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own file:uploaded event');
                return;
            }
            updateUI('addFile', data);
            updateUI('updateBadges');
            showNotification(`File uploaded: ${data.title || data.originalFilename || 'a file'}`, 'success');
        });

        socket.on('file:deleted', (data) => {
            if (wasTriggeredByCurrentUser(data)) {
                console.debug('socket-handler: skipping own file:deleted event');
                return;
            }
            updateUI('removeFile', data.id);
            updateUI('updateBadges');
            showNotification(`File deleted: ${data.title || 'a file'}`, 'warning');
        });

        // ──────────────────────────────────────────────────────────────────
        //  GENERIC ENTITY UPDATE HANDLER
        // ──────────────────────────────────────────────────────────────────

        const HANDLED_EVENTS = new Set([
            'welcome', 'authenticated',
            'deal:created', 'deal:updated', 'deal:deleted', 'deal:stage-changed',
            'activity:new', 'task-activity:new',
            'note:created', 'note:updated', 'note:deleted',
            'announcement:created', 'announcement:updated', 'announcement:deleted',
            'contact:created', 'contact:updated', 'contact:deleted',
            'department:created', 'department:updated', 'department:deleted',
            'company:created', 'company:updated', 'company:deleted',
            'role:created', 'role:updated', 'role:deleted',
            'user:created', 'user:updated', 'user:deleted'
        ]);

        socket.onAny((eventName, ...args) => {
            if (HANDLED_EVENTS.has(eventName)) return;
            console.debug('socket-handler: unhandled event', eventName, args);
        });

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