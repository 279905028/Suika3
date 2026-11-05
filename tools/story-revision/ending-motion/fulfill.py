#!/usr/bin/env python3
"""Resume the explicitly approved P4-V batch; never replay a submitted run.

Credit confirmation stays in memory. Only public recovery facts are persisted.
"""
import concurrent.futures
import datetime
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / 'qa/ending-motion-P4-V00-20261104'
state_name = sys.argv[2] if len(sys.argv) > 2 else 'generation-state.json'
if state_name not in ('generation-state.json', 'revision-state.json'):
    raise SystemExit('只允许已登记的首批或返修批次')
STATE = QA / state_name
OUTPUT_PREFIX = '' if state_name == 'generation-state.json' else 'revision-'
state = json.loads(STATE.read_text())
project = state['projectId']

def now():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    path.chmod(0o600)

def save():
    write(STATE, state)

def call(args):
    result = subprocess.run(['dreamina-canvas', *args], cwd=ROOT, capture_output=True, text=True)
    try:
        response = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError('CLI未返回JSON；保留原提交ID，仅查询状态。退出码：' + str(result.returncode)) from None
    return response

def safe_error(response):
    e = response.get('error') or {}
    return {k: e[k] for k in ('code', 'class', 'requiredAction', 'retryable') if k in e}

def request_id(response):
    return response.get('meta', {}).get('requestId')

def node_args(command):
    args = ['node', command, '--project-id', project]
    for job in state['items'].values():
        args += ['--node-id', job['videoNodeId']]
    return args

def resources(items):
    return [{k: item[k] for k in ('resourceId', 'state', 'status', 'serviceCode', 'retryable',
            'requiredAction', 'width', 'height', 'format') if k in item} for item in items]

def submit():
    approval = state.get('creditApproval', {})
    ceiling = approval.get('approvedCeiling')
    if approval.get('status') != 'user-approved' or not isinstance(ceiling, int) or ceiling <= 0:
        raise SystemExit('缺少本批积分明确授权')
    if any(j.get('runAttemptedAt') for j in state['items'].values()):
        raise SystemExit('已有提交尝试，只能status恢复，不重放run')
    response = call(node_args('show'))
    if not response.get('ok'):
        raise SystemExit(json.dumps(safe_error(response)))
    nodes = {i.get('node', {}).get('nodeId'): i.get('node', {})
             for i in response['data']['nodes'] if i.get('result') == 'FOUND'}
    frozen = {i['ending']: i for i in json.loads((QA / 'freeze-resume.json').read_text())['items']}
    for key, job in state['items'].items():
        node = nodes[job['videoNodeId']]
        generation = node['generation']
        expected = dict(mode='first_last_frame', model='seedance_2.5', ratio='16:9',
                        resolution='720p', outputCount=1, durationSeconds=5)
        assert all(generation.get(k) == v for k, v in expected.items()), key + '参数改变'
        assert node['status'] == 'empty' and not node.get('resources'), key + '已有生成结果'
        assert job['imageNodeId'] in node['upstreamNodeIds'], key + '来源连线改变'
        assert [(r['kind'], r['id']) for r in generation['references']] == [('node', job['imageNodeId'])]
        prompt = job.get('prompt') or frozen[key]['prompt']
        assert generation['prompt'] == (ROOT / prompt['path']).read_text(), key + '提示改变'
    confirm = call(node_args('confirm') + ['--credit-ceiling', str(ceiling)])
    if not confirm.get('ok'):
        write(QA / (OUTPUT_PREFIX+'confirm-error.json'), {'at': now(), 'error': safe_error(confirm), 'requestId': request_id(confirm)})
        raise SystemExit(json.dumps(safe_error(confirm)))
    data = confirm['data']
    assert data['creditCeiling'] == ceiling
    assert data['consumptionSubject'] == approval['consumptionSubject']
    token = data['creditConfirmationToken']
    state['creditApproval'].update(status='confirmed', confirmRequestId=request_id(confirm), confirmedAt=now())
    for job in state['items'].values():
        job.update(runAttemptedAt=now(), phase='submission-in-progress')
    save()
    args = node_args('run')
    for job in state['items'].values():
        args += ['--submit-id', job['submitId']]
    response = call(args + ['--credit-token', token])
    del token
    data = response.get('data') or response.get('partialData') or {}
    safe = {'at': now(), 'ok': response.get('ok'), 'requestId': request_id(response),
            'error': safe_error(response), 'items': []}
    for item in data.get('items', []):
        record = {k: item[k] for k in ('nodeId', 'submitId', 'state') if k in item}
        record['resources'] = resources(item.get('resources', []))
        record['error'] = {k: v for k, v in (item.get('error') or {}).items() if k == 'serviceCode'}
        safe['items'].append(record)
        for job in state['items'].values():
            if job['submitId'] == item.get('submitId'):
                job.update(phase=str(item.get('state', 'unknown')).lower(), run=record,
                           runRequestId=request_id(response))
    save()
    write(QA / (OUTPUT_PREFIX+'run-result.json'), safe)
    print(json.dumps(safe, ensure_ascii=False), flush=True)

