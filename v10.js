/* روزنگار v10 — sorting overhaul (⇅ menu, alphabetical, calendar-first, recurring-on-top,
   manual order that keeps the previous order), search icon, menu customisation, font colour. */
'use strict';
const S10 = state.settings;
S10.sortCalFirst ??= true;      // always group by the order of calendars first
S10.sortRecTop ??= false;       // recurring tasks always at the top
S10.hiddenViews ??= [];
S10.fontColor ??= '';

/* ---------- comparators ---------- */
const byAlpha = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fa') || byTime(a, b);
const modeCmp = mode => mode === 'manual' ? (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || byTime(a, b)
  : mode === 'alpha' ? byAlpha : mode === 'calendar' ? (a, b) => catIdx(a) - catIdx(b) || byTime(a, b) : byTime;
function fullCmp(mode) {
  const m = modeCmp(mode);
  return (a, b) => (S10.sortRecTop ? (b.rec?.freq ? 1 : 0) - (a.rec?.freq ? 1 : 0) : 0)
    || (S10.sortCalFirst ? catIdx(a) - catIdx(b) : 0) || m(a, b);
}
sortItems = function (arr, d) {
  const mode = S10.sortMode || 'time';
  if (mode === 'manual') for (const t of arr) if (t.ord == null) slotNew(t);
  const dn = t => (d ? isDone(t, d) : t.done) ? 1 : 0, c = fullCmp(mode);
  return arr.sort((a, b) => dn(a) - dn(b) || c(a, b));
};
// switching to manual keeps the order you were looking at (ord is per task, so recurring tasks keep it every day)
function seedManual(fromMode) {
  const c = fullCmp(fromMode);
  [...state.tasks].sort(c).forEach((t, i) => t.ord = i * 10);
}
function setSort(mode) {
  if (mode === 'manual' && S10.sortMode !== 'manual') {
    seedManual(S10.sortMode || 'time');
    // grouping by calendar would snap every cross-calendar drag back — manual means the user decides
    if (S10.sortCalFirst) { S10.sortCalFirst = false; setTimeout(() => toast('گروه‌بندی بر اساس تقویم خاموش شد تا هر کار را هر جا بکشید'), 1200); }
  }
  S10.sortMode = mode; save(); render();
}

/* ---------- drag: reorder only the dragged list, keep every other day intact ---------- */
// called by v2's endDrag through this hook (see v2.js)
window.reorderBox = function (box) {
  if (S10.sortMode !== 'manual') { seedManual(S10.sortMode || 'time'); S10.sortMode = 'manual'; S10.sortCalFirst = false; toast('ترتیب دستی ذخیره شد'); }
  const list = [...box.querySelectorAll(':scope > .task')].map(n => state.tasks.find(x => x.id === n.dataset.id)).filter(Boolean);
  for (const t of list) if (t.ord == null) slotNew(t);
  const slots = list.map(t => t.ord).sort((a, b) => a - b);
  list.forEach((t, i) => { t.ord = slots[i]; });
  // equal slots (rare) → spread them a little so the order sticks
  for (let i = 1; i < list.length; i++) if (list[i].ord <= list[i - 1].ord) list[i].ord = list[i - 1].ord + 0.001;
};

/* ---------- header: 🔍 icon that opens the search box, ⇅ sort menu ---------- */
const sbox = $('.searchbox');
sbox.insertAdjacentHTML('afterbegin', '<button type="button" class="icon" id="searchBtn" aria-label="جستجو">🔍</button>');
sbox.insertAdjacentHTML('afterend', '<div class="sortwrap"><button type="button" class="icon" id="sortBtn" aria-label="مرتب‌سازی">⇅</button><div id="sortMenu" hidden></div></div>');
const openSearch = on => { sbox.classList.toggle('open', on); $('#searchBtn').textContent = on ? '✕' : '🔍'; document.querySelector('.top').classList.toggle('searching', on); if (on) setTimeout(() => $('#search').focus(), 30); };
// open: 🔍 becomes ✕ — tapping it clears the search and closes it (phones have no "click elsewhere")
$('#searchBtn').onclick = () => { if (sbox.classList.contains('open')) { $('#searchX').click(); openSearch(false); } else openSearch(true); };
document.addEventListener('touchstart', e => { if (sbox.classList.contains('open') && !e.target.closest('.searchbox') && !$('#search').value) openSearch(false); }, { passive: true });
$('#search').addEventListener('blur', () => { if (!$('#search').value) setTimeout(() => openSearch(false), 150); });
$('#searchX').addEventListener('click', () => openSearch(false));

const SORT_MODES = [['time', '⏱ زمان'], ['alpha', '🔤 الفبا'], ['calendar', '🗂 ترتیب تقویم‌ها'], ['manual', '✋ دستی']];
function drawSortMenu() {
  const m = S10.sortMode || 'time';
  const T = x => (S10.lang === 'en' && typeof tr === 'function') ? tr(x) : x;
  $('#sortMenu').innerHTML = T(`<b>مرتب‌سازی بر اساس</b>${SORT_MODES.map(([k, l]) => `<button type="button" data-sm="${k}" class="${m === k ? 'on' : ''}">${l}${m === k ? ' ✓' : ''}</button>`).join('')}
    <hr><label class="check"><input type="checkbox" data-so="sortCalFirst" ${S10.sortCalFirst ? 'checked' : ''}> همیشه اول بر اساس ترتیب تقویم‌ها</label>
    <label class="check"><input type="checkbox" data-so="sortRecTop" ${S10.sortRecTop ? 'checked' : ''}> کارهای تکرارشونده همیشه بالای لیست</label>
    <small class="muted">در حالت دستی کارها را با ⋮⋮ بکشید؛ ترتیب برای همیشه و برای همه‌ی روزها (حتی تکرارها) ذخیره می‌شود.</small>`);
}
$('#sortBtn').onclick = e => { e.stopPropagation(); const mm = $('#sortMenu'); mm.hidden = !mm.hidden; if (!mm.hidden) drawSortMenu(); };
$('#sortMenu').addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('[data-sm]'); if (b) { setSort(b.dataset.sm); drawSortMenu(); if (b.dataset.sm === 'manual') toast('کارها را با ⋮⋮ بکشید و جابه‌جا کنید'); }
});
$('#sortMenu').addEventListener('change', e => { const k = e.target.dataset.so; if (k) { S10[k] = e.target.checked; save(); render(); } });
document.addEventListener('click', e => { if (!e.target.closest('.sortwrap')) $('#sortMenu').hidden = true; });

