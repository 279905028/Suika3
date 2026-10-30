from pathlib import Path
import json,sys,shutil,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
jobs={x['id']:x for x in json.loads((OUT/'job-plan.json').read_text())}
key,source=sys.argv[1:3];job=jobs[key]
folder=ROOT/'assets/sources/20261029-cg-preflight'/job['owner'];folder.mkdir(parents=True,exist_ok=True)
target=folder/(key+'.png');prompt=folder/(key+'.prompt.txt')
if target.exists():raise RuntimeError('不覆盖已有原件 '+str(target))
shutil.copy2(source,target);prompt.write_text(job['prompt']+'\n')
record={**job,'tool':'built-in image_gen','generatedSource':source,'sourceFile':str(target.relative_to(ROOT)),'promptFile':str(prompt.relative_to(ROOT)),'sourceSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'state':'generated-awaiting-visual-format-review','runtimeAdopted':False,'references':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in job['refs']]}
(folder/(key+'.generation.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':key,'path':str(target.relative_to(ROOT))},ensure_ascii=False))
