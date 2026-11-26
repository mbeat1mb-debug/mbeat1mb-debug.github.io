(() => {
const L = HubLogic;
// Remember each answer until the saved data changes. The data list is always replaced, never edited in place,
// so a new list means fresh answers. On two years of data this keeps a tap well under a tenth of a second.
(() => {
  const memo = new WeakMap();
  for (const n of ['badges', 'game', 'records', 'totals', 'season', 'gameBests', 'champMonths', 'dayStreak', 'longestDayStreak', 'stats', 'diagnose', 'pitchDiagnose', 'weekInfo', 'armStatus', 'tune', 'recentDrills', 'weeksMap', 'streak', 'longestStreak', 'bodyNotes']) {
    const f = L[n]; if (typeof f !== 'function') continue;
    L[n] = function (entries, ...rest) {
      if (!Array.isArray(entries)) return f.apply(null, arguments);
      let m = memo.get(entries); if (!m) { m = new Map(); memo.set(entries, m); }
      const k = n + '|' + JSON.stringify(rest); if (m.has(k)) return m.get(k);
      const v = f(entries, ...rest); m.set(k, v); return v;
    };
  }
})();
const DEFAULT_SETTINGS = {
  player: 'Jaxson', bats: 'left', gameBatOz: 19, level: 1, tankLb: null, medBallLb: null, dailyMax: 75, prizes: [], jersey: '20', team: 'Seed Spitters', theme: 'classic', gameLimit: 5,
  batList: [
    { id: 'game', name: 'Easton Hype Fire 29"', oz: 19, est: false, role: 'Game bat' },
    { id: 'practice', name: 'Practice bats 29"', oz: 19, est: false, role: 'Game-weight swings' },
    { id: 'unloaded', name: 'SKLZ unloaded 31"', oz: 18.4, est: true, role: 'Fast swings' },
    { id: 'hand', name: 'SKLZ hand-loaded 31"', oz: 27.6, est: true, role: 'Heavy, tee only' },
    { id: 'end', name: 'SKLZ end-loaded 31"', oz: 27.6, est: true, role: 'Heavy, tee only' },
    { id: 'camwood', name: 'CamWood trainer 29"', oz: 35, est: true, role: 'Swing path, tee only' },
    { id: 'skinny', name: 'Skinny bat', oz: null, est: true, role: 'Pitching machine' }
  ]
};
const ICONS = {
  star: '<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z" fill="currentColor"/>',
  flame: '<path d="M12 2c1 3.5 5 5.5 5 10.5A5 5 0 0 1 7 12.5c0-1.6.6-2.8 1.5-3.8.3 1.3 1 2 2 2.3C10 8 10.5 4.5 12 2z" fill="currentColor"/>',
  bolt: '<path d="M13.5 2L5 13.5h5.5L9.5 22 19 10h-5.8z" fill="currentColor"/>',
  trophy: '<path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 1 1.7V7zm12 0h-1v2.7A2 2 0 0 0 18 8z" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  bat: '<path d="M4 20l8.5-8.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M11.5 12.5l6-7a2.3 2.3 0 0 1 3.3 3.3l-7 6z" fill="currentColor"/><circle cx="6" cy="8" r="2.6" fill="currentColor"/>',
  flag: '<path d="M5 3v18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 4h11l-2.5 4 2.5 4h-11z" fill="currentColor"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'
};
const FRAME_NAMES = ['Stance', 'Load', 'Stride', 'Launch', 'Just before', 'Contact', 'Extension', 'Finish'];
const FRAME_OFFSETS = [-1, -0.5, -0.25, -0.1, -0.033, 0, 0.1, 0.3];
const state = { route: 'today', entries: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), dbState: 'connecting',
  ticks: {}, counts: {}, form: {}, slot: null, snap: null, confirmDel: null, dirty: false, gearDraft: null, cheer: null, openCheck: null, cmpA: null, cmpB: null, unlocked: null, pinMsg: '',
  needKey: false, keyMsg: '', keyBusy: false, keyNet: false, loading: false, media: {}, mediaAsked: {} };
const film = { file: null, url: null, video: null, ready: false, busy: false, msg: '', step: '' };
const lib = { file: null, busy: false, step: '', pct: 0, msg: '', ok: false, usage: null, usageAt: 0, armed: null };
// Parent code: a speed bump that keeps the Coach side with a parent. It is not encryption.
const pinHash = pin => { let x = 5381; const s = 'dugout:' + pin; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return 'h' + x.toString(36); };
const locked = () => !!state.settings.pinHash && state.unlocked !== state.settings.pinHash;
const relock = () => { state.unlocked = null; };
function unlockBox(why) {
  const tryIt = () => { const el = document.getElementById('pin-in'), v = el ? el.value.trim() : '';
    if (pinHash(v) === state.settings.pinHash) { state.unlocked = state.settings.pinHash; state.pinMsg = ''; render(); }
    else { state.pinMsg = 'That code is not right. Try again.'; render(); const e2 = document.getElementById('pin-in'); if (e2) e2.focus(); } };
  return h('section', { class: 'sec' }, h('h2', null, 'Parent code'), why ? h('p', null, why) : null,
    h('div', { class: 'row' }, h('label', { class: 'fld', for: 'pin-in', style: 'flex:0 1 200px' }, h('span', null, 'Code'),
      h('input', { id: 'pin-in', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', onkeydown: e => { if (e.key === 'Enter') tryIt(); } })),
      h('button', { type: 'button', class: 'btn', onclick: tryIt }, 'Unlock')),
    state.pinMsg ? h('p', { class: 'status stop', role: 'alert' }, state.pinMsg) : null,
    h('p', { class: 'small mid' }, 'Forgot it? Ask Claude in chat to clear the parent code.'));
}
let saving = false;
// A second tap while a save is still running is ignored, so nothing is logged twice.
const guard = fn => async (...a) => { if (saving) return; saving = true; try { await fn(...a); } finally { saving = false; } };

const $view = document.getElementById('view'), $toast = document.getElementById('toast'), $tabs = document.getElementById('tabs'), $cheer = document.getElementById('cheer');
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtDate = s => s ? L.parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
const fix = (v, n) => v == null ? '–' : Number(v).toFixed(n == null ? 1 : n);
const pcs = v => v == null ? '–' : Math.round(v * 100) + '%';
const commas = n => Number(n).toLocaleString('en-US');
const who = () => state.settings.player || 'Player';
const str = (v, n) => typeof v === 'string' ? v.slice(0, n || 240) : '';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (typeof v !== 'string' && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
function svg(markup, cls) { const s = h('span', { 'aria-hidden': 'true' }); s.style.display = 'contents'; s.innerHTML = '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + markup + '</svg>'; return s; }
const icon = name => svg(ICONS[name] || ICONS.star);
let toastTimer = null;
function toast(msg) { $toast.textContent = msg; $toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove('on'), 4500); }

/* ---------- data: saved in the family database, behind the family code ---------- */
const KEY_STORE = 'dugout-key';
const normKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function readKey() {
  let k = '';
  let out = false; try { out = localStorage.getItem('dugout-out') === '1'; } catch (e) {}
  if (!out) { try { k = new URLSearchParams(location.search).get('k') || ''; } catch (e) {} }
  if (!k) { try { k = localStorage.getItem(KEY_STORE) || ''; } catch (e) {} }
  return normKey(k);
}
function storeKey(k) { try { localStorage.setItem(KEY_STORE, k); localStorage.removeItem('dugout-out'); } catch (e) {} }
function forgetKey() { try { localStorage.removeItem(KEY_STORE); } catch (e) {} }
let familyKey = '', polling = false;
// The page talks straight to the database's own functions; every one checks the family code itself.
const SUPA_RPC = 'https://yglqvmdrocoknogamagr.supabase.co/rest/v1/rpc/';
const SUPA_KEY = 'sb_publishable_C6Z4sJSfrNNs3OLah7ljhw_oPFMordt';   // public by design; it opens nothing without the family code
const RPC = {
  check: b => ['hub_check', {}],
  load: b => ['hub_load', {}],
  media: b => ['hub_media', { p_ids: b.ids }],
  add: b => ['hub_add', { p_ts: Math.round(b.ts), p_data: b.data, p_media: b.media || null }],
  del: b => ['hub_remove', { p_id: b.id }],
  settings: b => ['hub_save_settings', { p_data: b.data }]
};
async function api(op, body) {
  const [fn, args] = RPC[op](body || {});
  let res;
  try {
    res = await fetch(SUPA_RPC + fn, { method: 'POST', cache: 'no-store',
      headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k: familyKey }, args)) });
  } catch (e) { throw { code: 'offline' }; }
  let data = null; try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw { code: res.status === 403 || res.status === 401 ? 'denied' : res.status === 400 ? 'rejected' : 'unavailable', status: res.status };
  if (op === 'check' && data !== true) throw { code: 'denied' };
  return data || {};
}
function dbMsg(e) {
  const c = e && e.code;
  if (c === 'denied') { state.needKey = true; state.keyMsg = 'This device needs the family code again.'; render(); return 'The family code was not accepted, so nothing was saved.'; }
  if (c === 'offline') return 'No internet connection, so nothing was saved.';
  if (c === 'rejected') return 'That entry was not valid, so it was not saved.';
  return 'The hub could not be reached, so nothing was saved. Try again in a minute.';
}
async function addEntry(obj) {
  const e = Object.assign({ ts: Date.now() }, obj), media = Array.isArray(e.thumbs) ? { thumbs: e.thumbs } : null;
  delete e.thumbs; delete e.id;
  if (e.date && e.date > today()) { toast('That date is in the future. Pick today or an earlier day.'); return false; }
  if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) { toast('Pick a date first.'); return false; }
  try {
    const row = await api('add', { ts: e.ts, data: e, media });
    state.entries = [Object.assign({}, e, { id: row.id })].concat(state.entries);
    if (media) state.media[row.id] = media.thumbs;
    return true;
  } catch (err) { toast(dbMsg(err)); return false; }
}
async function delEntry(id) {
  try { await api('del', { id }); state.entries = state.entries.filter(e => e.id !== id); delete state.media[id]; }
  catch (err) { toast(dbMsg(err)); }
}
async function saveSettings(next) {
  const prev = state.settings; state.settings = next; render();
  try { await api('settings', { data: next }); toast('Saved.'); }
  catch (err) { state.settings = prev; if (state.gearDraft) state.gearDraft = null; render(); toast(dbMsg(err)); }
}
function mergeSettings(d) {
  const s = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), d || {});
  if (Array.isArray(d && d.bats)) { s.batList = d.bats; s.bats = DEFAULT_SETTINGS.bats; }
  if (!Array.isArray(s.batList) || !s.batList.length) s.batList = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.batList));
  if (s.bats !== 'left' && s.bats !== 'right') s.bats = 'left';
  if (!s.player) s.player = DEFAULT_SETTINGS.player;
  if (!Array.isArray(s.prizes)) s.prizes = [];
  if (![0, 3, 5, 10, 99].includes(s.gameLimit)) s.gameLimit = 5;
  if (!L.THEMES.some(t => t.id === s.theme)) s.theme = 'classic';
  return s;
}
const typing = () => { const a = document.activeElement; return !!(a && $view.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); };
function softRender() { if (typing() || film.busy || lib.busy) { state.dirty = true; return; } render(); }
$view.addEventListener('focusout', () => { if (state.dirty) setTimeout(() => { if (!typing() && !film.busy) { state.dirty = false; render(); } }, 60); });

async function load() {
  if (state.loading || saving || state.needKey) return;
  state.loading = true;
  try {
    const d = await api('load');
    state.entries = (d.entries || []).map(r => L.normPitch(Object.assign({}, r.data, { id: r.id, ts: r.ts })));
    if (d.settings) {
      state.settings = mergeSettings(d.settings);
      // A Gear form opened before the saved settings arrived holds defaults. Refresh it, unless Dad already edited it.
      if (state.gearDraft && JSON.stringify(state.gearDraft) === state.gearDraftFrom) state.gearDraft = null;
    }
    state.cut = d.total > state.entries.length;
    state.dbState = 'live';
  } catch (err) {
    if (err.code === 'denied') { state.needKey = true; state.keyMsg = 'This device needs the family code again.'; }
    else state.dbState = state.entries.length ? 'stale' : 'none';
  }
  state.loading = false; softRender();
}
function startPolling() {
  if (polling) return; polling = true;
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
}
async function tryKey(k, typed) {
  familyKey = normKey(k); state.keyBusy = true; state.keyMsg = ''; render();
  try {
    await api('check');
    storeKey(familyKey); state.needKey = false; state.keyBusy = false; state.dbState = 'connecting';
    render(); await load(); startPolling();
  } catch (err) {
    state.keyBusy = false; state.needKey = true; state.keyNet = err.code !== 'denied';
    state.keyMsg = err.code === 'denied' ? (typed ? 'That code did not open the hub. Check it and try again.' : 'This device needs the family code.')
      : err.code === 'offline' ? 'No internet connection. Connect, then try again.' : 'The hub could not be reached. Try again in a minute.';
    if (err.code === 'denied' && !typed) forgetKey();
    render();
  }
}
const mediaOf = e => (e && state.media[e.id]) || null;
function needMedia(list) {
  const ids = list.filter(e => e && e.id && !state.media[e.id] && !state.mediaAsked[e.id]).map(e => e.id).slice(0, 20);
  if (!ids.length) return;
  ids.forEach(id => { state.mediaAsked[id] = true; });
  api('media', { ids }).then(d => { for (const r of d.rows || []) state.media[r.id] = r.media && Array.isArray(r.media.thumbs) ? r.media.thumbs : []; softRender(); })
    .catch(() => { ids.forEach(id => { delete state.mediaAsked[id]; }); });
}
function viewSetup() {
  const go = () => { const v = (document.getElementById('fam-code') || {}).value || ''; if (normKey(v).length < 8) { state.keyMsg = 'Enter the whole family code.'; render(); return; } tryKey(v, true); };
  return page(strip('Dugout Hub', 'Enter the family code to open the hub on this device. You only do this once.'),
    h('section', { class: 'sec plain' },
      h('div', { class: 'row' }, h('label', { class: 'fld', for: 'fam-code', style: 'flex:1 1 260px' }, h('span', null, 'Family code'),
        h('input', { id: 'fam-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX', disabled: state.keyBusy, onkeydown: e => { if (e.key === 'Enter') go(); } })),
        h('button', { type: 'button', class: 'btn', disabled: state.keyBusy, onclick: go }, state.keyBusy ? 'Opening...' : 'Open the hub')),
      state.keyMsg ? h('p', { class: 'status ' + (state.keyNet ? 'wait' : 'stop'), role: 'alert' }, state.keyMsg) : null,
      state.keyNet && familyKey ? h('div', null, h('button', { type: 'button', class: 'btn line', onclick: () => tryKey(familyKey, false) }, 'Try again')) : null,
      h('p', { class: 'small mid' }, 'The code is on the setup message. Opening the hub from the setup link fills it in for you.')));
}

async function boot() {
  route();
  familyKey = readKey();
  if (!familyKey) { state.needKey = true; render(); return; }
  await tryKey(familyKey, false);
}

/* ---------- shared bits ---------- */
function banner() {
  const m = { none: 'The hub could not be reached. Check the internet connection; it tries again every minute.',
    stale: 'Showing what was loaded last. The hub could not be reached just now.',
    slow: 'Still reaching the saved data. What you see may be out of date.' }[state.dbState];
  if (!m && state.cut) return h('p', { class: 'note' }, 'Only the newest 20,000 entries are loaded, so some old totals may read low. Tell Claude to raise the limit.');
  return m ? h('p', { class: 'note' }, m) : null;
}
function inp(key, label, o) {
  o = o || {};
  if (state.form[key] == null && o.def != null) state.form[key] = String(o.def);
  const type = o.type || 'number', id = 'f-' + key;
  return h('label', { class: 'fld', for: id }, h('span', null, label),
    h('input', { id, type, inputmode: type === 'number' ? (o.mode || 'decimal') : null, step: type === 'number' ? 'any' : null, min: type === 'number' ? '0' : null,
      value: state.form[key] == null ? '' : state.form[key], oninput: e => { state.form[key] = e.target.value; } }));
}
function sel(key, label, opts, def) {
  if (state.form[key] == null) state.form[key] = def;
  const id = 'f-' + key;
  return h('label', { class: 'fld', for: id }, h('span', null, label),
    h('select', { id, onchange: e => { state.form[key] = e.target.value; } }, opts.map(o => h('option', { value: o[0], selected: state.form[key] === o[0] }, o[1]))));
}
const num = key => { const v = parseFloat(state.form[key]); return isFinite(v) ? v : null; };
const clear = (...keys) => keys.forEach(k => delete state.form[k]);
function spark(points, unit) {
  const w = h('div');
  if (points.length < 2) { w.append(h('p', { class: 'small mid' }, points.length ? 'One entry so far. The line appears after the second.' : 'No entries yet.')); return w; }
  const vs = points.map(p => p.v), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), span = (hi - lo) || 1;
  const X = i => 6 + i * (288 / (points.length - 1)), Y = v => 62 - (v - lo) / span * 48, last = points.length - 1;
  const line = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  w.innerHTML = '<svg class="spark" viewBox="0 0 300 84" role="img" aria-label="Trend from ' + fix(vs[0]) + ' to ' + fix(vs[last]) + ' ' + unit + '">' +
    '<line x1="6" x2="294" y1="14" y2="14" stroke="#cdd5df"/><line x1="6" x2="294" y1="62" y2="62" stroke="#cdd5df"/>' +
    '<path d="' + line + ' L294 70 L6 70 Z" fill="#f28c38" opacity=".45"/><path d="' + line + '" fill="none" stroke="#161616" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + X(last).toFixed(1) + '" cy="' + Y(vs[last]).toFixed(1) + '" r="5" fill="#d2342a" stroke="#fff" stroke-width="2"/>' +
    '<text x="6" y="11" font-size="12" fill="#55667f">high ' + fix(hi) + '</text><text x="6" y="82" font-size="12" fill="#55667f">low ' + fix(lo) + '</text></svg>';
  return w;
}
function strip(title, sub) { return h('div', { class: 'strip' }, h('div', { class: 'in' }, h('h1', null, title), sub ? h('p', { class: 'mid' }, sub) : null)); }
const page = (head, ...body) => [head, h('main', { class: 'in' }, banner(), body)];

/* ---------- Player: jersey header ---------- */
function diamond(frac) {
  const P = [[66, 118], [118, 66], [66, 14], [14, 66], [66, 118]], seg = Math.min(3, Math.floor(frac * 4)), t = frac * 4 - seg;
  const x = P[seg][0] + (P[seg + 1][0] - P[seg][0]) * t, y = P[seg][1] + (P[seg + 1][1] - P[seg][1]) * t, side = 73.54, total = side * 4;
  const base = (i, on) => '<rect x="' + (P[i][0] - 8) + '" y="' + (P[i][1] - 8) + '" width="16" height="16" transform="rotate(45 ' + P[i][0] + ' ' + P[i][1] + ')" fill="' + (on ? '#161616' : '#fff') + '" stroke="#161616" stroke-width="3"/>';
  const w = h('span', { role: 'img', 'aria-label': Math.round(frac * 100) + ' percent of the way around the bases' }); w.style.display = 'contents';
  w.innerHTML = '<svg viewBox="0 0 132 132"><path d="M66 118L118 66L66 14L14 66Z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>' +
    '<path d="M66 118L118 66L66 14L14 66Z" fill="none" stroke="#161616" stroke-width="5" stroke-linejoin="round" stroke-dasharray="' + (frac * total).toFixed(1) + ' ' + total + '"/>' +
    base(1, frac >= .25) + base(2, frac >= .5) + base(3, frac >= .75) +
    '<path d="M58 118h16v-8l-8-7-8 7z" fill="#fff" stroke="#161616" stroke-width="3" stroke-linejoin="round"/>' +
    '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" fill="#d2342a" stroke="#fff" stroke-width="3"/></svg>';
  return w;
}
function jersey(p) {
  const g = L.game(state.entries), earned = L.badges(state.entries).filter(b => b.on).length, st = L.streak(state.entries, p.t);
  const tail = h('span', { 'aria-hidden': 'true' }); tail.style.display = 'contents';
  tail.innerHTML = '<svg class="tail" viewBox="0 0 430 46"><path d="M4 20C120 2 290 4 426 16C300 18 170 26 92 42C120 28 80 22 4 20Z" fill="#161616" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  return h('div', { class: 'jersey' }, h('div', { class: 'in' },
    h('div', null, h('div', { class: 'name' }, who()), tail,
      h('div', { class: 'rank' }, 'Level ' + g.level + ' ' + g.title),
      h('div', { class: 'line' }, h('span', null, h('b', null, st), st === 1 ? ' week streak' : ' week streak'), h('span', null, h('b', null, p.wk.count + ' of 3'), ' sessions this week'), h('span', null, h('b', null, earned), earned === 1 ? ' badge' : ' badges'))),
    h('div', { class: 'bases' }, diamond(g.frac), h('div', null, h('div', { class: 'xp num' }, g.into + ' XP'), h('div', null, g.baseText), h('div', { class: 'small' }, (g.need - g.into) + ' more to score and reach Level ' + (g.level + 1))))));
}