/* ---------- settings: default sort gets "alphabetical"; menu items; font colour ---------- */
const sf10 = $('#setForm');
sf10.sortDef?.insertAdjacentHTML('beforeend', '<option value="alpha">الفبا</option>');
const viewsFs = sf10.querySelector('fieldset[data-st=views]');
const fontRow = h2el(`<div class="row fontrow"><label>رنگ نوشته‌ها<input type="color" id="fontColor"></label><button type="button" class="ghost" id="fontReset">پیش‌فرض</button></div>`);
sf10.querySelector('fieldset[data-st=look]').appendChild(fontRow);
viewsFs.insertAdjacentHTML('beforeend', '<div class="menuvis"><b>گزینه‌های منو</b><small class="muted">تیک‌دار‌ها در منو نمایش داده می‌شوند</small><div id="menuVis"></div></div>');
const mvKey = b => b.dataset.view || (b.dataset.open ? 'open:' + b.dataset.open : '');
function drawMenuVis() {
  $('#menuVis').innerHTML = [...document.querySelectorAll('#views > button')].filter(mvKey).map(b => `<label class="check"><input type="checkbox" data-mv="${mvKey(b)}" ${S10.hiddenViews.includes(mvKey(b)) ? '' : 'checked'}> ${esc(b.textContent.trim())}</label>`).join('');
}
function applyMenuVis() {
  document.querySelectorAll('#views > button').forEach(b => { const k = mvKey(b); if (k) b.hidden = k !== 'today' && S10.hiddenViews.includes(k); });
}
$('#menuVis').addEventListener('change', e => {
  const v = e.target.dataset.mv; if (!v) return;
  S10.hiddenViews = S10.hiddenViews.filter(x => x !== v); if (!e.target.checked) S10.hiddenViews.push(v);
  save(); applyMenuVis();
});
function applyFont() {
  const de = document.documentElement.style;
  if (S10.fontColor) { de.setProperty('--text', S10.fontColor); de.setProperty('--muted', `color-mix(in srgb, ${S10.fontColor} 62%, transparent)`); }
  else { de.removeProperty('--text'); de.removeProperty('--muted'); }
}
$('#fontColor').addEventListener('input', e => { S10.fontColor = e.target.value; save(); applyFont(); });
$('#fontReset').onclick = () => { S10.fontColor = ''; save(); applyFont(); $('#fontColor').value = '#1d1b2e'; };
$('#openSettings').addEventListener('click', () => {
  drawMenuVis(); $('#fontColor').value = S10.fontColor || getComputedStyle(document.body).color.replace(/rgb\((\d+), (\d+), (\d+)\)/, (_, r, g, b) => '#' + [r, g, b].map(x => (+x).toString(16).padStart(2, '0')).join(''));
});
applyMenuVis(); applyFont();
// the menu buttons from later modules are added after this file runs on some loads
setTimeout(applyMenuVis, 0);
render();
