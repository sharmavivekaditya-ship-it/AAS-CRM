/* Aditya ArthSetu BD CRM (single-page app on Supabase) */
(() => {
'use strict';

/* ================= Constants ================= */
const OUTCOMES = [
  { k: 'not_answering',  label: 'Not answering',     stage: 'attempting',     tone: 'grey' },
  { k: 'no_response',    label: 'No response',       stage: 'attempting',     tone: 'grey' },
  { k: 'callback',       label: 'Call back',         stage: 'callback',       tone: 'blue' },
  { k: 'opportunity',    label: 'Funding opportunity', stage: 'opportunity',  tone: 'teal' },
  { k: 'opp_rating',     label: 'Rating opportunity',  stage: 'opp_rating',   tone: 'orchid' },
  { k: 'mtg_sched',      label: 'Meeting scheduled', stage: 'mtg_sched',      tone: 'violet' },
  { k: 'mtg_done',       label: 'Meeting done',      stage: 'mtg_done',       tone: 'indigo' },
  { k: 'docs',           label: 'Docs awaited',      stage: 'docs',           tone: 'cyan' },
  { k: 'proposal',       label: 'Proposal sent',     stage: 'proposal',       tone: 'olive' },
  { k: 'won',            label: 'Mandate signed',    stage: 'won',            tone: 'green' },
  { k: 'no_req',         label: 'No requirement',    stage: 'no_req',         tone: 'stone' },
  { k: 'not_interested', label: 'Not interested',    stage: 'not_interested', tone: 'red' },
];
const OUT = Object.fromEntries(OUTCOMES.map(o => [o.k, o]));
const GUIDE = {
  not_answering: 'Phone rang, nobody picked up',
  no_response: 'Not reachable, switched off, or did not respond',
  callback: 'Asked to be contacted again later',
  opportunity: 'A real funding need identified (loan, working capital, refinance etc.)',
  opp_rating: 'A credit rating need identified',
  mtg_sched: 'Date and time fixed for a meeting or call',
  mtg_done: 'Meeting held; next step goes in remarks',
  docs: 'Awaiting documents or information from the client',
  proposal: 'Term sheet or proposal shared',
  won: 'Mandate signed with AAS',
  no_req: 'No funding need right now; worth revisiting later',
  not_interested: 'Declined',
};
const STAGES = [
  { k: 'new',            label: 'New lead',          tone: 'grey' },
  { k: 'attempting',     label: 'Trying to reach',   tone: 'grey' },
  { k: 'callback',       label: 'Call back',         tone: 'blue' },
  { k: 'opportunity',    label: 'Funding opportunity', tone: 'teal' },
  { k: 'opp_rating',     label: 'Rating opportunity',  tone: 'orchid' },
  { k: 'mtg_sched',      label: 'Meeting scheduled', tone: 'violet' },
  { k: 'mtg_done',       label: 'Meeting done',      tone: 'indigo' },
  { k: 'docs',           label: 'Docs awaited',      tone: 'cyan' },
  { k: 'proposal',       label: 'Proposal sent',     tone: 'olive' },
  { k: 'won',            label: 'Mandate signed',    tone: 'green' },
  { k: 'no_req',         label: 'No requirement',    tone: 'stone', closed: true },
  { k: 'not_interested', label: 'Not interested',    tone: 'red',   closed: true },
  { k: 'lost',           label: 'Lost',              tone: 'red',   closed: true },
];
const STG = Object.fromEntries(STAGES.map((s, i) => [s.k, { ...s, rank: i }]));
const NOT_CONNECTED = new Set(['not_answering', 'no_response']);
const POSITIVE = new Set(['callback', 'opportunity', 'opp_rating', 'mtg_sched', 'mtg_done', 'docs', 'proposal', 'won']);
const REQS = ['Term loan', 'Working capital (CC/OD)', 'WCTL', 'Project finance', 'Refinance / takeover', 'LAP', 'Warehouse receipt finance',
  'Supply chain / bill discounting', 'Trade finance / LC-BG', 'NCD / bonds', 'Credit rating', 'IPO / equity', 'Other'];
const SOURCES = ['Cold call', 'Project leads', 'Rating action list', 'Referral', 'Ex-banker network', 'Inbound', 'LinkedIn', 'Existing relationship', 'Other'];
const SHARED = { '': 'Not shared', whatsapp: 'On WhatsApp', email: 'On email', both: 'WhatsApp and email' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROUTES = {
  today: 'Today', leads: 'Leads', calls: 'Call log', pipeline: 'Pipeline', companies: 'Companies',
  followups: 'Follow-ups', reports: 'Reports', team: 'Team logins', settings: 'Settings & data',
};
const ADMIN_ROUTES = new Set(['team', 'settings']);

/* ================= Helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const D = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
const dow = s => D(s).getDay();
const weekStart = s => addDays(s, -((dow(s) + 6) % 7));
const monthStart = s => s.slice(0, 8) + '01';
const monthEnd = s => { const d = D(monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); };
const addMonths = (s, n) => { const d = D(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
const diffDays = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const fmt = (s, o) => D(s).toLocaleDateString('en-IN', o);
const fShort = s => s ? fmt(s, { day: 'numeric', month: 'short' }) : '';
const fMed = s => s ? fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fDay = s => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fWk = s => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' ')
  .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|the|india|and|mfg|industries)\b/g, ' ').replace(/[^a-z0-9]/g, '');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};
const sunSVG = (cls = 'sunmark', light = false) => `<svg class="${cls}" viewBox="0 0 100 64" aria-hidden="true"><defs><linearGradient id="sg${light ? 'l' : ''}" x1="0" x2="1"><stop offset="0" stop-color="${light ? '#fbd9a8' : '#f6a83e'}"/><stop offset="1" stop-color="${light ? '#f8c08f' : '#ec4430'}"/></linearGradient></defs><g stroke="url(#sg${light ? 'l' : ''})" stroke-width="${light ? 5 : 7}" stroke-linecap="round" fill="none"><path d="M34 60 A16 16 0 0 1 66 60"/><path d="M74 60H94M70.8 48 88.1 38M62 39.2 72 21.9M50 36V16M38 39.2 28 21.9M29.2 48 11.9 38M26 60H6"/></g></svg>`;
const wordmark = () => `<div class="wordmark" aria-label="Aditya ArthSetu"><span class="w1">ADITYA</span><span class="w2">ARTHSETU</span><span class="tag">illuminating financial pathways</span></div>`;
const chip = (k, map = OUT) => { const o = map[k] || STG[k]; return o ? `<span class="chip tone-${o.tone}">${esc(o.label)}</span>` : ''; };
const stageChip = k => chip(k, STG);

/* ================= State ================= */
const CFG = window.AAS_CONFIG || {};
let sb = null;
const S = {
  session: null, me: null, loaded: false, sync: 'wait',
  companies: new Map(), acts: new Map(), profiles: new Map(),
  settings: { daily_target: 10, workdays: [1, 2, 3, 4, 5], holidays: [] },
  route: 'today', drawerId: null, chan: null,
  leads: new Map(), batches: new Map(), leadId: null, leadsMissing: false,
};
const UI = {
  calls: { range: 'week', from: '', to: '', outcome: '', by: '', q: '' },
  companies: { q: '', stage: '', source: '', sort: 'recent' },
  pipeline: { q: '' },
  reports: { mode: 'week', anchor: today(), by: '' },
  leads: { batch: '', pri: '', status: '', q: '' },
};
const isAdmin = () => S.me?.role === 'admin';
const meId = () => S.me?.id;
const personName = id => S.profiles.get(id)?.full_name || S.profiles.get(id)?.email || '';
const byName = a => (a.by_id && personName(a.by_id)) || a.by_name || '—';
const canEditAct = a => isAdmin() || (a.by_id && a.by_id === meId());

/* ---------- derived data ---------- */
function actsFor(cid) {
  return [...S.acts.values()].filter(a => a.company_id === cid)
    .sort((a, b) => (b.call_date.localeCompare(a.call_date)) || String(b.created_at).localeCompare(String(a.created_at)));
}
function lastAct(cid) { return actsFor(cid)[0] || null; }
function lastActsMap() {
  const m = new Map();
  for (const a of S.acts.values()) {
    const cur = m.get(a.company_id);
    if (!cur || a.call_date > cur.call_date || (a.call_date === cur.call_date && String(a.created_at) > String(cur.created_at))) m.set(a.company_id, a);
  }
  return m;
}
function callCount() { const m = new Map(); for (const a of S.acts.values()) m.set(a.company_id, (m.get(a.company_id) || 0) + 1); return m; }
function isWorkday(s) { return (S.settings.workdays || []).includes(dow(s)) && !(S.settings.holidays || []).includes(s); }
function workdaysIn(from, to) { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d)) n++; return n; }
function nextStage(cur, outcome) {
  const s = OUT[outcome]?.stage || cur;
  if (cur === 'won' && outcome !== 'won') return cur;
  if (s === 'attempting' && cur && STG[cur] && !STG[cur].closed && STG[cur].rank > STG.attempting.rank) return cur;
  return s;
}
function dueHTML(date, time) {
  if (!date) return '';
  const n = diffDays(today(), date);
  const t = time ? ` · ${esc(time)}` : '';
  if (n < 0) return `<span class="due over">Overdue · ${fShort(date)}</span>`;
  if (n === 0) return `<span class="due today">Today${t}</span>`;
  if (n === 1) return `<span class="due today">Tomorrow${t}</span>`;
  if (n < 7) return `<span class="due later">${fWk(date)}${t}</span>`;
  return `<span class="due later">${fMed(date)}${t}</span>`;
}
function primaryContact(c) { return (c.contacts || [])[0] || null; }
function phoneHTML(str) {
  if (!str) return '';
  return String(str).split(/\s*[\/,;]\s*/).filter(Boolean).map(p => {
    const digits = p.replace(/\D/g, '').replace(/^0+/, '');
    const mobile = /^[6-9]\d{9}$/.test(digits) ? '91' + digits : (/^91[6-9]\d{9}$/.test(digits) ? digits : null);
    return `<span class="phone"><span class="tab">${esc(p)}</span><button class="iconbtn" title="Copy number" data-act="copy" data-text="${esc(p)}">${ICON.copy}</button>${mobile ? `<a class="wa" href="https://wa.me/${mobile}" target="_blank" rel="noopener" title="Open WhatsApp chat">WA</a>` : ''}</span>`;
  }).join('');
}

/* ================= Boot & auth ================= */
const root = () => $('#root');

function renderSetupNeeded() {
  root().innerHTML = `<div class="setupcard">${wordmark()}<h2>Almost there</h2>
    <p>This copy of the CRM isn't connected to its database yet. Open <code>config.js</code> and paste your Supabase project URL and anon key, then upload the folder again.</p>
    <p class="muted small">The step-by-step guide is in <code>SETUP-GUIDE.md</code> in the same folder.</p></div>`;
}

async function boot() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) return renderSetupNeeded();
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  sb.auth.onAuthStateChange((ev, sess) => {
    if (ev === 'SIGNED_OUT') { teardown(); renderLogin(); }
    else if (sess) S.session = sess;
  });
  const { data } = await sb.auth.getSession();
  if (data?.session) startApp(data.session); else renderLogin();
}

function renderLogin(msg = '') {
  document.title = 'Sign in · AAS BD Desk';
  root().innerHTML = `<div class="login">${sunSVG('login-rays', true)}
    <div class="login-card">
      <div class="head">${wordmark()}${sunSVG()}</div>
      <div><h1>BD Desk</h1><p class="muted small" style="margin:4px 0 0">Sign in with the email and password your admin gave you.</p></div>
      <form id="login-form" novalidate>
        <label class="f">Email<input type="email" id="li-email" autocomplete="username" required></label>
        <label class="f">Password<input type="password" id="li-pass" autocomplete="current-password" required></label>
        <div class="err" id="li-err">${esc(msg)}</div>
        <button class="btn primary" type="submit" id="li-btn">Sign in</button>
      </form>
      <div class="login-foot">Forgot your password? Ask your admin to reset it from Team logins.</div>
    </div></div>`;
  $('#li-email').focus();
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#li-btn'); btn.disabled = true; btn.textContent = 'Signing in…';
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#li-email').value.trim(), password: $('#li-pass').value });
    if (error) {
      btn.disabled = false; btn.textContent = 'Sign in';
      $('#li-err').textContent = /invalid/i.test(error.message) ? 'Email or password is wrong. Please check and try again.'
        : /banned/i.test(error.message) ? 'This login has been switched off. Please contact your admin.' : error.message;
      return;
    }
    startApp(data.session);
  });
}

async function startApp(session) {
  S.session = session;
  root().innerHTML = '<div class="loading">Loading your desk…</div>';
  const { data: prof, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error || !prof || !prof.active) {
    root().innerHTML = `<div class="setupcard">${wordmark()}<h2>${prof && !prof.active ? 'This login is switched off' : 'Your account is not set up'}</h2>
      <p>${error ? esc(error.message) : 'Please contact your admin.'}</p><div><button class="btn" data-act="signout">Sign out</button></div></div>`;
    return;
  }
  S.me = prof;
  const h = (location.hash || '').slice(1);
  S.route = ROUTES[h] && (!ADMIN_ROUTES.has(h) || isAdmin()) ? h : 'today';
  renderShell();
  await loadAll();
  subscribe();
}

function teardown() {
  if (S.chan) { try { sb.removeChannel(S.chan); } catch (e) { /* ignore */ } }
  S.chan = null; S.me = null; S.loaded = false; S.drawerId = null;
  S.companies.clear(); S.acts.clear(); S.profiles.clear(); S.leads.clear(); S.batches.clear(); S.leadId = null;
  $('#layer')?.remove();
}

async function fetchAll(table) {
  const out = []; const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await sb.from(table).select('*').range(from, from + step - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < step) break;
  }
  return out;
}

async function loadAll() {
  try {
    const [cos, acts, profs, set] = await Promise.all([
      fetchAll('companies'), fetchAll('activities'),
      sb.from('profiles').select('*'), sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    S.companies = new Map(cos.map(r => [r.id, r]));
    S.acts = new Map(acts.map(r => [r.id, r]));
    S.profiles = new Map((profs.data || []).map(r => [r.id, r]));
    if (set.data) S.settings = set.data;
    try {
      const [bs, ls] = await Promise.all([fetchAll('lead_batches'), fetchAll('leads')]);
      S.batches = new Map(bs.map(r => [r.id, r])); S.leads = new Map(ls.map(r => [r.id, r])); S.leadsMissing = false;
    } catch (e) { S.leadsMissing = true; }
    S.loaded = true;
    render();
  } catch (e) {
    $('#view').innerHTML = `<div class="banner">Couldn't load data: ${esc(e.message || e)}. Check your internet connection and refresh the page.</div>`;
  }
}

function subscribe() {
  const apply = (key) => p => {
    const map = S[key];
    if (p.eventType === 'DELETE') map.delete(p.old.id); else map.set(p.new.id, p.new);
    scheduleRender();
  };
  S.chan = sb.channel('aas-crm-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, apply('companies'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, apply('acts'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, apply('leads'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_batches' }, apply('batches'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, p => { if (p.new) S.settings = p.new; scheduleRender(); })
    .subscribe(status => {
      S.sync = status === 'SUBSCRIBED' ? 'live' : (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) ? 'off' : 'wait');
      renderSync();
    });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.loaded) loadAll(); });

/* ================= Writes ================= */
async function saveCompany(row) {
  const { data, error } = await sb.from('companies').upsert(row).select().single();
  if (error) throw error;
  S.companies.set(data.id, data); return data;
}
async function patchCompany(id, patch) {
  const { data, error } = await sb.from('companies').update(patch).eq('id', id).select().single();
  if (error) throw error;
  S.companies.set(data.id, data); scheduleRender(); return data;
}
async function saveAct(row) {
  const { data, error } = await sb.from('activities').upsert(row).select().single();
  if (error) throw error;
  S.acts.set(data.id, data); return data;
}
async function delRow(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
}
const fail = e => toast(friendlyErr(e), true);
function friendlyErr(e) {
  const m = String(e?.message || e || 'Something went wrong');
  if (/row-level security|permission|42501/i.test(m)) return "You don't have permission to do that. Ask your admin.";
  if (/fetch|network/i.test(m)) return 'No internet connection. Please try again.';
  return m;
}