/* ---------- Player: Today ---------- */
function plan() {
  const t = today(), wk = L.weekInfo(state.entries, t), arm = L.armStatus(state.entries, t, state.settings.dailyMax);
  const tuned = L.tune(state.entries, t);
  const pick = wk.lockedFocus ? { focus: wk.lockedFocus, why: wk.lockedWhy || '' } : L.decideFocus(L.stats(state.entries, t), state.entries, t, tuned.rules);
  if (!L.FOCUS[pick.focus]) pick.focus = 'baseline';
  const before = state.entries.filter(e => e.date < wk.monday), targets = L.diagnose(state.entries, t), pitchTargets = L.pitchDiagnose(state.entries, t);
  const week = L.buildWeek(pick.focus, state.settings.level, !arm.cleared, { monday: wk.monday, level: L.game(before).level, recent: L.recentDrills(state.entries, wk.monday), targets, pitchTargets, entries: before });
  return { t, wk, arm, pick, tuned, targets, pitchTargets, week };
}
const checks = () => state.entries.filter(e => e.kind === 'analysis').sort(L.byDate).reverse();
function viewToday() {
  const p = plan(), slots = ['A', 'B', 'C'], F = L.FOCUS[p.pick.focus];
  // Until he taps a day himself, always show the first unfinished one (data can arrive after the first draw).
  if (!state.slotPicked || !state.slot || !p.week[state.slot]) state.slot = slots.find(s => !p.wk.done[s]) || 'A';
  const tk = p.wk.monday + state.slot;
  const ticks = state.ticks[tk] || (state.ticks[tk] = {}), counts = state.counts[tk] || (state.counts[tk] = {});
  // "Pick one" slots: his choices live with the ticks, keyed pick:<slot>
  const picks = {}; for (const k in ticks) if (k.indexOf('pick:') === 0) picks[k.slice(5)] = ticks[k];
  const ses = L.resolveSession(p.week[state.slot], picks);
  const items = ses.blocks.flatMap(b => b.items), doneN = items.filter(i => ticks[i.id]).length, isDone = !!p.wk.done[state.slot];
  const last = checks()[0]; let n = 0;
  const nextUp = items.find(i => !ticks[i.id]);
  const fixSec = (p.targets.length || p.pitchTargets.length) && p.pick.focus !== 'baseline' ? h('section', { class: 'sec' }, h('h2', null, 'Game fix'),
    p.targets.slice(0, 2).map(x => [h('p', { class: 'say' }, 'Hitting: ' + x.title), h('p', { class: 'small mid' }, x.why + ' Fix-it drill: ' + L.FIXES[x.id].drill.title + '.')]),
    p.pitchTargets.slice(0, 1).map(x => [h('p', { class: 'say' }, 'Pitching: ' + x.title), h('p', { class: 'small mid' }, x.why + (p.arm.cleared ? ' Fix-it drill on Day 2: ' + L.PFIXES[x.id].drill.title + '.' : ' Fix-it drill comes back after his arm rest.'))])) : null;
  const filmSec = last && str(last.fix && last.fix.title) ? h('section', { class: 'sec' }, h('h2', null, 'From your last filmstrip'), h('p', { class: 'say' }, str(last.fix && last.fix.title, 80)),
    h('p', null, h('a', { href: '#film' }, 'Open the film room'))) : null;
  return page(jersey(p), h('div', { class: 'todaygrid' },
    tilesRow(p),
    // The session comes first: it is what he opened the app to do.
    h('section', { class: 'session' },
      h('div', { class: 'focusline' }, h('h2', null, 'This week: ' + F.name), h('p', { class: 'say' }, F.kid),
        p.arm.cleared ? null : h('p', { class: 'note' }, 'Arm rest until ' + fmtDate(L.addDays(p.arm.clearedOn, -1)) + '. No throwing drills today.')),
      slots.every(s => p.wk.done[s]) ? h('div', { class: 'weekdone' }, h('b', null, 'Week complete!'), h('span', null, 'All 3 days done. A new plan shows up Monday.')) : null,
      h('div', { class: 'stabs', role: 'group', 'aria-label': 'Pick a session' }, slots.map(s => h('button', { type: 'button', 'aria-pressed': String(state.slot === s), onclick: () => { state.slot = s; state.slotPicked = true; render(); } },
        p.week[s].title, h('small', null, p.week[s].sub), h('small', null, p.wk.done[s] ? 'Done ✓' : p.week[s].min + ' minutes')))),
      h('div', null, ses.blocks.map(b => [
        h('div', { class: 'inning' }, h('span', null, b.name), h('span', { class: 'num' }, b.min + ' min')),
        b.items.map(i => { n++; const on = !!ticks[i.id] || isDone;
          if (i.choices && !i.slot) return h('div', { class: 'li pick', id: 'li-' + i.id, tabindex: '-1' }, h('span', { class: 'n' }, n),
            h('span', null, h('span', { class: 't' }, i.title), h('span', { class: 'd' }, isDone ? 'Choices: ' + i.choices.map(c => c.title).join(', ') : 'You choose! Tap the one you want to do today.'),
              isDone ? null : h('div', { class: 'picks', role: 'group', 'aria-label': i.title }, i.choices.map(c => h('button', { type: 'button', class: 'pickbtn', onclick: () => { ticks['pick:' + i.id] = c.id; saveTicks(); HubGames.Sound.tick && HubGames.Sound.tick(); render(); } },
                h('b', null, c.title), h('span', null, c.text))))));
          return [
          h('button', { type: 'button', class: 'li', id: 'li-' + i.id, 'aria-pressed': String(on), disabled: isDone, onclick: () => { ticks[i.id] = !ticks[i.id]; saveTicks(); render(); if (ticks[i.id]) { HubGames.Sound.later(HubGames.Sound.crack); toNext(items, ticks, i.id); } } },
            h('span', { class: 'n' }, n), h('span', null, h('span', { class: 't' }, i.title), h('span', { class: 'd' }, i.text), L.tipFor(i) ? h('span', { class: 'tip' }, 'Tip: ' + L.tipFor(i)) : null, L.whyFor(i) ? h('span', { class: 'why' }, 'Why: ' + L.whyFor(i)) : null), h('span', { class: 'mark' })),
          VIDEOS_ON && L.videoFor(i) ? h('div', { class: 'watch' }, h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.video = L.videoFor(i); state.videoFor = i.title; renderVideo(); } }, '▶ Watch how')) : null,
          i.count && !isDone ? h('div', { class: 'count' }, h('label', { for: 'cnt-' + i.id }, 'Solid hits'),
            h('input', { id: 'cnt-' + i.id, type: 'number', inputmode: 'numeric', min: '0', max: String(i.count), value: counts[i.id] == null ? '' : counts[i.id], oninput: e => { counts[i.id] = e.target.value; saveTicks(); } }),
            h('span', { class: 'mid' }, 'out of ' + i.count)) : null,
          !isDone ? extras(i, counts) : null,
          i.slot && !isDone && !ticks[i.id] ? h('div', { class: 'watch' }, h('button', { type: 'button', class: 'btn ghost small', onclick: () => { delete ticks['pick:' + i.slot]; saveTicks(); render(); } }, '\u21bb Pick a different one')) : null]; })])),
      // Progress and Finish ride along at the bottom of the screen while he works.
      isDone ? h('p', { class: 'status ok' }, ses.title + ' is done for this week.')
        : h('div', { class: 'sessbar' },
          h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(items.length), 'aria-valuenow': String(doneN), 'aria-label': ses.title + ' progress' },
            h('div', { class: 'fill', style: 'width:' + Math.round(doneN / items.length * 100) + '%' }), h('span', null, doneN + ' of ' + items.length + ' done')),
          h('div', { class: 'sessbtns' },
            nextUp ? h('button', { type: 'button', class: 'btn line small', onclick: () => jumpTo(nextUp.id) }, 'Next: ' + nextUp.title) : null,
            h('button', { type: 'button', class: 'btn big', disabled: doneN < items.length, onclick: guard(() => finish(p, ses, tk)) },
              doneN < items.length ? (items.length - doneN) + ' to go' : 'Finish and collect ' + L.XP[state.slot] + ' XP'))))),
    // Coaching notes come after the session.
    fixSec || filmSec ? h('div', { class: 'two even' }, fixSec, filmSec) : null);
}
// Smooth scroll that respects "reduce motion".
const motion = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function jumpTo(id) { const el = document.getElementById('li-' + id); if (el) { el.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'center' }); try { el.focus({ preventScroll: true }); } catch (e) {} } }
// After ticking a drill, bring the next open one into view if it is off screen (not when he ticks out of order above it).
function toNext(items, ticks, fromId) {
  const at = items.findIndex(i => i.id === fromId), nx = items.slice(at + 1).find(i => !ticks[i.id]);
  if (!nx) return;
  const el = document.getElementById('li-' + nx.id), bar = document.querySelector('.sessbar');
  if (!el) return;
  const r = el.getBoundingClientRect(), limit = (bar ? bar.getBoundingClientRect().top : innerHeight) - 8;
  if (r.top > limit - 60 || r.bottom > limit) el.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'center' });
}
// Four small tiles instead of four tall cards. Tap one to open its details right below.
function tilesRow(p) {
  const t = p.t, c = L.challengeFor(t, p.arm.cleared), cDone = L.challengeDone(state.entries, t, c), ds = L.dayStreak(state.entries, t);
  const g = L.game(state.entries), pz = (state.settings.prizes || []).slice().sort((a, b) => a.level - b.level), earned = pz.find(z => g.level >= z.level && !z.given), next = pz.find(z => z.level > g.level);
  const S = L.season(state.entries, t), gm = S.games.find(x => x.monday === p.wk.monday), nb = nextBadge();
  const mixG = L.mixProgress(state.entries, t, p.pick.focus), mixN = mixG.filter(m => m.done).length, mixS = L.mixStreak(state.entries, t);
  const tiles = [
    gameLimit() === 0 ? null : ['mix', '\u{1F3AE}', 'Arcade Mix', mixN === 3 ? 'Done \u2713' : mixN + ' of 3' + (mixS.n ? ' \u00b7 \u{1F525}' + mixS.n : ''), () => h('div', null, mixCard(), h('p', null, h('a', { href: '#arcade', class: 'btn line' }, 'Go to the Arcade')))],
    ['chal', '\u{1F525}', 'Daily challenge', cDone ? 'Done ✓' : ds.n ? ds.n + (ds.n === 1 ? ' day' : ' days') + ' in a row' : 'Start a streak', challengeCard],
    (earned || next) ? ['prize', '\u{1F381}', earned ? 'Prize earned!' : next.text, earned ? 'Show Dad' : commas((next.level - 1) * L.XP.perLevel - g.xp) + ' XP to go', () => prizeCard()] : null,
    gm ? ['game', '⚾', (gm.title ? 'Title game' : 'This week') + ' vs ' + gm.opp, gm.status === 'W' ? 'Won ' + gm.us + '–' + gm.them : 'Day 1 + Day 2 wins it', seasonCard] : null,
    nb ? ['badge', '\u{1F3C5}', nb.name, commas(Math.min(nb.have || 0, nb.goal)) + ' / ' + commas(nb.goal), () => h('section', { class: 'sec' }, h('h2', null, 'Next badge'), h('p', { class: 'say' }, h('b', null, nb.name), ': ' + nb.how), bar(nb), h('p', null, h('a', { href: '#trophies' }, 'See all badges')))] : null
  ].filter(Boolean);
  const open = tiles.find(x => x[0] === state.tile);
  return h('div', { class: 'tilewrap' },
    h('div', { class: 'tiles' }, tiles.map(x => h('button', { type: 'button', class: 'tile' + (x[0] === 'chal' && !cDone ? ' todo' : ''), 'aria-expanded': String(state.tile === x[0]), 'aria-controls': 'tile-more', onclick: () => { state.tile = state.tile === x[0] ? null : x[0]; render(); } },
      h('span', { class: 'ti', 'aria-hidden': 'true' }, x[1]), h('span', { class: 'tt' }, x[2]), h('span', { class: 'ts' }, x[3])))),
    h('div', { id: 'tile-more' }, open ? open[4](p) : null));
}
function numBox(id, label, max, counts, key, after) {
  return [h('label', { for: id }, label), h('input', { id, type: 'number', inputmode: 'decimal', min: '0', max: max == null ? null : String(max), value: counts[key] == null ? '' : counts[key], oninput: e => { counts[key] = e.target.value; saveTicks(); } }),
    after ? h('span', { class: 'mid' }, after) : null];
}
// Score, boss result and pitch count boxes under a drill.
function extras(i, counts) {
  const out = [];
  if (i.pts) out.push(h('div', { class: 'count' }, numBox('pts-' + i.id, 'Points', i.max, counts, 'pts:' + i.id, i.pts + (i.max ? ' (max ' + i.max + ')' : ''))));
  if (i.pitches) out.push(h('div', { class: 'count' }, numBox('pc-' + i.id, 'Pitches thrown', i.pitches, counts, 'pc:' + i.id, 'Blank counts as ' + i.pitches + ' for his arm tracker.')));
  if (i.boss) {
    const b = i.boss;
    out.push(h('div', { class: 'count' }, numBox('boss-me', b.label, b.kind === 'contact' ? 10 : null, counts, 'boss', b.target != null ? 'to beat: ' + (Math.round(b.target * 10) / 10) + ' ' + b.unit : b.dad ? null : 'first one sets the bar'),
      b.dad ? numBox('boss-dad', "Dad's points", null, counts, 'bossdad') : null));
  }
  return out.length ? out : null;
}
function saveTicks() { try { localStorage.setItem('dugout-ticks', JSON.stringify({ t: state.ticks, c: state.counts })); } catch (e) {} }
// A typo like 25 out of 20 used to be quietly cut to 20, which could hand out a badge he did not earn. Now it is stopped.
function badCount(items, counts) {
  const chk = (raw, max, whole, what) => {
    if (raw == null || String(raw).trim() === '') return null;
    const v = Number(raw);
    if (!isFinite(v) || v < 0) return what + ' cannot be below 0.';
    if (whole && v !== Math.round(v)) return what + ' must be a whole number.';
    if (max != null && v > max) return what + ' cannot be more than ' + max + '.';
    return null;
  };
  for (const i of items) {
    const m = (i.count && chk(counts[i.id], i.count, true, 'Solid hits')) || (i.pts && chk(counts['pts:' + i.id], i.max || null, true, 'Points for ' + i.title)) ||
      (i.pitches && chk(counts['pc:' + i.id], i.pitches, true, 'Pitches thrown')) ||
      (i.boss && chk(counts.boss, i.boss.kind === 'contact' ? 10 : i.boss.kind === 'speed' ? 120 : null, i.boss.kind !== 'speed', i.boss.label)) || (i.boss && chk(counts.bossdad, null, true, "Dad's points"));
    if (m) return m;
  }
  return null;
}
const REC_NAMES = { bat: ['Top bat speed', r => fix(r.v) + ' mph'], exit: ['Top exit speed', r => fix(r.v) + ' mph'], contact: ['Best machine round', r => r.made + ' of ' + r.of],
  jump: ['Longest jump', r => fix(r.v, 0) + ' in'], pushups: ['Most push-ups', r => fix(r.v, 0)], plank: ['Longest plank', r => fix(r.v, 0) + ' sec'], velo: ['Fastest pitch', r => fix(r.v) + ' mph'] };
function newRecords(before, after) {
  const a = L.records(before), b = L.records(after), out = [];
  for (const k of Object.keys(REC_NAMES)) if (a[k] && b[k] && b[k].v > a[k].v) out.push(REC_NAMES[k][0] + ': ' + REC_NAMES[k][1](b[k]));
  return out;
}
async function finish(p, ses, tk) {
  const counts = state.counts[tk] || {}, before = L.badges(state.entries).filter(b => b.on).map(b => b.id), g0 = L.game(state.entries), lvlBefore = g0.level, entriesBefore = state.entries.slice();
  const items = ses.blocks.flatMap(b => b.items), val = k => { const v = parseFloat(counts[k]); return isFinite(v) && v >= 0 ? v : null; };
  const bad = badCount(items, counts); if (bad) { toast(bad); return; }
  let points = null;
  const drillPts = {};
  for (const i of items) if (i.pts) { const v = val('pts:' + i.id); if (v != null) { drillPts[i.id] = Math.min(v, i.max || v); points = (points || 0) + drillPts[i.id]; } }
  const bi = items.find(i => i.boss), bres = bi ? val('boss') : null, bdad = bi ? val('bossdad') : null;
  const boss = bi && bres != null ? { kind: bi.boss.kind, target: bi.boss.target, result: bi.boss.kind === 'contact' ? Math.min(10, Math.round(bres)) : bres, dad: bdad, won: !!L.bossWon(bi.boss, bres, bdad) } : null;
  const added = [{ kind: 'session', date: p.t, slot: state.slot, focus: p.pick.focus, why: p.pick.why, complete: true, level: state.settings.level, drills: L.drillIds(ses), points, drillPts: Object.keys(drillPts).length ? drillPts : null, boss, ts: Date.now() }];
  if (!(await addEntry(added[0]))) return;
  for (const i of items) {
    const made = parseInt(counts[i.id], 10);
    if (i.count && isFinite(made)) { const m = { kind: 'machine', date: p.t, made: Math.max(0, Math.min(made, i.count)), of: i.count, from: added[0].ts }; added.push(m); await addEntry(m); }
    if (i.pitches) { const n = val('pc:' + i.id), pc = { kind: 'pitch', date: p.t, pitches: Math.round(Math.min(n == null ? i.pitches : n, i.pitches)), outs: 0, where: 'practice', from: added[0].ts }; if (pc.pitches > 0) { added.push(pc); await addEntry(pc); } }
  }
  if (boss && boss.kind === 'speed') { const sw = { kind: 'swing', date: p.t, ball: 'real', batSpeed: null, batMax: boss.result, exitVelo: null, from: added[0].ts }; added.push(sw); await addEntry(sw); }
  if (boss && boss.kind === 'contact') { const m = { kind: 'machine', date: p.t, made: boss.result, of: 10, from: added[0].ts }; added.push(m); await addEntry(m); }
  const credit = L.sessionReps(ses);
  if (credit.swings + credit.pushups + credit.situps + credit.squats > 0) { const r = Object.assign({ kind: 'reps', date: p.t, from: added[0].ts, slot: added[0].slot }, credit); added.push(r); await addEntry(r); }
  const after = state.entries;
  const g = L.game(after);
  state.cheer = { title: ses.title + ' done', xp: g.xp - g0.xp, from: g0.frac, to: g.level > lvlBefore ? 1 : g.frac, records: newRecords(entriesBefore, after), tips: L.scoreTips(items, drillPts), points, boss, badges: L.badges(after).filter(b => b.on && before.indexOf(b.id) < 0), chal: !L.challengeDone(after, today(), L.challengeFor(today(), p.arm.cleared)), arcade: gameLimit() !== 0 && (gameLimit() >= 99 || after.filter(e => e.kind === 'arcade' && e.date === today()).length < gameLimit()), unlocks: L.THEMES.filter(x => x.level > lvlBefore && x.level <= g.level).map(x => 'the ' + x.name + ' theme'), levelUp: g.level > lvlBefore ? g : null, prizes: g.level > lvlBefore ? (state.settings.prizes || []).filter(z => z.level > lvlBefore && z.level <= g.level) : [], base: g.baseText,
    logged: [[credit.swings, 'swings'], [credit.squats, 'squats'], [credit.pushups, 'push-ups'], [credit.situps, 'sit-ups']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]).join(', ') };
  delete state.ticks[tk]; delete state.counts[tk]; saveTicks(); state.slot = null; state.slotPicked = false; render();
}
// The runner moves from where he was to where he is now, so every session visibly gets him closer to home.
function runBases(from, to) {
  const path = 'M66 118L118 66L66 14L14 66Z', total = 294.2, f = Math.max(0, Math.min(1, from)), t = Math.max(f, Math.min(1, to));
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = h('span', { class: 'run', role: 'img', 'aria-label': t >= 1 ? 'He ran all the way home' : 'He moved ' + Math.round((t - f) * 100) + ' percent further around the bases' });
  const base = (x, y, on) => '<rect x="' + (x - 8) + '" y="' + (y - 8) + '" width="16" height="16" transform="rotate(45 ' + x + ' ' + y + ')" fill="' + (on ? '#161616' : '#fff') + '" stroke="#161616" stroke-width="3"/>';
  w.innerHTML = '<svg viewBox="0 0 132 132" width="150" height="150"><path d="' + path + '" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>' +
    '<path d="' + path + '" fill="none" stroke="#161616" stroke-width="5" stroke-linejoin="round" stroke-dasharray="' + total + ' ' + total + '" stroke-dashoffset="' + (total * (1 - (still ? t : f))).toFixed(1) + '">' +
    (still ? '' : '<animate attributeName="stroke-dashoffset" values="' + (total * (1 - f)).toFixed(1) + ';' + (total * (1 - f)).toFixed(1) + ';' + (total * (1 - t)).toFixed(1) + '" keyTimes="0;0.2;1" dur="1.7s" fill="freeze"/>') + '</path>' +
    base(118, 66, t >= .25) + base(66, 14, t >= .5) + base(14, 66, t >= .75) +
    '<path d="M58 118h16v-8l-8-7-8 7z" fill="' + (t >= 1 ? '#161616' : '#fff') + '" stroke="#161616" stroke-width="3" stroke-linejoin="round"/>' +
    '<circle r="9" fill="#d2342a" stroke="#fff" stroke-width="3">' + (still ? '' : '<animateMotion dur="1.7s" fill="freeze" calcMode="linear" keyPoints="' + f.toFixed(3) + ';' + f.toFixed(3) + ';' + t.toFixed(3) + '" keyTimes="0;0.2;1" path="' + path + '"/>') + '</circle>' +
    (still ? '<circle cx="0" cy="0" r="9" fill="#d2342a" stroke="#fff" stroke-width="3" transform="translate(' + pointOn(t).join(' ') + ')"/>' : '') + '</svg>';
  if (still) { const c = w.querySelector('circle:not([transform])'); if (c) c.remove(); }
  return w;
}
function pointOn(frac) {
  const P = [[66, 118], [118, 66], [66, 14], [14, 66], [66, 118]], seg = Math.min(3, Math.floor(frac * 4)), t = frac * 4 - seg;
  return [P[seg][0] + (P[seg + 1][0] - P[seg][0]) * t, P[seg][1] + (P[seg + 1][1] - P[seg][1]) * t].map(n => n.toFixed(1));
}
function confetti() {
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' }), colors = ['#161616', '#ffffff', '#d2342a', '#d15d0a'];
  for (let i = 0; i < 36; i++) { const s = h('i'); s.style.left = (Math.random() * 100).toFixed(1) + '%'; s.style.background = colors[i % 4];
    s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; s.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + 's';
    s.style.setProperty('--x', ((Math.random() - 0.5) * 160).toFixed(0) + 'px'); s.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg'); box.appendChild(s); }
  return box;
}
// Drill videos stay off until Dad has approved the list. The player is YouTube's privacy-enhanced embed inside a sandbox
// without pop-ups, so tapping the YouTube logo or a title cannot open YouTube or any other site.
const VIDEOS_ON = true;
function renderVideo() {
  const box = document.getElementById('video'), v = state.video;
  if (state.upView) return renderUpView(box);
  if (!v) { box.replaceChildren(); return; }
  const close = () => { state.video = null; renderVideo(); };
  box.replaceChildren(h('div', { class: 'vid', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Video: ' + v.title, onclick: e => { if (e.target.classList.contains('vid')) close(); } },
    h('div', { class: 'vbox' },
      h('div', { class: 'vhead' }, h('div', null, h('b', null, state.videoFor || v.title), h('span', null, v.title + ' · ' + v.by)), h('button', { type: 'button', class: 'btn', id: 'vid-close', onclick: close }, 'Back to my drill')),
      h('div', { class: 'vframe' }, h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?rel=0&modestbranding=1&playsinline=1&autoplay=1&iv_load_policy=3',
        title: v.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin',
        sandbox: 'allow-scripts allow-same-origin allow-presentation' })),
      h('p', { class: 'small mid' }, navigator.onLine === false ? 'Videos need the internet. Connect to Wi-Fi and try again.' : 'Watch it, then try it yourself.'))));
  const b = document.getElementById('vid-close'); if (b) b.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (state.video || state.upView)) { state.video = null; state.upView = null; renderVideo(); } });
