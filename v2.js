/* روزنگار v2 — preview sheet, sorting & drag-reorder, calendar visibility/checkable,
   all-day reminders, period tracking, backgrounds, pull-to-refresh, auto-update. */
'use strict';

/* ================= auto-update for installed apps ================= */
// The page and service worker are always revalidated with the server; when a new version
// of the service worker takes over, every open copy reloads itself once.
if ('serviceWorker' in navigator) {
  // reload only when an existing worker is replaced by a newer one (not on the very first install)
  let reloaded = false; const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || sessionStorage.getItem('rz-upd') === String(Date.now() / 6e4 | 0)) return;
    reloaded = true;
    const go = () => { sessionStorage.setItem('rz-upd', String(Date.now() / 6e4 | 0)); save(); location.reload(); };
    // never throw away a half-filled form: wait until no dialog is open (or the app goes to background)
    if (!document.querySelector('dialog[open]')) return go();
    const wait = () => { if (!document.querySelector('dialog[open]') || document.hidden) { clearInterval(iv); go(); } };
    const iv = setInterval(wait, 1000); document.addEventListener('visibilitychange', wait);
  });
  const check = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 30 * 60e3);
}

/* ================= settings defaults ================= */
const S = state.settings;
S.sortMode ??= 'time'; S.overdueFrom ??= '2026-11-13'; // older unfinished tasks are not shown as overdue
 S.showCalName ??= true; S.altDate ??= true; S.bg ??= 'aurora';
if (!['aurora', 'lavender', 'peach', 'ocean', 'forest', 'sand', 'midnight', 'persian', 'plain', 'image', 'custom'].includes(S.bg)) S.bg = { night: 'midnight', mint: 'forest', sunset: 'peach' }[S.bg] || 'aurora';
// one-time migration: old all-day reminders that meant "on the day" (positive < 1 day) → same day 09:00
if (!S.migAllDay) { for (const t of state.tasks) if (!t.time && t.reminders?.length) t.reminders = t.reminders.map(m => m > 0 && m < 1440 ? -540 : m); S.migAllDay = 1; save(); }
// calendars that can't be edited (holidays …) don't get a checkbox by default
for (const c of state.cats) if (c.ro && c.noCheck === undefined) c.noCheck = true;

/* ================= small DOM helpers ================= */
const h2el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const sheet = (id, inner) => { const d = h2el(`<dialog id="${id}" class="sheet">${inner}</dialog>`); document.body.appendChild(d); d.addEventListener('click', e => { if (e.target === d) d.close(); }); return d; };

/* ================= search: clear button ================= */
const sInp = $('#search');
const syncX = () => $('#searchX').classList.toggle('on', !!sInp.value);
sInp.addEventListener('input', syncX);
$('#searchX').onclick = () => { sInp.value = ''; ui.q = ''; syncX(); render(); sInp.blur(); };
sInp.addEventListener('keydown', e => { if (e.key === 'Escape') $('#searchX').click(); });
$('#topSettings').onclick = () => $('#openSettings').click();
$('#quickTitle').setAttribute('enterkeyhint', 'done');

