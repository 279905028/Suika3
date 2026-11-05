#!/usr/bin/env python3
"""切换前通过 CDN CNAME 定向测试；不修改本机 DNS，不下载整个核心包。"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('release')
parser.add_argument('output')
args = parser.parse_args()
release = Path(args.release)
manifest = json.loads((release / 'release-manifest.json').read_text())
out = Path(args.output)
assert not out.exists()
out.mkdir(parents=True)
host = 'https://galagame.site'
report = {'status': 'running', 'distributionId': manifest['distributionId'], 'checks': [], 'files': []}


def request(url, head=False, headers=None):
    with tempfile.TemporaryDirectory(prefix='suika3-cdn-check-') as temp:
        header_path, body_path = Path(temp) / 'headers', Path(temp) / 'body'
        command = ['curl', '--noproxy', '*', '--connect-timeout', '10', '--max-time', '45',
            '--connect-to', 'galagame.site:443:galagame.site.w.kunlunaq.com:443', '-sS',
            '-D', str(header_path), '-o', str(body_path), '-w', '%{http_code} %{http_version} %{time_total}']
        if head:
            command.append('-I')
        for key, value in (headers or {}).items():
            command.extend(['-H', key + ': ' + value])
        command.append(url)
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        status, version, duration = result.stdout.strip().split()
        raw = header_path.read_text()
        parsed = dict(line.split(':', 1) for line in raw.splitlines() if ':' in line)
        parsed = {k.lower(): v.strip() for k, v in parsed.items()}
        return {'status': int(status), 'httpVersion': version, 'seconds': float(duration), 'headers': parsed}, body_path.read_bytes()


try:
    def head(item):
        name = item['path'][4:]
        data, _ = request(host + manifest['assetBasePath'] + name, True, {'Accept-Encoding': 'identity'})
        assert data['status'] == 200, (name, data)
        assert int(data['headers']['content-length']) == item['bytes'], name
        assert 'max-age=31536000' in data['headers'].get('cache-control', ''), name
        return dict(path=name, **data)
    with ThreadPoolExecutor(max_workers=3) as pool:
        report['files'] = list(pool.map(head, manifest['files']))
    report['checks'].append({'name': '全部版本文件的HTTPS、长度与长期缓存', 'count': len(report['files']), 'pass': True})
    for name in ['core-loader.js', 'assets.arc', next(x['path'][4:] for x in manifest['files'] if x['path'].endswith('.mp4'))]:
        url = host + manifest['assetBasePath'] + name
        headers = {'Range': 'bytes=0-1023', 'Accept-Encoding': 'identity'}
        data, body = request(url, headers=headers)
        expected = (release / 'web' / name).read_bytes()[:1024]
        assert data['status'] == 206 and body == expected, (name, data)
        report['checks'].append({'name': name + ' 分段请求及实际内容', 'pass': True, **data})
    for attempt in range(2):
        data, body = request(host + manifest['assetBasePath'] + 'core-loader.js')
        assert hashlib.sha256(body).hexdigest() == next(x['sha256'] for x in manifest['files'] if x['path'] == 'web/core-loader.js')
    assert 'HIT' in data['headers'].get('x-cache', ''), data
    report['checks'].append({'name': 'CDN实际缓存命中', 'pass': True, **data})
    data, body = request(host + manifest['assetBasePath'] + 'index.html', headers={'Accept-Encoding': 'gzip'})
    assert data['headers'].get('content-encoding') == 'gzip'
    import gzip
    assert hashlib.sha256(gzip.decompress(body)).hexdigest() == next(x['sha256'] for x in manifest['files'] if x['path'] == 'web/index.html')
    report['checks'].append({'name': 'HTML传输压缩与内容指纹', 'pass': True, **data})
    report['status'] = 'pass'
except Exception as error:
    report['status'] = 'fail'
    report['error'] = repr(error)
finally:
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['status', 'checks']}, ensure_ascii=False, indent=2))
    if report['status'] != 'pass':
        raise SystemExit(report['error'])
