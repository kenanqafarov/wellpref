import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = 'https://socar-hackathon.eastus.cloudapp.azure.com/'
for script in ['column-mapping.js', 'comparison.js', 'leaderboard.js']:
    req = urllib.request.Request(base + script, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            code = r.read().decode('utf-8')
            with open(f'portal_{script}', 'w', encoding='utf-8') as f:
                f.write(code)
            print(f'Downloaded {script} ({len(code)} bytes)')
    except Exception as e:
        print(f'Error downloading {script}: {e}')
