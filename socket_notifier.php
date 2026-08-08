<?php
// ══════════════════════════════════════════════
//  SOCKET NOTIFIER — socket_notifier.php
//  Shared include used by api.php, auth.php, and anywhere else that
//  needs to push a real‑time event to the Node.js Socket.IO server.
//
//  UPDATED: Added originator tracking to prevent "echo" notifications
//  - Each event now includes the user ID of the person who triggered it
//  - Clients can filter out events they triggered themselves
//  - Better error logging and debugging support
//  - Async mode support for non-blocking broadcasts
//  - HOSTINGER DEPLOYMENT READY with Nginx proxy support
// ══════════════════════════════════════════════

// ── Configuration ─────────────────────────────────────────────────────

// Must match SOCKET_SHARED_SECRET in server.js
// 🔐 CHANGE THIS to a strong random string in production
if (!defined('SOCKET_SHARED_SECRET')) {
    define('SOCKET_SHARED_SECRET', 'asdqwe');
}

// PHP talks to Node directly on localhost (bypasses Nginx)
// This is faster and more reliable than going through the proxy
if (!defined('SOCKET_SERVER_URL')) {
    $override = getenv('SOCKET_SERVER_URL_OVERRIDE');
    if ($override) {
        define('SOCKET_SERVER_URL', $override);
    } else {
        // Use localhost for PHP to Node communication
        define('SOCKET_SERVER_URL', 'http://127.0.0.1:3000/update');
    }
}

// Timeout settings (in milliseconds) - Hostinger may have slower responses
if (!defined('SOCKET_TIMEOUT_MS')) {
    define('SOCKET_TIMEOUT_MS', 3000);
}

// Enable debug logging (set to false in production)
if (!defined('SOCKET_DEBUG')) {
    define('SOCKET_DEBUG', false);
}

// Maximum number of retry attempts
if (!defined('SOCKET_MAX_RETRIES')) {
    define('SOCKET_MAX_RETRIES', 2);
}

// ── Helper: Get current user ID from session ────────────────────────

/**
 * Get the current user's ID from the session
 * Attempts multiple methods to find the user ID
 * 
 * @return string|null The user ID or null if not found
 */
function socketGetCurrentUserId() {
    // Method 1: Check if currentUser is set in the global scope
    if (isset($GLOBALS['currentUser']) && is_array($GLOBALS['currentUser'])) {
        if (isset($GLOBALS['currentUser']['id'])) {
            return $GLOBALS['currentUser']['id'];
        }
        if (isset($GLOBALS['currentUser']['userId'])) {
            return $GLOBALS['currentUser']['userId'];
        }
    }
    
    // Method 2: Check if we have a session
    if (session_status() === PHP_SESSION_ACTIVE || session_status() === PHP_SESSION_NONE) {
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        if (isset($_SESSION['user_id'])) {
            return $_SESSION['user_id'];
        }
        if (isset($_SESSION['userId'])) {
            return $_SESSION['userId'];
        }
        if (isset($_SESSION['user']['id'])) {
            return $_SESSION['user']['id'];
        }
    }
    
    // Method 3: Check if we have a contact ID (employee ID)
    if (isset($GLOBALS['currentUser']['contactId'])) {
        return $GLOBALS['currentUser']['contactId'];
    }
    if (isset($_SESSION['contact_id'])) {
        return $_SESSION['contact_id'];
    }
    
    // Method 4: Check for user in POST/GET (for API calls)
    if (isset($_POST['userId'])) {
        return $_POST['userId'];
    }
    if (isset($_GET['userId'])) {
        return $_GET['userId'];
    }
    
    // Method 5: Check for user in JSON payload
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $data = json_decode($input, true);
        if ($data && isset($data['userId'])) {
            return $data['userId'];
        }
        if ($data && isset($data['user']['id'])) {
            return $data['user']['id'];
        }
    }
    
    // Method 6: Check for X-User-Id header (for API clients)
    if (isset($_SERVER['HTTP_X_USER_ID'])) {
        return $_SERVER['HTTP_X_USER_ID'];
    }
    
    // Method 7: Fallback to getenv
    if (getenv('USER_ID')) {
        return getenv('USER_ID');
    }
    
    return null;
}

/**
 * Get the current user's contact ID (employee ID)
 * 
 * @return string|null The contact ID or null if not found
 */
