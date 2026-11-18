/* روزنگار v3 — batch 1: single-occurrence edits, overdue moves, morning summary,
   "remind until done", voice input. */
'use strict';
const S3 = state.settings;
S3.summary ??= { on: true, time: '07:30' };
const addDays = (ds, n) => { const d = parseYmd(ds); d.setDate(d.getDate() + n); return ymd(d); };
const todayStr = () => ymd(new Date());

/* ================= repeating tasks: this one / this and following / all ================= */
const scopeDlg = sheet('scopeDlg', `<div class="pv"><h2 id="scopeTitle" style="margin:0"></h2>
  <button class="ghost big" data-scope="one">فقط همین روز</button>
  <button class="ghost big" data-scope="next">این روز و روزهای بعد</button>
  <button class="ghost big" data-scope="all">همه‌ی تکرارها</button>
  <button class="ghost" data-scope="cancel">انصراف</button></div>`);
let scopeCb = null;
function askScope(title, cb) { $('#scopeTitle').textContent = title; scopeCb = cb; scopeDlg.showModal(); }
scopeDlg.addEventListener('click', e => { const s = e.target.closest('[data-scope]')?.dataset.scope; if (!s) return; scopeDlg.close(); if (s !== 'cancel') scopeCb?.(s); });

// "only this day": hide the day on the series and make a standalone copy for it
function splitOne(t, day) {
  t.exdates = [...new Set([...(t.exdates || []), day])]; t.exPush = [...new Set([...(t.exPush || []), day])]; t.dirty = true;
  const c = { ...structuredClone(t), id: uid(), date: day, rec: {}, gid: null, gUpdated: null, newGid: undefined, seriesGid: undefined, origDay: undefined, syncErr: undefined, exdates: [], exPush: [], exInst: [], doneDates: [], done: (t.doneDates || []).includes(day), instOf: t.id, created: Date.now(), dirty: true };
  state.tasks.push(c); return c;
}
// "this and following": end the old series the day before, start a new one on this day
function splitNext(t, day) {
  if (day <= t.date) return t;
  const c = { ...structuredClone(t), id: uid(), date: day, gid: null, gUpdated: null, newGid: undefined, syncErr: undefined, rec: { ...t.rec, raw: undefined, count: undefined }, exPush: (t.exPush || []).filter(d => d >= day), exdates: (t.exdates || []).filter(d => d >= day), exInst: [], doneDates: (t.doneDates || []).filter(d => d >= day), created: Date.now(), dirty: true };
  t.rec = { ...t.rec, until: addDays(day, -1), count: undefined }; t.dirty = true;
  state.tasks.push(c); return c;
}
pv.addEventListener('click', e => {
  const a = e.target.closest('[data-pv]')?.dataset.pv, t = pvTask, day = pvDay;
  if (!t || !t.rec?.freq || !day || t.period || !['edit', 'del'].includes(a)) return;
  e.stopImmediatePropagation(); pv.close();
  if (a === 'edit') askScope('ویرایش کار تکراری', s => {
    if (s === 'all') return openTask(t);
    const c = s === 'one' ? splitOne(t, day) : splitNext(t, day); save(); openTask(c);
  });
  else askScope('حذف کار تکراری', s => {
    if (s === 'all') { editing = t; $('#delTask').onclick(); return; }
    if (s === 'one') { t.exdates = [...new Set([...(t.exdates || []), day])]; t.exPush = [...new Set([...(t.exPush || []), day])]; }
    else if (day <= t.date) { editing = t; $('#delTask').onclick(); return; }
    else t.rec = { ...t.rec, until: addDays(day, -1), count: undefined };
    t.dirty = true; commit(); toast('حذف شد');
  });
}, true);

/* ================= overdue: move to today / tomorrow ================= */
const _openPreview = openPreview;
openPreview = function (t, d) {
  _openPreview(t, d);
  pv.querySelector('.pv-move')?.remove();
  if (!t.rec?.freq && t.date && t.date < todayStr() && !t.done && !t.period)
    pv.querySelector('.pv-actions').before(h2el(`<div class="pv-move"><span>⚠️ عقب‌افتاده</span><button class="ghost" data-move="0">→ امروز</button><button class="ghost" data-move="1">→ فردا</button></div>`));
};
pv.addEventListener('click', e => {
  const m = e.target.closest('[data-move]'); if (!m) return;
  if (!pvTask) return; pvTask.date = addDays(todayStr(), +m.dataset.move); pvTask.dirty = true; pv.close(); commit(); toast('منتقل شد');
});
// (The bulk "move all overdue to today" button was removed: it sat inside the overdue
//  header, so a tap meant to open the list could move every overdue task — and Google.)

