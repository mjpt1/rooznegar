<?php
// Called by the service worker after a push: POST {endpoint} -> notifications to show now.
require __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_out(['ok' => true]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);
require_origin();
$d = read_json_body();
$ep = $d['endpoint'] ?? null;
if (!valid_endpoint($ep)) json_out(['error' => 'bad endpoint'], 400);
$file = sub_file($ep);

$out = with_lock($file, function () use ($file) {
    $s = load_sub($file);
    if (!$s) return [];
    $out = [];
    foreach ($s['items'] as &$it) {
        if (!empty($it['sent']) && empty($it['delivered'])) {
            $out[] = ['tag' => $it['k'], 'title' => $it['title'], 'body' => $it['body']];
            $it['delivered'] = time();
        }
    }
    unset($it);
    if ($out) save_sub($file, $s);
    return $out;
});
json_out(['items' => $out]);