function socketGetCurrentContactId() {
    if (isset($GLOBALS['currentUser']['contactId'])) {
        return $GLOBALS['currentUser']['contactId'];
    }
    if (isset($GLOBALS['currentUser']['employeeId'])) {
        return $GLOBALS['currentUser']['employeeId'];
    }
    if (session_status() === PHP_SESSION_ACTIVE || session_status() === PHP_SESSION_NONE) {
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        if (isset($_SESSION['contact_id'])) {
            return $_SESSION['contact_id'];
        }
        if (isset($_SESSION['employee_id'])) {
            return $_SESSION['employee_id'];
        }
    }
    return null;
}

/**
 * Get the current user's username
 * 
 * @return string|null The username or null if not found
 */
function socketGetCurrentUsername() {
    if (isset($GLOBALS['currentUser']['username'])) {
        return $GLOBALS['currentUser']['username'];
    }
    if (isset($GLOBALS['currentUser']['name'])) {
        return $GLOBALS['currentUser']['name'];
    }
    if (session_status() === PHP_SESSION_ACTIVE || session_status() === PHP_SESSION_NONE) {
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        if (isset($_SESSION['username'])) {
            return $_SESSION['username'];
        }
    }
    return null;
}

/**
 * Get the current user's employee name
 * 
 * @return string|null The employee name or null if not found
 */
function socketGetCurrentEmployeeName() {
    $contactId = socketGetCurrentContactId();
    if ($contactId) {
        // Try to get from contacts array if available
        if (isset($GLOBALS['contacts']) && is_array($GLOBALS['contacts'])) {
            foreach ($GLOBALS['contacts'] as $contact) {
                if (isset($contact['id']) && $contact['id'] === $contactId) {
                    $fname = $contact['fname'] ?? '';
                    $lname = $contact['lname'] ?? '';
                    if ($fname || $lname) {
                        return trim($fname . ' ' . $lname);
                    }
                }
            }
        }
    }
    return socketGetCurrentUsername();
}

// ── Helper: Build originator data ────────────────────────────────────

/**
 * Build the originator data array for the payload
 * 
 * @return array Array with originator information
 */
function socketBuildOriginatorData() {
    $originator = [];
    
    $userId = socketGetCurrentUserId();
    if ($userId) {
        $originator['originatorId'] = $userId;
    }
    
    $contactId = socketGetCurrentContactId();
    if ($contactId) {
        $originator['originatorContactId'] = $contactId;
    }
    
    $username = socketGetCurrentUsername();
    if ($username) {
        $originator['originatorUsername'] = $username;
    }
    
    $employeeName = socketGetCurrentEmployeeName();
    if ($employeeName) {
        $originator['originatorEmployeeName'] = $employeeName;
    }
    
    // Add timestamp and IP
    $originator['originatorTimestamp'] = microtime(true);
    $originator['originatorIp'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    return $originator;
}

// ── Helper: Sanitize data for JSON ──────────────────────────────────

/**
 * Recursively sanitize data to ensure it's JSON-serializable
 * Converts resources, objects, etc. to strings or null
 * 
 * @param mixed $data The data to sanitize
 * @return mixed Sanitized data
 */
function socketSanitizeData($data) {
    if (is_resource($data)) {
        return null;
    }
    if (is_object($data)) {
        if (method_exists($data, 'toArray')) {
            $data = $data->toArray();
        } else {
            $data = (array) $data;
        }
    }
    if (is_array($data)) {
        foreach ($data as $key => $value) {
            $data[$key] = socketSanitizeData($value);
        }
    }
    if (is_string($data) && mb_detect_encoding($data, 'UTF-8', true) === false) {
        $data = mb_convert_encoding($data, 'UTF-8', 'auto');
    }
    return $data;
}

// ── Helper: Check if socket server is reachable ─────────────────────

/**
 * Check if the Socket.IO server is reachable
 * 
 * @param int $timeoutMs Timeout in milliseconds
 * @return bool True if reachable
 */
function socketServerReachable(int $timeoutMs = 1000): bool
{
    $ch = curl_init(SOCKET_SERVER_URL);
    if ($ch === false) {
        return false;
    }
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
        CURLOPT_TIMEOUT_MS => $timeoutMs,
        CURLOPT_NOBODY => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false, // Hostinger: disable SSL verification if needed
    ]);
    
    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return $httpCode === 200 || $httpCode === 405 || $httpCode === 404;
}

// ── Core: Notify the Socket.IO server ───────────────────────────────

