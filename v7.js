/* روزنگار v7 — voice that works on iPhone (record → server transcription),
   settings reorganised into tabs with sections for views and assistant/voice. */
'use strict';
const S7 = state.settings;
S7.voiceMode ??= 'server'; S7.voiceLang ??= (S7.lang === 'en' ? 'en' : 'fa'); S7.voiceAuto ??= true;
S7.startView ??= 'today'; S7.hideDone ??= false;

/* ================= voice: record and transcribe on the server ================= */
const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const pickMime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
let recState = null;
async function recordVoice(btn, onText) {
  if (recState) { recState.stop(); return; } // second tap = stop
  if (S7.voiceMode === 'device' && (window.SpeechRecognition || window.webkitSpeechRecognition)) return deviceVoice(btn, onText);
  if (!canRecord) return toast('این دستگاه ضبط صدا را پشتیبانی نمی‌کند');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast('اجازه‌ی میکروفون داده نشد — در تنظیمات گوشی برای Safari اجازه بدهید'); }
  const mime = pickMime(), rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
  const t0 = Date.now(), tick = setInterval(() => { btn.dataset.t = Math.round((Date.now() - t0) / 1000); if (Date.now() - t0 > 30e3) rec.stop(); }, 250);
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    clearInterval(tick); stream.getTracks().forEach(t => t.stop()); btn.classList.remove('on'); delete btn.dataset.t; recState = null;
    if (Date.now() - t0 < 600) return;
    btn.classList.add('busy');
    try {
      const fd = new FormData(); fd.append('audio', new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }), 'voice'); fd.append('lang', S7.voiceLang);
      const j = await fetch('push/stt.php', { method: 'POST', body: fd }).then(r => r.json());
      if (!j.text) throw new Error(j.error || 'متنی شنیده نشد');
      onText(j.text);
    } catch (e) { toast('🎙 ' + e.message); }
    btn.classList.remove('busy');
  };
  rec.start(); recState = rec; btn.classList.add('on'); navigator.vibrate?.(20);
  toast('🎙 در حال ضبط… برای پایان دوباره بزنید');
}
function deviceVoice(btn, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, r = new SR();
  r.lang = S7.voiceLang === 'en' ? 'en-US' : 'fa-IR'; r.interimResults = false;
  r.onresult = e => onText([...e.results].map(x => x[0].transcript).join(' '));
  r.onerror = e => toast('🎙 ' + e.error); r.onend = () => { btn.classList.remove('on'); recState = null; };
  recState = { stop: () => r.stop() }; btn.classList.add('on'); r.start();
}
// quick-add mic (replace the old browser-only one)
document.querySelectorAll('#quickAdd .mic:not(.tplbtn):not(.aibtn)').forEach(b => b.remove());
const mic7 = h2el('<button type="button" class="mic mic7" aria-label="voice">🎙</button>');
$('#quickAdd').insertBefore(mic7, document.querySelector('#quickAdd .tplbtn'));
mic7.onclick = () => recordVoice(mic7, txt => {
  const q = $('#quickTitle'); q.value = txt;
  if (S7.voiceAuto) $('#quickAdd').requestSubmit(); else q.focus();
});
// assistant: dictate the request
const aiMic = h2el('<button type="button" class="mic mic7" aria-label="voice">🎙</button>');
$('#aiGo').before(aiMic);
aiMic.onclick = () => recordVoice(aiMic, txt => { const p = $('#aiPrompt'); p.value = (p.value ? p.value + ' ' : '') + txt; });
// task editor: dictate the title / notes
const edMic = h2el('<button type="button" class="mic mic7 sm" aria-label="voice">🎙</button>');
$('#taskForm').notes.closest('label').append(edMic);
edMic.onclick = () => recordVoice(edMic, txt => { const n = $('#taskForm').notes; n.value = (n.value ? n.value + '\n' : '') + txt; });

/* ================= settings: tabs + new sections ================= */
const sf7 = $('#setForm'), fs = [...sf7.querySelectorAll(':scope > fieldset')];
const [fsLook, fsGoogle, fsNotif, fsData] = fs;
sf7.querySelector('h2').insertAdjacentHTML('afterend', `<div class="settabs">
  <button type="button" data-st="look" class="on"><i>🎨</i>ظاهر</button><button type="button" data-st="views"><i>🗂</i>نماها</button>
  <button type="button" data-st="google"><i>☁️</i>گوگل</button><button type="button" data-st="notif"><i>🔔</i>یادآوری</button>
  <button type="button" data-st="ai"><i>✨</i>دستیار و صدا</button><button type="button" data-st="data"><i>💾</i>داده</button></div>`);
