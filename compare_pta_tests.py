import pandas as pd
sub_pta = pd.read_csv('SUBMISSION_FILES/pta_submission.csv')
wt = pd.read_csv('Socar/Socar/well_tests.csv', parse_dates=['test_start', 'test_end'])

for idx, r in sub_pta.iterrows():
    well = r['well_name']
    shut_time = pd.to_datetime(r['shut_in_time'])
    tests = wt[wt['well_name'] == well].sort_values('test_start')
    prior = tests[tests['test_start'] < shut_time]
    last_test = prior.iloc[-1] if not prior.empty else None
    t_start = str(last_test['test_start']) if last_test is not None else 'None'
    oil = last_test['oil_rate_stbd'] if last_test is not None else 0
    print(f"{well} ({shut_time}):")
    print(f"  Last test ({t_start}): oil={oil:.1f}")
    print(f"  PTA sub: k={r['permeability_md']:.2f}, m={r['horner_slope']:.2f}, skin={r['skin']:.2f}, dp_skin={r['delta_p_skin_psi']:.2f}")