/**
 * Notify the Socket.IO server of an event so it can broadcast to clients.
 * Fails silently (logs a warning) — a broadcast failure should never
 * block or break the actual write operation that triggered it.
 *
 * @param string $event     e.g. 'deal:updated', 'contact:created', 'login:success'
 * @param array  $data      payload to broadcast (must be JSON‑serializable)
 * @param mixed  $originatorUserId Optional. Force a specific originator ID.
 * @param int    $timeoutMs Optional. Override the connection timeout.
 * @param bool   $async     Optional. If true, fire and forget (non-blocking).
 * @return bool  true if the server acknowledged the broadcast
 */
function notifySocketServer(string $event, array $data = [], $originatorUserId = null, int $timeoutMs = null, bool $async = false)
{
    // Validate event name
    if (empty($event)) {
        if (defined('SOCKET_DEBUG') && SOCKET_DEBUG) {
            error_log("socket_notifier: event name cannot be empty");
        }
        return false;
    }
    
    // Sanitize and prepare data
    $sanitizedData = socketSanitizeData($data);
    
    // Build the full payload
    $payload = [
        'event' => $event,
        'data' => $sanitizedData,
    ];
    
    // Add originator information
    if ($originatorUserId !== null) {
        $payload['originatorId'] = $originatorUserId;
    } else {
        // Try to detect the current user
        $originator = socketBuildOriginatorData();
        if (!empty($originator)) {
            $payload = array_merge($payload, $originator);
        }
    }
    
    // Add server timestamp and request ID
    $payload['serverTimestamp'] = date('Y-m-d H:i:s');
    $payload['serverMicrotime'] = microtime(true);
    $payload['requestId'] = uniqid('sock_', true);
    
    // Encode payload
    $jsonPayload = json_encode($payload);
    if ($jsonPayload === false) {
        error_log("socket_notifier: failed to json_encode payload for event '{$event}': " . json_last_error_msg());
        return false;
    }
    
    // Debug logging
    if (defined('SOCKET_DEBUG') && SOCKET_DEBUG) {
        error_log("socket_notifier: sending event '{$event}' with payload: " . substr($jsonPayload, 0, 500) . '...');
    }
    
    // Check if we should use async mode (requires PHP 5.5+)
    if ($async && function_exists('curl_multi_init')) {
        return socketNotifyAsync($jsonPayload, $event);
    }
    
    // Synchronous mode with retries
    return socketNotifySync($jsonPayload, $event, $timeoutMs);
}

// ── Synchronous notification ─────────────────────────────────────────

/**
 * Send notification synchronously (blocking) with retry support
 * 
 * @param string $jsonPayload The JSON payload to send
 * @param string $event The event name (for logging)
 * @param int|null $timeoutMs Timeout in milliseconds
 * @param int $retries Number of retry attempts
 * @return bool True on success
 */
function socketNotifySync(string $jsonPayload, string $event, ?int $timeoutMs = null, int $retries = 0)
{
    $timeoutMs = $timeoutMs ?? SOCKET_TIMEOUT_MS;
    
    // If we've exceeded retries, give up
    if ($retries > SOCKET_MAX_RETRIES) {
        error_log("socket_notifier: max retries exceeded for event '{$event}'");
        return false;
    }
    
    $ch = curl_init(SOCKET_SERVER_URL);
    if ($ch === false) {
        error_log("socket_notifier: failed to initialize curl for event '{$event}'");
        return false;
    }
    
    // Set up curl options
    $options = [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $jsonPayload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonPayload),
            'X-Socket-Secret: ' . SOCKET_SHARED_SECRET,
            'X-Request-Id: ' . uniqid('sock_', true),
            'X-Source: php-notifier',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
        CURLOPT_TIMEOUT_MS     => $timeoutMs,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS      => 0,
        CURLOPT_SSL_VERIFYPEER => false, // Hostinger: disable SSL verification if needed
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT      => 'TMS-Socket-Notifier/1.0',
    ];
    
    curl_setopt_array($ch, $options);
    
    $response = curl_exec($ch);
    $errNo = curl_errno($ch);
    $errMsg = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
    curl_close($ch);
    
    // Check for curl errors
    if ($errNo !== 0) {
        error_log("socket_notifier: curl error for event '{$event}': ({$errNo}) {$errMsg}");
        // Retry if it's a timeout or connection error
        if ($errNo === CURLE_OPERATION_TIMEOUTED || $errNo === CURLE_COULDNT_CONNECT || $errNo === CURLE_COULDNT_RESOLVE_HOST) {
            if (defined('SOCKET_DEBUG') && SOCKET_DEBUG) {
                error_log("socket_notifier: retrying event '{$event}' (attempt " . ($retries + 1) . ")");
            }
            usleep(200000); // Wait 200ms before retry
            return socketNotifySync($jsonPayload, $event, $timeoutMs, $retries + 1);
        }
        return false;
    }
    
    // Check HTTP status code
    if ($httpCode !== 200) {
        error_log("socket_notifier: non-200 response ({$httpCode}) for event '{$event}': " . substr($response, 0, 200));
        return false;
    }
    
    // Optional: Validate response
    $responseData = json_decode($response, true);
    if ($responseData && isset($responseData['success']) && $responseData['success'] === false) {
        error_log("socket_notifier: server returned error for event '{$event}': " . ($responseData['error'] ?? 'unknown error'));
        return false;
    }
    
    // Debug logging
    if (defined('SOCKET_DEBUG') && SOCKET_DEBUG) {
        error_log("socket_notifier: event '{$event}' delivered in {$totalTime}s");
    }
    
    return true;
}

