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

for well in ['GL-01', 'GL-06', 'GL-10']:
    ev = [a for a in analyses.values() if a.event['well_name'] == well][0]
    d = ev.diagnostics
    print(f'=== {well} (Duration: {ev.data.dt_hours[-1]:.2f}h) ===')
    for t, der, dp in zip(d.dt, d.derivative, d.dp):
        if t > 0.3 and t < 40:
            print(f'  dt={t:6.2f}h: deriv={der:6.2f}, dp={dp:6.2f}')