/* ================= sort bar ================= */
const SORTS = [['time', '⏱ زمان'], ['manual', '✋ دستی'], ['calendar', '🗂 تقویم']];
const _render2 = render;
render = function () {
  _render2();
  if (ui.q || !['today', 'upcoming', 'all', 'week'].includes(ui.view)) return;
  const bar = h2el(`<div class="sortbar"><span>مرتب‌سازی</span>${SORTS.map(([k, l]) => `<button data-sort="${k}" class="${S.sortMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>`);
  $('#content').prepend(bar);
  if (S.period?.enabled === undefined && !S.periodAsked && ui.view === 'today') $('#content').prepend(periodAskCard());
  const pc = periodTodayCard(); if (pc && ui.view === 'today') $('#content').prepend(pc);
};
$('#content').addEventListener('click', e => {
  const b = e.target.closest('[data-sort]'); if (!b) return;
  e.stopPropagation(); S.sortMode = b.dataset.sort; save(); render();
  if (S.sortMode === 'manual') toast('کارها را با ⋮⋮ بکشید و جابه‌جا کنید');
}, true);

/* ================= drag to reorder (touch + mouse, works on iPhone) ================= */
let drag = null;
$('#content').addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g) return;
  const el = g.closest('.task'), box = el.parentElement;
  e.preventDefault(); g.setPointerCapture(e.pointerId);
  const r = el.getBoundingClientRect();
  drag = { el, box, startY: e.clientY, ph: h2el(`<div class="task-ph" style="height:${r.height}px"></div>`) };
  el.classList.add('lifting'); el.style.width = r.width + 'px'; el.style.top = r.top + 'px'; el.style.left = r.left + 'px';
  box.insertBefore(drag.ph, el); document.body.appendChild(el); el.classList.add('floating');
  navigator.vibrate?.(15);
});
$('#content').addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = e.clientY - drag.startY; drag.el.style.transform = `translateY(${dy}px)`;
  const sibs = [...drag.box.querySelectorAll(':scope > .task')];
  let before = null; for (const s of sibs) { const r = s.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = s; break; } }
  if (before) drag.box.insertBefore(drag.ph, before); else drag.box.appendChild(drag.ph);
  if (e.clientY < 70) scrollBy(0, -12); else if (e.clientY > innerHeight - 70) scrollBy(0, 12);
});
const endDrag = () => {
  if (!drag) return;
  const { el, box, ph } = drag; drag = null;
  el.classList.remove('floating', 'lifting'); el.style.cssText = el.style.cssText.replace(/(width|top|left|transform):[^;]+;?/g, '');
  box.insertBefore(el, ph); ph.remove();
  window.reorderBox(box);
  save(); render();
};
$('#content').addEventListener('pointerup', endDrag); $('#content').addEventListener('pointercancel', endDrag);
document.addEventListener('pointerup', endDrag);

/* ================= preview sheet (tap a task → preview, like Google Calendar) ================= */
const pv = sheet('viewDlg', `<div class="pv"><div class="pv-head"><span class="pv-dot"></span><h2 id="pvTitle"></h2><button class="icon" data-pv="close" aria-label="close">✕</button></div>
  <div id="pvBody"></div>
  <div class="pv-actions"><button class="ghost" data-pv="done" id="pvDone"></button><button class="ghost" data-pv="edit">✎ ویرایش</button><button class="danger" data-pv="del">🗑 حذف</button></div></div>`);