// ── Asynchronous notification (fire and forget) ─────────────────────

/**
 * Send notification asynchronously (non-blocking)
 * Uses curl_multi to fire and forget
 * 
 * @param string $jsonPayload The JSON payload to send
 * @param string $event The event name (for logging)
 * @return bool True on success (always returns true for async)
 */
function socketNotifyAsync(string $jsonPayload, string $event)
{
    // Create a new curl handle
    $ch = curl_init(SOCKET_SERVER_URL);
    if ($ch === false) {
        error_log("socket_notifier: failed to initialize curl for async request '{$event}'");
        return false;
    }
    
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $jsonPayload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonPayload),
            'X-Socket-Secret: ' . SOCKET_SHARED_SECRET,
            'X-Request-Id: ' . uniqid('sock_async_', true),
            'X-Source: php-notifier-async',
        ],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT_MS => 500,
        CURLOPT_TIMEOUT_MS     => 500,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS      => 0,
        CURLOPT_SSL_VERIFYPEER => false, // Hostinger: disable SSL verification if needed
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT      => 'TMS-Socket-Notifier/1.0',
    ]);
    
    // Use multi handle for non-blocking
    $mh = curl_multi_init();
    curl_multi_add_handle($mh, $ch);
    
    // Execute non-blocking
    $running = null;
    do {
        curl_multi_exec($mh, $running);
    } while ($running > 0);
    
    // Clean up immediately (we don't care about the response)
    curl_multi_remove_handle($mh, $ch);
    curl_close($ch);
    curl_multi_close($mh);
    
    // Async always returns true (we trust it will deliver)
    return true;
}

// ── Convenience functions for common events ─────────────────────────

/**
 * Notify about a deal/task event
 */
