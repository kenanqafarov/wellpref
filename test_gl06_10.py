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

for well, win in [('GL-06', (1.4, 5.6)), ('GL-10', (1.0, 3.5)), ('GL-01', (2.0, 5.0))]:
    ev = [a for a in analyses.values() if a.event['well_name'] == well][0]
    r, _ = pta.analyse_buildup(ev.data, ev.inputs, window_hours=win)
    r_old = ev.result
    print(f'=== {well} ===')
    print(f'  Old: m={r_old.horner_slope_psi_cycle:.2f}, k={r_old.permeability_md:.2f}, s={r_old.skin:.2f}, dp={r_old.delta_p_skin_psi:.2f}')
    print(f'  New: m={r.horner_slope_psi_cycle:.2f}, k={r.permeability_md:.2f}, s={r.skin:.2f}, dp={r.delta_p_skin_psi:.2f}, R2={r.horner_fit_r2:.4f}')

