from pathlib import Path
import json,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
base=next(j for j in json.loads((OUT/'jobs.json').read_text()) if j['id']==sys.argv[1])
edit=next(j for j in json.loads((OUT/'repair-jobs.json').read_text()) if j['id']==sys.argv[1] and j['version']==sys.argv[2])
src=Path(sys.argv[3]); stem=base['stem'].rsplit('-',1)[0]+'-'+edit['version']
folder=ROOT/'assets/sources/20261029'/base['package'];target=folder/(stem+'.png');assert not target.exists(),str(target)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copy2(src,target);target.with_suffix('.prompt.txt').write_text(edit['prompt']+'\n')
record={**base,**edit,'stem':stem,'sourceFile':str(target.relative_to(ROOT)),'sourceSha256':sha(target),'generatedSource':str(src),'tool':'built-in image_gen','status':'generated-awaiting-visual-format-ui-review','supersedes':edit['refs'][0],'references':[{'path':p,'sha256':sha(ROOT/p)} for p in edit['refs']],'runtimeAdopted':False}
target.with_suffix('.generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':edit['id'],'version':edit['version'],'path':str(target.relative_to(ROOT))}))
