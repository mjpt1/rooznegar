/* روزنگار v11 — per-calendar options that survive sync, Google-like default reminders,
   end time on tasks, icon-only all-day/recurring, tap the title → date picker (month/year). */
'use strict';
const S11 = state.settings;

/* ---------- 1. calendar options (not checkable / hidden / own colour) never get lost ----------
   Kept in settings by calendar id too, so a calendar that is re-created by a sync (or after
   reconnecting Google) gets its options back. */
S11.calPrefs ??= {};
const CP_KEYS = ['noCheck', 'hidden'];
function rememberCatPrefs() { for (const c of state.cats) { const p = {}; for (const k of CP_KEYS) if (c[k] !== undefined) p[k] = c[k]; if (Object.keys(p).length) S11.calPrefs[c.id] = p; } }
function restoreCatPrefs() { let ch = false; for (const c of state.cats) { const p = S11.calPrefs[c.id]; if (p) for (const k of CP_KEYS) if (p[k] !== undefined && c[k] !== p[k]) { c[k] = p[k]; ch = true; } } return ch; }
restoreCatPrefs(); rememberCatPrefs();
$('#catDlg').addEventListener('close', () => { if ($('#catDlg').returnValue === 'ok') { rememberCatPrefs(); save(); } });

/* ---------- 2. reminders like Google: an event that uses the calendar's defaults gets the
   calendar's default reminders (shared/shift calendars usually have none → no notification) ---------- */
const _sync11 = syncNow;
syncNow = async function (...a) {
  const r = await _sync11(...a);
  let ch = restoreCatPrefs();
  for (const t of state.tasks) {
    if (!t.gid || t.dirty) continue;
    const c = state.cats.find(x => x.id === t.cat) || state.cats.find(x => x.gcal === (t.cal || 'primary'));
    if (!c || !c.defRem) continue;
    // remDef: event says "use calendar default"; the old code gave such events a 10-minute reminder
    if (t.remDef || (c.ro && JSON.stringify(t.reminders) === '[10]' && !t.remMine)) {
      const want = t.time ? c.defRem : [];
      if (JSON.stringify(t.reminders || []) !== JSON.stringify(want)) { t.reminders = [...want]; ch = true; }
      t.remDef = true;
    }
  }
  if (ch) { save(); render(); }
  return r;
};
// editing a task's reminders by hand makes them "mine" (never overwritten by the calendar default)
const _commit11 = commit;
commit = function () { for (const t of state.tasks) if (t.dirty && t.remDef) { t.remDef = false; t.remMine = true; } _commit11(); };

/* ---------- 3. if the device storage is full, make room (history) instead of silently losing changes ---------- */
const _setItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
  try { return _setItem.call(this, k, v); }
  catch (e) {
    if (k !== 'rooznegar' || !state.history?.length) throw e;
    const n = Math.ceil(state.history.length * 0.6);
    state.history.splice(0, n);
    setTimeout(() => toast(`حافظه‌ی گوشی پر بود؛ ${faNum(n)} مورد قدیمی از تاریخچه پاک شد تا تغییرات شما ذخیره شود`), 0);
    for (const t of state.tasks) delete t.instCache;
    return _setItem.call(this, k, JSON.stringify(state));
  }
};