/* ================= Shell ================= */
function navHTML() {
  const links = ['today', 'leads', 'calls', 'pipeline', 'companies', 'followups', 'reports'];
  const adm = ['team', 'settings'];
  const a = k => `<a href="#${k}" data-nav="${k}" class="${S.route === k ? 'on' : ''}"><span>${ROUTES[k]}</span><span class="count" data-count="${k}" hidden></span></a>`;
  return `<nav class="nav">${links.map(a).join('')}${isAdmin() ? `<div class="eyebrow nav-label">Admin</div>${adm.map(a).join('')}` : ''}</nav>`;
}
function renderShell() {
  document.title = 'AAS BD Desk';
  shownRoute = null;
  root().innerHTML = `<div class="app">
    <aside class="rail">
      <div class="brand">${wordmark()}</div>
      ${navHTML()}
      <div class="me">
        <div class="who">${ICON.user.replace('<svg', '<svg width="16" height="16"')}<strong>${esc(S.me.full_name || S.me.email)}</strong><span class="role">${isAdmin() ? 'Admin' : 'User'}</span></div>
        <div class="sync wait" id="sync">Connecting…</div>
        <div class="row"><button class="btn sm" data-act="password">Change password</button><button class="btn sm ghost" data-act="signout">Sign out</button></div>
      </div>
    </aside>
    <div class="main">
      <div class="mobile-head"><div class="top">${wordmark()}<button class="btn sm" data-act="account">${esc(firstName(S.me.full_name) || 'Account')}</button></div>${navHTML()}</div>
      <header class="topbar">
        <h1 id="vt"></h1><div class="spacer"></div>
        <div class="search">${ICON.search}<input type="search" id="gs" placeholder="Search company, person or number" autocomplete="off"><div class="search-results" id="gs-res" hidden></div></div>
        <button class="btn primary" data-act="log">${ICON.plus}Log a call</button>
      </header>
      <main class="view" id="view"><div class="loading">Loading…</div></main>
    </div>
  </div><div id="layer"></div>`;
  wireSearch();
  renderSync();
}
function renderSync() {
  const el = $('#sync'); if (!el) return;
  el.className = 'sync ' + (S.sync === 'live' ? '' : S.sync);
  el.textContent = S.sync === 'live' ? 'Live · changes show instantly' : S.sync === 'off' ? 'Offline · refresh to update' : 'Connecting…';
}

let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
let shownRoute = null;
function render() {
  if (!S.me || !$('#view')) return;
  if (!S.loaded) return;
  const v = VIEWS[S.route];
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === S.route));
  $('#vt').textContent = ROUTES[S.route];
  if (shownRoute !== S.route) { $('#view').innerHTML = v.shell ? v.shell() : '<div id="vb"></div>'; shownRoute = S.route; v.wire?.(); }
  v.body();
  updateCounts();
  if (S.drawerId) renderDrawer(); else if (S.leadId) renderLeadDrawer();
}
function updateCounts() {
  const t = today(); let over = 0, due = 0;
  for (const c of S.companies.values()) if (c.next_follow_up) { if (c.next_follow_up < t) over++; else if (c.next_follow_up === t) due++; }
  $$('[data-count="followups"]').forEach(el => { el.hidden = !(over + due); el.textContent = over + due; el.classList.toggle('alert', over > 0); });
  const n = [...S.acts.values()].filter(a => a.call_date === t).length;
  $$('[data-count="calls"]').forEach(el => { el.hidden = !n; el.textContent = n; });
  const idx = coByNorm(); let fresh = 0;
  for (const l of S.leads.values()) if (leadState(l, idx).k === 'new') fresh++;
  $$('[data-count="leads"]').forEach(el => { el.hidden = !fresh; el.textContent = fresh; });
}
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (!S.me) return;
  if (ROUTES[h] && (!ADMIN_ROUTES.has(h) || isAdmin())) { S.route = h; render(); window.scrollTo(0, 0); }
});

/* ---------- global search ---------- */
function wireSearch() {
  const inp = $('#gs'), res = $('#gs-res');
  let hits = [], hl = 0;
  const draw = () => {
    const q = inp.value.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
    if (!q) { res.hidden = true; return; }
    hits = [...S.companies.values()].filter(c => {
      if (c.name.toLowerCase().includes(q) || norm(c.name).includes(norm(q))) return true;
      return (c.contacts || []).some(p => (p.name || '').toLowerCase().includes(q) || (qd.length >= 4 && String(p.phone || '').replace(/\D/g, '').includes(qd)));
    }).slice(0, 8);
    hl = 0;
    res.innerHTML = hits.length ? hits.map((c, i) => `<button class="${i === hl ? 'hl' : ''}" data-act="open" data-id="${c.id}"><div><strong>${esc(c.name)}</strong></div><div class="small muted">${esc((c.contacts || []).map(p => p.name).filter(Boolean).join(', ') || STG[c.stage]?.label || '')}</div></button>`).join('')
      : `<div class="empty small">No match. <button class="btn sm" data-act="newco" data-name="${esc(inp.value.trim())}">Add “${esc(inp.value.trim())}”</button></div>`;
    res.hidden = false;
  };
  inp.addEventListener('input', draw);
  inp.addEventListener('focus', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { inp.value = ''; res.hidden = true; inp.blur(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(hits.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); $$('button', res).forEach((b, i) => b.classList.toggle('hl', i === hl)); }
    if (e.key === 'Enter' && hits[hl]) { openDrawer(hits[hl].id); inp.value = ''; res.hidden = true; inp.blur(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) res.hidden = true; });
}

/* ================= Views ================= */
const VIEWS = {};

/* ---------- Today ---------- */
VIEWS.today = {
  body() {
    const t = today(), wk = weekStart(t), wkEnd = addDays(wk, 6);
    const acts = [...S.acts.values()];
    const todays = acts.filter(a => a.call_date === t).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const mine = isAdmin() ? todays : todays.filter(a => a.by_id === meId());
    const weekN = acts.filter(a => a.call_date >= wk && a.call_date <= wkEnd).length;
    const tgt = S.settings.daily_target || 10;
    const wkTgt = tgt * workdaysIn(wk, wkEnd);
    const cos = [...S.companies.values()];
    const over = cos.filter(c => c.next_follow_up && c.next_follow_up < t).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up));
    const due = cos.filter(c => c.next_follow_up === t).sort((a, b) => String(a.next_follow_up_time || '').localeCompare(String(b.next_follow_up_time || '')));
    const mtgs = cos.filter(c => c.meeting_date && c.meeting_date >= t).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    const pct = (n, d) => d ? Math.min(100, Math.round(n / d * 100)) : 0;
    const la = lastActsMap();
    $('#view').innerHTML = `
      <div><div class="eyebrow">${esc(fDay(t))}</div><h2 style="margin-top:4px">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${esc(firstName(S.me.full_name) || 'there')}</h2></div>
      <div class="stats">
        <div class="stat"><span class="eyebrow">Calls today</span><span class="v">${todays.length}<small> / ${tgt}</small></span><div class="meter"><i style="width:${pct(todays.length, tgt)}%"></i></div></div>
        <div class="stat"><span class="eyebrow">This week</span><span class="v">${weekN}<small> / ${wkTgt}</small></span><div class="meter"><i style="width:${pct(weekN, wkTgt)}%"></i></div></div>
        <div class="stat"><span class="eyebrow">Follow-ups today</span><span class="v">${due.length}</span><span class="small muted">${due.length ? 'Due before end of day' : 'Nothing due'}</span></div>
        <div class="stat"><span class="eyebrow">Overdue</span><span class="v ${over.length ? 'alert' : ''}">${over.length}</span><span class="small muted">${over.length ? 'Missed follow-up dates' : 'All caught up'}</span></div>
        <div class="stat"><span class="eyebrow">Meetings ahead</span><span class="v">${mtgs.length}</span><span class="small muted">${mtgs[0] ? 'Next: ' + esc(fShort(mtgs[0].meeting_date)) : 'None fixed'}</span></div>
      </div>
      <div class="cols">
        <div class="stack">
          <section class="panel"><div class="ph"><h2>Follow-ups due</h2><a class="btn sm ghost" href="#followups">All follow-ups</a></div>
            <div class="pb flush list">${[...over, ...due].length ? [...over, ...due].map(c => fuRow(c, la.get(c.id))).join('')
              : `<div class="empty"><strong>No follow-ups due today</strong><span>Call backs you schedule while logging calls appear here on the day.</span></div>`}</div></section>
        </div>
        <div class="stack">
          ${leadsTodayPanel()}
          <section class="panel"><div class="ph"><h2>Upcoming meetings</h2></div>
            <div class="pb flush list">${mtgs.length ? mtgs.slice(0, 6).map(c => `<div class="li"><span class="t" data-act="open" data-id="${c.id}">${esc(c.name)}</span><div class="r">${dueHTML(c.meeting_date, c.meeting_time)}</div><span class="s">${esc(primaryContact(c)?.name || '')}</span></div>`).join('')
              : `<div class="empty"><span>No meetings fixed yet. Pick “Meeting scheduled” when logging a call to add one.</span></div>`}</div></section>
          <section class="panel"><div class="ph"><h2>${isAdmin() ? 'Logged today' : 'Your calls today'}</h2><span class="muted small">${plural(mine.length, 'call')}</span></div>
            <div class="pb flush list">${mine.length ? mine.map(a => { const c = S.companies.get(a.company_id); return `<div class="li"><span class="t" data-act="open" data-id="${a.company_id}">${esc(c?.name || 'Company')}</span><div class="r">${chip(a.outcome)}</div><span class="s">${esc([a.person, isAdmin() ? byName(a) : ''].filter(Boolean).join(' · '))}</span></div>`; }).join('')
              : `<div class="empty"><strong>No calls logged yet today</strong><button class="btn primary sm" data-act="log">${ICON.plus}Log a call</button></div>`}</div></section>
        </div>
      </div>`;
  },
};
function fuRow(c, last) {
  const p = primaryContact(c);
  return `<div class="li">
    <span class="t" data-act="open" data-id="${c.id}">${esc(c.name)}</span>
    <div class="r">${dueHTML(c.next_follow_up, c.next_follow_up_time)}
      <button class="btn sm" data-act="log" data-co="${c.id}">Log call</button>
      <button class="btn sm ghost" data-act="snooze" data-id="${c.id}" title="Move to next working day">+1 day</button>
      <button class="btn sm ghost" data-act="fudone" data-id="${c.id}" title="Clear this follow-up">Done</button></div>
    <span class="s">${stageChip(c.stage)} ${p ? esc(p.name) + (p.designation ? ', ' + esc(p.designation) : '') : ''} ${p?.phone ? phoneHTML(p.phone) : ''}</span>
    ${c.follow_up_note || last?.remarks ? `<div class="rem">${esc(c.follow_up_note || last.remarks)}</div>` : ''}
  </div>`;
}