function renderCheer() {
  if (state.cheer && !state.cheer.played) { state.cheer.played = true; HubGames.Sound.cheer(); if (state.cheer.levelUp) setTimeout(() => HubGames.Sound.say('Level up!'), 900); }
  const c = state.cheer;
  if (!c) { $cheer.replaceChildren(); return; }
  $cheer.replaceChildren(h('div', { class: 'cheer', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.title },
    confetti(),
    h('div', { class: 'box' }, h('h1', null, c.title), runBases(c.from || 0, c.to || 0), h('div', { class: 'gain' }, '+' + c.xp + ' XP'),
      h('p', { class: 'say' }, c.levelUp ? 'You scored. Level ' + c.levelUp.level + ', ' + c.levelUp.title + '.' + (c.levelUp.level === 2 ? ' New drills unlock next week.' : '') : c.base + '.'),
      (c.prizes || []).map(z => h('p', { class: 'say prize' }, '\u{1F381} You earned your prize: ', h('b', null, z.text), '! Show Dad.')),
      (c.unlocks || []).map(u => h('p', { class: 'say' }, 'Unlocked: ' + u + '. Pick it on the Trophies page.')),
      c.points != null ? h('p', { class: 'say' }, c.points + ' points today.') : null,
      (c.records || []).map(r => h('p', { class: 'say rec' }, 'New record! ', h('b', null, r), ' +' + L.XP.record + ' XP')),
      c.boss ? h('p', { class: 'say' }, c.boss.won ? 'You beat the Boss! +' + L.XP.boss + ' XP' : 'The Boss wins this time. Get him next week.') : null,
      (c.tips || []).map(t => h('p', { class: 'say coachtip' }, t)),
      c.logged ? h('p', null, 'Logged for you: ' + c.logged + '.') : null,
      c.badges.map(b => h('p', { class: 'say' }, 'New badge: ', h('b', null, b.name))),
      h('div', { class: 'nextsteps' },
        c.chal ? h('button', { type: 'button', class: 'btn line', onclick: () => { state.cheer = null; state.tile = 'chal'; renderCheer(); location.hash = '#today'; render(); window.scrollTo(0, 0); } }, 'Do today\u2019s challenge') : null,
        c.arcade ? h('button', { type: 'button', class: 'btn line', onclick: () => { state.cheer = null; renderCheer(); location.hash = '#arcade'; } }, 'Play the Arcade') : null,
        h('button', { type: 'button', class: 'btn big', id: 'cheer-ok', onclick: () => { state.cheer = null; renderCheer(); window.scrollTo(0, 0); } }, 'Back to the dugout')))));
  const ok = document.getElementById('cheer-ok'); if (ok) ok.focus();
}

/* ---------- Player: Film room ---------- */
function loadFilm(file) {
  if (!file) return;
  if (film.url) URL.revokeObjectURL(film.url);
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.controls = false;
  v.autoplay = true;   // iPad Safari only loads frames once a muted clip starts; it is paused as soon as the first frame arrives
  film.file = file; film.url = URL.createObjectURL(file); film.video = v; film.ready = false; film.needTap = false; film.msg = ''; film.step = '';
  const ready = () => { if (film.video !== v) return; try { v.pause(); } catch (e) {} if (film.ready) return; film.ready = true; film.needTap = false;
    try { v.currentTime = Math.min(v.duration / 2, Math.max(0, v.duration - 0.05)); } catch (e) {} render(); };
  v.addEventListener('loadeddata', ready); v.addEventListener('playing', ready);
  setTimeout(() => { if (film.video === v && !film.ready) { film.needTap = true; render(); } }, 5000);
  v.addEventListener('error', () => { film.msg = 'This video could not be opened here. Try a shorter clip, or record it in the standard camera format.'; film.video = null; render(); });
  v.addEventListener('seeked', () => { const s = document.getElementById('scrub'), t = document.getElementById('scrub-t'); if (s && !film.busy) s.value = String(v.currentTime); if (t) t.textContent = v.currentTime.toFixed(2) + ' s'; });
  v.src = film.url; v.load(); render();
}
function seekTo(v, t) {
  return new Promise(res => {
    const tt = Math.max(0, Math.min((v.duration || 0) - 0.02, t));
    if (Math.abs(v.currentTime - tt) < 0.004) return res();
    // Wait until the new frame is actually on screen, not just until the jump is reported, so the reader never
    // grabs the previous frame on a slow decode. Browsers without frame callbacks fall back to a short wait.
    let done = false, shown = false; const show = () => { if (shown) return; shown = true; res(); };
    const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin);
      if (v.requestVideoFrameCallback) { v.requestVideoFrameCallback(() => setTimeout(show, 20)); setTimeout(show, 400); } else setTimeout(show, 90); };
    v.addEventListener('seeked', fin); setTimeout(fin, 3000); v.currentTime = tt;
  });
}
function grab(v, maxSide) {
  const s = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(v.videoWidth * s)); c.height = Math.max(2, Math.round(v.videoHeight * s));
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c;
}
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
/* ---------- Swing reader: body tracking runs on this device; the video never leaves it ---------- */
let poseEngine = null;
const POSE_LOAD_MS = 30000;   // give up if the first-time engine download stalls, so the button never hangs on "Working..."
function loadPose() {
  if (poseEngine) return poseEngine;
  const build = new Promise((res, rej) => {
    const go = async () => {
      try {
        const p = new window.Pose({ locateFile: f => 'pose/' + f });
        p.setOptions({ modelComplexity: 1, smoothLandmarks: false, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        // One frame at a time; a late answer for an earlier frame that timed out is thrown away, not given to the next frame.
        let want = null, ticket = 0, live = 0; p.onResults(r => { if (want && live === ticket) { const w = want; want = null; w(r.poseLandmarks || null); } });
        await p.initialize();
        res({ reset: () => p.reset(), read: c => new Promise((ok, bad) => { const me = ++ticket; live = me; want = ok;
          p.send({ image: c }).then(() => { if (live === me && want === ok) { want = null; ok(null); } }).catch(bad);
          setTimeout(() => { if (want === ok) { want = null; live = -1; ok(null); } }, 15000); }) });
      } catch (e) { rej(e); }
    };
    if (window.Pose) return go();
    const sc = document.createElement('script'); sc.src = 'pose/pose.js'; sc.onload = go; sc.onerror = () => rej(new Error('engine'));
    document.head.appendChild(sc);
  });
  // A stalled download (weak connection on first use) used to hang forever; this surfaces the plain fallback instead.
  let timer;
  const cap = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('engine-timeout')), POSE_LOAD_MS); });
  poseEngine = Promise.race([build, cap]).then(e => { clearTimeout(timer); return e; }, e => { clearTimeout(timer); poseEngine = null; throw e; });
  return poseEngine;
}
async function readSwing(v, contact, speed) {
  const eng = await loadPose();
  const sp = speed > 0 ? speed : 1, half = sp / HubSwing.SAMPLES_PER_SEC / 2;
  const t1 = HubSwing.sampleTimes(contact, speed, v.duration), c1 = t1.findIndex(x => x.k === 0);
  // Second read: the same moments shifted half a frame, so one lucky or unlucky frame cannot decide a grade.
  const t2 = t1.map(x => ({ k: x.k, t: x.t + half })).filter(x => !(v.duration > 0) || x.t <= v.duration), c2 = t2.findIndex(x => x.k === 0);
  let cw = 0, ch = 0;
  const pass = async (times, n) => {
    const frames = [];
    for (let i = 0; i < times.length; i++) {
      film.step = 'Reading his swing (read ' + n + ' of 2): frame ' + (i + 1) + ' of ' + times.length + '...'; renderFilmStatus();
      await seekTo(v, times[i].t); const cv = grab(v, 480); cw = cv.width; ch = cv.height;
      const lm = await eng.read(cv);
      frames.push(lm ? lm.map(q => ({ x: q.x * cv.width, y: q.y * cv.height, v: q.visibility == null ? 1 : q.visibility })) : null);
    }
    return frames;
  };
  eng.reset(); const frames = await pass(t1, 1), r1 = HubSwing.analyze(frames, t1, c1, speed);
  if (!r1.ok) return { res: r1, frames, times: t1, w: cw, h: ch };   // a clip that fails the first read is not read twice
  eng.reset(); const frames2 = await pass(t2, 2), r2 = c2 >= 0 ? HubSwing.analyze(frames2, t2, c2, speed) : null;
  return { res: HubSwing.merge(r1, r2), frames, times: t1, w: cw, h: ch };
}
/* Find the contact moment for him. Two steps, because a real swing passes the zone in about a tenth of a second:
   1) a quick scan of the whole clip for the moments with the most hand and shoulder motion, ignoring frames where
      the tracking jumps to someone else; 2) a frame-by-frame look (30 a second) around the best few moments,
      picking the frame where his hands are moving fastest. Returns the raw video time of contact. */
