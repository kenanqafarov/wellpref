import urllib.request
import ssl
import json

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
print('=== /api/mine UPLOADS ===')
for u in mine.get('uploads', []):
    print(f"[{u.get('kind')}] {u.get('filename')} -> status: {u.get('status')}, points: {u.get('points')}")

lb = fetch_api('/api/leaderboard?ranking=overall&scope=overall&metric=points&sort=overall')

print('\n=== ALL TEAMS OVERALL RANKINGS ===')
for row in lb.get('leaderboard', []):
    team = row.get('team')
    mark = '  <=== BİZİM KOMANDA (Enthuzone)' if team == 'Enthuzone' else ''
    print(f"Rank {row.get('overall_rank')}: {team:<20} | Total: {row.get('overall_points')} / 50 | VFM: {row.get('vfm_points')} / 30 | PTA: {row.get('pta_points')} / 20{mark}")

enth = next((r for r in lb.get('leaderboard', []) if r.get('team') == 'Enthuzone'), None)
if enth:
    print('\n=== ENTHUZONE DETAILED METRICS ===')
    print('Overall Rank:', enth.get('overall_rank'), 'Points:', enth.get('overall_points'))
    print('VFM Rank:', enth.get('vfm_rank'), 'Points:', enth.get('vfm_points'))
    print('PTA Rank:', enth.get('pta_rank'), 'Points:', enth.get('pta_points'))
    print('\nVFM breakdown:')
    print(json.dumps(enth.get('vfm', {}), indent=2))
    print('\nPTA breakdown:')
    print(json.dumps(enth.get('pta', {}), indent=2))
