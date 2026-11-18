/* روزنگار v5 — batch 3: send a task by link, 
   Google Drive backup + attachments (drive.file scope: only files this app creates). */
'use strict';
const S5 = state.settings;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const b64uEnc = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

/* ================= send a task to someone (link) ================= */
const shareBtn = h2el('<button class="ghost" data-pv="share">📤 ارسال</button>');
pv.querySelector('[data-pv=edit]').before(shareBtn);
pv.addEventListener('click', async e => {
  if (e.target.closest('[data-pv]')?.dataset.pv !== 'share') return;
  const t = pvTask, d = { title: t.title, date: pvDay || t.date, time: t.time, duration: t.duration, notes: t.notes, link: t.link, tags: t.tags, subs: (t.subs || []).map(s => s.t), rec: t.rec?.freq ? t.rec : undefined };
  const url = location.origin + '/#add=' + b64uEnc(JSON.stringify(d));
  try { if (navigator.share) await navigator.share({ title: t.title, text: '📅 ' + t.title, url }); else { await navigator.clipboard.writeText(url); toast('لینک کپی شد'); } } catch { }
});
// opening a shared link
const inbox = sheet('inboxDlg', `<div class="pv"><div class="pv-head"><span class="pv-dot" style="background:var(--accent)"></span><h2 id="inTitle"></h2></div>
  <div class="muted">این کار برای شما فرستاده شده است:</div><div id="inBody"></div>
  <label>تقویم<select id="inCal"></select></label>
  <div class="pv-actions"><button class="ghost" data-in="no">نه</button><button class="primary" data-in="add">＋ افزودن به کارهای من</button></div></div>`);
let inTask = null;
function checkInbox() {
  if (!location.hash.startsWith('#add=')) return;
  try { inTask = JSON.parse(b64uDec(location.hash.slice(5))); } catch { return; }
  history.replaceState(null, '', location.pathname);
  $('#inTitle').textContent = inTask.title;
  $('#inBody').innerHTML = `<div class="pv-row"><span class="pv-i">📅</span><div>${inTask.date ? fmtDual(inTask.date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'بدون تاریخ'}<br>${inTask.time ? faNum(inTask.time) : '☀️ تمام روز'}</div></div>`
    + (inTask.notes ? `<div class="pv-row"><span class="pv-i">📝</span><div class="uc pv-notes">${esc(inTask.notes)}</div></div>` : '')
    + (inTask.subs?.length ? `<div class="pv-row"><span class="pv-i">☑️</span><div class="uc">${inTask.subs.map(esc).join('<br>')}</div></div>` : '');
  $('#inCal').innerHTML = state.cats.filter(c => !c.ro && !c.local).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#inCal').value = S5.defaultCal || state.cats.find(c => c.gcal === 'primary')?.id || '';
  setTimeout(() => inbox.showModal(), 400);
}
checkInbox(); addEventListener('hashchange', checkInbox);
inbox.addEventListener('click', e => {
  const a = e.target.closest('[data-in]')?.dataset.in; if (!a) return; inbox.close();
  if (a !== 'add' || !inTask) return;
  const d = inTask; state.tasks.push({ id: uid(), title: String(d.title || '').slice(0, 300), date: d.date || '', time: d.time || '', duration: +d.duration || 30, notes: String(d.notes || '').slice(0, 4000), link: /^https?:\/\//.test(d.link || '') ? d.link : '',
    tags: (d.tags || []).slice(0, 20).map(String), subs: (d.subs || []).slice(0, 50).map(t => ({ t: String(t), done: false })), rec: d.rec?.freq ? { freq: d.rec.freq, interval: +d.rec.interval || 1, days: d.rec.days || [], until: d.rec.until || '' } : {},
    cat: $('#inCal').value, reminders: d.time ? [10] : [-540], created: Date.now(), dirty: true });
  commit(); toast('اضافه شد');
});

/* lock removed — clear any old setting so the lock screen can never appear */
delete state.settings.lock; save();