async function findContact(v) {
  const eng = await loadPose();
  const dur = v.duration;
  if (!(dur > 0) || !isFinite(dur)) throw new Error('duration');
  const pose = async (t, label) => {
    film.step = label; renderFilmStatus();
    await seekTo(v, t); const cv = grab(v, 480), lm = await eng.read(cv);
    if (!lm) return null;
    const P = i => ({ x: lm[i].x * cv.width, y: lm[i].y * cv.height, v: lm[i].visibility == null ? 1 : lm[i].visibility });
    const sh = [P(11), P(12)], hp = [P(23), P(24)], wr = [P(15), P(16)];
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const seenW = wr.filter(w => w.v >= 0.3);
    const hand = seenW.length === 2 ? mid(seenW[0], seenW[1]) : seenW.length ? seenW[0] : mid(wr[0], wr[1]);
    const shc = mid(sh[0], sh[1]), hipc = mid(hp[0], hp[1]);
    return { t, hand, hipc, gap: Math.hypot(wr[0].x - wr[1].x, wr[0].y - wr[1].y), sep: sh[1].x - sh[0].x, torso: Math.hypot(shc.x - hipc.x, shc.y - hipc.y) };
  };
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 1) quick scan
  const COUNT = Math.max(24, Math.min(40, Math.round(dur * 10)));
  eng.reset(); const scan = [];
  for (let i = 0; i < COUNT; i++) scan.push(await pose(dur * i / (COUNT - 1), 'Finding the swing (quick look): ' + (i + 1) + ' of ' + COUNT + '...'));
  const seen = scan.filter(Boolean).length / COUNT, cands = [];
  for (let i = 2; i < scan.length; i++) {   // the first pair after starting is skipped: tracking is still settling
    const a = scan[i - 1], b = scan[i]; if (!a || !b) continue;
    const tor = (a.torso + b.torso) / 2; if (!(tor > 0)) continue;
    if (d(a.hipc, b.hipc) / tor > 0.35) continue;   // running, walking, or the tracking jumped to someone else
    cands.push({ t: (a.t + b.t) / 2, m: (d(a.hand, b.hand) + Math.abs(b.sep - a.sep)) / tor });
  }
  cands.sort((x, y) => y.m - x.m);
  const scanTop = cands.slice(0, 12).map(c => ({ t: Math.round(c.t * 100) / 100, m: Math.round(c.m * 100) / 100 }));
  const picks = []; for (const c of cands) { if (picks.every(p => Math.abs(p.t - c.t) > 0.35)) picks.push(c); if (picks.length === 5) break; }
  if (!picks.length) return { contact: null, seen };
  // 2) frame-by-frame around each candidate
  const tried = [], step = 1 / 30;
  const look = async (from, to, label, fr) => { for (let t = Math.max(0, from), n = fr.length; t <= Math.min(dur, to) + 1e-6; t += step, n++) fr.push(await pose(t, label + ': frame ' + (n + 1) + '...')); };
  for (let k = 0; k < picks.length; k++) {
    const c = picks[k], label = 'Finding the swing (close look ' + (k + 1) + ' of ' + picks.length + ')';
    let fr = []; eng.reset(); await look(c.t - 0.3, c.t + 0.3, label, fr);
    const peakOf = list => { const ok = list.filter(Boolean); if (ok.length < 6) return null;
      const tor = ok.map(x => x.torso).sort((a, b) => a - b)[Math.floor(ok.length / 2)]; let peak = null;
      const sp = [];
      for (let i = 2; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (!a || !b || !(tor > 0)) { sp.push(null); continue; }
        if (d(a.hipc, b.hipc) / tor > 0.3) { sp.push(null); continue; } const spd = d(a.hand, b.hand) / tor / (b.t - a.t);
        sp.push({ spd, t: b.t }); if (!peak || spd > peak.spd) peak = { spd, t: b.t, i: sp.length - 1 }; }
      if (!peak) return null;
      // Hands keep speeding into the follow-through on video, so contact is where the fast run starts (60% of the top speed).
      let j = peak.i; while (j > 0 && sp[j - 1] && sp[j - 1].spd >= 0.6 * peak.spd) j--;
      return { peak: { spd: peak.spd, t: sp[j].t }, tor, ok }; };
    let got = peakOf(fr);
    // The fastest frame sitting at the edge means the swing runs past this look: extend once that way.
    if (got && fr.length && got.peak.t >= fr[fr.length - 1 > 0 ? fr.length - 1 : 0].t - 2.5 * step) { const end = fr[fr.length - 1] && fr[fr.length - 1].t; if (end != null && end < dur - step) { await look(end + step, end + 0.3, label, fr); got = peakOf(fr); } }
    else if (got && fr[0] && got.peak.t <= fr[0].t + 2.5 * step && fr[0].t > step) { const ext = []; eng.reset(); await look(fr[0].t - 0.3, fr[0].t - step, label, ext); fr = ext.concat(fr); got = peakOf(fr); }
    if (!got) continue;
    const { peak, tor, ok } = got;
    // Judge the moments up to contact: batters take off running right after they hit.
    const pre = ok.filter(x => x.t <= peak.t + 0.02), turnWin = ok.filter(x => x.t >= peak.t - 0.35 && x.t <= peak.t + 0.1);
    const seps = turnWin.map(x => x.sep / tor), turn = seps.length ? Math.max.apply(null, seps) - Math.min.apply(null, seps) : 0;
    const preWin = pre.filter(x => x.t >= peak.t - 0.4);
    const hx = preWin.map(x => x.hipc.x / tor), travel = hx.length ? Math.max.apply(null, hx) - Math.min.apply(null, hx) : 9;
    // One blurry frame can throw the tracking off for a moment, so the single worst hop is ignored; walking or a second person keeps hopping.
    const hops = []; for (let i = 1; i < preWin.length; i++) hops.push(d(preWin[i].hipc, preWin[i - 1].hipc) / tor);
    hops.sort((x, y) => y - x); const jump = hops.length > 1 ? hops[1] : (hops[0] || 0);
    // Both hands on the bat: running or walking pumps the arms apart, a swing keeps them together.
    const gaps = preWin.map(x => x.gap / tor).sort((a, b) => a - b), gapMed = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 9;
    // A swing turns the shoulders some; running turns the whole body around.
    const swingLike = travel <= 0.6 && jump <= 0.35 && turn >= 0.15 && turn <= 1.0 && gapMed <= 0.7;
    const score = swingLike ? peak.spd * (1 + turn) : 0;
    tried.push({ t: Math.round(peak.t * 1000) / 1000, spd: Math.round(peak.spd * 10) / 10, turn: Math.round(turn * 100) / 100, travel: Math.round(travel * 100) / 100, jump: Math.round(jump * 100) / 100, gap: Math.round(gapMed * 100) / 100, score: Math.round(score * 10) / 10 });
  }
  // The swing comes before the follow-through, the bat drop and the run: take the earliest strong swing-like moment.
  const valid = tried.filter(x => x.score > 0), top = valid.reduce((m, x) => Math.max(m, x.score), 0);
  const best = valid.filter(x => x.score >= 0.4 * top).sort((a, b) => a.t - b.t)[0] || null;
  return { contact: best ? best.t : null, seen, tried, scanTop };
}
// "Find the swing" button: auto-detect contact so he does not have to scrub to the exact frame. The slider stays for nudging.
async function findSwing() {
  const v = film.video;
  if (!v || !film.ready || film.busy) return;
  film.busy = true; film.msg = ''; film.step = 'Loading the swing reader (the first time takes a little while)...'; render();
  try {
    const r = await findContact(v);
    if (r.contact == null) {
      film.msg = r.seen < 0.35
        ? 'Could barely see him in this clip. Film from the side with his whole body, head to feet, in the picture, then try again.'
        : 'Could not spot the swing. Make sure the clip shows the full swing, or slide to contact yourself below.';
    } else {
      await seekTo(v, r.contact);
      film.msg = 'Found the swing — the slider is set to contact. Nudge it a frame either way if it looks off, then save the filmstrip.';
    }
  } catch (e) {
    film.msg = 'The swing reader could not start on this device. Slide to contact yourself below.';
  } finally {
    film.busy = false; film.step = ''; render();
  }
}
// Draw his skeleton on a filmstrip frame using the nearest tracked frame.
function drawBones(cv, read, offReal) {
  const i = read.times.reduce((b, x, j) => Math.abs(x.k / HubSwing.SAMPLES_PER_SEC - offReal) < Math.abs(read.times[b].k / HubSwing.SAMPLES_PER_SEC - offReal) ? j : b, 0);
  const pts = read.frames[i]; if (!pts) return;
  const g = cv.getContext('2d'), sx = cv.width / read.w, sy = cv.height / read.h;
  g.lineWidth = Math.max(2, cv.width / 90); g.strokeStyle = 'rgba(255,214,0,0.95)'; g.lineCap = 'round';
  for (const [a, b] of HubSwing.BONES) { const A = pts[a], B = pts[b]; if (!A || !B || A.v < 0.5 || B.v < 0.5) continue;
    g.beginPath(); g.moveTo(A.x * sx, A.y * sy); g.lineTo(B.x * sx, B.y * sy); g.stroke(); }
}
async function saveStrip() {
  const v = film.video;
  if (!v || !film.ready || film.busy) return;
  const contact = v.currentTime, speed = parseFloat(state.form.k_speed || '1') || 1, tag = state.form.k_tag || 'practice', view = state.form.k_view || 'side';
  film.busy = true; film.msg = ''; film.step = 'Pulling 8 frames from the video...'; render();
  let cvs, read = null, readErr = '';
  try {
    cvs = [];
    for (const off of FRAME_OFFSETS) { await seekTo(v, contact + off * speed); cvs.push(grab(v, 300)); }
  } catch (e) { cvs = null; }
  if (cvs && view === 'side') {
    film.step = 'Loading the swing reader (the first time takes a little while)...'; renderFilmStatus();
    try { read = await readSwing(v, contact, speed); if (read.res.ok) cvs.forEach((cv, k) => drawBones(cv, read, FRAME_OFFSETS[k])); }
    catch (e) { read = null; readErr = 'The swing reader could not start on this device, so only the frames were saved.'; }
  }
  try { await seekTo(v, contact); } catch (e) {}
  const thumbs = cvs ? cvs.map(cv => cv.toDataURL('image/jpeg', 0.6)) : null;
  film.busy = false; film.step = '';
  if (!thumbs) { film.msg = 'The frames could not be pulled from this video. Try a shorter clip in the standard camera format.'; state.dirty = false; return render(); }
  const sw = read ? read.res : null;
  let area = ['contact', 'path', 'timing', 'speed'].indexOf(state.form.k_area) >= 0 ? state.form.k_area : 'none';
  let note = String(state.form.k_note || '').trim().slice(0, 120);
  if (sw && sw.ok && sw.top) { if (area === 'none') area = sw.top.area; if (!note) note = sw.top.title + ' (swing reader)'; }
  const entry = { kind: 'analysis', date: state.form.k_date || today(), tag, view, speed, contactAt: Math.round(contact * 100) / 100,
    fix: { title: note }, fixArea: area, thumbs };
  if (sw) entry.swing = sw.ok ? { ok: true, v: sw.v, checks: sw.checks, faults: sw.faults, top: sw.top, quality: sw.quality, front: sw.front } : { ok: false, why: sw.why, quality: sw.quality };
  if (await addEntry(entry)) {
    state.openCheck = null; film.msg = readErr || (sw && !sw.ok ? 'Filmstrip saved. Swing reader: ' + sw.why : 'Filmstrip saved.'); clear('k_note', 'k_area');
    if (film.url) URL.revokeObjectURL(film.url); film.video = null; film.file = null; film.url = null; film.ready = false;
  }
  state.dirty = false; render();
}
function renderFilmStatus() { const el = document.getElementById('film-step'); if (el) el.textContent = film.step; }
function showCheck(e) {
  const safe = u => typeof u === 'string' && u.indexOf('data:image/jpeg;base64,') === 0;
  const m = mediaOf(e), th = (m || []).filter(safe), idx = th.length === 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 3, 5, 7];
  const note = str(e.fix && e.fix.title, 120), area = L.FOCUS[e.fixArea];
  return [
    th.length ? h('div', { class: 'strip8' }, th.map((u, k) => { const i = idx[k]; return h('div', { class: 'fr' + (i === 5 ? ' hit' : '') },
      h('img', { src: u, alt: FRAME_NAMES[i] + ' frame', loading: 'lazy' }), h('b', null, FRAME_NAMES[i])); }))
      : h('p', { class: 'small mid' }, m ? 'No frames were saved for this swing.' : 'Loading the frames...'),
    swingReport(e),
    h('div', { class: 'stack' }, h('h3', null, "Coach's note"), h('p', { class: 'say' }, note || 'No note yet.'), area ? h('p', { class: 'mid' }, 'Points to: ' + area.name) : null)];
}
// Dad's call on each reader check. The newest call per swing and check counts.
function reviews() { const m = {}; for (const r of state.entries.filter(x => x.kind === 'review').sort((a, b) => (a.ts || 0) - (b.ts || 0))) m[r.of + ':' + r.check] = r; return m; }
function agreement() { const all = Object.values(reviews()); const yes = all.filter(r => r.agree).length; return { yes, n: all.length }; }
async function review(e, ck, agree) { if (await addEntry({ kind: 'review', date: today(), of: e.id, check: ck.id, agree, status: ck.status })) toast(agree ? 'Marked right. Thanks, that tracks how accurate the reader is.' : 'Marked wrong. It will not drive his drills.'); render(); }
const MARK = { good: ['ok', 'Good'], watch: ['wait', 'Watch'], work: ['stop', 'Work on it'], unsure: ['', 'Not clear'], info: ['', 'Info'] };
function swingReport(e) {
  const sw = e.swing;
  if (!sw) return e.view === 'side' || !e.view ? null : h('p', { class: 'small mid' }, 'Not graded: the swing reader needs a side-view video.');
  if (!sw.ok) return h('section', { class: 'stack' }, h('h3', null, 'Swing reader'), h('p', { class: 'note' }, str(sw.why, 200)));
  const earlier = checks().filter(x => x.id !== e.id && x.swing && x.swing.ok && x.date <= e.date).map(x => x.swing);
  const rv0 = reviews(), ag = agreement();
  const rows = (sw.checks || []).map(ck => {
    const m = MARK[ck.status] || MARK.info, tr = HubSwing.trend(ck.id, earlier), fx = sw.faults.indexOf(ck.id) >= 0 && L.FIXES[ck.id] ? L.FIXES[ck.id].drill : null;
    return h('div', { class: 'ck' },
      h('div', { class: 'ckhead' }, h('b', null, str(ck.label, 60)), h('span', { class: 'status ' + m[0] }, m[1])),
      h('p', { class: 'num' }, str(ck.value, 60) + '  (target: ' + str(ck.target, 60).toLowerCase() + ')' + (tr ? '. His last ' + tr.n + (tr.n === 1 ? ' swing: ' : ' swings average: ') + (ck.id === 'seq' ? (tr.avg >= 0 ? 'hips first by ' + tr.avg + ' ms' : 'shoulders first by ' + (-tr.avg) + ' ms') : tr.avg + (/degrees/.test(ck.value) ? ' degrees' : / ms/.test(ck.value) ? ' ms' : '%')) : '')),
      h('p', { class: 'small' }, str(ck.note, 200)),
      fx ? h('p', { class: 'small' }, h('b', null, 'Fix-it drill: ' + fx.title + '. '), fx.text) : null,
      h('details', null, h('summary', { class: 'small mid' }, 'Why this matters'), h('p', { class: 'small mid' }, str(ck.research, 400))),
      e.id && !locked() && (ck.status === 'good' || ck.status === 'watch' || ck.status === 'work') ? (() => { const rv = rv0[e.id + ':' + ck.id];
        return h('div', { class: 'row', role: 'group', 'aria-label': 'Is this call right?' }, h('span', { class: 'small mid' }, rv ? (rv.agree ? 'You said: right.' : 'You said: wrong.') : 'Coach: is this call right?'),
          h('button', { type: 'button', class: 'btn line sm' + (rv && rv.agree ? ' on' : ''), onclick: guard(() => review(e, ck, true)) }, 'Right'),
          h('button', { type: 'button', class: 'btn line sm' + (rv && !rv.agree ? ' on' : ''), onclick: guard(() => review(e, ck, false)) }, 'Wrong')); })() : null);
  });
  const nWork = sw.faults.length;
  return h('section', { class: 'stack' }, h('h3', null, 'Swing reader'),
    h('p', { class: 'say' }, nWork ? 'Top thing to fix: ' + str(sw.top && sw.top.title, 80) + '.' : 'No problems flagged on this swing.'),
    ag.n ? h('p', { class: 'small' }, h('b', null, 'Reader accuracy so far: '), 'you agreed with ' + ag.yes + ' of ' + ag.n + ' calls (' + ag.yes + ' ÷ ' + ag.n + ' = ' + Math.round(ag.yes / ag.n * 100) + '%).' + (ag.n < 20 ? ' Mark about 20 calls before trusting this number.' : '')) : null,
    rows,
    h('p', { class: 'small mid' }, 'Read from ' + sw.quality.found + ' of ' + sw.quality.frames + ' frames of one camera, so numbers are estimates (a few percent or degrees either way). Height is estimated from the video. Film straight from the side, whole body in view, steady camera.'));
}
function compare(all) {
  if (all.length < 2) return null;
  needMedia(all.filter(e => e.id === state.cmpA || e.id === state.cmpB).concat(all.slice(0, 2)));
  const safe = u => typeof u === 'string' && u.indexOf('data:image/jpeg;base64,') === 0;
  const frame = (e, i) => { const th = mediaOf(e) || []; const u = th.length === 8 ? th[i] : th.length === 4 ? th[[1, 3, 5, 7].indexOf(i)] : null; return safe(u) ? u : null; };
  let A = all.find(e => e.id === state.cmpA) || all[0];
  let B = all.find(e => e.id === state.cmpB) || all.find(e => e.id !== A.id && e.tag !== A.tag) || all.find(e => e.id !== A.id);
  if (B.id === A.id) B = all.find(e => e.id !== A.id);
  const opt = e => fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice') + ': ' + (str(e.fix && e.fix.title, 40) || 'no note');
  const pick = (id, label, cur, key) => h('label', { class: 'fld', for: id }, h('span', null, label), h('select', { id, onchange: ev => { state[key] = ev.target.value; render(); } }, all.map(e => h('option', { value: e.id, selected: e.id === cur.id }, opt(e)))));
  const cell = (e, i) => { const u = frame(e, i); return u ? h('img', { src: u, alt: FRAME_NAMES[i] + ', ' + fmtDate(e.date), loading: 'lazy' }) : h('div', { class: 'blank' }); };
  const nameOf = e => (L.FOCUS[e.fixArea] || {}).name || 'nothing specific', run = L.fixRun(all);
  const side = (e, tag) => h('div', { class: 'stack' }, h('h3', null, tag + ': ' + fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice')), h('p', { class: 'say' }, str(e.fix && e.fix.title, 80) || 'No note'));
  return h('section', { class: 'sec' }, h('h2', null, 'Compare two swings'),
    h('div', { class: 'row' }, pick('cmp-a', 'Top row', A, 'cmpA'), pick('cmp-b', 'Bottom row', B, 'cmpB')),
    h('div', { class: 'cmp' }, FRAME_NAMES.map((n, i) => [cell(A, i), h('b', null, n), cell(B, i)])),
    h('div', { class: 'two even' }, side(A, 'Top'), side(B, 'Bottom')),
    h('p', null, A.fixArea === B.fixArea ? (A.fixArea === 'none' || !L.FOCUS[A.fixArea] ? 'Neither note points to anything yet.' : 'Both notes point to the same thing: ' + nameOf(A) + '.') : 'They point to different things: ' + nameOf(A) + ' on top, ' + nameOf(B) + ' on the bottom.'),
    run ? h('p', null, run.name + ' has come up in ' + run.count + ' of his last ' + run.of + ' filmstrips.') : null,
    h('p', { class: 'small mid' }, 'The frames line up by moment, so differences show only if contact was marked carefully on both.'));
}
/* ---------- Videos, photos and PDFs library ---------- */
const uploads = () => state.entries.filter(e => e.kind === 'upload' && e.path).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.ts || 0) - (a.ts || 0));
function libUsage(force) {
  if (!force && lib.usageAt > Date.now() - 60000) return;
  lib.usageAt = Date.now();
  HubMedia.usage(familyKey).then(u => { lib.usage = u; softRender(); }).catch(() => { lib.usageAt = 0; });
}
function libStep(text, pct) {
  lib.step = text; lib.pct = pct || 0;
  const s = document.getElementById('up-step'), f = document.getElementById('up-fill'), p = document.getElementById('up-prog'), n = Math.round((pct || 0) * 100);
  if (s) s.textContent = text; if (f) f.style.width = n + '%'; if (p) p.setAttribute('aria-valuenow', String(n));
}
async function libUpload() {
  const f = lib.file;
  if (!f || lib.busy) return;
  const date = state.form.up_date || today();
  if (date > today()) { lib.msg = 'That date is in the future. Pick today or an earlier day.'; lib.ok = false; return render(); }
  lib.busy = true; lib.msg = ''; lib.ok = false; render();
  try {
    const got = await HubMedia.upload(f, familyKey, libStep);
    libStep('Saving...', 1);
    const title = str(state.form.up_title, 80).trim() || (got.type === 'video' ? 'Video' : got.type === 'photo' ? 'Photo' : str(f.name, 60) || 'PDF');
    const saved = await addEntry({ kind: 'upload', date, title, path: got.path, type: got.type, size: got.size, dur: got.dur, thumbs: got.poster ? [got.poster] : undefined });
    if (!saved) { HubMedia.remove(familyKey, got.path).catch(() => {}); lib.msg = 'The file uploaded but could not be saved to the hub, so it was removed. Try again.'; }
    else { lib.ok = true; lib.msg = 'Uploaded: ' + title + (got.shrunk ? '. It was shrunk to fit; shrunk videos have no sound.' : '.'); lib.file = null; delete state.form.up_title; }
  } catch (e) {
    if (e && e.code === 'denied') dbMsg(e);
    lib.msg = (e && e.msg) || 'The upload did not finish. Try again.';
  }
  lib.busy = false; lib.step = ''; lib.pct = 0; libUsage(true); render();
}
async function libDelete(e) {
  if (lib.armed !== e.id) { lib.armed = e.id; return renderVideo(); }
  lib.armed = null;
  try { await HubMedia.remove(familyKey, e.path); } catch (err) { toast((err && err.msg) || 'Could not delete it. Try again.'); return renderVideo(); }
  state.upView = null; renderVideo(); await delEntry(e.id); libUsage(true); render();
}
async function libRead(e) {
  // Pull an uploaded swing into the filmstrip maker above.
  try {
    toast('Loading the video into the film room...');
    const url = await HubMedia.link(familyKey, e.path), r = await fetch(url);
    if (!r.ok) throw 0;
    const b = await r.blob();
    state.upView = null; renderVideo();
    state.form.k_date = e.date || today();
    loadFilm(new File([b], 'swing.' + e.path.split('.').pop(), { type: b.type || 'video/mp4' }));
    const s = document.getElementById('film-file'); if (s) s.scrollIntoView({ block: 'start' });
  } catch (err) { toast('That video could not be loaded. Check the internet and try again.'); }
}
function viewLibrary() {
  const list = uploads(), u = lib.usage, ft = lib.file ? HubMedia.kindOf(lib.file) : null, full = u ? u.used / u.quota : 0;
  needMedia(list);
  libUsage();
  return h('section', { class: 'sec', id: 'library' }, h('h2', null, 'Videos & photos'),
    h('p', { class: 'small mid' }, "Upload from Dad's phone or the iPad: game clips, swing videos, photos, lineup cards, PDFs."),
    h('label', { class: 'fld', for: 'up-file' }, h('span', null, 'Pick a video, photo or PDF'),
      h('input', { id: 'up-file', type: 'file', accept: 'video/*,image/*,application/pdf,.pdf', disabled: lib.busy,
        onchange: e => { lib.file = e.target.files[0] || null; lib.msg = ''; lib.ok = false; render(); } })),
    lib.file ? [
      h('p', { class: 'small' }, (ft ? ({ video: 'Video', photo: 'Photo', pdf: 'PDF' })[ft] : 'Not a video, photo or PDF') + ': ' + str(lib.file.name, 60) + ', ' + HubMedia.mb(lib.file.size) +
        (ft === 'video' && lib.file.size > HubMedia.MAX ? '. Over 45 MB, so it gets shrunk first. That takes about as long as the video plays, so keep this screen open.' : '')),
      h('div', { class: 'row' }, inp('up_title', 'Name it (optional)', { type: 'text' }), inp('up_date', 'Date', { type: 'date', def: today() })),
      h('button', { type: 'button', class: 'btn big', disabled: lib.busy || !ft, onclick: guard(libUpload) }, lib.busy ? 'Uploading...' : 'Upload'),
      lib.busy ? h('div', null,
        h('div', { class: 'prog', id: 'up-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(lib.pct * 100)), 'aria-label': 'Upload progress' },
          h('div', { class: 'fill', id: 'up-fill', style: 'width:' + Math.round(lib.pct * 100) + '%' })),
        h('p', { id: 'up-step', class: 'status wait', role: 'status' }, lib.step || 'Starting...'), h('div', { id: 'up-live' })) : null] : null,
    lib.msg ? h('p', { class: lib.ok ? 'status ok' : 'note', role: 'status' }, lib.msg) : null,
    u ? h('p', { class: 'small' + (full > 0.85 ? '' : ' mid') }, 'Library space: ' + HubMedia.mb(u.used) + ' of ' + HubMedia.mb(u.quota) + ' used' + (full > 0.85 ? '. Almost full. Delete old videos to make room.' : '.')) : null,
    list.length ? h('div', { class: 'libgrid' }, list.map(e => {
      const th = (state.media[e.id] || [])[0];
      return h('button', { type: 'button', class: 'libitem', onclick: () => { lib.armed = null; state.upView = e; renderVideo(); }, 'aria-label': 'Open ' + str(e.title, 60) + ', ' + fmtDate(e.date) },
        th ? h('img', { src: th, alt: '' }) : h('span', { class: 'libicon', 'aria-hidden': 'true' }, e.type === 'pdf' ? 'PDF' : e.type === 'video' ? '▶' : 'Photo'),
        e.type === 'video' ? h('span', { class: 'libplay', 'aria-hidden': 'true' }, '▶' + (e.dur ? ' ' + Math.floor(e.dur / 60) + ':' + pad(e.dur % 60) : '')) : null,
        h('span', { class: 'libcap' }, h('b', null, str(e.title, 40)), h('span', null, fmtDate(e.date))));
    })) : h('p', { class: 'mid' }, 'Nothing uploaded yet.'));
}
function renderUpView(box) {
  const e = state.upView, close = () => { state.upView = null; lib.armed = null; renderVideo(); };
  box.replaceChildren(h('div', { class: 'vid', role: 'dialog', 'aria-modal': 'true', 'aria-label': str(e.title, 60), onclick: ev => { if (ev.target.classList.contains('vid')) close(); } },
    h('div', { class: 'vbox' },
      h('div', { class: 'vhead' }, h('div', null, h('b', null, str(e.title, 60)), h('span', null, fmtDate(e.date) + (e.size ? ', ' + HubMedia.mb(e.size) : ''))),
        h('button', { type: 'button', class: 'btn', id: 'vid-close', onclick: close }, 'Close')),
      h('div', { class: 'upbody', id: 'up-body' }, h('p', null, 'Loading...')),
      h('div', { class: 'row' },
        e.type === 'video' ? h('button', { type: 'button', class: 'btn line', onclick: () => libRead(e) }, 'Read this swing') : null,
        locked() ? null : h('button', { type: 'button', class: 'btn ' + (lib.armed === e.id ? 'del' : 'line'), onclick: () => libDelete(e) }, lib.armed === e.id ? 'Tap again to delete' : 'Delete')))));
  const b = document.getElementById('vid-close'); if (b && !lib.armed) b.focus();
  HubMedia.link(familyKey, e.path).then(url => {
    const el = document.getElementById('up-body');
    if (!el || state.upView !== e) return;
    el.replaceChildren(e.type === 'video' ? h('video', { src: url, controls: '', playsinline: '', preload: 'metadata' })
      : e.type === 'photo' ? h('img', { src: url, alt: str(e.title, 60) })
      : h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Open the PDF'));
  }).catch(err => { const el = document.getElementById('up-body'); if (el && state.upView === e) el.replaceChildren(h('p', null, (err && err.msg) || 'Could not open it. Check the internet.')); });
}

function viewFilm() {
  const all = checks(), open = all.find(e => e.id === state.openCheck) || all[0], v = film.video, t = today();
  if (open) needMedia([open]);
  const uploader = h('section', { class: 'sec' }, h('h2', null, 'Add a swing'),
    h('label', { class: 'fld', for: 'film-file' }, h('span', null, 'Pick a video of one swing. A side view in good light works best.'),
      h('input', { id: 'film-file', type: 'file', accept: 'video/*', disabled: film.busy, onchange: e => loadFilm(e.target.files[0]) })),
    v ? [h('div', { class: 'stage' }, v),
      film.ready ? [
        h('button', { type: 'button', class: 'btn big', disabled: film.busy, onclick: guard(findSwing) }, film.busy ? 'Working...' : 'Find the swing for me'),
        h('label', { class: 'fld', for: 'scrub' }, h('span', null, 'Or slide to the moment the bat meets the ball. It works best with a second of video before that.'),
          h('input', { id: 'scrub', type: 'range', min: '0', max: String(v.duration || 0), step: '0.01', value: String(v.currentTime), disabled: film.busy, oninput: e => { v.currentTime = parseFloat(e.target.value); } })),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn line sm', disabled: film.busy, onclick: () => { v.currentTime = Math.max(0, v.currentTime - 1 / 30); } }, 'Back one frame'),
          h('button', { type: 'button', class: 'btn line sm', disabled: film.busy, onclick: () => { v.currentTime = Math.min(v.duration, v.currentTime + 1 / 30); } }, 'Forward one frame'),
          h('span', { id: 'scrub-t', class: 'num mid' }, v.currentTime.toFixed(2) + ' s')),
        h('div', { class: 'row' }, sel('k_tag', 'Where', [['practice', 'Practice'], ['game', 'Game']], 'practice'), sel('k_view', 'Camera angle', [['side', 'From the side'], ['front', 'From the pitcher side'], ['behind', 'From behind'], ['other', 'Other']], 'side'),
          sel('k_speed', 'Video speed', [['1', 'Normal'], ['4', 'Slow motion (4x)'], ['8', 'Slow motion (8x)']], '1'), inp('k_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('k_note', "Coach's note: one thing to work on (optional)", { type: 'text' }),
          sel('k_area', 'It points to', [['none', 'Nothing yet'], ['contact', 'Contact'], ['path', 'Swing path'], ['timing', 'Timing'], ['speed', 'Bat speed']], 'none')),
        h('button', { type: 'button', class: 'btn big', disabled: film.busy, onclick: guard(saveStrip) }, film.busy ? 'Saving...' : 'Save filmstrip'),
        h('p', { id: 'film-step', class: 'status wait', role: 'status' }, film.step)]
        : film.needTap ? h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => { film.msg = 'This video could not be opened here. Try a shorter clip.'; render(); }); } }, 'Tap to load the video'))
        : h('p', { class: 'mid' }, 'Loading the video...')] : null,
    film.msg ? h('p', { class: film.msg === 'Filmstrip saved.' ? 'status ok' : 'note' }, film.msg) : null,
    v && film.ready && (state.form.k_view || 'side') !== 'side' ? h('p', { class: 'small mid' }, 'The swing reader only grades side-view videos. Other angles save frames only.') : null);
  return page(strip('Film room', 'Freeze a swing into 8 frames, add a note, and compare it with other swings.'),
    open ? h('section', { class: 'sec plain' }, h('div', { class: 'row between' }, h('h2', null, (open === all[0] ? 'Latest swing' : 'Swing') + ', ' + fmtDate(open.date)),
        h('span', { class: 'status ' + (open.tag === 'game' ? 'wait' : 'ok') }, open.tag === 'game' ? 'Game swing' : 'Practice swing')), showCheck(open)) : null,
    uploader,
    viewLibrary(),
    compare(all),
    all.length ? h('section', { class: 'sec' }, h('h2', null, 'All swings'), all.map(e => h('div', { class: 'entry' },
      h('button', { type: 'button', class: 'hist', style: 'border:0;padding:0', onclick: () => { state.openCheck = e.id; render(); window.scrollTo(0, 0); } },
        h('span', null, h('span', { class: 'mid num' }, fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice') + ': '), str(e.fix && e.fix.title, 80) || 'No note')), locked() ? null : delBtn(e)))) : null,
    !open && !v ? h('p', { class: 'say' }, 'No swings saved yet. Film one swing from the side, then pick the video above.') : null);
}

/* ---------- Player: Trophies ---------- */
function bar(b) {
  const have = Math.min(b.have || 0, b.goal), pct = Math.round(have / b.goal * 100);
  return h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(b.goal), 'aria-valuenow': String(have), 'aria-label': b.name },
    h('div', { class: 'fill', style: 'width:' + pct + '%' }), h('span', { class: 'num' }, commas(have) + ' / ' + commas(b.goal)));
}
// The unearned badge he is closest to, so there is always a next thing to chase.
function nextBadge() {
  const open = L.badges(state.entries).filter(b => !b.on && b.goal);
  if (!open.length) return null;
  return open.sort((x, y) => (y.have || 0) / y.goal - (x.have || 0) / x.goal)[0];
}
const STICKERS = ['\u{1F525}', '⚾', '\u{1F3C6}', '\u{1F4AA}', '⭐', '\u{1F44F}'];
function gameLimit() { const v = state.settings.gameLimit; return v == null ? 5 : v; }
function challengeCard(p) {
  const t = p.t, c = L.challengeFor(t, p.arm.cleared), done = L.challengeDone(state.entries, t, c), ds = L.dayStreak(state.entries, t);
  return h('section', { class: 'sec chal' }, h('div', { class: 'row between' }, h('h2', null, 'Daily challenge'), h('span', { class: 'flame', 'aria-label': ds.n + ' days in a row' }, '\u{1F525} ' + ds.n + (ds.n === 1 ? ' day' : ' days'))),
    h('p', { class: 'say' }, c.text),
    done ? h('p', { class: 'status ok' }, 'Done! +' + L.XP.challenge + ' XP') :
      c.auto ? h('div', null, h('a', { class: 'btn', href: '#arcade' }, 'Play it in the Arcade'))
        : h('div', null, h('button', { type: 'button', class: 'btn', id: 'chal-done', onclick: guard(async () => {
          if (await addEntry({ kind: 'challenge', date: t, cid: c.id })) { HubGames.Sound.crack(); { const n = L.dayStreak(state.entries, t).n; toast('+' + L.XP.challenge + ' XP! \u{1F525} ' + n + (n === 1 ? ' day' : ' days') + ' in a row.'); } } render(); }) }, 'I did it!')),
    !ds.today && ds.n ? h('p', { class: 'small mid' }, 'Train or finish today’s challenge to keep your streak going.') : null);
}
function prizeCard() {
  const g = L.game(state.entries), pz = (state.settings.prizes || []).slice().sort((a, b) => a.level - b.level);
  const earned = pz.filter(z => g.level >= z.level && !z.given), next = pz.find(z => z.level > g.level);
  if (!earned.length && !next) return null;
  const need = next ? (next.level - 1) * L.XP.perLevel - g.xp : 0, total = next ? (next.level - 1) * L.XP.perLevel : 1;
  return h('section', { class: 'sec prizecard' }, h('h2', null, '\u{1F381} Prizes'),
    earned.map(z => h('p', { class: 'say' }, 'You earned: ', h('b', null, z.text), '! Show Dad.')),
    next ? [h('p', { class: 'say' }, h('b', null, next.text), ' at Level ' + next.level),
      h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(g.xp), 'aria-label': 'Progress to ' + next.text },
        h('div', { class: 'fill', style: 'width:' + Math.min(100, Math.round(g.xp / total * 100)) + '%' }), h('span', null, commas(need) + ' XP to go')),
      h('p', { class: 'small mid' }, (next.level - g.level) + (next.level - g.level === 1 ? ' level' : ' levels') + ' away. A full week of training is about 250 XP.')] : null);
}
function seasonCard(p) {
  const S = L.season(state.entries, p.t), g = S.games.find(x => x.monday === p.wk.monday);
  if (!g) return null;
  const team = state.settings.team || 'Seed Spitters';
  return h('section', { class: 'sec season' }, h('h2', null, (g.title ? '\u{1F3C6} Title game: ' : 'This week’s game: ') + team + ' vs ' + g.opp),
    g.status === 'W' ? h('p', { class: 'say' }, 'You won ' + g.us + '–' + g.them + '!') : h('p', { class: 'say' }, 'Finish Day 1 and Day 2 this week to win. Day 3 adds an extra run.'),
    h('p', { class: 'small mid' }, 'Season record: ' + S.mine.w + '–' + S.mine.l + '. ', h('a', { href: '#trophies' }, 'See the standings')));
}
function renderNote() {
  const box = document.getElementById('note'); if (!box) return;
  let seen = []; try { seen = JSON.parse(localStorage.getItem('dugout-seen-notes') || '[]'); } catch (e) {}
  const n = state.entries.filter(e => e.kind === 'note' && e.id && seen.indexOf(e.id) < 0).sort(L.byDate).pop();
  if (!n || state.video || state.upView) { box.replaceChildren(); return; }
  const ok = () => { seen.push(n.id); try { localStorage.setItem('dugout-seen-notes', JSON.stringify(seen.slice(-200))); } catch (e) {} box.replaceChildren(); renderNote(); };
  box.replaceChildren(h('div', { class: 'vid', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Message from Dad' },
    h('div', { class: 'vbox notebox' }, h('div', { class: 'stk big', 'aria-hidden': 'true' }, n.sticker || '⚾'), h('h2', null, 'Message from Dad'), h('p', { class: 'say' }, n.text),
      h('button', { type: 'button', class: 'btn big', id: 'note-ok', onclick: ok }, 'Thanks, Dad!'))));
  const b = document.getElementById('note-ok'); if (b) b.focus();
}
function mixCard() {
  const t = today(), p = plan(), goals = L.mixProgress(state.entries, t, p.pick.focus), ms = L.mixStreak(state.entries, t), done = state.entries.some(e => e.kind === 'mix' && e.date === t);
  const gameName = g => L.GAMES[g].name;
  return h('section', { class: 'sec mix' + (done ? ' done' : '') },
    h('h2', null, '\u{1F3AE} Today\u2019s Arcade Mix'),
    h('p', { class: 'small mid' }, done ? 'Done! +' + L.XP.mix + ' XP. Come back tomorrow to keep the streak.' : 'Finish all 3 today: +' + L.XP.mix + ' XP. Every 7 days in a row: +' + L.XP.mixWeek + ' bonus XP.'),
    h('ul', { class: 'mixlist' }, goals.map(m => h('li', { class: m.done ? 'ok' : '' }, h('span', { class: 'mk', 'aria-hidden': 'true' }, m.done ? '\u2713' : '\u25CB'),
      h('span', null, m.text, m.focus ? h('em', null, ' This week\u2019s focus: ' + L.FOCUS[p.pick.focus].name) : null),
      h('span', { class: 'sr' }, m.done ? ' (done)' : ' (not yet)')))),
    h('p', { class: 'say' }, h('b', null, ms.n ? '\u{1F525} ' + ms.n + (ms.n === 1 ? ' day' : ' days') + ' in a row' : 'Start a streak today'), ms.n && !ms.today ? ' \u00b7 finish today to keep it going' : ''));
}
function lockerSec() {
  const lvl = L.game(state.entries).level, mine = L.gearFor(state.settings, lvl);
  const pickIt = (k, id) => saveSettings(Object.assign({}, state.settings, { gear: Object.assign({}, state.settings.gear || {}, { [k]: id }) }));
  return h('section', { class: 'sec locker' }, h('h2', null, '\u{1F9E2} Locker'), h('p', { class: 'small mid' }, 'Gear you earn by leveling up. It shows up in the 3D games. You\u2019re Level ' + lvl + '.'),
    Object.keys(L.LOCKER).map(k => h('div', { class: 'lockrow' }, h('h3', null, L.LOCKER[k].name),
      h('div', { class: 'row', role: 'radiogroup', 'aria-label': L.LOCKER[k].name }, L.LOCKER[k].items.map(x => { const open = lvl >= x.level, on = mine[k].id === x.id;
        return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'gearpick' + (on ? ' on' : ''), disabled: !open, onclick: () => { if (!on) pickIt(k, x.id); } },
          x.c != null ? h('i', { class: 'sw', style: 'background:#' + x.c.toString(16).padStart(6, '0'), 'aria-hidden': 'true' }) : null, h('b', null, x.name), h('span', null, open ? (on ? 'Using' : 'Tap to use') : '\u{1F512} Level ' + x.level)); })))));
}
function viewArcade() {
  const t = today(), played = state.entries.filter(e => e.kind === 'arcade' && e.date === t).length, lim = gameLimit(), left = lim >= 99 ? Infinity : Math.max(0, lim - played);
  const gb = L.gameBests(state.entries).best, sOn = HubGames.Sound.on();
  const best = id => gb[id] ? 'Your best: ' + gb[id].score + L.GAMES[id].unit : 'No score yet';
  const can = lim !== 0 && left > 0;
  const levels = id => h('div', { class: 'row' }, [[1, 'Rookie'], [2, 'Pro'], [3, 'All-Star']].map(l => h('button', { type: 'button', class: 'btn' + (l[0] > 1 ? ' line' : ''), disabled: !can, onclick: () => startGame(id, l[0]) }, l[1])));
  const card = (id, icon, desc, play) => h('section', { class: 'sec game' }, h('div', { class: 'gicon', 'aria-hidden': 'true' }, icon), h('h2', null, L.GAMES[id].name), h('p', null, desc), h('p', { class: 'small mid' }, best(id)), play || levels(id));
  return page(strip('Arcade', lim === 0 ? 'The Arcade is closed. Ask Dad.' : left === Infinity ? 'Eight baseball games. You\u2019re #' + (state.settings.jersey || '20') + ' for the ' + (state.settings.team || 'Seed Spitters') + '.' : left + ' of ' + lim + ' games left today.'),
    !can && lim !== 0 ? h('p', { class: 'note' }, 'That\u2019s all the games for today. Go play catch, then come back tomorrow!') : null,
    lim !== 0 ? mixCard() : null,
    h('section', { class: 'sec game rtts' }, h('div', { class: 'rttsbadge', 'aria-hidden': 'true' }, 'NEW'), h('div', { class: 'gicon', 'aria-hidden': 'true' }, '\ud83c\udfc6'), h('h2', null, L.GAMES.dynasty.name),
      h('p', null, 'Create your own player and play full 7-inning games. You bat your own at-bats in 3D, the rest of the game plays out around you. Win games, climb the standings, make the playoffs, win the title, and upgrade your player with skill points.'),
      h('p', { class: 'small mid' }, (() => { const dd = dynLoad(); return dd && dd.player ? 'Season ' + dd.season + ' · #' + dd.player.num + ' ' + dd.player.first + (gb.dynasty ? ' · best OVR ' + gb.dynasty.score : '') : 'Start your career'; })()),
      h('div', { class: 'row' }, [[1, 'Play']].map(l => h('button', { type: 'button', class: 'btn', disabled: !can, onclick: () => startGame('dynasty', 1) }, (() => { const dd = dynLoad(); return dd && dd.player ? 'Continue career' : 'Create my player'; })())))),
    h('div', { class: 'two even' },
      card('derby', '\u26be', 'Swing at fastballs, changeups and curves. Time it to pull it, tap high or low to match the pitch. 10 outs. Fireworks on every home run.'),
      card('kking', '\ud83d\udd25', 'You\u2019re on the mound. Pick the pitch, aim for the corners, nail the timing ring. Fool hitters with a changeup. Count your strikeouts.'),
      card('steal', '\ud83d\udca8', 'Take your lead off first, read the pitcher, and go on his first move home. Go too early or lead too far and you\u2019re picked off.'),
      card('streak', '\ud83c\udf4c', 'How many hits can you get before 3 outs? Every base hit rains bananas. Every home run sets off fireworks. 3 strikes is an out.'),
      card('pitchrec', '\ud83d\udc40', 'Stand in the box and call the pitch before it gets to you: fastball, changeup or curve. Big leaguers know it by halfway. Trains your eyes for real at-bats.'),
      card('outfield', '\ud83e\udde4', 'Run down fly balls in center field, dive for the close ones, then make the smart throw with runners on base.'),
      card('brain', '\ud83e\udde0', 'Every question is an at-bat. Easy = single, medium = double, hard = home run. Score runs before you make 3 outs.',
        h('div', null, h('button', { type: 'button', class: 'btn', disabled: !can, onclick: () => startGame('brain', 1) }, 'Play')))),
    lockerSec(),
    h('section', { class: 'sec' }, h('h2', null, 'Sounds'), h('p', null, 'Bat cracks, crowd cheers, the organ and the umpire. The iPad\u2019s silent switch turns them off too.'),
      h('div', null, h('button', { type: 'button', class: 'btn line', 'aria-pressed': String(sOn), onclick: () => { HubGames.Sound.set(!sOn); if (!sOn) HubGames.Sound.crack(); render(); } }, sOn ? 'Sounds are on. Turn off' : 'Sounds are off. Turn on'))),
    h('p', { class: 'small mid' }, 'Every game you finish: +' + L.XP.gamePlay + ' XP. New best score: +' + L.XP.gameBest + ' XP. A training day is worth up to 100 XP.'));
}
// Road to the Show saves his career in the hub's settings (and on this iPad, as a backup), and logs each finished game as an Arcade game.
const DYN_KEY = 'dh_dynasty';
function dynLoad() { let a = state.settings.dynasty || null, b = null; try { b = JSON.parse(localStorage.getItem(DYN_KEY) || 'null'); } catch (e) {}
  if (a && b) return (b.saved || 0) > (a.saved || 0) ? b : a; return a || b; }