/* ================= "remind until done" + morning summary ================= */
// nag: after the start time, remind again every N minutes (up to 8 times) until ticked.
const withNag = list => list.map(t => !t.nag ? t : { ...t, reminders: [...(t.reminders || []), ...Array.from({ length: 8 }, (_, i) => -(i + 1) * t.nag)] });
function summaryText(ds) {
  const items = dayList(ds, filtered()).filter(t => !isDone(t, ds));
  if (!items.length) return null;
  const first = items.slice(0, 3).map(t => (t.time ? faNum(t.time) + ' ' : '') + t.title).join('، ');
  return { title: `☀️ امروز ${faNum(items.length)} کار داری`, body: first + (items.length > 3 ? ' …' : '') };
}
// older version saved expanded nag reminders into tasks: strip them (timed tasks never have negative reminders)
for (const t of state.tasks) if (t.time && t.reminders?.some(m => m < 0)) t.reminders = t.reminders.filter(m => m >= 0);
const _rt3 = reminderTasks; reminderTasks = () => withNag(_rt3());
const _check3 = checkReminders;
checkReminders = function () {
  _check3();
  // morning summary (local; when background reminders are on, the server sends it)
  const s = S3.summary; if (!s?.on || S3.push) return;
  const ds = todayStr(), [hh, mm] = s.time.split(':').map(Number), at = new Date(); at.setHours(hh, mm, 0, 0);
  const key = 'sum|' + ds; if (Date.now() >= at && Date.now() - at < 30 * 6e4 && !state.fired[key]) { state.fired[key] = Date.now(); const x = summaryText(ds); if (x) notify({ ...x, sound: S3.sound, tag: key }); save(); }
};
// (the 15 s reminder interval lives in app.js and is late-bound; a second one here doubled the work)
if (typeof upcomingReminders === 'function') {
  const _up3 = upcomingReminders;
  upcomingReminders = function () {
    const out = _up3();
    if (S3.summary?.on) for (let i = 0; i < 7; i++) {
      const ds = addDays(todayStr(), i), x = summaryText(ds); if (!x) continue;
      const [hh, mm] = S3.summary.time.split(':').map(Number), at = parseYmd(ds); at.setHours(hh, mm, 0, 0);
      if (at > Date.now()) out.push({ k: 'sum|' + ds, at: at.getTime(), ...x });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 400);
  };
}
// editor: nag option
$('#remList').closest('fieldset').insertAdjacentHTML('beforeend', `<label>تکرار یادآوری تا وقتی تیک نزده‌ام<select id="nagSel">
  <option value="0">خاموش</option><option value="5">هر ۵ دقیقه</option><option value="10">هر ۱۰ دقیقه</option><option value="15">هر ۱۵ دقیقه</option><option value="30">هر ۳۰ دقیقه</option><option value="60">هر ساعت</option></select></label>`);
const _openTask3 = openTask; openTask = function (t, p) { _openTask3(t, p); $('#nagSel').value = String(t?.nag || 0); };
$('#taskDlg').addEventListener('close', () => {
  if ($('#taskDlg').returnValue !== 'ok') return;
  const t = editing || state.tasks[state.tasks.length - 1]; if (t) { t.nag = +$('#nagSel').value || 0; save(); }
});
// settings: morning summary
$('#pushBtn').closest('.pushbox').insertAdjacentHTML('afterend', `<div class="row"><label class="check"><input type="checkbox" name="sumOn"> خلاصه‌ی صبحگاهی کارهای امروز</label><label>ساعت<input type="time" name="sumTime"></label></div>`);
$('#openSettings').addEventListener('click', () => { const f = $('#setForm'); f.sumOn.checked = S3.summary.on; f.sumTime.value = S3.summary.time; });
$('#setDlg').addEventListener('close', () => { if ($('#setDlg').returnValue !== 'ok') return; const f = $('#setForm'); S3.summary = { on: f.sumOn.checked, time: f.sumTime.value || '07:30' }; save(); });

/* ================= voice input ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = h2el('<button type="button" class="mic" aria-label="voice">🎙</button>');
  $('#quickAdd').appendChild(mic);
  let rec = null;
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = S3.lang === 'en' ? 'en-US' : 'fa-IR'; rec.interimResults = true; rec.continuous = false;
    mic.classList.add('on'); const q = $('#quickTitle'); q.placeholder = 'بگویید… مثلاً «فردا ساعت ۵ عصر جلسه»';
    rec.onresult = e => { q.value = [...e.results].map(r => r[0].transcript).join(' '); };
    rec.onerror = e => { toast('میکروفون: ' + e.error); };
    rec.onend = () => { mic.classList.remove('on'); rec = null; q.placeholder = ''; if (q.value.trim()) $('#quickAdd').requestSubmit(); };
    rec.start();
  };
}
render();
