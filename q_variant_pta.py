"""q hypothesis: reference may use the predicted DAILY oil rate (Qo, uptime included) of the
last day(s) before shut-in, rather than our mean flowing rate over the last 3 full days."""
import sys
sys.path.append('wellperf-Platform/engine/src')
from dataclasses import replace
from pathlib import Path
import numpy as np
import pandas as pd
from wellperf import pipeline, pta

prep = pipeline.prepare_from_dir(Path('Socar/Socar'), Path('wellperf-Platform/engine/artifacts'))
raw_tests = pd.read_csv('Socar/Socar/well_tests.csv', parse_dates=['test_start', 'test_end'])
model = pipeline.train_vfm(prep, raw_tests, run_cv=False)
daily = pipeline.predict(prep, model)
analyses, _ = pipeline.analyse_all_events(prep, daily)
base = pd.read_csv('test_pta_gl02_04.csv').set_index('well_name')
sub = pd.read_csv('SUBMISSION_FILES/vfm_daily_predictions.csv', parse_dates=['timestamp']).rename(columns={'timestamp': 'date'})

rows = []
for _, a in analyses.items():
    w = a.event['well_name']
    inp, d = a.inputs, a.diagnostics
    b = base.loc[w]
    shut = a.event['shut_in_start']
    day = shut.normalize()
    s = sub[(sub.well_name == w)].set_index('date').sort_index()
    prev = s.loc[s.index < day, 'oil_rate_stbd']
    q_prev1 = float(prev.iloc[-1])
    q_prev3 = float(prev.iloc[-3:].mean())
    q_prev7 = float(prev.iloc[-7:].mean())
    q_shutday = float(s.loc[day, 'oil_rate_stbd']) if day in s.index else np.nan
    q_impl = b.permeability_md * b.horner_slope * inp.net_pay_ft / (162.6 * inp.oil_fvf_rb_stb * inp.oil_viscosity_cp)
    print(f"{w} shut={shut}: q_used(7.18)={q_impl:.1f} prev1={q_prev1:.1f} prev3={q_prev3:.1f} prev7={q_prev7:.1f} shutday={q_shutday:.1f}")
    dur = a.data.dt_hours[-1]
    valid = (d.dt > 0.5) & (d.dt < dur * 0.8) & np.isfinite(d.derivative)
    t_v, der_v = d.dt[valid], d.derivative[valid]
    i = int(np.argmin([np.std(der_v[j:j + 6]) for j in range(len(der_v) - 5)]))
    win = (float(t_v[i]), float(t_v[i + 5]))
    r, _ = pta.analyse_buildup(a.data, replace(inp, q_oil_stbd=q_prev1), window_hours=win)
    print(f"   prev1-q: m={r.horner_slope_psi_cycle:.3f} k={r.permeability_md:.3f} s={r.skin:.3f} dps={r.delta_p_skin_psi:.3f}")
    rows.append({'well_name': w, 'shut_in_time': b.shut_in_time,
                 'permeability_md': round(r.permeability_md, 4), 'skin': round(r.skin, 4),
                 'delta_p_skin_psi': round(r.delta_p_skin_psi, 4), 'horner_slope': round(r.horner_slope_psi_cycle, 4)})
pd.DataFrame(rows).sort_values('well_name').to_csv('test_pta_q_prev1.csv', index=False)
print('written test_pta_q_prev1.csv')