/* ================= Google Drive: backup & attachments ================= */
async function driveConnect() {
  // ask Google once more, now including Drive (only files Rooznegar creates)
  google.accounts.oauth2.initCodeClient({ client_id: state.settings.clientId, scope: G_SCOPES + ' ' + DRIVE_SCOPE, ux_mode: 'popup', include_granted_scopes: true,
    callback: async r => {
      if (!r.code) return toast('لغو شد');
      const j = await fetch('push/token.php', { method: 'POST', body: JSON.stringify({ action: 'exchange', code: r.code }) }).then(x => x.json()).catch(() => ({}));
      if (!j.access_token) return toast('خطا: ' + (j.error || ''));
      if (state.sync.sid && j.sid && j.sid !== state.sync.sid) fetch('push/token.php', { method: 'POST', body: JSON.stringify({ action: 'forget', sid: state.sync.sid }) }).catch(() => { });
      state.sync.token = { v: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1e3 }; if (j.sid) state.sync.sid = j.sid;
      state.sync.linked = true; S5.drive = true; save(); toast('✓ Google Drive وصل شد'); driveUI(); backupNow();
    } }).requestCode();
}
async function dfetch(url, opt = {}) {
  if (!(await ensureToken())) throw new Error('auth');
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + state.sync.token.v, ...(opt.headers || {}) } });
  if (r.status === 401 || r.status === 403) { const t = await r.text(); if (/insufficient|scope|PERMISSION/i.test(t)) { S5.drive = false; save(); driveUI(); } throw new Error(r.status + ''); }
  if (!r.ok) throw new Error(r.status + ' ' + await r.text());
  return r;
}
async function driveUpload(blob, name, mime, fileId) {
  const meta = fileId ? {} : { name, mimeType: mime };
  const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' })); fd.append('file', blob);
  const url = 'https://www.googleapis.com/upload/drive/v3/files' + (fileId ? '/' + fileId : '') + '?uploadType=multipart&fields=id,name,mimeType,webViewLink,iconLink';
  return (await dfetch(url, { method: fileId ? 'PATCH' : 'POST', body: fd })).json();
}
function backupData() { const s = { ...state.settings }; delete s.customSound; delete s.bgImage; return JSON.stringify({ v: 1, at: new Date().toISOString(), tasks: state.tasks.filter(t => !t.period), cats: state.cats, habits: state.habits, templates: state.templates, log: state.log, settings: s }); }
async function backupNow(manual) {
  if (!S5.drive) return;
  try {
    let f;
    try { f = await driveUpload(new Blob([backupData()], { type: 'application/json' }), 'Rooznegar backup.json', 'application/json', S5.backupId); }
    catch (e) { if (S5.backupId && /404/.test(e.message)) { S5.backupId = null; f = await driveUpload(new Blob([backupData()], { type: 'application/json' }), 'Rooznegar backup.json', 'application/json'); } else throw e; }
    S5.backupId = f.id; S5.backupAt = Date.now(); save(); driveUI(); if (manual) toast('✓ پشتیبان در Google Drive ذخیره شد');
  } catch (e) { if (manual) toast('پشتیبان‌گیری نشد: ' + e.message); }
}
async function restoreNow() {
  if (!S5.backupId) return toast('هنوز پشتیبانی ندارید');
  if (!confirm('کارها و تنظیمات این دستگاه با نسخه‌ی پشتیبان جایگزین شود؟')) return;
  try {
    const d = await (await dfetch(`https://www.googleapis.com/drive/v3/files/${S5.backupId}?alt=media`)).json();
    Object.assign(state, { tasks: d.tasks || [], cats: d.cats || state.cats, habits: d.habits || [], templates: d.templates || [], log: d.log || [] });
    save(); render(); toast('✓ بازیابی شد');
  } catch (e) { toast('بازیابی نشد: ' + e.message); }
}
// daily automatic backup while the app is open
setInterval(() => { if (S5.drive && Date.now() - (S5.backupAt || 0) > 24 * 3600e3) backupNow(); }, 10 * 60e3);
setTimeout(() => { if (S5.drive && Date.now() - (S5.backupAt || 0) > 24 * 3600e3) backupNow(); }, 15e3);

// settings section
$('#exportBtn').closest('fieldset').insertAdjacentHTML('beforeend', `<div class="drivebox"><b>☁️ Google Drive</b><small id="driveState" class="muted"></small>
  <div class="row"><button type="button" class="ghost" id="driveBtn"></button><button type="button" class="ghost" id="backupBtn">پشتیبان‌گیری الان</button><button type="button" class="ghost" id="restoreBtn">بازیابی</button></div></div>`);
