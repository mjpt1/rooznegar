/* روزنگار v13 — smart morning summary: the assistant writes the morning notification
   (what's on, the first appointment, what looks important, the biggest free gap). It is written ahead of
   time while the app is open, so the server can still send it in the background at the chosen hour.
   If the assistant can't be reached, the plain summary is used as before. */
'use strict';
const S13 = state.settings;
S13.summary ??= { on: true, time: '07:30' };
S13.summary.smart ??= true;
S13.aiSum ??= {};

const sumItems = ds => dayList(ds, filtered()).filter(t => !isDone(t, ds));
const sumSig = ds => JSON.stringify(sumItems(ds).map(t => [t.title, t.time || '', t.duration || 0]));
const _plainSum = summaryText;
summaryText = function (ds) {
  const plain = _plainSum(ds); if (!plain) return null;
  const c = S13.summary.smart && S13.aiSum[ds];
  return c && c.sig === sumSig(ds) ? { title: c.title, body: c.body } : plain;
};

const sumTry = {};                 // ds → last attempt (ms), so a failing service isn't hammered
let sumBusy = false;
async function writeSmartSummaries() {
  if (sumBusy || !S13.summary?.on || !S13.summary.smart || !navigator.onLine) return;
  sumBusy = true; let ch = false;
  try {
    const [hh, mm] = S13.summary.time.split(':').map(Number), now = new Date(), at = new Date(); at.setHours(hh, mm, 0, 0);
    const days = (now < at ? [todayStr()] : []).concat(addDays(todayStr(), 1));
    for (const ds of days) {
      const items = sumItems(ds), sig = sumSig(ds);
      if (!items.length || S13.aiSum[ds]?.sig === sig || Date.now() - (sumTry[ds] || 0) < 10 * 6e4) continue;
      sumTry[ds] = Date.now();
      const catName = t => state.cats.find(c => c.id === t.cat)?.name || '';
      const context = {
        date: ds, lang: S13.lang === 'en' ? 'en' : 'fa',
        weekday: new Intl.DateTimeFormat(S13.lang === 'en' ? 'en' : 'fa-IR', { weekday: 'long' }).format(parseYmd(ds)),
        items: items.slice(0, 40).map(t => ({ title: t.title, time: t.time || '', end: t.time ? (() => { const m = t2m(t.time) + (+t.duration || 30); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); })() : '', calendar: catName(t), recurring: !!t.rec?.freq })),
      };
      const r = await fetch('push/ai.php', { method: 'POST', body: JSON.stringify({ mode: 'summary', provider: S13.aiProv || undefined, model: (S13.aiModels || {})[S13.aiProv] || '', prompt: 'morning summary', context }) }).then(x => x.json()).catch(() => null);
      if (r?.title && r?.body) { S13.aiSum[ds] = { sig, title: String(r.title), body: String(r.body), at: Date.now() }; ch = true; }
    }
    // forget past days
    for (const k of Object.keys(S13.aiSum)) if (k < todayStr()) { delete S13.aiSum[k]; ch = true; }
  } finally { sumBusy = false; }
  if (ch) { save(); render(); }   // render → features.js re-uploads the reminders with the new text
}
let sumTimer;
const _render13 = render;
render = function () { _render13(); clearTimeout(sumTimer); sumTimer = setTimeout(writeSmartSummaries, 8000); };
setInterval(writeSmartSummaries, 30 * 6e4);

/* settings: one switch under the morning summary */
const sumRow13 = $('#setForm').sumOn?.closest('.row');
sumRow13?.insertAdjacentHTML('afterend', `<label class="check"><input type="checkbox" id="sumSmart"> ✨ خلاصه‌ی صبحگاهی را دستیار هوشمند بنویسد (کار مهم، اولین قرار و وقت‌های آزاد)</label>`);
$('#openSettings').addEventListener('click', () => { if ($('#sumSmart')) $('#sumSmart').checked = S13.summary.smart; });
$('#sumSmart')?.addEventListener('change', e => { S13.summary.smart = e.target.checked; save(); if (e.target.checked) writeSmartSummaries(); render(); });
// v3 rebuilds S.summary on save — keep the smart flag
$('#setDlg').addEventListener('close', () => { if ($('#sumSmart')) S13.summary.smart = $('#sumSmart').checked; save(); });

/* ---------- choose the model (GapGPT has many): list comes from the provider itself ---------- */
S13.aiModels ??= {};
const provSel = $('#setForm').aiProvSel;
provSel?.closest('label')?.insertAdjacentHTML('afterend', `<label>مدل دستیار<select id="aiModelSel"><option value="">پیش‌فرض سرور</option></select></label><small class="muted" id="aiModelNote"></small>`);
async function drawModels() {
  const p = provSel?.value, sel = $('#aiModelSel'); if (!sel) return;
  sel.innerHTML = '<option value="">پیش‌فرض سرور</option>'; $('#aiModelNote').textContent = '';
  if (!p || p === 'anthropic') { sel.disabled = true; return; }
  sel.disabled = false; $('#aiModelNote').textContent = '⏳ در حال خواندن مدل‌ها…';
  try {
    const j = await fetch('push/ai.php?models=' + encodeURIComponent(p)).then(r => r.json());
    sel.insertAdjacentHTML('beforeend', (j.models || []).map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join(''));
    sel.value = S13.aiModels[p] || '';
    $('#aiModelNote').textContent = j.models?.length ? `${faNum(j.models.length)} مدل در دسترس است` : 'فهرست مدل‌ها خوانده نشد';
  } catch { $('#aiModelNote').textContent = 'فهرست مدل‌ها خوانده نشد'; }
}
provSel?.addEventListener('change', drawModels);
$('#openSettings').addEventListener('click', () => setTimeout(drawModels, 600));   // after v7 fills the provider list
$('#aiModelSel')?.addEventListener('change', e => { if (provSel.value) { S13.aiModels[provSel.value] = e.target.value; save(); } });
