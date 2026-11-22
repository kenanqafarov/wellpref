/* Presentation for the shared point ledger. No scoring or reference data in the browser. */
window.HackathonLeaderboard = (() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => value == null ? 'N/A' : Number(value).toLocaleString(undefined,{maximumFractionDigits:6});
  const points = (value,maximum) => value == null ? '—' : `${number(value)} / ${maximum}`;
  const percent = value => value == null ? '—' : `${number(value)}%`;
  const medal = rank => rank != null && rank <= 3 ? `podium podium-${rank}` : '';
  const team = (row, me) => `${safe(row.team)}${row.team === me?.team ? ' · you' : ''}`;
  const status = value => ({evaluated:'Ranked',no_submission:'No submission',needs_resubmission:'Needs resubmission'}[value] || value);
  const names = {overall:'Overall',oil:'Oil',gas:'Gas',water:'Water',horner_slope:'Horner slope',permeability:'Permeability',skin:'Skin',skin_pressure_drop:'ΔP Skin',points:'Points',r2:'R²',mape_pct:'MAPE %',wape_pct:'WAPE %',mae:'MAE'};
  const sortName = key => ({overall:'Overall score',vfm:'VFM score',pta:'PTA score'}[key] || key.split('.').map(part => names[part] || part.toUpperCase()).join(' · '));

  const scopes = {
    overall:{overall:'All phases'},
    vfm:{overall:'All rates',oil:'Oil',gas:'Gas',water:'Water'},
    pta:{overall:'All parameters',horner_slope:'Horner slope',permeability:'Permeability',skin:'Skin',skin_pressure_drop:'ΔP Skin'}
  };
  const metrics = {
    overall:{points:'Combined score /50'},
    vfm:{points:'VFM score /30',r2:'R²',mape_pct:'MAPE %',wape_pct:'WAPE %'},
    pta:{points:'PTA score /20',mae:'MAE',wape_pct:'WAPE %'}
  };

  function sortSelection(sort) {
    if (sort === 'overall') return {ranking:'overall',scope:'overall',metric:'points'};
    const [ranking,scope='overall',metric='points'] = sort.split('.');
    return {ranking,scope,metric};
  }

  function sortKey(ranking, scope, metric) {
    if (!scopes[ranking] || ranking === 'overall') return 'overall';
    if (!(scope in scopes[ranking])) scope = 'overall';
    if (!(metric in metrics[ranking]) || (ranking === 'pta' && scope === 'overall')) metric = 'points';
    if (scope === 'overall' && metric === 'points') return ranking;
    return `${ranking}.${scope}.${metric}`;
  }

  function ptaSummary(board, participant) {
    const row = board?.leaderboard?.find(row => row.team === participant);
    if (row?.pta_points == null) return '<div class="notice">Upload PTA Horner slope, permeability, skin and ΔP Skin predictions to receive your score. Only the latest valid PTA upload counts.</div>';
    const metrics=['horner_slope','permeability','skin','skin_pressure_drop'].map(parameter=>{const m=row.pta.metrics[parameter] || {};return `<tr><th>${names[parameter]}</th><td>${number(m.points)} / 5</td><td>${number(m.wape_pct)}</td><td>${number(m.mae)} ${safe(m.unit || '')}</td></tr>`;}).join('');
    return `<div class="comparison-counts"><span>PTA score <b>${points(row.pta_points,20)}</b></span><span>Rank <b>${row.pta_rank}</b></span><span>Coverage <b>${percent(row.pta.coverage_pct)}</b></span><span>PTA maximum <b>20 points</b></span></div><div class="table-wrap card"><table class="own-pta-metrics"><caption>Your latest PTA accuracy metrics</caption><thead><tr><th>Parameter</th><th>Points</th><th>WAPE %</th><th>MAE</th></tr></thead><tbody>${metrics}</tbody></table></div>`;
  }

  function render(board, vfmMarkup, me, liveStatus) {
    const rows = board?.leaderboard || [];
    const allocation = board?.allocation || {notice:'Loading point allocations…'};
    const sortedBy = board?.selection?.sort || 'overall';
    const selected = sortSelection(sortedBy);
    const options = (values,current) => Object.entries(values).map(([value,label]) => `<option value="${safe(value)}" ${value===current?'selected':''}>${safe(label)}</option>`).join('');
    const rankingChoices = options({overall:'Overall · VFM + PTA',vfm:'VFM only',pta:'PTA only'},selected.ranking);
    const scopeChoices = options(scopes[selected.ranking],selected.scope);
    const metricLabels = {...metrics[selected.ranking]};
    if (selected.scope !== 'overall') metricLabels.points = selected.ranking === 'vfm' ? 'Rate score /10' : 'Parameter score /5';
    const metricChoices = options(selected.ranking === 'pta' && selected.scope === 'overall' ? {points:metricLabels.points} : metricLabels,selected.metric);
    const title = {overall:'Overall leaderboard',vfm:'VFM ranking',pta:'PTA ranking'}[selected.ranking];
    const description = {overall:'Earned VFM /30 + PTA /20 · maximum 50 points.',vfm:'Rank by VFM results. Oil /10 + Gas /10 + Water /10 · maximum 30 points.',pta:'Rank by PTA results. Horner slope /5 + Permeability /5 + Skin /5 + ΔP Skin /5 · maximum 20 points.'}[selected.ranking];
    const explanation = selected.ranking === 'overall' ? 'Overall points = earned VFM + earned PTA. Missing phases contribute no points; partial results are marked.' : `Only ${selected.ranking.toUpperCase()} results determine this rank. Participants without a valid ${selected.ranking.toUpperCase()} result are unranked.`;
    const overall = rows.map(row => `<tr class="${medal(row.selected_rank)}" data-participant="${safe(row.team)}"><td>${row.selected_rank ?? '—'}</td><td><b>${team(row,me)}</b></td><td>${points(row.vfm_points,30)}</td><td>${points(row.pta_points,20)}</td><td><b>${points(row.overall_points,50)}</b><small>VFM /30 + PTA /20</small></td>${['overall','vfm','pta'].includes(sortedBy)?'':`<td>${number(row.selected_value)}</td>`}<td>${safe(selected.ranking === 'overall' ? row.status : status(row[selected.ranking].status))}</td></tr>`).join('');
    const overallColumns = ['overall','vfm','pta'].includes(sortedBy) ? 6 : 7;
    const ptaRows = [...rows].sort((a,b)=>(a.pta_rank ?? Infinity)-(b.pta_rank ?? Infinity) || a.team.localeCompare(b.team)).map(row => {
      const fields = ['horner_slope','permeability','skin','skin_pressure_drop'];
      const metrics = row.pta.metrics;
      const details = fields.map(field => {
        const metric = metrics[field] || {};
        return `<tr><th>${names[field]}</th><td>${points(metric.points,5)}</td><td>${number(metric.wape_pct)}</td><td>${number(metric.mae)} ${safe(metric.unit || '')}</td><td>${safe(metric.method || 'No current evaluation')}</td></tr>`;
      }).join('');
      return `<tr class="${medal(row.pta_rank)}" data-participant="${safe(row.team)}"><td>${row.pta_rank ?? '—'}</td><td><b>${team(row,me)}</b></td>${fields.map(field=>`<td>${points(metrics[field]?.points,5)}</td>`).join('')}<td><b>${points(row.pta_points,20)}</b></td><td>${percent(row.pta.coverage_pct)}</td><td>${safe(status(row.pta.status))}</td></tr>
        <tr class="pta-details"><td colspan="9"><details><summary>PTA metrics · ${safe(row.team)}</summary><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Points</th><th>WAPE %</th><th>MAE</th><th>Scoring method</th></tr></thead><tbody>${details}</tbody></table></div><p>Coverage: ${percent(row.pta.coverage_pct)}. Missing official records earn no credit. PTA maximum: 20 points.</p></details></td></tr>`;
    }).join('');
    return `<div class="page-top"><div><span class="eyebrow">LIVE HACKATHON</span><h1>Hackathon leaderboards</h1><p class="muted">Latest valid submissions · VFM, PTA and Overall rankings</p></div></div>
      <p id="hackathon-live-status" role="status" aria-live="polite">${safe(liveStatus || 'Connecting to live rankings…')}</p>
      <div class="notice scoring-allocation" role="note"><b>Overall maximum: 50 points · VFM: 30 · PTA: 20</b><p>${safe(allocation.notice)}</p><div class="allocation-grid"><span>VFM <b>30 points</b><small>Oil /10 + Gas /10 + Water /10</small></span><span>PTA <b>20 points</b><small>Horner slope /5 + k /5 + Skin /5 + ΔP Skin /5</small></span><span>Overall <b>50 points</b><small>Earned VFM + earned PTA</small></span></div></div>
      <section class="card leaderboard-section" aria-labelledby="overall-leaderboard-title"><header class="leaderboard-section-heading"><h2 id="overall-leaderboard-title">${title}</h2><p>${description}</p></header><div class="leaderboard-sort-controls"><label class="leaderboard-sort">Ranking<select class="vfm-ranking-control" data-rank-key="combined-ranking" onchange="changeHackathonSort('ranking',this.value)">${rankingChoices}</select></label><label class="leaderboard-sort">${selected.ranking === 'pta' ? 'Parameter' : 'Rate / scope'}<select class="vfm-ranking-control" data-rank-key="combined-scope" onchange="changeHackathonSort('scope',this.value)" ${selected.ranking === 'overall' ? 'disabled' : ''}>${scopeChoices}</select></label><label class="leaderboard-sort">Metric<select class="vfm-ranking-control" data-rank-key="combined-metric" onchange="changeHackathonSort('metric',this.value)" ${selected.ranking === 'overall' || (selected.ranking === 'pta' && selected.scope === 'overall') ? 'disabled' : ''}>${metricChoices}</select></label></div><p class="mapping-footnote" role="status" aria-live="polite">${safe(sortName(sortedBy))}: ${board?.selection?.direction==='lower'?'lower':'higher'} is better. Equal values share a rank. ${explanation} Undefined metrics are unranked.</p><div class="table-wrap"><table class="overall-leaderboard"><thead><tr><th>Rank by selected metric</th><th>Participant</th><th ${sortedBy === 'vfm' ? 'aria-sort="descending"' : ''}>VFM /30</th><th ${sortedBy === 'pta' ? 'aria-sort="descending"' : ''}>PTA /20</th><th ${sortedBy === 'overall' ? 'aria-sort="descending"' : ''}>Overall /50</th>${overallColumns===7?`<th aria-sort="${board?.selection?.direction === 'lower' ? 'ascending' : 'descending'}">${safe(sortName(sortedBy))}</th>`:''}<th>Status</th></tr></thead><tbody>${overall || `<tr><td colspan="${overallColumns}">No participants yet.</td></tr>`}</tbody></table></div><button class="action" onclick="exportRanking()">↓ Export leaderboard CSV</button></section>
      <section class="card leaderboard-section pta-ranking-section" aria-labelledby="pta-leaderboard-title"><header class="leaderboard-section-heading"><h2 id="pta-leaderboard-title">PTA leaderboard</h2><p>Horner slope /5 + Permeability /5 + Skin /5 + ΔP Skin /5 · maximum 20 points.</p></header><div class="table-wrap"><table class="pta-leaderboard"><thead><tr><th>Rank</th><th>Participant</th><th>Horner slope /5</th><th>Permeability /5</th><th>Skin /5</th><th>ΔP Skin /5</th><th>PTA /20</th><th>Coverage</th><th>Status</th></tr></thead><tbody>${ptaRows || '<tr><td colspan="9">No participants yet.</td></tr>'}</tbody></table></div><details class="leaderboard-policy pta-policy"><summary>PTA scoring formulas and allocation</summary><p>${safe(board?.policy?.pta?.description)}</p><p>${safe(board?.policy?.pta?.formulas)}</p><p>${safe(board?.policy?.pta?.ranking)}</p></details></section>
      <section class="card leaderboard-section vfm-ranking-section">${vfmMarkup}</section>`;
  }
  return {render,ptaSummary,sortSelection,sortKey};
})();
