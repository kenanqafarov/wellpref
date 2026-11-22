"""Print the Bourdet derivative profile of every build-up and the Horner fit for each candidate
radial-flow window (every 6-point log window), to find alternative IARF interpretations."""
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

for _, a in analyses.items():
    w = a.event['well_name']
    inp, d = a.inputs, a.diagnostics
    b = base.loc[w]
    q = b.permeability_md * b.horner_slope * inp.net_pay_ft / (162.6 * inp.oil_fvf_rb_stb * inp.oil_viscosity_cp)
    inp = replace(inp, q_oil_stbd=q)
    dur = a.data.dt_hours[-1]
    print(f"\n=== {w}  duration={dur:.1f}h  q={q:.1f}  submitted m={b.horner_slope:.2f} k={b.permeability_md:.2f} s={b.skin:.2f}")
    ok = np.isfinite(d.derivative) & (d.dt > 0.05)
    idx = np.where(ok)[0]
    for j in idx[::max(1, len(idx) // 25)]:
        print(f"  dt={d.dt[j]:8.3f}h  dp={d.dp[j]:8.2f}  deriv={d.derivative[j]:8.2f}")
    print("  candidate windows (6 pts): t_start-t_end  CV%  m  k  s  dps")
    for i in range(0, len(idx) - 5, 3):
        a_, b_ = idx[i], idx[i + 5]
        seg = d.derivative[a_:b_ + 1]
        cv = np.std(seg) / np.mean(seg) * 100
        if cv > 6 or d.dt[a_] < 0.3:
            continue
        try:
            f = pta.semilog_fit(d, a.data.pwf_psia, inp, a_, b_)
        except pta.PTAError:
            continue
        print(f"   {d.dt[a_]:7.2f}-{d.dt[b_]:7.2f}h  {cv:4.1f}  {f.m:8.2f} {f.k:8.2f} {f.skin:6.2f} {0.869 * f.m * f.skin:8.2f}")