def status():
    def inspect(pair):
        key, job = pair
        response = call(['operation', 'status', job['submitId'], '--project-id', project])
        d = response.get('data') or response.get('partialData') or {}
        result = {'ending': key, 'at': now(), 'ok': response.get('ok'),
                  'requestId': request_id(response), 'error': safe_error(response)}
        result.update({k: d[k] for k in ('operationRef', 'state', 'submission') if k in d})
        result['resources'] = resources(d.get('resources', []))
        if d.get('submissionError'):
            result['submissionError'] = {k: v for k, v in d['submissionError'].items()
                                         if k in ('serviceCode', 'reason', 'retryable', 'requiredAction')}
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(inspect, state['items'].items()))
    for record in records:
        job = state['items'][record['ending']]
        job['operation'] = record
        if record.get('state'):
            job['phase'] = record['state']
    save()
    write(QA / (OUTPUT_PREFIX+'operation-status.json'), records)
    print(json.dumps(records, ensure_ascii=False), flush=True)

def download():
    results = []
    for key, job in state['items'].items():
        if job.get('download'):
            results.append({'ending': key, 'status': 'already-downloaded'})
            continue
        operation = job.get('operation', {})
        if operation.get('state') not in ('succeeded', 'success'):
            results.append({'ending': key, 'status': 'not-ready', 'operationState': operation.get('state')})
            continue
        media = operation.get('resources', [])
        assert len(media) == 1 and media[0]['state'] in ('succeeded', 'success')
        version = 'v001' if not OUTPUT_PREFIX else 'v002'
        target = ROOT / 'assets/sources/20261104/P4-V' / key / ('raw-'+version+'.mp4')
        assert not target.exists(), '目标已存在，先核查后再继续：' + key
        response = call(['resource', 'download', media[0]['resourceId'], '--project-id', project,
                         '--output', str(target)])
        result = {'ending': key, 'ok': response.get('ok'), 'requestId': request_id(response)}
        if response.get('ok'):
            d = response['data']
            assert d['size'] > 0 and target.stat().st_size == d['size']
            import hashlib
            assert hashlib.sha256(target.read_bytes()).hexdigest() == d['sha256']
            job['download'] = {k: d[k] for k in ('resourceId', 'path', 'size', 'sha256')}
            job['download'].update(method='dreamina-canvas resource download', downloadedAt=now())
            save()
            result.update(job['download'])
        else:
            result['error'] = safe_error(response)
        results.append(result)
    write(QA / (OUTPUT_PREFIX+'download-result.json'), results)
    print(json.dumps(results, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    if sys.argv[1] == 'submit':
        submit()
    elif sys.argv[1] == 'status':
        status()
    elif sys.argv[1] == 'download':
        download()
    else:
        raise SystemExit('仅支持submit（一次性已授权批次）、status（只读恢复）或download')
