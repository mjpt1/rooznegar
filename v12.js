/* روزنگار v12 — settings follow the person, not the phone.
   A small "Rooznegar settings.json" lives in the user's own Google Drive (drive.file: only files this app
   creates). Every settings change is saved there; after a reinstall (or on a second device) it comes back
   automatically as soon as Drive is connected. */
'use strict';
const S12 = state.settings;
const SF_NAME = 'Rooznegar settings.json';
// device-only keys that must never travel between devices
const SF_SKIP = new Set(['pendingCats', 'pendingCatOrder', 'pendingOrd', 'pendingOrdTries', 'drive', 'backupId', 'backupAt', 'sfId', 'sfAt', 'sfAsked', 'customSound', 'bgImage', 'clientId']);
let devId = ''; try { devId = localStorage.getItem('rz-dev') || ''; if (!devId) { devId = uid(); localStorage.setItem('rz-dev', devId); } } catch { }

function sfData() {
  const settings = {}; for (const [k, v] of Object.entries(S12)) if (!SF_SKIP.has(k)) settings[k] = v;
  const cats = state.cats.map(c => ({ id: c.id, color: c.color, userColor: c.userColor, sound: c.sound, noCheck: c.noCheck, hidden: c.hidden }));
  const ord = {}; for (const t of state.tasks) if (t.ord != null) ord[t.gid || t.id] = t.ord;
  return { v: 1, dev: devId, settings, cats, catOrder: state.cats.map(c => c.id), ord, habits: state.habits || [], templates: state.templates || [] };
}
const sfBody = d => JSON.stringify({ ...d, dev: undefined });

/* apply a saved file onto this device */
function sfApply(d) {
  for (const [k, v] of Object.entries(d.settings || {})) if (!SF_SKIP.has(k)) S12[k] = v;
  S12.pendingCats = d.cats || []; S12.pendingCatOrder = d.catOrder || []; S12.pendingOrd = d.ord || {};
  if (!(state.habits || []).length && d.habits?.length) state.habits = d.habits;
  if (!(state.templates || []).length && d.templates?.length) state.templates = d.templates;
  sfPending();
}
// calendars and tasks arrive with the next Google sync, so their part is applied whenever they exist
function sfPending() {
  let ch = false;
  if (S12.pendingCats?.length) {
    const left = [];
    for (const p of S12.pendingCats) {
      const c = state.cats.find(x => x.id === p.id); if (!c) { left.push(p); continue; }
      for (const k of ['color', 'userColor', 'sound', 'noCheck', 'hidden']) if (p[k] !== undefined) c[k] = p[k];
      ch = true;
    }
    S12.pendingCats = left;
    if (S12.calPrefs) for (const p of state.cats) if (S12.calPrefs[p.id]) Object.assign(p, S12.calPrefs[p.id]);
  }
  if (S12.pendingCatOrder?.length && state.cats.length) {
    const pos = id => { const i = S12.pendingCatOrder.indexOf(id); return i < 0 ? 1e6 : i; };
    state.cats.sort((a, b) => pos(a.id) - pos(b.id)); ch = true;
    S12.pendingCatOrder = [];   // once only — never fight the order the user sets afterwards
  }
  const po = S12.pendingOrd; if (po && Object.keys(po).length) {
    for (const t of state.tasks) { const k = t.gid && po[t.gid] != null ? t.gid : po[t.id] != null ? t.id : null; if (k) { t.ord = po[k]; delete po[k]; ch = true; } }
  }
  return ch;
}

