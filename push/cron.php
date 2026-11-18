<?php
// Run every minute by cron (CLI only):  php /home/mahsenir/rooz.mahsen81.ir/push/cron.php
// Marks due reminders as sent and wakes the device with a push.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/lib.php';

// never run two passes at once (slow push services + a 1-minute schedule = overlap = double pushes)
$cronLock = fopen(dirname(DATA_DIR) . '/cron.lock', 'c');
if (!$cronLock || !flock($cronLock, LOCK_EX | LOCK_NB)) exit;

$now = time(); $pushed = 0; $gone = 0;
foreach (glob(DATA_DIR . '/*.json') ?: [] as $file) {
    // Phase 1 (locked): mark due items as sent and save BEFORE the slow network call, so the
    // woken service worker's pending.php sees them and no concurrent upload overwrites the marks.
    $ep = with_lock($file, function () use ($file, $now) {
        $s = load_sub($file);
        if (!$s || !valid_endpoint($s['endpoint'] ?? null)) { @unlink($file); return null; }
        if (($s['updated'] ?? 0) < $now - 30 * 86400) { @unlink($file); return null; }   // device gone quiet for 30 days
        $due = false;
        foreach ($s['items'] as &$it) {
            if (empty($it['sent']) && $it['at'] <= $now && $it['at'] > $now - LATE_WINDOW) { $it['sent'] = $now; $due = true; }
        }
        unset($it);
        $s['items'] = array_values(array_filter($s['items'], fn($it) => $it['at'] > $now - 86400));
        save_sub($file, $s);
        return $due ? $s['endpoint'] : null;
    });
    if ($ep === null) continue;
    // Phase 2 (unlocked): wake the device.
    try { $code = send_push($ep); } catch (Throwable $e) { error_log('rooz push: ' . $e->getMessage()); continue; }
    if ($code === 404 || $code === 410) { with_lock($file, fn() => @unlink($file)); $gone++; continue; }
    if ($code >= 200 && $code < 300) $pushed++; else error_log("rooz push: HTTP $code");
}
// housekeeping: orphaned temp/lock files
foreach (glob(DATA_DIR . '/*.tmp') ?: [] as $t) if (filemtime($t) < $now - 3600) @unlink($t);
foreach (glob(DATA_DIR . '/*.lock') ?: [] as $l) if (!is_file(substr($l, 0, -5)) && filemtime($l) < $now - 3600) @unlink($l);
echo date('c') . " pushed=$pushed gone=$gone\n";
