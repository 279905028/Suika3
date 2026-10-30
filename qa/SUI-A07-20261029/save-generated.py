"""仅归档本包内置 imagegen 结果；不修改历史或运行采用目录。"""
from pathlib import Path
import json, hashlib, shutil

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
SOURCE = ROOT / 'assets/sources/20261029/SUI-A07'
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
jobs = json.loads((QA / 'generation-jobs.json').read_text())
for path in sorted((QA / 'jobs').glob('*.json')):
    job = json.loads(path.read_text())
    if not any(j['key'] == job['key'] for j in jobs): jobs.append(job)
(QA / 'generation-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
for job in jobs:
    out = SOURCE / job['file']
    original = Path(job['generatedPath'])
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        assert sha(out) == sha(original), f'拒绝覆盖不同原件: {out}'
    else:
        shutil.copyfile(original, out)
    prompt = SOURCE / job['character'] / 'prompts' / (job['key'] + '.txt')
    prompt.parent.mkdir(parents=True, exist_ok=True)
    prompt.write_text(job['prompt'] + '\n')
print('归档生成原件及提示词完成')