let pvTask = null, pvDay = '';
function recText(r) {
  if (!r?.freq) return '';
  const n = r.interval > 1 ? faNum(r.interval) + ' ' : '';
  const base = { DAILY: n ? `هر ${n}روز` : 'هر روز', WEEKLY: n ? `هر ${n}هفته` : 'هر هفته', MONTHLY: n ? `هر ${n}ماه` : 'هر ماه', YEARLY: n ? `هر ${n}سال` : 'هر سال' }[r.freq];
  const days = r.freq === 'WEEKLY' && r.days?.length ? ' — ' + r.days.map(d => DAY_FA[DAYS.indexOf(d)]).join('، ') : '';
  return base + days + (r.until ? ' تا ' + fmtDate(r.until, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
}
function openPreview(t, d) {
  pvTask = t; pvDay = d || t.date; const c = catOf(t), done = d ? isDone(t, d) : !!t.done;
  pv.querySelector('.pv-dot').style.background = done ? '#8a8a8a' : safeColor(t.color) || safeColor(c.color);
  $('#pvTitle').textContent = t.title;
  const day = pvDay ? `<b>${fmtDate(pvDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b><br><span class="alt">${fmtAlt(pvDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>` : 'بدون تاریخ';
  const time = t.time ? `${faNum(t.time)} – ${faNum(new Date(new Date(`2000-01-01T${t.time}`).getTime() + (t.duration || 30) * 6e4).toTimeString().slice(0, 5))}` : '☀️ تمام روز';
  const rows = [
    ['📅', day + '<br>' + time + (t.rec?.freq ? `<br>🔁 ${recText(t.rec)}` : '')],
    c.name ? ['🗂', `<span class="dot" style="background:${safeColor(c.color)};display:inline-block;vertical-align:middle"></span> ${esc(c.name)}`] : null,
    t.reminders?.length ? ['🔔', t.reminders.slice().sort((a, b) => a - b).map(m => remLabel(m, !t.time)).join('<br>')] : null,
    t.notes ? ['📝', `<div class="uc pv-notes">${esc(t.notes).replace(/\n/g, '<br>')}</div>`] : null,
    safeUrl(t.link) ? ['🔗', `<a href="${esc(safeUrl(t.link))}" target="_blank" rel="noopener">${esc(t.link)}</a>`] : null,
    t.subs?.length ? ['☑️', t.subs.map((s, i) => `<label class="pv-sub"><input type="checkbox" data-pvsub="${i}" ${s.done ? 'checked' : ''}> <span class="uc">${esc(s.t)}</span></label>`).join('')] : null,
    t.tags?.length ? ['#', t.tags.map(g => `<span class="htag uc">#${esc(g)}</span>`).join(' ')] : null,
  ].filter(Boolean);
  $('#pvBody').innerHTML = rows.map(([i, h]) => `<div class="pv-row"><span class="pv-i">${i}</span><div>${h}</div></div>`).join('');
  const dn = $('#pvDone'); dn.style.display = canCheck(t) ? '' : 'none'; dn.textContent = done ? '↩︎ برگرداندن' : '✓ انجام شد';
  pv.querySelector('[data-pv=del]').style.display = t.period ? 'none' : '';
  pv.showModal();
}
pv.addEventListener('click', e => {
  const a = e.target.closest('[data-pv]')?.dataset.pv, sb = e.target.closest('[data-pvsub]');
  if (sb) { const s = pvTask?.subs?.[+sb.dataset.pvsub]; if (s) { s.done = sb.checked; pvTask.dirty = true; commit(); } return; }
  if (!a) return;
  const t = pvTask;
  if (a === 'close') pv.close();
  if (a === 'edit') { pv.close(); if (t.period) return openPeriod(); openTask(t); }
  if (a === 'del') { pv.close(); editing = t; $('#delTask').onclick(); }
  if (a === 'done') { toggleDone(t, pvDay); pv.close(); }
});
function toggleDone(t, d) {
  if (t.rec?.freq && d) { t.doneDates = t.doneDates || []; t.doneDates = t.doneDates.includes(d) ? t.doneDates.filter(x => x !== d) : [...t.doneDates, d]; }
  else t.done = !t.done;
  if (isDone(t, d)) { playSound(state.settings.tickSound || 'marimba'); (state.log = state.log || []).push({ id: t.id, at: Date.now() }); }
  t.dirty = true; t.updated = Date.now(); commit();
}
// open the preview instead of the editor
$('#content').addEventListener('click', e => {
  if (e.target.closest('[data-act], .grip, a, [data-sort], [data-wadd], [data-jnav], [data-wnav], [data-mnav], summary, .pcard')) return;
  const el = e.target.closest('.task'); if (!el) return;
  e.stopPropagation();
  const t = state.tasks.find(x => x.id === el.dataset.id) || periodTasks().find(x => x.id === el.dataset.id);
  if (t) openPreview(t, el.dataset.d);
}, true);

/* ================= calendars: show/hide, checkable, order ================= */
renderCats = function () {
  periodCat(); // creates the period calendar when enabled (was a side effect hidden in the template)
  const open = {}; for (const t of state.tasks) if (!t.done) open[t.cat] = (open[t.cat] || 0) + 1; // one pass, not cats × tasks
  $('#catList').innerHTML = state.cats.map(c => {
    return `<div class="cat ${ui.cat === c.id ? 'active' : ''} ${c.hidden ? 'off' : ''}" data-cat="${esc(c.id)}">
      <button class="eye" data-eye="${esc(c.id)}" title="نمایش/پنهان">${c.hidden ? '◌' : '●'}</button>
      <span class="dot" style="background:${safeColor(c.color)}"></span><span class="cname">${esc(c.name)}</span>${c.ro ? ' <small>🔒</small>' : ''}
      <span class="n">${faNum(open[c.id] || 0)}</span><button class="icon" data-editcat="${esc(c.id)}" title="تنظیمات تقویم">⋯</button></div>`;
  }).join('');
};
$('#catList').addEventListener('click', e => {
  const eye = e.target.closest('[data-eye]'); if (!eye) return;
  e.stopPropagation(); const c = state.cats.find(x => x.id === eye.dataset.eye); if (!c) return; c.hidden = !c.hidden; save(); render();
}, true);
// category dialog: extra options
$('#delCat').before(h2el(`<span></span>`));
$('#catForm').querySelector('.actions').before(h2el(`<fieldset class="catopts"><legend>گزینه‌ها</legend>
  <label class="check"><input type="checkbox" name="noCheck"> این تقویم تیک‌زدنی نیست (مثل تعطیلات و تولدها)</label>
  <label class="check"><input type="checkbox" name="hiddenCal"> این تقویم را نشان نده</label>
  <div class="row"><button type="button" class="ghost" data-catmove="-1">⬆ بالاتر</button><button type="button" class="ghost" data-catmove="1">⬇ پایین‌تر</button></div></fieldset>`));
const _openCat = openCat; openCat = function (c) { _openCat(c); const f = $('#catForm'); f.noCheck.checked = !!c?.noCheck; f.hiddenCal.checked = !!c?.hidden; };
$('#catDlg').addEventListener('close', () => {
  if ($('#catDlg').returnValue !== 'ok') return;
  const f = $('#catForm'), c = editCat || state.cats[state.cats.length - 1];
  c.noCheck = f.noCheck.checked; c.hidden = f.hiddenCal.checked; save(); render();
});
$('#catForm').addEventListener('click', e => {
  const m = e.target.closest('[data-catmove]'); if (!m || !editCat) return;
  const i = state.cats.indexOf(editCat), j = i + +m.dataset.catmove; if (j < 0 || j >= state.cats.length) return;
  [state.cats[i], state.cats[j]] = [state.cats[j], state.cats[i]]; save(); renderCats(); toast('ترتیب تقویم‌ها تغییر کرد');
});

/* ================= editor: calendar choice, all-day, reminders ================= */
const tf = $('#taskForm');
const _openTask2 = openTask;
openTask = function (t, presetDate) {
  _openTask2(t, presetDate);
  if (!t) { // new task: default calendar
    const def = S.defaultCal && state.cats.some(c => c.id === S.defaultCal) ? S.defaultCal : (state.cats.find(c => c.gcal === 'primary')?.id || '');
    tf.cat.value = ui.cat || def;
  }
  tf.cat.querySelector('option[value=""]').textContent = 'بدون تقویم (فقط همین دستگاه)';
  [...tf.cat.options].forEach(o => { const c = state.cats.find(x => x.id === o.value); if (c?.ro) o.disabled = true; });
  $('#allDay').checked = !tf.time.value; syncAllDay(true);
};
function syncAllDay(init) {
  const ad = $('#allDay').checked;
  tf.time.disabled = ad; tf.duration.disabled = ad; if (ad) tf.time.value = '';
  else if (!tf.time.value) tf.time.value = '09:00';
  if (!init) rems = ad ? [-540] : [10];
  drawRemPicker(); drawRems();
}
$('#allDay').onchange = () => syncAllDay(false);
tf.time.addEventListener('change', () => { if (tf.time.value) { $('#allDay').checked = false; tf.time.disabled = false; tf.duration.disabled = false; drawRemPicker(); drawRems(); } });
// two pickers: timed (minutes before) / all-day (N days before at HH:MM)
const remAdd = $('#remAdd');
remAdd.after(h2el(`<span id="remAD" class="remad"><select id="remDays">${[0, 1, 2, 3, 7].map(d => `<option value="${d}">${d === 0 ? 'همان روز' : d === 1 ? 'روز قبل' : faNum(d) + ' روز قبل'}</option>`).join('')}</select><input type="time" id="remTime" value="09:00"></span>`));
remAdd.insertAdjacentHTML('beforeend', '<option value="2880">۲ روز قبل</option><option value="10080">۱ هفته قبل</option>');
function drawRemPicker() { const ad = $('#allDay').checked; remAdd.style.display = ad ? 'none' : ''; $('#remAD').style.display = ad ? '' : 'none'; }
$('#remAddBtn').onclick = () => {
  let m;
  if ($('#allDay').checked) { const [hh, mm] = ($('#remTime').value || '09:00').split(':').map(Number); m = +$('#remDays').value * 1440 - (hh * 60 + mm); }
  else m = +remAdd.value;
  if (!rems.includes(m)) rems.push(m); drawRems();
};
// new all-day tasks from quick add get a 09:00 reminder
const _commit2 = commit;
commit = function () { for (const t of state.tasks) if (t.dirty && !t.time && t.date && !t.reminders?.length && !t.gid && Date.now() - (t.created || 0) < 5000) t.reminders = [-540]; _commit2(); };

/* ================= settings additions ================= */
const appearance = $('#setForm fieldset');
appearance.insertAdjacentHTML('beforeend', `
  <div class="row">
    <label>تقویم پیش‌فرض کار جدید<select name="defaultCal"></select></label>
  </div>
  <div class="bglabel">پس‌زمینه</div><div class="bggrid" id="bgGrid"></div>
  <label class="ghost filebtn" id="bgPick" style="display:none">🖼 انتخاب عکس پس‌زمینه<input type="file" id="bgFile" accept="image/*" hidden></label>
  <label class="check"><input type="checkbox" name="showCalName"> نمایش نام تقویم روی هر کار</label>
  <label class="check"><input type="checkbox" name="altDate"> نمایش تاریخ دوم (میلادی کنار شمسی، یا برعکس)</label>
  <button type="button" class="ghost" id="periodOpen">🩸 تنظیمات پیگیری دوره‌ی ماهانه</button>`);
const sf = $('#setForm');
$('#openSettings').addEventListener('click', () => {
  drawBgGrid(); sf.showCalName.checked = S.showCalName !== false; sf.altDate.checked = S.altDate !== false;
  sf.defaultCal.innerHTML = state.cats.filter(c => !c.ro).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  sf.defaultCal.value = S.defaultCal || state.cats.find(c => c.gcal === 'primary')?.id || '';
  $('#bgPick').style.display = S.bg === 'image' ? '' : 'none';
});
$('#setDlg').addEventListener('close', () => {
  if ($('#setDlg').returnValue !== 'ok') return;
  S.showCalName = sf.showCalName.checked; S.altDate = sf.altDate.checked; S.defaultCal = sf.defaultCal.value;
  save(); applyBg(); render();
});
$('#periodOpen').onclick = () => { $('#setDlg').close(); openPeriod(); };

/* ================= backgrounds ================= */
// Soft "mesh" gradients (several blurred colour blobs over a tinted base), each with a light
// and a dark version, plus a fine grain. Drawn on a fixed layer so it doesn't move on scroll (iOS).
const mesh = (base, blobs) => ({ base, img: blobs.map(([x, y, c, r = 55]) => `radial-gradient(at ${x}% ${y}%, ${c} 0px, transparent ${r}%)`).join(',') });
const tile = (svg, base) => ({ base, img: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: '84px 84px' });
const girih = c => `<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84' viewBox='0 0 84 84'><g fill='none' stroke='${c}' stroke-width='1'><path d='M42 6l10 26 26 10-26 10-10 26-10-26L6 42l26-10z'/><path d='M42 22l6 14 14 6-14 6-6 14-6-14-14-6 14-6z'/><circle cx='42' cy='42' r='5'/><path d='M0 0l12 12M84 0L72 12M0 84l12-12M84 84L72 72'/></g></svg>`;
const BG = {
  aurora:   { fa: 'شفق',     light: mesh('#f6f4ff', [[8, 6, '#c4b5fdcc'], [92, 4, '#f9a8d4b3'], [88, 72, '#a5f3fcb3'], [10, 90, '#ddd6fecc'], [50, 45, '#fbcfe880', 40]]), dark: mesh('#0d0a1c', [[8, 6, '#6d28d980'], [92, 4, '#db277766'], [88, 72, '#0891b266'], [10, 90, '#4c1d9580']]) },
  lavender: { fa: 'یاس',     light: mesh('#faf7ff', [[0, 0, '#e9d5ffcc'], [100, 10, '#ddd6fecc'], [70, 100, '#fbcfe8b3'], [10, 70, '#f5d0fe99']]), dark: mesh('#140f26', [[0, 0, '#7e22ce66'], [100, 10, '#4c1d9580'], [70, 100, '#9d174d55']]) },
  peach:    { fa: 'هلو',     light: mesh('#fff7f2', [[0, 10, '#fed7aacc'], [100, 0, '#fecdd3cc'], [85, 90, '#fde68ab3'], [15, 95, '#fbcfe899']]), dark: mesh('#1c110e', [[0, 10, '#9a341266'], [100, 0, '#9f123966'], [85, 90, '#854d0e55']]) },
  ocean:    { fa: 'اقیانوس', light: mesh('#f2f9ff', [[0, 0, '#bae6fdcc'], [100, 15, '#c7d2fecc'], [80, 100, '#99f6e4b3'], [10, 85, '#a5f3fc99']]), dark: mesh('#06131f', [[0, 0, '#0369a180'], [100, 15, '#3730a366'], [80, 100, '#0f766e66']]) },
  forest:   { fa: 'جنگل',    light: mesh('#f3fbf6', [[0, 0, '#bbf7d0cc'], [100, 10, '#d9f99db3'], [80, 100, '#99f6e4b3'], [15, 90, '#dcfce7cc']]), dark: mesh('#07130d', [[0, 0, '#16653480'], [100, 10, '#3f621266'], [80, 100, '#115e5966']]) },
  sand:     { fa: 'کویر',    light: mesh('#fbf7ef', [[0, 0, '#fde4c3cc'], [100, 20, '#f1dcc4cc'], [60, 100, '#fef3c7cc'], [10, 80, '#e7d5bf99']]), dark: mesh('#16120c', [[0, 0, '#78350f66'], [100, 20, '#57534e66'], [60, 100, '#713f1255']]) },
  midnight: { fa: 'نیمه‌شب', dark: mesh('#05060f', [[15, 0, '#312e81aa'], [100, 30, '#581c8788'], [50, 110, '#0e749066'], [0, 80, '#1e1b4b99']]), forceDark: true },
  persian:  { fa: 'کاشی',    light: tile(girih('#7c5cff2e'), '#faf8ff'), dark: tile(girih('#a78bfa2e'), '#100d1f') },
  plain:    { fa: 'ساده',    light: { base: '#f5f4fb', img: 'none' }, dark: { base: '#0f0e17', img: 'none' } },
};
const bgLayer = h2el('<div id="bgLayer" aria-hidden="true"></div>'); document.body.prepend(bgLayer);
const isDarkNow = () => document.documentElement.dataset.theme === 'dark';
function bgStyle(key, dark) { const p = BG[key] || BG.aurora; return (dark || p.forceDark ? p.dark : p.light) || p.dark; }
function applyBg() {
  const de = document.documentElement, p = BG[S.bg];
  if (p?.forceDark) de.dataset.theme = 'dark';
  const dark = isDarkNow();
  document.body.style.backgroundImage = 'none';
  if (S.bg === 'image' && S.bgImage) {
    bgLayer.style.background = `linear-gradient(color-mix(in srgb,var(--bg) 30%,transparent),color-mix(in srgb,var(--bg) 45%,transparent)),url(${S.bgImage}) center/cover no-repeat`;
    document.body.style.backgroundColor = 'var(--bg)';
  } else {
    const st = bgStyle(S.bg, dark);
    bgLayer.style.background = ''; bgLayer.style.backgroundColor = st.base; bgLayer.style.backgroundImage = st.img; bgLayer.style.backgroundSize = st.size || 'cover';
    document.body.style.backgroundColor = st.base;
  }
  de.classList.toggle('glass', S.bg !== 'plain');
  de.classList.toggle('grain', S.bg !== 'plain' && S.bg !== 'persian');
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.body).backgroundColor;
}
function drawBgGrid() {
  const dark = isDarkNow();
  $('#bgGrid').innerHTML = Object.entries(BG).map(([k, p]) => { const st = bgStyle(k, dark);
    return `<button type="button" class="bgsw ${S.bg === k ? 'on' : ''}" data-bg="${k}" style="background-color:${st.base};background-image:${st.img.replace(/"/g, "'")};background-size:${st.size ? '42px 42px' : 'cover'}"><span>${p.fa}</span></button>`; }).join('')
    + `<button type="button" class="bgsw img ${S.bg === 'image' ? 'on' : ''}" data-bg="image" ${S.bgImage ? `style="background:url(${S.bgImage}) center/cover"` : ''}><span>🖼 عکس</span></button>`;
  $('#bgPick').style.display = S.bg === 'image' ? '' : 'none';
}
$('#setForm').addEventListener('click', e => {
  const b = e.target.closest('[data-bg]'); if (!b) return;
  S.bg = b.dataset.bg; save();
  if (S.bg === 'image' && !S.bgImage) $('#bgFile').click();
  applyTheme(); applyBg(); drawBgGrid();
});
const _applyTheme = applyTheme; applyTheme = function () { _applyTheme(); applyBg(); };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyBg());