fsLook.dataset.st = 'look'; fsGoogle.dataset.st = 'google'; fsNotif.dataset.st = 'notif'; fsData.dataset.st = 'data';
fsLook.insertAdjacentHTML('afterend', `<fieldset data-st="views"><legend>نماها</legend>
  <div class="row"><label>صفحه‌ی شروع<select name="startView"><option value="today">امروز</option><option value="day">روز (ساعتی)</option><option value="week">هفته</option><option value="month">ماه</option><option value="upcoming">پیش‌رو</option></select></label>
  <label>مرتب‌سازی پیش‌فرض<select name="sortDef"><option value="time">زمان</option><option value="manual">دستی</option><option value="calendar">تقویم</option></select></label></div>
  <label class="check"><input type="checkbox" name="hideDone"> کارهای انجام‌شده را در لیست‌ها نشان نده</label>
  <div class="muted" style="font-size:12px">نمایش یا پنهان کردن هر تقویم: از منو، دکمه‌ی ● کنار اسم تقویم. تنظیمات هر تقویم: دکمه‌ی ⋯</div></fieldset>`);
fsNotif.insertAdjacentHTML('afterend', `<fieldset data-st="ai"><legend>دستیار و صدا</legend>
  <div class="row"><label>سرویس پیش‌فرض دستیار<select name="aiProvSel"><option value="">…</option></select></label></div>
  <div class="row"><label>روش تبدیل صدا به متن<select name="voiceMode"><option value="server">ضبط و تبدیل در سرور (دقیق، روی آیفون هم کار می‌کند)</option><option value="device">تشخیص گفتار خود مرورگر</option></select></label>
  <label>زبان گفتار<select name="voiceLang"><option value="fa">فارسی</option><option value="en">English</option></select></label></div>
  <label class="check"><input type="checkbox" name="voiceAuto"> بعد از گفتن، کار خودکار ساخته شود</label>
  <div class="row"><button type="button" class="ghost" id="voiceTest">🎙 آزمایش میکروفون</button><span id="voiceOut" class="muted"></span></div>
  <div class="muted" style="font-size:12px">نکته: روی آیفون همیشه می‌توانید از دکمه‌ی میکروفون کیبورد هم برای نوشتن با صدا استفاده کنید.</div></fieldset>`);
