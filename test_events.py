import urllib.request
import ssl
import json
import time

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

print('Connecting to /api/vfm/events...')
r = urllib.request.Request('https://socar-hackathon.eastus.cloudapp.azure.com/api/vfm/events', headers={'Cookie': cookie_header, 'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(r, context=ctx, timeout=4) as stream:
        for _ in range(10):
            line = stream.readline()
            if not line: break
            print('SSE:', line.decode('utf-8', errors='ignore').strip())
except Exception as e:
    print('SSE stream result:', e)
