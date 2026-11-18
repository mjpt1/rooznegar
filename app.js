/* روزنگار — Todo PWA with Google Calendar two-way sync */
'use strict';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
// Google Calendar event colors (colorId 1..11)
const GCOLORS = { 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e', 7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000' };
const SWATCH = ['#7c5cff', '#ff6fb5', '#ef4444', '#f97316', '#f6bf26', '#22c55e', '#14b8a6', '#039be5', '#3f51b5', '#8e24aa', '#616161', '#a16207'];

/* ---------- sounds (synthesized, no files needed) ---------- */
const SOUNDS = {
  chime: { name: 'زنگوله', notes: [[880, 0, .5], [1320, .15, .6], [1760, .3, .8]], type: 'sine' },
  bell: { name: 'ناقوس', notes: [[523, 0, 1.4], [659, 0, 1.4], [784, 0, 1.4]], type: 'triangle' },
  digital: { name: 'دیجیتال', notes: [[1000, 0, .1], [1000, .2, .1], [1000, .4, .1], [1000, .6, .1]], type: 'square' },
  marimba: { name: 'ماریمبا', notes: [[659, 0, .3], [784, .12, .3], [988, .24, .3], [1319, .36, .5]], type: 'sine' },
  soft: { name: 'نرم', notes: [[440, 0, 1.2], [554, .4, 1.2]], type: 'sine' },
  alarm: { name: 'هشدار', notes: Array.from({ length: 8 }, (_, i) => [i % 2 ? 700 : 950, i * .15, .14]), type: 'sawtooth' },
  bird: { name: 'پرنده', notes: [[2000, 0, .08], [2600, .1, .08], [2200, .25, .08], [2900, .35, .1]], type: 'sine' },
  none: { name: 'بی‌صدا', notes: [] }
};
let actx;
function playSound(key) {
  if (key === 'custom' && state.settings.customSound) { const a = new Audio(state.settings.customSound); a.volume = state.settings.volume; a.play().catch(() => { }); return; }
  const s = SOUNDS[key] || SOUNDS.chime; if (!s.notes?.length) return;
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const vol = state.settings.volume, t0 = actx.currentTime + .02;
  for (const [f, at, dur] of s.notes) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = s.type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol * .4, t0 + at + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + at + dur);
    o.connect(g).connect(actx.destination); o.start(t0 + at); o.stop(t0 + at + dur + .05);
  }
}

/* ---------- state ---------- */
// device-based defaults: time zone & language come from the phone/computer the app runs on
const DEV = (() => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '', langs = navigator.languages || [navigator.language || 'en'];
  const iran = tz === 'Asia/Tehran' || langs.some(l => /^fa/i.test(l));
  let weekStart = iran ? 6 : 0;
  try { const wi = new Intl.Locale(langs[0]).weekInfo || new Intl.Locale(langs[0]).getWeekInfo?.(); if (!iran && wi?.firstDay) weekStart = wi.firstDay % 7; } catch { }
  return { tz, iran, weekStart, lang: langs.some(l => /^fa/i.test(l)) || tz === 'Asia/Tehran' ? 'fa' : 'en' };
})();
const DEFAULT = {
  tasks: [], cats: [
    { id: 'work', name: 'کار', color: '#7c5cff', sound: 'chime' },
    { id: 'home', name: 'شخصی', color: '#22c55e', sound: 'marimba' },
    { id: 'health', name: 'سلامتی', color: '#ef4444', sound: 'bell' }],
  settings: { theme: 'auto', accent: '#7c5cff', radius: 16, calendar: DEV.iran ? 'persian' : 'gregory', weekStart: DEV.weekStart, lang: DEV.lang, clientId: '696930482825-uc571dlfmps2dvupc1v5a8t5g6gmh8oa.apps.googleusercontent.com', calendarId: 'primary', syncEvery: 30, sound: 'chime', volume: .7, vibrate: true, focusMin: 25, snoozeMin: 10, holidays: true, customSound: '' },
  sync: { token: null, syncToken: null, deleted: [] }, fired: {}
};
let state;
try { state = Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem('rooznegar') || '{}')); } catch { state = structuredClone(DEFAULT); }
state.settings = Object.assign({}, DEFAULT.settings, state.settings);
if (!state.settings.clientId) state.settings.clientId = DEFAULT.settings.clientId;
// Large blobs (custom sound / background photo, ~1 MB as data URLs) live under their own keys so
// they can never push the main state over the localStorage quota (a failed save = silent data loss).
const BLOB_KEYS = { customSound: 'rooznegar:snd', bgImage: 'rooznegar:bg' };
for (const [k, key] of Object.entries(BLOB_KEYS)) { try { const v = localStorage.getItem(key); if (v != null && !state.settings[k]) state.settings[k] = v; } catch { } }
const blobSaved = {};
let saveWarned = false;
const save = () => {
  const s = state.settings, held = {};
  try {
    for (const [k, key] of Object.entries(BLOB_KEYS)) {
      held[k] = s[k]; delete s[k];
      if (blobSaved[k] !== held[k]) {
        try { if (held[k]) localStorage.setItem(key, held[k]); else localStorage.removeItem(key); blobSaved[k] = held[k]; }
        catch { if (!saveWarned) { saveWarned = true; setTimeout(() => toast('حافظه‌ی دستگاه پر است — عکس پس‌زمینه یا زنگ دلخواه ذخیره نشد'), 0); } }
      }
    }
    localStorage.setItem('rooznegar', JSON.stringify(state));
  } catch (e) {
    console.error('save failed', e);
    if (!saveWarned) { saveWarned = true; setTimeout(() => toast('⚠️ ذخیره نشد: حافظه‌ی دستگاه پر است'), 0); }
  } finally { for (const k in held) if (held[k] !== undefined) s[k] = held[k]; }
};
for (const k in BLOB_KEYS) blobSaved[k] = undefined; // first save() moves blobs out of the main key
const EXTRA = {}, HOOK = {};
const ui = { view: 'today', cat: null, q: '', month: new Date() };

