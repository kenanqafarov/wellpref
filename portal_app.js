// App state
let me = null;
let page = 'overview';
let mine = [];
let judge = null;
let judgeError = null;
let judgeRequest = 0;
let rankingError = null;
let vfmBoard = null;
let hackathonBoard = null;
let hackathonSort = "overall";
let vfmRankingOptions = {scope:"overall",metric:"points",coverage:"0"};
let vfmRankingRequest = 0;
let leaderboardEvents = null;
let liveStatus = 'Connecting to live rankings…';
let liveRefreshTimer = null;
let liveRefreshRunning = false;
let liveRefreshPending = false;
let liveRenderPending = false;
let liveGeneration = 0;
let sessionExpiryTimer = null;
let sessionCheckTimer = null;
let sessionDeadline = 0;
let sessionMonotonicDeadline = 0;
const sessionExpiredMessage = 'Your session expired. Please sign in again.';

function updateLiveStatus(message) {
  liveStatus = message;
  document.querySelectorAll('#vfm-live-status, #hackathon-live-status').forEach(status => {status.textContent = message;});
}

function stopLiveRankings() {
  liveGeneration++;
  leaderboardEvents?.close();
  leaderboardEvents = null;
  clearTimeout(liveRefreshTimer);
  liveRefreshTimer = null;
  liveRefreshPending = false;
  liveRenderPending = false;
  vfmRankingRequest++;
}

function renderLiveRankings() {
  // Keep expanded breakdowns, selected controls and scroll position during updates.
  const opened = new Set([...$('content').querySelectorAll('details[open]')]
    .map(element => element.querySelector('summary')?.textContent));
  const focusedKey = document.activeElement?.dataset.rankKey;
  const x = window.scrollX, y = window.scrollY;
  render(false);
  $('content').querySelectorAll('details').forEach(element => {
    if (opened.has(element.querySelector('summary')?.textContent)) element.open = true;
  });
  if (focusedKey) document.querySelector(`[data-rank-key="${focusedKey}"]`)?.focus({preventScroll:true});
  enhanceTables($('content'));
  window.scrollTo(x, y);
}

function flushLiveRender() {
  if (liveRenderPending && me && !uploadInProgress && !document.querySelector('.mapping-dialog, .comparison-dialog')) {
    liveRenderPending = false;
    renderLiveRankings();
  }
}

function queueLiveRefresh() {
  liveRefreshPending = true;
  if (liveRefreshRunning || liveRefreshTimer || !me) return;
  const generation = liveGeneration;
  liveRefreshTimer = setTimeout(async () => {
    liveRefreshTimer = null;
    liveRefreshRunning = true;
    try {
      while (liveRefreshPending && me && generation === liveGeneration) {
        liveRefreshPending = false;
        await refresh();
        if (!me || generation !== liveGeneration) return;
        if (leaderboardEvents?.readyState === EventSource.OPEN) updateLiveStatus('Live · rankings update automatically');
        liveRenderPending = true;
        flushLiveRender();
      }
    } catch (error) {
      if (generation === liveGeneration && me) {
        updateLiveStatus('Retrying live rankings…');
        liveRefreshPending = true;
        liveRefreshTimer = setTimeout(() => {
          liveRefreshTimer = null;
          queueLiveRefresh();
        }, 2000);
      }
    } finally {
      liveRefreshRunning = false;
      if (liveRefreshPending && !liveRefreshTimer && me) queueLiveRefresh();
    }
  }, 50);
}

function startLiveRankings() {
  stopLiveRankings();
  if (!isJudge()) return;
  updateLiveStatus('Connecting to live rankings…');
  const events = new EventSource('./api/vfm/events');
  leaderboardEvents = events;
  events.onopen = () => {
    if (events !== leaderboardEvents) return;
    updateLiveStatus('Live · rankings update automatically');
    queueLiveRefresh(); // Reconcile even if events were missed during a restart.
  };
  events.addEventListener('leaderboard', event => {
    if (events !== leaderboardEvents) return;
    const {revision} = JSON.parse(event.data);
    if (revision !== vfmBoard?.revision) queueLiveRefresh();
  });
  events.onerror = () => {
    if (events === leaderboardEvents) updateLiveStatus('Reconnecting to live rankings…');
  };
  events.addEventListener('session-expired', () => {
    if (events !== leaderboardEvents) return;
    resetAuthentication(true);
  });
}
window.addEventListener('offline', () => {
  if (!me) return;
  stopLiveRankings();
  updateLiveStatus('Reconnecting to live rankings…');
});
window.addEventListener('online', () => {
  if (me) startLiveRankings();
});

const submissionPolicy = 'Teams can upload updated results throughout the hackathon. Only the latest valid submission per team and phase counts.';

// Submission schemas shared by the upload UI and client-side validation.
const requirements = {
  vfm: ['timestamp', 'well_name', 'oil_rate_stbd', 'water_rate_stbd', 'gas_rate_mscfd'],
  pta: ['well_name', 'shut_in_time', 'permeability_md', 'skin', 'delta_p_skin_psi', 'horner_slope'],
};
const names = {
  vfm: 'VFM rate predictions',
  pta: 'PTA all-test results',
  presentation: 'Team presentation',
};
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// API and feedback helpers
function alertUser(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toast);
  window._toast = setTimeout(() => toast.classList.remove('show'), 4300);
}

function setBusy(element, busy) {
  if (!element) return;
  element.classList.toggle('loading', busy);
  element.disabled = busy;
}

async function api(url, { method = 'GET', body, headers = {} } = {}) {
  const options = { method, credentials: 'same-origin', headers: { ...headers } };
  if (me && method !== 'GET') options.headers['X-CSRF-Token'] = me.csrf;

  if (body !== undefined) {
    if (!(body instanceof Blob) && typeof body !== 'string') {
      options.headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    options.body = body;
  }

  const requestUser = me;
  const requestStarted = performance.now();
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({ error: 'Unexpected server response' }));
  if (isSessionEndpoint(url) && data.user && Number.isFinite(data.user.expires_in)) {
    // Subtract the whole round trip conservatively; slow responses cannot extend access.
    data.user.expires_in = Math.max(0, data.user.expires_in - (performance.now() - requestStarted) / 1000);
  }
  if (!isSessionEndpoint(url) && (me !== requestUser || !ensureActiveSession())) throw Error(sessionExpiredMessage);
  if (!response.ok) {
    const error = Error(data.error || 'Request failed');
    error.details = data;
    throw error;
  }
  return data;
}