let dynSaving = null;
function dynSave(d) { const v = d ? Object.assign(JSON.parse(JSON.stringify(d)), { saved: Date.now() }) : null;
  try { if (v) localStorage.setItem(DYN_KEY, JSON.stringify(v)); else localStorage.removeItem(DYN_KEY); } catch (e) {}
  state.settings = Object.assign({}, state.settings, { dynasty: v });
  clearTimeout(dynSaving); dynSaving = setTimeout(() => { api('settings', { data: state.settings }).catch(() => {}); }, 1200); }
function dynRecord(score) { addEntry({ kind: 'arcade', date: today(), game: 'dynasty', score }).then(() => render()).catch(() => {}); }
function startGame(id, level) {
  HubGames.play(id, { level, loadDyn: dynLoad, saveDyn: dynSave, record: dynRecord, me: { name: who(), num: state.settings.jersey || '20', bats: state.settings.bats || 'left', gear: L.gearFor(state.settings, L.game(state.entries).level) } }, async (score, again) => {
    if (score == null) { render(); return; }
    const t = today(), g0 = L.game(state.entries), had = L.gameBests(state.entries).best[id], c = L.challengeFor(t, plan().arm.cleared), chalBefore = L.challengeDone(state.entries, t, c);
    if (!(await addEntry(Object.assign({ kind: 'arcade', date: t, game: id, score }, id !== 'brain' ? { level } : {})))) { render(); return; }
    const isBest = had && (L.GAMES[id].lower ? score < had.score : score > had.score);
    const msgs = [];
    if (isBest) { msgs.push('New best! +' + L.XP.gameBest + ' XP'); HubGames.Sound.cheer(); }
    if (!chalBefore && L.challengeDone(state.entries, t, c)) { if (await addEntry({ kind: 'challenge', date: t, cid: c.id })) msgs.push('Daily challenge done! +' + L.XP.challenge + ' XP'); }
    if (!state.entries.some(e => e.kind === 'mix' && e.date === t) && L.mixProgress(state.entries, t, plan().pick.focus).every(m => m.done)) {
      if (await addEntry({ kind: 'mix', date: t })) { const ms = L.mixStreak(state.entries, t).n; msgs.push('Arcade Mix done! +' + L.XP.mix + ' XP \u{1F525} ' + ms + (ms === 1 ? ' day' : ' days') + ' in a row' + (ms % 7 === 0 ? ' \u00b7 7-day bonus +' + L.XP.mixWeek + ' XP!' : '')); HubGames.Sound.cheer(); } }
    const g = L.game(state.entries); if (g.xp > g0.xp) msgs.push('+' + (g.xp - g0.xp) + ' XP total');
    if (g.level > g0.level) msgs.push('Level up! Level ' + g.level);
    toast(msgs.length ? msgs.join(' · ') : 'Score saved.'); render();
    const lim = gameLimit(), playedNow = state.entries.filter(e => e.kind === 'arcade' && e.date === t).length;
    if (again) { if (lim >= 99 || playedNow < lim) startGame(id, level); else toast('That\u2019s all the games for today. Go play catch!'); }
  });
}
function playerCard() {
  const g = L.game(state.entries), tier = L.tierFor(g.level), rec = L.records(state.entries), t = L.totals(state.entries), num = state.settings.jersey || '';
  const name = who(), init = name.slice(0, 1).toUpperCase();
  const back = [['Top bat speed', rec.bat && fix(rec.bat.v) + ' mph'], ['Top exit speed', rec.exit && fix(rec.exit.v) + ' mph'], ['Fastest pitch', rec.velo && fix(rec.velo.v) + ' mph'],
    ['Longest jump', rec.jump && fix(rec.jump.v, 0) + ' in'], ['Swings logged', commas(t.swings)], ['Sessions', commas(t.sessions)]];
  return h('button', { type: 'button', class: 'pcard tier-' + tier.toLowerCase().replace(/[^a-z]/g, '') + (state.cardBack ? ' back' : ''), 'aria-pressed': String(!!state.cardBack), 'aria-label': 'Player card. Tap to flip.', onclick: () => { state.cardBack = !state.cardBack; render(); } },
    h('div', { class: 'face front' }, h('div', { class: 'tier' }, tier + ' card'), h('div', { class: 'num' }, num ? '#' + num : init), h('div', { class: 'pname' }, name), h('div', { class: 'ptitle' }, 'Level ' + g.level + ' ' + g.title),
      h('div', { class: 'pmeta' }, (state.settings.bats === 'right' ? 'Bats right' : 'Bats left') + ' · ' + (state.settings.team || 'Seed Spitters'))),
    h('div', { class: 'face rear' }, h('div', { class: 'tier' }, 'Stats'), h('table', null, h('tbody', null, back.map(r => h('tr', null, h('td', null, r[0]), h('td', { class: 'v' }, r[1] || '—'))))), h('div', { class: 'small' }, 'Tap to flip back')));
}
function viewTrophies() {
  const B = L.badges(state.entries), rec = L.records(state.entries), t = L.totals(state.entries);
  const recs = [['Top bat speed', rec.bat, r => fix(r.v) + ' mph'], ['Top exit speed', rec.exit, r => fix(r.v) + ' mph'], ['Best machine round', rec.contact, r => r.made + ' of ' + r.of],
    ['Longest jump', rec.jump, r => fix(r.v, 0) + ' in'], ['Most push-ups in a test', rec.pushups, r => fix(r.v, 0)], ['Longest plank', rec.plank, r => fix(r.v, 0) + ' sec'], ['Fastest pitch', rec.velo, r => fix(r.v) + ' mph']];
  const g = L.game(state.entries), S = L.season(state.entries, today()), gb = L.gameBests(state.entries).best, team = state.settings.team || 'Seed Spitters';
  return page(strip('Trophies', B.filter(b => b.on).length + ' of ' + B.length + ' badges earned'),
    h('div', { class: 'two even' },
      h('section', { class: 'sec plain cardwrap' }, playerCard(), h('p', { class: 'small mid' }, 'Your card upgrades at Level 3 (Silver), 5 (Gold) and 7 (All-Star).')),
      h('section', { class: 'sec' }, h('h2', null, 'Themes'), h('div', { class: 'themes', role: 'radiogroup', 'aria-label': 'App theme' }, L.THEMES.map(x => {
        const open = g.level >= x.level, on = (state.settings.theme || 'classic') === x.id;
        return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'theme-pick t-' + x.id, disabled: !open, onclick: () => { if (!on) saveSettings(Object.assign({}, state.settings, { theme: x.id })); } }, h('b', null, x.name), h('span', null, open ? (on ? 'In use' : 'Tap to use') : '\u{1F512} Level ' + x.level)); })))),
    h('section', { class: 'sec' }, h('h2', null, 'Season: ' + new Date(S.month + '-15T12:00:00').toLocaleString('en-US', { month: 'long' }) + ' \u00b7 ' + team + ' ' + S.mine.w + '\u2013' + S.mine.l),
      h('div', { class: 'two even' },
        h('table', null, h('caption', null, 'Schedule'), h('tbody', null, S.games.map(x => h('tr', null, h('td', null, (x.title ? '\u{1F3C6} ' : '') + 'Week of ' + fmtDate(x.monday) + ' vs ' + x.opp),
          h('td', { class: 'v' }, x.status === 'W' ? 'W ' + x.us + '\u2013' + x.them : x.status === 'L' ? 'L ' + x.us + '\u2013' + x.them : x.status === 'live' ? 'This week' : x.status === 'pre' ? 'Before you started' : 'Coming up'))))),
        h('table', null, h('caption', null, 'Standings'), h('tbody', null, S.standings.map(r => h('tr', { class: r.me ? 'me' : null }, h('td', null, r.me ? team : r.name), h('td', { class: 'v' }, r.w + '\u2013' + r.l)))))),
      h('p', { class: 'small mid' }, 'Each week is a game: finish Day 1 and Day 2 to win. The last week of the month is the title game. Win it for the Champions badge.')),
    h('section', { class: 'sec' }, h('h2', null, 'Arcade bests'), h('table', null, h('tbody', null, Object.keys(L.GAMES).filter(k => !L.GAMES[k].retired || gb[k]).map(k => h('tr', null, h('td', null, L.GAMES[k].name), h('td', { class: 'v' }, gb[k] ? gb[k].score + L.GAMES[k].unit : '\u2014')))))),
    h('section', { class: 'sec plain' }, h('div', { class: 'patches' }, B.map(b => h('div', { class: 'patch' + (b.on ? ' on' : '') }, h('div', { class: 'ring' }, icon(b.icon)), h('b', null, b.name), h('span', null, b.on ? 'Earned' : b.how), !b.on && b.goal ? bar(b) : null)))),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Your records'), h('table', null, h('tbody', null, recs.map(r => h('tr', null, h('td', null, r[0], r[1] ? h('div', { class: 'math' }, fmtDate(r[1].date)) : null), h('td', { class: 'v' }, r[1] ? r[2](r[1]) : '–'))))),
        h('p', { class: 'small mid' }, 'Beat a record and you earn ' + L.XP.record + ' XP. Beat the weekly Boss and you earn ' + L.XP.boss + ' XP.')),
      h('section', { class: 'sec' }, h('h2', null, 'All-time totals'), h('table', null, h('tbody', null,
        [['Swings', t.swings], ['Push-ups', t.pushups], ['Sit-ups', t.situps], ['Squats', t.squats], ['Sessions finished', t.sessions]].map(x => h('tr', null, h('td', null, x[0]), h('td', { class: 'v' }, commas(x[1])))))))));
}

