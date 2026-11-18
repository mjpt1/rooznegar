<?php
// Speech-to-text for voice input: the app records audio (works on iPhone too) and we
// transcribe it with Whisper through GapGPT or OpenAI (whichever key is configured).
// POST multipart: audio=<file>, lang=fa|en  ->  {text}
require __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') json_out(['ok' => true]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);
require_origin();

$cfg = json_decode((string)@file_get_contents('/home/mahsenir/rooz-data/ai.json'), true) ?: [];
$prov = !empty($cfg['gapgpt']['key']) ? 'gapgpt' : (!empty($cfg['openai']['key']) ? 'openai' : null);
if (!$prov) json_out(['error' => 'سرویس تبدیل صدا فعال نیست'], 400);

$f = $_FILES['audio'] ?? null;
if (!is_array($f) || !is_string($f['tmp_name'] ?? null) || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) json_out(['error' => 'صدا دریافت نشد'], 400);
if ($f['size'] > 10 * 1024 * 1024) json_out(['error' => 'فایل صدا بزرگ است'], 400);
$mime = mime_content_type($f['tmp_name']) ?: 'audio/mp4';
if (!preg_match('#^(audio|video)/[\w.+-]+$|^application/octet-stream$#', $mime)) json_out(['error' => 'فرمت صدا پشتیبانی نمی‌شود'], 400);
if (str_starts_with($mime, 'video/')) $mime = 'audio/' . substr($mime, 6);   // iOS m4a/mp4 is sniffed as video/mp4
// rate limit: 120 clips per device per day (atomic, only valid uploads count)
if (!rate_ok('stt', 120)) json_out(['error' => 'سقف استفاده‌ی امروز تمام شد'], 429);
$ext = str_contains($mime, 'webm') ? 'webm' : (str_contains($mime, 'ogg') ? 'ogg' : (str_contains($mime, 'wav') ? 'wav' : (str_contains($mime, 'mpeg') ? 'mp3' : 'm4a')));
$lang = in_array($_POST['lang'] ?? 'fa', ['fa', 'en'], true) ? (string)$_POST['lang'] : 'fa';

$base = $prov === 'gapgpt' ? rtrim($cfg['gapgpt']['base'] ?? 'https://api.gapgpt.app/v1', '/') : 'https://api.openai.com/v1';
$ch = curl_init($base . '/audio/transcriptions');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg[$prov]['key']],
    CURLOPT_POSTFIELDS => ['model' => $cfg[$prov]['stt_model'] ?? 'whisper-1', 'language' => $lang,
        'prompt' => $lang === 'fa' ? 'یادداشت کار و تقویم: فردا، ساعت، جلسه، دکتر، خرید' : 'Task and calendar note',
        'file' => new CURLFile($f['tmp_name'], $mime, 'voice.' . $ext)]]);
$raw = (string)curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
$r = json_decode($raw, true);
if ($code !== 200 || !isset($r['text'])) json_out(['error' => 'تبدیل صدا انجام نشد (' . $code . ')'], 502);
json_out(['text' => mb_substr(trim((string)preg_replace('/[.。]+$/u', '', (string)$r['text'])), 0, 2000)]);