// Motion and accessibility helpers
function letterize(element, baseDelay = 0) {
  if (!element || reduceMotion || element.dataset.letterized) return;
  const text = element.textContent.trim();
  if (!text) return;

  element.dataset.letterized = 'true';
  element.setAttribute('aria-label', text);
  element.textContent = '';
  let letterIndex = 0;

  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/\s+/.test(part)) {
      element.appendChild(document.createTextNode(' '));
      return;
    }

    const word = document.createElement('span');
    word.className = 'word';
    [...part].forEach((character) => {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = character;
      letter.style.animationDelay = `${baseDelay + letterIndex * 8}ms`;
      letterIndex += 1;
      word.appendChild(letter);
    });
    element.appendChild(word);
  });

  const delay = Math.min(2600, baseDelay + letterIndex * 8 + 280);
  setTimeout(() => element.classList.add('sentence-complete'), delay);
}

function animateNumber(element) {
  if (!element || reduceMotion || element.dataset.counted) return;
  const rawValue = element.textContent.trim();
  const target = Number(rawValue.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(target)) return;

  element.dataset.counted = 'true';
  const decimals = rawValue.includes('.') ? 2 : 0;
  const startTime = performance.now();
  const duration = 900;

  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = (target * eased).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(tick);
    else element.textContent = rawValue;
  }

  element.textContent = decimals ? '0.00' : '0';
  requestAnimationFrame(tick);
}

function enhanceMotion(root = document) {
  if (reduceMotion) {
    document.documentElement.classList.add('reduced-motion');
    return;
  }

  requestAnimationFrame(() => {
    document.documentElement.classList.add('motion-ready');
    root.querySelectorAll('.page-top h1, #auth-title').forEach((element, index) => {
      letterize(element, index * 80);
    });
    root.querySelectorAll('.auth-caption h1').forEach((element) => letterize(element, 120));
    root.querySelectorAll('.auth-caption p, .auth-card .muted, .page-top .muted, .notice')
      .forEach((element, index) => {
        element.classList.add('sentence-reveal');
        element.style.setProperty('--delay', `${Math.min(260, 80 + index * 30)}ms`);
      });
    root.querySelectorAll('.card, .flow-card, .file-row, .table-wrap, .stat, .nav-link')
      .forEach((element, index) => {
        element.classList.add('stagger-in');
        element.style.setProperty('--delay', `${Math.min(180, index * 24)}ms`);
      });
    root.querySelectorAll('.stat strong').forEach(animateNumber);
  });
}

function revealJourney(root = document) {
  const steps = root.querySelectorAll('.journey-step');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    steps.forEach((step) => step.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18 });
  steps.forEach((step) => observer.observe(step));
}

// Authentication and session lifecycle
function isSessionEndpoint(url) {
  return ['./api/login', './api/me'].includes(url.split('?')[0]);
}

function sessionHasExpired() {
  if (me?.role === 'judge' && me.expires_at === null) return false;
  // Relative server lifetime avoids depending on the browser's wall clock.
  // Check both clocks so sleep and wall-clock adjustments cannot prolong access.
  return !sessionDeadline || Date.now() >= sessionDeadline || performance.now() >= sessionMonotonicDeadline;
}

function ensureActiveSession() {
  if (!me) return false;
  if (sessionHasExpired()) {
    resetAuthentication(true);
    return false;
  }
  return true;
}

function resetAuthentication(expired = false) {
  clearTimeout(sessionExpiryTimer);
  clearInterval(sessionCheckTimer);
  sessionExpiryTimer = sessionCheckTimer = null;
  sessionDeadline = sessionMonotonicDeadline = 0;
  stopLiveRankings();
  me = null;
  vfmBoard = hackathonBoard = judge = null;
  judgeError = rankingError = null;
  judgeRequest++;
  mine = [];
  document.querySelectorAll('dialog').forEach(dialog => { dialog.close(); dialog.remove(); });
  $('content').replaceChildren();
  $('nav').replaceChildren();
  $('user-team').textContent = $('user-role').textContent = '';
  $('workspace').hidden = true;
  $('auth').hidden = false;
  switchAuth();
  $('auth-team').value = '';
  $('auth-password').value = '';
  if (expired) {
    $('auth-message').dataset.tone = 'error';
    $('auth-message').textContent = sessionExpiredMessage;
  }
  window.history.replaceState({}, '', './');
}

async function authenticatedFetch(url, options) {
  const user = me;
  const protectedRequest = !isSessionEndpoint(url);
  if (protectedRequest && !ensureActiveSession()) throw Error(sessionExpiredMessage);
  const response = await fetch(url, options);
  if (response.status === 401 && user && me === user) resetAuthentication(true);
  if (protectedRequest && (me !== user || !ensureActiveSession())) throw Error(sessionExpiredMessage);
  return response;
}

async function checkSession() {
  if (!ensureActiveSession()) return;
  const user = me;
  try {
    const result = await api('./api/me');
    if (me === user && (!result.user || result.user.id !== user.id || result.user.csrf !== user.csrf || result.user.expires_at !== user.expires_at)) resetAuthentication(true);
  } catch (error) {
    // Local expiry still applies while offline; API guards enforce server expiry.
    if (me === user) ensureActiveSession();
  }
}

function startSessionMonitoring() {
  clearTimeout(sessionExpiryTimer);
  clearInterval(sessionCheckTimer);
  const remaining = Math.max(0, Math.min(180, Number(me?.expires_in) || 0)) * 1000;
  sessionDeadline = Date.now() + remaining;
  sessionMonotonicDeadline = performance.now() + remaining;
  if (!ensureActiveSession()) return false;
  if (me.role !== 'judge' || me.expires_at !== null) {
    sessionExpiryTimer = setTimeout(() => resetAuthentication(true), remaining);
  }
  sessionCheckTimer = setInterval(checkSession, 15000);
  return true;
}

