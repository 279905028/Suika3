from pathlib import Path
import json,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
before=read(OUT/'input-before.json');release=read(ROOT/before['reviewPath']);records=read(OUT/'resource-records.json');dec=read(OUT/'visual-decisions.json');ui=read(OUT/'ui-review.json');errors=[]
def check(ok,msg):
 if not ok:errors.append(msg)
check(sha(ROOT/before['reviewPath'])==before['reviewSha256'],'A09放行指纹')
check(sha(ROOT/'docs/CG当前选择.json')==before['selectionSha256'],'选择指纹')
for r in before['protectedFiles']:check(sha(ROOT/r['path'])==r['sha256'],'受保护输入变化:'+r['path'])
for key,r in before['referenceHashes'].items():
 for a,b in [('sourceFile','sourceSha256'),('recordPath','recordSha256')]:check(sha(ROOT/r[a])==r[b],'上游变化:'+key+':'+a)
active={s['id']:s for s in release['shots']};rows=records['records'];ids=[r['cgId'] for r in rows]
check(len(ids)==60 and set(ids)==set(active),'60镜编号')
check(not(set(ids)&set(release['retiredIds'])),'废弃编号被复用')
check(all(s['production']['productionReady'] for s in release['shots']),'全量门槛')
for r in rows:
 i=r['cgId'];s=active[i]
 for key in ['source','conditions','lifecycle','wardrobeAndForm','propState']:check(r[key]==s[key],i+':'+key)
 check(r['sourceFile']==dec['selected'][i],i+':选择')
 check(sha(ROOT/r['sourceFile'])==r['sha256Source'],i+':PNG指纹')
 check(sha(ROOT/r['derivativeFile'])==r['sha256Derivative'],i+':WebP指纹')
 a=Image.open(ROOT/r['sourceFile']);b=Image.open(ROOT/r['derivativeFile']);a.load();b.load()
 check(b.format=='WEBP' and a.size==b.size and a.convert('RGBA').tobytes()==b.convert('RGBA').tobytes(),i+':无损解码')
 check(a.convert('RGBA').getchannel('A').getextrema()==(255,255),i+':不透明')
 check(Image.open(ROOT/r['preview']['path']).size==(1280,720),i+':预览尺寸')
 check(Image.open(ROOT/r['uiReadingPreview']).size==(1280,720),i+':UI尺寸')
 check(not r['runtimeAdopted'],i+':错误宣称运行采用')
allgens=sorted((ROOT/'assets/sources/20261029').glob('SUI-A10-*/*.generation.json'))
for p in allgens:
 g=read(p);check(sha(ROOT/g['sourceFile'])==g['sourceSha256'],'原稿变化:'+str(p.relative_to(ROOT)))
 check(Path(g['generatedSource']).exists() and sha(Path(g['generatedSource']))==g['sourceSha256'],'image_gen原始输出保留:'+g['sourceFile'])
 for ref in g['references']:check(sha(ROOT/ref['path'])==ref['sha256'],'输入参考变化:'+ref['path'])
 check((ROOT/g['sourceFile']).with_suffix('.prompt.txt').read_text().rstrip()==g['prompt'].rstrip(),'提示词留存:'+g['sourceFile'])
check(len(allgens)==len(dec['selected'])+len(dec['excluded'])==88,'原稿/返修版数量')
check(ui['count']==60 and ui['fullFrameVisualPass']==60 and ui['defaultOverlayReviewed']==60,'静态UI复核')
gallery=read(ROOT/'system/sui-u/gallery.registry.json');bindings=sum(bool(x.get('file')) for x in gallery['items'])
check(bindings==0 and len(gallery['items'])==60,'图鉴未绑定边界')
internal=[{'id':r['cgId'],'requirementId':w['requirementId'],'result':'完成画内局部；制作包静态复核','selected':r['sourceFile'],'note':r['visualNote']} for r in rows for w in r['internalWorkItems']]
check(len(internal)==9,'A10内部9项')
(OUT/'internal-work-completion.json').write_text(json.dumps({'count':len(internal),'records':internal,'externalBlockers':0},ensure_ascii=False,indent=2)+'\n')
out={'pass':not errors,'errors':errors,'selectedCGs':60,'packages':{p:sum(r['ownerTask']==p for r in rows) for p in sorted(set(r['ownerTask'] for r in rows))},'originalPNGs':len(allgens),'selectedPNGs':60,'supersededPreserved':28,'losslessWebP':60,'rgbaEqual':60,'opaque':60,'preview1280x720':60,'staticUIReviewed':60,'protectedInputsChecked':len(before['protectedFiles']),'referencesChecked':len(before['referenceHashes']),'conditionsAndLifecycleEqualA09':not any(':conditions' in e or ':lifecycle' in e for e in errors),'internalWorkCompleted':len(internal),'runtimeBindings':bindings,'runtimeAcceptance':'未执行；A11/I/E/Q待完成','releaseSha256':before['reviewSha256'],'recordsSha256':sha(OUT/'resource-records.json')}
(OUT/'verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False));assert not errors,errors
