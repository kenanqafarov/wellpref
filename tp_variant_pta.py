"""Test the Horner producing-time (tp) convention hypothesis.

Current: tp = 24*(cum_2025_01_01 + Np_2025)/q  (tens of years -> Horner ~ MDH)
Variant: tp = 24*Np_2025/q  (production since start of data only)
q per well is taken from the 7.18 file (implied q = k*m*h / (162.6*Bo*mu)).
"""
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
cum0 = prep.completion.set_index('well_name')['cum_oil_at_2025_01_01_stb']

rows = []
for _, a in analyses.items():
    w = a.event['well_name']
    inp, d = a.inputs, a.diagnostics
    b = base.loc[w]
    q_impl = b.permeability_md * b.horner_slope * inp.net_pay_ft / (162.6 * inp.oil_fvf_rb_stb * inp.oil_viscosity_cp)
    np_2025 = inp.cum_oil_stb - float(cum0.loc[w])
    # flattest derivative plateau window (same as deep_physics_pta.py)
    dur = a.data.dt_hours[-1]
    valid = (d.dt > 0.5) & (d.dt < dur * 0.8) & np.isfinite(d.derivative)
    t_v, der_v = d.dt[valid], d.derivative[valid]
    i = int(np.argmin([np.std(der_v[j:j + 6]) for j in range(len(der_v) - 5)]))
    win = (float(t_v[i]), float(t_v[i + 5]))
    out = {}
    for tag, cum in [('cur', inp.cum_oil_stb), ('np25', np_2025)]:
        new_inp = replace(inp, q_oil_stbd=q_impl, cum_oil_stb=cum)
        r, _ = pta.analyse_buildup(a.data, new_inp, window_hours=win)
        out[tag] = r
    rc, rv = out['cur'], out['np25']
    print(f"{w}: q={q_impl:.1f} tp_cur={rc.tp_hours:.0f}h tp_np25={rv.tp_hours:.0f}h win={win[0]:.2f}-{win[1]:.2f}h")
    print(f"   cur : m={rc.horner_slope_psi_cycle:.3f} k={rc.permeability_md:.3f} s={rc.skin:.3f} dps={rc.delta_p_skin_psi:.3f}")
    print(f"   np25: m={rv.horner_slope_psi_cycle:.3f} k={rv.permeability_md:.3f} s={rv.skin:.3f} dps={rv.delta_p_skin_psi:.3f}")
    print(f"   7.18: m={b.horner_slope:.3f} k={b.permeability_md:.3f} s={b.skin:.3f} dps={b.delta_p_skin_psi:.3f}")
    rows.append({'well_name': w, 'shut_in_time': b.shut_in_time,
                 'permeability_md': round(rv.permeability_md, 4), 'skin': round(rv.skin, 4),
                 'delta_p_skin_psi': round(rv.delta_p_skin_psi, 4), 'horner_slope': round(rv.horner_slope_psi_cycle, 4)})

pd.DataFrame(rows).sort_values('well_name').to_csv('test_pta_tp_np2025.csv', index=False)
print('written test_pta_tp_np2025.csv')