/* ---------- Call log ---------- */
function callRange() {
  const u = UI.calls, t = today();
  if (u.range === 'today') return [t, t];
  if (u.range === 'week') return [weekStart(t), addDays(weekStart(t), 6)];
  if (u.range === 'lastweek') { const s = addDays(weekStart(t), -7); return [s, addDays(s, 6)]; }
  if (u.range === 'month') return [monthStart(t), monthEnd(t)];
  if (u.range === 'custom') return [u.from || '0000-01-01', u.to || '9999-12-31'];
  return ['0000-01-01', '9999-12-31'];
}
function filteredCalls() {
  const [from, to] = callRange(); const u = UI.calls; const q = u.q.trim().toLowerCase();
  return [...S.acts.values()].filter(a => a.call_date >= from && a.call_date <= to
    && (!u.outcome || a.outcome === u.outcome)
    && (!u.by || byName(a) === u.by)
    && (!q || [S.companies.get(a.company_id)?.name, a.person, a.remarks, a.phone, a.designation].some(x => String(x || '').toLowerCase().includes(q))))
    .sort((a, b) => a.call_date.localeCompare(b.call_date) || String(a.created_at).localeCompare(String(b.created_at)));
}
function peopleNames() {
  const s = new Set([...S.profiles.values()].filter(p => p.active).map(p => p.full_name).filter(Boolean));
  for (const a of S.acts.values()) s.add(byName(a));
  s.delete('—'); return [...s].sort();
}
VIEWS.calls = {
  shell() {
    const u = UI.calls;
    const seg = [['today', 'Today'], ['week', 'This week'], ['lastweek', 'Last week'], ['month', 'This month'], ['all', 'All'], ['custom', 'Dates']];
    return `<div class="filters">
      <div class="seg" role="group" aria-label="Period">${seg.map(([k, l]) => `<button data-act="cr" data-k="${k}" class="${u.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span id="cr-dates" ${u.range === 'custom' ? '' : 'hidden'} class="row"><input type="date" id="cr-from" value="${u.from}" aria-label="From"><input type="date" id="cr-to" value="${u.to}" aria-label="To"></span>
      <select id="cr-out" aria-label="Status"><option value="">All statuses</option>${OUTCOMES.map(o => `<option value="${o.k}" ${u.outcome === o.k ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
      <select id="cr-by" aria-label="Logged by"><option value="">Everyone</option>${peopleNames().map(n => `<option ${u.by === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <input type="search" id="cr-q" placeholder="Filter by company, person, remark" value="${esc(u.q)}" style="width:min(260px,100%)">
      <span class="spacer" style="flex:1"></span>
      ${isAdmin() ? '<button class="btn" data-act="export-calls">Export CSV</button>' : ''}
    </div><div id="vb" class="stack"></div>`;
  },
  wire() {
    const u = UI.calls;
    $('#cr-from').addEventListener('change', e => { u.from = e.target.value; this.body(); });
    $('#cr-to').addEventListener('change', e => { u.to = e.target.value; this.body(); });
    $('#cr-out').addEventListener('change', e => { u.outcome = e.target.value; this.body(); });
    $('#cr-by').addEventListener('change', e => { u.by = e.target.value; this.body(); });
    $('#cr-q').addEventListener('input', debounce(e => { u.q = e.target.value; this.body(); }, 150));
  },
  body() {
    const rows = filteredCalls();
    const n = k => rows.filter(a => a.outcome === k).length;
    const conn = rows.filter(a => !NOT_CONNECTED.has(a.outcome)).length;
    const days = new Map(); rows.forEach(a => { if (!days.has(a.call_date)) days.set(a.call_date, []); days.get(a.call_date).push(a); });
    let i = 0;
    $('#vb').innerHTML = `
      <div class="row small"><strong>${plural(rows.length, 'call')}</strong><span class="muted">·</span><span>${conn} connected</span><span class="muted">·</span><span>${n('callback')} call backs</span><span class="muted">·</span><span>${n('opportunity')} opportunities</span><span class="muted">·</span><span>${n('mtg_sched') + n('mtg_done')} meetings</span></div>
      <section class="panel"><div class="pb flush tablewrap">${rows.length ? `<table class="t">
        <thead><tr><th class="n">#</th><th>Company</th><th>Person</th><th>Designation</th><th>Contact number</th><th>Status</th><th>Remarks / next step</th><th>Follow-up</th><th>By</th></tr></thead>
        <tbody>${[...days.entries()].map(([d, list]) => `<tr class="day"><td colspan="9">${esc(fDay(d))} · ${plural(list.length, 'call')}</td></tr>` + list.map(a => {
          const c = S.companies.get(a.company_id); i++;
          return `<tr class="click" data-act="${canEditAct(a) ? 'editcall' : 'open'}" data-id="${canEditAct(a) ? a.id : a.company_id}">
            <td class="n muted">${i}</td><td class="co">${esc(c?.name || '—')}</td><td>${esc(a.person || '')}</td><td>${esc(a.designation || '')}</td>
            <td>${phoneHTML(a.phone)}</td><td>${chip(a.outcome)}</td><td class="rem">${esc(a.remarks || '')}${a.profile_shared ? `<div class="small muted">Profile shared ${esc(SHARED[a.profile_shared]?.toLowerCase() || '')}</div>` : ''}</td>
            <td>${a.follow_up ? `<span class="small">${esc(fShort(a.follow_up))}${a.follow_up_time ? ', ' + esc(a.follow_up_time) : ''}</span>` : ''}</td><td class="small">${esc(byName(a))}</td></tr>`;
        }).join('')).join('')}</tbody></table>`
        : `<div class="empty"><strong>No calls in this period</strong><span>Change the period above, or log a call.</span></div>`}</div></section>`;
  },
};

/* ---------- Pipeline ---------- */
VIEWS.pipeline = {
  shell() {
    return `<div class="filters"><input type="search" id="pl-q" placeholder="Filter companies" value="${esc(UI.pipeline.q)}" style="width:min(280px,100%)">
      <span class="muted small">Drag a card to another column to change its stage. Tap a card for details.</span></div><div id="vb"></div>`;
  },
  wire() { $('#pl-q').addEventListener('input', debounce(e => { UI.pipeline.q = e.target.value; this.body(); }, 150)); },
  body() {
    const q = UI.pipeline.q.trim().toLowerCase(); const la = lastActsMap();
    const cos = [...S.companies.values()].filter(c => !q || c.name.toLowerCase().includes(q));
    const by = k => cos.filter(c => (c.stage || 'new') === k).sort((a, b) => String(la.get(b.id)?.call_date || b.created_at).localeCompare(String(la.get(a.id)?.call_date || a.created_at)));
    const card = c => { const last = la.get(c.id); const p = primaryContact(c);
      return `<div class="card" draggable="true" data-drag="${c.id}" data-act="open" data-id="${c.id}">
        <div class="nm">${esc(c.name)}</div>
        <div class="meta"><span>${esc(p?.name || '')}</span>${c.next_follow_up ? dueHTML(c.next_follow_up, c.next_follow_up_time) : ''}</div>
        ${c.requirement ? `<div class="meta"><span class="chip plain tone-grey">${esc(c.requirement)}${c.amount_cr ? ' · ₹' + esc(c.amount_cr) + ' Cr' : ''}</span></div>` : ''}
        ${last?.remarks ? `<div class="last">${esc(last.remarks)}</div>` : ''}</div>`; };
    const open = STAGES.filter(s => !s.closed);
    const closed = STAGES.filter(s => s.closed);
    $('#vb').innerHTML = `<div class="board">${open.map(s => { const l = by(s.k);
      return `<div class="lane" data-drop="${s.k}"><div class="lh">${stageChip(s.k)}<span class="muted small num">${l.length}</span></div><div class="cards">${l.map(card).join('')}</div></div>`; }).join('')}
      <div class="lane">${closed.map(s => { const l = by(s.k);
        return `<div class="sublane" data-drop="${s.k}"><div class="lh">${stageChip(s.k)}<span class="muted small num">${l.length}</span></div><div class="cards">${l.slice(0, 30).map(card).join('')}${l.length > 30 ? `<div class="small muted">+${l.length - 30} more in Companies</div>` : ''}</div></div>`; }).join('')}</div>
    </div>`;
    $$('[data-drag]').forEach(el => el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.dataset.drag); e.dataTransfer.effectAllowed = 'move'; }));
    $$('[data-drop]').forEach(el => {
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', async e => {
        e.preventDefault(); el.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain'); const c = S.companies.get(id);
        if (!c || c.stage === el.dataset.drop) return;
        try { await patchCompany(id, { stage: el.dataset.drop }); toast(`${c.name} moved to ${STG[el.dataset.drop].label}`); } catch (err) { fail(err); }
      });
    });
  },
};

/* ---------- Companies ---------- */
VIEWS.companies = {
  shell() {
    const u = UI.companies;
    return `<div class="filters">
      <input type="search" id="co-q" placeholder="Filter by name, person, city" value="${esc(u.q)}" style="width:min(260px,100%)">
      <select id="co-stage" aria-label="Stage"><option value="">All stages</option>${STAGES.map(s => `<option value="${s.k}" ${u.stage === s.k ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      <select id="co-src" aria-label="Source"><option value="">All sources</option>${SOURCES.map(s => `<option ${u.source === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select id="co-sort" aria-label="Sort"><option value="recent">Recently contacted</option><option value="name">Name A–Z</option><option value="due">Next follow-up</option><option value="calls">Most calls</option></select>
      <span style="flex:1"></span>
      ${isAdmin() ? '<button class="btn" data-act="export-cos">Export CSV</button>' : ''}
      <button class="btn" data-act="newco">${ICON.plus}Add company</button>
    </div><div id="vb"></div>`;
  },
  wire() {
    const u = UI.companies;
    $('#co-sort').value = u.sort;
    $('#co-q').addEventListener('input', debounce(e => { u.q = e.target.value; this.body(); }, 150));
    $('#co-stage').addEventListener('change', e => { u.stage = e.target.value; this.body(); });
    $('#co-src').addEventListener('change', e => { u.source = e.target.value; this.body(); });
    $('#co-sort').addEventListener('change', e => { u.sort = e.target.value; this.body(); });
  },
  body() {
    const u = UI.companies; const q = u.q.trim().toLowerCase();
    const la = lastActsMap(); const cc = callCount();
    let rows = [...S.companies.values()].filter(c => (!u.stage || c.stage === u.stage) && (!u.source || c.source === u.source)
      && (!q || [c.name, c.city, c.sector, ...(c.contacts || []).map(p => p.name + ' ' + p.phone)].some(x => String(x || '').toLowerCase().includes(q))));
    const key = c => la.get(c.id)?.call_date || String(c.created_at).slice(0, 10);
    if (u.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (u.sort === 'due') rows.sort((a, b) => (a.next_follow_up || '9999').localeCompare(b.next_follow_up || '9999'));
    else if (u.sort === 'calls') rows.sort((a, b) => (cc.get(b.id) || 0) - (cc.get(a.id) || 0));
    else rows.sort((a, b) => key(b).localeCompare(key(a)));
    $('#vb').innerHTML = `<section class="panel"><div class="ph"><span class="small"><strong>${plural(rows.length, 'company', 'companies')}</strong></span></div><div class="pb flush tablewrap">${rows.length ? `<table class="t">
      <thead><tr><th>Company</th><th>Stage</th><th>Contact</th><th>Requirement</th><th>Last call</th><th>Next follow-up</th><th class="n">Calls</th><th>Source</th></tr></thead>
      <tbody>${rows.map(c => { const l = la.get(c.id); const p = primaryContact(c);
        return `<tr class="click" data-act="open" data-id="${c.id}"><td class="co">${esc(c.name)}${c.city ? `<div class="small muted">${esc(c.city)}</div>` : ''}</td><td>${stageChip(c.stage)}</td>
          <td>${esc(p?.name || '')}${p?.designation ? `<div class="small muted">${esc(p.designation)}</div>` : ''}${(c.contacts || []).filter(x => x.name || x.phone).length > 1 ? `<div class="small muted">+${(c.contacts || []).filter(x => x.name || x.phone).length - 1} more</div>` : ''}</td>
          <td>${esc(c.requirement || '')}${c.amount_cr ? `<div class="small muted">₹${esc(c.amount_cr)} Cr</div>` : ''}</td>
          <td>${l ? `<span class="small">${esc(fShort(l.call_date))}</span><div>${chip(l.outcome)}</div>` : '<span class="small muted">Not called</span>'}</td>
          <td>${dueHTML(c.next_follow_up, c.next_follow_up_time)}</td><td class="n">${cc.get(c.id) || 0}</td><td class="small">${esc(c.source || '')}</td></tr>`; }).join('')}</tbody></table>`
      : `<div class="empty"><strong>No companies match</strong><span>Clear the filters, or add a company.</span></div>`}</div></section>`;
  },
};

/* ---------- Follow-ups ---------- */
VIEWS.followups = {
  body() {
    const t = today(); const la = lastActsMap(); const wkEnd = addDays(t, 7);
    const cos = [...S.companies.values()];
    const withDate = cos.filter(c => c.next_follow_up).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up) || String(a.next_follow_up_time || '').localeCompare(String(b.next_follow_up_time || '')));
    const groups = [
      ['Overdue', withDate.filter(c => c.next_follow_up < t)],
      ['Today', withDate.filter(c => c.next_follow_up === t)],
      ['Tomorrow', withDate.filter(c => c.next_follow_up === addDays(t, 1))],
      ['Next 7 days', withDate.filter(c => c.next_follow_up > addDays(t, 1) && c.next_follow_up <= wkEnd)],
      ['Later', withDate.filter(c => c.next_follow_up > wkEnd)],
    ];
    const noDate = cos.filter(c => !c.next_follow_up && ['callback', 'opportunity', 'opp_rating', 'mtg_done', 'docs', 'proposal', 'attempting'].includes(c.stage))
      .sort((a, b) => String(la.get(b.id)?.call_date || '').localeCompare(String(la.get(a.id)?.call_date || '')));
    const mtgs = cos.filter(c => c.meeting_date && c.meeting_date >= t).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    $('#view').innerHTML = `
      ${mtgs.length ? `<section class="panel"><div class="ph"><h2>Meetings</h2><span class="muted small">${plural(mtgs.length, 'meeting')} ahead</span></div><div class="pb flush list">${mtgs.map(c => `<div class="li"><span class="t" data-act="open" data-id="${c.id}">${esc(c.name)}</span><div class="r">${dueHTML(c.meeting_date, c.meeting_time)}</div><span class="s">${esc(primaryContact(c)?.name || '')}</span></div>`).join('')}</div></section>` : ''}
      <section class="panel"><div class="ph"><h2>Scheduled follow-ups</h2><span class="muted small">${plural(withDate.length, 'company', 'companies')}</span></div>
        <div class="pb flush">${withDate.length ? groups.filter(g => g[1].length).map(([h, l]) => `<div class="group-h"><span>${h}</span><span class="muted num">${l.length}</span></div><div class="list">${l.map(c => fuRow(c, la.get(c.id))).join('')}</div>`).join('')
          : `<div class="empty"><strong>No follow-ups scheduled</strong><span>Set a follow-up date when you log a call.</span></div>`}</div></section>
      <section class="panel"><div class="ph"><div><h2>Open leads with no follow-up date</h2><div class="small muted" style="margin-top:2px">Call backs and live leads where no date was fixed. Give each a date so it doesn't slip.</div></div><span class="muted small">${noDate.length}</span></div>
        <div class="pb flush list">${noDate.length ? noDate.map(c => { const l = la.get(c.id); const p = primaryContact(c);
          return `<div class="li"><span class="t" data-act="open" data-id="${c.id}">${esc(c.name)}</span>
            <div class="r"><button class="btn sm" data-act="log" data-co="${c.id}">Log call</button><button class="btn sm ghost" data-act="settom" data-id="${c.id}">Set for tomorrow</button></div>
            <span class="s">${stageChip(c.stage)} ${esc(p?.name || '')} ${l ? '· last call ' + esc(fShort(l.call_date)) : ''}</span>${l?.remarks ? `<div class="rem">${esc(l.remarks)}</div>` : ''}</div>`; }).join('')
          : '<div class="empty"><span>Every open lead has a date.</span></div>'}</div></section>`;
  },
};

/* ---------- Reports ---------- */
function repRange() {
  const r = UI.reports;
  if (r.mode === 'month') return [monthStart(r.anchor), monthEnd(r.anchor)];
  const s = weekStart(r.anchor); return [s, addDays(s, 6)];
}
const REP_COLS = [
  ['Calls', a => true], ['Connected', a => !NOT_CONNECTED.has(a.outcome)], ['Call back', a => a.outcome === 'callback'],
  ['Funding opp.', a => a.outcome === 'opportunity'], ['Rating opp.', a => a.outcome === 'opp_rating'], ['Mtg sched.', a => a.outcome === 'mtg_sched'], ['Mtg done', a => a.outcome === 'mtg_done'],
  ['Docs awaited', a => a.outcome === 'docs'], ['Proposal', a => a.outcome === 'proposal'], ['Mandate', a => a.outcome === 'won'],
  ['No req.', a => a.outcome === 'no_req'], ['Not interested', a => a.outcome === 'not_interested'], ['Not reached', a => NOT_CONNECTED.has(a.outcome)],
  ['Profile shared', a => !!a.profile_shared],
];
function reportData() {
  const [from, to] = repRange(); const by = UI.reports.by;
  const rows = [...S.acts.values()].filter(a => a.call_date >= from && a.call_date <= to && (!by || byName(a) === by));
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d) || rows.some(a => a.call_date === d)) days.push(d);
  const wd = workdaysIn(from, to); const target = wd * (S.settings.daily_target || 10);
  return { from, to, rows, days, wd, target };
}
VIEWS.reports = {
  shell() {
    const r = UI.reports;
    return `<div class="filters">
      <div class="seg"><button data-act="rm" data-k="week" class="${r.mode === 'week' ? 'on' : ''}">Week</button><button data-act="rm" data-k="month" class="${r.mode === 'month' ? 'on' : ''}">Month</button></div>
      <button class="iconbtn" data-act="rp" data-k="-1" title="Previous">${ICON.left}</button><strong id="rp-label" class="num"></strong><button class="iconbtn" data-act="rp" data-k="1" title="Next">${ICON.right}</button>
      <button class="btn sm ghost" data-act="rp" data-k="0">Current</button>
      <select id="rp-by" aria-label="Person"><option value="">Whole team</option>${peopleNames().map(n => `<option ${r.by === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <span style="flex:1"></span><button class="btn" data-act="copysum">Copy summary for WhatsApp</button>
    </div><div id="vb" class="stack"></div>`;
  },
  wire() { $('#rp-by').addEventListener('change', e => { UI.reports.by = e.target.value; this.body(); }); },
  body() {
    const { from, to, rows, days, target } = reportData(); const tgt = S.settings.daily_target || 10;
    $('#rp-label').textContent = UI.reports.mode === 'month' ? fmt(from, { month: 'long', year: 'numeric' }) : `${fShort(from)} – ${fMed(addDays(from, 4))}`;
    const cnt = f => rows.filter(f).length;
    const conn = cnt(a => !NOT_CONNECTED.has(a.outcome)), pos = cnt(a => POSITIVE.has(a.outcome));
    const ms = cnt(a => a.outcome === 'mtg_sched'), md = cnt(a => a.outcome === 'mtg_done'), pw = cnt(a => ['proposal', 'won'].includes(a.outcome));
    const pctOf = (n, d) => d ? Math.round(n / d * 100) + '%' : '—';
    const maxDay = Math.max(tgt, ...days.map(d => rows.filter(a => a.call_date === d).length), 1);
    const la = lastActsMap();
    const watch = [...new Set(rows.filter(a => POSITIVE.has(a.outcome)).map(a => a.company_id))].map(id => S.companies.get(id)).filter(Boolean);
    const people = new Map(); rows.forEach(a => { const n = byName(a); people.set(n, [...(people.get(n) || []), a]); });
    $('#vb').innerHTML = `
      <div class="funnel">
        <div><span class="eyebrow">Calls</span><span class="v">${rows.length}</span><span class="p">Target ${target} · ${pctOf(rows.length, target)}</span></div>
        <div><span class="eyebrow">Connected</span><span class="v">${conn}</span><span class="p">${pctOf(conn, rows.length)} of calls</span></div>
        <div><span class="eyebrow">Positive</span><span class="v">${pos}</span><span class="p">${pctOf(pos, conn)} of connected</span></div>
        <div><span class="eyebrow">Meetings fixed</span><span class="v">${ms}</span><span class="p">${pctOf(ms, conn)} of connected</span></div>
        <div><span class="eyebrow">Meetings done</span><span class="v">${md}</span><span class="p">in this period</span></div>
        <div><span class="eyebrow">Proposals · mandates</span><span class="v">${pw}</span><span class="p">${cnt(a => a.outcome === 'won')} mandates</span></div>
      </div>
      <section class="panel"><div class="ph"><h2>Calls per day</h2><span class="muted small">Dashed line: daily target of ${tgt}</span></div>
        <div class="pb"><div class="daychart">${days.map(d => { const n = rows.filter(a => a.call_date === d).length;
          return `<div class="col"><div class="b ${n >= tgt ? 'met' : ''}" style="height:${Math.round(n / maxDay * 110)}px"><span>${n}</span></div><span class="lbl">${UI.reports.mode === 'month' ? D(d).getDate() : DOW[dow(d)]}</span></div>`; }).join('')}
          <div class="target" style="bottom:${Math.round(tgt / maxDay * 110) + 24}px"><em>${tgt}</em></div></div></div></section>
      <section class="panel"><div class="ph"><h2>Day-wise summary</h2><span class="muted small">Same counts as the old Weekly Summary sheet</span></div>
        <div class="pb flush tablewrap"><table class="t"><thead><tr><th>Day</th>${REP_COLS.map(c => `<th class="n">${c[0]}</th>`).join('')}</tr></thead>
        <tbody>${days.map(d => { const dr = rows.filter(a => a.call_date === d); return `<tr><td class="num">${esc(fWk(d))}</td>${REP_COLS.map(c => `<td class="n">${dr.filter(c[1]).length || '<span class="muted">0</span>'}</td>`).join('')}</tr>`; }).join('')}
        <tr class="tot"><td>Total</td>${REP_COLS.map(c => `<td class="n">${rows.filter(c[1]).length}</td>`).join('')}</tr>
        <tr><td>Target (${tgt}/day)</td><td class="n">${target}</td><td colspan="${REP_COLS.length - 1}" class="small muted">${plural(reportData().wd, 'working day')}</td></tr>
        <tr><td>Achievement</td><td class="n"><strong>${pctOf(rows.length, target)}</strong></td><td colspan="${REP_COLS.length - 1}"></td></tr></tbody></table></div></section>
      <div class="cols">
        <section class="panel"><div class="ph"><h2>Positive leads this ${UI.reports.mode}</h2><span class="muted small">${watch.length}</span></div>
          <div class="pb flush list">${watch.length ? watch.map(c => { const l = la.get(c.id); return `<div class="li"><span class="t" data-act="open" data-id="${c.id}">${esc(c.name)}</span><div class="r">${stageChip(c.stage)}</div><span class="s">${c.next_follow_up ? 'Next: ' + dueHTML(c.next_follow_up, c.next_follow_up_time) : 'No follow-up date'}</span>${l?.remarks ? `<div class="rem">${esc(l.remarks)}</div>` : ''}</div>`; }).join('')
            : '<div class="empty"><span>No positive conversations in this period yet.</span></div>'}</div></section>
        <div class="stack">
          <section class="panel"><div class="ph"><h2>Outcome mix</h2></div><div class="pb bars">${OUTCOMES.map(o => { const n = cnt(a => a.outcome === o.k);
            return `<div class="bar tone-${o.tone}"><span>${o.label}</span><div class="track"><div class="fill" style="width:${rows.length ? n / rows.length * 100 : 0}%;background:var(--c)"></div></div><span class="n">${n}</span></div>`; }).join('')}</div></section>
          ${people.size > 1 ? `<section class="panel"><div class="ph"><h2>By person</h2></div><div class="pb flush tablewrap"><table class="t"><thead><tr><th>Person</th><th class="n">Calls</th><th class="n">Connected</th><th class="n">Positive</th><th class="n">Meetings</th></tr></thead><tbody>${[...people.entries()].map(([n, l]) => `<tr><td>${esc(n)}</td><td class="n">${l.length}</td><td class="n">${l.filter(a => !NOT_CONNECTED.has(a.outcome)).length}</td><td class="n">${l.filter(a => POSITIVE.has(a.outcome)).length}</td><td class="n">${l.filter(a => ['mtg_sched', 'mtg_done'].includes(a.outcome)).length}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        </div>
      </div>`;
  },
};
function summaryText() {
  const { from, to, rows, target } = reportData();
  const c = k => rows.filter(a => a.outcome === k).length;
  const label = UI.reports.mode === 'month' ? fmt(from, { month: 'long', year: 'numeric' }) : `${fShort(from)} to ${fMed(addDays(from, 4))}`;
  const t = today();
  const mt = [...S.companies.values()].filter(x => x.meeting_date && x.meeting_date >= t).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const lines = [
    `*AAS BD update, ${label}*${UI.reports.by ? ' (' + UI.reports.by + ')' : ''}`,
    `Calls: ${rows.length} of ${target} target (${target ? Math.round(rows.length / target * 100) : 0}%)`,
    `Connected: ${rows.filter(a => !NOT_CONNECTED.has(a.outcome)).length}`,
    `Call backs: ${c('callback')}`,
    `Opportunities: ${c('opportunity')} funding, ${c('opp_rating')} rating`,
    `Meetings scheduled: ${c('mtg_sched')}, Meetings done: ${c('mtg_done')}`,
    `Proposals sent: ${c('proposal')}, Mandates: ${c('won')}`,
    `No requirement: ${c('no_req')}, Not interested: ${c('not_interested')}`,
    `Company profile shared: ${rows.filter(a => a.profile_shared).length}`,
  ];
  if (mt.length) { lines.push('', '*Upcoming meetings*'); mt.slice(0, 8).forEach(x => lines.push(`- ${x.name}, ${fShort(x.meeting_date)}${x.meeting_time ? ' ' + x.meeting_time : ''}`)); }
  return lines.join('\n');
}

/* ---------- Team (admin) ---------- */
VIEWS.team = {
  body() {
    const ps = [...S.profiles.values()].sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || String(a.full_name).localeCompare(String(b.full_name)));
    $('#view').innerHTML = `
      <div class="row"><p class="muted" style="margin:0;flex:1;min-width:240px">Each person signs in with their own email and password. Admins can manage logins, settings and data, and delete records. Users log calls and work the pipeline.</p>
        <button class="btn primary" data-act="newuser">${ICON.plus}Add login</button></div>
      <section class="panel"><div class="pb flush tablewrap"><table class="t">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="n">Calls logged</th><th></th></tr></thead>
        <tbody>${ps.map(p => `<tr><td><strong>${esc(p.full_name || '—')}</strong>${p.id === meId() ? ' <span class="small muted">(you)</span>' : ''}</td><td>${esc(p.email || '')}</td>
          <td>${p.role === 'admin' ? '<span class="chip plain tone-indigo">Admin</span>' : '<span class="chip plain tone-grey">User</span>'}</td>
          <td>${p.active ? '<span class="chip tone-green">Active</span>' : '<span class="chip tone-red">Switched off</span>'}</td>
          <td class="n">${[...S.acts.values()].filter(a => a.by_id === p.id).length}</td>
          <td class="n"><button class="btn sm" data-act="edituser" data-id="${p.id}">Manage</button></td></tr>`).join('')}</tbody></table></div></section>
      <p class="small muted">Lost password? Open Manage and set a new one, then share it with the person. They can change it after signing in.</p>`;
  },
};

/* ---------- Settings & data (admin) ---------- */
VIEWS.settings = {
  shell() {
    const s = S.settings;
    return `<div class="cols">
      <div class="stack">
        <section class="panel"><div class="ph"><h2>Targets and working days</h2></div><div class="pb stack" style="gap:14px">
          <label class="f">Daily call target<input type="number" min="1" max="200" id="st-target" value="${s.daily_target}" style="max-width:140px"></label>
          <div class="f" style="display:grid;gap:6px"><span class="small" style="font-weight:500">Working days</span><div class="row">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="row small" style="gap:4px"><input type="checkbox" class="st-wd" value="${d}" ${(s.workdays || []).includes(d) ? 'checked' : ''}>${DOW[d]}</label>`).join('')}</div></div>
          <label class="f"><span>Holidays <span class="hint">One date per line (e.g. 10-11-2026). Not counted towards target.</span></span><textarea id="st-hol" rows="4">${(s.holidays || []).map(h => D(h).toLocaleDateString('en-GB').replace(/\//g, '-')).join('\n')}</textarea></label>
          <div><button class="btn primary" data-act="savesettings">Save settings</button></div>
        </div></section>
        <section class="panel"><div class="ph"><h2>Export</h2></div><div class="pb row">
          <button class="btn" data-act="export-calls-all">All calls (CSV)</button><button class="btn" data-act="export-cos">All companies (CSV)</button>
          <span class="small muted">Opens in Excel or Google Sheets.</span></div></section>
        <section class="panel"><div class="ph"><h2>Status guide</h2></div><div class="pb flush"><table class="t"><tbody>${OUTCOMES.map(o => `<tr><td>${chip(o.k)}</td><td class="small">${esc(GUIDE[o.k])}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <section class="panel"><div class="ph"><h2>Import from Google Sheets</h2></div><div class="pb stack" style="gap:12px">
        <div class="seg"><button data-act="impmode" data-k="calls" class="on">Call log</button><button data-act="impmode" data-k="leads">Lead list</button></div>
        <p class="small muted" id="imp-help" style="margin:0"></p>
        <label class="f">Paste rows here, including the header row<textarea id="imp-text" rows="9" placeholder="Select the cells in Google Sheets, copy, and paste here"></textarea></label>
        <label class="f" id="imp-by-wrap">Logged by<select id="imp-by">${peopleNames().map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
        <div class="row"><button class="btn" data-act="imppreview">Check rows</button><button class="btn primary" data-act="impgo" id="imp-go" disabled>Import</button></div>
        <div id="imp-out"></div>
      </div></section>
    </div>`;
  },
  wire() { setImpMode('calls'); },
  body() { /* static form; nothing live to refresh */ },
};
let IMP = { mode: 'calls', parsed: null };
function setImpMode(m) {
  IMP = { mode: m, parsed: null };
  $$('[data-act="impmode"]').forEach(b => b.classList.toggle('on', b.dataset.k === m));
  $('#imp-help').textContent = m === 'calls'
    ? 'Columns read: Date, Name of Company, Name of Person, Designation, Contact Number, Status Update, Remarks. Day-header rows and blank rows are skipped. Calls already in the CRM are skipped.'
    : 'Columns read: Company, Person, Designation, Phone, City, Sector, Source. Each company is added as a New lead. Companies already in the CRM are skipped.';
  $('#imp-by-wrap').hidden = m !== 'calls';
  $('#imp-out').innerHTML = ''; $('#imp-go').disabled = true;
}


/* ================= Leads ================= */
const LEAD_POSITIVE = new Set(['opportunity', 'opp_rating', 'mtg_sched', 'mtg_done', 'docs', 'proposal', 'won']);
function coByNorm() { const m = new Map(); for (const c of S.companies.values()) m.set(norm(c.name), c); return m; }
function leadCompany(l, idx) { if (!l) return null; return (l.company_id && S.companies.get(l.company_id)) || (idx || coByNorm()).get(norm(l.name)) || null; }
function leadState(l, idx) {
  const b = S.batches.get(l.batch_id); const since = b?.provided_on || '0000-00-00';
  const c = leadCompany(l, idx);
  const acts = c ? actsFor(c.id).filter(a => a.call_date >= since) : [];
  if (l.dropped) return { k: 'dropped', c, acts };
  if (!acts.length) return { k: 'new', c, acts };
  const last = acts[0], first = acts[acts.length - 1];
  return { k: LEAD_POSITIVE.has(last.outcome) ? 'positive' : 'called', c, acts, last, first };
}
function batchStats(bid, idx) {
  const ls = [...S.leads.values()].filter(l => l.batch_id === bid);
  const st = { total: ls.length, new: 0, called: 0, positive: 0, dropped: 0 };
  ls.forEach(l => { const k = leadState(l, idx).k; st[k]++; });
  st.reached = st.called + st.positive;
  st.open = st.total - st.dropped;
  return st;
}
const sortedBatches = () => [...S.batches.values()].sort((a, b) => String(b.provided_on).localeCompare(String(a.provided_on)) || String(b.created_at).localeCompare(String(a.created_at)));
const ago = d => { const n = diffDays(d, today()); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
const priChip = p => p ? `<span class="pri pri-${esc(String(p).toUpperCase())}" title="Priority ${esc(p)}">${esc(p)}</span>` : '';
const crore = v => (v === null || v === undefined || v === '') ? '' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
function leadStatusHTML(st, small = true) {
  if (st.k === 'dropped') return '<span class="chip plain tone-grey">Not relevant</span>';
  if (st.k === 'new') return '<span class="chip plain tone-grey">Not called</span>';
  return `${chip(st.last.outcome)}${small ? `<div class="small muted">${plural(st.acts.length, 'call')} · last ${esc(fShort(st.last.call_date))}</div>` : ''}`;
}
async function patchLead(id, patch) {
  const { data, error } = await sb.from('leads').update(patch).eq('id', id).select().single();
  if (error) throw error;
  S.leads.set(data.id, data); scheduleRender(); return data;
}
async function ensureLeadCompany(l) {
  let c = leadCompany(l);
  if (!c) {
    const lenders = [...new Set((l.facilities || []).map(f => f.lender).filter(Boolean))].join(', ');
    const notes = [l.trigger_note && ('Lead: ' + l.trigger_note), l.aas_solution && ('AAS angle: ' + l.aas_solution),
      l.project && ('Project: ' + l.project + (l.project_cr ? ` (${crore(l.project_cr)}${l.project_stage ? ', ' + l.project_stage : ''})` : ''))].filter(Boolean).join('\n');
    c = await saveCompany({ id: uuid(), name: l.name, stage: 'new', source: 'Project leads', website: l.website || null, sector: l.industry || null,
      city: l.location || null, banks: lenders || null, notes: notes || null, contacts: (l.contacts || []).filter(p => p.name || p.phone) });
  }
  if (l.company_id !== c.id) await patchLead(l.id, { company_id: c.id });
  return c;
}
function leadsTodayPanel() {
  const b = sortedBatches()[0]; if (!b) return '';
  const st = batchStats(b.id);
  const pct = st.open ? Math.round(st.reached / st.open * 100) : 0;
  return `<section class="panel"><div class="ph"><h2>Leads</h2><a class="btn sm" href="#leads">Open leads</a></div>
    <div class="pb stack" style="gap:6px"><div><strong>${esc(b.name)}</strong> <span class="small muted">· given ${esc(fShort(b.provided_on))}, ${ago(b.provided_on)}</span></div>
    <div class="small">${st.reached} of ${st.open} called · <strong>${st.new} not called yet</strong>${st.positive ? ` · ${st.positive} positive` : ''}</div>
    <div class="meter"><i style="width:${pct}%"></i></div></div></section>`;
}
VIEWS.leads = {
  shell() {
    const u = UI.leads;
    return `<div id="lb"></div>
      <div class="filters">
        <div class="seg" role="group" aria-label="Priority">${[['', 'All'], ['A', 'A'], ['B', 'B'], ['C', 'C']].map(([k, l]) => `<button data-act="lpri" data-k="${k}" class="${u.pri === k ? 'on' : ''}">${k ? 'Priority ' + l : l}</button>`).join('')}</div>
        <select id="ld-st" aria-label="Status"><option value="">All open leads</option><option value="new">Not called</option><option value="called">Called</option><option value="positive">Positive</option><option value="dropped">Not relevant (hidden)</option></select>
        <input type="search" id="ld-q" placeholder="Filter by company, place, person" value="${esc(u.q)}" style="width:min(260px,100%)">
        <span style="flex:1"></span>
        ${isAdmin() ? `<button class="btn primary" data-act="uploadleads">${ICON.plus}Upload leads Excel</button>` : ''}
      </div><div id="vb"></div>`;
  },
  wire() {
    $('#ld-st').value = UI.leads.status;
    $('#ld-st').addEventListener('change', e => { UI.leads.status = e.target.value; this.body(); });
    $('#ld-q').addEventListener('input', debounce(e => { UI.leads.q = e.target.value; this.body(); }, 150));
  },
  body() {
    const u = UI.leads; const idx = coByNorm();
    const bs = sortedBatches();
    if (S.leadsMissing) {
      $('#lb').innerHTML = ''; $('#vb').innerHTML = `<div class="banner">The Leads section isn't set up in the database yet. ${isAdmin() ? 'Run <code>supabase/03_leads.sql</code> in the Supabase SQL Editor, then refresh.' : 'Please tell Vivek.'}</div>`; return;
    }
    if (!bs.length) {
      $('#lb').innerHTML = '';
      $('#vb').innerHTML = `<section class="panel"><div class="empty"><strong>No leads yet</strong><span>${isAdmin() ? 'Upload a leads Excel and it will show here as a batch, with the date it was given.' : 'When Vivek uploads a leads list, it will show here.'}</span>${isAdmin() ? `<button class="btn primary" data-act="uploadleads">${ICON.plus}Upload leads Excel</button>` : ''}</div></section>`;
      return;
    }
    if (!u.batch || !S.batches.has(u.batch)) u.batch = bs[0].id;
    $('#lb').innerHTML = `<div class="batches">${bs.map(b => { const st = batchStats(b.id, idx); const pct = st.open ? Math.round(st.reached / st.open * 100) : 0;
      return `<button class="batch ${b.id === u.batch ? 'on' : ''}" data-act="batch" data-id="${b.id}">
        <span class="eyebrow">Given ${esc(fMed(b.provided_on))} · ${ago(b.provided_on)}</span>
        <strong>${esc(b.name)}</strong>
        <span class="small">${st.reached} of ${st.open} called · ${st.new} not called${st.positive ? ` · ${st.positive} positive` : ''}${st.dropped ? ` · ${st.dropped} not relevant` : ''}</span>
        <span class="meter"><i style="width:${pct}%"></i></span></button>`; }).join('')}</div>`;
    const b = S.batches.get(u.batch); const q = u.q.trim().toLowerCase();
    let rows = [...S.leads.values()].filter(l => l.batch_id === b.id).map(l => ({ l, st: leadState(l, idx) }));
    rows = rows.filter(({ l, st }) => (!u.pri || String(l.priority || '').toUpperCase() === u.pri)
      && (u.status ? (st.k === u.status || (u.status === 'called' && st.k === 'positive')) : st.k !== 'dropped')
      && (!q || [l.name, l.location, l.industry, l.project, ...(l.contacts || []).map(p => p.name + ' ' + p.phone)].some(x => String(x || '').toLowerCase().includes(q))));
    rows.sort((a, b2) => String(a.l.priority || 'Z').localeCompare(String(b2.l.priority || 'Z')) || (a.l.rank ?? 9999) - (b2.l.rank ?? 9999));
    const by = b.created_by ? personName(b.created_by) : '';
    $('#vb').innerHTML = `<section class="panel"><div class="ph"><div><h2>${esc(b.name)}</h2><div class="small muted" style="margin-top:2px">Given on ${esc(fDay(b.provided_on))}${by ? ' by ' + esc(by) : ''}${b.source_file ? ' · ' + esc(b.source_file) : ''}${b.notes ? ' · ' + esc(b.notes) : ''}</div></div>
      <span class="row small"><strong>${plural(rows.length, 'lead')}</strong>${!u.status && batchStats(b.id, idx).dropped ? `<button class="btn sm ghost" data-act="showdropped">Show ${batchStats(b.id, idx).dropped} not relevant</button>` : ''}${isAdmin() ? `<span><button class="btn sm ghost danger" data-act="delbatch-ask" data-id="${b.id}">Delete batch</button></span>` : ''}</span></div>
      <div class="pb flush tablewrap">${rows.length ? `<table class="t"><thead><tr><th class="n">#</th><th>Pri.</th><th>Company</th><th>Project</th><th>Contact</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(({ l, st }) => { const p = (l.contacts || []).find(x => x.phone) || (l.contacts || [])[0];
        return `<tr class="click" data-act="openlead" data-id="${l.id}"><td class="n muted">${esc(l.rank ?? '')}</td><td>${priChip(l.priority)}</td>
          <td class="co">${esc(l.name)}<div class="small muted">${esc([l.location, l.industry].filter(Boolean).join(' · '))}</div></td>
          <td>${l.project_cr ? `<strong class="num">${crore(l.project_cr)}</strong>` : ''}<div class="small muted">${esc(l.project_stage || '')}</div></td>
          <td>${p ? `${esc(p.name || '')}${p.designation ? `<div class="small muted">${esc(p.designation)}</div>` : ''}${p.phone ? `<div class="small">${phoneHTML(p.phone)}</div>` : '<div class="small muted">No number</div>'}` : '<span class="small muted">No contact</span>'}</td>
          <td>${leadStatusHTML(st)}</td>
          <td class="n">${st.k === 'dropped' ? '' : `<button class="btn sm" data-act="leadlog" data-id="${l.id}">Log call</button>`}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty"><strong>No leads match</strong><span>Change the filters above.</span></div>'}</div></section>`;
  },
};
function openLead(id) { S.drawerId = null; S.leadId = id; renderLeadDrawer(); }
function renderLeadDrawer() {
  const l = S.leads.get(S.leadId); if (!l) { closeDrawer(); return; }
  const b = S.batches.get(l.batch_id); const st = leadState(l);
  let dr = $('#drawer');
  if (!dr) { $('#layer').insertAdjacentHTML('beforeend', '<div class="scrim" id="drawer-scrim" data-act="closedrawer"></div><aside class="drawer" id="drawer" role="dialog" aria-modal="true"></aside>'); dr = $('#drawer'); }
  const kv = (k, v) => v === null || v === undefined || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;
  const fac = l.facilities || [];
  const facTot = fac.reduce((s2, f) => s2 + (Number(f.cr) || 0), 0);
  dr.innerHTML = `<div class="dh">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><div class="eyebrow">${l.priority ? 'Priority ' + esc(l.priority) + ' lead · ' : 'Lead · '}${esc(b?.name || '')}</div><h2 style="font-size:20px;margin-top:2px">${esc(l.name)}</h2></div>
        <button class="iconbtn" data-act="closedrawer" title="Close">${ICON.close}</button></div>
      <div class="row">
        ${st.k === 'dropped' ? `<button class="btn sm" data-act="leadrestore" data-id="${l.id}">Restore lead</button>` : `<button class="btn primary sm" data-act="leadlog" data-id="${l.id}">${ICON.plus}Log call</button>`}
        ${st.c ? `<button class="btn sm" data-act="leadco" data-id="${l.id}">Open company page</button>` : ''}
        ${st.k === 'dropped' ? '' : `<button class="btn sm ghost" data-act="leaddrop" data-id="${l.id}">Not relevant</button>`}
        <span id="ld-del"><button class="btn sm ghost danger" data-act="leaddel-ask" data-id="${l.id}">Delete lead</button></span>
      </div></div>
    <div class="db">
      <div class="followbox"><div><div class="eyebrow">Status</div><div style="margin-top:4px">${leadStatusHTML(st, false)}
        <span class="small muted">${st.k === 'new' ? `Given ${esc(fShort(b?.provided_on))}, ${ago(b?.provided_on)}. Not called yet.` : st.k === 'dropped' ? 'Marked not relevant.' : `${plural(st.acts.length, 'call')} since ${esc(fShort(b?.provided_on))}. First call ${esc(fShort(st.first.call_date))} (${diffDays(b.provided_on, st.first.call_date)} days after it was given).`}</span></div>
        ${st.last?.remarks ? `<div class="small" style="margin-top:6px">${esc(st.last.remarks)}</div>` : ''}</div></div>
      ${l.trigger_note ? `<section><h3 style="margin-bottom:4px">Why this lead</h3><p style="margin:0">${esc(l.trigger_note)}</p></section>` : ''}
      ${l.aas_solution ? `<section><h3 style="margin-bottom:4px">How AAS can help</h3><p style="margin:0">${esc(l.aas_solution)}</p></section>` : ''}
      <section><h3 style="margin-bottom:4px">Contacts</h3>${(l.contacts || []).length ? l.contacts.map(p => `<div class="contact"><div><strong>${esc(p.name || 'Unnamed')}</strong>${p.designation ? ` <span class="muted small">${esc(p.designation)}</span>` : ''}</div><div></div>
        <div class="small">${phoneHTML(p.phone)} ${p.email ? `<span class="phone"><span>${esc(p.email)}</span><button class="iconbtn" data-act="copy" data-text="${esc(p.email)}" title="Copy email">${ICON.copy}</button></span>` : ''}</div></div>`).join('') : '<p class="muted small">No contact given.</p>'}
        ${l.phone_gap ? `<div class="note warn" style="margin-top:6px">Number issue: ${esc(l.phone_gap)}</div>` : ''}</section>
      <section><h3 style="margin-bottom:8px">Project and company</h3><dl class="kv">
        ${kv('Project', esc(l.project))}${kv('Project size', crore(l.project_cr))}${kv('Project stage', esc(l.project_stage))}${kv('Rating', esc(l.rating))}
        ${kv('Turnover', crore(l.turnover_cr))}${kv('Bank limits', crore(l.bank_limits_cr))}${kv('Untied limits', crore(l.untied_cr))}
        ${kv('Ownership', esc(l.ownership))}${kv('Industry', esc(l.industry))}${kv('Location', esc(l.location))}
        ${kv('Website', l.website ? `<a href="${esc(/^https?:/.test(l.website) ? l.website : 'https://' + l.website)}" target="_blank" rel="noopener">${esc(l.website)}</a>` : '')}
        ${kv('MD / head', esc(l.md))}${kv('CFO', esc(l.cfo))}${kv('Notes', esc(l.notes))}
      </dl></section>
      ${fac.length ? `<section><h3 style="margin-bottom:6px">Existing bank facilities <span class="muted small">${crore(facTot)} total</span></h3><div class="tablewrap"><table class="t"><thead><tr><th>Facility</th><th class="n">₹ Cr</th><th>Lender</th><th>Status</th></tr></thead><tbody>
        ${fac.map(f => `<tr><td>${esc(f.facility || '')}</td><td class="n num">${esc(f.cr ?? '')}</td><td>${esc(f.lender || '')}</td><td class="small">${esc(f.status || '')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    </div>`;
}

/* ---------- Upload leads Excel (admin) ---------- */
async function loadXLSX() {
  if (window.XLSX) return;
  await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Could not load the Excel reader. Check your internet and try again.')); document.head.appendChild(sc); });
}
const hk = h => String(h ?? '').toLowerCase().replace(/₹/g, ' ').replace(/[^a-z0-9#]+/g, ' ').trim();
const cellStr = v => { if (v === null || v === undefined) return null; const t = String(v).trim(); return (!t || t === '-' || t === '—') ? null : t; };
const cellNum = v => { if (typeof v === 'number') return v; const t = cellStr(v); if (!t) return null; const n = parseFloat(t.replace(/,/g, '')); return isNaN(n) ? null : n; };
function headerIdx(rows) { return rows.findIndex(r => (r || []).some(c => ['company', 'company name', 'name of company'].includes(hk(c)))); }
function colFinder(head) {
  const H = head.map(hk);
  return (...names) => { for (const n of names) { const i = H.indexOf(n); if (i >= 0) return i; } for (const n of names) { const i = H.findIndex(h => h.startsWith(n)); if (i >= 0) return i; } return -1; };
}
function parseLeadsWorkbook(wb) {
  let main = null, facs = null, gaps = null;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const hi = headerIdx(rows); if (hi < 0) continue;
    const H = rows[hi].map(hk);
    const sheet = { name, head: rows[hi], rows: rows.slice(hi + 1) };
    if (H.includes('facility') && H.includes('lender')) facs = facs || sheet;
    else if (H.includes('gap')) gaps = gaps || sheet;
    else main = main || sheet;
  }
  if (!main) throw new Error('No sheet with a “Company” column was found in this file.');
  const c = colFinder(main.head); const g = (r, i) => i >= 0 ? r[i] : null;
  const C = { rank: c('#', 's no', 'sr no', 'sl no', 'no'), pri: c('priority'), name: c('company', 'company name', 'name of company'), web: c('website'),
    own: c('ownership'), ind: c('industry', 'sector'), loc: c('location', 'city'), proj: c('project', 'project name'), pcr: c('project cr', 'project size', 'project amount', 'project cost'),
    stage: c('stage', 'project stage'), rating: c('rating'), lim: c('bank limits cr', 'bank limits'), untied: c('untied cr', 'untied'), turn: c('turnover cr', 'turnover'),
    md: c('md head', 'md'), cfo: c('cfo'), c1: c('contact 1', 'contact person', 'contact', 'name of person'), d1: c('designation 1', 'designation'),
    p1: c('phone 1', 'phone', 'mobile', 'contact number'), e1: c('email 1', 'email'), c2: c('contact 2'), d2: c('designation 2'), p2: c('phone 2'), e2: c('email 2'),
    trig: c('lead trigger', 'trigger'), sol: c('aas solution', 'solution'), notes: c('notes', 'remarks') };
  if (C.proj === C.pcr) C.proj = -1;
  const keyOf = (rank, name) => rank != null ? 'r' + rank : 'n' + norm(name);
  const facMap = new Map();
  if (facs) { const f = colFinder(facs.head); const F = { rank: f('#'), name: f('company'), fac: f('facility'), cr: f('cr', 'amount'), lender: f('lender', 'bank'), status: f('status') };
    facs.rows.forEach(r => { const nm = cellStr(g(r, F.name)); if (!nm) return; const item = { facility: cellStr(g(r, F.fac)), cr: cellNum(g(r, F.cr)), lender: cellStr(g(r, F.lender)), status: cellStr(g(r, F.status)) };
      [keyOf(cellNum(g(r, F.rank)), nm), 'n' + norm(nm)].forEach(k => { if (!facMap.has(k)) facMap.set(k, []); facMap.get(k).push(item); }); }); }
  const gapMap = new Map();
  if (gaps) { const f = colFinder(gaps.head); const G = { rank: f('#'), name: f('company'), gap: f('gap') };
    gaps.rows.forEach(r => { const nm = cellStr(g(r, G.name)); const gp = cellStr(g(r, G.gap)); if (!nm || !gp) return; gapMap.set(keyOf(cellNum(g(r, G.rank)), nm), gp); gapMap.set('n' + norm(nm), gp); }); }
  const leads = [];
  main.rows.forEach(r => {
    const name = cellStr(g(r, C.name)); if (!name) return;
    const rank = cellNum(g(r, C.rank));
    const contacts = [[C.c1, C.d1, C.p1, C.e1], [C.c2, C.d2, C.p2, C.e2]].map(([a, d, p, e]) => ({ name: cellStr(g(r, a)) || '', designation: cellStr(g(r, d)) || '', phone: cellStr(g(r, p)) || '', email: cellStr(g(r, e)) || '' })).filter(p => p.name || p.phone);
    const md = cellStr(g(r, C.md)), cfo = cellStr(g(r, C.cfo));
    [[md, 'MD / head'], [cfo, 'CFO']].forEach(([n, d]) => { if (n && !contacts.some(p => norm(p.name) === norm(n))) contacts.push({ name: n, designation: d, phone: '', email: '' }); });
    const k = keyOf(rank, name);
    leads.push({ rank: rank != null ? Math.round(rank) : null, priority: cellStr(g(r, C.pri)), name, website: cellStr(g(r, C.web)), ownership: cellStr(g(r, C.own)),
      industry: cellStr(g(r, C.ind)), location: cellStr(g(r, C.loc)), project: cellStr(g(r, C.proj)), project_cr: cellNum(g(r, C.pcr)), project_stage: cellStr(g(r, C.stage)),
      rating: cellStr(g(r, C.rating)), bank_limits_cr: cellNum(g(r, C.lim)), untied_cr: cellNum(g(r, C.untied)), turnover_cr: cellNum(g(r, C.turn)), md, cfo, contacts,
      trigger_note: cellStr(g(r, C.trig)), aas_solution: cellStr(g(r, C.sol)), notes: cellStr(g(r, C.notes)),
      phone_gap: gapMap.get(k) || gapMap.get('n' + norm(name)) || null, facilities: facMap.get(k) || facMap.get('n' + norm(name)) || [] });
  });
  return { leads, sheets: { main: main.name, facilities: facs?.name, gaps: gaps?.name } };
}
function openLeadUpload() {
  let parsed = null, fileName = '';
  openModal(`<div class="mh"><h2>Upload leads Excel</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <form class="mb" id="up-form" autocomplete="off">
      <label class="f">Excel file<input type="file" id="up-file" accept=".xlsx,.xls,.csv"></label>
      <div class="grid2"><label class="f">Batch name<input type="text" id="up-name" placeholder="e.g. Maharashtra project leads"></label>
        <label class="f">Given to Shweta on<input type="date" id="up-date" value="${today()}"></label></div>
      <label class="f"><span>Note <span class="hint">(optional)</span></span><input type="text" id="up-notes" placeholder="e.g. Start with priority A"></label>
      <div id="up-out" class="small muted">Pick the file. BD Desk reads the main sheet, plus a Facilities sheet and a Mobile needed sheet if the file has them.</div>
      <div class="err" id="up-err"></div>
    </form>
    <div class="mf"><button class="btn" data-act="closemodal">Cancel</button><button class="btn primary" id="up-go" disabled>Upload leads</button></div>`, m => {
    $('#up-file', m).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return; fileName = f.name;
      $('#up-err', m).textContent = ''; $('#up-out', m).textContent = 'Reading the file…'; $('#up-go', m).disabled = true;
      try {
        await loadXLSX();
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        parsed = parseLeadsWorkbook(wb);
        if (!$('#up-name', m).value) $('#up-name', m).value = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
        const L = parsed.leads; const idx = coByNorm();
        const pc = k => L.filter(l => String(l.priority || '').toUpperCase() === k).length;
        const inCrm = L.filter(l => idx.has(norm(l.name)));
        $('#up-out', m).innerHTML = `<div class="note"><strong>${plural(L.length, 'lead')}</strong> found in “${esc(parsed.sheets.main)}”.
          ${pc('A') + pc('B') + pc('C') ? ` Priority A ${pc('A')}, B ${pc('B')}, C ${pc('C')}.` : ''}
          ${L.filter(l => l.contacts.some(p => p.phone)).length} have a phone number.
          ${parsed.sheets.facilities ? ` Bank facilities read from “${esc(parsed.sheets.facilities)}”.` : ''}
          ${parsed.sheets.gaps ? ` Number gaps read from “${esc(parsed.sheets.gaps)}”.` : ''}
          ${inCrm.length ? `<br>${plural(inCrm.length, 'company is', 'companies are')} already in BD Desk and will be linked: ${inCrm.slice(0, 5).map(l => esc(l.name)).join(', ')}${inCrm.length > 5 ? '…' : ''}` : ''}</div>`;
        $('#up-go', m).disabled = !L.length;
      } catch (err) { parsed = null; $('#up-out', m).textContent = ''; $('#up-err', m).textContent = friendlyErr(err); }
    });
    $('#up-go', m).addEventListener('click', async () => {
      const name = $('#up-name', m).value.trim(), date = $('#up-date', m).value;
      if (!parsed) return; if (!name) { $('#up-err', m).textContent = 'Give this batch a name.'; return; }
      if (!date) { $('#up-err', m).textContent = 'Pick the date it was given.'; return; }
      const btn = $('#up-go', m); btn.disabled = true; btn.textContent = 'Uploading…';
      try {
        const idx = coByNorm(); const bid = uuid();
        const { data: batch, error } = await sb.from('lead_batches').insert({ id: bid, name, provided_on: date, source_file: fileName, notes: $('#up-notes', m).value.trim() || null }).select().single();
        if (error) throw error;
        S.batches.set(batch.id, batch);
        const rows = parsed.leads.map(l => ({ ...l, id: uuid(), batch_id: bid, company_id: idx.get(norm(l.name))?.id || null }));
        for (let i = 0; i < rows.length; i += 100) {
          const { data, error: e2 } = await sb.from('leads').insert(rows.slice(i, i + 100)).select();
          if (e2) throw e2; data.forEach(r => S.leads.set(r.id, r));
        }
        UI.leads.batch = bid; closeModal(); toast(`${plural(rows.length, 'lead')} uploaded`);
        if (S.route !== 'leads') location.hash = 'leads'; else scheduleRender();
      } catch (err) { $('#up-err', m).textContent = friendlyErr(err); btn.disabled = false; btn.textContent = 'Upload leads'; }
    });
  });
}

/* ================= Drawer (company detail) ================= */
function openDrawer(id) { S.leadId = null; S.drawerId = id; renderDrawer(); }
function closeDrawer() { S.drawerId = null; S.leadId = null; $('#drawer')?.remove(); $('#drawer-scrim')?.remove(); }
function renderDrawer() {
  const c = S.companies.get(S.drawerId);
  if (!c) { closeDrawer(); return; }
  const layer = $('#layer');
  let dr = $('#drawer');
  const scroll = dr ? $('.db', dr).scrollTop : 0;
  const confirmDel = dr?.dataset.confirm === '1';
  if (!dr) {
    layer.insertAdjacentHTML('beforeend', '<div class="scrim" id="drawer-scrim" data-act="closedrawer"></div><aside class="drawer" id="drawer" role="dialog" aria-modal="true"></aside>');
    dr = $('#drawer');
  }
  const acts = actsFor(c.id); const t = today();
  const fu = c.next_follow_up;
  dr.innerHTML = `<div class="dh">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><div class="eyebrow">${esc(c.source || 'Company')}${c.city ? ' · ' + esc(c.city) : ''}</div><h2 style="font-size:20px;margin-top:2px">${esc(c.name)}</h2></div>
        <button class="iconbtn" data-act="closedrawer" title="Close">${ICON.close}</button></div>
      <div class="row">
        <select id="dr-stage" aria-label="Stage" style="width:auto">${STAGES.map(s => `<option value="${s.k}" ${c.stage === s.k ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
        <button class="btn primary sm" data-act="log" data-co="${c.id}">${ICON.plus}Log call</button>
        <button class="btn sm" data-act="editco" data-id="${c.id}">${ICON.edit}Edit details</button>
        ${isAdmin() ? `<button class="btn sm ghost danger" data-act="delco-ask">Delete</button>` : ''}
      </div>
      ${confirmDel ? `<div class="note warn row" style="justify-content:space-between">Delete ${esc(c.name)} and its ${plural(acts.length, 'call')}? This can't be undone.<span class="row"><button class="btn sm danger solid" data-act="delco" data-id="${c.id}">Delete</button><button class="btn sm" data-act="delco-cancel">Cancel</button></span></div>` : ''}
    </div>
    <div class="db">
      <div class="followbox">
        <div><div class="eyebrow">Next follow-up</div><div style="margin-top:2px">${fu ? dueHTML(fu, c.next_follow_up_time) + (c.follow_up_note ? ` <span class="small muted">· ${esc(c.follow_up_note)}</span>` : '') : '<span class="muted">None set</span>'}</div></div>
        <div class="row">${fu ? `<button class="btn sm ghost" data-act="snooze" data-id="${c.id}">+1 day</button><button class="btn sm ghost" data-act="fudone" data-id="${c.id}">Clear</button>` : ''}
          <input type="date" id="dr-fu" value="${fu || ''}" aria-label="Set follow-up date" style="width:auto"></div>
      </div>
      ${c.meeting_date ? `<div class="followbox"><div><div class="eyebrow">Meeting</div><div style="margin-top:2px">${c.meeting_date < t ? `<span class="due over">${esc(fMed(c.meeting_date))}, past. Log how it went.</span>` : dueHTML(c.meeting_date, c.meeting_time)}</div></div><button class="btn sm ghost" data-act="mtgclear" data-id="${c.id}">Remove</button></div>` : ''}
      <section><h3 style="margin-bottom:8px">Details</h3><dl class="kv">
        <dt>Requirement</dt><dd>${esc(c.requirement || '—')}${c.amount_cr ? ` · ₹${esc(c.amount_cr)} Cr` : ''}</dd>
        <dt>Existing bankers</dt><dd>${esc(c.banks || '—')}</dd>
        <dt>Sector</dt><dd>${esc(c.sector || '—')}</dd>
        <dt>Website</dt><dd>${c.website ? `<a href="${esc(/^https?:/.test(c.website) ? c.website : 'https://' + c.website)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : '—'}</dd>
        <dt>Notes</dt><dd style="white-space:pre-wrap">${esc(c.notes || '—')}</dd>
        <dt>Added</dt><dd>${esc(fMed(String(c.created_at).slice(0, 10)))}${c.created_by ? ' by ' + esc(personName(c.created_by)) : ''}</dd>
      </dl></section>
      <section><h3 style="margin-bottom:4px">Contacts</h3>${(c.contacts || []).length ? (c.contacts || []).map(p => `<div class="contact"><div><strong>${esc(p.name || 'Unnamed')}</strong>${p.designation ? ` <span class="muted small">${esc(p.designation)}</span>` : ''}</div><div></div>
        <div class="small">${phoneHTML(p.phone)} ${p.email ? `<span class="phone"><span>${esc(p.email)}</span><button class="iconbtn" data-act="copy" data-text="${esc(p.email)}" title="Copy email">${ICON.copy}</button></span>` : ''}</div></div>`).join('')
        : '<p class="muted small">No contacts yet. Add one with Edit details, or by logging a call.</p>'}</section>
      <section><h3 style="margin-bottom:4px">History <span class="muted small">${plural(acts.length, 'call')}</span></h3><div class="timeline">${acts.length ? acts.map(a => `<div class="tl"><div class="d">${esc(fMed(a.call_date))}</div><div class="b">
        <div class="row" style="gap:6px">${chip(a.outcome)}<span class="small">${esc(a.person || '')}</span><span class="small muted">· ${esc(byName(a))}</span>${canEditAct(a) ? `<button class="iconbtn" data-act="editcall" data-id="${a.id}" title="Edit this call">${ICON.edit}</button>` : ''}</div>
        ${a.remarks ? `<div style="white-space:pre-wrap">${esc(a.remarks)}</div>` : ''}
        <div class="small muted">${[a.profile_shared ? 'Profile shared ' + SHARED[a.profile_shared]?.toLowerCase() : '', a.follow_up ? 'Follow-up ' + fShort(a.follow_up) + (a.follow_up_time ? ' ' + a.follow_up_time : '') : ''].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')
        : '<p class="muted small">No calls logged yet.</p>'}</div></section>
    </div>`;
  dr.dataset.confirm = confirmDel ? '1' : '';
  $('.db', dr).scrollTop = scroll;
  $('#dr-stage').addEventListener('change', async e => { try { await patchCompany(c.id, { stage: e.target.value }); toast('Stage updated'); } catch (err) { fail(err); } });
  $('#dr-fu').addEventListener('change', async e => { try { await patchCompany(c.id, { next_follow_up: e.target.value || null }); toast(e.target.value ? 'Follow-up set' : 'Follow-up cleared'); } catch (err) { fail(err); } });
}

/* ================= Modals ================= */
function openModal(html, onMount) {
  closeModal();
  $('#layer').insertAdjacentHTML('beforeend', `<div class="modal-wrap" id="modal"><div class="scrim" data-act="closemodal"></div><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`);
  onMount?.($('#modal .modal'));
}
function closeModal() { $('#modal')?.remove(); }
const quickDates = target => {
  const t = today(); const nextMon = addDays(weekStart(t), 7);
  return `<div class="quick">${[['Tomorrow', addDays(t, 1)], ['In 2 days', addDays(t, 2)], ['Next Mon', nextMon], ['1 week', addDays(t, 7)], ['1 month', addMonths(t, 1)], ['3 months', addMonths(t, 3)]]
    .map(([l, d]) => `<button type="button" data-qd="${target}" data-d="${d}">${l}</button>`).join('')}</div>`;
};

/* ---------- Log / edit call ---------- */
let curActId = null;
function currentActId() { return curActId; }
function openLog({ companyId = null, actId = null } = {}) {
  curActId = actId;
  const a = actId ? S.acts.get(actId) : null;
  const cid = a ? a.company_id : companyId;
  const c = cid ? S.companies.get(cid) : null;
  const M = { companyId: cid, outcome: a?.outcome || '', actId };
  const last = c ? lastAct(c.id) : null;
  let lastBy = ''; try { lastBy = localStorage.getItem('aas.by') || ''; } catch (e) { /* ignore */ }
  openModal(`<div class="mh"><h2>${a ? 'Edit call' : 'Log a call'}</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <form class="mb" id="lc-form" autocomplete="off">
      <div class="grid3">
        <label class="f" style="grid-column:span 2">Company
          <div class="ac"><input type="text" id="lc-co" value="${esc(c?.name || '')}" ${a ? 'disabled' : ''} placeholder="Start typing a company name" required><div class="ac-list" id="lc-co-list" hidden></div></div>
          <span id="lc-co-note" class="small muted"></span></label>
        <label class="f">Date<input type="date" id="lc-date" value="${a?.call_date || today()}" required></label>
      </div>
      <div class="grid3">
        <label class="f">Person spoken to<input type="text" id="lc-person" value="${esc(a?.person || '')}"></label>
        <label class="f">Designation<input type="text" id="lc-desig" value="${esc(a?.designation || '')}"></label>
        <label class="f">Contact number<input type="text" id="lc-phone" value="${esc(a?.phone || '')}" placeholder="98xxxxxxxx / 022-xxxxxxxx"></label>
      </div>
      <div id="lc-pick-wrap" class="f" style="display:grid;gap:6px" hidden><span class="small" style="font-weight:500">Saved persons at this company <span class="hint">(click to fill)</span></span><div class="pickers" id="lc-pick"></div>
        <div id="lc-newp" class="newperson" hidden>
          <div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr))">
            <label class="f">Name<input type="text" id="np-name"></label><label class="f">Designation<input type="text" id="np-desig"></label>
            <label class="f">Phone<input type="text" id="np-phone"></label><label class="f">Email<input type="email" id="np-email"></label></div>
          <div class="row"><button type="button" class="btn sm primary" id="np-save">Save person</button><button type="button" class="btn sm" id="np-cancel">Cancel</button><span class="err" id="np-err"></span></div>
        </div></div>
      <div class="f" style="display:grid;gap:6px"><span class="small" style="font-weight:500">Status</span>
        <div class="outcomes" id="lc-outs">${OUTCOMES.map(o => `<button type="button" data-o="${o.k}" class="tone-${o.tone} ${M.outcome === o.k ? 'on' : ''}" title="${esc(GUIDE[o.k])}">${o.label}</button>`).join('')}</div></div>
      <label class="f">Remarks / next step<textarea id="lc-rem" rows="3" placeholder="What was said, what happens next">${esc(a?.remarks || '')}</textarea></label>
      <div id="lc-mtg" class="grid3" hidden>
        <label class="f">Meeting date<input type="date" id="lc-mdate" value="${c?.meeting_date || ''}"></label>
        <label class="f">Meeting time<input type="time" id="lc-mtime" value="${esc(c?.meeting_time || '')}"></label>
      </div>
      <div class="grid3">
        <label class="f"><span id="lc-fu-label">Follow-up date</span><input type="date" id="lc-fu" value="${a?.follow_up || ''}"></label>
        <label class="f"><span>Time <span class="hint">(optional)</span></span><input type="time" id="lc-fut" value="${esc(/^\d\d:\d\d$/.test(a?.follow_up_time || '') ? a.follow_up_time : '')}"></label>
        <label class="f">Company profile shared<select id="lc-shared">${Object.entries(SHARED).map(([k, l]) => `<option value="${k}" ${(a?.profile_shared || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      ${quickDates('lc-fu')}
      <details class="more"><summary>Requirement${isAdmin() ? ' and logged by' : ''}</summary>
        <div class="grid3">
          <label class="f">Requirement<select id="lc-req"><option value="">—</option>${REQS.map(r => `<option ${c?.requirement === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="f">Amount (₹ Cr)<input type="number" step="0.01" min="0" id="lc-amt" value="${c?.amount_cr ?? ''}"></label>
          <label class="f" ${isAdmin() ? '' : 'hidden'}>Logged by<select id="lc-by">${peopleNames().map(n => `<option ${(a ? byName(a) : (lastBy || S.me.full_name)) === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        </div></details>
      ${last && !a ? `<div class="note"><strong>Last call ${esc(fShort(last.call_date))}:</strong> ${chip(last.outcome)} ${esc(last.remarks || '')}</div>` : ''}
      <div class="err" id="lc-err"></div>
    </form>
    <div class="mf">${a && isAdmin() ? '<span class="left" id="lc-delwrap"><button class="btn ghost danger" data-act="delcall-ask">Delete call</button></span>' : ''}
      <button class="btn" data-act="closemodal">Cancel</button>${a ? '' : '<button class="btn" id="lc-next">Save and log next</button>'}<button class="btn primary" id="lc-save">Save</button></div>`, m => {
    const coIn = $('#lc-co', m), list = $('#lc-co-list', m), note = $('#lc-co-note', m);
    const drawPick = () => {
      const co = M.companyId && S.companies.get(M.companyId);
      const list = (co?.contacts || []).filter(p => p.name || p.phone);
      $('#lc-pick-wrap', m).hidden = !co;
      const cur = norm($('#lc-person', m).value);
      $('#lc-pick', m).innerHTML = list.map((p, i) => `<button type="button" data-pc="${i}" class="${cur && norm(p.name) === cur ? 'on' : ''}"><strong>${esc(p.name || 'No name')}</strong>${p.designation ? ` <span class="muted">${esc(p.designation)}</span>` : ''}${p.phone ? ` <span class="muted">· ${esc(p.phone)}</span>` : ''}</button>`).join('')
        + `<button type="button" data-pc="new" class="newp">+ Add new person</button>`;
    };
    $('#lc-pick', m).addEventListener('click', e => {
      const bt = e.target.closest('[data-pc]'); if (!bt) return;
      const co = M.companyId && S.companies.get(M.companyId);
      const list = (co?.contacts || []).filter(p => p.name || p.phone);
      if (bt.dataset.pc === 'new') { ['name', 'desig', 'phone', 'email'].forEach(k => { $('#np-' + k, m).value = ''; }); $('#np-err', m).textContent = ''; $('#lc-newp', m).hidden = false; $('#np-name', m).focus(); return; }
      const p = list[+bt.dataset.pc];
      $('#lc-person', m).value = p.name || ''; $('#lc-desig', m).value = p.designation || ''; $('#lc-phone', m).value = p.phone || '';
      drawPick(); $('#lc-outs button', m).focus();
    });
    $('#np-cancel', m).addEventListener('click', () => { $('#lc-newp', m).hidden = true; });
    $('#np-save', m).addEventListener('click', async () => {
      const co = M.companyId && S.companies.get(M.companyId); if (!co) return;
      const p = { name: $('#np-name', m).value.trim(), designation: $('#np-desig', m).value.trim(), phone: $('#np-phone', m).value.trim(), email: $('#np-email', m).value.trim() };
      if (!p.name && !p.phone) { $('#np-err', m).textContent = 'Enter at least a name or a phone number.'; return; }
      if (p.name && (co.contacts || []).some(x => norm(x.name) === norm(p.name))) { $('#np-err', m).textContent = 'This person is already saved. Click their name above.'; return; }
      const btn = $('#np-save', m); btn.disabled = true;
      try {
        await patchCompany(co.id, { contacts: [...(co.contacts || []), p] });
        $('#lc-person', m).value = p.name; $('#lc-desig', m).value = p.designation; $('#lc-phone', m).value = p.phone;
        $('#lc-newp', m).hidden = true; drawPick(); toast(`${p.name || 'Person'} saved to ${co.name}`);
      } catch (err) { $('#np-err', m).textContent = friendlyErr(err); }
      btn.disabled = false;
    });
    $('#lc-person', m).addEventListener('input', () => drawPick());
    const fillPeople = () => {
      const co = M.companyId && S.companies.get(M.companyId);
      setTimeout(drawPick, 0);
      if (co && !a) {
        $('#lc-req', m).value = co.requirement || ''; $('#lc-amt', m).value = co.amount_cr ?? '';
        const p = primaryContact(co);
        if (p && !$('#lc-person', m).value) { $('#lc-person', m).value = p.name || ''; $('#lc-desig', m).value = p.designation || ''; $('#lc-phone', m).value = p.phone || ''; }
      }
    };
    const setNote = () => {
      const v = coIn.value.trim();
      if (M.companyId) { const co = S.companies.get(M.companyId); note.innerHTML = co ? `${stageChip(co.stage)} ${plural(actsFor(co.id).length, 'earlier call')}` : ''; }
      else note.innerHTML = v ? '<span>New company. It will be added to the CRM.</span>' : '';
    };
    let hl = 0, hits = [];
    const showList = () => {
      const v = coIn.value.trim(); const nv = norm(v);
      M.companyId = null;
      const exact = [...S.companies.values()].find(x => norm(x.name) === nv && nv);
      if (exact) M.companyId = exact.id;
      hits = v ? [...S.companies.values()].filter(x => x.name.toLowerCase().includes(v.toLowerCase()) || (nv.length > 2 && (norm(x.name).includes(nv) || nv.includes(norm(x.name))))).slice(0, 8) : [];
      hl = 0;
      list.innerHTML = hits.map((x, i) => `<button type="button" data-pick="${x.id}" class="${i === hl ? 'hl' : ''}">${esc(x.name)} <span class="small muted">${esc(STG[x.stage]?.label || '')}</span></button>`).join('');
      list.hidden = !hits.length || (hits.length === 1 && hits[0].id === M.companyId);
      setNote(); fillPeople();
    };
    const pick = id => { M.companyId = id; coIn.value = S.companies.get(id).name; list.hidden = true; setNote(); fillPeople(); $('#lc-person', m).focus(); };
    coIn.addEventListener('input', showList);
    coIn.addEventListener('keydown', e => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(hits.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); $$('button', list).forEach((b, i) => b.classList.toggle('hl', i === hl)); }
      if (e.key === 'Enter') { e.preventDefault(); if (hits[hl]) pick(hits[hl].id); }
      if (e.key === 'Escape') list.hidden = true;
    });
    list.addEventListener('mousedown', e => { const b = e.target.closest('[data-pick]'); if (b) { e.preventDefault(); pick(b.dataset.pick); } });
    coIn.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
    $('#lc-person', m).addEventListener('change', e => {
      const co = M.companyId && S.companies.get(M.companyId);
      const p = (co?.contacts || []).find(x => norm(x.name) === norm(e.target.value) && x.name);
      if (p) { $('#lc-desig', m).value = p.designation || ''; $('#lc-phone', m).value = p.phone || ''; }
    });
    const syncOutcome = () => {
      $$('#lc-outs button', m).forEach(b => b.classList.toggle('on', b.dataset.o === M.outcome));
      $('#lc-mtg', m).hidden = M.outcome !== 'mtg_sched';
      $('#lc-fu-label', m).textContent = M.outcome === 'mtg_sched' ? 'Call before meeting (optional)' : (M.outcome === 'no_req' ? 'Revisit on (optional)' : 'Follow-up date');
    };
    $('#lc-outs', m).addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; M.outcome = b.dataset.o; syncOutcome(); });
    syncOutcome(); setNote(); if (M.companyId) { const keep = $('#lc-person', m).value; fillPeople(); if (a) $('#lc-person', m).value = keep; }
    $('#lc-save', m).addEventListener('click', () => saveCall(M, m, false));
    $('#lc-next', m)?.addEventListener('click', () => saveCall(M, m, true));
    $('#lc-form', m).addEventListener('submit', e => { e.preventDefault(); saveCall(M, m, false); });
    (c ? $('#lc-person', m) : coIn).focus();
  });
}

async function saveCall(M, m, another) {
  const err = $('#lc-err', m); err.textContent = '';
  const v = id => $(id, m).value.trim();
  const name = v('#lc-co'), date = v('#lc-date');
  if (!name) { err.textContent = 'Enter the company name.'; return; }
  if (!date) { err.textContent = 'Pick the call date.'; return; }
  if (!M.outcome) { err.textContent = 'Pick a status for this call.'; return; }
  const btns = $$('.mf .btn', m.parentElement); btns.forEach(b => b.disabled = true);
  try {
    const editing = M.actId ? S.acts.get(M.actId) : null;
    let co = M.companyId ? S.companies.get(M.companyId) : [...S.companies.values()].find(x => norm(x.name) === norm(name));
    const isNew = !co;
    co = co ? JSON.parse(JSON.stringify(co)) : { id: uuid(), name, stage: 'new', contacts: [], source: 'Cold call' };
    const person = v('#lc-person'), desig = v('#lc-desig'), phone = v('#lc-phone');
    if (person || phone) {
      const ex = (co.contacts || []).find(x => person ? norm(x.name) === norm(person) && x.name : (x.phone && x.phone === phone));
      if (ex) { if (desig) ex.designation = desig; if (phone) ex.phone = phone; }
      else co.contacts = [...(co.contacts || []), { name: person, designation: desig, phone, email: '' }];
    }
    const req = v('#lc-req'), amt = v('#lc-amt');
    if (req) co.requirement = req;
    else if (M.outcome === 'opp_rating' && !co.requirement) co.requirement = 'Credit rating';
    if (amt) co.amount_cr = Number(amt);
    const fu = v('#lc-fu') || null, fut = v('#lc-fut') || null;
    const latest = lastAct(co.id);
    const isLatest = !editing || !latest || latest.id === editing.id || date >= latest.call_date;
    if (isLatest) {
      co.stage = nextStage(co.stage, M.outcome);
      co.next_follow_up = fu; co.next_follow_up_time = fut; co.follow_up_note = null;
      if (M.outcome === 'mtg_sched' && v('#lc-mdate')) { co.meeting_date = v('#lc-mdate'); co.meeting_time = v('#lc-mtime') || null; if (fu) co.follow_up_note = 'Confirm meeting on ' + fShort(co.meeting_date); }
      if (M.outcome === 'mtg_done') { co.meeting_date = null; co.meeting_time = null; }
    }
    const { created_at, updated_at, ...coRow } = co;
    await saveCompany(coRow);
    const by = (isAdmin() && v('#lc-by')) || (editing ? byName(editing) : S.me.full_name);
    try { localStorage.setItem('aas.by', by); } catch (e) { /* ignore */ }
    const byProfile = [...S.profiles.values()].find(p => p.full_name === by);
    const row = {
      id: editing?.id || uuid(), company_id: co.id, call_date: date, person, designation: desig, phone,
      outcome: M.outcome, remarks: v('#lc-rem'), profile_shared: v('#lc-shared') || null, follow_up: fu, follow_up_time: fut,
      by_id: editing ? editing.by_id : (isAdmin() ? (byProfile?.id || meId()) : meId()), by_name: by,
    };
    if (editing && isAdmin() && byProfile) row.by_id = byProfile.id;
    await saveAct(row);
    scheduleRender();
    toast(editing ? 'Call updated' : `Call logged for ${co.name}`);
    if (another) openLog(); else closeModal();
  } catch (e) { err.textContent = friendlyErr(e); btns.forEach(b => b.disabled = false); }
}

/* ---------- Company form ---------- */
function openCompanyForm(id = null, presetName = '') {
  const c = id ? S.companies.get(id) : null;
  const blank = () => ({ name: '', designation: '', phone: '', email: '' });
  const contacts = JSON.parse(JSON.stringify(c?.contacts || []));
  while (contacts.length < 3) contacts.push(blank());
  const contactRows = () => contacts.map((p, i) => `<div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr)) auto;align-items:end" data-ci="${i}">
      <label class="f">Name<input type="text" data-cf="name" value="${esc(p.name)}"></label><label class="f">Designation<input type="text" data-cf="designation" value="${esc(p.designation)}"></label>
      <label class="f">Phone<input type="text" data-cf="phone" value="${esc(p.phone)}"></label><label class="f">Email<input type="email" data-cf="email" value="${esc(p.email || '')}"></label>
      <button type="button" class="iconbtn" data-rmc="${i}" title="Remove contact">${ICON.close}</button></div>`).join('');
  openModal(`<div class="mh"><h2>${c ? 'Edit company' : 'Add company'}</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <form class="mb" id="cf-form" autocomplete="off">
      <label class="f">Company name<input type="text" id="cf-name" value="${esc(c?.name || presetName)}" required><span class="small" id="cf-dupe"></span></label>
      <div class="grid3">
        <label class="f">Stage<select id="cf-stage">${STAGES.map(s => `<option value="${s.k}" ${(c?.stage || 'new') === s.k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
        <label class="f">Source<select id="cf-source">${SOURCES.map(s => `<option ${(c?.source || 'Cold call') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="f">City<input type="text" id="cf-city" value="${esc(c?.city || '')}"></label>
      </div>
      <div class="grid3">
        <label class="f">Requirement<select id="cf-req"><option value="">—</option>${REQS.map(r => `<option ${c?.requirement === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="f">Amount (₹ Cr)<input type="number" step="0.01" min="0" id="cf-amt" value="${c?.amount_cr ?? ''}"></label>
        <label class="f">Sector<input type="text" id="cf-sector" value="${esc(c?.sector || '')}"></label>
      </div>
      <div class="grid2">
        <label class="f">Existing bankers<input type="text" id="cf-banks" value="${esc(c?.banks || '')}" placeholder="e.g. SBI, Union Bank"></label>
        <label class="f">Website<input type="text" id="cf-web" value="${esc(c?.website || '')}"></label>
      </div>
      <label class="f">Notes<textarea id="cf-notes" rows="3">${esc(c?.notes || '')}</textarea></label>
      <div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><div><h3>Contact persons</h3><div class="small muted">One row per person. For two numbers of the same person, use a slash in Phone.</div></div><button type="button" class="btn sm" id="cf-addc">${ICON.plus}Add contact</button></div><div id="cf-contacts" class="stack" style="gap:10px">${contactRows()}</div></div>
      <div class="err" id="cf-err"></div>
    </form>
    <div class="mf"><button class="btn" data-act="closemodal">Cancel</button><button class="btn primary" id="cf-save">${c ? 'Save changes' : 'Add company'}</button></div>`, m => {
    const readContacts = () => $$('[data-ci]', m).forEach(row => { const p = contacts[+row.dataset.ci]; $$('[data-cf]', row).forEach(i => { p[i.dataset.cf] = i.value.trim(); }); });
    const redraw = () => { $('#cf-contacts', m).innerHTML = contactRows(); };
    $('#cf-addc', m).addEventListener('click', () => { readContacts(); contacts.push({ name: '', designation: '', phone: '', email: '' }); redraw(); });
    $('#cf-contacts', m).addEventListener('click', e => { const b = e.target.closest('[data-rmc]'); if (!b) return; readContacts(); contacts.splice(+b.dataset.rmc, 1); redraw(); });
    const dupe = () => { const nv = norm($('#cf-name', m).value); const d = nv && [...S.companies.values()].find(x => x.id !== c?.id && norm(x.name) === nv);
      $('#cf-dupe', m).innerHTML = d ? `<span class="err">${esc(d.name)} is already in the CRM. <button type="button" class="btn sm" data-act="open" data-id="${d.id}">Open it</button></span>` : ''; return d; };
    $('#cf-name', m).addEventListener('input', dupe); dupe();
    $('#cf-save', m).addEventListener('click', async () => {
      readContacts();
      const name = $('#cf-name', m).value.trim();
      if (!name) { $('#cf-err', m).textContent = 'Enter the company name.'; return; }
      if (dupe()) { $('#cf-err', m).textContent = 'This company already exists. Open the existing one instead.'; return; }
      const row = { id: c?.id || uuid(), name, stage: $('#cf-stage', m).value, source: $('#cf-source', m).value, city: $('#cf-city', m).value.trim() || null,
        requirement: $('#cf-req', m).value || null, amount_cr: $('#cf-amt', m).value ? Number($('#cf-amt', m).value) : null, sector: $('#cf-sector', m).value.trim() || null,
        banks: $('#cf-banks', m).value.trim() || null, website: $('#cf-web', m).value.trim() || null, notes: $('#cf-notes', m).value.trim() || null,
        contacts: contacts.filter(p => p.name || p.phone || p.email) };
      $('#cf-save', m).disabled = true;
      try { const saved = await saveCompany(row); closeModal(); toast(c ? 'Company updated' : 'Company added'); scheduleRender(); if (!c) openDrawer(saved.id); }
      catch (e) { $('#cf-err', m).textContent = friendlyErr(e); $('#cf-save', m).disabled = false; }
    });
    $('#cf-name', m).focus();
  });
}

/* ---------- Team login forms ---------- */
async function callUsers(body) {
  const { data, error } = await sb.functions.invoke('manage-users', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) { /* ignore */ }
    if (/not found|404|Failed to send/i.test(msg)) msg = 'The “manage-users” function is not set up yet. See step 5 of SETUP-GUIDE.md.';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
const genPass = () => { const w = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(12)); r.forEach(x => { s += w[x % w.length]; }); return s; };
async function reloadProfiles() { const { data } = await sb.from('profiles').select('*'); if (data) S.profiles = new Map(data.map(r => [r.id, r])); scheduleRender(); }
function openUserForm(id = null) {
  const p = id ? S.profiles.get(id) : null; const self = p?.id === meId();
  openModal(`<div class="mh"><h2>${p ? 'Manage login' : 'Add login'}</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <form class="mb" id="uf" autocomplete="off">
      <label class="f">Full name<input type="text" id="uf-name" value="${esc(p?.full_name || '')}" required></label>
      ${p ? `<div class="f"><span class="small" style="font-weight:500">Email</span><span>${esc(p.email || '')}</span></div>` : '<label class="f">Email<input type="email" id="uf-email" required></label>'}
      <div class="grid2">
        <label class="f">Role<select id="uf-role" ${self ? 'disabled' : ''}><option value="user" ${p?.role !== 'admin' ? 'selected' : ''}>User (logs calls, works pipeline)</option><option value="admin" ${p?.role === 'admin' ? 'selected' : ''}>Admin (everything)</option></select></label>
        ${p ? `<label class="f">Status<select id="uf-active" ${self ? 'disabled' : ''}><option value="1" ${p.active ? 'selected' : ''}>Active</option><option value="0" ${!p.active ? 'selected' : ''}>Switched off (can't sign in)</option></select></label>` : '<span></span>'}
      </div>
      <label class="f"><span>${p ? 'Set a new password' : 'Password'} <span class="hint">${p ? 'Leave blank to keep the current one. ' : ''}At least 8 characters.</span></span>
        <div class="row" style="flex-wrap:nowrap"><input type="text" id="uf-pass" ${p ? '' : 'required'} minlength="8" autocomplete="new-password"><button type="button" class="btn sm" id="uf-gen">Generate</button></div></label>
      <div class="err" id="uf-err"></div>
    </form>
    <div class="mf"><button class="btn" data-act="closemodal">Cancel</button><button class="btn primary" id="uf-save">${p ? 'Save' : 'Create login'}</button></div>`, m => {
    $('#uf-gen', m).addEventListener('click', () => { $('#uf-pass', m).value = genPass(); });
    $('#uf-save', m).addEventListener('click', async () => {
      const err = $('#uf-err', m); err.textContent = '';
      const name = $('#uf-name', m).value.trim(), pass = $('#uf-pass', m).value;
      if (!name) { err.textContent = 'Enter the person’s name.'; return; }
      if ((!p || pass) && pass.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
      const btn = $('#uf-save', m); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        if (p) {
          const body = { action: 'update', id: p.id, full_name: name };
          if (!self) { body.role = $('#uf-role', m).value; body.active = $('#uf-active', m).value === '1'; }
          if (pass) body.password = pass;
          await callUsers(body);
        } else {
          const email = $('#uf-email', m).value.trim();
          if (!email) throw new Error('Enter the email address.');
          await callUsers({ action: 'create', email, password: pass, full_name: name, role: $('#uf-role', m).value });
        }
        await reloadProfiles(); await loadAll();
        const email = p ? p.email : $('#uf-email', m).value.trim();
        if (pass) {
          $('.mb', m).innerHTML = `<p>${p ? 'Password updated' : 'Login created'} for <strong>${esc(name)}</strong>. Share these details with them privately:</p>
            <div class="note" style="font-size:14px">Link: ${esc(location.origin + location.pathname)}<br>Email: ${esc(email)}<br>Password: <strong>${esc(pass)}</strong></div>
            <div><button class="btn" data-act="copy" data-text="${esc(`AAS BD Desk login\nLink: ${location.origin + location.pathname}\nEmail: ${email}\nPassword: ${pass}`)}">${ICON.copy}Copy login details</button></div>
            <p class="small muted">They can change the password after signing in.</p>`;
          $('.mf', m).innerHTML = '<button class="btn primary" data-act="closemodal">Done</button>';
        } else { closeModal(); toast('Saved'); }
      } catch (e) { err.textContent = friendlyErr(e); btn.disabled = false; btn.textContent = p ? 'Save' : 'Create login'; }
    });
  });
}
function openPassword() {
  openModal(`<div class="mh"><h2>Change your password</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <form class="mb" id="pw"><label class="f">New password<input type="password" id="pw1" autocomplete="new-password" minlength="8"></label>
    <label class="f">Type it again<input type="password" id="pw2" autocomplete="new-password"></label><div class="err" id="pw-err"></div></form>
    <div class="mf"><button class="btn" data-act="closemodal">Cancel</button><button class="btn primary" id="pw-save">Change password</button></div>`, m => {
    $('#pw1', m).focus();
    $('#pw-save', m).addEventListener('click', async () => {
      const a = $('#pw1', m).value, b = $('#pw2', m).value, err = $('#pw-err', m);
      if (a.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      if (a !== b) { err.textContent = 'The two passwords don’t match.'; return; }
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { err.textContent = friendlyErr(error); return; }
      closeModal(); toast('Password changed');
    });
  });
}
function openAccount() {
  openModal(`<div class="mh"><h2>${esc(S.me.full_name || S.me.email)}</h2><button class="iconbtn" data-act="closemodal">${ICON.close}</button></div>
    <div class="mb"><div class="small muted">${esc(S.me.email || '')} · ${isAdmin() ? 'Admin' : 'User'}</div><div class="sync ${S.sync === 'live' ? '' : S.sync}">${S.sync === 'live' ? 'Live' : 'Connecting…'}</div></div>
    <div class="mf"><button class="btn" data-act="password">Change password</button><button class="btn" data-act="signout">Sign out</button></div>`);
}

/* ================= Import / export ================= */
function parseDelimited(text) {
  const delim = text.includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim()));
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if ((m = s.match(/^(\d{1,2})[-\/. ]([A-Za-z]{3})[A-Za-z]*[-\/. ,]+(\d{2,4})$/))) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(mo)}-${pad(+m[1])}`; }
  if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}
function mapStatus(s) {
  s = String(s || '').toLowerCase();
  if (!s) return null;
  if (/meeting\s*done|met\b/.test(s)) return 'mtg_done';
  if (/meeting\s*(sched|fix)/.test(s)) return 'mtg_sched';
  if (/no\s*req/.test(s)) return 'no_req';
  if (/not\s*interest/.test(s)) return 'not_interested';
  if (/not\s*answer|no\s*answer|nr\b/.test(s)) return 'not_answering';
  if (/no\s*response|not\s*reach|switch/.test(s)) return 'no_response';
  if (/call\s*back|callback/.test(s)) return 'callback';
  if (/opportun|interested/.test(s)) return /rating/.test(s) ? 'opp_rating' : 'opportunity';
  if (/proposal|term\s*sheet/.test(s)) return 'proposal';
  if (/follow|docs|document/.test(s)) return 'docs';
  if (/mandate|won|signed/.test(s)) return 'won';
  return null;
}
function headerMap(row) {
  const m = {};
  row.forEach((h, i) => {
    const x = h.toLowerCase();
    if (/company/.test(x)) m.company ??= i;
    else if (/person|contact name/.test(x)) m.person ??= i;
    else if (/designation|title/.test(x)) m.desig ??= i;
    else if (/contact\s*(number|no)|phone|mobile/.test(x)) m.phone ??= i;
    else if (/status/.test(x)) m.status ??= i;
    else if (/remark|next step|comment/.test(x)) m.remarks ??= i;
    else if (/date/.test(x)) m.date ??= i;
    else if (/city|location/.test(x)) m.city ??= i;
    else if (/sector|industry/.test(x)) m.sector ??= i;
    else if (/source/.test(x)) m.source ??= i;
  });
  return m;
}
function importPreview() {
  const rows = parseDelimited($('#imp-text').value || '');
  const hi = rows.findIndex(r => r.some(c => /company/i.test(c)));
  const out = $('#imp-out');
  if (hi < 0) { out.innerHTML = '<div class="err">Couldn’t find a header row with a “Company” column. Copy the header row along with the data.</div>'; return; }
  const hm = headerMap(rows[hi]); const g = (r, k) => hm[k] != null ? (r[hm[k]] || '').trim() : '';
  const items = []; const issues = [];
  rows.slice(hi + 1).forEach((r, i) => {
    const company = g(r, 'company'); if (!company) return;
    const it = { company, person: g(r, 'person').replace(/^(mr|ms|mrs|dr)\.?\s*/i, ''), desig: g(r, 'desig').replace(/,\s*$/, ''), phone: g(r, 'phone'),
      remarks: g(r, 'remarks'), city: g(r, 'city'), sector: g(r, 'sector'), source: g(r, 'source') };
    if (IMP.mode === 'calls') {
      it.date = parseDate(g(r, 'date')); it.outcome = mapStatus(g(r, 'status'));
      if (!it.date) issues.push(`Row ${hi + i + 2}: date “${g(r, 'date')}” not understood`);
      if (!it.outcome) issues.push(`Row ${hi + i + 2}: status “${g(r, 'status')}” not recognised`);
      if (!it.date || !it.outcome) return;
    }
    items.push(it);
  });
  const existing = new Set([...S.companies.values()].map(c => norm(c.name)));
  const newCos = new Set(items.filter(it => !existing.has(norm(it.company))).map(it => norm(it.company)));
  IMP.parsed = items;
  out.innerHTML = `<div class="note">${IMP.mode === 'calls' ? `<strong>${plural(items.length, 'call')}</strong> ready, across ${plural(new Set(items.map(x => norm(x.company))).size, 'company', 'companies')} (${newCos.size} new).`
    : `<strong>${plural(newCos.size, 'new company', 'new companies')}</strong> ready. ${items.length - [...items].filter(it => newCos.has(norm(it.company))).length} already in the CRM will be skipped.`}</div>
    ${issues.length ? `<div class="err" style="margin-top:8px">${plural(issues.length, 'row')} will be skipped:<br>${issues.slice(0, 8).map(esc).join('<br>')}${issues.length > 8 ? '<br>…' : ''}</div>` : ''}`;
  $('#imp-go').disabled = !items.length;
}
async function importGo() {
  const items = IMP.parsed; if (!items?.length) return;
  const btn = $('#imp-go'); btn.disabled = true; btn.textContent = 'Importing…';
  try {
    const byNameSel = $('#imp-by')?.value || S.me.full_name;
    const byProf = [...S.profiles.values()].find(p => p.full_name === byNameSel);
    const cos = new Map([...S.companies.values()].map(c => [norm(c.name), JSON.parse(JSON.stringify(c))]));
    const touched = new Set(); const newActs = []; let skipped = 0;
    const seen = new Set([...S.acts.values()].map(a => `${a.company_id}|${a.call_date}|${a.outcome}|${(a.remarks || '').slice(0, 60)}`));
    const sorted = [...items].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    for (const it of sorted) {
      const k = norm(it.company);
      let c = cos.get(k);
      if (IMP.mode === 'leads' && c) { skipped++; continue; }
      if (!c) { c = { id: uuid(), name: it.company, stage: 'new', contacts: [], source: it.source || (IMP.mode === 'leads' ? 'Rating action list' : 'Cold call'), city: it.city || null, sector: it.sector || null }; cos.set(k, c); }
      if (it.person || it.phone) {
        const ex = c.contacts.find(x => it.person ? norm(x.name) === norm(it.person) : x.phone === it.phone);
        if (ex) { if (it.desig) ex.designation = it.desig; if (it.phone) ex.phone = it.phone; }
        else c.contacts.push({ name: it.person, designation: it.desig, phone: it.phone, email: '' });
      }
      touched.add(k);
      if (IMP.mode === 'calls') {
        const sig = `${c.id}|${it.date}|${it.outcome}|${(it.remarks || '').slice(0, 60)}`;
        if (seen.has(sig)) { skipped++; continue; }
        seen.add(sig);
        c.stage = nextStage(c.stage, it.outcome);
        newActs.push({ id: uuid(), company_id: c.id, call_date: it.date, person: it.person, designation: it.desig, phone: it.phone, outcome: it.outcome,
          remarks: it.remarks, by_id: byProf?.id || null, by_name: byNameSel });
      }
    }
    const coRows = [...touched].map(k => { const { created_at, updated_at, ...r } = cos.get(k); return r; });
    for (let i = 0; i < coRows.length; i += 200) { const { error } = await sb.from('companies').upsert(coRows.slice(i, i + 200)); if (error) throw error; }
    for (let i = 0; i < newActs.length; i += 200) { const { error } = await sb.from('activities').insert(newActs.slice(i, i + 200)); if (error) throw error; }
    await loadAll();
    $('#imp-out').innerHTML = `<div class="note">Done. ${IMP.mode === 'calls' ? plural(newActs.length, 'call') + ' imported' : plural(coRows.length, 'company', 'companies') + ' added'}${skipped ? `, ${skipped} skipped as already present` : ''}.</div>`;
    $('#imp-text').value = ''; IMP.parsed = null;
  } catch (e) { $('#imp-out').innerHTML = `<div class="err">${esc(friendlyErr(e))}</div>`; }
  btn.textContent = 'Import';
}
function toCSV(head, rows) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportCalls(all) {
  const rows = all ? [...S.acts.values()].sort((a, b) => a.call_date.localeCompare(b.call_date)) : filteredCalls();
  download(`AAS-calls-${today()}.csv`, toCSV(['Date', 'Company', 'Person', 'Designation', 'Contact number', 'Status', 'Remarks / next step', 'Profile shared', 'Follow-up', 'Follow-up time', 'Logged by'],
    rows.map(a => [a.call_date, S.companies.get(a.company_id)?.name, a.person, a.designation, a.phone, OUT[a.outcome]?.label, a.remarks, SHARED[a.profile_shared || ''], a.follow_up, a.follow_up_time, byName(a)])));
}
function exportCompanies() {
  const la = lastActsMap(); const cc = callCount();
  download(`AAS-companies-${today()}.csv`, toCSV(['Company', 'Stage', 'Requirement', 'Amount (Rs Cr)', 'Existing bankers', 'Sector', 'City', 'Source', 'Contacts', 'Last call', 'Last status', 'Next follow-up', 'Meeting', 'Calls', 'Notes'],
    [...S.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.name, STG[c.stage]?.label, c.requirement, c.amount_cr, c.banks, c.sector, c.city, c.source,
      (c.contacts || []).map(p => [p.name, p.designation, p.phone, p.email].filter(Boolean).join(' / ')).join('; '), la.get(c.id)?.call_date, OUT[la.get(c.id)?.outcome]?.label, c.next_follow_up, c.meeting_date, cc.get(c.id) || 0, c.notes])));
}

/* ================= Toast & actions ================= */
let toastT;
function toast(msg, bad = false) {
  $('.toast')?.remove(); clearTimeout(toastT);
  document.body.insertAdjacentHTML('beforeend', `<div class="toast ${bad ? 'bad' : ''}" role="status">${esc(msg)}</div>`);
  toastT = setTimeout(() => $('.toast')?.remove(), bad ? 5000 : 2400);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (_) { toast('Copy failed. Select the text and copy it.', true); } ta.remove(); }
}
function nextWorkday(s) { let d = addDays(s, 1); for (let i = 0; i < 7 && !isWorkday(d); i++) d = addDays(d, 1); return d; }

document.addEventListener('click', async e => {
  const qd = e.target.closest('[data-qd]');
  if (qd) { const inp = document.getElementById(qd.dataset.qd); if (inp) inp.value = qd.dataset.d; return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'copy') { e.stopPropagation(); return copyText(el.dataset.text); }
  if (e.target.closest('a.wa')) return;
  switch (act) {
    case 'log': e.preventDefault(); return openLog({ companyId: el.dataset.co || null });
    case 'editcall': return openLog({ actId: id });
    case 'open': closeModal(); $('#gs-res') && ($('#gs-res').hidden = true); return openDrawer(id);
    case 'closedrawer': return closeDrawer();
    case 'closemodal': return closeModal();
    case 'newco': $('#gs-res') && ($('#gs-res').hidden = true); return openCompanyForm(null, el.dataset.name || '');
    case 'editco': return openCompanyForm(id);
    case 'delco-ask': $('#drawer').dataset.confirm = '1'; return renderDrawer();
    case 'delco-cancel': $('#drawer').dataset.confirm = ''; return renderDrawer();
    case 'delco': try { await delRow('companies', id); [...S.acts.values()].filter(a => a.company_id === id).forEach(a => S.acts.delete(a.id)); S.companies.delete(id); closeDrawer(); scheduleRender(); toast('Company deleted'); } catch (err) { fail(err); } return;
    case 'delcall-ask': $('#lc-delwrap').innerHTML = '<span class="row small">Delete this call? <button class="btn sm danger solid" data-act="delcall">Delete</button><button class="btn sm" data-act="delcall-no">Keep</button></span>'; return;
    case 'delcall-no': $('#lc-delwrap').innerHTML = '<button class="btn ghost danger" data-act="delcall-ask">Delete call</button>'; return;
    case 'delcall': { const aid = $$('#modal')[0] && [...S.acts.values()].find(a => a.id === currentActId()); if (!aid) return; try { await delRow('activities', aid.id); S.acts.delete(aid.id); closeModal(); scheduleRender(); toast('Call deleted'); } catch (err) { fail(err); } return; }
    case 'snooze': { const c = S.companies.get(id); try { await patchCompany(id, { next_follow_up: nextWorkday(c.next_follow_up && c.next_follow_up > today() ? c.next_follow_up : today()) }); toast('Moved to next working day'); } catch (err) { fail(err); } return; }
    case 'fudone': try { await patchCompany(id, { next_follow_up: null, next_follow_up_time: null, follow_up_note: null }); toast('Follow-up cleared'); } catch (err) { fail(err); } return;
    case 'settom': try { await patchCompany(id, { next_follow_up: nextWorkday(today()) }); toast('Follow-up set'); } catch (err) { fail(err); } return;
    case 'mtgclear': try { await patchCompany(id, { meeting_date: null, meeting_time: null }); toast('Meeting removed'); } catch (err) { fail(err); } return;
    case 'cr': UI.calls.range = el.dataset.k; $$('[data-act="cr"]').forEach(b => b.classList.toggle('on', b === el)); $('#cr-dates').hidden = UI.calls.range !== 'custom'; return VIEWS.calls.body();
    case 'rm': UI.reports.mode = el.dataset.k; $$('[data-act="rm"]').forEach(b => b.classList.toggle('on', b === el)); return VIEWS.reports.body();
    case 'rp': { const k = +el.dataset.k; const r = UI.reports; r.anchor = k === 0 ? today() : (r.mode === 'month' ? addMonths(monthStart(r.anchor), k) : addDays(r.anchor, 7 * k)); return VIEWS.reports.body(); }
    case 'copysum': return copyText(summaryText());
    case 'openlead': return openLead(id);
    case 'leadlog': try { const c = await ensureLeadCompany(S.leads.get(id)); closeModal(); openLog({ companyId: c.id }); } catch (err) { fail(err); } return;
    case 'leadco': { const c = leadCompany(S.leads.get(id)); if (c) openDrawer(c.id); return; }
    case 'leaddrop': try { await patchLead(id, { dropped: true }); closeDrawer(); toast('Removed from the list. Find it under “Not relevant” if needed.'); } catch (err) { fail(err); } return;
    case 'showdropped': UI.leads.status = 'dropped'; $('#ld-st').value = 'dropped'; return VIEWS.leads.body();
    case 'leaddel-ask': $('#ld-del').innerHTML = `<span class="small">Delete permanently?</span> <button class="btn sm danger solid" data-act="leaddel" data-id="${id}">Delete</button>`; return;
    case 'leaddel': try { await delRow('leads', id); S.leads.delete(id); closeDrawer(); scheduleRender(); toast('Lead deleted'); } catch (err) { fail(err); } return;
    case 'leadrestore': try { await patchLead(id, { dropped: false }); toast('Lead restored'); } catch (err) { fail(err); } return;
    case 'batch': UI.leads.batch = id; return VIEWS.leads.body();
    case 'lpri': UI.leads.pri = el.dataset.k; $$('[data-act="lpri"]').forEach(b => b.classList.toggle('on', b === el)); return VIEWS.leads.body();
    case 'uploadleads': return openLeadUpload();
    case 'delbatch-ask': el.parentElement.innerHTML = `<span class="small">Delete this batch and its leads? Companies and calls stay.</span> <button class="btn sm danger solid" data-act="delbatch" data-id="${id}">Delete</button> <button class="btn sm" data-act="delbatch-no">Keep</button>`; return;
    case 'delbatch-no': return VIEWS.leads.body();
    case 'delbatch': try { await delRow('lead_batches', id); S.batches.delete(id); [...S.leads.values()].filter(l => l.batch_id === id).forEach(l => S.leads.delete(l.id)); UI.leads.batch = ''; scheduleRender(); toast('Batch deleted'); } catch (err) { fail(err); } return;
    case 'export-calls': return exportCalls(false);
    case 'export-calls-all': return exportCalls(true);
    case 'export-cos': return exportCompanies();
    case 'newuser': return openUserForm();
    case 'edituser': return openUserForm(id);
    case 'password': closeModal(); return openPassword();
    case 'account': return openAccount();
    case 'signout': closeModal(); await sb?.auth.signOut(); if (!sb) location.reload(); return;
    case 'impmode': return setImpMode(el.dataset.k);
    case 'imppreview': return importPreview();
    case 'impgo': return importGo();
    case 'savesettings': {
      const target = Math.max(1, parseInt($('#st-target').value, 10) || 10);
      const workdays = $$('.st-wd').filter(i => i.checked).map(i => +i.value);
      const bad = []; const holidays = $('#st-hol').value.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => { const d = parseDate(s); if (!d) bad.push(s); return d; }).filter(Boolean);
      if (bad.length) return toast(`Couldn't read: ${bad.join(', ')}. Use dd-mm-yyyy.`, true);
      const { data, error } = await sb.from('settings').update({ daily_target: target, workdays, holidays }).eq('id', 1).select().single();
      if (error) return fail(error);
      S.settings = data; toast('Settings saved'); return;
    }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal')) closeModal(); else if (S.drawerId || S.leadId) closeDrawer(); }
});

boot().catch(e => { root().innerHTML = `<div class="setupcard">${wordmark()}<h2>Couldn't start</h2><p>${esc(e.message || e)}</p></div>`; });
})();
