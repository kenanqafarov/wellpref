import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

login_url = 'https://socar-hackathon.eastus.cloudapp.azure.com/api/login'
req = urllib.request.Request(
    login_url,
    data=json.dumps({'team': 'Enthuzone', 'password': 'VVcz!Rw#%yKSXnkKwwIc0EW1'}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req, context=ctx) as resp:
    cookies = resp.headers.get_all('Set-Cookie')
    cookie_header = '; '.join([c.split(';')[0] for c in cookies]) if cookies else ''
    body = json.loads(resp.read().decode('utf-8'))
    csrf = body.get('user', {}).get('csrf', '')

def fetch_api(ep):
    r = urllib.request.Request(
        'https://socar-hackathon.eastus.cloudapp.azure.com' + ep,
        headers={'Cookie': cookie_header, 'X-CSRF-Token': csrf, 'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(r, context=ctx) as res:
        return json.loads(res.read().decode('utf-8'))

mine = fetch_api('/api/mine')
print('=== /api/mine ===')
print('Uploads count:', len(mine.get('uploads', [])))
for u in mine.get('uploads', []):
    print(u.get('kind'), u.get('filename'), u.get('created_at'), u.get('status'), u.get('points'))

lb = fetch_api('/api/leaderboard?ranking=overall&scope=overall&metric=points&sort=overall')
print('
=== LEADERBOARD OVERALL ===')
for row in lb.get('leaderboard', []):
    team = row.get('team')
    mark = ' <-- [BIZ / ENTHUZONE]' if team == 'Enthuzone' else ''
    print(str(row.get('overall_rank')) + '. ' + str(team) + ' -> Overall: ' + str(row.get('overall_points')) + ' | VFM: ' + str(row.get('vfm_points')) + ' (Rank ' + str(row.get('vfm_rank')) + ') | PTA: ' + str(row.get('pta_points')) + ' (Rank ' + str(row.get('pta_rank')) + ')' + mark)

enth = next((r for r in lb.get('leaderboard', []) if r.get('team') == 'Enthuzone'), None)
if enth:
    print('
=== ENTHUZONE DETAILED METRICS ===')
    print('PTA metrics:', json.dumps(enth.get('pta', {}), indent=2))
    print('VFM metrics:', json.dumps(enth.get('vfm', {}), indent=2))
