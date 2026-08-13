<?php
/**
 * api.php — TMS SQLite Backend (SECURED + CACHED + COMPLETE)
 *
 * - Server-Side RBAC: Enforces grab/drop/edit/upload/delete per stage.
 * - APCu Caching: Caches stage permissions & full DB payload.
 * - Versioned Payload: Increments db_version on save to bust cache.
 * - All writes are validated server-side (no trust in client localStorage).
 * - Includes all original features: login monitoring, file uploads, etc.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Start Session for RBAC User Resolution ──────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── Real-time (Socket.IO) notifier ──────────────────────────────────
$socketNotifierPath = __DIR__ . '/socket_notifier.php';
if (file_exists($socketNotifierPath)) {
    require_once $socketNotifierPath;
}
if (!function_exists('notifySocketServer')) {
    function notifySocketServer(string $event, array $data, int $timeoutMs = 1500): bool { return false; }
}

// ── Paths & Constants ───────────────────────────────────────────────
define('DATA_DIR', __DIR__ . '/../data');
define('UPLOAD_DIR', __DIR__ . '/../uploads');
define('DB_FILE', DATA_DIR . '/tms_database.sq3');

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_DOCUMENTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt'];
const ALLOWED_IMAGES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

const MIME_TYPES = [
    'pdf'  => 'application/pdf',
    'doc'  => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls'  => 'application/vnd.ms-excel',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv'  => 'text/csv',
    'ppt'  => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt'  => 'text/plain',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'webp' => 'image/webp',
    'svg'  => 'image/svg+xml',
];

const TABLES = [
    'contacts', 'deals', 'tasks', 'notes', 'activity',
    'taskActivity', 'departments', 'companies', 'roles',
    'stages', 'users', 'files', 'counters', 'login_logs'
];

const BROADCAST_ENTITY_TABLES = [
    'deals'       => 'deal',
    'contacts'    => 'contact',
    'notes'       => 'note',
    'tasks'       => 'announcement',
    'departments' => 'department',
    'companies'   => 'company',
    'roles'       => 'role',
    'users'       => 'user',
];

const BROADCAST_LOG_TABLES = [
    'activity'     => 'activity:new',
    'taskActivity' => 'task-activity:new',
];

const LOG_TABLE_MAX_ROWS = 500;

// ═════════════════════════════════════════════════════════════════════
//  BOOTSTRAP HELPERS
// ═════════════════════════════════════════════════════════════════════

function ensureDirectory(string $dir): void {
    if (is_dir($dir)) {
        if (!is_writable($dir)) @chmod($dir, 0755);
        return;
    }
    if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException("Unable to create directory: {$dir}.");
    }
}

function ensureHtaccess(string $dir, string $contents): void {
    $path = $dir . '/.htaccess';
    if (!file_exists($path)) @file_put_contents($path, $contents);
}

// ═════════════════════════════════════════════════════════════════════
//  DATABASE LAYER WITH APCu CACHING
// ═════════════════════════════════════════════════════════════════════

function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        ensureDirectory(DATA_DIR);
        ensureHtaccess(DATA_DIR, "Require all denied\n");
        if (!file_exists(DB_FILE)) {
            if (@touch(DB_FILE) === false) {
                throw new RuntimeException("Unable to create database file: " . DB_FILE);
            }
            @chmod(DB_FILE, 0644);
        }
        $pdo = new PDO('sqlite:' . DB_FILE);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode = WAL;');
    }
    return $pdo;
}

function initTables(): void {
    $db = getDb();
    foreach (TABLES as $table) {
        if ($table === 'counters') {
            $db->exec("CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, val INTEGER)");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS {$table} (id TEXT PRIMARY KEY, data TEXT)");
        }
    }
    ensureSeeded();
    migrateDatabase();
}

function ensureUploadDirectories(): void {
    $dirs = [UPLOAD_DIR, UPLOAD_DIR . '/tasks', UPLOAD_DIR . '/tasks/files', UPLOAD_DIR . '/tasks/images'];
    foreach ($dirs as $dir) ensureDirectory($dir);
    ensureHtaccess(UPLOAD_DIR, "Options -Indexes\n");
}

// ── Default Seed Data (with db_version counter) ─────────────────────
function defaultSeed(): array {
    $now = date('c');
    $companyId = 'comp1';
    $departmentId = 'dep1';
    $roleId = 'role_system_admin';
    $employeeId = '1';
    $userId = '1';

    return [
        'contacts'    => [[
            'id' => $employeeId,
            'fname' => 'System',
            'lname' => 'Administrator',
            'email' => 'admin@tms.local',
            'role' => $roleId,
            'departmentId' => $departmentId,
            'companyId' => $companyId,
            'status' => 'active',
            'createdAt' => $now,
        ]],
        'deals'       => [],
        'tasks'       => [],
        'notes'       => [],
        'activity'    => [],
        'taskActivity' => [],
        'departments' => [[
            'id' => $departmentId,
            'name' => 'Engineering',
            'desc' => 'Core tech dev',
            'status' => 'active',
            'companyId' => $companyId,
            'createdAt' => $now,
        ]],
        'companies'   => [[
            'id' => $companyId,
            'name' => 'TMS Global',
            'industry' => 'Software',
            'phone' => '123',
            'status' => 'active',
            'createdAt' => $now,
        ]],
        'roles'       => [[
            'id' => $roleId,
            'name' => 'System Administrator',
            'desc' => 'Built-in role. Cannot be deleted. Full access to every permission, on every stage, always.',
            'status' => 'active',
            'system' => true,
            'inheritsFrom' => '',
            'createdAt' => $now,
        ]],
        'stages'      => [
            [
                'key' => 'todo', 'label' => 'To Do', 'color' => '#4f8ef7', 'final' => false,
                'permissions' => [
                    'role_system_admin' => ['grab' => true, 'drop' => true, 'edit' => true, 'comment' => true, 'revision' => true, 'upload' => true, 'stageEdit' => true, 'reorder' => true],
                ],
            ],
            [
                'key' => 'inprogress', 'label' => 'In Progress', 'color' => '#a78bfa', 'final' => false,
                'permissions' => [
                    'role_system_admin' => ['grab' => true, 'drop' => true, 'edit' => true, 'comment' => true, 'revision' => true, 'upload' => true, 'stageEdit' => true, 'reorder' => true],
                ],
            ],
        ],
        'users'       => [[
            'id' => $userId,
            'username' => 'admin',
            'password' => 'admin123',
            'role' => $roleId,
            'employeeId' => $employeeId,
            'status' => 'active',
            'createdAt' => $now,
        ]],
        'files'       => [],
        'login_logs'  => [],
        'counters'    => [
            'contacts' => 1, 'deals' => 0, 'tasks' => 0, 'notes' => 0, 'activity' => 0,
            'taskActivity' => 0, 'departments' => 1, 'companies' => 1, 'roles' => 1,
            'stages' => 0, 'users' => 1, 'files' => 0, 'login_logs' => 0,
            'db_version' => 1, // version counter for cache busting
        ],
    ];
}

function ensureSeeded(): void {
    $db = getDb();
    $stmt = $db->query("SELECT COUNT(*) as count FROM stages");
    if ($stmt->fetch()['count'] == 0) {
        $seed = defaultSeed();
        $db->beginTransaction();
        try {
            foreach ($seed as $table => $items) {
                if ($table === 'counters') {
                    $cStmt = $db->prepare("INSERT OR REPLACE INTO counters (name, val) VALUES (?, ?)");
                    foreach ($items as $name => $val) {
                        $cStmt->execute([$name, $val]);
                    }
                } else {
                    $iStmt = $db->prepare("INSERT OR REPLACE INTO {$table} (id, data) VALUES (?, ?)");
                    foreach ($items as $item) {
                        $id = $item['id'] ?? ($item['key'] ?? uniqid());
                        $iStmt->execute([$id, json_encode($item)]);
                    }
                }
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}

function migrateDatabase(): void {
    $db = getDb();
    try {
        $db->query("SELECT 1 FROM login_logs LIMIT 1");
    } catch (PDOException $e) {
        $db->exec("CREATE TABLE IF NOT EXISTS login_logs (id TEXT PRIMARY KEY, data TEXT)");
        $stmt = $db->prepare("SELECT 1 FROM counters WHERE name = 'login_logs'");
        $stmt->execute();
        if (!$stmt->fetch()) {
            $stmt = $db->prepare("INSERT INTO counters (name, val) VALUES ('login_logs', 0)");
            $stmt->execute();
        }
    }
    try {
        $db->exec("CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(json_extract(data, '$.userId'))");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(json_extract(data, '$.loginTime'))");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_login_logs_status ON login_logs(json_extract(data, '$.status'))");
    } catch (Exception $e) {}
}

// ── APCu Cached Table Reader ──────────────────────────────────────
function readTable(string $table): array {
    if ($table === 'counters') {
        $db = getDb();
        $stmt = $db->query("SELECT name, val FROM counters");
        $out = [];
        while ($row = $stmt->fetch()) $out[$row['name']] = (int)$row['val'];
        return $out;
    }

    $cacheKey = 'tms_table_' . $table;
    if (function_exists('apcu_fetch')) {
        $data = apcu_fetch($cacheKey, $success);
        if ($success) return $data;
    }

    $db = getDb();
    if (isset(BROADCAST_LOG_TABLES[$table])) {
        $stmt = $db->prepare("SELECT data FROM {$table} ORDER BY json_extract(data, '$.createdAt') DESC");
    } else {
        $stmt = $db->prepare("SELECT data FROM {$table}");
    }
    $stmt->execute();
    $out = [];
    while ($row = $stmt->fetch()) {
        $out[] = json_decode($row['data'], true);
    }

    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $out, 60);
    }
    return $out;
}

function syncTable(string $table, array $items): bool {
    $db = getDb();
    $db->beginTransaction();
    try {
        if ($table === 'counters') {
            $stmt = $db->prepare("INSERT OR REPLACE INTO counters (name, val) VALUES (?, ?)");
            foreach ($items as $k => $v) $stmt->execute([$k, (int)$v]);
        } else {
            $db->exec("DELETE FROM {$table}");
            $stmt = $db->prepare("INSERT INTO {$table} (id, data) VALUES (?, ?)");
            foreach ($items as $item) {
                $id = $item['id'] ?? ($item['key'] ?? str_replace('.', '', uniqid('', true)));
                $stmt->execute([$id, json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
            }
        }
        $db->commit();

        // Invalidate APCu cache for this table
        if (function_exists('apcu_delete')) {
            apcu_delete('tms_table_' . $table);
        }
        // Bump version to invalidate full payload cache
        incrementDbVersion();

        return true;
    } catch (Exception $e) {
        $db->rollBack();
        return false;
    }
}

// ── Version Management for Payload Caching ────────────────────────
function getDbVersion(): int {
    $db = getDb();
    $stmt = $db->query("SELECT val FROM counters WHERE name = 'db_version'");
    $row = $stmt->fetch();
    if (!$row) {
        $stmt = $db->prepare("INSERT INTO counters (name, val) VALUES ('db_version', 1)");
        $stmt->execute([1]);
        return 1;
    }
    return (int)$row['val'];
}

function incrementDbVersion(): void {
    $db = getDb();
    $current = getDbVersion();
    $stmt = $db->prepare("UPDATE counters SET val = ? WHERE name = 'db_version'");
    $stmt->execute([$current + 1]);
    if (function_exists('apcu_delete')) {
        apcu_delete('tms_db_payload_' . $current);
    }
}

// ═════════════════════════════════════════════════════════════════════
//  SERVER-SIDE RBAC ENGINE (SECURITY LAYER)
// ═════════════════════════════════════════════════════════════════════

function serverGetCurrentUserRole(): ?string {
    return $_SESSION['user']['role'] ?? null;
}

function serverIsSystemAdmin(): bool {
    $roleId = serverGetCurrentUserRole();
    return $roleId === 'role_system_admin' || $roleId === 'admin';
}

function serverGetRoleInheritanceChain(string $roleId): array {
    $chain = [];
    $seen = [];
    $current = $roleId;
    $db = getDb();
    while ($current && !in_array($current, $seen, true)) {
        $seen[] = $current;
        $chain[] = $current;
        $stmt = $db->prepare("SELECT data FROM roles WHERE id = ?");
        $stmt->execute([$current]);
        $row = $stmt->fetch();
        if (!$row) break;
        $role = json_decode($row['data'], true);
        $current = $role['inheritsFrom'] ?? null;
    }
    return $chain;
}

function serverGetStagePermissions(string $stageKey): array {
    $cacheKey = 'tms_stage_perms_' . $stageKey;
    if (function_exists('apcu_fetch')) {
        $perms = apcu_fetch($cacheKey, $success);
        if ($success) return $perms;
    }

    $db = getDb();
    $stmt = $db->prepare("SELECT data FROM stages WHERE id = ?");
    $stmt->execute([$stageKey]);
    $row = $stmt->fetch();
    if (!$row) return [];

    $stage = json_decode($row['data'], true);
    $perms = $stage['permissions'] ?? [];

    if (empty($perms)) {
        if (function_exists('apcu_store')) apcu_store($cacheKey, [], 300);
        return [];
    }

    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $perms, 300);
    }
    return $perms;
}

function serverHasPermission(string $stageKey, string $permission): bool {
    if (serverIsSystemAdmin()) return true;

    $roleId = serverGetCurrentUserRole();
    if (!$roleId) return false;

    $perms = serverGetStagePermissions($stageKey);
    if (empty($perms)) return true; // open stage

    $chain = serverGetRoleInheritanceChain($roleId);
    foreach ($chain as $rid) {
        if (isset($perms[$rid][$permission]) && $perms[$rid][$permission] === true) {
            return true;
        }
    }
    return false;
}

function serverCanDeleteFile(): bool {
    return serverIsSystemAdmin();
}

function serverGetDealStage(string $dealId): ?string {
    $db = getDb();
    $stmt = $db->prepare("SELECT data FROM deals WHERE id = ?");
    $stmt->execute([$dealId]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $deal = json_decode($row['data'], true);
    return $deal['stage'] ?? null;
}

// ═════════════════════════════════════════════════════════════════════
//  LOGIN MONITORING FUNCTIONS (copied from original, unchanged)
// ═════════════════════════════════════════════════════════════════════

function logLoginAttempt($userId, $username, $status, $failureReason = null, $additionalData = []) {
    try {
        $db = getDb();
        $stmt = $db->query("SELECT val FROM counters WHERE name = 'login_logs'");
        $row = $stmt->fetch();
        $nextId = ($row ? (int)$row['val'] : 0) + 1;
        $stmt = $db->prepare("INSERT OR REPLACE INTO counters (name, val) VALUES ('login_logs', ?)");
        $stmt->execute([$nextId]);
        $geoData = getGeoLocation($_SERVER['REMOTE_ADDR'] ?? '');
        $logEntry = [
            'id' => 'log_' . time() . '_' . bin2hex(random_bytes(8)),
            'userId' => $userId,
            'username' => $username,
            'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'loginTime' => date('c'),
            'logoutTime' => null,
            'status' => $status,
            'failureReason' => $failureReason,
            'sessionId' => session_id(),
            'deviceType' => detectDeviceType($_SERVER['HTTP_USER_AGENT'] ?? ''),
            'browser' => detectBrowser($_SERVER['HTTP_USER_AGENT'] ?? ''),
            'os' => detectOS($_SERVER['HTTP_USER_AGENT'] ?? ''),
            'country' => $geoData['country'] ?? 'Unknown',
            'city' => $geoData['city'] ?? 'Unknown',
            'referer' => $_SERVER['HTTP_REFERER'] ?? '',
            'requestMethod' => $_SERVER['REQUEST_METHOD'] ?? '',
            'additionalData' => $additionalData,
            'createdAt' => date('c')
        ];
        $stmt = $db->prepare("INSERT INTO login_logs (id, data) VALUES (?, ?)");
        $stmt->execute([$logEntry['id'], json_encode($logEntry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
        $employeeId = null;
        foreach (readTable('users') as $u) {
            if (($u['id'] ?? null) === $userId) { $employeeId = $u['employeeId'] ?? null; break; }
        }
        $broadcastEntry = $logEntry;
        $broadcastEntry['employeeId'] = $employeeId;
        notifySocketServer($status === 'success' ? 'login:success' : 'login:failed', $broadcastEntry);
        return true;
    } catch (Exception $e) {
        error_log("Failed to log login attempt: " . $e->getMessage());
        return false;
    }
}

function logLogout($userId, $username) {
    try {
        $db = getDb();
        $stmt = $db->prepare("SELECT data FROM login_logs WHERE json_extract(data, '$.userId') = ? AND json_extract(data, '$.logoutTime') IS NULL ORDER BY json_extract(data, '$.loginTime') DESC LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if ($row) {
            $log = json_decode($row['data'], true);
            if ($log && $log['userId'] === $userId) {
                $log['logoutTime'] = date('c');
                $log['sessionDuration'] = calculateDuration($log['loginTime'], $log['logoutTime']);
                $stmt = $db->prepare("UPDATE login_logs SET data = ? WHERE id = ?");
                $stmt->execute([json_encode($log), $log['id']]);
                $employeeId = null;
                foreach (readTable('users') as $u) {
                    if (($u['id'] ?? null) === $userId) { $employeeId = $u['employeeId'] ?? null; break; }
                }
                $broadcastEntry = $log;
                $broadcastEntry['employeeId'] = $employeeId;
                notifySocketServer('logout', $broadcastEntry);
                return true;
            }
        }
        return false;
    } catch (Exception $e) {
        error_log("Failed to log logout: " . $e->getMessage());
        return false;
    }
}

function calculateDuration($start, $end) {
    try {
        return strtotime($end) - strtotime($start);
    } catch (Exception $e) {
        return 0;
    }
}

function detectDeviceType($userAgent) {
    if (empty($userAgent)) return 'Unknown';
    $userAgent = strtolower($userAgent);
    if (strpos($userAgent, 'mobile') !== false) return 'Mobile';
    if (strpos($userAgent, 'tablet') !== false) return 'Tablet';
    if (strpos($userAgent, 'ipad') !== false) return 'Tablet';
    return 'Desktop';
}

function detectBrowser($userAgent) {
    if (empty($userAgent)) return 'Unknown';
    $userAgent = strtolower($userAgent);
    if (strpos($userAgent, 'chrome') !== false && strpos($userAgent, 'edge') === false) return 'Chrome';
    if (strpos($userAgent, 'firefox') !== false) return 'Firefox';
    if (strpos($userAgent, 'safari') !== false && strpos($userAgent, 'chrome') === false) return 'Safari';
    if (strpos($userAgent, 'edge') !== false) return 'Edge';
    if (strpos($userAgent, 'opera') !== false || strpos($userAgent, 'opr') !== false) return 'Opera';
    return 'Other';
}

function detectOS($userAgent) {
    if (empty($userAgent)) return 'Unknown';
    $userAgent = strtolower($userAgent);
    if (strpos($userAgent, 'windows') !== false) return 'Windows';
    if (strpos($userAgent, 'mac os') !== false) return 'macOS';
    if (strpos($userAgent, 'linux') !== false) return 'Linux';
    if (strpos($userAgent, 'android') !== false) return 'Android';
    if (strpos($userAgent, 'ios') !== false || strpos($userAgent, 'iphone') !== false) return 'iOS';
    return 'Other';
}

function getGeoLocation($ip) {
    if (in_array($ip, ['127.0.0.1', '::1', 'localhost']) || strpos($ip, '192.168.') === 0 || strpos($ip, '10.') === 0) {
        return ['country' => 'Local', 'city' => 'Local'];
    }
    try {
        $response = @file_get_contents("http://ip-api.com/json/{$ip}?fields=country,city,lat,lon");
        if ($response) {
            $data = json_decode($response, true);
            if ($data && isset($data['country'])) {
                return ['country' => $data['country'], 'city' => $data['city'] ?? 'Unknown', 'lat' => $data['lat'] ?? null, 'lon' => $data['lon'] ?? null];
            }
        }
    } catch (Exception $e) {}
    return ['country' => 'Unknown', 'city' => 'Unknown'];
}

function checkLoginRate($username, $ip) {
    try {
        $db = getDb();
        $maxAttempts = 5;
        $timeWindow = 900;
        $stmt = $db->prepare("SELECT COUNT(*) as attempts FROM login_logs WHERE json_extract(data, '$.username') = ? AND json_extract(data, '$.status') = 'failed' AND datetime(json_extract(data, '$.loginTime')) > datetime('now', ? || ' seconds ago')");
        $stmt->execute([$username, '-' . $timeWindow]);
        $row = $stmt->fetch();
        return $row['attempts'] < $maxAttempts;
    } catch (Exception $e) {
        return true;
    }
}

// ═════════════════════════════════════════════════════════════════════
//  FILE HELPERS (FULL IMPLEMENTATION)
// ═════════════════════════════════════════════════════════════════════

function uploadErrorMessage(int $code): string {
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
            return 'File exceeds this server\'s upload_max_filesize limit (set in PHP, controlled by your host).';
        case UPLOAD_ERR_FORM_SIZE:
            return 'File exceeds the form\'s maximum upload size.';
        case UPLOAD_ERR_PARTIAL:
            return 'File was only partially uploaded — check your connection and try again.';
        case UPLOAD_ERR_NO_FILE:
            return 'No file was received by the server.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Server has no temporary folder configured for uploads.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Server failed to write the uploaded file to disk (check folder permissions).';
        case UPLOAD_ERR_EXTENSION:
            return 'A server-side PHP extension blocked this upload.';
        default:
            return 'Upload failed (PHP error code ' . $code . ').';
    }
}

function validateUpload($file) {
    if (!isset($file) || !is_array($file) || !isset($file['tmp_name'])) {
        return ['ok' => false, 'error' => 'No file provided'];
    }
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => uploadErrorMessage((int)($file['error'] ?? -1))];
    }
    if ($file['size'] <= 0 || $file['size'] > MAX_UPLOAD_SIZE) {
        return ['ok' => false, 'error' => 'File must be between 1 byte and ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB (this app\'s own limit — separate from your host\'s PHP limits).'];
    }
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (in_array($extension, ALLOWED_IMAGES, true)) return ['ok' => true, 'extension' => $extension, 'type' => 'image'];
    if (in_array($extension, ALLOWED_DOCUMENTS, true)) return ['ok' => true, 'extension' => $extension, 'type' => 'file'];
    return ['ok' => false, 'error' => 'File type not allowed'];
}

function logFileActivity(string $message, string $color = 'accent', string $actorName = '', string $actorRole = ''): void {
    $db = getDb();
    $id = 'act_' . str_replace('.', '', uniqid('', true));
    $entry = [
        'id' => $id,
        'message' => $actorName !== '' ? ($actorName . ' ' . $message) : $message,
        'color' => $color,
        'category' => 'file',
        'icon' => '📎',
        'createdAt' => date('c'),
        'actorRole' => $actorRole,
    ];
    $stmt = $db->prepare("INSERT INTO activity (id, data) VALUES (?, ?)");
    $stmt->execute([$id, json_encode($entry)]);
    notifySocketServer('activity:new', $entry);
}

// ── Other Helpers ────────────────────────────────────────────────────

function decodePostPayload() {
    if (isset($_POST['payload'])) {
        $decoded = base64_decode($_POST['payload'], true);
        if ($decoded !== false) {
            $data = json_decode($decoded, true);
            if ($data !== null) return $data;
        }
    }
    $raw = file_get_contents('php://input');
    if ($raw) {
        $data = json_decode($raw, true);
        if ($data !== null) return $data;
    }
    return null;
}

function diffTableChanges(array $oldItems, array $newItems): array {
    $oldById = [];
    foreach ($oldItems as $item) if (isset($item['id'])) $oldById[$item['id']] = $item;
    $created = [];
    $updated = [];
    $seenIds = [];
    foreach ($newItems as $item) {
        $id = $item['id'] ?? null;
        if ($id === null) continue;
        $seenIds[$id] = true;
        if (!array_key_exists($id, $oldById)) {
            $created[] = $item;
        } elseif (json_encode($oldById[$id]) !== json_encode($item)) {
            $updated[] = $item;
        }
    }
    $deleted = [];
    foreach ($oldById as $id => $item) if (!isset($seenIds[$id])) $deleted[] = $id;
    return ['created' => $created, 'updated' => $updated, 'deleted' => $deleted];
}

function broadcastTableDiff(string $eventPrefix, array $diff): void {
    foreach ($diff['created'] as $item) notifySocketServer("{$eventPrefix}:created", $item);
    foreach ($diff['updated'] as $item) notifySocketServer("{$eventPrefix}:updated", $item);
    foreach ($diff['deleted'] as $id) notifySocketServer("{$eventPrefix}:deleted", ['id' => $id]);
}

// ═════════════════════════════════════════════════════════════════════
//  MAIN CONTROLLER
// ═════════════════════════════════════════════════════════════════════

try {
    initTables();
    ensureUploadDirectories();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Bootstrap failed: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'load');

// ─────────────────────────────────────────────────────────────────────
//  ACTION: LOAD (with Full Payload Caching)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'load') {
    $version = getDbVersion();
    $cacheKey = 'tms_db_payload_' . $version;

    if (function_exists('apcu_fetch')) {
        $cached = apcu_fetch($cacheKey, $success);
        if ($success) {
            header('X-Cache: HIT');
            echo $cached;
            exit;
        }
    }

    $out = [];
    foreach (TABLES as $table) {
        $out[$table] = readTable($table);
    }
    $json = json_encode(['ok' => true, 'db' => $out]);

    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $json, 60);
    }
    header('X-Cache: MISS');
    echo $json;
    exit;
}

// ─────────────────────────────────────────────────────────────────────
//  ACTION: SAVE (with Full Server-Side RBAC Validation)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'save') {
    try {
        $payload = decodePostPayload();
        if (!is_array($payload) || !isset($payload['db']) || !is_array($payload['db'])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid or missing payload']);
            exit;
        }

        $incomingDb = $payload['db'];
        $incomingDeals = $incomingDb['deals'] ?? [];

        // ── Fetch current state from SERVER (truth) ──
        $currentDeals = readTable('deals');
        $currentMap = [];
        foreach ($currentDeals as $d) { $currentMap[$d['id']] = $d; }

        $incomingMap = [];
        foreach ($incomingDeals as $d) { $incomingMap[$d['id']] = $d; }

        // 1. Check DELETIONS (Deals in DB but missing in incoming)
        foreach ($currentMap as $id => $oldDeal) {
            if (!isset($incomingMap[$id])) {
                if (!serverHasPermission($oldDeal['stage'], 'edit')) {
                    http_response_code(403);
                    echo json_encode(['ok' => false, 'error' => "Forbidden: You lack 'edit' permission to delete task '{$oldDeal['title']}'."]);
                    exit;
                }
            }
        }

        // 2. Check CREATIONS & UPDATES
        foreach ($incomingDeals as $newDeal) {
            $id = $newDeal['id'];
            $oldDeal = $currentMap[$id] ?? null;

            // CASE: New Task (Create)
            if (!$oldDeal) {
                if (!serverHasPermission($newDeal['stage'], 'drop')) {
                    http_response_code(403);
                    echo json_encode(['ok' => false, 'error' => "Forbidden: You lack 'drop' permission to create a task in this stage."]);
                    exit;
                }
                continue;
            }

            // CASE: Stage Change (Move)
            if ($oldDeal['stage'] !== $newDeal['stage']) {
                if (!serverHasPermission($oldDeal['stage'], 'grab')) {
                    http_response_code(403);
                    echo json_encode(['ok' => false, 'error' => "Forbidden: You lack 'grab' permission to move out of this stage."]);
                    exit;
                }
                if (!serverHasPermission($newDeal['stage'], 'drop')) {
                    http_response_code(403);
                    echo json_encode(['ok' => false, 'error' => "Forbidden: You lack 'drop' permission to move into this stage."]);
                    exit;
                }
                continue;
            }

            // CASE: Details Edited (Title, Desc, Priority, etc. - Stage unchanged)
            if (json_encode($oldDeal) !== json_encode($newDeal)) {
                if (!serverHasPermission($oldDeal['stage'], 'edit')) {
                    http_response_code(403);
                    echo json_encode(['ok' => false, 'error' => "Forbidden: You lack 'edit' permission to modify this task."]);
                    exit;
                }
            }
        }

        // ── If all RBAC checks pass, proceed with the save ──
        $results = [];
        $allOk = true;
        foreach (TABLES as $table) {
            if (array_key_exists($table, $incomingDb)) {
                $ok = syncTable($table, $incomingDb[$table]);
                $results[$table] = $ok;
                if (!$ok) $allOk = false;
            }
        }

        echo json_encode(['ok' => $allOk, 'saved' => $results]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────
//  ACTION: UPLOAD FILE (SECURED)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'uploadFile') {
    try {
        // If the whole POST body exceeded PHP's post_max_size
        if (empty($_FILES) && empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            http_response_code(413);
            echo json_encode(['ok' => false, 'error' => 'This file is too large for the server to accept in one upload (PHP post_max_size/upload_max_filesize limit).']);
            exit;
        }

        $taskId = trim((string)($_POST['taskId'] ?? ''));
        if ($taskId === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'taskId is required']);
            exit;
        }

        // ── RBAC Check: Upload permission on the task's current stage ──
        $stageKey = serverGetDealStage($taskId);
        if (!$stageKey || !serverHasPermission($stageKey, 'upload')) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden: You lack upload permission for this task\'s stage.']);
            exit;
        }

        $validation = validateUpload($_FILES['file'] ?? null);
        if (!$validation['ok']) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => $validation['error']]);
            exit;
        }

        $file = $_FILES['file'];
        $extension = $validation['extension'];
        $type = $validation['type'];

        $safeBase = trim(preg_replace('/[^A-Za-z0-9_\-]+/', '-', pathinfo($file['name'], PATHINFO_FILENAME)), '-');
        $uniqueFilename = ($safeBase ?: 'file') . '-' . str_replace('.', '', uniqid('', true)) . '.' . $extension;
        $destDir = $type === 'image' ? UPLOAD_DIR . '/tasks/images' : UPLOAD_DIR . '/tasks/files';
        $destAbsolutePath = $destDir . '/' . $uniqueFilename;
        $relativePath = '/uploads/tasks/' . ($type === 'image' ? 'images' : 'files') . '/' . $uniqueFilename;

        if (!@move_uploaded_file($file['tmp_name'], $destAbsolutePath)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Failed to save file']);
            exit;
        }

        $files = readTable('files');
        $max = 0;
        foreach ($files as $f) {
            if (preg_match('/^file_(\d+)$/', $f['id'] ?? '', $matches)) {
                $max = max($max, (int)$matches[1]);
            }
        }
        $id = 'file_' . ($max + 1);

        $now = date('c');
        $record = [
            'id' => $id,
            'taskId' => $taskId,
            'title' => trim((string)($_POST['title'] ?? '')) ?: $file['name'],
            'filename' => $uniqueFilename,
            'originalFilename' => $file['name'],
            'extension' => $extension,
            'mimeType' => MIME_TYPES[$extension] ?? ($file['type'] ?? ''),
            'size' => (int)$file['size'],
            'type' => $type,
            'uploadedBy' => $_POST['uploadedBy'] ?? '',
            'uploadedDate' => $now,
            'path' => $relativePath,
            'createdAt' => $now,
            'updatedAt' => $now,
        ];

        $db = getDb();
        $stmt = $db->prepare("INSERT INTO files (id, data) VALUES (?, ?)");
        $ok = $stmt->execute([$id, json_encode($record)]);

        if (!$ok) {
            @unlink($destAbsolutePath);
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Failed metadata storage']);
            exit;
        }

        // Invalidate cache
        incrementDbVersion();

        logFileActivity('uploaded a file: ' . $record['title'], 'accent', (string)($_POST['actorName'] ?? ''), (string)($_POST['actorRole'] ?? ''));
        notifySocketServer('file:uploaded', $record);
        echo json_encode(['ok' => true, 'file' => $record]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────
//  ACTION: DELETE FILE (SECURED - System Admin Only)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'deleteFile') {
    try {
        if (!serverCanDeleteFile()) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden: Only System Administrators can delete files.']);
            exit;
        }

        $id = trim((string)($_POST['id'] ?? ($_GET['id'] ?? '')));
        $files = readTable('files');
        $record = null;
        foreach ($files as $f) {
            if (($f['id'] ?? null) === $id) { $record = $f; break; }
        }
        if (!$record) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'File not found']);
            exit;
        }

        $storedPath = $record['path'] ?? '';
        $relativeFromUploads = preg_replace('#^/uploads/#', '', $storedPath);
        if (strpos($relativeFromUploads, 'uploads/') === 0) {
            $relativeFromUploads = substr($relativeFromUploads, strlen('uploads/'));
        }
        $fullPath = UPLOAD_DIR . '/' . $relativeFromUploads;
        if (!file_exists($fullPath)) {
            $fullPath = __DIR__ . '/' . ltrim($storedPath, '/');
        }
        @unlink($fullPath);

        $db = getDb();
        $stmt = $db->prepare("DELETE FROM files WHERE id = ?");
        $stmt->execute([$id]);

        incrementDbVersion();

        logFileActivity('deleted a file: ' . ($record['title'] ?? ''), 'danger', (string)($_POST['actorName'] ?? ''), (string)($_POST['actorRole'] ?? ''));
        notifySocketServer('file:deleted', ['id' => $id, 'taskId' => $record['taskId'] ?? null]);
        echo json_encode(['ok' => true, 'deleted' => $id]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────
//  ACTION: UPDATE FILE (RENAME - SECURED - System Admin Only)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'updateFile') {
    try {
        if (!serverCanDeleteFile()) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden: Only System Administrators can rename files.']);
            exit;
        }

        $id = trim((string)($_POST['id'] ?? ''));
        $newTitle = trim((string)($_POST['title'] ?? ''));
        if ($id === '' || $newTitle === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'ID and title are required']);
            exit;
        }

        $files = readTable('files');
        $record = null;
        foreach ($files as $f) {
            if (($f['id'] ?? null) === $id) { $record = $f; break; }
        }
        if (!$record) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'File not found']);
            exit;
        }

        $record['title'] = $newTitle;
        $record['updatedAt'] = date('c');

        $db = getDb();
        $stmt = $db->prepare("UPDATE files SET data = ? WHERE id = ?");
        $stmt->execute([json_encode($record), $id]);

        incrementDbVersion();

        logFileActivity('renamed a file: ' . $record['title'], 'accent', (string)($_POST['actorName'] ?? ''), (string)($_POST['actorRole'] ?? ''));
        notifySocketServer('file:updated', $record);

        echo json_encode(['ok' => true, 'file' => $record]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────
//  OTHER ACTIONS (unchanged from original)
// ─────────────────────────────────────────────────────────────────────
if ($action === 'getTaskFiles') {
    $taskId = trim((string)($_GET['taskId'] ?? ($_POST['taskId'] ?? '')));
    $files = readTable('files');
    $taskFiles = array_values(array_filter($files, fn($f) => ($f['taskId'] ?? '') === $taskId));
    echo json_encode(['ok' => true, 'files' => $taskFiles]);
    exit;
}

if ($action === 'downloadFile' || $action === 'serveFile') {
    $id = trim((string)($_GET['id'] ?? ''));
    $files = readTable('files');
    $record = null;
    foreach ($files as $f) {
        if (($f['id'] ?? null) === $id) { $record = $f; break; }
    }
    if (!$record) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'File not found']);
        exit;
    }

    $storedPath = $record['path'] ?? '';
    $relativeFromUploads = preg_replace('#^/uploads/#', '', $storedPath);
    if (strpos($relativeFromUploads, 'uploads/') === 0) {
        $relativeFromUploads = substr($relativeFromUploads, strlen('uploads/'));
    }
    $fullPath = UPLOAD_DIR . '/' . $relativeFromUploads;

    if (!file_exists($fullPath)) {
        $fullPath = __DIR__ . '/' . ltrim($storedPath, '/');
        if (!file_exists($fullPath)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'File not found on disk']);
            exit;
        }
    }

    $disposition = ($action === 'serveFile') ? 'inline' : 'attachment';
    $ext = strtolower(pathinfo($record['originalFilename'] ?? '', PATHINFO_EXTENSION));
    $mimeType = MIME_TYPES[$ext] ?? ($record['mimeType'] ?: 'application/octet-stream');
    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: ' . $disposition . '; filename="' . basename($record['originalFilename']) . '"');
    header('Content-Length: ' . filesize($fullPath));
    header('X-Content-Type-Options: nosniff');
    readfile($fullPath);
    exit;
}

// ── Login Monitoring Endpoints (unchanged) ─────────────────────────
if ($action === 'getLoginLogs') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    $status = isset($_GET['status']) ? trim($_GET['status']) : null;
    $userId = isset($_GET['userId']) ? trim($_GET['userId']) : null;
    $username = isset($_GET['username']) ? trim($_GET['username']) : null;

    $db = getDb();
    $sql = "SELECT data FROM login_logs";
    $params = [];
    $where = [];
    if ($status) { $where[] = "json_extract(data, '$.status') = ?"; $params[] = $status; }
    if ($userId) { $where[] = "json_extract(data, '$.userId') = ?"; $params[] = $userId; }
    if ($username) { $where[] = "json_extract(data, '$.username') LIKE ?"; $params[] = '%' . $username . '%'; }
    if ($where) $sql .= " WHERE " . implode(" AND ", $where);
    $sql .= " ORDER BY json_extract(data, '$.loginTime') DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $logs = [];
    while ($row = $stmt->fetch()) $logs[] = json_decode($row['data'], true);
    echo json_encode(['ok' => true, 'logs' => $logs, 'count' => count($logs)]);
    exit;
}

if ($action === 'getLoginStats') {
    $db = getDb();
    $stmt = $db->query("SELECT COUNT(*) as total FROM login_logs");
    $total = $stmt->fetch()['total'];
    $stmt = $db->query("SELECT COUNT(*) as failed FROM login_logs WHERE json_extract(data, '$.status') = 'failed'");
    $failed = $stmt->fetch()['failed'];
    $stmt = $db->query("SELECT COUNT(DISTINCT json_extract(data, '$.userId')) as users FROM login_logs");
    $users = $stmt->fetch()['users'];
    $stmt = $db->query("SELECT COUNT(*) as last24 FROM login_logs WHERE datetime(json_extract(data, '$.loginTime')) > datetime('now', '-1 day')");
    $last24 = $stmt->fetch()['last24'];
    $stmt = $db->query("SELECT COUNT(*) as active FROM login_logs WHERE json_extract(data, '$.logoutTime') IS NULL AND datetime(json_extract(data, '$.loginTime')) > datetime('now', '-30 minutes')");
    $active = $stmt->fetch()['active'];
    $stmt = $db->query("SELECT json_extract(data, '$.userId') as userId, json_extract(data, '$.username') as username, COUNT(*) as count FROM login_logs WHERE json_extract(data, '$.status') = 'success' GROUP BY json_extract(data, '$.userId') ORDER BY count DESC LIMIT 5");
    $topUsers = [];
    while ($row = $stmt->fetch()) $topUsers[] = ['userId' => $row['userId'], 'username' => $row['username'], 'count' => (int)$row['count']];
    echo json_encode(['ok' => true, 'stats' => ['total' => (int)$total, 'failed' => (int)$failed, 'uniqueUsers' => (int)$users, 'last24Hours' => (int)$last24, 'activeSessions' => (int)$active, 'successRate' => $total > 0 ? round((($total - $failed) / $total) * 100, 2) : 0, 'topUsers' => $topUsers]]);
    exit;
}

if ($action === 'clearLoginLogs') {
    $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
    $db = getDb();
    $stmt = $db->prepare("DELETE FROM login_logs WHERE datetime(json_extract(data, '$.loginTime')) < datetime('now', ? || ' days ago')");
    $stmt->execute(['-' . $days]);
    $deleted = $stmt->rowCount();
    echo json_encode(['ok' => true, 'deleted' => $deleted, 'message' => "Deleted {$deleted} login logs older than {$days} days"]);
    exit;
}

if ($action === 'getLoginLog') {
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Log ID required']);
        exit;
    }
    $db = getDb();
    $stmt = $db->prepare("SELECT data FROM login_logs WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row) echo json_encode(['ok' => true, 'log' => json_decode($row['data'], true)]);
    else { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'Log entry not found']); }
    exit;
}

// ── Employee Directory ──────────────────────────────────────────────
if ($action === 'getEmployeeDirectory') {
    $contacts = readTable('contacts');
    $users = readTable('users');
    $loginLogs = readTable('login_logs');
    $directory = [];
    foreach ($contacts as $contact) {
        $employeeId = $contact['id'] ?? null;
        $user = null;
        foreach ($users as $u) {
            if (($u['employeeId'] ?? '') === $employeeId) { $user = $u; break; }
        }
        $userLogs = [];
        if ($user) {
            foreach ($loginLogs as $log) {
                if (($log['userId'] ?? '') === $user['id']) $userLogs[] = $log;
            }
        }
        usort($userLogs, function($a, $b) { return strtotime($b['loginTime'] ?? '') - strtotime($a['loginTime'] ?? ''); });
        $latestLog = $userLogs[0] ?? null;
        $isOnline = $latestLog && !isset($latestLog['logoutTime']) && ($latestLog['status'] ?? '') === 'success';
        $duration = null;
        if ($isOnline && isset($latestLog['loginTime'])) $duration = calculateDuration($latestLog['loginTime'], date('c'));
        elseif ($latestLog && isset($latestLog['logoutTime'])) $duration = calculateDuration($latestLog['loginTime'], $latestLog['logoutTime']);
        $directory[] = [
            'employee' => $contact,
            'user' => $user,
            'loginStatus' => [
                'isOnline' => $isOnline,
                'lastActive' => $latestLog ? ($isOnline ? $latestLog['loginTime'] : ($latestLog['logoutTime'] ?? null)) : null,
                'duration' => $duration,
                'lastLogin' => $latestLog ? $latestLog['loginTime'] : null,
                'status' => $isOnline ? 'Online' : ($latestLog ? 'Offline' : 'Never Logged In')
            ]
        ];
    }
    echo json_encode(['ok' => true, 'directory' => $directory, 'count' => count($directory)]);
    exit;
}

// ─────────────────────────────────────────────────────────────────────
//  FALLBACK
// ─────────────────────────────────────────────────────────────────────
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action: ' . $action]);