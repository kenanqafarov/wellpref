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

ev_gl08 = [a for a in analyses.values() if a.event['well_name'] == 'GL-08'][0]

print('GL-08 Analysis with varying q_oil (window = 4h to 35h):')
for q in [1352.1, 1361.3]:
    inp = pta.ReservoirInputs(
        q_oil_stbd=q,
        cum_oil_stb=ev_gl08.inputs.cum_oil_stb,
        oil_fvf_rb_stb=ev_gl08.inputs.oil_fvf_rb_stb,
        oil_viscosity_cp=ev_gl08.inputs.oil_viscosity_cp,
        net_pay_ft=ev_gl08.inputs.net_pay_ft,
        porosity_frac=ev_gl08.inputs.porosity_frac,
        total_compressibility_1_psi=ev_gl08.inputs.total_compressibility_1_psi,
        wellbore_radius_ft=ev_gl08.inputs.wellbore_radius_ft
    )
    res, _ = pta.analyse_buildup(ev_gl08.data, inp, window_hours=(4.0, 35.0))
    print(f'  q={q:<6.1f} -> m={res.horner_slope_psi_cycle:<6.2f}, k={res.permeability_md:<6.2f}, s={res.skin:<6.2f}, dp={res.delta_p_skin_psi:<7.2f}')