/* ---------- recurrence ---------- */
function occursOn(t, dateStr) {
  if (!t.date) return false;
  if (dateStr < t.date) return false;
  const r = t.rec; if (!r || !r.freq) return dateStr === t.date;
  if (r.until && dateStr > r.until) return false;
  if ((t.exdates || []).includes(dateStr)) return false;
  const a = parseYmd(t.date), b = parseYmd(dateStr), n = r.interval || 1;
  const dd = Math.round((b - a) / 864e5);
  switch (r.freq) {
    case 'DAILY': return dd % n === 0;
    case 'WEEKLY': {
      const days = r.days?.length ? r.days : [DAYS[a.getDay()]];
      if (!days.includes(DAYS[b.getDay()])) return false;
      // weeks start on Monday (RFC 5545 / Google default WKST=MO) so INTERVAL>1 matches Google
      const wk = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
      return Math.round((wk(b) - wk(a)) / 6048e5) % n === 0;
    }
    case 'MONTHLY': {
      const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
      if (months % n) return false;
      // BYDAY=2TU / -1FR ("second Tuesday", "last Friday") imported from Google
      if (r.nth) {
        if (DAYS[b.getDay()] !== r.nth.day) return false;
        const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
        return r.nth.n > 0 ? Math.ceil(b.getDate() / 7) === r.nth.n : Math.floor((last - b.getDate()) / 7) === -r.nth.n - 1;
      }
      return b.getDate() === a.getDate();
    }
    case 'YEARLY': return b.getDate() === a.getDate() && b.getMonth() === a.getMonth() && (b.getFullYear() - a.getFullYear()) % n === 0;
  }
  return false;
}
const isDone = (t, d) => t.rec?.freq ? (t.doneDates || []).includes(d) : !!t.done;
const recSig = r => JSON.stringify([r?.freq || '', +r?.interval || 1, [...(r?.days || [])].sort(), r?.until || '', r?.nth || null]);
function toRRule(r, allDay) {
  if (!r?.freq) return null;
  // a rule imported from Google with parts we don't model (COUNT, BYMONTHDAY, BYSETPOS…) goes back
  // untouched as long as the user didn't change the repeat settings — never silently rewrite it
  if (r.raw && r.raw.sig === recSig(r)) return r.raw.line;
  let s = `RRULE:FREQ=${r.freq}`;
  if (r.interval > 1) s += `;INTERVAL=${r.interval}`;
  if (r.freq === 'WEEKLY' && r.days?.length) s += `;BYDAY=${r.days.join(',')}`;
  if (r.freq === 'MONTHLY' && r.nth) s += `;BYDAY=${r.nth.n}${r.nth.day}`;
  if (r.until) {
    // UNTIL is inclusive: all-day → DATE value; timed → end of that LOCAL day, in UTC
    if (allDay) s += `;UNTIL=${r.until.replace(/-/g, '')}`;
    else s += `;UNTIL=${new Date(`${r.until}T23:59:59`).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`;
  }
  return s;
}
// RFC 5545 DATE or DATE-TIME value → local 'YYYY-MM-DD'
function icalDay(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v || ''); if (!m) return null;
  if (m[7]) return ymd(new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])));
  return `${m[1]}-${m[2]}-${m[3]}`;
}
// EXDATE lines (skipped occurrences) → 'YYYY-MM-DD' list
function parseExdates(rules) {
  const out = [];
  for (const l of rules || []) if (/^EXDATE[;:]/.test(l)) for (const v of l.slice(l.indexOf(':') + 1).split(',')) { const d = icalDay(v.trim()); if (d) out.push(d); }
  return out;
}
function exdateLines(t) {
  const ds = [...new Set(t.exPush || [])]; if (!ds.length) return [];
  if (!t.time) return ['EXDATE;VALUE=DATE:' + ds.map(d => d.replace(/-/g, '')).join(',')];
  return ['EXDATE;TZID=' + TZ + ':' + ds.map(d => d.replace(/-/g, '') + 'T' + t.time.replace(':', '') + '00').join(',')];
}
function fromRRule(rules) {
  const line = (rules || []).find(x => x.startsWith('RRULE:')); if (!line) return null;
  const p = Object.fromEntries(line.slice(6).split(';').map(x => x.split('=')));
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(p.FREQ)) return null;
  const by = p.BYDAY ? p.BYDAY.split(',') : [];
  const r = { freq: p.FREQ, interval: Math.max(1, +p.INTERVAL || 1), days: p.FREQ === 'WEEKLY' ? by.map(x => x.slice(-2)).filter(d => DAYS.includes(d)) : [] };
  const nth = p.FREQ === 'MONTHLY' && by.length === 1 && /^([+-]?\d)(SU|MO|TU|WE|TH|FR|SA)$/.exec(by[0]);
  if (nth && +nth[1]) r.nth = { n: +nth[1], day: nth[2] };
  if (p.UNTIL) r.until = icalDay(p.UNTIL) || '';
  if (+p.COUNT) r.count = +p.COUNT;
  r.raw = { line, sig: recSig(r) };
  return r;
}

