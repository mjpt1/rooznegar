<?php
// POST {endpoint, items:[{k, at, title, body}]}  -> replaces this device's upcoming reminders
// POST {endpoint, remove:true}                  -> deletes this device's data
require __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_out(['ok' => true]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);
require_origin();

$d = read_json_body();
$ep = $d['endpoint'] ?? null;
if (!valid_endpoint($ep)) json_out(['error' => 'bad endpoint'], 400);
$file = sub_file($ep);

if (!empty($d['remove'])) { with_lock($file, fn() => @unlink($file)); json_out(['ok' => true, 'removed' => true]); }

$count = with_lock($file, function () use ($file, $ep, $d) {
    $old = load_sub($file) ?? ['endpoint' => $ep, 'items' => []];
    // Keep sent/delivered per key + time. Before, "delivered" was reset to 0 on every upload, so a
    // reminder already shown could be shown again by pending.php; and a rescheduled reminder (same
    // key, new time) inherited "sent" and never fired.
    $state = [];
    foreach ($old['items'] as $it) {
        if (is_array($it) && isset($it['k'], $it['at'])) $state[$it['k'] . '@' . $it['at']] = [$it['sent'] ?? 0, $it['delivered'] ?? 0];
    }
    $now = time(); $items = []; $seen = [];
    foreach (array_slice(is_array($d['items'] ?? null) ? $d['items'] : [], 0, MAX_ITEMS) as $it) {
        if (!is_array($it) || !isset($it['k'], $it['at']) || !is_numeric($it['at']) || !is_scalar($it['k'])) continue;
        $at = (int)floor(((float)$it['at']) / 1000);           // client sends ms
        if ($at < $now - LATE_WINDOW || $at > $now + 14 * 86400) continue;
        $k = mb_substr((string)$it['k'], 0, 120);
        if (isset($seen[$k . '@' . $at])) continue;           // no duplicate notifications for duplicate items
        $seen[$k . '@' . $at] = 1;
        [$sent, $deliv] = $state[$k . '@' . $at] ?? [0, 0];
        $items[] = [
            'k' => $k, 'at' => $at,
            'title' => mb_substr(is_scalar($it['title'] ?? '') ? (string)($it['title'] ?? '') : '', 0, 140),
            'body' => mb_substr(is_scalar($it['body'] ?? '') ? (string)($it['body'] ?? '') : '', 0, 240),
            'sent' => $sent, 'delivered' => $deliv,
        ];
    }
    save_sub($file, ['endpoint' => $ep, 'items' => $items, 'updated' => $now]);
    return count($items);
});
json_out(['ok' => true, 'count' => $count]);