/* ================= toasts: short and gone ================= */
toast = function (m) {
  const e = $('#toast'); e.textContent = m; e.style.display = 'block';
  requestAnimationFrame(() => e.classList.add('show'));
  clearTimeout(e._t); clearTimeout(e._h);
  e._t = setTimeout(() => { e.classList.remove('show'); e._h = setTimeout(() => { e.style.display = 'none'; }, 350); }, 1600);
};
$('#toast').style.display = 'none';

$('#bgFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(), src = URL.createObjectURL(f); img.onerror = () => { URL.revokeObjectURL(src); toast('عکس قابل خواندن نیست'); }; img.onload = () => { URL.revokeObjectURL(src);
    const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    S.bgImage = c.toDataURL('image/jpeg', .78); S.bg = 'image'; save(); applyBg(); drawBgGrid(); toast('پس‌زمینه تنظیم شد');
  }; img.src = src;
};
applyBg();

/* ================= period tracking (asked once, predicts automatically) ================= */
// Stays on this device only — never sent to Google or our server (except its reminder, if background reminders are on).
const periodCat = () => {
  if (!S.period?.enabled) return null;
  let c = state.cats.find(x => x.id === 'period');
  if (!c) { c = { id: 'period', name: 'دوره‌ی ماهانه', color: '#e64980', sound: 'soft', noCheck: true, local: true }; state.cats.push(c); save(); }
  return c;
};
function periodTasks() {
  const p = S.period; if (!p?.enabled || !p.last) return [];
  periodCat();
  const out = [];
  for (let i = 0; i < (p.len || 5); i++) {
    const d = parseYmd(p.last); d.setDate(d.getDate() + i);
    out.push({ id: 'period-' + i, period: true, title: i === 0 ? '🩸 شروع دوره (پیش‌بینی)' : `🩸 دوره — روز ${faNum(i + 1)}`, date: ymd(d), time: '', cat: 'period',
      rec: { freq: 'DAILY', interval: p.cycle || 28 }, reminders: i === 0 && p.remind !== false ? [900] : [], notes: '' });
  }
  return out;
}
// expose predicted days as (local, read-only) tasks
const _filtered = filtered; filtered = function () { const l = _filtered(); return hiddenCat({ cat: 'period' }) || (ui.cat && ui.cat !== 'period') ? l : l.concat(periodTasks()); };
const _occursOn = occursOn;
occursOn = function (t, ds) { if (t.period && ds < (S.period?.last || '')) return false; return _occursOn(t, ds); };
const _rt2 = reminderTasks; reminderTasks = () => _rt2().concat(periodTasks());
// clean up virtual tasks an older version accidentally saved
state.tasks = state.tasks.filter(t => !/^(period|hb)-/.test(String(t.id)));

