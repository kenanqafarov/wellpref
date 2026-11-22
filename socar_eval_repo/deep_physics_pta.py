import sys
sys.path.append('wellperf-Platform/engine/src')
from wellperf import pipeline, pta
import pandas as pd
import numpy as np
from pathlib import Path

prep = pipeline.prepare_from_dir(Path('Socar/Socar'), Path('wellperf-Platform/engine/artifacts'))
raw_tests = pd.read_csv('Socar/Socar/well_tests.csv', parse_dates=['test_start', 'test_end'])
model = pipeline.train_vfm(prep, raw_tests, run_cv=False)
daily = pipeline.predict(prep, model)
analyses, _ = pipeline.analyse_all_events(prep, daily)

pvt = pd.read_csv('Socar/Socar/reservoir_pvt.csv')
comp = pd.read_csv('Socar/Socar/well_completion.csv')

print('=== DEEP RESERVOIR PHYSICS ANALYSIS ===')
for event_id, a in analyses.items():
    w = a.event['well_name']
    r = a.result
    d = a.diagnostics
    inp = a.inputs
    dur = a.data.dt_hours[-1]
    
    # Let's find median derivative in the true radial plateau
    dt = d.dt
    deriv = d.derivative
    dp = d.dp
    
    # Find plateau where derivative is flattest
    # Filter dt > 0.5h to exclude wellbore storage
    valid = (dt > 0.5) & (dt < dur * 0.8) & np.isfinite(deriv)
    t_v = dt[valid]
    der_v = deriv[valid]
    
    # Sliding window of 5 log points to find min derivative variance
    best_var = 1e9
    best_deriv = None
    best_t_range = None
    
    for i in range(len(der_v) - 5):
        sub_der = der_v[i:i+6]
        sub_t = t_v[i:i+6]
        # flatness = std / mean
        std = np.std(sub_der)
        if std < best_var:
            best_var = std
            best_deriv = np.median(sub_der)
            best_t_range = (sub_t[0], sub_t[-1])
            
    m_theory = 2.302585 * best_deriv
    k_theory = 162.6 * inp.q_oil_stbd * inp.oil_fvf_rb_stb * inp.oil_viscosity_cp / (m_theory * inp.net_pay_ft)
    
    print(f'Well {w}:')
    print(f'  Pay h={inp.net_pay_ft}ft, Bo={inp.oil_fvf_rb_stb}, mu={inp.oil_viscosity_cp}cp, q={inp.q_oil_stbd:.1f} stb/d')
    print(f'  Best Plateau t=[{best_t_range[0]:.2f}h, {best_t_range[1]:.2f}h]: Deriv={best_deriv:.2f} psi (std={best_var:.2f})')
    print(f'  m_theory = {m_theory:.2f} psi/cycle, k_theory = {k_theory:.2f} mD')
    print(f'  Current submission: m={r.horner_slope_psi_cycle:.2f}, k={r.permeability_md:.2f}, s={r.skin:.2f}, dp={r.delta_p_skin_psi:.2f}')
