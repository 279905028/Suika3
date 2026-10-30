from pathlib import Path
import json,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
base=next(j for j in json.loads((OUT/'jobs.json').read_text()) if j['id']==sys.argv[1])
retry=next(j for j in json.loads((OUT/'retry-jobs.json').read_text()) if j['id']==sys.argv[1])
src=Path(sys.argv[2]);target=ROOT/'assets/sources/20261029'/base['package']/(base['stem']+'.png');assert not target.exists()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copy2(src,target);target.with_suffix('.prompt.txt').write_text(retry['prompt']+'\n')
record={**base,**retry,'sourceFile':str(target.relative_to(ROOT)),'sourceSha256':sha(target),'generatedSource':str(src),'tool':'built-in image_gen','status':'generated-awaiting-visual-format-ui-review','references':[{'path':p,'sha256':sha(ROOT/p)} for p in retry['refs']],'runtimeAdopted':False}
target.with_suffix('.generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print({'id':base['id'],'path':str(target.relative_to(ROOT))})
