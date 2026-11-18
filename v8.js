/* روزنگار v8 — تاریخچه‌ی تغییرات و برگرداندن (undo)
   Every change to a task (date, time, title, done, calendar, delete…) is recorded on this device
   with the values BEFORE the change, so any change — or a whole batch — can be undone. */
'use strict';
state.history ??= [];
const H_MAX = 400;                       // keep the last 400 changes
const H_FIELDS = ['title', 'date', 'time', 'duration', 'notes', 'cat', 'done', 'doneDates', 'rec', 'exdates', 'exPush', 'reminders', 'prio', 'tags', 'link', 'subs', 'color', 'countdown', 'nag', 'atts'];
const snapOf = t => { const o = {}; for (const k of H_FIELDS) o[k] = t[k] === undefined ? undefined : structuredClone(t[k]); return o; };
let hLast = new Map(state.tasks.map(t => [t.id, JSON.stringify(snapOf(t))]));
let hBatch = 0;

// Compare every task with its last known state after each commit; record what changed.
function recordChanges() {
  const now = Date.now(), seen = new Set(), batch = ++hBatch, entries = [];
  for (const t of state.tasks) {
    if (/^(period|hb)-/.test(String(t.id))) continue;
    seen.add(t.id);
    const cur = JSON.stringify(snapOf(t)), prev = hLast.get(t.id);
    if (prev === undefined) { if (Date.now() - (t.created || 0) < 15000) entries.push({ at: now, b: batch, id: t.id, kind: 'add', title: t.title, before: null }); }
    else if (prev !== cur) {
      const before = JSON.parse(prev), after = JSON.parse(cur), changed = H_FIELDS.filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      entries.push({ at: now, b: batch, id: t.id, kind: 'edit', title: t.title, before, fields: changed });
    }
    hLast.set(t.id, cur);
  }
  for (const [id, prev] of hLast) if (!seen.has(id)) {           // deleted (keep the full task to restore)
    const full = hDeleted.get(id);
    entries.push({ at: now, b: batch, id, kind: 'del', title: JSON.parse(prev).title, before: JSON.parse(prev), full });
    hLast.delete(id); hDeleted.delete(id);
  }
  // remote edits from Google sync are not "my" changes: don't record them (they're marked not dirty)
  const mine = entries.filter(e => e.kind !== 'edit' || state.tasks.find(t => t.id === e.id)?.dirty || e.kind === 'del');
  if (mine.length) { state.history.push(...mine); if (state.history.length > H_MAX) state.history.splice(0, state.history.length - H_MAX); }
}
// remember full task objects right before they disappear so a delete can be undone completely
const hDeleted = new Map();
const _filterHook = () => { for (const t of state.tasks) hDeleted.set(t.id, structuredClone(t)); };
const _commit8 = commit;
commit = function () { recordChanges(); _commit8(); _filterHook(); hUI(); };
// after a sync pull, refresh the baseline silently (Google's changes are not undo-able here)
const _sync8 = syncNow;
syncNow = async function (...a) { const r = await _sync8(...a); for (const t of state.tasks) hLast.set(t.id, JSON.stringify(snapOf(t))); _filterHook(); return r; };
_filterHook();

/* ---------- undo ---------- */
function undoEntry(e) {
  if (e.kind === 'add') {
    const t = state.tasks.find(x => x.id === e.id); if (!t) return false;
    if (t.gid && typeof targetCal === 'function' && targetCal(t)) state.sync.deleted.push({ cal: t.cal || 'primary', gid: t.gid });
    state.tasks = state.tasks.filter(x => x !== t); return true;
  }
  if (e.kind === 'del') {
    if (state.tasks.some(x => x.id === e.id)) return false;
    const t = e.full ? structuredClone(e.full) : { id: e.id, ...e.before };
    // the Google event was deleted: create it again as a new event
    delete t.gid; delete t.gUpdated; t.dirty = true; t.created = Date.now();
    state.sync.deleted = (state.sync.deleted || []).filter(d => !(e.full?.gid && d.gid === e.full.gid));
    state.tasks.push(t); return true;
  }
  const t = state.tasks.find(x => x.id === e.id); if (!t) return false;
  for (const k of (e.fields || H_FIELDS)) { if (e.before[k] === undefined) delete t[k]; else t[k] = structuredClone(e.before[k]); }
  t.dirty = true; t.updated = Date.now(); return true;
}
function undo(entries) {
  undoBar.hidden = true; clearTimeout(undoTimer);
  let n = 0;
  for (const e of [...entries].reverse()) if (undoEntry(e)) n++;
  const ids = new Set(entries); state.history = state.history.filter(x => !ids.has(x));
  // don't record the undo itself as a new change
  _commit8(); for (const t of state.tasks) hLast.set(t.id, JSON.stringify(snapOf(t))); _filterHook(); hUI();
  toast('↩︎ ' + faNum(n) + ' تغییر برگشت');
}

