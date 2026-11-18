/* روزنگار v4 — batch 2: day timeline, weekly review, habits, countdowns, templates, free slot. */
'use strict';
state.habits ??= []; state.templates ??= [];
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const t2m = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const m2t = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/* ---------- new views in the menu ---------- */
$('[data-view=week]').insertAdjacentHTML('beforebegin', '<button data-view="day">🕘 روز</button>');
$('[data-view=stats]').insertAdjacentHTML('afterend', '<button data-view="review">🔁 مرور هفته</button><button data-view="habits">🌱 عادت‌ها</button>');
const TITLES4 = { day: 'روز', review: 'مرور هفته', habits: 'عادت‌ها' };
const _render4 = render;
render = function () {
  _render4();
  if (TITLES4[ui.view] && !ui.q) $('#viewTitle').textContent = TITLES4[ui.view];
  if (ui.view === 'today' && !ui.q) { const cd = countdownCards(); if (cd) $('#content').prepend(cd); }
  if (ui.view === 'day') requestAnimationFrame(() => { const n = document.querySelector('.tl-now'); if (n && !ui.dayScrolled) { n.scrollIntoView({ block: 'center' }); ui.dayScrolled = true; } });
};

/* ================= day timeline (drag to change time) ================= */
const HPX = 56; ui.dayOff = 0;
EXTRA.day = list => {
  const d = new Date(); d.setDate(d.getDate() + ui.dayOff); const ds = ymd(d), items = dayList(ds, list);
  const allDay = items.filter(t => !t.time), timed = items.filter(t => t.time);
  // lanes for overlapping events
  const ev = timed.map(t => ({ t, s: t2m(t.time), e: t2m(t.time) + Math.max(20, t.duration || 30) })).sort((a, b) => a.s - b.s);
  const lanesEnd = []; for (const x of ev) { let l = lanesEnd.findIndex(e => e <= x.s); if (l < 0) { l = lanesEnd.length; lanesEnd.push(0); } lanesEnd[l] = x.e; x.lane = l; }
  const L = Math.max(1, lanesEnd.length), hol = holidayOf(d);
  let h = `<div class="mnav"><button class="ghost" data-dnav="-1">→</button><b>${fmtDual(ds)}${hol ? ` <small style="color:#ef4444">${hol}</small>` : ''}</b><button class="ghost" data-dnav="1">←</button><button class="ghost" data-dnav="0">امروز</button></div>`;
  if (allDay.length) h += `<div class="tl-allday">${allDay.map(t => `<div class="tl-chip ${isDone(t, ds) ? 'done' : ''}" style="--c:${isDone(t, ds) ? '#8a8a8a' : t.color || catOf(t).color}" data-tid="${t.id}" data-d="${ds}">${esc(t.title)}</div>`).join('')}</div>`;
  h += `<div class="tl" data-day="${ds}" style="height:${24 * HPX}px">`;
  for (let i = 0; i < 24; i++) h += `<div class="tl-h" style="top:${i * HPX}px"><span>${faNum(pad(i))}:۰۰</span></div>`;
  if (ui.dayOff === 0) h += `<div class="tl-now" style="top:${nowMin() / 60 * HPX}px"></div>`;
  for (const x of ev) {
    const t = x.t, done = isDone(t, ds), c = done ? '#8a8a8a' : t.color || catOf(t).color;
    h += `<div class="tl-ev ${done ? 'done' : ''} ${x.e - x.s < 45 ? 'short' : ''}" data-tid="${t.id}" data-d="${ds}" style="--c:${c};top:${x.s / 60 * HPX}px;height:${(x.e - x.s) / 60 * HPX - 2}px;inset-inline-start:calc(52px + (100% - 56px) * ${x.lane / L});width:calc((100% - 56px) / ${L} - 4px)">
      <b>${esc(t.title)}</b><span>${faNum(t.time)} – ${faNum(m2t(x.e))}</span></div>`;
  }
  return h + '</div>';
};
$('#content').addEventListener('click', e => {
  const n = e.target.closest('[data-dnav]'); if (n) { e.stopPropagation(); ui.dayOff = +n.dataset.dnav ? ui.dayOff + +n.dataset.dnav : 0; ui.dayScrolled = false; return render(); }
}, true);
// tap → preview, drag (vertical) → new time, tap on empty → new task at that time
let tlDrag = null;
$('#content').addEventListener('pointerdown', e => {
  const el = e.target.closest('.tl-ev'); if (!el) return;
  tlDrag = { el, y0: e.clientY, top0: parseFloat(el.style.top), moved: false, id: el.dataset.tid, d: el.dataset.d };
  el.setPointerCapture(e.pointerId);
});
$('#content').addEventListener('pointermove', e => {
  if (!tlDrag) return; const dy = e.clientY - tlDrag.y0;
  if (!tlDrag.moved && Math.abs(dy) < 8) return;
  tlDrag.moved = true; e.preventDefault();
  const snapped = Math.round((tlDrag.top0 + dy) / HPX * 4) / 4 * HPX; tlDrag.el.style.top = Math.max(0, snapped) + 'px'; tlDrag.el.classList.add('dragging');
  tlDrag.el.querySelector('span').textContent = faNum(m2t(Math.round(Math.max(0, snapped) / HPX * 60)));
});
$('#content').addEventListener('pointerup', e => {
  if (!tlDrag) return; const g = tlDrag; tlDrag = null;
  let t = state.tasks.find(x => x.id === g.id); if (!t) return;
  if (!g.moved) return openPreview(t, g.d);
  const mins = Math.round(parseFloat(g.el.style.top) / HPX * 60 / 15) * 15;
  if (t.rec?.freq) t = splitOne(t, g.d); // moving one occurrence of a series moves only that day
  t.time = m2t(mins); t.dirty = true; commit(); toast('ساعت ' + faNum(t.time));
});
$('#content').addEventListener('click', e => {
  const chip = e.target.closest('.tl-chip'); if (chip) { e.stopPropagation(); const t = state.tasks.find(x => x.id === chip.dataset.tid) || periodTasks().find(x => x.id === chip.dataset.tid); return t && openPreview(t, chip.dataset.d); }
  const tl = e.target.closest('.tl'); if (!tl || e.target.closest('.tl-ev')) return;
  e.stopPropagation();
  const y = e.clientY - tl.getBoundingClientRect().top, mins = Math.floor(y / HPX * 4) * 15;
  openTask(null, tl.dataset.day); const f = $('#taskForm'); $('#allDay').checked = false; f.time.disabled = false; f.duration.disabled = false; f.time.value = m2t(mins); rems = [10]; drawRemPicker(); drawRems();
}, true);

