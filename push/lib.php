<?php
// Rooznegar Web Push — shared helpers.
// Data and the VAPID private key live OUTSIDE the web root.
declare(strict_types=1);
umask(0077);   // every file we create (subs, tokens, rate counters, key) is owner-only

const DATA_DIR    = '/home/mahsenir/rooz-data/subs';
const RATE_DIR    = '/home/mahsenir/rooz-data/ai-rate';
const VAPID_PEM   = '/home/mahsenir/rooz-data/vapid.pem';
const VAPID_PUB   = 'BFWp_6mRsqW1G8nTwkh6fvCDfTWvXTFPMe-Cl3pnW6RrVBLff5GCzxibmpxw2YI6IJ_gTbMyFwFAa9DXIk80e2M';
const VAPID_SUB   = 'mailto:info@mahsen81.ir';
const ALLOWED_ORIGIN = 'https://rooz.mahsen81.ir';
const MAX_ITEMS   = 500;      // reminders kept per device
const LATE_WINDOW = 15 * 60;  // seconds: skip reminders older than this
const JFLAGS      = JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE;

function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo json_encode($data, JFLAGS);
    exit;
}

function read_json_body(): array {
    // read one byte past the limit so an oversized body is rejected instead of silently truncated
    $raw = file_get_contents('php://input', false, null, 0, 512 * 1024 + 1) ?: '';
    if (strlen($raw) > 512 * 1024) json_out(['error' => 'too large'], 413);
    $d = json_decode($raw, true, 32);
    if (!is_array($d)) json_out(['error' => 'bad json'], 400);
    return $d;
}

// Browsers always send Origin on cross-site POSTs; reject foreign ones (CSRF / quota abuse from other sites).
function require_origin(): void {
    if (($_SERVER['HTTP_ORIGIN'] ?? ALLOWED_ORIGIN) !== ALLOWED_ORIGIN) json_out(['error' => 'origin'], 403);
}

// Only accept real push-service endpoints (prevents using us as an HTTP relay / SSRF).
function valid_endpoint($e): bool {
    if (!is_string($e) || strlen($e) > 1000 || !str_starts_with($e, 'https://')) return false;
    $u = parse_url($e);
    if (!$u || isset($u['user']) || isset($u['pass']) || isset($u['port'])) return false;
    $host = strtolower($u['host'] ?? '');
    foreach (['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'notify.windows.com', 'push.services.mozilla.com'] as $ok) {
        if ($host === $ok || str_ends_with($host, '.' . $ok)) return true;
    }
    return false;
}

function sub_file(string $endpoint): string {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0700, true);
    return DATA_DIR . '/' . hash('sha256', $endpoint) . '.json';
}

function load_sub(string $file): ?array {
    if (!is_file($file)) return null;
    $d = json_decode((string)file_get_contents($file), true);
    return is_array($d) && is_array($d['items'] ?? null) ? $d : null;
}

function save_sub(string $file, array $d): void {
    $json = json_encode($d, JFLAGS);
    if ($json === false) return;                                   // never truncate a file to ""
    $tmp = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';        // unique: concurrent writers must not share a temp file
    if (file_put_contents($tmp, $json) === false) { @unlink($tmp); return; }
    rename($tmp, $file);
}

// Serialise read-modify-write of one subscription file across subscribe/pending/cron.
// Without it cron could overwrite a fresh upload, or pending's "delivered" mark could be lost (duplicates).
function with_lock(string $file, callable $fn) {
    $h = @fopen($file . '.lock', 'c');
    if ($h) flock($h, LOCK_EX);
    try { return $fn(); } finally { if ($h) { flock($h, LOCK_UN); fclose($h); } }
}

// Atomic per-IP daily counter. Returns false when the limit is reached.
function rate_ok(string $name, int $limit): bool {
    if (!is_dir(RATE_DIR)) mkdir(RATE_DIR, 0700, true);
    $f = RATE_DIR . '/' . $name . '-' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('Y-m-d')) . '.n';
    $h = @fopen($f, 'c+'); if (!$h) return false;
    flock($h, LOCK_EX);
    $n = (int)stream_get_contents($h);
    $ok = $n < $limit;
    if ($ok) { ftruncate($h, 0); rewind($h); fwrite($h, (string)($n + 1)); }
    flock($h, LOCK_UN); fclose($h);
    if (random_int(1, 50) === 1) foreach (glob(RATE_DIR . '/*.n') ?: [] as $g) if (filemtime($g) < time() - 2 * 86400) @unlink($g);
    return $ok;
}

// ES256 DER signature -> raw 64-byte r||s (JWT format)
function der_to_raw(string $der): string {
    $p = 2; if (ord($der[1]) & 0x80) $p += ord($der[1]) & 0x7f;
    $rl = ord($der[$p + 1]); $r = substr($der, $p + 2, $rl); $p += 2 + $rl;
    $sl = ord($der[$p + 1]); $s = substr($der, $p + 2, $sl);
    $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    return $r . $s;
}

function vapid_header(string $endpoint): string {
    static $key = null;
    $u = parse_url($endpoint);
    $aud = $u['scheme'] . '://' . $u['host'];
    $h = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $c = b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => VAPID_SUB]));
    $key ??= openssl_pkey_get_private((string)file_get_contents(VAPID_PEM));
    if (!$key || !openssl_sign("$h.$c", $der, $key, OPENSSL_ALGO_SHA256)) throw new RuntimeException('VAPID signing failed');
    return 'vapid t=' . "$h.$c." . b64u(der_to_raw($der)) . ', k=' . VAPID_PUB;
}

// Payload-less push: the service worker wakes up and fetches pending.php.
// Returns HTTP status (404/410 = subscription is gone).
function send_push(string $endpoint): int {
    if (!valid_endpoint($endpoint)) return 410;
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Authorization: ' . vapid_header($endpoint), 'TTL: 3600', 'Urgency: high', 'Content-Length: 0'],
    ]);
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $code;
}