const pd = sheet('periodDlg', `<form method="dialog" id="periodForm"><h2>🩸 پیگیری دوره‌ی ماهانه</h2>
  <p class="muted" style="margin:0">روزنگار بر اساس این اطلاعات دوره‌های بعدی را پیش‌بینی می‌کند و هر بار که شروع واقعی را ثبت کنید، میانگین را خودش اصلاح می‌کند. این اطلاعات فقط روی همین دستگاه می‌ماند.</p>
  <label class="check"><input type="checkbox" name="enabled"> فعال</label>
  <label>تاریخ شروع آخرین دوره<input type="date" name="last"></label>
  <div class="row"><label>طول چرخه (روز)<input type="number" name="cycle" min="18" max="60"></label><label>مدت دوره (روز)<input type="number" name="len" min="1" max="12"></label></div>
  <label class="check"><input type="checkbox" name="remind"> یک روز قبل از شروع یادآوری کن</label>
  <div class="actions"><button type="button" class="ghost" id="periodStart">امروز شروع شد</button><span class="grow"></span><button value="cancel" formnovalidate class="ghost">انصراف</button><button value="ok" class="primary">ذخیره</button></div></form>`);
function openPeriod() {
  const p = S.period || {}, f = $('#periodForm');
  f.enabled.checked = p.enabled !== false; f.last.value = p.last || ymd(new Date()); f.cycle.value = p.cycle || 28; f.len.value = p.len || 5; f.remind.checked = p.remind !== false;
  pd.showModal();
}
pd.addEventListener('close', () => {
  S.periodAsked = true;
  if (pd.returnValue !== 'ok') return save();
  const f = $('#periodForm');
  S.period = { ...(S.period || {}), enabled: f.enabled.checked, last: f.last.value, cycle: +f.cycle.value || 28, len: +f.len.value || 5, remind: f.remind.checked };
  S.period.history = [...new Set([...(S.period.history || []), f.last.value])].sort().slice(-12);
  if (!S.period.enabled) state.cats = state.cats.filter(c => c.id !== 'period');
  save(); render(); toast('ذخیره شد');
});
// "it started today" → learn the real cycle length (average of the last cycles)
function periodStarted(day) {
  const p = S.period || (S.period = { enabled: true, cycle: 28, len: 5 });
  p.history = [...new Set([...(p.history || []), day])].sort().slice(-12);
  const h = p.history, gaps = [];
  for (let i = 1; i < h.length; i++) { const g = Math.round((parseYmd(h[i]) - parseYmd(h[i - 1])) / 864e5); if (g >= 18 && g <= 60) gaps.push(g); }
  if (gaps.length) p.cycle = Math.round(gaps.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, gaps.length));
  p.last = day; p.enabled = true; save(); render();
  toast('ثبت شد — طول چرخه: ' + faNum(p.cycle) + ' روز');
}
$('#periodStart').onclick = () => { periodStarted(ymd(new Date())); pd.close(); };
function periodAskCard() {
  return h2el(`<div class="pcard"><div>🩸 <b>پیگیری دوره‌ی ماهانه</b><br><span class="muted">برای خانم‌ها: روزنگار دوره‌های بعدی را پیش‌بینی و یادآوری کند؟</span></div>
    <div class="row"><button class="primary" data-period="yes">بله، تنظیم کن</button><button class="ghost" data-period="no">نه، ممنون</button></div></div>`);
}
function periodTodayCard() {
  const p = S.period; if (!p?.enabled || !p.last) return null;
  // near the predicted start (±3 days) offer a one-tap "started today"
  const today = ymd(new Date());
  const near = periodTasks()[0] && [-3, -2, -1, 0, 1, 2, 3].some(o => { const d = new Date(); d.setDate(d.getDate() + o); return occursOn(periodTasks()[0], ymd(d)); });
  if (!near || (p.history || []).includes(today)) return null;
  return h2el(`<div class="pcard"><div>🩸 دوره‌ی بعدی نزدیک است.</div><div class="row"><button class="primary" data-period="started">امروز شروع شد</button></div></div>`);
}
$('#content').addEventListener('click', e => {
  const b = e.target.closest('[data-period]'); if (!b) return;
  e.stopPropagation();
  if (b.dataset.period === 'yes') { S.periodAsked = true; save(); openPeriod(); }
  if (b.dataset.period === 'no') { S.periodAsked = true; S.period = { enabled: false }; save(); render(); }
  if (b.dataset.period === 'started') periodStarted(ymd(new Date()));
}, true);

