/* روزنگار — extra features: subtasks, Persian quick-add, week view (drag & drop),
   stats, Jalali month + Iran holidays, focus timer, custom sound, snooze */
'use strict';

/* ---------- custom sound ---------- */
SOUNDS.custom = { name: 'زنگ دلخواه (آپلودی)', notes: [] };
$('#soundFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 700 * 1024) return toast('فایل بزرگ‌تر از ۷۰۰ کیلوبایت است');
  const r = new FileReader();
  r.onload = () => { state.settings.customSound = r.result; save(); playSound('custom'); toast('زنگ دلخواه ذخیره شد — در فهرست زنگ‌ها «زنگ دلخواه» را انتخاب کنید'); };
  r.readAsDataURL(f);
};

/* ---------- task color input ---------- */
$('#taskForm').color.oninput = e => { e.target.dataset.touched = '1'; };

/* ---------- subtasks ---------- */
let subs = [];
function drawSubs() {
  $('#subList').innerHTML = subs.map((s, i) => `<div class="sub ${s.done ? 'done' : ''}"><button type="button" data-sub="${i}" class="chk sm">${s.done ? '✓' : ''}</button><span>${esc(s.t)}</span><button type="button" class="icon" data-subdel="${i}">✕</button></div>`).join('');
  $('#subProg').textContent = subs.length ? `(${faNum(subs.filter(s => s.done).length)}/${faNum(subs.length)})` : '';
}
HOOK.openSubs = list => { subs = list.map(s => ({ ...s })); drawSubs(); };
HOOK.getSubs = () => subs;
const addSub = () => { const v = $('#subNew').value.trim(); if (v) { subs.push({ t: v, done: false }); $('#subNew').value = ''; drawSubs(); } };
$('#subAdd').onclick = addSub;
$('#subNew').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } };
$('#subList').onclick = e => {
  const i = e.target.dataset.sub, d = e.target.dataset.subdel;
  if (i != null) subs[i].done = !subs[i].done;
  if (d != null) subs.splice(+d, 1);
  drawSubs();
};

/* ---------- Persian natural-language quick add ---------- */
const toLat = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const WD = [['پنج ?شنبه', 4], ['چهار ?شنبه', 3], ['سه[‌ ]?شنبه', 2], ['دو ?شنبه', 1], ['یک ?شنبه', 0], ['جمعه', 5], ['شنبه', 6]];
HOOK.parseQuick = raw => {
  let s = ' ' + toLat(raw) + ' ', out = {};
  const cut = re => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  // recurrence
  let m;
  if (cut(/\sهر\s?روز\s/)) out.rec = { freq: 'DAILY', interval: 1 };
  else if (cut(/\sهر\s?هفته\s/)) out.rec = { freq: 'WEEKLY', interval: 1, days: [] };
  else if (cut(/\sهر\s?ماه\s/)) out.rec = { freq: 'MONTHLY', interval: 1 };
  else if (cut(/\sهر\s?سال\s/)) out.rec = { freq: 'YEARLY', interval: 1 };
  else for (const [w, n] of WD) if ((m = cut(new RegExp('\\sهر\\s(' + w + ')\\s')))) {
    out.rec = { freq: 'WEEKLY', interval: 1, days: [DAYS[n]] };
    const d = new Date(); d.setDate(d.getDate() + ((n - d.getDay() + 7) % 7)); out.date = ymd(d); break;
  }
  // day
  if (cut(/\sپس[‌ ]?فردا\s/)) out.date = day(2);
  else if (cut(/\sفردا\s/)) out.date = day(1);
  else if (cut(/\sامروز\s/)) out.date = day(0);
  else if (!out.date) for (const [w, n] of WD) if (cut(new RegExp('\\s(' + w + ')(\\sآینده)?\\s'))) {
    const d = new Date(); d.setDate(d.getDate() + (((n - d.getDay() + 7) % 7) || 7)); out.date = ymd(d); break;
  }
  if ((m = cut(/\s(\d{1,2})\s?روز\sدیگه?\s/))) out.date = day(+m[1]);
  // time
  if ((m = cut(/\sساعت\s?(\d{1,2})(?:[:.٫](\d{2}))?\s?(صبح|ظهر|بعد\s?از\s?ظهر|بعدازظهر|عصر|شب)?\s/))) {
    let h = +m[1]; const mm = m[2] || '00', p = m[3] || '';
    if (/عصر|شب|بعد/.test(p) && h < 12) h += 12;
    if (/ظهر/.test(p) && !/بعد/.test(p) && h < 6) h += 12;
    if (!p && h >= 1 && h <= 6) h += 12; // «ساعت ۵» → ۱۷ by default
    out.time = `${pad(h % 24)}:${mm}`;
  }
  // category / tags / priority
  s = s.replace(/#([^\s#]+)/g, (_, name) => {
    const n = name.replace(/_/g, ' '), c = state.cats.find(c => c.name === n);
    if (c) out.cat = c.id; else (out.tags = out.tags || []).push(n);
    return ' ';
  });
  if (/!!/.test(s)) out.prio = 2; else if (/!/.test(s)) out.prio = 1;
  s = s.replace(/!+/g, ' ');
  out.title = s.replace(/\s+/g, ' ').trim() || raw;
  return out;
};

