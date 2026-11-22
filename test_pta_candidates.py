import sys
sys.path.append('wellperf-Platform/engine/src')
from wellperf import pipeline, pta
import pandas as pd
from pathlib import Path

prep = pipeline.prepare_from_dir(Path('Socar/Socar'), Path('wellperf-Platform/engine/artifacts'))
raw_tests = pd.read_csv('Socar/Socar/well_tests.csv', parse_dates=['test_start', 'test_end'])
model = pipeline.train_vfm(prep, raw_tests, run_cv=False)
daily = pipeline.predict(prep, model)
analyses, _ = pipeline.analyse_all_events(prep, daily)

for event_id, a in analyses.items():
    r = a.result
    w = a.event['well_name']
    d = a.diagnostics
    print(f'=== {w} ===')
    print(f'  Baseline: m={r.horner_slope_psi_cycle:.2f}, k={r.permeability_md:.2f}, s={r.skin:.2f}, dp={r.delta_p_skin_psi:.2f}')
    print(f'  Sweep: k in [{r.k_min_md:.2f}, {r.k_max_md:.2f}], s in [{r.skin_min:.2f}, {r.skin_max:.2f}]')
    
    # Let's test a few clean manual windows based on derivative plateaus
    if w == 'GL-04':
        for win in [(15.0, 44.0), (12.0, 40.0), (10.0, 35.0)]:
            res, _ = pta.analyse_buildup(a.data, a.inputs, window_hours=win)
            print(f'  Candidate {win}: m={res.horner_slope_psi_cycle:.2f}, k={res.permeability_md:.2f}, s={res.skin:.2f}, dp={res.delta_p_skin_psi:.2f}, R2={res.horner_fit_r2:.4f}')
    elif w == 'GL-08':
        for win in [(4.0, 35.0), (3.0, 30.0), (2.0, 25.0)]:
            res, _ = pta.analyse_buildup(a.data, a.inputs, window_hours=win)
            print(f'  Candidate {win}: m={res.horner_slope_psi_cycle:.2f}, k={res.permeability_md:.2f}, s={res.skin:.2f}, dp={res.delta_p_skin_psi:.2f}, R2={res.horner_fit_r2:.4f}')
    elif w == 'GL-02':
        for win in [(1.5, 5.0), (1.0, 4.5)]:
            res, _ = pta.analyse_buildup(a.data, a.inputs, window_hours=win)
            print(f'  Candidate {win}: m={res.horner_slope_psi_cycle:.2f}, k={res.permeability_md:.2f}, s={res.skin:.2f}, dp={res.delta_p_skin_psi:.2f}, R2={res.horner_fit_r2:.4f}')