/* ================= pull to refresh ================= */
(() => {
  const ind = h2el('<div id="ptr">↻</div>'); document.body.appendChild(ind);
  // like Chrome on phones: only a deliberate, long pull that starts with the page already at the top refreshes;
  // normal scrolling up and down (even hitting the top with momentum) never does
  let y0 = null, pulled = 0, raw = 0;
  const scroller = () => document.querySelector('main')?.scrollTop || 0;
  addEventListener('touchstart', e => { y0 = null; if (scrollY <= 0 && scroller() <= 0 && !document.querySelector('dialog[open]') && !drag && !e.target.closest('#sortMenu')) y0 = e.touches[0].clientY; pulled = raw = 0; }, { passive: true });
  addEventListener('touchmove', e => {
    if (y0 == null) return;
    raw = e.touches[0].clientY - y0;
    if (raw < 0 || scrollY > 0 || scroller() > 0) { y0 = null; pulled = 0; ind.style.opacity = 0; return; }   // scrolling, not pulling
    pulled = Math.min(120, raw * 0.45);
    ind.style.transform = `translate(-50%, ${pulled - 50}px) rotate(${pulled * 3}deg)`; ind.style.opacity = Math.max(0, (raw - 60) / 160);
    ind.classList.toggle('ready', raw > 220);
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (y0 == null) return; y0 = null; ind.classList.remove('ready');
    if (raw > 220) { ind.classList.add('spin'); try { await Promise.race([syncNow(), new Promise(r => setTimeout(r, 15000))]); render(); } catch { } finally { ind.classList.remove('spin'); } }
    pulled = 0; ind.style.transform = 'translate(-50%,-50px)'; ind.style.opacity = 0;
  });
})();

/* ================= sync status: quiet when all is well ================= */
const _sss = setSyncState;
setSyncState = function (cls, txt) { _sss(cls, txt); $('#syncState').style.display = cls === 'on' || (cls === 'off' && !state.sync.linked) ? 'none' : ''; };
if (!state.sync.linked) $('#syncState').style.display = 'none';

render();
