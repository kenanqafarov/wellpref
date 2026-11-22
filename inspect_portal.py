import urllib.request
import re
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
    print('Logged in successfully. CSRF:', csrf)

def get(path):
    url = 'https://socar-hackathon.eastus.cloudapp.azure.com' + path
    r = urllib.request.Request(url, headers={'Cookie': cookie_header, 'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(r, context=ctx) as res:
            return res.read().decode('utf-8')
    except Exception as e:
        return f'ERROR: {e}'

# Get app.js
app_js = get('/app.js')
with open('portal_app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)
print(f'Saved portal_app.js ({len(app_js)} bytes)')

# Find endpoints
endpoints = sorted(set(re.findall(r'["\'](/api/[^"\']+)["\']', app_js)))
print('Endpoints in app.js:')
for ep in endpoints:
    print(' ', ep)

# Also test GET endpoints
for ep in endpoints:
    if any(param in ep for param in ['${', ':', 'preview', 'upload', 'login', 'logout']):
        continue
    res = get(ep)
    if 'ERROR' in res[:20]:
        print(f'{ep} -> {res[:60]}')
    else:
        print(f'{ep} -> OK ({len(res)} bytes): {res[:100]}...')
