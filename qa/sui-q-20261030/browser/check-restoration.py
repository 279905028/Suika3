from pathlib import Path
from PIL import Image
import numpy as np,json,sys
base=Path(__file__).parent/sys.argv[1];checks=[]
sources=[('restoration-final','piao/HIGH/AA'),('restoration-final','huangqiuqiu/HIGH/AA')]
for directory,name in sources:
 r=json.loads((base/directory/'routes-report.json').read_text());c=next(c for c in r['results'] if c['name']==name);assert c['status']=='pass',c
 for target in c['restored']:
  prefix='routes-'+name.replace('/','-')+'-'+target['cursor'];a=np.array(Image.open(base/directory/'screenshots'/(prefix+'-before.png')).convert('RGB')).astype(float)
  for phase in ['loaded','reloaded']:
   file=base/directory/'screenshots'/(prefix+'-'+phase+'.png');b=np.array(Image.open(file).convert('RGB')).astype(float);w=a.shape[1];h=a.shape[0];scale=min(w/1280,(h-72)/720);left=(w-1280*scale)/2;top=48+(h-72-720*scale)/2;x1,x2=round(left+40*scale),round(left+1240*scale);y1,y2=round(top+145*scale),round(top+418*scale);d=np.abs(a[y1:y2,x1:x2]-b[y1:y2,x1:x2]);checks.append({'route':name,'cursor':target['cursor'],'phase':phase,'maxError':float(d.max()),'meanError':float(d.mean()),'pass':bool(d.max()==0),'characters':target['characters'],'props':target['props']})
assert len(checks)==8
report={'pass':all(c['pass'] for c in checks),'scope':'正式候选自然流程中飘人物/道具与黄球球球形/人形，手动读档及刷新后恢复区域逐像素核对','checks':checks}
(base/'restoration-pixels.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'pass':report['pass'],'checks':len(checks),'maxError':max(c['maxError'] for c in checks)}));sys.exit(0 if report['pass'] else 1)