function driveUI() {
  $('#driveBtn').textContent = S5.drive ? 'قطع Drive' : 'اتصال Google Drive';
  $('#backupBtn').style.display = $('#restoreBtn').style.display = S5.drive ? '' : 'none';
  $('#driveState').textContent = S5.drive ? (S5.backupAt ? 'آخرین پشتیبان: ' + new Date(S5.backupAt).toLocaleString(S5.lang === 'en' ? 'en-CA' : 'fa-IR') : 'هنوز پشتیبانی گرفته نشده') + ' — هر روز خودکار' : 'پشتیبان خودکار روزانه و پیوست عکس/فایل به کارها';
}
$('#openSettings').addEventListener('click', driveUI);
$('#driveBtn').onclick = () => { if (S5.drive) { S5.drive = false; save(); driveUI(); } else driveConnect(); };
$('#backupBtn').onclick = () => backupNow(true);
$('#restoreBtn').onclick = restoreNow;

/* ---------- attachments (photos / files) ---------- */
$('#taskForm').link.closest('label').insertAdjacentHTML('afterend', `<div class="atts"><div id="attList"></div><label class="ghost filebtn">📎 پیوست عکس یا فایل<input type="file" id="attFile" multiple hidden></label></div>`);
let atts = [];
function drawAtts() { $('#attList').innerHTML = atts.map((a, i) => `<span class="att"><a href="${esc(a.link)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a><button type="button" class="icon" data-attdel="${i}">✕</button></span>`).join(''); }
const _openTask5 = openTask; openTask = function (t, p) { _openTask5(t, p); atts = structuredClone(t?.atts || []); drawAtts(); };
$('#attList').onclick = e => { const d = e.target.closest('[data-attdel]'); if (d) { atts.splice(+d.dataset.attdel, 1); drawAtts(); } };
$('#attFile').onchange = async e => {
  if (!S5.drive) { toast('برای پیوست، اول Google Drive را در تنظیمات وصل کنید'); e.target.value = ''; return; }
  for (const f of e.target.files) {
    if (f.size > 25 * 1024 * 1024) { toast(f.name + ': بزرگ‌تر از ۲۵ مگابایت'); continue; }
    toast('در حال آپلود ' + f.name + '…');
    try { const r = await driveUpload(f, f.name, f.type || 'application/octet-stream'); atts.push({ id: r.id, name: r.name, mime: r.mimeType, link: r.webViewLink }); drawAtts(); }
    catch (err) { toast('آپلود نشد: ' + err.message); }
  }
  e.target.value = '';
};
$('#taskDlg').addEventListener('close', () => { if ($('#taskDlg').returnValue !== 'ok') return; const t = editing || state.tasks[state.tasks.length - 1]; if (t && JSON.stringify(t.atts || []) !== JSON.stringify(atts)) { t.atts = atts; t.dirty = true; save(); schedulePush(); } });
// preview shows attachments
const _openPreview5 = openPreview;
openPreview = function (t, d) { _openPreview5(t, d); if (t.atts?.length) $('#pvBody').insertAdjacentHTML('beforeend', `<div class="pv-row"><span class="pv-i">📎</span><div>${t.atts.map(a => `<a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join('<br>')}</div></div>`); };
// attachments travel with the Google Calendar event
const _toEvent = toEvent; toEvent = function (t) { const ev = _toEvent(t); if (t.atts?.length) ev.attachments = t.atts.map(a => ({ fileUrl: a.link, title: a.name, mimeType: a.mime, fileId: a.id })); else if (t.atts) ev.attachments = []; return ev; };
const _fromEvent = fromEvent; fromEvent = function (ev, t) { _fromEvent(ev, t); if (ev.attachments) t.atts = ev.attachments.map(a => ({ id: a.fileId, name: a.title, mime: a.mimeType, link: a.fileUrl })); };
const _gapi = gapi; gapi = function (path, opt) { if (/\/events(\/[^/?]+)?$/.test(path) && opt && /POST|PATCH/.test(opt.method || '')) path += '?supportsAttachments=true'; return _gapi(path, opt); };
