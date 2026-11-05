#!/usr/bin/env python3
"""ECS 专用：同步本机证书并在现有年度流量包接近耗尽时停止指定 CDN。"""
import argparse
import base64
import datetime
from decimal import Decimal
import hashlib
import hmac
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

DOMAIN = 'galagame.site'
ROLE = 'Suika3GalagameCdnMaintenance'
PACKAGE = 'CDN/DCDN_ResourcePack-cn-6ss5179rd000j4'
RESERVE_GB = Decimal('5')
STATE = Path('/var/lib/suika3-cdn')
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


def read_response(request):
    try:
        with OPENER.open(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        try:
            data = json.loads(error.read())
            # 不记录请求、凭证、证书私钥或可能回显参数的 Message。
            code = str(data.get('Code', error.code))
            request_id = str(data.get('RequestId', ''))
        except (ValueError, TypeError):
            code, request_id = str(error.code), ''
        raise RuntimeError('API error {} request {}'.format(code, request_id)) from None


def credentials():
    host = 'http://100.100.100.200/latest/'
    token = read_response(urllib.request.Request(host + 'api/token', method='PUT',
        headers={'X-aliyun-ecs-metadata-token-ttl-seconds': '300'})).decode()
    data = json.loads(read_response(urllib.request.Request(host + 'meta-data/ram/security-credentials/' + ROLE,
        headers={'X-aliyun-ecs-metadata-token': token})))
    if data.get('Code') != 'Success':
        raise RuntimeError('ECS role credentials unavailable')
    return data


def api(endpoint, version, action, parameters):
    cred = credentials()
    params = dict(parameters, Action=action, Version=version, Format='JSON',
        AccessKeyId=cred['AccessKeyId'], SecurityToken=cred['SecurityToken'],
        SignatureMethod='HMAC-SHA1', SignatureVersion='1.0',
        SignatureNonce=str(uuid.uuid4()), Timestamp=utc_now().strftime('%Y-%m-%dT%H:%M:%SZ'))
    quote = lambda value: urllib.parse.quote(str(value), safe='~')
    canonical = '&'.join(quote(k) + '=' + quote(v) for k, v in sorted(params.items()))
    sign = hmac.new((cred['AccessKeySecret'] + '&').encode(), ('POST&%2F&' + quote(canonical)).encode(), hashlib.sha1).digest()
    params['Signature'] = base64.b64encode(sign).decode()
    body = urllib.parse.urlencode(params).encode()
    request = urllib.request.Request('https://' + endpoint + '/', data=body, method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    data = json.loads(read_response(request))
    if data.get('Success') is False or ('Code' in data and data['Code'] not in ('Success', '200')):
        raise RuntimeError('API rejected ' + str(data.get('Code', 'unknown')))
    return data


def save_state(name, data):
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    target = STATE / name
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(target)


def package_reason(package, now):
    if not package:
        return '年度流量包已失效或不再可查询', None
    expiry = datetime.datetime.strptime(package['ExpiryTime'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
    factors = {'B': Decimal(1) / 1024 ** 3, 'KB': Decimal(1) / 1024 ** 2,
               'MB': Decimal(1) / 1024, 'GB': Decimal(1), 'TB': Decimal(1024)}
    if package['RemainingAmountUnit'] not in factors:
        raise ValueError('Unknown package unit')
    amount = Decimal(package['RemainingAmount']) * factors[package['RemainingAmountUnit']]
    if not amount.is_finite() or amount < 0:
        raise ValueError('Invalid remaining amount')
    if package.get('Status') != 'Available' or expiry <= now:
        return '年度流量包已到期或不可用', amount
    if amount <= RESERVE_GB:
        return '年度流量包剩余不超过 5 GB，保留统计延迟余量', amount
    return None, amount


def guard(check_only=False):
    state = {'checkedAt': utc_now().isoformat(), 'domain': DOMAIN, 'packageId': PACKAGE}
    try:
        package = None
        for page in range(1, 101):
            result = api('business.aliyuncs.com', '2017-12-14', 'QueryResourcePackageInstances', {'PageNum': page, 'PageSize': 300})
            data = result['Data']
            package = next((x for x in data['Instances']['Instance'] if x['InstanceId'] == PACKAGE), None)
            if package or page * 300 >= data['TotalCount']:
                break
        else:
            raise RuntimeError('Package pagination exceeded')
        reason, amount = package_reason(package, utc_now())
        state.update(remainingGB=str(amount) if amount is not None else None, consecutiveErrors=0)
    except Exception as error:
        previous = json.loads((STATE / 'guard.json').read_text()) if (STATE / 'guard.json').exists() else {}
        failures = previous.get('consecutiveErrors', 0) + 1
        state.update(consecutiveErrors=failures, error=type(error).__name__ + ': ' + str(error))
        reason = '连续三次无法核查年度流量包，保护性暂停' if failures >= 3 else None
        if check_only:
            raise
    state['reason'] = reason
    if reason and not check_only:
        result = api('cdn.aliyuncs.com', '2018-05-10', 'StopCdnDomain', {'DomainName': DOMAIN})
        state.update(action='stopped', requestId=result.get('RequestId'))
    else:
        state['action'] = 'would-stop' if reason else 'within-package'
    if not check_only:
        save_state('guard.json', state)
    print(json.dumps(state, ensure_ascii=False))


def certificate():
    folder = Path('/etc/letsencrypt/live') / DOMAIN
    public = (folder / 'fullchain.pem').read_text()
    fingerprint = hashlib.sha256(public.encode()).hexdigest()
    previous = json.loads((STATE / 'certificate.json').read_text()) if (STATE / 'certificate.json').exists() else {}
    if previous.get('sha256') == fingerprint:
        print(json.dumps({'certificate': 'already-synchronized', 'sha256': fingerprint}))
        return
    result = api('cdn.aliyuncs.com', '2018-05-10', 'SetCdnDomainSSLCertificate', {
        'DomainName': DOMAIN, 'SSLProtocol': 'on', 'CertType': 'upload',
        'CertName': 'galagame-le-' + fingerprint[:12], 'SSLPub': public,
        'SSLPri': (folder / 'privkey.pem').read_text()})
    state = {'syncedAt': utc_now().isoformat(), 'sha256': fingerprint, 'requestId': result.get('RequestId')}
    save_state('certificate.json', state)
    print(json.dumps(state))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['guard', 'check', 'certificate'])
    args = parser.parse_args()
    try:
        if args.action == 'certificate':
            certificate()
        else:
            guard(check_only=args.action == 'check')
    except Exception as error:
        print(json.dumps({'error': type(error).__name__ + ': ' + str(error)}))
        sys.exit(1)
