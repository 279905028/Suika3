"""Independent read-only media audit; creates only this batch's evidence."""
import hashlib,json,re,subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
FF=next((ROOT/'qa/ending-motion-P4-V00-20261104/media-runtime/imageio_ffmpeg/binaries').glob('ffmpeg-macos-*'))
def read(p):return json.loads((ROOT/p).read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sources={
 'ending':'qa/ending-motion-P4-V-Q-20261104/selection.json',
 'kiss':'docs/美术/亲吻动态CG-20261104/成片与绑定.json',
 'morning':'docs/美术/留宿动态CG-20261104/计划绑定.json',
 'night':'docs/美术/留宿动态CG-20261104/夜间亲密版计划绑定.json'}
nodes={n['id']:n for n in read(str((OUT/'story-ir.json').relative_to(ROOT)))['nodes']}
bindings={b['anchor']['nodeId']:b for b in read('docs/整合/bindings.json')['bindings']}
items=[]
for group,source in sources.items():
 for x in read(source)['items']:
  if group=='ending':media={'original':x['source'],'runtime':x['runtime'],'first':x['first'],'last':x['last'],'fallback':x['fallback']}
  elif group=='kiss':media={'original':x['original'],'runtime':x['playback'],'first':x['poster'],'last':x['lastFrame']}
  else:media=(x['revisionV002'] if group=='morning' else x['result'])['media']
  key=x['key'];node=x.get('node')or x['anchor']['nodeId'];n=nodes[node];b=bindings[node]
  anchor_ok=not x.get('anchor') or x['anchor']['sha256']==n['source']['sha256']==b['anchor']['sha256']
  items.append({'key':key,'group':group,'auditId':group+'-'+key,'source':source,'node':node,'condition':x['condition'],'route':x['route'],
   'text':n['text'],'file':'scenario/'+n['source']['file'],'line':n['source']['line'],'anchorMatches':anchor_ok,'bindingCondition':b['condition'],
   'policy':'historical-alternative' if group=='morning' else 'static-fallback' if group=='night' and key=='OV-MY56' else 'adoption-candidate',
   'media':media,'sourceFinding':x.get('visualReview')or x.get('review',{}).get('observations')or (x.get('result')or x.get('revisionV002')or{}).get('finding')})
def audit(item):
 folder=OUT/item['auditId'];folder.mkdir(exist_ok=True)
 checks=[]
 for role,meta in item['media'].items():
  if not isinstance(meta,dict)or 'path' not in meta:continue
  p=ROOT/meta['path'];checks.append({'role':role,'path':meta['path'],'sha256':digest(p),'matches':digest(p)==meta['sha256']})
 p=ROOT/item['media']['runtime']['path']
 args=[str(FF),'-nostdin','-hide_banner','-threads','2','-i',str(p),'-map','0:v:0','-f','null','-']
 result=subprocess.run(args,capture_output=True,text=True);(folder/'decode.log').write_text(result.stderr)
 head=result.stderr.split('Stream mapping:')[0]
 v=re.search(r'Video: (\w+).*?, (\w+)(?:\([^)]*\))?, (\d+)x(\d+).*?, ([\d.]+) fps',head)
 dur=re.search(r'Duration: (\d+):(\d+):([\d.]+)',head)
 info={'exitCode':result.returncode,'codec':v[1],'pixelFormat':v[2],'width':int(v[3]),'height':int(v[4]),'fps':float(v[5]),'audio':'Audio:' in head,'frames':int(re.findall(r'frame=\s*(\d+)',result.stderr)[-1]),'seconds':int(dur[1])*3600+int(dur[2])*60+float(dur[3])}
 assert {k:info[k] for k in ['exitCode','codec','pixelFormat','width','height','fps','audio']}=={'exitCode':0,'codec':'h264','pixelFormat':'yuv420p','width':1280,'height':720,'fps':24.0,'audio':False},info
 assert 4.5<=info['seconds']<=5.5 and info['frames']==item['media']['runtime']['decodedFrames'],info
 assert all(c['matches'] for c in checks),item['auditId']
 assert item['anchorMatches'],item['auditId']
 subprocess.run([str(FF),'-nostdin','-hide_banner','-loglevel','error','-threads','2','-i',str(p),'-vf','fps=2,scale=384:216','-y',str(folder/'frame-%02d.jpg')],check=True)
 files=sorted(folder.glob('frame-*.jpg'))
 sheet=Image.new('RGB',(384*5,250*2+30),'#10151d');d=ImageDraw.Draw(sheet)
 d.text((10,7),item['auditId'],fill='white')
 for i,p in enumerate(files):
  x=i%5*384;y=i//5*250+30;sheet.paste(Image.open(p),(x,y));d.text((x+5,y+220),f'{i/2:.1f}s',fill='white')
 sheet.save(folder/'contact-sheet.jpg',quality=94)
 item.update(fileChecks=checks,decoded=info,evidence=str((folder/'contact-sheet.jpg').relative_to(ROOT)),visualReview='pending')
 return item
with ThreadPoolExecutor(max_workers=4)as pool:items=list(pool.map(audit,items))
(OUT/'technical-report.json').write_text(json.dumps({'date':'2026-11-04','sourceHashes':{p:digest(ROOT/p) for p in sources.values()},'count':len(items),'items':items},ensure_ascii=False,indent=2)+'\n')
for group in sources:
 sub=[x for x in items if x['group']==group]
 for offset in range(0,len(sub),6):
  batch=sub[offset:offset+6];sheet=Image.new('RGB',(1280,len(batch)*170),'#10151d');d=ImageDraw.Draw(sheet)
  for row,x in enumerate(batch):
   d.text((6,row*170+3),x['auditId'],fill='white')
   for col,n in enumerate([1,3,5,7,10]):
    frames=sorted((OUT/x['auditId']).glob('frame-*.jpg'));im=Image.open(frames[min(n,len(frames))-1]);im=im.resize((256,144));sheet.paste(im,(col*256,row*170+22))
  sheet.save(OUT/f'overview-{group}-{offset//6+1}.jpg',quality=94)
print(json.dumps({'count':len(items),'technical':'pass','policyCounts':{p:sum(x['policy']==p for x in items) for p in set(x['policy'] for x in items)}}))
