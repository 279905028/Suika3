#!/usr/bin/env python3
"""本批源码范围与常见凭证检查；只读扫描，不暂存，不修改历史批次。"""
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip('\0').split('\0')


tracked = set(git('ls-files', '-z')) - {''}
changed = set(git('diff', 'HEAD', '--name-only', '-z')) - {''}
untracked = set(git('ls-files', '--others', '--exclude-standard', '-z')) - {''}
selected = set(changed)
for rel in untracked:
    p = Path(rel)
    if p.parts[0] in {'docs', 'tools', 'assets'}:
        selected.add(rel)
    elif p.parts[0] == 'qa':
        batch = p.parts[1]
        if batch in {'github-release-20261105', 'my56-libtv-binding-20261105'}:
            selected.add(rel)
        elif not batch.startswith('aliyun-'):
            # 只提交可读交接、测试工具及最终报告，排除重复的工作树和构建快照。
            if any(x.startswith(('before', 'build-', 'preview-', 'runtime-', 'candidate-', 'native'))
                   for x in p.parts[2:-1]):
                if not (batch == 'dialogue-p5-motion-20261104' and '/native/v3/' in rel
                        and p.name in {'report.json', 'binary-check.json', 'render-lifecycle-review.json'}):
                    continue
            if p.suffix in {'.md', '.cjs', '.py', '.sh'} or (
                p.suffix == '.json' and (
                    p.name.startswith(('report', 'summary', 'verification', 'package-verification'))
                    or p.name in {'adoption.json', 'coverage-model.json', 'visual-spotcheck.json',
                                  'visual-checklist-supplement.json', 'name-fade-review.json'})):
                selected.add(rel)

patterns = {
    'private-key': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    'github-token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{40,})\b',
    'aws-access-key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'aliyun-access-key': rb'\bLTAI[A-Za-z0-9]{16,}\b',
    'literal-secret': rb'["\x27](?:accessKeySecret|AccessKeySecret|SecretAccessKey|client_secret)["\x27]\s*:\s*["\x27][A-Za-z0-9+/=_-]{20,}["\x27]',
}
hits = []
large = []
for rel in sorted(selected):
    p = ROOT / rel
    if not p.is_file():
        continue
    if p.stat().st_size >= 50 * 1024 ** 2:
        large.append(rel)
    data = p.read_bytes()
    for kind, pattern in patterns.items():
        if re.search(pattern, data):
            hits.append({'path': rel, 'pattern': kind})
build = json.loads((ROOT / 'qa/dialogue-p5-motion-20261104/build-my56-libtv-20261105/build-result.json').read_text())
coverage = []
missing = []
for x in build['inputs']:
    rel = x['path']
    category = 'git' if rel in tracked or rel in selected else 'frozen-archive'
    frozen = ROOT / 'qa/dialogue-p5-motion-20261104/build-my56-libtv-20261105/input' / rel
    if not frozen.is_file() or hashlib.sha256(frozen.read_bytes()).hexdigest() != x['sha256']:
        missing.append(rel)
    coverage.append({'path': rel, 'category': category, 'sha256': x['sha256']})
result = {'pass': not hits and not large and not missing,
          'scope': '本批发布源码候选及1248项冻结输入；非全量历史素材盘点',
          'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
          'selectedCount': len(selected),
          'selectedBytes': sum((ROOT / p).stat().st_size for p in selected if (ROOT / p).is_file()),
          'groups': collections.Counter(p.split('/')[0] for p in selected),
          'credentialPatternHits': hits, 'filesAtLeast50MiB': large,
          'frozenInputCoverage': collections.Counter(x['category'] for x in coverage),
          'missingOrChangedFrozenInputs': missing,
          'remainingUntrackedCount': len(untracked - selected),
          'note': '部署操作原始回执、重复构建和未采用候选不随源码发布；本机原位保留。常见凭证扫描不等同于所有敏感信息人工审查。'}
(OUT / 'source-files.json').write_text(json.dumps(sorted(selected), ensure_ascii=False, indent=2) + '\n')
(OUT / 'source-preflight.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
(OUT / 'build-input-coverage.json').write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
assert result['pass']
