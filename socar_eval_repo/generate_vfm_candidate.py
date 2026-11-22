import pandas as pd
from pathlib import Path
import sys
sys.path.append('wellperf-Platform/engine/src')
from wellperf import pipeline

prep = pipeline.prepare_from_dir(Path('Socar/Socar'), Path('wellperf-Platform/engine/artifacts'))
daily = prep.daily

vfm = pd.read_csv('SUBMISSION_FILES/vfm_daily_predictions.csv')
vfm['date'] = pd.to_datetime(vfm['timestamp'])

# Merge with prep.daily on well_name and date
m = pd.merge(vfm, daily[['well_name', 'date', 'recorded_minutes']], on=['well_name', 'date'], how='left')
m['scale'] = 1.0
mask = (m['recorded_minutes'] < 1440) & (m['recorded_minutes'] > 0)
m.loc[mask, 'scale'] = m.loc[mask, 'recorded_minutes'] / 1440.0

cand = vfm.copy()
for col in ['oil_rate_stbd', 'water_rate_stbd', 'gas_rate_mscfd']:
    cand[col] = (cand[col] * m['scale']).round(1)

cand = cand[['timestamp', 'well_name', 'oil_rate_stbd', 'water_rate_stbd', 'gas_rate_mscfd']]
cand.to_csv('test_vfm_uptime_fix.csv', index=False)

print('Generated test_vfm_uptime_fix.csv!')
changed = (m['scale'] < 0.999).sum()
print(f'Rows scaled: {changed}')
print('Sample changed rows:')
print(pd.concat([vfm[mask][['timestamp', 'well_name', 'oil_rate_stbd']], cand[mask][['oil_rate_stbd']]], axis=1, keys=['old', 'new']).head(10))