/* ---------- Coach: Log ---------- */
async function saveQuick() {
  const t = state.form.q_date || today(), saved = [];
  let tried = 0;   // a failed save already showed its own message, so it must not be replaced by "nothing to save"
  const reps = { swings: num('q_swings'), pushups: num('q_push'), situps: num('q_sit'), squats: num('q_squat') };
  if (num('q_made') != null && !num('q_of')) return toast('Enter how many pitches he saw on the machine.');
  if (num('q_made') != null && num('q_made') > num('q_of')) return toast('Solid hits cannot be more than pitches.');
  if (Object.keys(reps).some(k => reps[k] != null)) { tried++; if (await addEntry(Object.assign({ kind: 'reps', date: t }, reps))) { saved.push('reps'); clear('q_swings', 'q_push', 'q_sit', 'q_squat'); } }
  if (num('q_bat') != null || num('q_exit') != null) { tried++; if (await addEntry({ kind: 'swing', date: t, ball: state.form.q_ball || 'real', batSpeed: num('q_bat'), batMax: num('q_batmax'), exitVelo: num('q_exit'), exitMax: num('q_exitmax') })) { saved.push('speeds'); clear('q_bat', 'q_batmax', 'q_exit', 'q_exitmax'); } }
  if (num('q_made') != null) { tried++; if (await addEntry({ kind: 'machine', date: t, made: num('q_made'), of: num('q_of') })) { saved.push('machine count'); clear('q_made', 'q_of'); } }
  if (!tried) toast('Nothing to save yet. Fill in at least one box.');
  else if (saved.length === tried) toast('Saved: ' + saved.join(', ') + '.');
  else if (saved.length) toast('Saved: ' + saved.join(', ') + '. The rest did not save, so it is still filled in. Try again.');
  render();
}
/* ---------- GameChanger import (Stats > Export Stats needs a staff account on the team) ---------- */
const gc = { res: null, pick: null, name: '' };
function gcLast() { return state.entries.filter(e => e.kind === 'gcsnap').sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null; }
function gcSection(t) {
  const r = gc.res, who = r && r.ok ? (r.player || (gc.pick != null ? r.people[gc.pick] : null)) : null, last = gcLast();
  const line = p => [p.bat.pa != null ? p.bat.pa + ' PA' : null, p.bat.ab != null ? p.bat.ab + ' AB' : null, p.bat.h != null ? p.bat.h + ' H' : null, p.bat.k != null ? p.bat.k + ' SO' : null, p.bat.bb != null ? p.bat.bb + ' BB' : null].filter(Boolean).join(', ') || 'no batting';
  const pline = p => p.pit.pitches || p.pit.ip ? (p.pit.ip != null ? L.fmtInnings(p.pit.ip) + ' innings' : '') + (p.pit.pitches != null ? ', ' + p.pit.pitches + ' pitches' : '') : 'did not pitch';
  let body = null;
  if (r && !r.ok) body = h('p', { class: 'note' }, r.why);
  else if (r && !who) body = [h('p', null, 'Which one is ' + state.settings.player + '?'), h('div', { class: 'row' }, r.people.map((p, i) => h('button', { type: 'button', class: 'btn line sm', onclick: () => { gc.pick = i; render(); } }, p.label)))];
  else if (who) {
    const d = last ? L.gcDelta(last, who) : null;
    body = [h('p', null, h('b', null, who.label + ': '), line(who), '. Pitching: ', pline(who), '.'),
      d && d.down ? h('p', { class: 'note' }, 'Some totals are lower than the last import, so this looks like a different filter or season. Use "One game" or check the filter in GameChanger.') : null,
      h('div', { class: 'row' }, inp('gc_date', 'Game date', { type: 'date', def: t })),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: guard(() => gcSave('game', who, null)) }, 'One game: log all of it'),
        last && d && d.any && !d.down ? h('button', { type: 'button', class: 'btn line', onclick: guard(() => gcSave('delta', who, d.delta)) }, 'Season totals: log only what is new') : null,
        h('button', { type: 'button', class: 'btn line', onclick: guard(() => gcSave('base', who, null)) }, last ? 'Just update the totals' : 'Season totals: save as a starting point')),
      last && d && !d.any ? h('p', { class: 'mid small' }, 'Nothing new since the last import (' + fmtDate(last.date) + ').') : null,
      h('p', { class: 'small mid' }, 'One game: filter to that game in GameChanger before exporting. If he pitched in more than one game since the last import, log those games one at a time so his rest days are exact.')];
  }
  return h('section', { class: 'sec' }, h('h2', null, 'Import from GameChanger'),
    h('label', { class: 'fld', for: 'gc-file' }, h('span', null, 'GameChanger, team Stats, Export Stats. Staff accounts only. Then pick the file here.'),
      h('input', { id: 'gc-file', type: 'file', accept: '.csv,text/csv,text/plain', onchange: e => gcRead(e.target.files[0]) })),
    body);
}
function gcRead(f) {
  if (!f) return; if (f.size > 2e6) { gc.res = { ok: false, why: 'That file is too big to be a stats export.' }; return render(); }
  const rd = new FileReader();
  rd.onload = () => { gc.res = L.parseGC(String(rd.result || ''), state.settings.player); gc.pick = null; gc.name = f.name; render(); };
  rd.onerror = () => { gc.res = { ok: false, why: 'That file could not be read.' }; render(); };
  rd.readAsText(f);
}
async function gcSave(mode, who, delta) {
  const date = state.form.gc_date || today();
  if (date > today()) return toast('That date is in the future. Pick today or an earlier day.');
  const src = mode === 'delta' ? delta : mode === 'game' ? { bat: who.bat, pit: who.pit } : null, saved = [];
  if (mode === 'game') {   // the same game imported twice would double his numbers
    const b = who.bat, same = state.entries.some(e => e.kind === 'game' && e.from === 'gamechanger' && e.date === date && e.ab === (b.ab || 0) && e.h === (b.h || 0) && e.k === (b.k || 0) && e.bb === (b.bb || 0));
    if (same) return toast('That game is already logged for ' + fmtDate(date) + '. Nothing was added.');
  }
  if (src) {
    const b = src.bat, ab = b.ab || 0;
    if (ab || b.pa || b.bb) {
      if ((b.h || 0) + (b.k || 0) > ab) return toast('This file has more hits plus strikeouts than at-bats, so it was not saved. Check the file.');
      const gl = { kind: 'game', date, ab, h: b.h || 0, k: b.k || 0, bb: b.bb || 0, from: 'gamechanger' }; if (b.kl != null) gl.kl = Math.min(b.kl, gl.k);
      if (await addEntry(gl)) saved.push('game line'); else return render();
    }
    if (src.pit.pitches > 0 || src.pit.ip > 0) {
      if (!(src.pit.pitches > 0)) return toast('The file has innings but no pitch count, so pitching was not saved. Log the outing on the Arm screen.');
      if (await addEntry(Object.assign({ kind: 'pitch', date, pitches: src.pit.pitches, outs: src.pit.ip || 0, where: 'game', from: 'gamechanger' }, pitchDetail(src.pit)))) saved.push('pitching'); else return render();
    }
  }
  // Only season totals become the starting point for "what is new"; a one-game file must not replace them.
  if (mode !== 'game' && await addEntry({ kind: 'gcsnap', date, file: str(gc.name, 80), bat: who.bat, pit: who.pit })) saved.push('season totals');
  if (saved.length) { toast('Saved from GameChanger: ' + saved.join(', ') + '.'); gc.res = null; gc.pick = null; const el = document.getElementById('gc-file'); if (el) el.value = ''; }
  render();
}
function viewLog() {
  const t = today(), recent = state.entries.slice().sort(L.byDate).reverse().slice(0, 25);
  const part = (v, w) => v ? v + ' ' + w : null;
  const label = e => e.kind === 'swing' ? 'Speeds: bat ' + fix(e.batSpeed) + ', exit ' + fix(e.exitVelo) + ' mph' + (e.ball === 'mini' ? ' (mini balls)' : '') :
    e.kind === 'reps' ? (e.from ? 'Reps from ' + (({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[e.slot] || 'a session') + ': ' : 'Extra reps: ') + ([part(e.swings, 'swings'), part(e.pushups, 'push-ups'), part(e.situps, 'sit-ups'), part(e.squats, 'squats')].filter(Boolean).join(', ') || 'none') :
    e.kind === 'machine' ? 'Machine' + (e.from ? ' (in session)' : '') + ': ' + e.made + ' of ' + e.of + ' solid' : e.kind === 'game' ? 'Game: ' + e.h + ' for ' + e.ab + ', ' + e.k + ' K' + (L.isNum(e.kl) ? ' (' + e.kl + ' looking)' : '') + ', ' + e.bb + ' BB' + (L.isNum(e.go) || L.isNum(e.fo) ? ', ' + (e.go || 0) + ' ground outs, ' + (e.fo || 0) + ' fly outs' : '') :
    e.kind === 'pitch' ? (e.where === 'practice' ? 'Practice pitches: ' : 'Pitched: ') + e.pitches + ' pitches, ' + L.fmtInnings(e.outs || 0) + ' innings' + [['strikes', ' strikes'], ['k', ' K'], ['bb', ' BB'], ['h', ' H']].filter(x => L.isNum(e[x[0]])).map(x => ', ' + e[x[0]] + x[1]).join('') : e.kind === 'strength' ? 'Test: jump ' + fix(e.jump, 0) + ' in, ' + fix(e.pushups, 0) + ' push-ups, plank ' + fix(e.plank, 0) + ' sec' :
    e.kind === 'session' ? (({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[e.slot] || 'Session') + ' (' + ((L.FOCUS[e.focus] || {}).name || e.focus) + ')' + (e.points != null ? ', ' + e.points + ' points' : '') + (e.boss ? (e.boss.won ? ', beat the Boss' : ', lost to the Boss') : '') : e.kind === 'analysis' ? 'Filmstrip: ' + (str(e.fix && e.fix.title, 60) || 'no note') :
    e.kind === 'velo' ? 'Pitch speed' + (e.where === 'game' ? ' (game)' : '') + ': ' + [L.isNum(e.avg) ? 'average ' + fix(e.avg) : null, L.isNum(e.max) ? 'fastest ' + fix(e.max) : null].filter(Boolean).join(', ') + ' mph' :
    e.kind === 'review' ? 'Swing reader call marked ' + (e.agree ? 'right' : 'wrong') :
    e.kind === 'arcade' ? 'Arcade: ' + ((L.GAMES[e.game] || {}).name || e.game) + ', ' + e.score + ((L.GAMES[e.game] || {}).unit || '') :
    e.kind === 'challenge' ? 'Daily challenge done' : e.kind === 'mix' ? 'Arcade Mix done' :
    e.kind === 'upload' ? 'Uploaded ' + (e.type || 'file') + ': ' + str(e.title, 60) :
    e.kind === 'note' ? 'Message to ' + who() + ': ' + (e.sticker ? e.sticker + ' ' : '') + e.text :
    e.kind === 'gcsnap' ? 'GameChanger totals imported' + (e.file ? ' (' + e.file + ')' : '') :
    e.kind === 'body' ? 'Measured: ' + [L.isNum(e.heightIn) ? L.fmtHeight(e.heightIn) : null, L.isNum(e.weightLb) ? (Math.round(e.weightLb * 10) / 10) + ' lb' : null].filter(Boolean).join(', ') : e.kind;
  return page(strip('Log ' + who() + "'s work", 'Finished sessions log their own reps. Use this for extra work, speeds and games.'),
    h('section', { class: 'sec plain' }, h('div', { class: 'row between' }, h('h2', null, 'Today'), h('div', { style: 'flex:0 1 200px' }, inp('q_date', 'Date', { type: 'date', def: t }))),
      h('h3', null, 'Extra reps (outside sessions)'),
      h('div', { class: 'row' }, inp('q_swings', 'Swings', { mode: 'numeric' }), inp('q_push', 'Push-ups', { mode: 'numeric' }), inp('q_sit', 'Sit-ups', { mode: 'numeric' }), inp('q_squat', 'Squats', { mode: 'numeric' })),
      h('h3', null, 'Swing speeds'),
      h('div', { class: 'row' }, inp('q_bat', 'Bat speed avg (mph)'), inp('q_batmax', 'Bat speed best'), inp('q_exit', 'Exit speed avg (mph)'), inp('q_exitmax', 'Exit speed best'), sel('q_ball', 'Balls used', [['real', 'Real baseballs'], ['mini', 'Mini balls']], 'real')),
      h('h3', null, 'Pitching machine'),
      h('div', { class: 'row' }, inp('q_made', 'Solid hits', { mode: 'numeric' }), inp('q_of', 'Pitches', { mode: 'numeric' })),
      h('p', { class: 'small mid' }, 'Only for machine work outside a session. Hits he types into a session are already counted.'),
      h('div', null, h('button', { type: 'button', class: 'btn', id: 'quick-save', onclick: guard(saveQuick) }, 'Save'))),
    h('section', { class: 'sec' }, h('h2', null, 'Send ' + who() + ' a message'),
      h('p', { class: 'small mid' }, 'It pops up the next time he opens the Player side.'),
      h('label', { class: 'fld', for: 'f-n_text' }, h('span', null, 'Message (up to 140 letters)'), h('textarea', { id: 'f-n_text', maxlength: '140', rows: '2', oninput: e => { state.form.n_text = e.target.value; } }, state.form.n_text || '')),
      h('div', { class: 'stickers', role: 'radiogroup', 'aria-label': 'Sticker' }, STICKERS.map(x => h('button', { type: 'button', role: 'radio', 'aria-checked': String((state.form.n_st || STICKERS[0]) === x), class: 'stk', onclick: () => { state.form.n_st = x; render(); } }, x))),
      h('div', null, h('button', { type: 'button', class: 'btn', id: 'note-send', onclick: guard(async () => {
        const text = (state.form.n_text || '').trim(); if (!text) return toast('Type a message first.');
        if (await addEntry({ kind: 'note', date: today(), text: text.slice(0, 140), sticker: state.form.n_st || STICKERS[0] })) { state.form.n_text = ''; toast('Sent. He will see it next time he opens the hub.'); } render(); }) }, 'Send message'))),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Swing video'), h('p', null, 'Upload videos, photos and PDFs, and save swing filmstrips, in the film room on the Player side.'), h('p', null, h('a', { href: '#film' }, 'Open the film room'))),
      h('section', { class: 'sec' }, h('h2', null, 'Game line'),
        h('div', { class: 'row' }, inp('g_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('g_ab', 'At-bats', { mode: 'numeric' }), inp('g_h', 'Hits', { mode: 'numeric' }), inp('g_k', 'Strikeouts', { mode: 'numeric' }), inp('g_bb', 'Walks', { mode: 'numeric' })),
        h('p', { class: 'small mid' }, 'Optional, from GameChanger play-by-play. These aim the fix-it drills.'),
        h('div', { class: 'row' }, inp('g_kl', 'Struck out looking', { mode: 'numeric' }), inp('g_go', 'Ground-ball outs', { mode: 'numeric' }), inp('g_fo', 'Fly or pop outs', { mode: 'numeric' })),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('g_ab') == null) return toast('Enter at-bats first.');
          if ((num('g_h') || 0) + (num('g_k') || 0) > num('g_ab')) return toast('Hits plus strikeouts cannot be more than at-bats.');
          if (num('g_kl') != null && num('g_kl') > (num('g_k') || 0)) return toast('Struck out looking cannot be more than strikeouts.');
          if ((num('g_go') || 0) + (num('g_fo') || 0) > num('g_ab') - (num('g_h') || 0) - (num('g_k') || 0)) return toast('Ground and fly outs cannot be more than at-bats minus hits and strikeouts.');
          const gl = { kind: 'game', date: state.form.g_date || t, ab: num('g_ab'), h: num('g_h') || 0, k: num('g_k') || 0, bb: num('g_bb') || 0 };
          if (num('g_kl') != null) gl.kl = num('g_kl'); if (num('g_go') != null || num('g_fo') != null) { gl.go = num('g_go') || 0; gl.fo = num('g_fo') || 0; }
          if (await addEntry(gl)) { clear('g_ab', 'g_h', 'g_k', 'g_bb', 'g_kl', 'g_go', 'g_fo'); toast('Game line saved.'); } render(); }) }, 'Save game line'))),
      gcSection(t),
      h('section', { class: 'sec' }, h('h2', null, 'Strength test'),
        h('div', { class: 'row' }, inp('t_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('t_jump', 'Long jump (inches)'), inp('t_push', 'Push-ups', { mode: 'numeric' }), inp('t_plank', 'Plank (seconds)', { mode: 'numeric' })),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('t_jump') == null && num('t_push') == null && num('t_plank') == null) return toast('Enter at least one test result.');
          if (await addEntry({ kind: 'strength', date: state.form.t_date || t, jump: num('t_jump'), pushups: num('t_push'), plank: num('t_plank') })) { clear('t_jump', 't_push', 't_plank'); toast('Test saved.'); } render(); }) }, 'Save test')),
        h('p', { class: 'small mid' }, 'Every 4 weeks. These are max-effort tests, separate from daily reps.')),
      h('section', { class: 'sec' }, h('h2', null, 'Height and weight'),
        h('div', { class: 'row' }, inp('b_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('b_ft', 'Height, feet', { mode: 'numeric' }), inp('b_in', 'and inches'), inp('b_lb', 'Weight (lb)')),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          const ft = num('b_ft'), inch = num('b_in'), lb = num('b_lb');
          const hIn = ft == null && inch == null ? null : (ft || 0) * 12 + (inch || 0);
          if (hIn == null && lb == null) return toast('Enter his height, weight, or both.');
          if (inch != null && inch >= 12) return toast('Inches should be under 12. Put whole feet in the feet box.');
          if (hIn != null && (hIn < 30 || hIn > 84)) return toast('That height looks off. Check feet and inches.');
          if (lb != null && (lb < 20 || lb > 300)) return toast('That weight looks off. Check it is in pounds.');
          if (await addEntry({ kind: 'body', date: state.form.b_date || t, heightIn: hIn, weightLb: lb })) { clear('b_ft', 'b_in', 'b_lb'); toast('Saved.'); } render(); }) }, 'Save height and weight')),
        h('p', { class: 'small mid' }, 'Once a month is plenty: same scale, shoes off, morning. Growth shows on the Progress screen.'))),
    h('section', { class: 'sec' }, h('h2', null, 'Recent entries'),
      recent.length ? recent.map(e => h('div', { class: 'entry' }, h('span', null, h('span', { class: 'mid num' }, fmtDate(e.date) + ': '), label(e)), delBtn(e))) : h('p', { class: 'mid' }, 'Nothing logged yet.')));
}
function delBtn(e) {
  const armed = state.confirmDel === e.id;
  return h('button', { type: 'button', class: 'btn sm ' + (armed ? 'del' : 'line'), onclick: async () => {
    if (!armed) { state.confirmDel = e.id; render(); return; }
    state.confirmDel = null;
    if (e.kind === 'session' && e.ts != null) for (const x of state.entries.filter(x => x.from === e.ts && x.id !== e.id)) await delEntry(x.id);
    await delEntry(e.id); render(); } }, armed ? 'Tap again to delete' : 'Delete');
}