window.addEventListener('focus', () => { if (me) checkSession(); });
window.addEventListener('pageshow', () => { if (me) checkSession(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) checkSession(); });

function switchAuth() {
  $('auth-message').textContent = '';
  $('auth-message').removeAttribute('data-tone');
  enhanceMotion($('auth'));
}

$('auth-form').onsubmit = async (event) => {
  event.preventDefault();
  const button = $('auth-submit');
  const team = $('auth-team').value.trim();
  const password = $('auth-password').value;
  $('auth-password').value = '';
  setBusy(button, true);

  try {
    const result = await api('./api/login', { method: 'POST', body: { team, password } });
    me = result.user;
    await enter();
  } catch (error) {
    $('auth-message').dataset.tone = 'error';
    $('auth-message').textContent = error.message;
  } finally {
    setBusy(button, false);
  }
};
$('logout-btn').onclick = async () => {
  try {
    await api('./api/logout', { method: 'POST', body: {} });
  } catch (error) {
    // Clear local state even if the session has already expired.
  }

  resetAuthentication();
};

function isJudge() {
  return me?.role === 'judge';
}

// Navigation and rendering share the same page definitions. Only the leaderboard
// route can render rankings; other pages never fall through to that view.
const judgePages = {
  overview: { icon: '▦', label: 'Overview', render: judgeOverview },
  judge: { icon: '♙', label: 'Current submissions', render: judgeSubmissions },
  'vfm-ranking': { icon: '▤', label: 'Leaderboards', render: judgeRanking },
};
const participantPages = {
  phase1: { icon: '◉', label: 'Phase 1 · VFM', breadcrumb: 'Phase 1 / VFM', render: () => participantPhase(1) },
  phase2: { icon: '⌁', label: 'Phase 2 · PTA', breadcrumb: 'Phase 2 / PTA', render: () => participantPhase(2) },
  presentation: { icon: '✦', label: 'Presentation', render: participantPresentation },
};

function workspacePages() {
  return isJudge() ? judgePages : participantPages;
}

