/* روزنگار v9 — پس‌زمینه‌ی دلخواه: یک رنگ، یا طیف دو رنگ با جهت دلخواه */
'use strict';
const S9 = state.settings;
S9.bgCustom ??= { mode: 'grad', c1: '#ffc0d9', c2: '#ffffff', dir: '180deg' };
const BG_DIRS = [['180deg', '⬇ بالا به پایین'], ['90deg', '⬅ راست به چپ'], ['135deg', '↘ مورب'], ['45deg', '↗ مورب'], ['radial', '◎ دایره‌ای']];
const PRESET_PAIRS = [['#ffc0d9', '#ffffff'], ['#ffd6a5', '#fff1e6'], ['#bde0fe', '#ffffff'], ['#caffbf', '#f1fff0'], ['#e9d5ff', '#fdf4ff'], ['#ffadad', '#ffd6a5'], ['#a0c4ff', '#ffc6ff'], ['#1e1b4b', '#6d28d9']];
const customCss = c => c.mode === 'solid' ? 'none'
  : c.dir === 'radial' ? `radial-gradient(circle at 50% 0%, ${c.c1}, ${c.c2} 75%)` : `linear-gradient(${c.dir}, ${c.c1}, ${c.c2})`;
// light or dark text on top of the chosen colour (relative luminance of the average colour)
const lum = hex => { const n = parseInt(hex.slice(1), 16), ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2]; };
const isDarkBg = c => (c.mode === 'solid' ? lum(c.c1) : (lum(c.c1) + lum(c.c2)) / 2) < .22;

const _applyBg9 = applyBg;
applyBg = function () {
  if (S9.bg !== 'custom') { document.documentElement.classList.remove('bgcustom'); return _applyBg9(); }
  const c = S9.bgCustom, de = document.documentElement;
  // a dark custom background switches the app to dark text colours, a light one to light — unless the user forced a theme
  if (S9.theme === 'auto') de.dataset.theme = isDarkBg(c) ? 'dark' : 'light';
  bgLayer.style.background = ''; bgLayer.style.backgroundColor = c.c1; bgLayer.style.backgroundImage = customCss(c); bgLayer.style.backgroundSize = 'cover';
  document.body.style.backgroundImage = 'none'; document.body.style.backgroundColor = c.c1;
  de.classList.add('glass', 'bgcustom'); de.classList.remove('grain');
  document.querySelector('meta[name=theme-color]').content = c.c1;
};

/* ---------- picker: a "رنگ دلخواه" swatch + its controls ---------- */
const panel = h2el(`<div class="bgcust" id="bgCust" hidden>
  <div class="seg"><button type="button" data-bgm="solid">یک رنگ</button><button type="button" data-bgm="grad">طیف دو رنگ</button></div>
  <div class="row"><label>رنگ اول<input type="color" id="bgC1"></label><label class="c2">رنگ دوم<input type="color" id="bgC2"></label></div>
  <label class="c2">جهت طیف<select id="bgDir">${BG_DIRS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
  <div class="pairs">${PRESET_PAIRS.map(([a, b]) => `<button type="button" data-pair="${a},${b}" style="background:linear-gradient(135deg,${a},${b})" aria-label="${a} ${b}"></button>`).join('')}</div>
</div>`);
$('#bgGrid').after(panel);
const _drawBgGrid9 = drawBgGrid;
drawBgGrid = function () {
  _drawBgGrid9();
  const c = S9.bgCustom;
  $('#bgGrid').insertAdjacentHTML('beforeend', `<button type="button" class="bgsw ${S9.bg === 'custom' ? 'on' : ''}" data-bg="custom" style="background-color:${c.c1};background-image:${customCss(c)}"><span>🎨 رنگ دلخواه</span></button>`);
  syncPanel();
};
function syncPanel() {
  const c = S9.bgCustom; panel.hidden = S9.bg !== 'custom';
  $('#bgC1').value = c.c1; $('#bgC2').value = c.c2; $('#bgDir').value = c.dir;
  panel.querySelectorAll('[data-bgm]').forEach(b => b.classList.toggle('on', b.dataset.bgm === c.mode));
  panel.classList.toggle('solid', c.mode === 'solid');
}
function updCustom(patch) {
  Object.assign(S9.bgCustom, patch); S9.bg = 'custom'; save(); applyBg();
  const sw = document.querySelector('[data-bg=custom]'); if (sw) { sw.style.backgroundColor = S9.bgCustom.c1; sw.style.backgroundImage = customCss(S9.bgCustom); }
  syncPanel();
}
panel.addEventListener('click', e => {
  const m = e.target.closest('[data-bgm]'), p = e.target.closest('[data-pair]');
  if (m) updCustom({ mode: m.dataset.bgm });
  if (p) { const [c1, c2] = p.dataset.pair.split(','); updCustom({ c1, c2, mode: 'grad' }); }
});
$('#bgC1').addEventListener('input', e => updCustom({ c1: e.target.value }));
$('#bgC2').addEventListener('input', e => updCustom({ c2: e.target.value }));
$('#bgDir').addEventListener('change', e => updCustom({ dir: e.target.value }));
// choosing the custom swatch shows the controls (the generic [data-bg] handler already applied it)
$('#setForm').addEventListener('click', e => { if (e.target.closest('[data-bg]')) setTimeout(syncPanel, 0); });
applyBg();