/* ---------- 4. task line: start–end time, ☀️ / 🔁 as icons only ---------- */
const _taskHTML11 = taskHTML;
const endOf = t => { const m = t2m(t.time) + (+t.duration || 30); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
taskHTML = function (t, d) {
  let h = _taskHTML11(t, d);
  if (t.time) h = h.replace('🕒 ' + faNum(t.time), '🕒 ' + faNum(t.time) + '–' + faNum(endOf(t)));
  h = h.replace(/☀️ (تمام روز|All day)/, '<span title="تمام روز">☀️</span>');
  h = h.replace(/🔁 (روزانه|هفتگی|ماهانه|سالانه|Daily|Weekly|Monthly|Yearly)/, '<span title="تکرارشونده">🔁</span>');
  return h;
};

/* ---------- 5. tap the title → a month calendar to jump to any day; "امروز" brings you back ---------- */
ui.pick = null;                                   // the day being shown (null = normal views)
const calFmt = (cal, o) => new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', o);
const partsOf = (dt, cal) => { const p = {}; for (const x of calFmt(cal, { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(dt)) p[x.type] = +x.value || x.value; return p; };
const pk = sheet('pickDlg', `<div class="pick"><div class="pick-h">
  <button type="button" class="icon" data-pm="-12" aria-label="سال قبل">«</button><button type="button" class="icon" data-pm="-1" aria-label="ماه قبل">‹</button>
  <b id="pickTitle"></b>
  <button type="button" class="icon" data-pm="1" aria-label="ماه بعد">›</button><button type="button" class="icon" data-pm="12" aria-label="سال بعد">»</button></div>
  <div class="pick-grid" id="pickGrid"></div>
  <div class="pick-f"><button type="button" class="primary" data-pm="today">امروز</button><button type="button" class="ghost" data-pm="close">بستن</button></div></div>`);
let pickCur = new Date();                         // any day inside the shown month
function monthStart(dt, cal) { const d = new Date(dt); d.setHours(12, 0, 0, 0); while (partsOf(d, cal).day > 1) d.setDate(d.getDate() - 1); return d; }
function drawPick() {
  const cal = S11.calendar === 'gregory' ? 'gregory' : 'persian', start = monthStart(pickCur, cal), m0 = partsOf(start, cal).month;
  const days = []; for (const d = new Date(start); partsOf(d, cal).month === m0; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  $('#pickTitle').textContent = new Intl.DateTimeFormat(cal === 'gregory' ? 'en-GB-u-ca-gregory' : 'fa-IR-u-ca-persian', { month: 'long', year: 'numeric' }).format(start);
  const ws = S11.weekStart ?? 6, lead = (start.getDay() - ws + 7) % 7;
  const names = [...Array(7)].map((_, i) => { const d = new Date(2024, 0, 7 + ((ws + i) % 7)); return new Intl.DateTimeFormat(cal === 'gregory' ? 'en-GB' : 'fa-IR', { weekday: 'narrow' }).format(d); });
  const today = ymd(new Date()), sel = ui.pick || today, list = filtered();
  pk.querySelector('#pickGrid').innerHTML = names.map(n => `<span class="pick-wd">${n}</span>`).join('') + '<span></span>'.repeat(lead)
    + days.map(d => { const s = ymd(d), n = list.some(t => occursOn(t, s)); return `<button type="button" data-pd="${s}" class="${s === today ? 'today' : ''} ${s === sel ? 'sel' : ''}">${cal === 'gregory' ? d.getDate() : faNum(partsOf(d, cal).day)}${n ? '<i></i>' : ''}</button>`; }).join('');
}
function openPick() { pickCur = parseYmd(ui.pick || ymd(new Date())); drawPick(); pk.showModal(); }
pk.addEventListener('click', e => {
  const b = e.target.closest('[data-pm]'), d = e.target.closest('[data-pd]');
  if (d) { ui.pick = d.dataset.pd === ymd(new Date()) ? null : d.dataset.pd; ui.view = 'today'; ui.cat = null; pk.close(); render(); scrollTo(0, 0); return; }
  if (!b) return; const v = b.dataset.pm;
  if (v === 'close') return pk.close();
  if (v === 'today') { ui.pick = null; ui.view = 'today'; pk.close(); render(); return; }
  const cal = S11.calendar === 'gregory' ? 'gregory' : 'persian';
  let d0 = monthStart(pickCur, cal); const step = +v;
  for (let i = 0; i < Math.abs(step); i++) { if (step > 0) { d0.setDate(d0.getDate() + 32); d0 = monthStart(d0, cal); } else { d0.setDate(d0.getDate() - 1); d0 = monthStart(d0, cal); } }
  pickCur = d0; drawPick();
});
$('#viewTitle').style.cursor = 'pointer';
$('#viewTitle').addEventListener('click', openPick);
$('#viewSub').addEventListener('click', openPick);
// the picked day is shown like "today" for that date
EXTRA.pickday = list => {
  const s = ui.pick, items = dayList(s, list);
  return `<button type="button" class="ghost backtoday" data-pm-back>↩︎ برگشت به امروز</button>
    <div class="group"><h3>${fmtDual(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>${items.map(t => taskHTML(t, s)).join('') || '<div class="empty"><b>🌿</b>این روز کاری نیست</div>'}</div>`;
};
const _render11 = render;
render = function () {
  // any other navigation (menu, category) leaves the picked day
  if (ui.pick && ui.view === 'today' && !ui.q && !ui.cat) {
    ui.view = 'pickday'; try { _render11(); } finally { ui.view = 'today'; }
    $('#viewTitle').textContent = fmtDate(ui.pick, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#viewSub').innerHTML = fmtAlt(ui.pick, { day: 'numeric', month: 'long', year: 'numeric' }) + ' ▾';
    return;
  }
  _render11();
  if (!ui.q) $('#viewSub').insertAdjacentHTML('beforeend', ' ▾');
  // the page title already says «امروز» — no second «امروز» heading above the list
  if (ui.view === 'today' && !ui.q && !ui.cat) { const h = document.querySelector('#content > .group > h3'); if (h && /^(امروز|Today)$/.test(h.textContent.trim())) h.remove(); }
};
$('#content').addEventListener('click', e => { if (e.target.closest('[data-pm-back]')) { e.stopPropagation(); ui.pick = null; render(); } }, true);
document.querySelector('#views').addEventListener('click', e => { if (e.target.closest('[data-view]')) ui.pick = null; }, true);
render();

/* ---------- 6. selectable "task done" sound ---------- */
Object.assign(SOUNDS, {
  pop: { name: 'پاپ', notes: [[620, 0, .07], [1240, .05, .09]], type: 'sine' },
  click: { name: 'کلیک', notes: [[1800, 0, .03]], type: 'square' },
  ding: { name: 'دینگ', notes: [[1568, 0, .6]], type: 'sine' },
  success: { name: 'موفقیت', notes: [[523, 0, .15], [659, .1, .15], [784, .2, .35]], type: 'triangle' },
  coin: { name: 'سکه', notes: [[988, 0, .08], [1319, .08, .4]], type: 'square' },
});
S11.tickSound ??= 'marimba';
const fsN = $('#setForm fieldset[data-st=notif]');
fsN.insertAdjacentHTML('afterbegin', `<div class="row"><label>صدای تیک زدن کار<select id="tickSnd"></select></label><button type="button" class="ghost" id="tickTest">▶︎ پخش</button></div>`);
const drawTick = () => { $('#tickSnd').innerHTML = Object.entries(SOUNDS).filter(([k]) => k !== 'custom').map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('') + (S11.customSound ? '<option value="custom">زنگ دلخواه</option>' : ''); $('#tickSnd').value = S11.tickSound; };
drawTick();
$('#openSettings').addEventListener('click', drawTick);
$('#tickSnd').addEventListener('change', e => { S11.tickSound = e.target.value; save(); playSound(S11.tickSound); });
$('#tickTest').onclick = () => playSound($('#tickSnd').value);