function syncPageNavigation() {
  const selected = workspacePages()[page];
  $('page-breadcrumb').textContent = selected.breadcrumb || selected.label;
  document.querySelectorAll('.nav-link').forEach((button) => {
    const active = button.dataset.page === page;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

async function enter() {
  if (!startSessionMonitoring()) return;
  const user = me;
  $('auth').hidden = true;
  $('workspace').hidden = false;
  $('user-team').textContent = me.team;
  $('user-role').textContent = isJudge() ? 'Judge account' : 'Participant team';
  $('avatar').textContent = me.team.charAt(0).toUpperCase();
  $('top-avatar').textContent = me.team.charAt(0).toUpperCase();

  $('nav').innerHTML = Object.entries(workspacePages()).map(([id, { icon, label }]) => (
    `<button class="nav-link" data-page="${id}"><span class="symbol">${icon}</span>${label}</button>`
  )).join('');
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.onclick = () => navigate(button.dataset.page);
  });

  page = isJudge() ? 'overview' : 'phase1';
  render();
  await refresh();
  if (me !== user || !ensureActiveSession()) return;
  navigate(page);
  startLiveRankings();
  enhanceMotion($('workspace'));
}

async function refresh() {
  if (!ensureActiveSession()) return;
  const user = me;
  if (isJudge()) {
    // A ranking failure must not prevent the dashboard from loading, or vice versa.
    const [ranking] = await Promise.allSettled([fetchOfficialRanking(), fetchJudgeDashboard()]);
    if (me !== user) return;
    rankingError = ranking.status === 'rejected' ? ranking.reason.message : null;
  } else {
    const data = await api('./api/mine');
    if (me === user) mine = data.uploads;
  }
}

async function fetchJudgeDashboard() {
  const user = me, request = ++judgeRequest;
  try {
    const data = await api('./api/judge');
    if (me !== user || request !== judgeRequest) return;
    if (!Array.isArray(data.teams) || !Array.isArray(data.uploads)) {
      throw Error('Submission data could not be loaded. Please try again.');
    }
    judge = data;
    judgeError = null;
  } catch (error) {
    if (me === user && request === judgeRequest) judgeError = error.message;
  }
}

async function retryWorkspacePage() {
  if (!ensureActiveSession()) return;
  const user = me;
  judgeError = rankingError = null;
  render();
  await refresh();
  if (me === user) render();
}
// Navigation and view helpers
function navigate(nextPage) {
  if (!ensureActiveSession()) return;
  if (nextPage === 'ranking') nextPage = 'vfm-ranking';
  if (!Object.hasOwn(workspacePages(), nextPage)) return;

  page = nextPage;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  render();
  if (isJudge() && ['overview', 'judge'].includes(page) && (!judge || judgeError)) {
    void retryWorkspacePage();
  }
}

function intro(kicker, title, subtitle) {
  return `<div class="page-top"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p class="muted">${subtitle}</p></div></div>`;
}

function heading(title, subtitle) {
  return `<h3>${title}</h3>${subtitle
    ? `<p class="section-subtitle">${subtitle}</p>`
    : ''}`;
}

function foldPanel(title, subtitle, content) {
  return `<details class="card fold-card"><summary><span><b>${title}</b><small>${subtitle}</small></span><span class="fold-chevron" aria-hidden="true"></span></summary><div class="fold-body">${content}</div></details>`;
}

function phaseLabel(upload) {
  return upload.kind === 'presentation' ? 'Presentation' : `Phase ${upload.phase}`;
}

// Participant views
function uploadSummary(rows) {
  if (!rows.length) return '<div class="empty">No uploads yet</div>';
  const body = rows.map((upload) => `
    <tr>
      <td>${phaseLabel(upload)}</td>
      <td class="filename-cell"><b>${esc(upload.filename)}</b><small>${esc(names[upload.kind] || upload.kind)}</small></td>
      <td>${upload.kind === 'presentation' ? '1 file' : upload.nrows}</td>
      <td>${new Date(upload.created_at).toLocaleString()}</td>
      <td><span class="chip">Submitted</span><div class="row-actions">${upload.has_mapping ? `<button class="mapping-trace-link" onclick="ColumnMapping.audit(${upload.id})">View columns</button>` : ''}${isJudge() && upload.kind!=='presentation' ? `<button class="mapping-trace-link" onclick="ResultComparison.open(${upload.id})">Compare reference</button>` : ''}</div></td>
    </tr>`).join('');

  return `<div class="table-wrap"><table class="submissions-table">
    <thead><tr><th>Stage</th><th>File</th><th>Records</th><th>Uploaded</th><th>Status</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function journeyStep(number, title, detail, destination, complete) {
  const state = complete ? 'complete' : '';
  const marker = complete ? '✓' : String(number).padStart(2, '0');
  const status = complete ? 'Submitted' : 'Ready';
  const action = complete ? 'View' : 'Submit';

  return `<article class="journey-step ${state}" style="--step-delay:${(number - 1) * 100}ms">
    <div class="journey-node">${marker}</div>
    <div class="journey-copy"><span>${status}</span><h2>${title}</h2><p>${detail}</p></div>
    <button class="journey-action" onclick="navigate('${destination}')">${action} <span aria-hidden="true">→</span></button>
  </article>`;
}

function participantOverview() {
  const submitted = ['vfm', 'pta', 'presentation']
    .filter((kind) => mine.some((upload) => upload.kind === kind)).length;
  const progress = Math.round((submitted / 3) * 100);
  const allDone = submitted === 3;

  return intro(`TEAM / ${esc(me.team)}`, 'Your challenge run', `${submitted} of 3 submitted`)
    + `<section class="journey-board">
      <div class="journey-summary">
        <div><span class="eyebrow">MISSION STATUS</span><strong>${submitted}<small> / 3</small></strong></div>
        <span class="mission-label">${allDone ? 'ALL IN' : 'IN PROGRESS'}</span>
      </div>
      <div class="journey-progress" role="progressbar" aria-label="Submission progress"
        aria-valuemin="0" aria-valuemax="3" aria-valuenow="${submitted}"
        style="--journey-progress:${progress}%"><span></span></div>
      <div class="journey-steps">
        ${journeyStep(1, 'Phase 1 · VFM', 'Rate predictions', 'phase1', mine.some((item) => item.kind === 'vfm'))}
        ${journeyStep(2, 'Phase 2 · PTA', 'Pressure analysis', 'phase2', mine.some((item) => item.kind === 'pta'))}
        ${journeyStep(3, 'Team presentation', 'PDF or PowerPoint', 'presentation', mine.some((item) => item.kind === 'presentation'))}
      </div>
    </section>
    <section class="recent-section">
      <div class="section-heading"><span class="eyebrow">CURRENT RESULTS</span><h2>Latest valid submissions</h2></div>
      ${uploadSummary(mine.slice(0, 5))}
    </section>`;
}

function uploadSection(kind) {
  const lastUpload = mine.find((upload) => upload.kind === kind);
  const latestMarkup = lastUpload
    ? `<p class="file-meta">Last uploaded ${new Date(lastUpload.created_at).toLocaleString()} (${lastUpload.nrows} rows)</p>`
    : '';

  return `<div class="file-row">
    <div><h3>${esc(names[kind])} ${lastUpload ? '<span class="chip">Uploaded</span>' : ''}</h3>${latestMarkup}</div>
    <div>
      <input aria-label="Upload ${kind}" type="file" accept="${kind === 'pta' ? '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.csv,text/csv'}" id="file-${kind}" hidden>
      <button class="action" onclick="document.getElementById('file-${kind}').click()">${kind === 'pta' ? 'Choose CSV or Excel' : 'Choose CSV'}</button>
    </div>
  </div>`;
}
function participantPhase(phase) {
  const kind = phase === 1 ? 'vfm' : 'pta';
  const uploaded = mine.some((upload) => upload.kind === kind);
  const phaseName = phase === 1 ? 'Virtual Flow Metering' : 'Pressure Transient Analysis';
  const category = phase === 1 ? 'PRODUCTION' : 'RESERVOIR';
  const description = phase === 1
    ? 'Upload daily oil, water and gas predictions for the official VFM dataset.'
    : 'Upload PTA predictions in CSV or Excel (.xlsx).';
  const format = `Required columns: ${requirements[kind].join(', ')}.`;
  const scoring = phase === 1
    ? 'Oil, gas and water each earn up to 10 points: R² /3, MAPE /2 and WAPE /5. VFM totals /30'
    : 'Horner slope /5 + Permeability /5 + Skin /5 + ΔP Skin /5 = 20 points maximum.';
  const uploads = mine.filter((upload) => upload.phase === phase);

  return intro(`PHASE ${phase} · ${category}`, phaseName, description)
    + `<div class="grid2">
      <div class="card">
        ${heading('Upload results', uploaded ? `Upload again to replace your current ${kind.toUpperCase()} result` : 'No result file submitted')}
        ${phase === 2 ? '<div class="notice pta-required-fields"><b>Required PTA fields only:</b> Well, <code>shut_in_time</code>, Horner slope, Permeability (k), Skin and ΔP Skin. Submit one row per well and shut-in time. No other parameters are required.</div>' : ''}
        <div class="upload-panel">${uploadSection(kind)}</div>
        <div class="notice upload-help">Choose a result file, review the detected columns and units, then confirm your submission. A rejected upload leaves your current submission in place.</div>
      </div>
      <div class="fold-stack">
        ${foldPanel(phase === 2 ? 'CSV / Excel format' : 'CSV format', 'Template and required columns', `<p class="muted">${format}</p><button class="action" onclick="downloadTemplates(${phase})">↓ Download CSV template</button>`)}
        ${foldPanel(`Scoring mechanism for phase ${phase}`, 'How your result is evaluated', `<p class="muted">${scoring}</p>`)}
      </div>
    </div>
    <div class="card">
      ${heading(`Phase ${phase} current submission`)}
      <div class="submission-history">${uploadSummary(uploads)}</div>
    </div>`;
}

function participantPresentation() {
  const files = mine.filter((upload) => upload.kind === 'presentation');
  const latest = files[0];
  const latestMarkup = latest
    ? `<div class="presentation-latest"><span class="chip">Submitted</span><b>${esc(latest.filename)}</b><small>${new Date(latest.created_at).toLocaleString()}</small></div>`
    : '';

  return intro('FINAL CHECKPOINT', 'Team presentation', latest ? 'Deck submitted' : 'Ready to submit')
    + `<section class="card presentation-card">
      <div class="presentation-heading">
        <span class="journey-node">03</span>
        <div><span class="eyebrow">FINAL DELIVERABLE</span><h2>Presentation deck</h2></div>
      </div>
      <div class="presentation-drop" id="presentation-drop">
        <input id="file-presentation" type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden>
        <span class="drop-symbol" aria-hidden="true">↑</span>
        <strong>Drop your deck here</strong>
        <span>PDF · PPT · PPTX · 32 MB max</span>
        <button class="action" type="button" onclick="document.getElementById('file-presentation').click()">Choose file</button>
      </div>
      ${latestMarkup}
    </section>
    <section class="recent-section">
      <div class="section-heading"><span class="eyebrow">CURRENT PRESENTATION</span><h2>Latest submission</h2></div>
      ${uploadSummary(files)}
    </section>`;
}
// Judge dashboard views
function referenceStatusNotice() {
  if (!isJudge()) return '';
  return ['vfm', 'pta'].filter(kind => hackathonBoard?.policy?.[kind]?.available === false)
    .map(kind => `<div class="notice" role="status"><b>${kind.toUpperCase()} scoring is temporarily unavailable.</b> The official reference needs correction. Saved submissions and previously accepted scores remain visible; new ${kind.toUpperCase()} results cannot be scored until the reference is corrected.</div>`).join('');
}

function judgePageStatus(title, error) {
  return intro('JUDGE WORKSPACE', title, '') + (error
    ? `<div class="card" role="alert"><h3>This page could not be loaded</h3><p class="section-subtitle">${esc(error)}</p><button class="action" onclick="retryWorkspacePage()">Try again</button></div>`
    : '<div class="card" role="status">Loading current results…</div>');
}

function judgeOverview() {
  if (!judge || judgeError) return judgePageStatus('Evaluation overview', judgeError);
  const teams = judge.teams;
  const uploads = judge.uploads;
  const evaluations = judge.evaluations || [];

  return intro('JUDGE CONTROL CENTER', 'Evaluation overview', 'Private access to participant files, truth comparisons, and rankings.')
    + `<div class="proof-strip">
      <span>Registered teams</span><b>${teams.length}</b>
      <span>Current submissions</span><b>${uploads.length}</b>
      <span>Automatic evaluations</span><b>${evaluations.length}</b>
    </div>
    <div class="case-panel featured">
      <span>Private evaluation</span>
      <h3>Every new result is scored against judge reference data.</h3>
      <p>Review per-phase scores, truth coverage, error metrics, and the live team ranking.</p>
    </div>
    <div class="grid3">
      <div class="card stat"><span class="sym">♙</span><strong>${teams.length}</strong><small>Registered teams</small></div>
      <div class="card stat"><span class="sym">▤</span><strong>${uploads.length}</strong><small>Current submissions</small></div>
      <div class="card stat"><span class="sym">✓</span><strong>${evaluations.length}</strong><small>Automatic evaluations</small></div>
    </div>
    <div class="card">
      ${heading('Judge actions')}
      <div class="flow-card"><span class="flow-num">01</span><div><h3>Review comparisons</h3><p>Inspect matched rows, coverage, and error metrics.</p></div><button class="flow-link" onclick="navigate('judge')">Review →</button></div>
      <div class="flow-card"><span class="flow-num">02</span><div><h3>Team ranking</h3><p>See the latest score for each uploaded phase.</p></div><button class="flow-link" onclick="navigate('ranking')">Leaderboard →</button></div>
    </div>`;
}

function scoresFor(userId, phase) {
  return judge.scores.find((score) => score.user_id === userId && score.phase === phase);
}

function judgeSubmissions() {
  if (!judge || judgeError) return judgePageStatus('Participant submissions', judgeError);
  const rows = judge.uploads.map((upload) => {
    const isPresentation = upload.kind === 'presentation';
    const matched = isPresentation ? '—' : (upload.matched_rows ?? 0);
    const coverage = isPresentation || upload.coverage_pct == null
      ? '—'
      : `${Number(upload.coverage_pct).toFixed(1)}%`;
    const similarity = upload.similarity == null
      ? 'Not scored'
      : `${Number(upload.similarity).toFixed(2)} / ${upload.kind==='vfm'?30:20}`;
    const metrics = isPresentation
      ? '—'
      : `<details class="evaluation-details"><summary>View metrics</summary><pre>${esc(JSON.stringify(JSON.parse(upload.metrics_json || '{}'), null, 2))}</pre></details>`;

    return `<tr>
      <td><b>${esc(upload.team)}</b><small>Latest valid</small></td><td>${phaseLabel(upload)}</td>
      <td class="filename-cell">${esc(upload.filename)}</td><td>${isPresentation ? '1 file' : upload.nrows}</td>
      <td>${matched}</td><td>${coverage}</td><td>${similarity}</td><td>${metrics}</td>
      <td><div class="row-actions"><a class="action" href="./api/judge/download/${upload.id}">↓ Original</a>${upload.has_mapping ? `<a class="mapping-trace-link" href="./api/judge/download/${upload.id}?format=canonical">↓ Processed CSV</a><button class="mapping-trace-link" onclick="ColumnMapping.audit(${upload.id})">View columns</button>` : ''}${isJudge() && upload.kind!=='presentation' ? `<button class="mapping-trace-link" onclick="ResultComparison.open(${upload.id})">Compare reference</button>` : ''}</div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9">No uploads yet</td></tr>';

  return intro('JUDGE ONLY', 'Participant submissions', 'Only the latest valid result per team and phase is shown. New valid results replace previous ones automatically.')
    + `<div class="card">${heading('Current submissions')}
      <div class="table-wrap submission-history"><table class="submissions-table">
        <thead><tr><th>Team</th><th>Stage</th><th>File</th><th>Rows</th><th>Matched</th><th>Coverage</th><th>Score (VFM /30; PTA /20)</th><th>Metrics</th><th>Download</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}
async function saveTeamScores(userId) {
  try {
    let savedCount = 0;
    for (const phase of [1, 2]) {
      const value = $(`s${phase}-${userId}`).value.trim();
      if (value === '') continue;
      await api('./api/judge/score', {
        method: 'POST',
        body: { user_id: userId, phase, score: Number(value) },
      });
      savedCount += 1;
    }
    await refresh();
    render();
    alertUser(savedCount ? 'Judge score(s) saved.' : 'Enter at least one score to save.');
  } catch (error) {
    alertUser(error.message);
  }
}

function judgeRanking() {
  if (!hackathonBoard) return judgePageStatus('Hackathon leaderboards', rankingError);
  return HackathonLeaderboard.render(hackathonBoard,officialVfmRanking(true),me,liveStatus);
}

function exportRanking() {
  const columns=['overall_rank','team','vfm_points','pta_points','overall_points','official_maximum','allocated_maximum','unallocated_points','scored_phases','vfm_rank','pta_rank','selected_sort','selected_rank','selected_value'];
  const lines=[columns.join(',')];
  (hackathonBoard?.leaderboard || []).forEach(row=>lines.push([row.overall_rank ?? '',JSON.stringify(row.team),row.vfm_points ?? '',row.pta_points ?? '',row.overall_points ?? '',hackathonBoard.allocation.official_maximum,hackathonBoard.allocation.allocated,hackathonBoard.allocation.unallocated,row.scored_phases,row.vfm_rank ?? '',row.pta_rank ?? '',hackathonBoard.selection.sort,row.selected_rank ?? '',row.selected_value ?? ''].join(',')));
  download('socar_hackathon_leaderboard.csv',lines.join('\n'),'text/csv');
}

function download(filename, content, mimeType) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 100);
}

function downloadTemplates(phase) {
  const kind = phase === 1 ? 'vfm' : 'pta';
  download(`${kind}_submission_template.csv`, `${requirements[kind].join(',')}\n`, 'text/csv');
}
// Upload handling
let uploadInProgress = false;
async function upload(kind, files) {
  if (!ensureActiveSession()) return;
  const file = files?.[0];
  if (!file) return;
  const picker = $(`file-${kind}`);
  if (picker) picker.value = '';
  if (uploadInProgress) return alertUser('Finish or cancel the current upload first.');
  const allowedPresentations = ['.pdf', '.ppt', '.pptx'];
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (kind === 'presentation' ? !allowedPresentations.includes(extension) : !(kind === 'pta' ? ['.csv','.xlsx'] : ['.csv']).includes(extension)) {
    return alertUser(kind === 'presentation' ? 'Choose a PDF, PPT, or PPTX file.' : kind === 'pta' ? 'Choose a CSV or Excel (.xlsx) file.' : 'Please choose a CSV file.');
  }
  if (file.size > 32 * 1024 * 1024) return alertUser('File exceeds 32 MB limit.');
  if (!file.size) return alertUser('The selected file is empty.');
  uploadInProgress = true;
  const headers = {
    'Content-Type': file.type || 'application/octet-stream',
    'X-Upload-Kind': kind,
    'X-Filename': encodeURIComponent(file.name),
  };
  // A new selection is a deliberate submission, even if the file bytes match.
  // Repeated requests within this review keep the same key.
  if (kind === 'vfm' || kind === 'pta') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    headers['Idempotency-Key'] = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }
  try {
    let result;
    if (kind === 'presentation') {
      result = await api('./api/upload', { method: 'POST', body: file, headers });
    } else {
      alertUser('Reading your columns…');
      const preview = await api('./api/upload/preview', { method: 'POST', body: file, headers });
      result = await ColumnMapping.review(file, kind, preview, (mapping) => api('./api/upload', {
        method: 'POST', body: file,
        headers: { ...headers, 'X-Column-Mapping': JSON.stringify(mapping) },
      }));
      if (!result) return;
    }
    await refresh();
    render();
    alertUser(kind === 'presentation' ? 'Presentation submitted for judge review.'
      : ['vfm','pta'].includes(kind) ? `Latest ${kind.toUpperCase()} submission scored (${result.rows} rows). Your leaderboard result is updated.`
        : `${names[kind]} submitted and scored (${result.rows} rows).`);
  } catch (error) {
    alertUser(`Upload rejected: ${error.message}`);
  } finally {
    uploadInProgress = false;
    flushLiveRender();
  }
}

function bindUploadControls() {
  if (isJudge()) return;
  Object.keys(requirements).forEach((kind) => {
    const input = $(`file-${kind}`);
    if (input) input.addEventListener('change', (event) => upload(kind, event.target.files));
  });

  const input = $('file-presentation');
  const dropZone = $('presentation-drop');
  if (input) input.addEventListener('change', (event) => upload('presentation', event.target.files));
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    upload('presentation', event.dataTransfer.files);
  });
}

// Keep wide technical tables usable with touch and keyboard on narrow screens.
function enhanceTables(root = document) {
  root.querySelectorAll('.table-wrap, .mapping-table-wrap').forEach(wrap => {
    if (!wrap.getClientRects().length) return;
    const overflowing = wrap.scrollWidth > wrap.clientWidth + 1;
    let hint = wrap.previousElementSibling;
    if (!hint?.classList.contains('table-scroll-hint')) hint = null;
    if (overflowing) {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      const label = wrap.querySelector('caption')?.textContent || wrap.closest('.leaderboard-section')?.querySelector('h2')?.textContent || wrap.closest('.card')?.querySelector('h3')?.textContent || 'Result table';
      wrap.setAttribute('aria-label', `${label}; use the arrow keys or swipe to view all columns`);
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'table-scroll-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = 'Scroll horizontally to view all columns →';
        wrap.before(hint);
      }
    } else {
      wrap.removeAttribute('tabindex');
      wrap.removeAttribute('role');
      wrap.removeAttribute('aria-label');
      hint?.remove();
    }
  });
}
window.addEventListener('resize', () => {
  cancelAnimationFrame(window._uiTableResize);
  window._uiTableResize = requestAnimationFrame(() => enhanceTables());
});
document.addEventListener('toggle', event => {
  if (event.target.matches('details') && event.target.open) enhanceTables(event.target);
}, true);

// Render the active role and page.
function render(animate = true) {
  if (!ensureActiveSession()) return;
  liveRenderPending = false;
  const pages = workspacePages();
  if (!Object.hasOwn(pages, page)) page = isJudge() ? 'overview' : 'phase1';
  let view;
  try {
    view = pages[page].render();
  } catch (error) {
    console.error('The selected workspace page could not be rendered.', error);
    view = judgePageStatus(pages[page].label, 'This page could not be displayed. Please try again.');
  }
  $('content').innerHTML = `<div class="page" data-view="${page}"><p class="notice submission-policy">${submissionPolicy}</p>${referenceStatusNotice()}${view}</div>`;
  syncPageNavigation();
  bindUploadControls();
  enhanceTables($('content'));
  if (animate) enhanceMotion($('content'));
  revealJourney($('content'));
}

// Restore an existing session on page load.
(async function initialize() {
  $('auth-sub').textContent = submissionPolicy;
  enhanceMotion(document);
  try {
    const result = await api('./api/me');
    if (result.user) {
      me = result.user;
      await enter();
    }
  } catch (error) {
    alertUser('Could not connect to the application server.');
  }
})();


function officialNumber(value) {
  return value == null || !Number.isFinite(Number(value)) ? 'N/A' : Number(value).toLocaleString(undefined,{maximumFractionDigits:6});
}
function officialPercent(value) { const text=officialNumber(value);return text==='N/A'?text:text+'%'; }
function officialVfmSummary() {
  const entry=(vfmBoard?.leaderboard || []).find(r=>r.team===me?.team);
  if(!entry || entry.overall_score==null) return '<div class="notice">VFM has one official daily dataset. Submit matching predictions to receive your score and rank. Existing results that do not match the official reference need resubmission.</div>';
  const metrics=['oil','gas','water'].map(rate=>{const m=entry.metrics[rate] || {};return `<tr><th>${rate[0].toUpperCase()+rate.slice(1)}</th><td>${officialNumber(m.points)} / 10</td><td>${officialNumber(m.r2)}</td><td>${officialNumber(m.mape_pct)}</td><td>${officialNumber(m.wape_pct)}</td></tr>`;}).join('');
  return `<div class="comparison-counts"><span>VFM score <b>${officialNumber(entry.overall_score)} / 30</b></span><span>Rank <b>${entry.rank}</b></span><span>Coverage <b>${officialNumber(entry.coverage_pct)}%</b></span></div><div class="table-wrap card"><table class="own-vfm-metrics"><caption>Your latest VFM accuracy metrics</caption><thead><tr><th>Rate</th><th>Points</th><th>R²</th><th>MAPE %</th><th>WAPE %</th></tr></thead><tbody>${metrics}</tbody></table></div>`;
}
function officialRankingUrl() {
  return './api/leaderboard?'+new URLSearchParams({...vfmRankingOptions,sort:hackathonSort}).toString();
}
async function fetchOfficialRanking() {
  if (!isJudge()) return false;
  const request=++vfmRankingRequest, user=me;
  const combined=await api(officialRankingUrl());
  if(request!==vfmRankingRequest || me!==user)return false;
  vfmBoard=combined.vfm_ranking;hackathonBoard=combined;return true;
}
async function changeVfmRanking(key,value) {
  vfmRankingOptions[key]=value;
  const status=document.getElementById('vfm-ranking-status');
  if(status)status.textContent='Updating rankings…';
  try {
    if(await fetchOfficialRanking()) {
      render();
      document.querySelector(`[data-rank-key="${key}"]`)?.focus();
    }
  } catch(error) {
    const selection=vfmBoard?.selection;
    if(selection)vfmRankingOptions={scope:selection.scope,metric:selection.metric,coverage:String(selection.minimum_coverage)};
    render();alertUser(error.message);
  }
}
async function changeHackathonSort(key,value) {
  const selection=HackathonLeaderboard.sortSelection(hackathonSort);
  selection[key]=value;
  if(key === 'ranking') { selection.scope='overall';selection.metric='points'; }
  const requested=HackathonLeaderboard.sortKey(selection.ranking,selection.scope,selection.metric);
  hackathonSort=requested;
  try {
    if(await fetchOfficialRanking()) {
      renderLiveRankings();
      document.querySelector(`[data-rank-key="combined-${key}"]`)?.focus({preventScroll:true});
    }
  } catch(error) {
    if(hackathonSort!==requested)return;
    hackathonSort=hackathonBoard?.selection?.sort || 'overall';
    renderLiveRankings();alertUser(error.message);
  }
}

function officialVfmRanking(embedded=false) {
  const board=vfmBoard?.leaderboard || [],policy=vfmBoard?.policy || {};
  const scope=vfmBoard?.selection?.scope || 'overall',metric=vfmBoard?.selection?.metric || 'points';
  const label={overall:'Overall',oil:'Oil rate',gas:'Gas rate',water:'Water rate'};
  const metricLabel={points:'Points',r2:'R²',mape:'MAPE %',wape:'WAPE %',similarity:'Similarity % (diagnostic)'};
  const statuses={evaluated:'Ranked',metric_unavailable:'Metric unavailable',below_minimum_coverage:'Below coverage filter',no_submission:'No submission',needs_resubmission:'Needs resubmission'};
  const options=(values,current)=>Object.entries(values).map(([value,text])=>`<option value="${value}" ${String(current)===value?'selected':''}>${text}</option>`).join('');
  const selected=(entry,channel)=>channel==='overall' ? entry.overall || {} : entry.metrics[channel] || {};
  const extra=metric!=='points',columns=extra?9:8;
  const rows=board.map(entry=>{
    const main=selected(entry,scope);
    const details=['oil','gas','water','overall'].map(channel=>{
      const m=selected(entry,channel),parts=m.points_breakdown || {};
      const component=(key)=>{const c=parts[key];return c?`${officialNumber(c.earned)} / ${c.maximum}${c.available===false?'<small>Undefined metric · no points</small>':''}`:'N/A';};
      return `<tr><th>${label[channel]}</th><td><b>${officialNumber(m.points)} / ${channel==='overall'?30:10}</b></td><td>${component('r2')}</td><td>${component('mape')}</td><td>${component('wape')}</td><td>${officialNumber(m.r2)}</td><td>${officialNumber(m.mape_pct)}</td><td>${officialNumber(m.wape_pct)}</td><td>${officialPercent(m.coverage_pct)}</td><td>${officialPercent(m.nonzero_reference_coverage_pct)}</td><td>${officialPercent(m.score)}</td><td>${officialNumber(m.mae)}</td><td>${officialNumber(m.rmse)}</td></tr>`;
    }).join('');
    const pointsCell=(key,value)=>`<td class="${metric==='points' && scope===key?'vfm-active-metric':''}">${value==null?'—':`${officialNumber(value)} / ${key==='overall'?30:10}`}</td>`;
    return `<tr class="${entry.selected_rank==null?'vfm-unranked':entry.selected_rank<=3?'podium podium-'+entry.selected_rank:''}" data-participant="${esc(entry.team)}"><td>${entry.selected_rank ?? '—'}</td><td><b>${esc(entry.team)}${entry.team===me?.team?' · you':''}</b></td>${pointsCell('oil',entry.oil_score)}${pointsCell('gas',entry.gas_score)}${pointsCell('water',entry.water_score)}${pointsCell('overall',entry.overall_score)}${extra?`<td class="vfm-active-metric">${officialNumber(entry.ranking_value)}</td>`:''}<td>${officialPercent(main.coverage_pct)}</td><td>${esc(statuses[entry.ranking_status] || entry.ranking_status || entry.status)}</td></tr>
      <tr class="official-vfm-metric-row"><td colspan="${columns}"><details><summary>Point breakdown and metrics · ${esc(entry.team)}</summary><div class="table-wrap"><table><thead><tr><th>Rate</th><th>Score</th><th>R² points</th><th>MAPE points</th><th>WAPE points</th><th>R²</th><th>MAPE %</th><th>WAPE %</th><th>Valid-pair coverage</th><th>Nonzero-reference coverage</th><th>Similarity % (diagnostic)</th><th>MAE</th><th>RMSE</th></tr></thead><tbody>${details}</tbody></table></div><p class="mapping-footnote">Component points above already include coverage penalties. Overall components sum earned rate points, even when an overall average metric is N/A. Matched records ${entry.matched_rows}; unmatched uploaded rows ${entry.unmatched_prediction_rows}; invalid keys ${entry.invalid_key_rows}. No metric weight is redistributed.</p></details></td></tr>`;
  }).join('');
  return (embedded ? '<header class="leaderboard-section-heading"><h2>VFM leaderboard</h2><p>Oil /10 + Gas /10 + Water /10 · maximum 30 points.</p></header>' : intro('OFFICIAL VFM','VFM leaderboard','VFM · 30 points. Oil /10 + Gas /10 + Water /10.'))+
    `<p id="vfm-live-status" role="status" aria-live="polite">${esc(liveStatus)}</p><div class="vfm-point-caps">${['oil','gas','water'].map(c=>`<div><span>${label[c]}</span><strong>10 points</strong><small>R² 3 · MAPE 2 · WAPE 5</small></div>`).join('')}<div><span>VFM total</span><strong>30 points</strong><small>Oil + Gas + Water</small></div></div>
    <div class="${embedded ? 'vfm-ranking-panel' : 'card'}"><div class="vfm-ranking-controls">
      <label>Performance scope<select class="vfm-ranking-control" data-rank-key="scope" onchange="changeVfmRanking('scope',this.value)">${options(label,vfmRankingOptions.scope)}</select></label>
      <label>Rank by<select class="vfm-ranking-control" data-rank-key="metric" onchange="changeVfmRanking('metric',this.value)">${options(metricLabel,vfmRankingOptions.metric)}</select></label>
      <label>Minimum coverage<select class="vfm-ranking-control" data-rank-key="coverage" onchange="changeVfmRanking('coverage',this.value)">${options({'0':'All coverage','50':'At least 50%','90':'At least 90%','100':'Complete valid-pair coverage'},vfmRankingOptions.coverage)}</select></label>
      <button class="action" onclick="refresh().then(render).catch(e=>alertUser(e.message))">Refresh</button></div>
      <p id="vfm-ranking-status" role="status" aria-live="polite"><b>${label[scope]} · ${metricLabel[metric]}</b> — ${['points','similarity','r2'].includes(metric)?'higher':'lower'} is better. Equal values share a rank. Official rank uses VFM Score /30. Undefined points components earn 0; undefined raw metrics are N/A and unranked.</p>
      <div class="table-wrap"><table class="vfm-metric-leaderboard"><thead><tr><th>Rank</th><th>Participant</th><th class="${metric==='points'&&scope==='oil'?'vfm-active-metric':''}">Oil /10</th><th class="${metric==='points'&&scope==='gas'?'vfm-active-metric':''}">Gas /10</th><th class="${metric==='points'&&scope==='water'?'vfm-active-metric':''}">Water /10</th><th class="${metric==='points'&&scope==='overall'?'vfm-active-metric':''}">Overall /30</th>${extra?`<th class="vfm-active-metric">${metricLabel[metric]}</th>`:''}<th>Coverage %</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="${columns}">No participants yet.</td></tr>`}</tbody></table></div>
      <p class="mapping-footnote">R² is clamped to 0–1 for points; negative R² remains visible but earns 0 points. MAPE and WAPE of 20% or more earn 0 points. MAPE excludes zero reference values and uses nonzero-reference coverage. R² and WAPE points use coverage against all official records. Constant references have no R² points; all-zero references have undefined R²/MAPE/WAPE and no metric points. Missing/nonfinite values earn no credit. Nothing is silently replaced with zero-valued predictions.</p></div>
      <details class="${embedded ? 'leaderboard-policy' : 'card'} official-vfm-policy"><summary><b>Scoring formulas and evaluation rules</b></summary><p>${esc(policy.description || '')}</p><p>${esc(policy.ranking || '')}</p><p>${esc(policy.metrics || '')}</p><p class="mapping-footnote">Rule version: ${esc(policy.version || '')}. Overall R²/MAPE/WAPE diagnostics are equal-weight averages only when all three rates are defined. Private reference values remain private.</p></details>`;
}
