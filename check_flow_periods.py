import pandas as pd
choke = pd.read_csv('Socar/Socar/choke_events.csv', parse_dates=['timestamp'])
pta = pd.read_csv('SUBMISSION_FILES/pta_submission.csv')

for idx, r in pta.iterrows():
    well = r['well_name']
    st = pd.to_datetime(r['shut_in_time'])
    c = choke[choke['well_name'] == well].sort_values('timestamp')
    prior = c[c['timestamp'] < st]
    last_event = prior.iloc[-1] if not prior.empty else None
    t_str = str(last_event['timestamp']) if last_event is not None else 'None'
    ch = last_event['choke_opening_pct'] if last_event is not None else 0
    flow_hours = (st - last_event['timestamp']).total_seconds() / 3600.0 if last_event is not None else 0
    print(f"{well} ({st}): last choke {t_str} ({ch}%) -> flowed {flow_hours:.1f}h ({flow_hours/24:.1f} days)")
