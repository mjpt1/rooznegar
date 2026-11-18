<?php
// Google sign-in that stays signed in: the browser gets a one-time code (GIS code client,
// redirect_uri "postmessage"), we exchange it here for a refresh token, keep the refresh token
// encrypted on the server and hand the browser short-lived access tokens on request.
// POST {action:'exchange', code}  -> {sid, access_token, expires_in}
// POST {action:'refresh', sid}    -> {access_token, expires_in}
// POST {action:'revoke', sid}     -> {ok}
require __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_out(['ok' => true]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);
require_origin();

const TOK_DIR = '/home/mahsenir/rooz-data/tokens';
const GOOGLE_CFG = '/home/mahsenir/rooz-data/google.json';   // {"client_id":"…","client_secret":"…"}
const KEY_FILE = '/home/mahsenir/rooz-data/secret.key';

function cfg(): array {
    $c = is_file(GOOGLE_CFG) ? (json_decode((string)file_get_contents(GOOGLE_CFG), true) ?: []) : [];
    if (empty($c['client_id']) || empty($c['client_secret'])) json_out(['error' => 'server not configured'], 500);
    return $c;
}
function key32(): string {
    static $k = null; if ($k !== null) return $k;
    // exclusive create: two first requests racing must not end up writing two different keys
    if (!is_file(KEY_FILE) && ($h = @fopen(KEY_FILE, 'x'))) { fwrite($h, random_bytes(32)); fclose($h); @chmod(KEY_FILE, 0600); }
    $k = (string)@file_get_contents(KEY_FILE);
    if (strlen($k) !== 32) json_out(['error' => 'server key'], 500);
    return $k;
}
function enc(string $p): string { $iv = random_bytes(12); $c = openssl_encrypt($p, 'aes-256-gcm', key32(), OPENSSL_RAW_DATA, $iv, $tag); return base64_encode($iv . $tag . $c); }
function dec(string $b): ?string { $r = base64_decode($b, true); if ($r === false || strlen($r) < 29) return null; $p = openssl_decrypt(substr($r, 28), 'aes-256-gcm', key32(), OPENSSL_RAW_DATA, substr($r, 0, 12), substr($r, 12, 16)); return $p === false ? null : $p; }
function tok_file(string $sid): string { if (!is_dir(TOK_DIR)) mkdir(TOK_DIR, 0700, true); return TOK_DIR . '/' . hash('sha256', $sid) . '.json'; }
function google(array $fields): array {
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $raw = curl_exec($ch); curl_close($ch);
    $r = json_decode(is_string($raw) ? $raw : '', true); return is_array($r) ? $r : [];
}

$d = read_json_body();
$act = is_string($d['action'] ?? null) ? $d['action'] : '';
$c = [];
if ($act === 'exchange' || $act === 'refresh') {
    if (!rate_ok('tok', 500)) json_out(['error' => 'rate'], 429);
    $c = cfg();
}
switch ($act) {
    case 'exchange':
        $code = is_string($d['code'] ?? null) ? $d['code'] : ''; if ($code === '' || strlen($code) > 2048) json_out(['error' => 'bad code'], 400);
        $r = google(['code' => $code, 'client_id' => $c['client_id'], 'client_secret' => $c['client_secret'], 'redirect_uri' => 'postmessage', 'grant_type' => 'authorization_code']);
        if (empty($r['access_token'])) json_out(['error' => is_string($r['error'] ?? null) ? $r['error'] : 'exchange failed'], 400);
        $sid = bin2hex(random_bytes(32));
        if (!empty($r['refresh_token'])) file_put_contents(tok_file($sid), json_encode(['rt' => enc($r['refresh_token']), 'created' => time(), 'used' => time()]), LOCK_EX);
        json_out(['sid' => empty($r['refresh_token']) ? null : $sid, 'access_token' => $r['access_token'], 'expires_in' => $r['expires_in'] ?? 3600]);
    case 'refresh':
        $sid = is_string($d['sid'] ?? null) ? $d['sid'] : ''; $f = tok_file($sid);
        if (!preg_match('/^[a-f0-9]{64}$/', $sid) || !is_file($f)) json_out(['error' => 'unknown session'], 401);
        $t = json_decode((string)file_get_contents($f), true); $rt = is_array($t) ? dec((string)($t['rt'] ?? '')) : null;
        if (!$rt) json_out(['error' => 'unknown session'], 401);
        $r = google(['refresh_token' => $rt, 'client_id' => $c['client_id'], 'client_secret' => $c['client_secret'], 'grant_type' => 'refresh_token']);
        if (empty($r['access_token'])) { if (($r['error'] ?? '') === 'invalid_grant') @unlink($f); json_out(['error' => $r['error'] ?? 'refresh failed'], 401); }
        @touch($f);   // mtime = last use; no rewrite (parallel refreshes from two tabs could interleave writes)
        json_out(['access_token' => $r['access_token'], 'expires_in' => $r['expires_in'] ?? 3600]);
    case 'forget': // drop an old session after re-consent (the grant itself stays valid)
        $sid = is_string($d['sid'] ?? null) ? $d['sid'] : ''; if (preg_match('/^[a-f0-9]{64}$/', $sid)) @unlink(tok_file($sid));
        json_out(['ok' => true]);
    case 'revoke':
        $sid = is_string($d['sid'] ?? null) ? $d['sid'] : ''; $f = tok_file($sid);
        if (preg_match('/^[a-f0-9]{64}$/', $sid) && is_file($f)) {
            $t = json_decode((string)file_get_contents($f), true); $rt = is_array($t) ? dec((string)($t['rt'] ?? '')) : null;
            if ($rt) { $ch = curl_init('https://oauth2.googleapis.com/revoke'); curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query(['token' => $rt]), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]); curl_exec($ch); curl_close($ch); }
            @unlink($f);
        }
        json_out(['ok' => true]);
}
json_out(['error' => 'unknown action'], 400);