// move the bits that belong elsewhere
const sumRow = sf7.sumOn?.closest('.row'); if (sumRow) fsNotif.appendChild(sumRow);
const showTab = k => {
  sf7.querySelectorAll('.settabs button').forEach(b => b.classList.toggle('on', b.dataset.st === k));
  sf7.querySelectorAll(':scope > fieldset').forEach(f => f.style.display = f.dataset.st === k ? '' : 'none');
  sf7.scrollTop = 0; try { localStorage.setItem('rz-settab', k); } catch { }
};
sf7.querySelector('.settabs').onclick = e => { const b = e.target.closest('[data-st]'); if (b) showTab(b.dataset.st); };
$('#openSettings').addEventListener('click', async () => {
  let k = 'look'; try { k = localStorage.getItem('rz-settab') || 'look'; } catch { } showTab(k);
  sf7.startView.value = S7.startView; sf7.sortDef.value = S7.sortMode || 'time'; sf7.hideDone.checked = S7.hideDone;
  sf7.voiceMode.value = S7.voiceMode; sf7.voiceLang.value = S7.voiceLang; sf7.voiceAuto.checked = S7.voiceAuto;
  try { const j = await fetch('push/ai.php').then(r => r.json()); sf7.aiProvSel.innerHTML = (j.providers || []).map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.model)}</option>`).join('') || '<option value="">هنوز سرویسی فعال نشده</option>'; sf7.aiProvSel.value = S7.aiProv || j.default || ''; } catch { }
});
$('#setDlg').addEventListener('close', () => {
  if ($('#setDlg').returnValue !== 'ok') return;
  Object.assign(S7, { startView: sf7.startView.value, sortMode: sf7.sortDef.value, hideDone: sf7.hideDone.checked, voiceMode: sf7.voiceMode.value, voiceLang: sf7.voiceLang.value, voiceAuto: sf7.voiceAuto.checked });
  if (sf7.aiProvSel.value) S7.aiProv = sf7.aiProvSel.value;
  save(); applyHideDone(); render();
});
$('#voiceTest').onclick = function () { $('#voiceOut').textContent = '…'; recordVoice(this, t => { $('#voiceOut').textContent = '«' + t + '»'; }); };

/* hide done tasks (except in the Done view) */
function applyHideDone() { document.body.classList.toggle('hidedone', !!S7.hideDone && ui.view !== 'done'); }
const _render7 = render; render = function () { applyHideDone(); _render7(); };
/* start view */
if (S7.startView && S7.startView !== 'today' && !location.hash) { ui.view = S7.startView; render(); }

/* ================= new tasks in manual order: slot them in by time, not at the very end ================= */
function slotNew(t) {
  if (t.ord != null || !t.date) return;
  const same = state.tasks.filter(x => x !== t && x.ord != null && occursOn(x, t.date)).sort((a, b) => a.ord - b.ord);
  if (!same.length) { t.ord = 0; return; }
  const key = x => x.time ? t2m(x.time) : -1; // all-day first, then by time
  const after = same.filter(x => key(x) <= key(t)), before = same.filter(x => key(x) > key(t));
  const lo = after.length ? Math.max(...after.map(x => x.ord)) : Math.min(...same.map(x => x.ord)) - 1;
  const hi = before.length ? Math.min(...before.filter(x => x.ord > lo).map(x => x.ord).concat([lo + 2])) : lo + 2;
  t.ord = (lo + hi) / 2;
}
const _commit7 = commit;
commit = function () { for (const t of state.tasks) if (t.ord == null && Date.now() - (t.created || 0) < 10000) slotNew(t); _commit7(); };
// any task without a manual position sorts by time among the others instead of falling to the bottom
const _sortItems7 = sortItems;
sortItems = function (arr, d) {
  if ((state.settings.sortMode || 'time') !== 'manual') return _sortItems7(arr, d);
  for (const t of arr) if (t.ord == null) slotNew(t);
  return _sortItems7(arr, d);
};

/* ================= spoken text → what the quick-add parser understands ================= */
// «فردا، ساعت پنج و نیم عصر» → «فردا ساعت 5:30 عصر»
const NUMW = { 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20, 'بیست و یک': 21, 'بیست و دو': 22, 'بیست و سه': 23 };
function normSpoken(s) {
  // collapse punctuation and whitespace first, so the patterns below can use single spaces
  s = ' ' + String(s).replace(/[،,.!?؟؛;]+/g, ' ').replace(/[\s‌]+/g, ' ').trim() + ' ';
  const words = Object.keys(NUMW).sort((a, b) => b.length - a.length).join('|');
  const timeRe = new RegExp('ساعت (' + words + '|[0-9۰-۹]{1,2})( و (نیم|ربع|سی|پانزده|چهل و پنج))?( دقیقه)?', 'g');
  s = s.replace(timeRe, (_, h, __, m) => {
    const hh = NUMW[h] ?? +String(h).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const mm = { 'نیم': 30, 'سی': 30, 'ربع': 15, 'پانزده': 15, 'چهل و پنج': 45 }[m] ?? 0;
    return 'ساعت ' + hh + (mm ? ':' + String(mm).padStart(2, '0') : '');
  });
  s = s.replace(new RegExp(' (' + words + ') روز دیگه?', 'g'), (_, w) => ' ' + NUMW[w] + ' روز دیگه');
  return s.trim();
}
if (HOOK.parseQuick) { const _pq = HOOK.parseQuick; HOOK.parseQuick = raw => _pq(normSpoken(raw)); }

/* ================= the top quick-add bar is hidden; assistant & templates live in the menu ================= */
(() => {
  const nav = $('#views'); if (!nav || nav.querySelector('[data-open=ai]')) return;
  nav.insertAdjacentHTML('beforeend', '<button type="button" data-open="ai">✨ دستیار هوشمند</button><button type="button" data-open="tpl">📋 قالب‌ها</button>');
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    e.stopPropagation(); document.querySelector('.side')?.classList.remove('open');
    (b.dataset.open === 'ai' ? document.querySelector('.aibtn') : document.querySelector('.tplbtn'))?.click();
  }, true);
})();