function notifyDealEvent($action, $dealId, $title, $stage = null, $extraData = [])
{
    $data = array_merge([
        'id' => $dealId,
        'title' => $title,
        'stage' => $stage,
        'action' => $action,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $extraData);
    return notifySocketServer("deal:{$action}", $data);
}

/**
 * Notify about a contact/employee event
 */
function notifyContactEvent($action, $contactId, $contactData = [])
{
    $data = array_merge([
        'id' => $contactId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $contactData);
    return notifySocketServer("contact:{$action}", $data);
}

/**
 * Notify about a note/comment/revision event
 */
function notifyNoteEvent($action, $noteId, $noteData = [])
{
    $data = array_merge([
        'id' => $noteId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $noteData);
    return notifySocketServer("note:{$action}", $data);
}

/**
 * Notify about a login event
 */
function notifyLoginEvent($status, $userId, $employeeId = null, $username = null, $extraData = [])
{
    // Get employee name if not provided
    $employeeName = null;
    if ($employeeId && isset($GLOBALS['contacts']) && is_array($GLOBALS['contacts'])) {
        foreach ($GLOBALS['contacts'] as $contact) {
            if (isset($contact['id']) && $contact['id'] === $employeeId) {
                $fname = $contact['fname'] ?? '';
                $lname = $contact['lname'] ?? '';
                if ($fname || $lname) {
                    $employeeName = trim($fname . ' ' . $lname);
                }
                break;
            }
        }
    }
    if (!$employeeName) {
        $employeeName = $username ?? 'Unknown User';
    }
    
    $data = array_merge([
        'status' => $status,
        'userId' => $userId,
        'employeeId' => $employeeId,
        'username' => $username,
        'employeeName' => $employeeName,
        'loginTime' => date('Y-m-d H:i:s'),
        'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    ], $extraData);
    return notifySocketServer("login:{$status}", $data);
}

/**
 * Notify about a logout event
 */
function notifyLogoutEvent($userId, $employeeId = null, $username = null, $extraData = [])
{
    // Get employee name if not provided
    $employeeName = null;
    if ($employeeId && isset($GLOBALS['contacts']) && is_array($GLOBALS['contacts'])) {
        foreach ($GLOBALS['contacts'] as $contact) {
            if (isset($contact['id']) && $contact['id'] === $employeeId) {
                $fname = $contact['fname'] ?? '';
                $lname = $contact['lname'] ?? '';
                if ($fname || $lname) {
                    $employeeName = trim($fname . ' ' . $lname);
                }
                break;
            }
        }
    }
    if (!$employeeName) {
        $employeeName = $username ?? 'Unknown User';
    }
    
    $data = array_merge([
        'userId' => $userId,
        'employeeId' => $employeeId,
        'username' => $username,
        'employeeName' => $employeeName,
        'logoutTime' => date('Y-m-d H:i:s'),
        'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    ], $extraData);
    return notifySocketServer('logout', $data);
}

/**
 * Notify about a department event
 */
function notifyDepartmentEvent($action, $departmentId, $departmentData = [])
{
    $data = array_merge([
        'id' => $departmentId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $departmentData);
    return notifySocketServer("department:{$action}", $data);
}

/**
 * Notify about a company event
 */
function notifyCompanyEvent($action, $companyId, $companyData = [])
{
    $data = array_merge([
        'id' => $companyId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $companyData);
    return notifySocketServer("company:{$action}", $data);
}

/**
 * Notify about a role event
 */
function notifyRoleEvent($action, $roleId, $roleData = [])
{
    $data = array_merge([
        'id' => $roleId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $roleData);
    return notifySocketServer("role:{$action}", $data);
}

/**
 * Notify about a user event
 */
function notifyUserEvent($action, $userId, $userData = [])
{
    $data = array_merge([
        'id' => $userId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $userData);
    return notifySocketServer("user:{$action}", $data);
}

/**
 * Notify about a file upload event
 */
function notifyFileEvent($action, $fileId, $fileData = [])
{
    $data = array_merge([
        'id' => $fileId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $fileData);
    return notifySocketServer("file:{$action}", $data);
}

/**
 * Notify about an announcement event
 */
function notifyAnnouncementEvent($action, $announcementId, $announcementData = [])
{
    $data = array_merge([
        'id' => $announcementId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $announcementData);
    return notifySocketServer("announcement:{$action}", $data);
}

/**
 * Notify about an activity event
 */
function notifyActivityEvent($activityId, $activityData = [])
{
    $data = array_merge([
        'id' => $activityId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $activityData);
    return notifySocketServer('activity:new', $data);
}

/**
 * Notify about a task activity event
 */
function notifyTaskActivityEvent($taskActivityId, $taskActivityData = [])
{
    $data = array_merge([
        'id' => $taskActivityId,
        'timestamp' => date('Y-m-d H:i:s'),
    ], $taskActivityData);
    return notifySocketServer('task-activity:new', $data);
}

// ──────────────────────────────────────────────────────────────────────
//  AUTO-INITIALIZE
//  If this file is included, these functions become available.
//  No action is taken on include, only on explicit function calls.
// ──────────────────────────────────────────────────────────────────────

// Check if the socket server is reachable on first load
// (only if SOCKET_DEBUG is enabled)
if (defined('SOCKET_DEBUG') && SOCKET_DEBUG && !defined('SOCKET_SERVER_CHECKED')) {
    define('SOCKET_SERVER_CHECKED', true);
    if (!socketServerReachable()) {
        error_log("socket_notifier: Socket.IO server is not reachable at " . SOCKET_SERVER_URL);
    }
}

// ── Export all functions to the global namespace ────────────────────
// (PHP includes are already global, but we ensure they're available)

// Ensure the main function is available
if (!function_exists('notifySocketServer')) {
    error_log("socket_notifier: WARNING - notifySocketServer function not defined");
}

// ── Debug: Log when this file is loaded ─────────────────────────────
if (defined('SOCKET_DEBUG') && SOCKET_DEBUG) {
    error_log("socket_notifier: loaded at " . date('Y-m-d H:i:s') . " (URL: " . SOCKET_SERVER_URL . ")");
}