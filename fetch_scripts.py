import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://socar-hackathon.eastus.cloudapp.azure.com/', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as r:
    html = r.read().decode('utf-8')
    with open('portal_index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', html)
    print('Scripts in index.html:', scripts)