/* ---------- UI: undo button after a change + history view ---------- */
const undoBar = h2el('<div id="undoBar" hidden><span id="undoText"></span><button type="button" id="undoBtn">↩︎ برگرداندن</button></div>');
document.body.appendChild(undoBar);
let undoTimer;
function hUI() {
  const last = state.history[state.history.length - 1];
  if (!last || Date.now() - last.at > 3000) return;
  const batch = state.history.filter(e => e.b === last.b && e.at === last.at);
  const kinds = { add: 'اضافه شد', edit: 'تغییر کرد', del: 'حذف شد' };
  $('#undoText').textContent = batch.length > 1 ? `${faNum(batch.length)} کار ${kinds[last.kind] || 'تغییر کرد'}` : `«${(last.title || '').slice(0, 24)}» ${kinds[last.kind]}`;
  undoBar.hidden = false; clearTimeout(undoTimer); undoTimer = setTimeout(() => undoBar.hidden = true, 6000);
  $('#undoBtn').onclick = () => { undoBar.hidden = true; undo(batch); };
}
$('[data-view=stats]').insertAdjacentHTML('afterend', '<button data-view="history">📜 تاریخچه</button>');
const FIELD_FA = { title: 'عنوان', date: 'تاریخ', time: 'ساعت', duration: 'مدت', notes: 'یادداشت', cat: 'تقویم', done: 'انجام', doneDates: 'تیک روزها', rec: 'تکرار', exdates: 'استثنای تکرار', exPush: 'استثنای تکرار', reminders: 'یادآوری', prio: 'اولویت', tags: 'برچسب', link: 'لینک', subs: 'زیرکار', color: 'رنگ', countdown: 'شمارش معکوس', nag: 'تکرار یادآوری', atts: 'پیوست' };
EXTRA.history = () => {
  const list = [...state.history].reverse();
  if (!list.length) return '<div class="empty"><b>📜</b>هنوز تغییری ثبت نشده. از این به بعد هر تغییر (جابه‌جایی، ویرایش، حذف، تیک) این‌جا می‌آید و قابل برگرداندن است.</div>';
  // group by batch
  const groups = []; for (const e of list) { const g = groups[groups.length - 1]; if (g && g[0].b === e.b && g[0].at === e.at) g.push(e); else groups.push([e]); }
  const fmtT = at => new Date(at).toLocaleString(state.settings.lang === 'en' ? 'en-CA' : 'fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  const desc = e => {
    if (e.kind === 'add') return 'اضافه شد';
    if (e.kind === 'del') return 'حذف شد' + (e.before?.date ? ' (' + fmtDate(e.before.date, { day: 'numeric', month: 'short' }) + ')' : '');
    const t = state.tasks.find(x => x.id === e.id);
    return (e.fields || []).map(k => k === 'date' ? `تاریخ: ${e.before.date ? fmtDate(e.before.date, { day: 'numeric', month: 'short' }) : '—'} ← ${t?.date ? fmtDate(t.date, { day: 'numeric', month: 'short' }) : '—'}`
      : k === 'time' ? `ساعت: ${e.before.time ? faNum(e.before.time) : 'تمام روز'} ← ${t?.time ? faNum(t.time) : 'تمام روز'}`
      : k === 'done' ? (t?.done ? 'تیک خورد' : 'تیک برداشته شد') : FIELD_FA[k] || k).join(' · ');
  };
  return `<p class="muted" style="font-size:13px">آخرین ${faNum(state.history.length)} تغییر روی همین دستگاه. با «برگرداندن» حالت قبل از آن تغییر برمی‌گردد و در Google Calendar هم اعمال می‌شود.</p>`
    + groups.slice(0, 120).map((g, gi) => `<div class="hist">
      <div class="hist-h"><span>${fmtT(g[0].at)}${g.length > 1 ? ` · <b>${faNum(g.length)} کار با هم</b>` : ''}</span><button class="ghost" data-hundo="${gi}">↩︎ برگرداندن${g.length > 1 ? ' همه' : ''}</button></div>
      ${g.slice(0, 8).map(e => `<div class="hist-r"><b class="uc">${esc(e.title || '')}</b><small>${desc(e)}</small></div>`).join('')}${g.length > 8 ? `<small class="muted">و ${faNum(g.length - 8)} کار دیگر…</small>` : ''}</div>`).join('');
};
$('#content').addEventListener('click', e => {
  const b = e.target.closest('[data-hundo]'); if (!b) return; e.stopPropagation();
  const list = [...state.history].reverse(), groups = []; for (const x of list) { const g = groups[groups.length - 1]; if (g && g[0].b === x.b && g[0].at === x.at) g.push(x); else groups.push([x]); }
  const g = groups[+b.dataset.hundo]; if (!g) return;
  if (g.length > 1 && !confirm(faNum(g.length) + ' تغییر برگردانده شود؟')) return;
  undo(g); render();
}, true);
const _render8 = render; render = function () { _render8(); if (ui.view === 'history' && !ui.q) $('#viewTitle').textContent = 'تاریخچه'; };
