/* روزنگار v6 — AI planning assistant (Claude / OpenAI / GapGPT via our server). */
'use strict';
const aiBtn = h2el('<button type="button" class="mic aibtn" aria-label="assistant">✨</button>');
$('#quickAdd').appendChild(aiBtn);
const aiDlg = sheet('aiDlg', `<div class="pv"><div class="pv-head"><h2>✨ دستیار برنامه‌ریزی</h2><button class="icon" data-ai="close">✕</button></div>
  <div class="row"><label>سرویس<select id="aiProv"></select></label></div>
  <textarea id="aiPrompt" rows="4" placeholder="مثلاً: این هفته باید گزارش ماهانه رو بنویسم (حدود ۳ ساعت)، دوشنبه دکتر برم و آخر هفته خرید خونه کنم"></textarea>
  <div class="row"><button class="primary" data-ai="go" id="aiGo">برنامه‌ریزی کن</button></div>
  <div id="aiOut"></div></div>`);
let aiPlan = [];
async function aiProviders() {
  try {
    const j = await fetch('push/ai.php').then(r => r.json());
    $('#aiProv').innerHTML = (j.providers || []).map(p => `<option value="${p.id}">${esc(p.name)}${p.model ? ' — ' + esc(p.model) : ''}</option>`).join('') || '<option value="">هنوز سرویسی فعال نشده</option>';
    $('#aiProv').value = state.settings.aiProv && (j.providers || []).some(p => p.id === state.settings.aiProv) ? state.settings.aiProv : (j.default || '');
    $('#aiGo').disabled = !(j.providers || []).length;
  } catch { $('#aiProv').innerHTML = '<option value="">اتصال برقرار نشد</option>'; }
}
aiBtn.onclick = () => { aiProviders(); $('#aiOut').innerHTML = ''; aiDlg.showModal(); setTimeout(() => $('#aiPrompt').focus(), 200); };
function aiContext() {
  const t0 = ymd(new Date()), busy = {}, list = filtered();
  for (let i = 0; i < 21; i++) {
    const ds = addDays(t0, i), items = dayList(ds, list).filter(t => t.time && !isDone(t, ds));
    if (items.length) busy[ds] = items.map(t => `${t.time}-${m2t(t2m(t.time) + (t.duration || 30))}`);
  }
  return { today: t0, now: m2t(nowMin()), weekday: new Date().toLocaleDateString('en', { weekday: 'long' }), tz: TZ, weekStart: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][state.settings.weekStart],
    calendars: state.cats.filter(c => !c.ro && !c.local).map(c => ({ id: c.id, name: c.name })), busy };
}
aiDlg.addEventListener('click', async e => {
  const a = e.target.closest('[data-ai]')?.dataset.ai; if (!a) return;
  if (a === 'close') return aiDlg.close();
  if (a === 'go') {
    const prompt = $('#aiPrompt').value.trim(); if (!prompt) return;
    const btn = $('#aiGo'); btn.disabled = true; btn.textContent = '⏳ در حال فکر کردن…'; $('#aiOut').innerHTML = '';
    state.settings.aiProv = $('#aiProv').value; save();
    try {
      const j = await fetch('push/ai.php', { method: 'POST', body: JSON.stringify({ provider: $('#aiProv').value, model: (state.settings.aiModels || {})[$('#aiProv').value] || '', prompt, context: aiContext() }) }).then(r => r.json());
      if (j.error) throw new Error(j.error);
      aiPlan = j.tasks.map(t => ({ ...t, on: true, cal: state.cats.some(c => c.id === t.cal && !c.ro) ? t.cal : (state.settings.defaultCal || state.cats.find(c => c.gcal === 'primary')?.id || '') }));
      drawPlan(j.message);
    } catch (err) { $('#aiOut').innerHTML = `<div class="pv-move">⚠️ ${esc(err.message)}</div>`; }
    btn.disabled = false; btn.textContent = 'برنامه‌ریزی کن';
  }
  if (a === 'add') {
    let n = 0;
    for (const t of aiPlan) if (t.on) { state.tasks.push({ id: uid(), title: t.title, date: t.date, time: t.time, duration: t.duration || 30, notes: t.notes, cat: t.cal, reminders: t.time ? [10] : [-540], rec: {}, created: Date.now(), dirty: true }); n++; }
    aiDlg.close(); commit(); toast(faNum(n) + ' کار اضافه شد');
  }
});
function drawPlan(msg) {
  const cals = state.cats.filter(c => !c.ro && !c.local);
  $('#aiOut').innerHTML = (msg ? `<p class="ai-msg">${esc(msg)}</p>` : '') + aiPlan.map((t, i) => `<div class="ai-row">
    <input type="checkbox" data-aion="${i}" ${t.on ? 'checked' : ''}>
    <div><b>${esc(t.title)}</b><small>${t.date ? fmtDual(t.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'بدون تاریخ'} · ${t.time ? faNum(t.time) + ' (' + faNum(t.duration) + ' دقیقه)' : 'تمام روز'}</small>${t.notes ? `<small class="uc">${esc(t.notes)}</small>` : ''}</div>
    <select data-aical="${i}">${cals.map(c => `<option value="${c.id}" ${c.id === t.cal ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`).join('')
    + (aiPlan.length ? `<button class="primary" data-ai="add" style="width:100%;margin-top:8px">＋ افزودن کارهای انتخاب‌شده</button>` : '<div class="muted">کاری پیشنهاد نشد.</div>');
}
$('#aiOut').addEventListener('change', e => {
  const on = e.target.dataset.aion, cal = e.target.dataset.aical;
  if (on != null) aiPlan[+on].on = e.target.checked;
  if (cal != null) aiPlan[+cal].cal = e.target.value;
});