/* ---------- formatting ---------- */
// Gregorian dates are always written in English, Persian (Shamsi) dates always in Persian — on any device region
const loc = () => `${state.settings.lang === 'en' ? 'en-CA' : state.settings.calendar === 'gregory' ? 'en-GB' : 'fa-IR'}-u-ca-${state.settings.calendar}`;
const fmtDate = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(loc(), o).format(parseYmd(s));
// secondary calendar (e.g. Gregorian next to Persian), short form
const altCal = () => state.settings.calendar === 'persian' ? 'gregory' : 'persian';
const fmtAlt = (s, o = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(`${altCal() === 'gregory' ? (state.settings.lang === 'en' ? 'en-CA' : 'en-GB') : 'fa-IR'}-u-ca-${altCal()}`, o).format(parseYmd(s));
const fmtDual = (s, o) => state.settings.altDate === false ? fmtDate(s, o) : `${fmtDate(s, o)} <span class="alt" dir="auto">${fmtAlt(s)}</span>`;
const faNum = s => state?.settings?.lang === 'en' ? String(s) : String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const catOf = t => state.cats.find(c => c.id === t.cat) || { color: state.settings.accent, name: '' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// only http(s) links are ever rendered as href (no javascript:/data: from Google, shared links or imports)
const safeUrl = u => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
// colours end up inside style="" attributes: accept plain hex only
const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '';
const ID_RE = /^[\w:.@-]{1,200}$/;
// Make data from outside (older versions, JSON import, Drive restore) safe to render and sync.
function sanitizeState() {
  if (!Array.isArray(state.tasks)) state.tasks = [];
  if (!Array.isArray(state.cats)) state.cats = structuredClone(DEFAULT.cats);
  state.tasks = state.tasks.filter(t => t && typeof t === 'object' && !/^(period|hb)-/.test(String(t.id)));
  const ids = new Set();
  for (const t of state.tasks) {
    if (!ID_RE.test(String(t.id)) || ids.has(t.id)) t.id = uid();
    ids.add(t.id);
    t.title = String(t.title ?? ''); t.notes = String(t.notes ?? '');
    if (t.color) t.color = safeColor(t.color);
    if (t.link) t.link = safeUrl(t.link);
    if (!Array.isArray(t.tags)) t.tags = [];
    if (!Array.isArray(t.subs)) t.subs = [];
    t.reminders = (Array.isArray(t.reminders) ? t.reminders : []).map(Number).filter(Number.isFinite);
    if (t.date && !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) t.date = '';
    if (t.time && !/^\d{2}:\d{2}$/.test(t.time)) t.time = '';
    if (!t.rec || typeof t.rec !== 'object') t.rec = {};
    if (Array.isArray(t.atts)) t.atts = t.atts.filter(a => a && safeUrl(a.link));
  }
  state.cats = state.cats.filter(c => c && ID_RE.test(String(c.id)));
  for (const c of state.cats) { c.name = String(c.name ?? ''); c.color = safeColor(c.color) || '#7c5cff'; }
  for (const h of Array.isArray(state.habits) ? state.habits : []) { h.color = safeColor(h.color) || '#22c55e'; if (!ID_RE.test(String(h.id))) h.id = uid(); }
  // unbounded growth: keep logs bounded
  if (Array.isArray(state.log) && state.log.length > 3000) state.log = state.log.slice(-3000);
  if (Array.isArray(state.focusLog) && state.focusLog.length > 2000) state.focusLog = state.focusLog.slice(-2000);
  if (!state.sync || typeof state.sync !== 'object') state.sync = structuredClone(DEFAULT.sync);
  if (!Array.isArray(state.sync.deleted)) state.sync.deleted = [];
  if (!state.fired || typeof state.fired !== 'object') state.fired = {};
}
sanitizeState();

/* ---------- theme ---------- */
function applyTheme() {
  const s = state.settings, r = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'dark' : 'light';
  r.style.setProperty('--accent', s.accent); r.style.setProperty('--r', s.radius + 'px');
  document.querySelector('meta[name=theme-color]').content = s.accent;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- render ---------- */
const normFa = s => String(s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌ً-ٟ]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const hiddenCat = t => state.cats.find(c => c.id === t.cat)?.hidden;
function filtered() {
  return state.tasks.filter(t => (!ui.cat || t.cat === ui.cat) && (ui.cat || !hiddenCat(t)));
}
function searchHits() {
  const q = normFa(ui.q).trim(); if (!q) return [];
  return state.tasks.filter(t => normFa([t.title, t.notes, (t.tags || []).join(' '), catOf(t).name, (t.subs || []).map(x => x.t).join(' ')].join(' ')).includes(q));
}
const canCheck = t => !catOf(t).noCheck;
function taskHTML(t, d) {
  const c = catOf(t), done = d ? isDone(t, d) : !!t.done;
  const meta = [];
  meta.push(t.time ? '🕒 ' + faNum(t.time) : '☀️ تمام روز');
  if (!d && t.date) meta.push('📆 ' + fmtDual(t.date, { day: 'numeric', month: 'short' }));
  if (t.rec?.freq) meta.push('🔁 ' + { DAILY: 'روزانه', WEEKLY: 'هفتگی', MONTHLY: 'ماهانه', YEARLY: 'سالانه' }[t.rec.freq]);
  if (t.reminders?.length) meta.push('🔔 ' + faNum(t.reminders.length));
  const calTag = c.name && state.settings.showCalName !== false ? `<span class="tag caltag">${esc(c.name)}</span>` : '';
  if (t.subs?.length) meta.push('☑️ ' + faNum(t.subs.filter(x => x.done).length) + '/' + faNum(t.subs.length));
  for (const g of t.tags || []) meta.push(`<span class="htag uc">#${esc(g)}</span>`);
  if (safeUrl(t.link)) meta.push(`<a href="${esc(safeUrl(t.link))}" target="_blank" rel="noopener" data-act="link">🔗</a>`);
  return `<div draggable="true" class="task prio${+t.prio || 0} ${done ? 'done' : ''} ${canCheck(t) ? '' : 'nocheck'}" style="--c:${done ? '#8a8a8a' : safeColor(t.color) || safeColor(c.color)}" data-id="${esc(t.id)}" data-d="${esc(d || '')}">
    ${canCheck(t) ? `<button class="chk" data-act="toggle" aria-label="done">${done ? '✓' : ''}</button>` : '<span class="bar"></span>'}
    <div class="tb"><div class="t">${esc(t.title)}</div><div class="meta">${meta.join('')}</div>${t.notes ? `<div class="meta uc">${esc(String(t.notes).slice(0, 120))}</div>` : ''}</div>${calTag}<span class="grip" aria-label="drag">⋮⋮</span></div>`;
}
const byTime = (a, b) => (a.time || '').localeCompare(b.time || '') || (b.prio || 0) - (a.prio || 0);
const catIdx = t => { const i = state.cats.findIndex(c => c.id === t.cat); return i < 0 ? 999 : i; };
function sortItems(arr, d) {
  const mode = state.settings.sortMode || 'time';
  const cmp = mode === 'manual' ? (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || byTime(a, b)
    : mode === 'calendar' ? (a, b) => catIdx(a) - catIdx(b) || byTime(a, b) : byTime;
  const dn = t => (d ? isDone(t, d) : t.done) ? 1 : 0;
  return arr.sort((a, b) => dn(a) - dn(b) || cmp(a, b));
}
function dayList(d, list) { return sortItems(list.filter(t => occursOn(t, d)), d); }

// remember which collapsible sections are open (per device)
const foldOpen = k => { try { return localStorage.getItem('fold:' + k) === '1'; } catch { return false; } };
document.addEventListener('toggle', e => { const k = e.target.dataset?.fold; if (k) try { localStorage.setItem('fold:' + k, e.target.open ? '1' : '0'); } catch { } }, true);
function render() {
  const c = $('#content'), list = filtered(), today = ymd(new Date());
  const titles = { today: 'امروز', upcoming: 'پیش‌رو', month: 'تقویم', week: 'این هفته', stats: 'آمار و گزارش', all: 'همه کارها', done: 'انجام‌شده' };
  $('#viewTitle').textContent = ui.cat ? catOf({ cat: ui.cat }).name : titles[ui.view];
  $('#viewSub').innerHTML = fmtDual(today);
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('active', !ui.cat && b.dataset.view === ui.view));
  let h = '';
  if (ui.q) {
    const hits = searchHits().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#viewTitle').textContent = 'جستجو';
    c.innerHTML = hits.map(t => taskHTML(t)).join('') || '<div class="empty"><b>🔍</b>چیزی پیدا نشد</div>';
    return renderCats();
  }
  if (ui.view === 'today') {
    const ro = t => state.cats.find(c => c.id === t.cat)?.ro; // holidays etc. are never "overdue"
    const overdue = list.filter(t => !t.rec?.freq && t.date && t.date < today && t.date >= (state.settings.overdueFrom || '') && !t.done && !ro(t)).sort((a, b) => b.date.localeCompare(a.date));
    const items = dayList(today, list), nodate = list.filter(t => !t.date && !t.done);
    const fold = (key, icon, title, arr, html) => `<details class="fold" data-fold="${key}" ${foldOpen(key) ? 'open' : ''}><summary><span>${icon} ${title}</span><b>${faNum(arr.length)}</b></summary>${html}</details>`;
    h += `<div class="group"><h3>امروز</h3>${items.map(t => taskHTML(t, today)).join('') || '<div class="empty"><b>🌿</b>امروز کاری نداری</div>'}</div>`;
    if (overdue.length) h += fold('overdue', '⚠️', 'عقب‌افتاده', overdue, overdue.map(t => taskHTML(t)).join(''));
    if (nodate.length) h += fold('nodate', '📝', 'بدون تاریخ', nodate, nodate.map(t => taskHTML(t)).join(''));
  } else if (ui.view === 'upcoming') {
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); const s = ymd(d), items = dayList(s, list);
      if (items.length) h += `<div class="group"><h3>${i === 0 ? 'امروز' : i === 1 ? 'فردا' : fmtDual(s)}</h3>${items.map(t => taskHTML(t, s)).join('')}</div>`;
    }
    h = h || '<div class="empty"><b>🏖️</b>دو ماه آینده خالیه</div>';
  } else if (EXTRA[ui.view]) h = EXTRA[ui.view](list);
  else if (ui.view === 'month') h = monthHTML(list);
  else {
    const want = ui.view === 'done';
    const items = list.filter(t => !!t.done === want).sort((a, b) => (want ? (b.date || '').localeCompare(a.date || '') : (a.date || 'z').localeCompare(b.date || 'z')) || byTime(a, b));
    h = items.map(t => taskHTML(t)).join('') || '<div class="empty"><b>✨</b>چیزی نیست</div>';
  }
  c.innerHTML = h;
  renderCats();
}
function monthHTML(list) {
  const m = ui.month, f = new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' });
  // build a grid around the displayed month (gregorian grid; labels in chosen calendar)
  const first = new Date(m.getFullYear(), m.getMonth(), 1), ws = +state.settings.weekStart;
  const start = new Date(first); start.setDate(1 - ((first.getDay() - ws + 7) % 7));
  const dnum = new Intl.DateTimeFormat(loc(), { day: 'numeric' }), today = ymd(new Date());
  let h = `<div class="mnav"><button class="ghost" data-mnav="-1">→</button><b>${f.format(new Date(m.getFullYear(), m.getMonth(), 15))}</b><button class="ghost" data-mnav="1">←</button></div><div class="month">`;
  for (let i = 0; i < 7; i++) h += `<div class="h">${new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(2024, 0, 7 + (ws + i) % 7))}</div>`;
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const s = ymd(d), items = dayList(s, list);
    h += `<div class="mday ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${s === today ? 'today' : ''}" data-day="${s}"><div class="num">${dnum.format(d)}</div>
      ${items.slice(0, 3).map(t => `<div class="ev" style="--c:${safeColor(t.color) || safeColor(catOf(t).color)}">${t.time ? faNum(t.time) + ' ' : ''}${esc(t.title)}</div>`).join('')}${items.length > 3 ? `<div class="muted">+${faNum(items.length - 3)}</div>` : ''}</div>`;
  }
  return h + '</div>';
}
function renderCats() {
  $('#catList').innerHTML = state.cats.map(c => {
    const n = state.tasks.filter(t => t.cat === c.id && !t.done).length;
    return `<button class="cat ${ui.cat === c.id ? 'active' : ''}" data-cat="${esc(c.id)}"><span class="dot" style="background:${safeColor(c.color)}"></span>${esc(c.name)}${c.gcal ? ' <small title="Google">☁️</small>' : ''}${c.ro ? ' 🔒' : ''}<span class="n">${faNum(n)}</span><span class="icon" data-editcat="${esc(c.id)}">✎</span></button>`;
  }).join('');
}