/* ---------- Jalali helpers & Iran official (solar) holidays ---------- */
const jfmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const jparts = d => { const o = {}; for (const p of jfmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = +p.value; return o; };
const HOLI = { '1-1': 'نوروز', '1-2': 'نوروز', '1-3': 'نوروز', '1-4': 'نوروز', '1-12': 'روز جمهوری اسلامی', '1-13': 'سیزده‌بدر', '3-14': 'رحلت امام خمینی', '3-15': 'قیام ۱۵ خرداد', '11-22': 'پیروزی انقلاب', '12-29': 'ملی شدن صنعت نفت' };
// religious (lunar) holidays — Hijri date via Intl; Iran's official dates can differ by a day
const hfmt = new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn', { month: 'numeric', day: 'numeric' });
const hparts = d => { const o = {}; for (const p of hfmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = +p.value; return o; };
const HOLI_H = { '1-9': 'تاسوعا', '1-10': 'عاشورا', '2-20': 'اربعین', '2-28': 'رحلت پیامبر و شهادت امام حسن', '2-30': 'شهادت امام رضا', '3-8': 'شهادت امام حسن عسکری',
  '3-17': 'میلاد پیامبر و امام صادق', '6-3': 'شهادت حضرت فاطمه', '7-13': 'ولادت امام علی', '7-27': 'مبعث', '8-15': 'نیمه شعبان', '9-21': 'شهادت امام علی',
  '10-1': 'عید فطر', '10-2': 'تعطیل عید فطر', '10-25': 'شهادت امام صادق', '12-10': 'عید قربان', '12-18': 'عید غدیر' };
const holidayOf = d => {
  if (!state.settings.holidays) return '';
  const j = jparts(d), solar = HOLI[j.month + '-' + j.day] || '';
  const h = hparts(d); let n = HOLI_H[h.month + '-' + h.day];
  if (!n && h.month === 2 && h.day === 29) { const nx = new Date(d); nx.setDate(nx.getDate() + 1); if (hparts(nx).month === 3) n = HOLI_H['2-30']; } // Safar may have 29 days
  return [solar, n ? n + ' (تقریبی)' : ''].filter(Boolean).join(' · ');
};

/* month view: real Jalali month grid when calendar = persian */
const _gregMonth = monthHTML;
monthHTML = function (list) {
  if (state.settings.calendar !== 'persian') return _gregMonth(list);
  const ref = ui.month, j = jparts(ref);
  const first = new Date(ref); first.setDate(ref.getDate() - (j.day - 1));
  const ws = +state.settings.weekStart, start = new Date(first); start.setDate(first.getDate() - ((first.getDay() - ws + 7) % 7));
  const title = new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(first), today = ymd(new Date());
  let h = `<div class="mnav"><button class="ghost" data-jnav="-1">→</button><b>${title}</b><button class="ghost" data-jnav="1">←</button><button class="ghost" data-jnav="0">امروز</button></div><div class="month">`;
  for (let i = 0; i < 7; i++) h += `<div class="h">${new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(2024, 0, 7 + (ws + i) % 7))}</div>`;
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const s = ymd(d), items = dayList(s, list), jp = jparts(d), hol = holidayOf(d);
    if (i === 35 && jp.month !== j.month) break;
    h += `<div class="mday ${jp.month !== j.month ? 'out' : ''} ${s === today ? 'today' : ''} ${s === ui.selDay ? 'sel' : ''} ${hol || d.getDay() === 5 ? 'hol' : ''}" data-day="${s}" title="${hol}"><div class="num">${faNum(jp.day)}${hol ? ' <small>' + hol + '</small>' : ''}</div>
      ${items.slice(0, 3).map(t => `<div class="ev" style="--c:${t.color || catOf(t).color}">${t.time ? faNum(t.time) + ' ' : ''}${esc(t.title)}</div>`).join('')}${items.length > 3 ? `<div class="muted more">+${faNum(items.length - 3)}</div>` : ''}
      <div class="dots">${items.slice(0, 4).map(t => `<i style="background:${t.color || catOf(t).color}"></i>`).join('')}</div></div>`;
  }
  h += '</div>';
  // phone: tapped day's agenda under the grid
  if (isPhone()) {
    const sd = ui.selDay || today, items = dayList(sd, list), hol = holidayOf(parseYmd(sd));
    h += `<div class="group agenda"><h3>${fmtDate(sd)}${hol ? ' · <span style="color:#ef4444">' + hol + '</span>' : ''}</h3>${items.map(t => taskHTML(t, sd)).join('') || '<div class="empty" style="padding:24px"><b>🌿</b>کاری نیست</div>'}
      <button class="ghost wadd" data-wadd="${sd}" style="width:100%">＋ افزودن کار برای این روز</button></div>`;
  }
  return h;
};
const isPhone = () => matchMedia('(max-width: 820px)').matches;
// on phones a tap selects the day (agenda below); on larger screens it opens the editor
$('#content').addEventListener('click', e => {
  const md = e.target.closest('.mday'); if (!md || !isPhone() || state.settings.calendar !== 'persian') return;
  e.stopPropagation(); ui.selDay = md.dataset.day; render();
  document.querySelector('.agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, true);

/* ---------- side menu backdrop (tap outside to close) ---------- */
const side = document.querySelector('.side'), backdrop = $('#backdrop');
new MutationObserver(() => backdrop.classList.toggle('on', side.classList.contains('open'))).observe(side, { attributes: true, attributeFilter: ['class'] });
backdrop.onclick = () => side.classList.remove('open');

/* ---------- Jalali hint under native date inputs ---------- */
function drawJHints() {
  document.querySelectorAll('.jhint').forEach(h => {
    const v = $('#taskForm')[h.dataset.for].value;
    h.textContent = v && state.settings.calendar === 'persian' ? new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseYmd(v)) : '';
  });
}
['date', 'until'].forEach(n => $('#taskForm')[n].addEventListener('input', drawJHints));
$('#taskDlg').addEventListener('toggle', drawJHints);
const _openTask = openTask; openTask = function (...a) { _openTask(...a); drawJHints(); };
$('#content').addEventListener('click', e => {
  const b = e.target.closest('[data-jnav]'); if (!b) return;
  e.stopPropagation();
  const n = +b.dataset.jnav;
  if (!n) ui.month = new Date();
  else { const j = jparts(ui.month), d = new Date(ui.month); d.setDate(d.getDate() - j.day + 1 + (n > 0 ? 32 : -2)); ui.month = d; }
  render();
}, true);

/* ---------- week view with drag & drop ---------- */
ui.weekOff = 0;
EXTRA.week = list => {
  const ws = +state.settings.weekStart, now = new Date(), start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() - ws + 7) % 7) + ui.weekOff * 7);
  const today = ymd(new Date());
  let h = `<div class="mnav"><button class="ghost" data-wnav="-1">→</button><b>${fmtDate(ymd(start), { day: 'numeric', month: 'long' })} تا ${fmtDate(ymd(new Date(start.getTime() + 6 * 864e5)), { day: 'numeric', month: 'long' })}</b><button class="ghost" data-wnav="1">←</button><button class="ghost" data-wnav="0">این هفته</button></div><div class="week">`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const s = ymd(d), hol = holidayOf(d);
    h += `<div class="wcol ${s === today ? 'today' : ''} ${hol || d.getDay() === 5 ? 'hol' : ''}" data-dropday="${s}">
      <div class="wh"><b>${fmtDate(s, { weekday: 'long' })}</b><span>${fmtDate(s, { day: 'numeric', month: 'short' })}</span>${hol ? `<small>${hol}</small>` : ''}</div>
      ${dayList(s, list).map(t => taskHTML(t, s)).join('')}
      <button class="ghost wadd" data-wadd="${s}">＋</button></div>`;
  }
  return h + '</div><p class="muted" style="font-size:12px">کارها را با کشیدن بین روزها جابه‌جا کنید.</p>';
};
$('#content').addEventListener('click', e => {
  const w = e.target.closest('[data-wnav]'); if (w) { e.stopPropagation(); const n = +w.dataset.wnav; ui.weekOff = n ? ui.weekOff + n : 0; return render(); }
  const a = e.target.closest('[data-wadd]'); if (a) { e.stopPropagation(); openTask(null, a.dataset.wadd); }
}, true);
let dragId = null;
$('#content').addEventListener('dragstart', e => { const t = e.target.closest('.task'); if (t) { dragId = t.dataset.id; e.dataTransfer.effectAllowed = 'move'; t.classList.add('dragging'); } });
$('#content').addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
$('#content').addEventListener('dragover', e => { const c = e.target.closest('[data-dropday],[data-day]'); if (c && dragId) { e.preventDefault(); document.querySelectorAll('.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
$('#content').addEventListener('drop', e => {
  const c = e.target.closest('[data-dropday],[data-day]'); if (!c || !dragId) return; e.preventDefault();
  const t = state.tasks.find(x => x.id === dragId), day = c.dataset.dropday || c.dataset.day;
  if (!t) return;
  if (t.rec?.freq) { const diff = Math.round((parseYmd(day) - parseYmd(e.dataTransfer.getData('d') || t.date)) / 864e5); if (!confirm('این کار تکراری است؛ شروع کل تکرارها جابه‌جا شود؟')) return; const nd = parseYmd(t.date); nd.setDate(nd.getDate() + diff); t.date = ymd(nd); }
  else t.date = day;
  t.dirty = true; t.updated = Date.now(); commit(); toast('جابه‌جا شد');
});

/* ---------- stats ---------- */
EXTRA.stats = () => {
  const log = state.log || [], days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const s = ymd(d); days.push([s, log.filter(x => ymd(new Date(x.at)) === s).length]); }
  const max = Math.max(1, ...days.map(d => d[1]));
  let streak = 0; for (let i = days.length - 1; i >= 0 && days[i][1] > 0; i--) streak++;
  const open = state.tasks.filter(t => !t.done && !t.rec?.freq).length, week = days.slice(-7).reduce((a, d) => a + d[1], 0);
  const today = ymd(new Date()), overdue = state.tasks.filter(t => !t.rec?.freq && t.date && t.date < today && t.date >= (state.settings.overdueFrom || '') && !t.done).length;
  const focus = (state.focusLog || []).filter(x => Date.now() - x.at < 7 * 864e5).reduce((a, x) => a + x.min, 0);
  let h = `<div class="kpis">
    <div><b>${faNum(week)}</b><span>انجام‌شده در ۷ روز</span></div>
    <div><b>${faNum(streak)} 🔥</b><span>روز پشت‌سرهم</span></div>
    <div><b>${faNum(open)}</b><span>کار باز</span></div>
    <div><b>${faNum(overdue)}</b><span>عقب‌افتاده</span></div>
    <div><b>${faNum(focus)}</b><span>دقیقه تمرکز این هفته</span></div></div>
    <div class="group"><h3>۱۴ روز اخیر</h3><div class="bars">${days.map(([s, n]) => `<div title="${fmtDate(s)}: ${faNum(n)}"><i style="height:${n / max * 100}%"></i><span>${faNum(n || '')}</span><small>${fmtDate(s, { day: 'numeric' })}</small></div>`).join('')}</div></div>
    <div class="group"><h3>بر اساس دسته</h3>`;
  for (const c of state.cats) {
    const all = state.tasks.filter(t => t.cat === c.id), done = all.filter(t => t.done).length;
    if (!all.length) continue;
    h += `<div class="catbar"><span><span class="dot" style="background:${c.color}"></span> ${esc(c.name)}</span><div><i style="width:${done / all.length * 100}%;background:${c.color}"></i></div><small>${faNum(done)}/${faNum(all.length)}</small></div>`;
  }
  return h + '</div>';
};

/* ---------- focus (pomodoro) ---------- */
let fTimer = null, fLeft = 0, fTask = null, fPaused = false;
function fDraw() { $('#focusTime').textContent = faNum(`${pad(Math.floor(fLeft / 60))}:${pad(fLeft % 60)}`); document.title = `${pad(Math.floor(fLeft / 60))}:${pad(fLeft % 60)} · روزنگار`; }
function fEnd(complete) {
  clearInterval(fTimer); $('#focus').hidden = true; document.title = 'روزنگار';
  if (complete) { (state.focusLog = state.focusLog || []).push({ id: fTask?.id, at: Date.now(), min: state.settings.focusMin }); save(); notify({ title: '🍅 پایان زمان تمرکز', body: (fTask?.title || '') + ' — یک استراحت کوتاه!', sound: state.settings.sound, tag: 'focus' }); }
}
$('#focusBtn').onclick = () => {
  fTask = editing || { title: $('#taskForm').title.value };
  $('#taskDlg').close(); fLeft = state.settings.focusMin * 60; fPaused = false;
  $('#focusTitle').textContent = '🍅 ' + (fTask.title || 'تمرکز'); $('#focus').hidden = false; fDraw();
  clearInterval(fTimer); fTimer = setInterval(() => { if (fPaused) return; fLeft--; fDraw(); if (fLeft <= 0) fEnd(true); }, 1000);
};
$('#focusPause').onclick = () => { fPaused = !fPaused; $('#focusPause').textContent = fPaused ? '▶ ادامه' : '⏸ توقف'; };
$('#focusStop').onclick = () => fEnd(false);

/* ---------- snooze / done from notification ---------- */
function markDone(id, d) {
  const t = state.tasks.find(x => x.id === id); if (!t) return;
  if (t.rec?.freq) { t.doneDates = [...new Set([...(t.doneDates || []), d])]; } else t.done = true;
  (state.log = state.log || []).push({ id, at: Date.now() }); t.dirty = true; commit(); toast('✓ ' + t.title);
}
HOOK.swMessage = msg => {
  if (!msg?.tag || !msg.tag.includes('|')) return;
  const [id, d] = msg.tag.split('|');
  if (msg.type === 'done') markDone(id, d);
  if (msg.type === 'snooze') { (state.snoozes = state.snoozes || []).push({ id, d, at: Date.now() + state.settings.snoozeMin * 6e4 }); save(); toast(`⏰ ${faNum(state.settings.snoozeMin)} دقیقه دیگر یادآوری می‌شود`); }
};
setInterval(() => {
  const now = Date.now(), due = (state.snoozes || []).filter(s => s.at <= now);
  if (!due.length) return;
  state.snoozes = state.snoozes.filter(s => s.at > now); save();
  for (const s of due) { const t = state.tasks.find(x => x.id === s.id); if (t && !isDone(t, s.d)) notify({ title: '⏰ ' + t.title, body: 'یادآوری دوباره', sound: t.sound || catOf(t).sound || state.settings.sound, tag: `${t.id}|${s.d}|s${s.at}` }); }
}, 15e3);
// actions chosen while the app was closed arrive as ?act=done|snooze&tag=...
(() => { const q = new URLSearchParams(location.search); if (q.get('act')) { HOOK.swMessage({ type: q.get('act'), tag: q.get('tag') }); history.replaceState(null, '', location.pathname); } })();

render();

/* ---------- Web Push: reminders even when the app is closed (iPhone / iPad / Apple Watch) ---------- */
const PUSH_PUB = 'BFWp_6mRsqW1G8nTwkh6fvCDfTWvXTFPMe-Cl3pnW6RrVBLff5GCzxibmpxw2YI6IJ_gTbMyFwFAa9DXIk80e2M';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const b64uToBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function pushSub() { try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch { return null; } }
function pushStateText(t, ok) { const e = $('#pushState'); if (e) { e.textContent = t; e.style.color = ok ? '#22c55e' : ''; } }
async function refreshPushUI() {
  const btn = $('#pushBtn'); if (!btn) return;
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    btn.disabled = true;
    return pushStateText(isIOS && !isStandalone() ? 'در آیفون/آیپد اول برنامه را نصب کنید: در Safari دکمه‌ی Share ← Add to Home Screen، بعد برنامه را از صفحه‌ی اصلی باز کنید.' : 'این مرورگر از اعلان پس‌زمینه پشتیبانی نمی‌کند.');
  }
  const sub = await pushSub();
  if (sub && state.settings.push) { btn.textContent = '🔕 خاموش کردن یادآوری پس‌زمینه'; pushStateText('✓ فعال است — یادآوری‌ها حتی با برنامه‌ی بسته می‌آیند (و روی Apple Watch هم نمایش داده می‌شوند).', true); }
  else { btn.textContent = '🔔 فعال‌سازی یادآوری در پس‌زمینه'; }
}
$('#pushBtn').onclick = async () => {
  try {
    const sub = await pushSub();
    if (sub && state.settings.push) { // turn off
      await fetch('push/subscribe.php', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint, remove: true }) }).catch(() => { });
      await sub.unsubscribe(); state.settings.push = false; save(); toast('یادآوری پس‌زمینه خاموش شد'); return refreshPushUI();
    }
    if (await Notification.requestPermission() !== 'granted') return toast('اجازه‌ی اعلان داده نشد');
    const reg = await navigator.serviceWorker.ready;
    const s = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(PUSH_PUB) });
    state.settings.push = true; save(); lastUpload = ''; await uploadReminders();
    toast('✓ یادآوری پس‌زمینه فعال شد'); refreshPushUI();
  } catch (e) { console.error(e); toast('خطا: ' + e.message); }
};
// upcoming reminders (next 7 days) for this device → server
function upcomingReminders() {
  const out = [], now = Date.now();
  for (let off = 0; off <= 9; off++) {
    const d = new Date(); d.setDate(d.getDate() + off); const ds = ymd(d);
    for (const t of reminderTasks()) {
      if (!t.reminders?.length || !occursOn(t, ds) || isDone(t, ds)) continue;
      if (hiddenCat(t)) continue;
      const start = remStart(t, d);
      for (const m of t.reminders) {
        const at = start - m * 6e4; if (at < now - 6e4) continue;
        out.push({ k: `${t.id}|${ds}|${m}`, at, title: t.title, body: t.time ? (m ? remLabel(m) + ' — ' : '') + 'ساعت ' + faNum(t.time) : '☀️ تمام روز — ' + fmtDate(ds) });
      }
    }
  }
  for (const s of state.snoozes || []) { const t = state.tasks.find(x => x.id === s.id); if (t) out.push({ k: `${t.id}|${s.d}|s${s.at}`, at: s.at, title: '⏰ ' + t.title, body: 'یادآوری دوباره' }); }
  return out.sort((a, b) => a.at - b.at).slice(0, 400);
}
let lastUpload = '', upTimer;
async function uploadReminders() {
  if (!state.settings.push) return;
  const sub = await pushSub(); if (!sub) return;
  const items = upcomingReminders(), sig = sub.endpoint + JSON.stringify(items);
  if (sig === lastUpload) return;
  const r = await fetch('push/subscribe.php', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint, items }) }).catch(() => null);
  if (r?.ok) lastUpload = sig;
}
const _render = render; render = function () { _render(); clearTimeout(upTimer); upTimer = setTimeout(uploadReminders, 3000); };
setInterval(() => { lastUpload = ''; uploadReminders(); }, 6 * 3600e3); // keep the 7-day window fresh
// while the app is open, push shows the system notification; avoid a duplicate local one
const _notify = notify; notify = function (o) {
  if (state.settings.push && o.tag && o.tag.includes('|') && Notification.permission === 'granted') { playSound(o.sound); if (!document.hidden) toast('🔔 ' + o.title); return; }
  return _notify(o);
};
$('#openSettings').addEventListener('click', refreshPushUI);
refreshPushUI();