/* ---------- Coach: Arm ---------- */
// Only the game numbers that were filled in are stored.
function pitchDetail(d) { const o = {}; for (const k of ['strikes', 'bf', 'fps', 'k', 'bb', 'h', 'hbp']) if (L.isNum(d[k])) o[k] = d[k]; return o; }
function pitchCheck(d) {
  for (const k of ['pitches', 'strikes', 'bf', 'fps', 'k', 'bb', 'h', 'hbp']) if (d[k] != null && (d[k] < 0 || d[k] !== Math.round(d[k]))) return 'Use whole numbers of 0 or more.';
  if (d.strikes != null && d.strikes > d.pitches) return 'Strikes cannot be more than pitches.';
  if (d.fps != null && d.bf == null) return 'Enter batters faced to go with first-pitch strikes.';
  if (d.fps != null && d.fps > d.bf) return 'First-pitch strikes cannot be more than batters faced.';
  if (d.bf != null && d.bf > d.pitches) return 'Batters faced cannot be more than pitches.';
  if (d.bf != null && (d.k || 0) + (d.bb || 0) + (d.h || 0) + (d.hbp || 0) > d.bf) return 'Strikeouts + walks + hits + hit batters cannot be more than batters faced.';
  return null;
}
// Pitching summary over the last 4 weeks of game outings that have stats.
function pitchSummary(t) {
  const g = state.entries.filter(e => e.kind === 'pitch' && e.where !== 'practice' && e.date > L.addDays(t, -28) && e.date <= t);
  const sumOf = (list, k) => list.reduce((a, e) => a + (e[k] || 0), 0), w = k => g.filter(e => L.isNum(e[k]));
  const rows = [];
  const s = w('strikes'); if (s.length) { const P = sumOf(s, 'pitches'), S = sumOf(s, 'strikes'); rows.push(['Strike rate', Math.round(S / P * 100) + '%', S + ' strikes ÷ ' + P + ' pitches']); }
  const f = w('fps').filter(e => L.isNum(e.bf)); if (f.length) { const B = sumOf(f, 'bf'), F = sumOf(f, 'fps'); rows.push(['First-pitch strikes', Math.round(F / B * 100) + '%', F + ' ÷ ' + B + ' batters']); }
  const b = w('bf'); if (b.length) { const B = sumOf(b, 'bf'), P = sumOf(b, 'pitches'); rows.push(['Pitches per batter', (P / B).toFixed(1), P + ' pitches ÷ ' + B + ' batters']); }
  for (const [k, name] of [['k', 'Strikeouts'], ['bb', 'Walks'], ['h', 'Hits']]) { const x = w(k), O = sumOf(x, 'outs'); if (x.length && O > 0) rows.push([name + ' per inning', (sumOf(x, k) / (O / 3)).toFixed(1), sumOf(x, k) + ' ÷ ' + L.fmtInnings(O) + ' innings']); }
  return rows;
}
function viewArm() {
  const t = today(), a = L.armStatus(state.entries, t, state.settings.dailyMax), yr = a.outs12 / 240;
  const rows = [['1–20', 0], ['21–35', 1], ['36–50', 2], ['51–65', 3], ['66+', 4]];
  return page(strip(a.cleared ? 'Cleared to pitch' : 'Rest day', a.driver ? (a.driver.pitches + ' pitches on ' + fmtDate(a.driver.date) + ' needs ' + a.driver.rest + ' rest day' + (a.driver.rest === 1 ? '' : 's') + ', so he is cleared from ' + fmtDate(a.clearedOn) + '.') +
      (a.threeDay ? ' He also pitched the last two days, and three days in a row is not allowed.' : '') : 'No outings logged yet.'),
    h('section', { class: 'sec plain' }, h('div', { class: 'facts' },
        h('div', null, h('b', { class: 'bigv' }, a.last ? a.last.pitches : '–'), h('span', null, 'Pitches, last outing')),
        h('div', null, h('b', { class: 'bigv' }, L.fmtInnings(a.outs3)), h('span', null, 'Innings, last 3 days')),
        h('div', null, h('b', { class: 'bigv' }, L.fmtInnings(a.outs12)), h('span', null, 'Innings, last 12 months'))),
      a.over ? h('p', { class: 'note' }, a.over.pitches + ' pitches on ' + fmtDate(a.over.date) + ' was over the ' + state.settings.dailyMax + '-pitch daily limit for his age.') : null,
      !a.cleared ? h('p', { class: 'note' }, 'On rest days the plan swaps pitching and med ball throws for glove work with no throws. Hitting and leg work stay. Practice pitching stops at 20 pitches, so it never forces a rest day.') : null),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Log an outing'),
        h('div', { class: 'row' }, inp('p_date', 'Date', { type: 'date', def: t }), inp('p_pitches', 'Pitches', { mode: 'numeric' })),
        h('div', { class: 'row' }, inp('p_inn', 'Full innings', { mode: 'numeric', def: 0 }), sel('p_outs', 'Extra outs', [['0', '0'], ['1', '1'], ['2', '2']], '0')),
        h('p', { class: 'small mid' }, 'Game stats (optional, from the scorebook or GameChanger). These tell the hub what he needs to work on.'),
        h('div', { class: 'row' }, inp('p_strikes', 'Strikes', { mode: 'numeric' }), inp('p_bf', 'Batters faced', { mode: 'numeric' }), inp('p_fps', 'First-pitch strikes', { mode: 'numeric' })),
        h('div', { class: 'row' }, inp('p_k', 'Strikeouts', { mode: 'numeric' }), inp('p_bb', 'Walks', { mode: 'numeric' }), inp('p_h', 'Hits allowed', { mode: 'numeric' }), inp('p_hbp', 'Hit batters', { mode: 'numeric' })),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('p_pitches') == null) return toast('Enter the pitch count first.');
          const d = { pitches: num('p_pitches'), strikes: num('p_strikes'), bf: num('p_bf'), fps: num('p_fps'), k: num('p_k'), bb: num('p_bb'), h: num('p_h'), hbp: num('p_hbp') };
          const badP = pitchCheck(d); if (badP) return toast(badP);
          if (await addEntry(Object.assign({ kind: 'pitch', date: state.form.p_date || t, pitches: d.pitches, outs: Math.round((num('p_inn') || 0) * 3 + (parseInt(state.form.p_outs, 10) || 0)), where: 'game' }, pitchDetail(d)))) { clear('p_pitches', 'p_inn', 'p_outs', 'p_strikes', 'p_bf', 'p_fps', 'p_k', 'p_bb', 'p_h', 'p_hbp'); toast('Outing saved.'); } render(); }) }, 'Save outing'))),
      h('section', { class: 'sec' }, h('h2', null, 'Year total'),
        h('p', { class: 'num' }, L.fmtInnings(a.outs12) + ' of 80 innings in the last 12 months (' + Math.round(yr * 100) + '%)'),
        h('div', { class: 'bar', role: 'img', 'aria-label': Math.round(yr * 100) + ' percent of the yearly innings limit' }, h('i', { style: 'width:' + Math.min(100, yr * 100).toFixed(1) + '%' })),
        h('p', { class: 'math' }, a.outs12 + ' outs ÷ 3 = ' + (a.outs12 / 3).toFixed(1) + ' innings; ' + (a.outs12 / 3).toFixed(1) + ' ÷ 80 = ' + (yr * 100).toFixed(1) + '%'))),
    (() => { const pt = L.pitchDiagnose(state.entries, t), rows = pitchSummary(t);
      return h('section', { class: 'sec' }, h('h2', null, 'What to work on: pitching'),
        rows.length ? h('table', null, h('tbody', null, rows.map(r => h('tr', null, h('td', null, r[0], h('div', { class: 'math' }, r[2])), h('td', { class: 'v' }, r[1]))))) : h('p', { class: 'mid' }, 'Add strikes, batters faced and walks when you log a game outing. The hub will spot what to fix.'),
        pt.length ? pt.map(x => [h('p', { class: 'say' }, h('b', null, x.title)), h('p', { class: 'small mid' }, x.why + ' Fix-it drill: ' + L.PFIXES[x.id].drill.title + ' — ' + L.PFIXES[x.id].drill.text + ' Tip: ' + L.TIPS[L.PFIXES[x.id].drill.id])])
          : rows.length ? h('p', { class: 'status ok' }, 'Nothing flagged. Strike Zone Tic-Tac-Toe stays in the plan.') : null,
        h('p', { class: 'small mid' }, 'Targets used: strikes ' + Math.round(L.PR.strikePct * 100) + '%+, walks under ' + L.PR.bbPerInn + ' per inning, under ' + L.PR.pPerBatter + ' pitches per batter, first-pitch strikes ' + Math.round(L.PR.fpsPct * 100) + '%+. These are common youth coaching targets, not research cut-offs.')); })(),
    h('section', { class: 'sec' }, h('h2', null, 'Pitch speed'),
      h('div', { class: 'row' }, inp('v_date', 'Date', { type: 'date', def: t }), inp('v_avg', 'Average (mph)'), inp('v_max', 'Fastest (mph)'), inp('v_n', 'Pitches timed', { mode: 'numeric' }),
        sel('v_where', 'Where', [['bullpen', 'Practice'], ['game', 'Game']], 'bullpen')),
      h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
        const av = num('v_avg'), mx = num('v_max');
        if (av == null && mx == null) return toast('Enter the average or the fastest pitch.');
        if ([av, mx].some(v => v != null && (v < 10 || v > 100))) return toast('That speed looks off. Check it is in miles per hour.');
        if (av != null && mx != null && mx < av) return toast('Fastest cannot be lower than the average.');
        if (num('v_n') != null && (num('v_n') < 1 || num('v_n') % 1)) return toast('Pitches timed should be a whole number.');
        if (await addEntry({ kind: 'velo', date: state.form.v_date || t, avg: av, max: mx, n: num('v_n'), where: state.form.v_where || 'bullpen' })) { clear('v_avg', 'v_max', 'v_n'); toast('Pitch speed saved.'); } render(); }) }, 'Save pitch speed')),
      h('p', { class: 'small mid' }, 'Use the radar from behind the catcher or the side, the same spot each time. Speed checks do not count toward his pitch limits, so log real pitch counts as an outing above. The chart is on the Progress screen.')),
    h('section', { class: 'sec' }, h('h2', null, 'The rules it follows'),
      h('div', { class: 'scroll' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Pitches in a day'), h('th', { class: 'r' }, 'Rest days'))),
        h('tbody', null, rows.map(r => h('tr', null, h('td', { class: 'num' }, r[0]), h('td', { class: 'r' }, r[1])))))),
      h('p', { class: 'small' }, 'Daily limit at ages 9 to 10: 75 pitches. No pitching three days in a row. No more than 80 innings in 12 months.'),
      h('p', { class: 'small' }, 'USSSA counts innings instead: 3 or fewer in a day to pitch again the next day, 6 in one day, 8 across three days.'),
      h('p', { class: 'small mid' }, 'Sources: ', h('a', { href: 'https://www.mlb.com/pitch-smart/pitching-guidelines/ages-9-12' }, 'MLB Pitch Smart, ages 9 to 12'), ' and the ',
        h('a', { href: 'https://www.usssabaseball.org/images/2026_USSSA_National_By-Laws.pdf' }, 'USSSA by-laws, rule 7.05'), '.')));
}

