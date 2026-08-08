<?php
// ══════════════════════════════════════════════
//  SOCKET NOTIFIER — socket_notifier.php
//  Shared include used by api.php, auth.php, and anywhere else that
//  needs to push a real‑time event to the Node.js Socket.IO server.
//
//  Usage:
//      require_once __DIR__ . '/socket_notifier.php';
//      notifySocketServer('deal:updated', ['id' => $dealId, 'title' => $title]);
//
//  IMPORTANT: The secret below MUST match the SOCKET_SHARED_SECRET
//  defined in /var/www/crm/apps/socket/server.js (or its environment).
// ══════════════════════════════════════════════

// Must match SOCKET_SHARED_SECRET in server.js
// Change this to a strong random string in production.
if (!defined('SOCKET_SHARED_SECRET')) {
    define('SOCKET_SHARED_SECRET', 'asdqwe');
}

// Node server binds to 127.0.0.1 only; PHP talks to it locally.
if (!defined('SOCKET_SERVER_URL')) {
    define('SOCKET_SERVER_URL', 'http://127.0.0.1:3000/update');
}

/**
 * Notify the Socket.IO server of an event so it can broadcast to clients.
 * Fails silently (logs a warning) — a broadcast failure should never
 * block or break the actual write operation that triggered it.
 *
 * @param string $event     e.g. 'deal:updated', 'contact:created', 'login:success'
 * @param array  $data      payload to broadcast (must be JSON‑serializable)
 * @param int    $timeoutMs connect/response timeout in milliseconds
 * @return bool  true if the server acknowledged the broadcast
 */
function notifySocketServer(string $event, array $data, int $timeoutMs = 1500): bool
{
    $payload = json_encode(['event' => $event, 'data' => $data]);
    if ($payload === false) {
        error_log("socket_notifier: failed to json_encode payload for event '{$event}'");
        return false;
    }

    $ch = curl_init(SOCKET_SERVER_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload),
            'X-Socket-Secret: ' . SOCKET_SHARED_SECRET,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
        CURLOPT_TIMEOUT_MS     => $timeoutMs,
    ]);

    $response = curl_exec($ch);
    $errNo = curl_errno($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errNo !== 0) {
        error_log("socket_notifier: curl error for event '{$event}': " . curl_error($ch));
        return false;
    }

    if ($httpCode !== 200) {
        error_log("socket_notifier: non-200 response ({$httpCode}) for event '{$event}': {$response}");
        return false;
    }

    return true;
}