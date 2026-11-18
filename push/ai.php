<?php
// Rooznegar planning assistant — one endpoint, three providers.
//   GET  ai.php                       -> {providers:[{id,name,model}], default}
//   POST {provider, prompt, context}  -> {message, tasks:[{title,date,time,duration,notes,cal}]}
// Keys live in /home/mahsenir/rooz-data/ai.json (never in the app):
// {"default":"anthropic",
//  "anthropic":{"key":"sk-ant-…","model":"claude-opus-5-5"},
//  "openai":{"key":"sk-…","model":"gpt-4.1-mini"},
//  "gapgpt":{"key":"…","model":"gpt-4o-mini","base":"https://api.gapgpt.app/v1"}}
require __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_out(['ok' => true]);
require_origin();

const AI_CFG = '/home/mahsenir/rooz-data/ai.json';
const AI_RATE_DIR = '/home/mahsenir/rooz-data/ai-rate';
const AI_DAILY_LIMIT = 40; // requests per device (IP) per day — protects the owner's bill
$NAMES = ['anthropic' => 'Claude (Anthropic)', 'openai' => 'OpenAI', 'gapgpt' => 'GapGPT'];
$cfg = is_file(AI_CFG) ? (json_decode((string)file_get_contents(AI_CFG), true) ?: []) : [];

// models a provider offers (GapGPT / OpenAI: GET {base}/models), cached for a day
function provider_models(string $prov, array $c): array {
    if (!in_array($prov, ['gapgpt', 'openai'], true) || empty($c['key'])) return [];
    $cache = '/home/mahsenir/rooz-data/models-' . $prov . '.json';
    if (is_file($cache) && filemtime($cache) > time() - 86400) { $m = json_decode((string)file_get_contents($cache), true); if (is_array($m) && $m) return $m; }
    $base = $prov === 'gapgpt' ? rtrim($c['base'] ?? 'https://api.gapgpt.app/v1', '/') : 'https://api.openai.com/v1';
    $ch = curl_init($base . '/models');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $c['key']]]);
    $r = json_decode((string)curl_exec($ch), true); curl_close($ch);
    $ids = [];
    foreach (($r['data'] ?? []) as $x) if (is_array($x) && is_string($x['id'] ?? null) && preg_match('/^[\w.:\/-]{1,100}$/', $x['id'])) $ids[] = $x['id'];
    sort($ids, SORT_NATURAL | SORT_FLAG_CASE);
    if ($ids) file_put_contents($cache, json_encode($ids));
    return $ids;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['models'])) { $p = (string)$_GET['models']; json_out(['models' => isset($NAMES[$p]) && is_array($cfg[$p] ?? null) ? provider_models($p, $cfg[$p]) : []]); }
    $list = [];
    foreach ($NAMES as $id => $n) if (!empty($cfg[$id]['key'])) $list[] = ['id' => $id, 'name' => $n, 'model' => $cfg[$id]['model'] ?? ''];
    json_out(['providers' => $list, 'default' => $cfg['default'] ?? ($list[0]['id'] ?? null)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$d = read_json_body();
$prov = is_string($d['provider'] ?? null) ? $d['provider'] : (string)($cfg['default'] ?? 'anthropic');
// only known provider ids (e.g. "default" must not be treated as a provider block)
if (!isset($NAMES[$prov]) || !is_array($cfg[$prov] ?? null) || empty($cfg[$prov]['key'])) json_out(['error' => 'این سرویس فعال نیست'], 400);
$prompt = mb_substr(trim(is_string($d['prompt'] ?? null) ? $d['prompt'] : ''), 0, 4000);
if ($prompt === '') json_out(['error' => 'متن خالی است'], 400);
// --- rate limit (atomic; only well-formed requests count) ---
// no daily cap: the app is only used by its owners
$ctx = is_array($d['context'] ?? null) ? $d['context'] : [];
$ctxJson = mb_substr((string)json_encode($ctx, JFLAGS), 0, 30000);

$system = <<<TXT
You are the planning assistant inside Rooznegar, a to-do and calendar app. The user writes in Persian or English.
Turn the user's request into concrete tasks placed on their calendar.
Rules:
- Use the context: "today" (YYYY-MM-DD), "now" (HH:MM), "tz", "weekStart", "calendars" (ids and names) and "busy" (existing timed tasks per date with start-end) — never double-book a busy slot.
- Prefer working hours 08:00-21:00 unless the user says otherwise; leave short gaps between tasks.
- Dates are Gregorian YYYY-MM-DD and times HH:MM (24h) in the user's time zone. If something has no sensible time, leave time empty (all-day).
- Pick the calendar id that fits each task from "calendars" when the names make it obvious; otherwise leave cal empty.
- Titles are short, in the user's language. Put details in notes.
- "message" is one or two friendly sentences in the user's language explaining the plan.
Return only JSON matching the schema.
TXT;
$schema = [
    'type' => 'object', 'additionalProperties' => false, 'required' => ['message', 'tasks'],
    'properties' => [
        'message' => ['type' => 'string'],
        'tasks' => ['type' => 'array', 'items' => ['type' => 'object', 'additionalProperties' => false,
            'required' => ['title', 'date', 'time', 'duration', 'notes', 'cal'],
            'properties' => ['title' => ['type' => 'string'], 'date' => ['type' => 'string'], 'time' => ['type' => 'string'],
                'duration' => ['type' => 'integer'], 'notes' => ['type' => 'string'], 'cal' => ['type' => 'string']]]],
    ],
];
$user = "Context:\n$ctxJson\n\nRequest:\n$prompt";
$mode = ($d['mode'] ?? '') === 'summary' ? 'summary' : 'plan';
if ($mode === 'summary') {
    // smart morning summary: one short, friendly notification for one day (nothing is created)
    $system = <<<TXT
You write the morning notification of Rooznegar, a to-do and calendar app, for ONE day.
It is shown on the morning of "date" itself, so always speak about it as "today" (امروز), never "tomorrow".
Context: "date", "weekday", "lang" and "items" (that day's open tasks: title, time HH:MM or empty = all-day, end, calendar, recurring).
Write in the user's language ("lang": fa = Persian, en = English), warm and practical, like a helpful friend:
- title: at most 45 characters, e.g. how many things are on today and the most important one.
- body: at most 220 characters. Mention the first timed item, anything that looks important or urgent, and the biggest free
  gap between 08:00 and 21:00. Persian text uses Persian digits. No lists; at most one emoji.
Return only JSON matching the schema.
TXT;
    $schema = ['type' => 'object', 'additionalProperties' => false, 'required' => ['title', 'body'],
        'properties' => ['title' => ['type' => 'string'], 'body' => ['type' => 'string']]];
}

function post_json(string $url, array $headers, array $body, int $timeout = 120): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JFLAGS), CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout, CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers)]);
    $raw = (string)curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $err = curl_error($ch); curl_close($ch);
    return [$code, json_decode($raw, true), $err ?: mb_substr($raw, 0, 300)];
}

