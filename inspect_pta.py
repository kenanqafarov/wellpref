from pathlib import Path
import sys
sys.path.append('wellperf-Platform/engine/src')
from wellperf import pipeline, config, loaders, pta
import pandas as pd
import numpy as np

data_dir = Path('Socar/Socar')
cache_dir = Path('wellperf-Platform/engine/artifacts')

prep = pipeline.prepare_from_dir(data_dir, cache_dir)
raw_tests = pd.read_csv(data_dir / "well_tests.csv", parse_dates=["test_start", "test_end"])
model = pipeline.train_vfm(prep, raw_tests, run_cv=False)
daily = pipeline.predict(prep, model)
analyses, failures = pipeline.analyse_all_events(prep, daily)

print(f"{'Well':<6} {'Shut-in Start':<20} {'Dur(h)':<7} {'WinStart':<8} {'WinEnd':<8} {'m':<8} {'k(mD)':<10} {'Skin':<8} {'dP_skin':<10} {'Pwf':<8} {'P*':<8}")
for event_id, a in analyses.items():
    r = a.result
    well = a.event['well_name']
    start = str(a.event['shut_in_start'])[:19]
    dur = a.data.dt_hours[-1]
    print(f"{well:<6} {start:<20} {dur:<7.2f} {r.iarf_start_hours:<8.2f} {r.iarf_end_hours:<8.2f} {r.horner_slope_psi_cycle:<8.2f} {r.permeability_md:<10.2f} {r.skin:<8.2f} {r.delta_p_skin_psi:<10.2f} {r.pwf_psia:<8.1f} {r.p_star_psia:<8.1f}")
