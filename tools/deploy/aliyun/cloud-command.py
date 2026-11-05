#!/usr/bin/env python3
"""通过已授权的云助手执行指定脚本，保存结果；请勿传入会输出凭证的脚本。"""
import argparse
import json
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('script')
parser.add_argument('output')
parser.add_argument('--name', required=True)
args = parser.parse_args()
out = Path(args.output)
assert not out.exists()

def run(action, params):
    result = subprocess.run(['aliyun', 'ecs', action, '--profile', 'suika3-deploy', '--RegionId', 'cn-shanghai'] + params,
        capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)

started = run('RunCommand', ['--InstanceId.1', 'i-uf68w1tq5l7u617uh8mb', '--Type', 'RunShellScript',
    '--CommandContent', Path(args.script).read_text(), '--ContentEncoding', 'PlainText',
    '--Timeout', '420', '--KeepCommand', 'false', '--Name', args.name])
out.with_suffix('.invocation.json').write_text(json.dumps(started, indent=2) + '\n')
print(json.dumps(started), flush=True)
deadline = time.monotonic() + 480
while time.monotonic() < deadline:
    data = run('DescribeInvocationResults', ['--InvokeId', started['InvokeId'], '--InstanceId', 'i-uf68w1tq5l7u617uh8mb', '--ContentEncoding', 'PlainText'])
    rows = data.get('Invocation', {}).get('InvocationResults', {}).get('InvocationResult', [])
    if rows and rows[0]['InvocationStatus'] not in ['Running', 'Pending', 'Scheduled']:
        row = rows[0]
        out.write_text(json.dumps(row, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({k: row.get(k) for k in ['InvocationStatus', 'ExitCode', 'Output']}, ensure_ascii=False), flush=True)
        raise SystemExit(0 if row.get('ExitCode') == 0 else 1)
    time.sleep(3)
raise TimeoutError('云助手仍在运行，请通过已记录的 InvokeId 继续查询')