$c = $cfg[$prov];
// the model the user picked in the app (only one the provider really lists)
if (is_string($d['model'] ?? null) && $d['model'] !== '' && in_array($d['model'], provider_models($prov, $c), true)) $c['model'] = $d['model'];
if ($prov === 'anthropic') {
    // Messages API (raw HTTP: shared hosting has no Composer for the PHP SDK).
    [$code, $r, $err] = post_json('https://api.anthropic.com/v1/messages',
        ['x-api-key: ' . $c['key'], 'anthropic-version: 2026-10-21', 'anthropic-beta: server-side-fallback-2026-07-01'],
        ['model' => $c['model'] ?? 'claude-opus-5-5', 'max_tokens' => 16000, 'system' => $system,
         'output_config' => ['effort' => $c['effort'] ?? 'medium', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
         'fallbacks' => 'default',
         'messages' => [['role' => 'user', 'content' => $user]]]);
    // upstream error text can echo account/key details -> server log only
    if ($code !== 200) { error_log('rooz ai anthropic ' . $code . ': ' . ($r['error']['message'] ?? $err)); json_out(['error' => 'Anthropic ' . $code], 502); }
    if (($r['stop_reason'] ?? '') === 'refusal') json_out(['error' => 'مدل این درخواست را انجام نداد'], 422);
    $text = ''; foreach ($r['content'] ?? [] as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
} else {
    // OpenAI and GapGPT (OpenAI-compatible Chat Completions)
    $base = $prov === 'gapgpt' ? rtrim($c['base'] ?? 'https://api.gapgpt.app/v1', '/') : 'https://api.openai.com/v1';
    [$code, $r, $err] = post_json($base . '/chat/completions', ['Authorization: Bearer ' . $c['key']],
        ['model' => $c['model'] ?? 'gpt-4.1-mini',
         'messages' => [['role' => 'system', 'content' => $system . "\nJSON schema:\n" . json_encode($schema)], ['role' => 'user', 'content' => $user]],
         'response_format' => ['type' => 'json_object']]);
    if ($code !== 200) { error_log('rooz ai ' . $prov . ' ' . $code . ': ' . ($r['error']['message'] ?? $err)); json_out(['error' => $NAMES[$prov] . ' ' . $code], 502); }
    $text = (string)($r['choices'][0]['message']['content'] ?? '');
}
$out = json_decode(trim(preg_replace('/^```(?:json)?|```$/m', '', $text)), true);
if ($mode === 'summary') {
    if (!is_array($out) || !is_scalar($out['title'] ?? null) || !is_scalar($out['body'] ?? null)) json_out(['error' => 'پاسخ مدل قابل خواندن نبود'], 502);
    json_out(['title' => mb_substr((string)$out['title'], 0, 60), 'body' => mb_substr((string)$out['body'], 0, 240), 'provider' => $prov]);
}
if (!is_array($out) || !isset($out['tasks'])) json_out(['error' => 'پاسخ مدل قابل خواندن نبود'], 502);
// sanitize
$tasks = [];
foreach (array_slice(is_array($out['tasks']) ? $out['tasks'] : [], 0, 40) as $t) {
    if (!is_array($t) || empty($t['title']) || !is_scalar($t['title'])) continue;
    foreach (['notes', 'cal', 'date', 'time'] as $kk) if (isset($t[$kk]) && !is_scalar($t[$kk])) $t[$kk] = '';
    $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($t['date'] ?? '')) ? $t['date'] : '';
    $time = preg_match('/^\d{2}:\d{2}$/', (string)($t['time'] ?? '')) ? $t['time'] : '';
    $tasks[] = ['title' => mb_substr((string)$t['title'], 0, 200), 'date' => $date, 'time' => $time, 'duration' => max(5, min(600, (int)($t['duration'] ?? 30))),
        'notes' => mb_substr((string)($t['notes'] ?? ''), 0, 1000), 'cal' => mb_substr((string)($t['cal'] ?? ''), 0, 200)];
}
json_out(['message' => mb_substr(is_scalar($out['message'] ?? '') ? (string)($out['message'] ?? '') : '', 0, 600), 'tasks' => $tasks, 'provider' => $prov]);