/* Drive file */
async function sfFind() {
  const q = encodeURIComponent(`name='${SF_NAME}' and trashed=false`);
  const j = await (await dfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,modifiedTime)`)).json();
  return j.files?.[0] || null;
}
let sfLast = '', sfTimer = 0, sfBusy = false, sfReady = false; // no upload before Drive was checked once (never overwrite saved settings with a fresh install's defaults)
async function sfUpload() {
  if (!S12.drive || sfBusy || !sfReady) return; const d = sfData(), body = sfBody(d); if (body === sfLast) return;
  sfBusy = true;
  try {
    const blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
    let f; try { f = await driveUpload(blob, SF_NAME, 'application/json', S12.sfId); }
    catch (e) { if (S12.sfId && /404/.test(e.message)) { S12.sfId = null; f = await driveUpload(blob, SF_NAME, 'application/json'); } else throw e; }
    S12.sfId = f.id; S12.sfAt = Date.now(); sfLast = body; _save12();
  } catch { } finally { sfBusy = false; }
}
// on start (and after connecting Drive): bring settings from Drive if they are newer / this is a fresh install
async function sfCheck(fresh) {
  if (!S12.drive) return;
  try {
    const f = await sfFind(); sfReady = true;
    if (!f) return sfUpload();
    const mod = Date.parse(f.modifiedTime);
    if (!fresh && S12.sfId === f.id && mod <= (S12.sfAt || 0) + 5000) return sfUpload();
    // this device has changes not uploaded yet (e.g. made offline): keep them — upload instead of overwriting
    if (!fresh && sfLast && sfBody(sfData()) !== sfLast) return sfUpload();
    const d = await (await dfetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json();
    S12.sfId = f.id;
    if (d.dev === devId) { S12.sfAt = mod; _save12(); return sfUpload(); }
    sfApply(d); S12.sfAt = mod; sfLast = sfBody(sfData()); _save12();
    applyBg?.(); try { applyMenuVis(); applyFont(); } catch { }
    render(); toast('✓ تنظیمات شما از Google Drive برگردانده شد');
  } catch { }
}

/* every save → upload the settings a few seconds later (only if something in them changed) */
// (save is a const, so watch the storage write instead)
const _save12 = save;
const _setItem12 = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) { const r = _setItem12.call(this, k, v); if (k === 'rooznegar' && S12.drive && sfReady) { clearTimeout(sfTimer); sfTimer = setTimeout(sfUpload, 4000); } return r; };

const _sync12 = syncNow;
syncNow = async function (...a) {
  const r = await _sync12(...a); let ch = sfPending();
  // task order for tasks that never came back (deleted meanwhile): stop carrying it after a few syncs
  if (S12.pendingOrd && Object.keys(S12.pendingOrd).length && (S12.pendingOrdTries = (S12.pendingOrdTries || 0) + 1) > 3) { S12.pendingOrd = {}; S12.pendingOrdTries = 0; ch = true; }
  if (ch) { _save12(); render(); }
  return r;
};

// connecting Drive (from settings or the card below) also restores
const _dc12 = driveConnect;
const _bn12 = backupNow;
backupNow = async function (...a) { const fresh = !S12.sfId; await sfCheck(fresh); return _bn12(...a); };

/* new install, connected to Google but not to Drive → offer it once, with the reason */
const sfDlg = sheet('sfDlg', `<div class="pv"><b style="font-size:18px">☁️ تنظیمات‌تان را نگه داریم؟</b>
  <p class="muted">با وصل کردن Google Drive، رنگ‌ها، صداها، ترتیب کارها، گزینه‌های تقویم‌ها، عادت‌ها و قالب‌ها در Drive خودتان ذخیره می‌شوند. اگر برنامه را پاک کنید یا روی گوشی دیگری نصب کنید، با وصل شدن همه برمی‌گردد. اگر قبلاً پشتیبانی داشته‌اید، همین الان برگردانده می‌شود.</p>
  <div class="row"><button type="button" class="primary" id="sfYes">وصل کردن Drive</button><button type="button" class="ghost" id="sfNo">بعداً</button></div></div>`);
$('#sfYes').onclick = () => { sfDlg.close(); S12.sfAsked = true; _save12(); _dc12(); };
$('#sfNo').onclick = () => { sfDlg.close(); S12.sfAsked = Date.now(); _save12(); };
function sfOffer() {
  if (S12.drive || !state.sync.linked) return;
  if (S12.sfAsked === true || (S12.sfAsked && Date.now() - S12.sfAsked < 7 * 864e5)) return;
  if (document.querySelector('dialog[open]')) return setTimeout(sfOffer, 20e3);
  sfDlg.showModal();
}
setTimeout(sfOffer, 6000);
setTimeout(() => sfCheck(!S12.sfId), 3000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sfCheck(false); });

/* ---------- one file per name in Drive: overwrite it, never pile up copies ----------
   Before creating a file, look for the ones this app already made with that name; update the newest
   and move any extra copies to the trash. Used for both the settings file and the daily backup. */
async function driveOne(name) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\'")}' and trashed=false`);
  const j = await (await dfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id)`)).json();
  const [keep, ...extra] = j.files || [];
  for (const f of extra) dfetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"trashed":true}' }).catch(() => { });
  return keep?.id || null;
}
const _du12 = driveUpload;
driveUpload = async function (blob, name, mime, fileId) {
  if (!fileId && (name === SF_NAME || name === 'Rooznegar backup.json')) {
    fileId = await driveOne(name).catch(() => null);
    if (fileId) { if (name === SF_NAME) S12.sfId = fileId; else S12.backupId = fileId; }
  }
  return _du12(blob, name, mime, fileId);
};
// clean up copies that were already made
setTimeout(() => { if (S12.drive) { driveOne(SF_NAME).catch(() => { }); driveOne('Rooznegar backup.json').catch(() => { }); } }, 20000);

/* ---------- calendar order: ▲▼ right in the menu list; the task list follows at once ---------- */
const _rc12 = renderCats;
renderCats = function () {
  _rc12();
  document.querySelectorAll('#catList .cat').forEach((el, i, all) => {
    el.querySelector('[data-editcat]')?.insertAdjacentHTML('beforebegin', `<span class="catmv"><button type="button" data-cmv="-1" ${i === 0 ? 'disabled' : ''} aria-label="بالاتر">▲</button><button type="button" data-cmv="1" ${i === all.length - 1 ? 'disabled' : ''} aria-label="پایین‌تر">▼</button></span>`);
  });
};
function moveCat(id, step) {
  const i = state.cats.findIndex(c => c.id === id), j = i + step; if (i < 0 || j < 0 || j >= state.cats.length) return;
  [state.cats[i], state.cats[j]] = [state.cats[j], state.cats[i]]; S12.pendingCatOrder = []; save(); render();
}
$('#catList').addEventListener('click', e => {
  const b = e.target.closest('[data-cmv]'); if (!b) return; e.stopPropagation();
  moveCat(b.closest('[data-cat]').dataset.cat, +b.dataset.cmv);
}, true);
// the ⬆/⬇ inside the calendar dialog also re-sorts the tasks now (it only redrew the menu before)
$('#catForm').addEventListener('click', e => { if (e.target.closest('[data-catmove]')) setTimeout(render, 0); });
render();