/* ---------- Coach: Progress ---------- */
function viewProgress() {
  const t = today(), s = L.stats(state.entries, t), rt = L.retest(state.entries, t), p = plan(), R = p.tuned.rules;
  const sw = state.entries.filter(e => e.kind === 'swing').sort(L.byDate);
  const series = f => sw.map(e => ({ date: e.date, v: f(e) })).filter(x => L.isNum(x.v));
  const mach = state.entries.filter(e => e.kind === 'machine' && e.of > 0).sort(L.byDate).map(e => ({ date: e.date, v: e.made / e.of * 100 }));
  const tests = state.entries.filter(e => e.kind === 'strength').sort(L.byDate), f = tests[0], l = tests[tests.length - 1];
  const delta = (a, b, u) => (L.isNum(a) && L.isNum(b)) ? (b - a >= 0 ? '+' : '') + fix(b - a, 0) + ' ' + u : '–';
  const since = L.addDays(t, -28), r28 = L.totals(state.entries.filter(e => e.date > since)), all = L.totals(state.entries), last = checks()[0];
  const tile = (name, val, unit, pts, sub) => h('section', { class: 'sec' }, h('h3', null, name), h('b', { class: 'bigv' }, val), sub ? h('span', { class: 'math' }, sub) : null, spark(pts, unit));
  const rc = L.recapText(L.weekRecap(state.entries, t), who());
  return page(strip("This week's focus: " + L.FOCUS[p.pick.focus].name, p.pick.why),
    h('section', { class: 'sec plain' }, h('h2', null, 'Week so far'), h('ul', { class: 'plain' }, rc.slice(1).map(x => h('li', null, x))),
      h('p', { class: 'small mid' }, 'The same summary is sent to your phone every Sunday evening.')),
    (() => { const bn = L.bodyNotes(state.entries, t); return bn.length ? h('section', { class: 'sec' }, h('h2', null, 'Strength and pitch speed'),
      h('ul', { class: 'plain' }, bn.map(x => h('li', { class: x.kind === 'down' ? 'warn' : null }, x.text)))) : null; })(),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('div', { class: 'row between' }, h('h2', null, '4-week re-test'),
          h('span', { class: 'status ' + (rt.first != null && rt.inDays > 0 ? 'ok' : 'wait') }, rt.first == null ? 'Not started' : rt.inDays <= 0 ? 'Due now' : 'Due ' + fmtDate(rt.due))),
        h('p', { class: 'small' }, rt.first == null ? 'The first test sets his starting line. Run it in test week, then log it on the Log screen.' : 'Same tests, same bat, same tee height, same time of day. Last test: ' + fmtDate(rt.last) + '.'),
        tests.length ? h('div', { class: 'scroll' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', { class: 'r' }, 'First'), h('th', { class: 'r' }, 'Latest'), h('th', { class: 'r' }, 'Change'))),
          h('tbody', null, [['Long jump', 'jump', 'in'], ['Push-ups', 'pushups', ''], ['Plank', 'plank', 'sec']].map(r =>
            h('tr', null, h('td', null, r[0]), h('td', { class: 'r' }, fix(f[r[1]], 0)), h('td', { class: 'r' }, fix(l[r[1]], 0)), h('td', { class: 'r' }, delta(f[r[1]], l[r[1]], r[2]))))))) : null),
      h('section', { class: 'sec' }, h('h2', null, 'Latest filmstrip note'),
        last ? [h('p', { class: 'say' }, str(last.fix && last.fix.title, 80) || 'No note'),             h('p', { class: 'small mid' }, fmtDate(last.date) + ', ' + (last.tag === 'game' ? 'game' : 'practice') + '. Points to: ' + ((L.FOCUS[last.fixArea] || {}).name || 'nothing specific') + '.')]
          : h('p', { class: 'mid' }, 'No filmstrips yet.'), h('p', null, h('a', { href: '#film' }, 'Open the film room'))),
      tile('Bat speed (mph)', fix(s.batRecent), 'mph', series(e => e.batSpeed), s.batTrend != null ? fix(s.batRecent) + ' − ' + fix(s.batPrior) + ' = ' + (s.batTrend >= 0 ? '+' : '') + fix(s.batTrend) + ' mph against the 4 weeks before' : 'Needs entries in both 4-week windows to show a change.'),
      tile('Exit speed, real balls (mph)', fix(s.exitRecent), 'mph', series(e => e.ball !== 'mini' ? e.exitVelo : null)),
      tile('Squared-up score', fix(s.squareRecent, 2), 'ratio', series(e => (e.ball !== 'mini' && L.isNum(e.batSpeed) && L.isNum(e.exitVelo) && e.batSpeed > 0) ? e.exitVelo / e.batSpeed : null), 'Exit speed ÷ bat speed. His best: ' + fix(s.squareBest, 2) + '.'),
      tile('Machine contact', pcs(s.contactRate), 'percent', mach, s.contactOf ? s.contactMade + ' ÷ ' + s.contactOf + ' = ' + pcs(s.contactRate) : null),
      (function () {
        const v = state.entries.filter(e => e.kind === 'velo').sort(L.byDate), top = e => L.isNum(e.max) ? e.max : e.avg;
        const pts = v.map(e => ({ date: e.date, v: top(e) })).filter(x => L.isNum(x.v)), a = pts[0], z = pts[pts.length - 1], best = L.records(state.entries).velo;
        return tile('Pitch speed, fastest (mph)', z ? fix(z.v) : '–', 'mph', pts,
          pts.length > 1 ? fix(z.v) + ' − ' + fix(a.v) + ' = ' + (z.v - a.v >= 0 ? '+' : '') + fix(z.v - a.v) + ' mph since ' + fmtDate(a.date) + '. Best ever: ' + fix(best.v) + ' mph.' : 'Log speeds on the Arm screen.');
      })(),
      (function () {
        const b = state.entries.filter(e => e.kind === 'body').sort(L.byDate);
        const ser = k => b.filter(e => L.isNum(e[k])).map(e => ({ date: e.date, v: e[k] }));
        const grow = (pts, show, u) => { if (pts.length < 2) return null; const a = pts[0], z = pts[pts.length - 1], d = z.v - a.v, days = (Date.parse(z.date) - Date.parse(a.date)) / 864e5;
          return show(z.v) + ' − ' + show(a.v) + ' = ' + (d >= 0 ? '+' : '') + fix(d) + ' ' + u + ' over ' + Math.round(days) + ' days' + (days >= 60 ? '; ' + fix(d) + ' ÷ ' + Math.round(days) + ' × 365 = ' + (d >= 0 ? '+' : '') + fix(d / days * 365) + ' ' + u + ' a year' : ''); };
        const hs = ser('heightIn'), ws = ser('weightLb'), hz = hs[hs.length - 1], wz = ws[ws.length - 1];
        return h('section', { class: 'sec' }, h('h2', null, 'Growth'),
          h('h3', null, 'Height'), h('b', { class: 'bigv' }, hz ? L.fmtHeight(hz.v) : '–'), grow(hs, x => fix(x) + ' in', 'in') ? h('span', { class: 'math' }, grow(hs, x => fix(x) + ' in', 'in')) : null, spark(hs, 'inches'),
          h('h3', null, 'Weight'), h('b', { class: 'bigv' }, wz ? fix(wz.v) + ' lb' : '–'), grow(ws, x => fix(x) + ' lb', 'lb') ? h('span', { class: 'math' }, grow(ws, x => fix(x) + ' lb', 'lb')) : null, spark(ws, 'pounds'),
          h('p', { class: 'small mid' }, 'Log on the Log screen. When he grows, recheck his bat length and weight on the Gear screen.'));
      })(),
      h('section', { class: 'sec' }, h('h2', null, 'Reps'),
        h('table', null, h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'r' }, 'Last 28 days'), h('th', { class: 'r' }, 'All time'))),
          h('tbody', null, [['Swings', 'swings'], ['Push-ups', 'pushups'], ['Sit-ups', 'situps'], ['Squats', 'squats'], ['Sessions', 'sessions']].map(r =>
            h('tr', null, h('td', null, r[0]), h('td', { class: 'r' }, commas(r28[r[1]])), h('td', { class: 'r' }, commas(all[r[1]]))))))),
      h('section', { class: 'sec' }, h('h2', null, 'Games, last 28 days'),
        s.pa ? h('div', { class: 'facts' },
          h('div', null, h('b', { class: 'bigv' }, s.battingAvg == null ? '–' : s.battingAvg.toFixed(3).replace(/^0/, '')), h('span', null, 'Average (' + s.hits + ' ÷ ' + s.ab + ')')),
          h('div', null, h('b', { class: 'bigv' }, pcs(s.kRate)), h('span', null, 'Strikeouts (' + s.k + ' ÷ ' + s.pa + ' trips)')))
          : h('p', { class: 'mid' }, 'No game lines logged in the last 28 days.'))),
    h('section', { class: 'sec' }, h('h2', null, 'How the weekly focus is picked'),
      h('p', { class: 'small' }, 'The hub checks these in order and stops at the first one that is true. The cutoffs start as rules written for this hub, not published standards, and shift to his own numbers as data builds up.'),
      h('ol', { class: 'small' },
        h('li', null, 'Nothing logged yet: Test week.'),
        h('li', null, 'Machine contact at ' + pcs(R.contactGood) + ' or better, and strikeouts in ' + pcs(R.kHigh) + ' or more of at least ' + R.minPA + ' game trips: Timing.'),
        h('li', null, 'Machine contact under ' + pcs(R.contactLow) + ': Contact.'),
        h('li', null, 'Squared-up score under ' + pcs(R.squareDrop) + ' of his own best: Contact.'),
        h('li', null, 'Bat speed up less than ' + R.speedFlat.toFixed(1) + ' mph against the 4 weeks before: Bat speed.'),
        h('li', null, 'A filmstrip note from the last 14 days points somewhere: that focus.'),
        h('li', null, 'Otherwise: whichever of Swing path, Bat speed or Contact he has gone longest without.')),
      h('p', { class: 'small' }, 'No focus runs more than two weeks in a row. After two, the hub moves down the list.'),
      h('h3', null, p.tuned.tuned ? 'Tuned to his numbers' : 'Not enough of his data to tune yet'), p.tuned.notes.map(n => h('p', { class: 'small' }, n))));
}

/* ---------- Coach: Gear ---------- */
function viewGear() {
  if (!state.gearDraft) { state.gearDraft = JSON.parse(JSON.stringify(state.settings)); state.gearDraftFrom = JSON.stringify(state.gearDraft); }
  const d = state.gearDraft, g = parseFloat(d.gameBatOz);
  const tagOf = st => ({ match: ['ok', 'Game weight'], inrange: ['ok', 'In range'], heavy: ['wait', 'Heavy'], veryheavy: ['stop', 'Very heavy'], verylight: ['wait', 'Very light'], unknown: ['wait', 'Weigh it'] })[st];
  const setNum = (obj, k) => e => { const v = parseFloat(e.target.value); obj[k] = isFinite(v) ? v : null; };
  const fitCell = b => { const gg = parseFloat(d.gameBatOz), oz = b.id === 'game' ? gg : b.oz, p = L.pctVsGame(oz, gg), st = tagOf(L.fitStatus(p));
    return [h('span', { class: 'status ' + st[0] }, st[1]), p == null ? null : h('div', { class: 'math' }, '(' + oz + ' − ' + gg + ') ÷ ' + gg + ' = ' + (p >= 0 ? '+' : '') + p.toFixed(1) + '%')]; };
  const refreshFit = () => d.batList.forEach(b => { const c = document.getElementById('fit-' + b.id); if (c) c.replaceChildren(...fitCell(b).filter(Boolean)); });
  return page(strip('Gear', 'Every bat measured against his game bat.'),
    h('section', { class: 'sec plain' },
      h('p', { class: 'small mid' }, 'Common guidance keeps training bats within about 20% of the game bat. Weights marked "estimate" were worked out, not weighed.'),
      h('div', { class: 'scroll' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Bat'), h('th', null, 'Ounces'), h('th', { class: 'r' }, 'Versus game bat'))),
        h('tbody', null, d.batList.map(b => {
          const oz = b.id === 'game' ? g : b.oz;
          return h('tr', null,
            h('td', null, b.name, h('div', { class: 'math' }, b.role + (b.est ? ', estimate' : ''))),
            h('td', null, h('input', { id: 'oz-' + b.id, type: 'number', inputmode: 'decimal', step: 'any', min: '0', 'aria-label': b.name + ' weight in ounces', value: oz == null || !isFinite(oz) ? '' : String(oz),
              oninput: e => { const v = parseFloat(e.target.value); if (b.id === 'game') d.gameBatOz = isFinite(v) ? v : null; b.oz = isFinite(v) ? v : null; b.est = false; refreshFit(); } })),
            h('td', { class: 'r', id: 'fit-' + b.id }, fitCell(b)));
        })))),
      h('p', { class: 'small mid' }, 'Heavy bats stay on the tee with a ' + L.HEAVY_CAP + '-swing limit per session. Change the game bat weight when he moves up and every row recalculates.')),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Player'),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-player' }, h('span', null, 'First name'), h('input', { id: 'g-player', type: 'text', maxlength: '24', value: d.player || '', oninput: e => { d.player = e.target.value; } })),
          h('label', { class: 'fld', for: 'g-bats' }, h('span', null, 'Bats'), h('select', { id: 'g-bats', onchange: e => { d.bats = e.target.value; } }, [['left', 'Left-handed'], ['right', 'Right-handed']].map(o => h('option', { value: o[0], selected: d.bats === o[0] }, o[1])))),
          h('label', { class: 'fld', for: 'g-level' }, h('span', null, 'Strength step, 1 to 5'), h('input', { id: 'g-level', type: 'number', inputmode: 'numeric', min: '1', max: '5', step: '1', value: String(d.level || 1), oninput: e => { const v = parseInt(e.target.value, 10); d.level = isFinite(v) ? Math.max(1, Math.min(5, v)) : 1; } }))),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-tank' }, h('span', null, 'Tidal Tank fill (pounds)'), h('input', { id: 'g-tank', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: d.tankLb == null ? '' : String(d.tankLb), oninput: setNum(d, 'tankLb') })),
          h('label', { class: 'fld', for: 'g-med' }, h('span', null, 'Med ball (pounds)'), h('input', { id: 'g-med', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: d.medBallLb == null ? '' : String(d.medBallLb), oninput: setNum(d, 'medBallLb') }))),
        h('p', { class: 'small mid' }, 'Each strength step adds 2 reps per set and 5 seconds per hold. Move up one step after two weeks of clean form.'),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { const n = JSON.parse(JSON.stringify(d)); n.pinHash = state.settings.pinHash || null; state.gearDraft = null; saveSettings(n); } }, 'Save'))),
      h('section', { class: 'sec' }, h('h2', null, 'Prizes, card and Arcade'),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-jersey' }, h('span', null, 'Jersey number'), h('input', { id: 'g-jersey', type: 'text', inputmode: 'numeric', maxlength: '2', value: d.jersey || '', oninput: e => { d.jersey = e.target.value.replace(/\D/g, '').slice(0, 2); } })),
          h('label', { class: 'fld', for: 'g-team' }, h('span', null, 'Team name (for season mode)'), h('input', { id: 'g-team', type: 'text', maxlength: '20', value: d.team || '', oninput: e => { d.team = e.target.value; } })),
          h('label', { class: 'fld', for: 'g-limit' }, h('span', null, 'Arcade games per day'), h('select', { id: 'g-limit', onchange: e => { d.gameLimit = parseInt(e.target.value, 10); } }, [[0, 'Off'], [3, '3'], [5, '5'], [10, '10'], [99, 'No limit']].map(o => h('option', { value: String(o[0]), selected: (d.gameLimit == null ? 5 : d.gameLimit) === o[0] }, o[1]))))),
        h('h3', null, 'Prizes for reaching a level'),
        (d.prizes || []).length ? h('ul', { class: 'plain' }, d.prizes.slice().sort((a, b) => a.level - b.level).map(z => h('li', { class: 'row between' }, h('span', null, 'Level ' + z.level + ': ' + z.text + (z.given ? ' (given)' : L.game(state.entries).level >= z.level ? ' (earned, not given yet)' : '')),
          h('span', null, L.game(state.entries).level >= z.level && !z.given ? h('button', { type: 'button', class: 'btn line', onclick: () => { z.given = true; render(); } }, 'Mark given') : null,
            h('button', { type: 'button', class: 'btn line', onclick: () => { d.prizes = d.prizes.filter(x => x !== z); render(); } }, 'Remove'))))) : h('p', { class: 'mid' }, 'No prizes yet. Add one, like "Level 5: ice cream trip".'),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-plevel' }, h('span', null, 'Level'), h('input', { id: 'g-plevel', type: 'number', inputmode: 'numeric', min: '2', max: '50', value: state.form.pz_lvl || '', oninput: e => { state.form.pz_lvl = e.target.value; } })),
          h('label', { class: 'fld', for: 'g-ptext' }, h('span', null, 'Prize'), h('input', { id: 'g-ptext', type: 'text', maxlength: '60', value: state.form.pz_text || '', oninput: e => { state.form.pz_text = e.target.value; } })),
          h('div', { class: 'fld' }, h('span', null, '\u00a0'), h('button', { type: 'button', class: 'btn line', onclick: () => {
            const lv = parseInt(state.form.pz_lvl, 10), tx = (state.form.pz_text || '').trim();
            if (!(lv >= 2 && lv <= 50)) return toast('Pick a level from 2 to 50.'); if (!tx) return toast('Type the prize.');
            d.prizes = (d.prizes || []).concat([{ level: lv, text: tx.slice(0, 60), given: false }]); state.form.pz_lvl = ''; state.form.pz_text = ''; render(); } }, 'Add prize'))),
        h('p', { class: 'small mid' }, 'He sees the next prize and how close he is on his Today page. Every Arcade game gives 5 XP (no daily cap). A training day gives up to 100.'),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { const n = JSON.parse(JSON.stringify(d)); n.pinHash = state.settings.pinHash || null; state.gearDraft = null; saveSettings(n); } }, 'Save prizes and Arcade'))),
      h('section', { class: 'sec' }, h('h2', null, 'This device'),
        h('p', null, 'This device is signed in with the family code. Sign it out if it is lost or no longer used for the hub.'),
        h('div', null, h('button', { type: 'button', class: 'btn ' + (state.confirmDel === 'signout' ? 'del' : 'line'), onclick: () => {
          if (state.confirmDel !== 'signout') { state.confirmDel = 'signout'; render(); return; }
          state.confirmDel = null; forgetKey(); try { localStorage.setItem('dugout-out', '1'); } catch (e) {} familyKey = ''; state.entries = []; state.media = {}; state.needKey = true; state.keyMsg = ''; state.keyNet = false; history.replaceState(null, '', location.pathname + '#today'); route(); render(); } },
          state.confirmDel === 'signout' ? 'Tap again to sign out' : 'Sign this device out'))),
      h('section', { class: 'sec' }, h('h2', null, 'Parent code'),
        h('p', null, state.settings.pinHash ? 'A parent code is set. The Coach side and deleting filmstrips ask for it, and it locks again when you switch to the Player side.' : 'No parent code yet. Set one so the Coach side stays with you.'),
        h('div', { class: 'row' }, h('label', { class: 'fld', for: 'pin-new', style: 'flex:0 1 220px' }, h('span', null, state.settings.pinHash ? 'New code, 4 to 6 digits' : 'Code, 4 to 6 digits'),
          h('input', { id: 'pin-new', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6' })),
          h('button', { type: 'button', class: 'btn', onclick: () => { const v = (document.getElementById('pin-new') || {}).value || '';
            if (!/^\d{4,6}$/.test(v.trim())) return toast('Use 4 to 6 digits.');
            const ph = pinHash(v.trim()); state.unlocked = ph; if (state.gearDraft) state.gearDraft.pinHash = ph;
            saveSettings(Object.assign({}, state.settings, { pinHash: ph })); } }, state.settings.pinHash ? 'Change code' : 'Set code'),
          state.settings.pinHash ? h('button', { type: 'button', class: 'btn line', onclick: () => { if (state.gearDraft) state.gearDraft.pinHash = null; saveSettings(Object.assign({}, state.settings, { pinHash: null })); } }, 'Remove code') : null)),
      h('section', { class: 'sec' }, h('h2', null, 'What each tool is for'),
        h('table', null, h('tbody', null, [
          ['Personal Pitcher, mini balls, skinny bat', 'Contact and timing'], ['Tee and net', 'Every drill, any day'], ['Practice bats 29/19', 'Game-weight speed swings'],
          ['CamWood trainer', 'Swing path, tee only'], ['SKLZ three-bat set', 'Bat speed, low volume'], ['Diamond Kinetics sensor', 'Bat speed'], ['TAG radar', 'Exit speed on real balls, pitch speed'],
          ['Tidal Tank Mini, med ball', 'Core and turning strength'], ['GameChanger', 'Game results and pitch counts'], ['Phone camera', 'Filmstrips in the film room']
        ].map(r => h('tr', null, h('td', null, r[0]), h('td', { class: 'mid' }, r[1]))))))));
}

/* ---------- shell ---------- */
const VIEWS = { today: viewToday, arcade: viewArcade, film: viewFilm, trophies: viewTrophies, log: viewLog, arm: viewArm, progress: viewProgress, gear: viewGear };
const TABS = { player: [['today', 'Today'], ['arcade', 'Arcade'], ['film', 'Film room'], ['trophies', 'Trophies']], coach: [['log', 'Log'], ['arm', 'Arm'], ['progress', 'Progress'], ['gear', 'Gear']] };
const modeOf = r => TABS.player.some(t => t[0] === r) ? 'player' : 'coach';
function route() { const r = (location.hash || '').replace('#', ''); state.route = VIEWS[r] ? r : 'today'; if (state.route !== 'gear') state.gearDraft = null; }
function render() {
  const keep = document.activeElement && document.activeElement.id, mode = state.needKey ? 'player' : modeOf(state.route);
  const th = L.THEMES.find(x => x.id === state.settings.theme), lvl = L.game(state.entries).level;
  document.body.className = mode + (th && th.id !== 'classic' && lvl >= th.level ? ' theme-' + th.id : '');
  const body = state.needKey ? viewSetup() : mode === 'coach' && locked() ? page(strip('Coach side', 'Enter the parent code to open it.'), unlockBox(null)) : VIEWS[state.route]();
  $view.replaceChildren(...body.flat(Infinity).filter(Boolean));
  $tabs.hidden = !!state.needKey; document.querySelector('.mode').hidden = !!state.needKey;
  $tabs.replaceChildren(...[...TABS[mode].map(t => h('a', { href: '#' + t[0], 'aria-current': state.route === t[0] ? 'page' : null }, t[1])),
    mode === 'coach' && state.settings.pinHash && !locked() ? h('button', { type: 'button', class: 'lockbtn', onclick: () => { relock(); location.hash = '#today'; } }, 'Lock') : null].filter(Boolean));
  document.querySelectorAll('.mode a').forEach(a => a.setAttribute('aria-current', String(a.dataset.m === mode)));
  renderCheer();
  if (mode === 'player' && !state.needKey && !state.cheer) renderNote();
  if (keep && !state.cheer) { const el = document.getElementById(keep); if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
}
window.addEventListener('hashchange', () => { route(); state.confirmDel = null; state.pinMsg = ''; if (modeOf(state.route) === 'player') relock(); render(); window.scrollTo(0, 0); });
try { const s = JSON.parse(localStorage.getItem('dugout-ticks') || 'null'); if (s && s.t) { state.ticks = s.t; state.counts = s.c || {}; } } catch (e) {}
document.addEventListener('pointerdown', function first() { document.removeEventListener('pointerdown', first); setTimeout(HubGames.Sound.warm, 50); });
boot();
})();