/* ---------- task editor ---------- */
let editing = null, rems = [], recDays = [];
function soundOptions(sel, withInherit) {
  sel.innerHTML = (withInherit ? '<option value="">از دسته/پیش‌فرض</option>' : '') + Object.entries(SOUNDS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
}
function openTask(t, presetDate) {
  editing = t; const f = $('#taskForm');
  $('#taskDlgTitle').textContent = t ? 'ویرایش کار' : 'کار جدید';
  f.cat.innerHTML = '<option value="">بدون دسته</option>' + state.cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  soundOptions(f.sound, true);
  const v = t || { title: $('#quickTitle').value, date: presetDate || ymd(new Date()), duration: 30, cat: ui.cat || '', reminders: [10], rec: {} };
  f.title.value = v.title || ''; f.notes.value = v.notes || ''; f.date.value = v.date || ''; f.time.value = v.time || '';
  f.duration.value = v.duration ?? 30; f.cat.value = v.cat || ''; f.prio.value = v.prio || 0; f.sound.value = v.sound || '';
  f.freq.value = v.rec?.freq || ''; f.interval.value = v.rec?.interval || 1; f.until.value = v.rec?.until || '';
  recDays = [...(v.rec?.days || [])]; rems = [...(v.reminders || [])];
  f.tags.value = (v.tags || []).join(', '); f.link.value = v.link || ''; f.color.value = v.color || catOf(v).color || state.settings.accent; f.color.dataset.touched = v.color ? '1' : '';
  HOOK.openSubs?.(v.subs || []);
  drawDays(); drawRems(); $('#delTask').style.display = t ? '' : 'none';
  $('#taskDlg').showModal();
}
function drawDays() {
  const show = $('#taskForm').freq.value === 'WEEKLY';
  $('#daysPick').style.display = show ? '' : 'none';
  const order = [6, 0, 1, 2, 3, 4, 5]; // Sat..Fri
  $('#daysPick').innerHTML = order.map(i => `<button type="button" data-day="${DAYS[i]}" class="${recDays.includes(DAYS[i]) ? 'on' : ''}">${DAY_FA[i]}</button>`).join('');
}
const hm = mins => faNum(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
// all-day reminders are minutes before 00:00 of the day (negative = later that same day)
const remLabel = (m, allDay) => {
  if (allDay) { const days = Math.max(0, Math.ceil(m / 1440)), at = days * 1440 - m; return (days === 0 ? 'همان روز' : days === 1 ? 'روز قبل' : faNum(days) + ' روز قبل') + ' ساعت ' + hm(at); }
  return m === 0 ? 'سر وقت' : m % 1440 === 0 ? faNum(m / 1440) + ' روز قبل' : m >= 60 && m % 60 === 0 ? faNum(m / 60) + ' ساعت قبل' : faNum(m) + ' دقیقه قبل';
};
const remStart = (t, d) => { if (!t.time) return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); const [hh, mm] = t.time.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime(); };
function drawRems() { const ad = !$('#taskForm').time.value; $('#remList').innerHTML = rems.sort((a, b) => a - b).map((m, i) => `<span data-rem="${i}">🔔 ${remLabel(m, ad)} ✕</span>`).join('') || '<span class="muted">بدون یادآوری</span>'; }

$('#daysPick').onclick = e => { const d = e.target.dataset.day; if (!d) return; recDays = recDays.includes(d) ? recDays.filter(x => x !== d) : [...recDays, d]; drawDays(); };
$('#taskForm').freq.onchange = drawDays;
$('#remAddBtn').onclick = () => { const m = +$('#remAdd').value; if (!rems.includes(m)) rems.push(m); drawRems(); };
$('#remList').onclick = e => { const i = e.target.dataset.rem; if (i != null) { rems.splice(+i, 1); drawRems(); } };
$('#testSound').onclick = () => { const f = $('#taskForm'); playSound(f.sound.value || state.cats.find(c => c.id === f.cat.value)?.sound || state.settings.sound); };
// the editor only knows freq/interval/days/until: if those didn't change keep the original rule
// (with its "2nd Tuesday" / COUNT / raw Google RRULE) instead of rewriting it in Google
function keepRec(old, nr) {
  if (!old?.freq || old.freq !== nr.freq || (+old.interval || 1) !== nr.interval || (old.until || '') !== (nr.until || '')) return nr;
  if (nr.freq === 'WEEKLY' && [...(old.days || [])].sort().join() !== [...nr.days].sort().join()) return nr;
  return old;
}
$('#taskDlg').addEventListener('close', () => {
  if ($('#taskDlg').returnValue !== 'ok') return;
  const f = $('#taskForm'), t = editing || { id: uid(), created: Date.now() };
  Object.assign(t, {
    title: f.title.value.trim(), notes: f.notes.value.trim(), date: f.date.value, time: f.time.value, duration: +f.duration.value || 0,
    cat: f.cat.value, prio: +f.prio.value, sound: f.sound.value, reminders: [...rems],
    rec: keepRec(editing?.rec, f.freq.value ? { freq: f.freq.value, interval: +f.interval.value || 1, days: f.freq.value === 'WEEKLY' ? recDays : [], until: f.until.value } : {}),
    tags: f.tags.value.split(/[,،]/).map(x => x.trim().replace(/^#/, '')).filter(Boolean), link: f.link.value.trim(),
    color: f.color.dataset.touched ? f.color.value : (editing?.color || ''), subs: HOOK.getSubs ? HOOK.getSubs() : (editing?.subs || []),
    updated: Date.now(), dirty: true
  });
  if (!editing) state.tasks.push(t);
  $('#quickTitle').value = ''; commit(); toast('ذخیره شد');
});
$('#delTask').onclick = () => {
  if (!editing || !confirm('حذف شود؟')) return;
  if (editing.gid && targetCal(editing) && !state.sync.deleted.some(d => d.gid === editing.gid)) state.sync.deleted.push({ cal: editing.cal || 'primary', gid: editing.gid });
  state.tasks = state.tasks.filter(t => t !== editing); $('#taskDlg').close(); commit();
};

/* ---------- categories ---------- */
let editCat = null, catColor;
function openCat(c) {
  editCat = c; const f = $('#catForm'); f.name.value = c?.name || ''; catColor = c?.color || SWATCH[0];
  soundOptions(f.sound); f.sound.value = c?.sound || state.settings.sound;
  drawSw(); $('#delCat').style.display = c ? '' : 'none'; $('#catDlg').showModal();
}
function drawSw() { $('#swatches').innerHTML = SWATCH.map(c => `<button type="button" style="background:${c}" data-c="${c}" class="${c === catColor ? 'on' : ''}"></button>`).join('') + `<input type="color" value="${catColor}" id="swCustom" style="width:44px">`; }
$('#swatches').onclick = e => { if (e.target.dataset.c) { catColor = e.target.dataset.c; drawSw(); } };
$('#swatches').oninput = e => { catColor = e.target.value; };
$('#catDlg').addEventListener('close', () => {
  if ($('#catDlg').returnValue !== 'ok') return;
  const f = $('#catForm'), c = editCat || { id: uid() };
  const changed = c.color !== catColor; if (changed && c.gcal) c.userColor = true;
  Object.assign(c, { name: f.name.value.trim(), color: catColor, sound: f.sound.value });
  if (!editCat) state.cats.push(c);
  if (changed) state.tasks.forEach(t => { if (t.cat === c.id) t.dirty = true; });
  commit();
});
$('#delCat').onclick = () => { if (!confirm('دسته حذف شود؟ (کارها باقی می‌مانند)')) return; state.cats = state.cats.filter(c => c !== editCat); state.tasks.forEach(t => { if (t.cat === editCat.id) { t.cat = ''; t.dirty = true; } }); ui.cat = null; $('#catDlg').close(); commit(); };

/* ---------- settings ---------- */
function openSettings() {
  const f = $('#setForm'), s = state.settings; soundOptions(f.sound);
  for (const k of ['theme', 'accent', 'radius', 'calendar', 'weekStart', 'clientId', 'calendarId', 'syncEvery', 'sound', 'volume', 'focusMin', 'snoozeMin']) f[k].value = s[k];
  f.holidays.checked = s.holidays;
  f.vibrate.checked = s.vibrate; $('#setDlg').showModal();
}
$('#setDlg').addEventListener('close', () => {
  if ($('#setDlg').returnValue !== 'ok') return;
  const f = $('#setForm'), s = state.settings, oldCal = s.calendarId;
  for (const k of ['theme', 'accent', 'calendar', 'clientId', 'calendarId', 'sound']) s[k] = f[k].value.trim();
  s.radius = +f.radius.value; s.weekStart = +f.weekStart.value; s.syncEvery = Math.max(10, +f.syncEvery.value || 30); s.volume = +f.volume.value; s.vibrate = f.vibrate.checked; s.focusMin = +f.focusMin.value || 25; s.snoozeMin = +f.snoozeMin.value || 10; s.holidays = f.holidays.checked;
  s.calendarId = s.calendarId || 'primary';
  applyTheme(); commit(); startSyncLoop();
});
$('#setForm').accent.oninput = e => document.documentElement.style.setProperty('--accent', e.target.value);
$('#setForm').radius.oninput = e => document.documentElement.style.setProperty('--r', e.target.value + 'px');
$('#askNotif').onclick = async () => toast(await Notification.requestPermission() === 'granted' ? 'اعلان فعال شد' : 'اجازه داده نشد');
$('#testNotif').onclick = () => notify({ title: 'اعلان آزمایشی', body: 'همه چیز درسته ✨', sound: state.settings.sound, tag: 'test' });
$('#exportBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ tasks: state.tasks, cats: state.cats, settings: { ...state.settings } }, null, 2)], { type: 'application/json' })); a.download = 'rooznegar.json'; a.click(); };
$('#importFile').onchange = async e => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!d || !Array.isArray(d.tasks)) throw new Error('bad');
    if (!confirm('همه‌ی کارهای این دستگاه با فایل جایگزین شود؟')) return;
    Object.assign(state, { tasks: d.tasks, cats: Array.isArray(d.cats) ? d.cats : state.cats });
    sanitizeState(); state.tasks.forEach(t => t.dirty = true); commit(); toast('وارد شد');
  } catch { toast('فایل نامعتبر'); } finally { e.target.value = ''; }
};

/* ---------- notifications & reminders ---------- */
let swReg;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(r => swReg = r).catch(() => { });
async function notify({ title, body, sound, tag }) {
  playSound(sound);
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (Notification?.permission !== 'granted') { toast('🔔 ' + title); return; }
  const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', vibrate: state.settings.vibrate ? [200, 100, 200] : [], requireInteraction: true, data: { tag }, actions: tag && tag.includes('|') ? [{ action: 'done', title: '✓ انجام شد' }, { action: 'snooze', title: '⏰ بعداً' }] : [] };
  try { (swReg || await navigator.serviceWorker.ready).showNotification(title, opts); } catch { new Notification(title, opts); }
}
// tasks that can ring: real tasks + virtual ones added by modules (period days, habits, nag repeats)
function reminderTasks() { return state.tasks; }
function checkReminders() {
  const now = Date.now(); let changed = false;
  for (const off of [0, 1, 2, 3]) { // today … 3 days ahead (for "days before" reminders)
    const d = new Date(); d.setDate(d.getDate() + off); const ds = ymd(d);
    for (const t of reminderTasks()) {
      if (!t.reminders?.length || !occursOn(t, ds) || isDone(t, ds) || hiddenCat(t)) continue;
      const at = remStart(t, d);
      for (const m of t.reminders) {
        const fireAt = at - m * 6e4, key = `${t.id}|${ds}|${m}`;
        if (now >= fireAt && now - fireAt < 10 * 6e4 && !state.fired[key]) {
          state.fired[key] = now; changed = true;
          notify({ title: t.title, body: (t.time ? (m ? remLabel(m) + ' — ' : '') + 'ساعت ' + faNum(t.time) : '☀️ تمام روز — ' + fmtDate(ds)) + (t.notes ? '\n' + t.notes : ''), sound: t.sound || catOf(t).sound || state.settings.sound, tag: key });
        }
      }
    }
  }
  for (const k in state.fired) if (now - state.fired[k] > 3 * 864e5) { delete state.fired[k]; changed = true; }
  if (changed) save(); // was: a full state write every 15 s
}
// late-bound: modules reassign checkReminders; this single interval always calls the current one
setInterval(() => checkReminders(), 15e3);

/* ---------- Google Calendar sync ---------- */
let tokenClient, syncing = false, syncTimer;
const gConnected = () => state.sync.token && state.sync.token.exp > Date.now();
function setSyncState(cls, txt) { const e = $('#syncState'); e.className = 'sync ' + cls; e.textContent = '● ' + txt; }
function gInit() {
  if (!state.settings.clientId || !window.google?.accounts) return false;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.settings.clientId, scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    callback: r => { if (r.error) return toast('خطای ورود: ' + r.error); state.sync.token = { v: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1e3 }; state.sync.linked = true; save(); toast('به گوگل وصل شد'); syncNow(); startSyncLoop(); }
  });
  return true;
}
const G_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const G_REDIRECT = location.origin + '/';
// Sign-in: the user's click opens Google once; we get a one-time code, the server keeps the
// refresh token and hands us fresh access tokens later — no popups when the hour runs out.
function gSignIn() {
  if (!window.google?.accounts) return toast('Google…');
  google.accounts.oauth2.initCodeClient({
    client_id: state.settings.clientId, scope: G_SCOPES, ux_mode: 'popup', select_account: false,
    callback: async r => {
      if (r.error || !r.code) return toast('خطای ورود: ' + (r.error || ''));
      try {
        const j = await fetch('push/token.php', { method: 'POST', body: JSON.stringify({ action: 'exchange', code: r.code }) }).then(x => x.json());
        if (!j.access_token) throw new Error(j.error || 'exchange');
        state.sync.token = { v: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1e3 };
        if (j.sid) state.sync.sid = j.sid;
        state.sync.linked = true; save(); toast('به گوگل وصل شد'); syncNow(); startSyncLoop();
      } catch (e) { toast('خطای ورود: ' + e.message); }
    }
  }).requestCode();
}
let refreshing = null;
async function ensureToken() {
  if (gConnected()) return true;
  if (!state.sync.sid) return false;
  refreshing = refreshing || (async () => {
    try {
      const j = await fetch('push/token.php', { method: 'POST', body: JSON.stringify({ action: 'refresh', sid: state.sync.sid }) }).then(x => x.json());
      if (!j.access_token) { if (j.error === 'unknown session' || j.error === 'invalid_grant') state.sync.sid = null; return false; }
      state.sync.token = { v: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1e3 }; save(); return true;
    } catch { return false; } finally { setTimeout(() => refreshing = null, 0); }
  })();
  return refreshing;
}
function gConnect(silent) {
  if (!state.settings.clientId) { if (!silent) toast('اول Client ID را در تنظیمات وارد کنید'); return; }
  if (!silent) return gSignIn();
  return; // silent: handled by ensureToken() (server refresh), never a popup
  // full-page redirect sign-in: enable with state.settings.redirectLogin = true once
  // https://rooz.mahsen81.ir/ is added under "Authorized redirect URIs" of the OAuth client
  if (!silent && !state.settings.redirectLogin) { if (!tokenClient && !gInit()) return; return tokenClient.requestAccessToken({ prompt: 'consent' }); }
  if (!silent) { // full-page redirect sign-in: no popup, works in installed PWA on phones
    const st = uid(); sessionStorage.setItem('gstate', st);
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: state.settings.clientId, redirect_uri: G_REDIRECT, response_type: 'token', scope: G_SCOPES, include_granted_scopes: 'true', prompt: 'consent', state: st });
    return;
  }
  if (!tokenClient && !gInit()) return;
  tokenClient.requestAccessToken({ prompt: '' });
}
// returning from Google sign-in redirect: #access_token=...&expires_in=...&state=...
(() => {
  if (!location.hash.includes('access_token') && !location.hash.includes('error=')) return;
  const h = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname);
  if (h.get('error')) return setTimeout(() => toast('ورود لغو شد: ' + h.get('error')), 500);
  if (h.get('state') !== sessionStorage.getItem('gstate')) return;
  state.sync.token = { v: h.get('access_token'), exp: Date.now() + ((+h.get('expires_in') || 3600) - 60) * 1e3 };
  state.sync.linked = true; save(); setTimeout(() => { toast('به گوگل وصل شد'); syncNow(); startSyncLoop(); }, 300);
})();
async function gapi(path, opt = {}) {
  if (!gConnected()) throw new Error('auth');
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, { ...opt, headers: { Authorization: 'Bearer ' + state.sync.token.v, 'Content-Type': 'application/json' } });
  if (r.status === 401) { state.sync.token = null; throw new Error('auth'); }
  if (r.status === 410) { const e = new Error('gone'); e.gone = true; e.status = 410; throw e; }
  if (r.status === 204) return null;
  if (!r.ok) { const e = new Error(r.status + ' ' + (await r.text()).slice(0, 300)); e.status = r.status; throw e; }
  return r.json();
}
function nearestColorId(hex) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), a = rgb(hex);
  // never pick 8 (graphite): graphite means "done" in both directions
  if (!/^#[0-9a-f]{6}/i.test(hex || '')) return null;
  let best = '1', bd = 1e9; for (const [id, c] of Object.entries(GCOLORS)) { if (id === '8') continue; const b = rgb(c), d = a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0); if (d < bd) { bd = d; best = id; } } return best;
}
// which Google calendar a task belongs to (null = read-only calendar, don't push)
const normCal = k => k && k === state.sync?.primaryId ? 'primary' : k;
function targetCal(t) {
  if (t.period || /^(period|hb)-/.test(String(t.id))) return null; // virtual, device-only
  const cur = state.cats.find(x => x.gcal === (t.cal || 'primary'));
  if (t.gid && cur?.ro) return null;
  // a single changed occurrence of a Google series can't be moved to another calendar
  if (t.gid && t.seriesGid && t.cal) return t.cal;
  const c = state.cats.find(x => x.id === t.cat);
  if (c?.local) return null;
  if (c?.gcal) return c.ro ? null : c.gcal;
  return normCal(t.gid && t.cal ? t.cal : (state.settings.calendarId || 'primary'));
}
// Google caps a private property at 1024 bytes: drop whole items instead of cutting the JSON in half
function subsProp(subs) { const a = [...(subs || [])]; let s; while (new Blob([s = JSON.stringify(a)]).size > 1000) a.pop(); return s; }
function toEvent(t) {
  const ownColor = t.color ? nearestColorId(t.color) : (t.cat && !catOf(t).gcal ? nearestColorId(catOf(t).color) : null);
  // done = graphite (colorId 8) in Google Calendar
  const ev = { summary: t.title, description: t.notes || '', colorId: t.done && !t.rec?.freq ? '8' : ownColor,
    reminders: { useDefault: false, overrides: (t.reminders || []).filter(m => m >= 0).slice(0, 5).map(m => ({ method: 'popup', minutes: m })) },
    extendedProperties: { private: { rz: '1', rzId: t.id, cat: t.cat || '', prio: String(t.prio || 0), done: t.done ? '1' : '', doneDates: (t.doneDates || []).join(','), sound: t.sound || '', tags: (t.tags || []).join(','), link: t.link || '', subs: subsProp(t.subs) } } };
  const date = t.date || ymd(new Date());
  if (t.time) {
    const s = new Date(`${date}T${t.time}:00`), e = new Date(s.getTime() + (t.duration || 30) * 6e4);
    ev.start = { dateTime: s.toISOString(), timeZone: TZ }; ev.end = { dateTime: e.toISOString(), timeZone: TZ };
  } else { const e = parseYmd(date); e.setDate(e.getDate() + 1); ev.start = { date }; ev.end = { date: ymd(e) }; }
  const rr = toRRule(t.rec, !t.time); ev.recurrence = rr ? [rr, ...exdateLines(t)] : [];
  return ev;
}
function fromEvent(ev, t) {
  const p = ev.extendedProperties?.private || {};
  t.title = (ev.summary || '(بدون عنوان)').replace(/^✓ /, ''); t.notes = ev.description || '';
  if (ev.start?.dateTime) { const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime); t.date = ymd(s); t.time = `${pad(s.getHours())}:${pad(s.getMinutes())}`; t.duration = Math.round((e - s) / 6e4); }
  else if (ev.start?.date) { t.date = ev.start.date; t.time = ''; }
  t.rec = fromRRule(ev.recurrence) || {};
  if (t.rec.count && t.date && !t.rec.until) { // COUNT=n → last date, so occursOn stops where Google stops
    const probe = { ...t, exdates: [] }, d = parseYmd(t.date); let n = 0;
    for (let i = 0; i < 3700 && n < t.rec.count; i++, d.setDate(d.getDate() + 1)) if (occursOn(probe, ymd(d)) && ++n === t.rec.count) t.rec.until = ymd(d);
  }
  t.exPush = parseExdates(ev.recurrence);
  t.exdates = [...new Set([...t.exPush, ...(t.exInst || [])])];
  const localNeg = (t.reminders || []).filter(m => m < 0); // same-day all-day times live only here
  if (ev.reminders && !ev.reminders.useDefault) t.reminders = [...(ev.reminders.overrides || []).map(o => o.minutes), ...(ev.start?.date ? localNeg : [])];
  else if (!t.reminders) t.reminders = ev.start?.dateTime ? [10] : [];
  if (ev.reminders?.useDefault && !t.remMine) t.remDef = true; // v11 replaces these with the calendar's own default reminders
  if (p.rz) { t.cat = p.cat; t.prio = +p.prio || 0; t.done = p.done === '1'; t.doneDates = p.doneDates ? p.doneDates.split(',').filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : []; t.sound = SOUNDS[p.sound] ? p.sound : ''; }
  else t.done = (ev.summary || '').startsWith('✓ ');
  // graphite in Google Calendar = done here (and back); recurring series keep per-day ticks
  if (!t.rec?.freq) t.done = ev.colorId === '8';
  if (ev.colorId !== '8') t.color = ev.colorId ? GCOLORS[ev.colorId] : '';
  if (p.rz) {
    t.tags = p.tags ? p.tags.split(',') : []; t.link = safeUrl(p.link);
    try { const s = JSON.parse(p.subs || '[]'); t.subs = Array.isArray(s) ? s.filter(x => x && typeof x === 'object').map(x => ({ t: String(x.t ?? ''), done: !!x.done })) : []; } catch { t.subs = []; }
  }
  t.gid = ev.id; t.gUpdated = ev.updated; t.dirty = false;
}
// A single occurrence changed in Google: hide that day on the series and keep the
// changed occurrence as its own task (edits to it are pushed back to the same instance).
function applyInstance(ev, key) {
  const parent = state.tasks.find(x => x.gid === ev.recurringEventId && (x.cal || 'primary') === key);
  const o = ev.originalStartTime || {}, day = o.date || (o.dateTime ? ymd(new Date(o.dateTime)) : null);
  if (parent && day) { parent.exInst = [...new Set([...(parent.exInst || []), day])]; parent.exdates = [...new Set([...(parent.exdates || []), day])]; }
  let t = state.tasks.find(x => x.gid === ev.id && (x.cal || 'primary') === key);
  if (ev.status === 'cancelled') { if (t) state.tasks = state.tasks.filter(x => x !== t); return; }
  if (t && (t.dirty || t.gUpdated === ev.updated)) return;
  if (!t) { t = { id: uid(), created: Date.now() }; state.tasks.push(t); }
  fromEvent(ev, t); t.cal = key; t.rec = {}; t.instOf = parent?.id || null; t.seriesGid = ev.recurringEventId; t.origDay = day;
  t.cat = parent?.cat || (state.cats.some(c => c.id === 'g:' + key) ? 'g:' + key : t.cat);
}
let authRetries = 0, syncAgain = false;
async function syncNow() {
  if (!state.sync.linked) return;
  // the flag is set BEFORE the first await: focus + visibilitychange fire together on iOS resume and
  // two concurrent runs used to POST the same new task twice (duplicate Google events)
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  if (!(await ensureToken())) { syncing = false; setSyncState('off', state.sync.sid ? 'بدون اینترنت' : 'نیاز به ورود مجدد'); return; }
  setSyncState('busy', 'در حال همگام‌سازی…');
  const enc = encodeURIComponent, sy = state.sync;
  sy.cals = sy.cals || {};
  try {
    // 0) calendar list → one category per Google calendar (with Google's color)
    let list;
    try { list = (await gapi('/users/me/calendarList?minAccessRole=reader&maxResults=250')).items || []; }
    catch (e) { if (e.message === 'auth') throw e; list = null; toast('برای دیدن همه تقویم‌ها یک بار «اتصال به گوگل» را دوباره بزنید'); }
    if (list) {
      const keep = new Set();
      for (const c of list) {
        if (c.hidden || c.deleted) continue;
        if (c.primary) sy.primaryId = c.id;
        const key = c.primary ? 'primary' : c.id; keep.add(key);
        const ro = !['owner', 'writer'].includes(c.accessRole);
        const id = 'g:' + key; let cat = state.cats.find(x => x.id === id);
        if (!cat) { cat = { id, sound: state.settings.sound }; state.cats.push(cat); cat.color = c.backgroundColor; }
        Object.assign(cat, { name: String(c.summaryOverride || c.summary || ''), gcal: key, ro, gcolor: safeColor(c.backgroundColor) });
        cat.defRem = (c.defaultReminders || []).filter(r => r.method === 'popup').map(r => +r.minutes).filter(Number.isFinite);
        if (!cat.userColor || !cat.color) cat.color = safeColor(c.backgroundColor) || '#039be5';
        sy.cals[key] = sy.cals[key] || { syncToken: null };
      }
      // a calendar that left the list: drop its synced copies (never unsynced local edits)
      for (const k of Object.keys(sy.cals)) if (!keep.has(k)) { delete sy.cals[k]; state.tasks = state.tasks.filter(t => (t.cal || 'primary') !== k || !t.gid || t.dirty); state.cats = state.cats.filter(c => c.id !== 'g:' + k); }
    } else sy.cals[state.settings.calendarId || 'primary'] = sy.cals[state.settings.calendarId || 'primary'] || { syncToken: sy.syncToken || null };
    // 1) push local deletions
    for (const d of [...sy.deleted]) {
      const o = typeof d === 'string' ? { cal: 'primary', gid: d } : d;
      try { await gapi(`/calendars/${enc(o.cal)}/events/${enc(o.gid)}`, { method: 'DELETE' }); } catch (e) { if (!e.gone && ![403, 404, 410].includes(e.status)) throw e; }
      sy.deleted = sy.deleted.filter(x => x !== d); save();
    }
    // 2) push local changes (to the calendar of the task's category)
    for (const t of state.tasks.filter(t => t.dirty && t.date)) {
      const target = targetCal(t);
      if (!target) { t.dirty = false; continue; } // read-only / device-only: keep local only
      try {
        let ev;
        if (t.gid && normCal(t.cal || 'primary') !== target) {
          ev = await gapi(`/calendars/${enc(t.cal || 'primary')}/events/${enc(t.gid)}/move?destination=${enc(target)}`, { method: 'POST' });
          t.gid = ev.id; t.cal = target; save(); // record the move now: if the PATCH fails we must not retry the move from the old calendar
        }
        if (t.gid) ev = await gapi(`/calendars/${enc(target)}/events/${enc(t.gid)}`, { method: 'PATCH', body: JSON.stringify(toEvent(t)) });
        else {
          // client-chosen event id (base32hex), saved before the request: if the response is lost
          // (iOS freezes the page, network drops) the retry gets 409 instead of creating a duplicate
          t.newGid = t.newGid || Array.from(crypto.getRandomValues(new Uint8Array(24)), b => '0123456789abcdefghijklmnopqrstuv'[b & 31]).join('');
          save();
          try { ev = await gapi(`/calendars/${enc(target)}/events`, { method: 'POST', body: JSON.stringify({ ...toEvent(t), id: t.newGid }) }); }
          catch (e) { if (e.status !== 409) throw e; ev = await gapi(`/calendars/${enc(target)}/events/${enc(t.newGid)}`, { method: 'PATCH', body: JSON.stringify(toEvent(t)) }); }
          delete t.newGid;
        }
        t.gid = ev.id; t.cal = target; t.gUpdated = ev.updated; t.dirty = false; delete t.syncErr;
      } catch (e) {
        if (e.message === 'auth' || !e.status) throw e; // auth / network: stop, retry on the next run
        // one bad task (deleted remotely, rejected by Google…) must not block every other change and all pulls
        console.warn('push failed', t.id, e); t.syncErr = String(e.status);
        if (e.status === 404 || e.status === 410) { t.gid = null; t.gUpdated = null; } // gone remotely: re-created next run
        if (e.status === 429 || e.status >= 500) throw e; // rate limit / outage: back off
      }
    }
    // 3) pull remote changes from every calendar (incremental with syncToken)
    for (const [key, cs] of Object.entries(sy.cals)) {
      // calendars that reject sync tokens (e.g. Google's public holiday calendars): full fetch every 6 h
      if (cs.noToken && Date.now() - (cs.lastFull || 0) < 6 * 3600e3) continue;
      if (cs.noToken) cs.lastFull = Date.now();
      let page, params;
      do {
        params = new URLSearchParams({ maxResults: '250', showDeleted: 'true' });
        if (cs.syncToken) params.set('syncToken', cs.syncToken);
        else { const d = new Date(); d.setDate(d.getDate() - 60); params.set('timeMin', d.toISOString()); }
        if (page) params.set('pageToken', page);
        let res;
        try { res = await gapi(`/calendars/${enc(key)}/events?${params}`); }
        catch (e) {
          // 410: sync token expired → full resync without the (now invalid) page token
          if (e.gone) { cs.syncToken = null; cs.gone = (cs.gone || 0) + 1; if (cs.gone >= 3) { cs.noToken = true; cs.lastFull = Date.now(); } page = null; if (cs.gone >= 6) break; continue; }
          if (e.status === 403 || e.status === 404) break; throw e;
        }
        if (!page) cs.gone = 0;
        for (const ev of res.items || []) {
          if (ev.recurringEventId) { applyInstance(ev, key); continue; }
          let t = state.tasks.find(x => x.gid === ev.id && (x.cal || 'primary') === key);
          if (ev.status === 'cancelled') { if (t) state.tasks = state.tasks.filter(x => x !== t); continue; }
          if (t && t.dirty) continue; // local edit wins; pushed next cycle
          if (t && t.gUpdated === ev.updated && t.cal) continue;
          if (!t) { t = { id: ev.extendedProperties?.private?.rzId || uid(), created: Date.now() }; if (state.tasks.some(x => x.id === t.id)) t.id = uid(); state.tasks.push(t); }
          fromEvent(ev, t); t.cal = key;
          if (!ev.extendedProperties?.private?.rz || !t.cat || !state.cats.some(c => c.id === t.cat)) t.cat = state.cats.some(c => c.id === 'g:' + key) ? 'g:' + key : t.cat;
        }
        page = res.nextPageToken; if (res.nextSyncToken && !cs.noToken) cs.syncToken = res.nextSyncToken;
      } while (page);
    }
    // instances that arrived before their series: make sure the series hides those days
    for (const x of state.tasks) if (x.seriesGid && x.origDay) {
      const p = state.tasks.find(y => y.gid === x.seriesGid && (y.cal || 'primary') === (x.cal || 'primary'));
      if (p && !(p.exdates || []).includes(x.origDay)) { p.exInst = [...new Set([...(p.exInst || []), x.origDay])]; p.exdates = [...new Set([...(p.exdates || []), x.origDay])]; x.instOf = p.id; }
    }
    authRetries = 0;
    setSyncState('on', 'همگام · ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    save(); render();
  } catch (e) {
    console.error(e);
    save(); render(); // keep what did sync before the error (gids of created events!)
    if (e.message === 'auth') { state.sync.token = null; setSyncState('off', state.sync.sid ? 'در حال اتصال…' : 'نیاز به ورود مجدد'); if (state.sync.sid && ++authRetries <= 3) setTimeout(() => syncNow(), 1500 * authRetries); }
    else setSyncState('off', navigator.onLine === false ? 'بدون اینترنت' : 'خطای همگام‌سازی');
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; setTimeout(() => syncNow(), 300); }
  }
}
// late-bound calls (modules may wrap syncNow); no polling while the app is in the background
function startSyncLoop() { clearInterval(syncTimer); syncTimer = setInterval(() => { if (!document.hidden) syncNow(); }, Math.max(10, +state.settings.syncEvery || 30) * 1e3); }
let pushTimer; const schedulePush = () => { clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), 800); };
addEventListener('online', () => syncNow());
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncNow(); checkReminders(); } });
window.addEventListener('focus', () => syncNow());
$('#gConnect').onclick = () => { $('#setForm').clientId.value && (state.settings.clientId = $('#setForm').clientId.value.trim(), tokenClient = null); gConnect(false); };
$('#gSyncNow').onclick = () => syncNow();
$('#gDisconnect').onclick = () => {
  const unsynced = state.tasks.filter(t => t.dirty).length;
  if (!confirm(unsynced ? `${faNum(unsynced)} تغییر هنوز به گوگل نرسیده و از بین می‌رود. اتصال گوگل قطع شود؟` : 'اتصال گوگل قطع شود؟ (رویدادهای گوگل از این دستگاه پاک می‌شوند)')) return;
  if (state.sync.sid) fetch('push/token.php', { method: 'POST', body: JSON.stringify({ action: 'revoke', sid: state.sync.sid }) }).catch(() => { }); else if (state.sync.token && window.google) google.accounts.oauth2.revoke(state.sync.token.v); state.sync = { token: null, syncToken: null, deleted: [], cals: {} }; state.tasks = state.tasks.filter(t => !t.gid); state.cats = state.cats.filter(c => !c.gcal); render(); save(); setSyncState('off', 'گوگل متصل نیست'); };