/* ================= weekly review ================= */
EXTRA.review = list => {
  const t0 = ymd(new Date()), from = addDays(t0, -7), log = state.log || [];
  const doneWeek = log.filter(x => Date.now() - x.at < 7 * 864e5).length;
  const pending = state.tasks.filter(t => !t.rec?.freq && t.date && t.date < t0 && t.date >= addDays(t0, -30) && !t.done && !catOf(t).ro).sort((a, b) => b.date.localeCompare(a.date));
  const ws = +state.settings.weekStart, nd = new Date(); nd.setDate(nd.getDate() + (((ws - nd.getDay() + 7) % 7) || 7)); const nextWeek = ymd(nd);
  const days = Array.from({ length: 7 }, (_, i) => { const ds = addDays(nextWeek, i); return [ds, dayList(ds, list).length]; }), mx = Math.max(1, ...days.map(d => d[1]));
  return `<div class="kpis"><div><b>${faNum(doneWeek)}</b><span>کار انجام‌شده در ۷ روز اخیر</span></div><div><b>${faNum(pending.length)}</b><span>کار باقی‌مانده (۳۰ روز اخیر)</span></div></div>
    <div class="group"><h3>کارهای باقی‌مانده ${pending.length ? `<button class="ghost allmove" data-rv-all="${nextWeek}">همه به هفته‌ی بعد</button>` : ''}</h3>
    ${pending.map(t => `<div class="rv-row" style="--c:${t.color || catOf(t).color}"><div><b>${esc(t.title)}</b><small>${fmtDual(t.date, { day: 'numeric', month: 'short' })}</small></div>
      <button class="ghost" data-rv="${t.id}" data-to="${t0}">امروز</button><button class="ghost" data-rv="${t.id}" data-to="${nextWeek}">هفته بعد</button><button class="ghost" data-rv-done="${t.id}">✓</button></div>`).join('') || '<div class="empty" style="padding:24px"><b>🎉</b>همه کارها انجام شده</div>'}</div>
    <div class="group"><h3>هفته‌ی پیش‌رو</h3><div class="bars">${days.map(([ds, n]) => `<div><i style="height:${n / mx * 100}%"></i><span>${faNum(n || '')}</span><small>${fmtDate(ds, { weekday: 'short' })}</small></div>`).join('')}</div></div>`;
};
$('#content').addEventListener('click', e => {
  const m = e.target.closest('[data-rv]'), d = e.target.closest('[data-rv-done]'), all = e.target.closest('[data-rv-all]');
  if (!m && !d && !all) return; e.stopPropagation();
  if (m) { const t = state.tasks.find(x => x.id === m.dataset.rv); t.date = m.dataset.to; t.dirty = true; }
  if (d) { const t = state.tasks.find(x => x.id === d.dataset.rvDone); t.done = true; t.dirty = true; (state.log = state.log || []).push({ id: t.id, at: Date.now() }); }
  if (all && !confirm('همه‌ی کارهای باقی‌مانده به هفته‌ی بعد منتقل شوند؟ (در Google Calendar هم جابه‌جا می‌شوند)')) return;
  if (all) { const t0 = ymd(new Date()); for (const t of state.tasks) if (!t.rec?.freq && t.date && t.date < t0 && t.date >= addDays(t0, -30) && !t.done && !catOf(t).ro) { t.date = all.dataset.rvAll; t.dirty = true; } }
  commit();
}, true);

