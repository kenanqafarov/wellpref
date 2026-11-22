import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def upload_pta_file(filepath):
    # 1. Login
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
        csrf = body['user']['csrf']

    # 2. Preview
    with open(filepath, 'rb') as f:
        file_bytes = f.read()

    preview_req = urllib.request.Request(
        'https://socar-hackathon.eastus.cloudapp.azure.com/api/upload/preview',
        data=file_bytes,
        headers={
            'Cookie': cookie_header,
            'User-Agent': 'Mozilla/5.0',
            'X-CSRF-Token': csrf,
            'X-Upload-Kind': 'pta',
            'X-Filename': 'pta_submission.csv',
            'Content-Type': 'text/csv'
        }
    )
    with urllib.request.urlopen(preview_req, context=ctx) as r:
        preview = json.loads(r.read().decode('utf-8'))

    mapping = {
        'digest': preview['digest'],
        'confirmed': True,
        'date_format': 'auto',
        'remember': True,
        'columns': [
            {'source_index': c['source_index'], 'target': c['proposed_target'], 'source_unit': c['source_unit']}
            for c in preview['columns']
        ]
    }

    # 3. Upload
    upload_req = urllib.request.Request(
        'https://socar-hackathon.eastus.cloudapp.azure.com/api/upload',
        data=file_bytes,
        headers={
            'Cookie': cookie_header,
            'User-Agent': 'Mozilla/5.0',
            'X-CSRF-Token': csrf,
            'X-Upload-Kind': 'pta',
            'X-Filename': 'pta_submission.csv',
            'X-Column-Mapping': json.dumps(mapping),
            'Content-Type': 'text/csv'
        }
    )
    with urllib.request.urlopen(upload_req, context=ctx) as r:
        res = json.loads(r.read().decode('utf-8'))
        return res

if __name__ == '__main__':
    import sys
    fn = sys.argv[1] if len(sys.argv) > 1 else 'test_pta_submission.csv'
    print(f'Uploading {fn} to portal...')
    res = upload_pta_file(fn)
    print('Result:', json.dumps(res, indent=2))