/* ---------- interactions ---------- */
function commit() { save(); render(); schedulePush(); }
function toast(m) { const e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 2200); }
$('#content').onclick = e => {
  const m = e.target.closest('[data-mnav]'); if (m) { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + +m.dataset.mnav, 1); return render(); }
  const md = e.target.closest('.mday'); if (md) return openTask(null, md.dataset.day);
  const el = e.target.closest('.task'); if (!el) return;
  const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
  if (e.target.closest('[data-act=toggle]')) {
    const d = el.dataset.d;
    if (t.rec?.freq && d) { t.doneDates = t.doneDates || []; t.doneDates = t.doneDates.includes(d) ? t.doneDates.filter(x => x !== d) : [...t.doneDates, d]; }
    else t.done = !t.done;
    if (isDone(t, d)) { playSound(state.settings.tickSound || 'marimba'); (state.log = state.log || []).push({ id: t.id, at: Date.now() }); }
    t.dirty = true; t.updated = Date.now(); commit();
  } else openTask(t);
};
$('#views').onclick = e => { const b = e.target.closest('button'); if (!b) return; ui.view = b.dataset.view; ui.cat = null; $('.side').classList.remove('open'); render(); };
$('#catList').onclick = e => { const ed = e.target.closest('[data-editcat]'); if (ed) { e.stopPropagation(); return openCat(state.cats.find(c => c.id === ed.dataset.editcat)); } const b = e.target.closest('[data-cat]'); if (b) { ui.cat = ui.cat === b.dataset.cat ? null : b.dataset.cat; if (ui.view === 'month' || ui.view === 'done') ui.view = 'all'; $('.side').classList.remove('open'); render(); } };
$('#addCat').onclick = () => openCat(null);
$('#openSettings').onclick = openSettings;
$('#menuBtn').onclick = () => $('.side').classList.toggle('open');
$('#search').oninput = e => { ui.q = e.target.value.trim().toLowerCase(); render(); };
$('#quickAdd').onsubmit = e => {
  e.preventDefault(); const title = $('#quickTitle').value.trim(); if (!title) return openTask(null);
  const base = { id: uid(), title, date: ymd(new Date()), time: '', duration: 30, cat: ui.cat || '', reminders: [], rec: {}, created: Date.now(), dirty: true };
  const parsed = HOOK.parseQuick ? HOOK.parseQuick(title) : {};
  if (parsed.time && !parsed.reminders) parsed.reminders = [10];
  state.tasks.push(Object.assign(base, parsed)); if (parsed.title !== title && parsed.title) toast('✨ ' + [parsed.date && fmtDate(parsed.date, { day: 'numeric', month: 'long' }), parsed.time && faNum(parsed.time), parsed.rec?.freq && '🔁'].filter(Boolean).join(' · '));
  $('#quickTitle').value = ''; commit();
};
$('#openFull').onclick = () => openTask(null);
$('#fab').onclick = () => openTask(null);
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'open') window.focus(); else HOOK.swMessage?.(e.data); });

/* ---------- boot ---------- */
applyTheme(); render(); checkReminders();
if (state.sync.linked) { setSyncState('busy', 'در حال اتصال…'); syncNow(); startSyncLoop(); }
else setSyncState('off', 'گوگل متصل نیست');
