from pathlib import Path
import json,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
jobs=json.loads((OUT/'jobs.json').read_text());j=next(j for j in jobs if j['id']==sys.argv[1])
src=Path(sys.argv[2]);folder=ROOT/'assets/sources/20261029'/j['package'];folder.mkdir(parents=True,exist_ok=True)
target=folder/(j['stem']+'.png');assert not target.exists(),str(target)
shutil.copy2(src,target);target.with_suffix('.prompt.txt').write_text(j['prompt']+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
record={**j,'sourceFile':str(target.relative_to(ROOT)),'sourceSha256':sha(target),'generatedSource':str(src),'tool':'built-in image_gen','status':'generated-awaiting-visual-format-ui-review','references':[{'path':p,'sha256':sha(ROOT/p)} for p in j['refs']],'runtimeAdopted':False}
target.with_suffix('.generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':j['id'],'path':str(target.relative_to(ROOT))}))