/* ================= habits ================= */
const HCOL = ['#22c55e', '#7c5cff', '#f97316', '#039be5', '#e64980', '#f6bf26'];
function streak(hb) { let n = 0; const d = new Date(); if (!hb.log?.[ymd(d)]) d.setDate(d.getDate() - 1); while (hb.log?.[ymd(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
EXTRA.habits = () => {
  const t0 = ymd(new Date());
  return `<button class="primary" data-hb-new style="margin-bottom:12px">＋ عادت جدید</button>` + (state.habits.map(hb => {
    const week = Array.from({ length: 7 }, (_, i) => addDays(t0, i - 6)), month = Array.from({ length: 35 }, (_, i) => addDays(t0, i - 34));
    return `<div class="hb" style="--c:${hb.color}"><div class="hb-top"><span class="hb-emo">${esc(hb.emoji || '✨')}</span><b>${esc(hb.name)}</b><span class="hb-st">🔥 ${faNum(streak(hb))}</span><button class="icon" data-hb-edit="${hb.id}">⋯</button></div>
      <div class="hb-week">${week.map(ds => `<button class="${hb.log?.[ds] ? 'on' : ''}" data-hb="${hb.id}" data-ds="${ds}"><small>${fmtDate(ds, { weekday: 'narrow' })}</small>${hb.log?.[ds] ? '✓' : faNum(fmtDate(ds, { day: 'numeric' }))}</button>`).join('')}</div>
      <div class="hb-map">${month.map(ds => `<i class="${hb.log?.[ds] ? 'on' : ''}" title="${ds}"></i>`).join('')}</div></div>`;
  }).join('') || '<div class="empty"><b>🌱</b>هنوز عادتی تعریف نکرده‌اید — مثلاً ورزش، آب خوردن، مطالعه</div>');
};
const hbDlg = sheet('hbDlg', `<form method="dialog" id="hbForm"><h2>عادت</h2>
  <div class="row"><label style="flex:0 0 70px">ایموجی<input name="emoji" maxlength="4"></label><label>نام<input name="name" required></label></div>
  <label>یادآوری روزانه (اختیاری)<input type="time" name="time"></label>
  <div class="swatches" id="hbCols"></div>
  <div class="actions"><button type="button" class="danger" id="hbDel">حذف</button><span class="grow"></span><button value="cancel" formnovalidate class="ghost">انصراف</button><button value="ok" class="primary">ذخیره</button></div></form>`);
let hbEdit = null, hbCol = HCOL[0];
function openHabit(hb) { hbEdit = hb; const f = $('#hbForm'); f.emoji.value = hb?.emoji || '💪'; f.name.value = hb?.name || ''; f.time.value = hb?.time || ''; hbCol = hb?.color || HCOL[state.habits.length % HCOL.length]; drawHbCols(); $('#hbDel').style.display = hb ? '' : 'none'; hbDlg.showModal(); }
function drawHbCols() { $('#hbCols').innerHTML = HCOL.map(c => `<button type="button" data-hbc="${c}" style="background:${c}" class="${c === hbCol ? 'on' : ''}"></button>`).join(''); }
$('#hbCols').onclick = e => { const c = e.target.dataset.hbc; if (c) { hbCol = c; drawHbCols(); } };
hbDlg.addEventListener('close', () => {
  if (hbDlg.returnValue !== 'ok') return; const f = $('#hbForm');
  const hb = hbEdit || { id: uid(), log: {}, created: ymd(new Date()) }; Object.assign(hb, { emoji: f.emoji.value, name: f.name.value.trim(), time: f.time.value, color: hbCol });
  if (!hbEdit) state.habits.push(hb); save(); render();
});
$('#hbDel').onclick = () => { if (!confirm('حذف شود؟')) return; state.habits = state.habits.filter(x => x !== hbEdit); hbDlg.close(); save(); render(); };
$('#content').addEventListener('click', e => {
  if (e.target.closest('[data-hb-new]')) { e.stopPropagation(); return openHabit(null); }
  const ed = e.target.closest('[data-hb-edit]'); if (ed) { e.stopPropagation(); return openHabit(state.habits.find(x => x.id === ed.dataset.hbEdit)); }
  const b = e.target.closest('[data-hb]'); if (!b) return; e.stopPropagation();
  const hb = state.habits.find(x => x.id === b.dataset.hb); hb.log ??= {}; if (hb.log[b.dataset.ds]) delete hb.log[b.dataset.ds]; else { hb.log[b.dataset.ds] = 1; playSound(state.settings.tickSound || 'marimba'); navigator.vibrate?.(20); }
  save(); render();
}, true);
// habit reminders → part of the normal reminder pipeline (local + background push)
const habitTasks = () => state.habits.filter(h => h.time).map(h => ({ id: 'hb-' + h.id, title: (h.emoji || '') + ' ' + h.name, date: h.created, time: h.time, rec: { freq: 'DAILY', interval: 1 }, reminders: [0], doneDates: Object.keys(h.log || {}), cat: '' }));
const _rt4 = reminderTasks; reminderTasks = () => _rt4().concat(habitTasks());

/* ================= countdowns ================= */
function countdownCards() {
  const t0 = ymd(new Date());
  const list = state.tasks.filter(t => t.countdown && t.date && t.date >= t0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  if (!list.length) return null;
  return h2el(`<div class="cds">${list.map(t => { const n = Math.round((parseYmd(t.date) - parseYmd(t0)) / 864e5);
    return `<div class="cd" style="--c:${t.color || catOf(t).color}" data-cd="${t.id}"><b>${n === 0 ? 'امروز!' : faNum(n)}</b><small>${n === 0 ? '' : 'روز تا'}</small><span>${esc(t.title)}</span></div>`; }).join('')}</div>`);
}
$('#content').addEventListener('click', e => { const c = e.target.closest('[data-cd]'); if (!c) return; e.stopPropagation(); const t = state.tasks.find(x => x.id === c.dataset.cd); openPreview(t, t.date); }, true);

/* ================= editor: countdown, template, free slot ================= */
const tf4 = $('#taskForm');
tf4.title.closest('label').insertAdjacentHTML('afterend', `<div class="row tools4"><button type="button" class="ghost" id="freeSlot">🔎 پیدا کردن زمان خالی</button><button type="button" class="ghost" id="saveTpl">💾 ذخیره به‌عنوان قالب</button><label class="check"><input type="checkbox" id="cdChk"> شمارش معکوس</label></div>`);
const _openTask4 = openTask; openTask = function (t, p) { _openTask4(t, p); $('#cdChk').checked = !!t?.countdown; };
$('#taskDlg').addEventListener('close', () => { if ($('#taskDlg').returnValue !== 'ok') return; const t = editing || state.tasks[state.tasks.length - 1]; if (t) { t.countdown = $('#cdChk').checked; save(); } });
$('#freeSlot').onclick = () => {
  const dur = +tf4.duration.value || 30, list = filtered();
  for (let i = 0; i < 14; i++) {
    const ds = addDays(ymd(new Date()), i);
    const busy = dayList(ds, list).filter(t => t.time && t !== editing && !isDone(t, ds)).map(t => [t2m(t.time), t2m(t.time) + (t.duration || 30)]).sort((a, b) => a[0] - b[0]);
    let s = i === 0 ? Math.max(8 * 60, Math.ceil((nowMin() + 15) / 15) * 15) : 8 * 60;
    for (const [bs, be] of busy) { if (s + dur <= bs) break; if (be > s) s = Math.ceil(be / 15) * 15; }
    if (s + dur <= 22 * 60) { tf4.date.value = ds; $('#allDay').checked = false; tf4.time.disabled = false; tf4.duration.disabled = false; tf4.time.value = m2t(s); drawRemPicker(); drawRems(); toast('🔎 ' + fmtDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }) + ' ساعت ' + faNum(m2t(s))); return; }
  }
  toast('در دو هفته‌ی آینده زمان خالی پیدا نشد');
};
$('#saveTpl').onclick = () => {
  const f = tf4; if (!f.title.value.trim()) return toast('اول عنوان را بنویسید');
  state.templates.push({ id: uid(), title: f.title.value.trim(), notes: f.notes.value, cat: f.cat.value, time: f.time.value, duration: +f.duration.value || 30, reminders: [...rems], prio: +f.prio.value, tags: f.tags.value.split(/[,،]/).map(x => x.trim()).filter(Boolean), subs: (HOOK.getSubs?.() || []).map(s => ({ t: s.t, done: false })) });
  save(); toast('قالب ذخیره شد');
};
/* ---------- templates picker (📋 next to quick add) ---------- */
const tplBtn = h2el('<button type="button" class="mic tplbtn" aria-label="templates">📋</button>'); $('#quickAdd').appendChild(tplBtn);
const tplDlg = sheet('tplDlg', `<div class="pv"><div class="pv-head"><h2>قالب‌ها</h2><button class="icon" data-tpl-close>✕</button></div><div id="tplList"></div></div>`);
tplBtn.onclick = () => {
  $('#tplList').innerHTML = state.templates.map(t => `<div class="rv-row"><div><b>${esc(t.title)}</b><small>${t.time ? faNum(t.time) : 'تمام روز'}${t.subs?.length ? ' · ☑️ ' + faNum(t.subs.length) : ''}</small></div><button class="primary" data-tpl="${t.id}">＋ امروز</button><button class="icon" data-tpl-del="${t.id}">✕</button></div>`).join('')
    || '<div class="empty" style="padding:20px">هنوز قالبی ندارید. در فرم کار «💾 ذخیره به‌عنوان قالب» را بزنید.</div>';
  tplDlg.showModal();
};
tplDlg.addEventListener('click', e => {
  if (e.target.closest('[data-tpl-close]')) return tplDlg.close();
  const d = e.target.closest('[data-tpl-del]'); if (d) { state.templates = state.templates.filter(x => x.id !== d.dataset.tplDel); save(); return tplBtn.onclick(); }
  const a = e.target.closest('[data-tpl]'); if (!a) return;
  const tp = state.templates.find(x => x.id === a.dataset.tpl);
  state.tasks.push({ ...structuredClone(tp), id: uid(), date: ymd(new Date()), rec: {}, created: Date.now(), dirty: true });
  tplDlg.close(); commit(); toast('✓ ' + tp.title);
});
render();
