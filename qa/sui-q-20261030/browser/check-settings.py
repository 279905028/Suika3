from PIL import Image
import numpy as np,json
from pathlib import Path
p=Path(__file__).parent/'ui-extras-final';ims=[np.array(Image.open(p/f'{n}.png').convert('RGB')) for n in ['01-settings-default','02-settings-changed','03-settings-reloaded']];scale=ims[0].shape[1]/1280;checks=[]
for name,box in [('音乐音量',(88,211,540,259)),('文字速度',(710,211,1160,259)),('自动间隔',(710,335,1160,383))]:
 x1,y1,x2,y2=[round(v*scale) for v in box];vs=[a[y1:y2,x1:x2] for a in ims];centers=[];xs=[]
 for a in vs:
  mask=(a[:,:,0]>145)&(a[:,:,0]<200)&(a[:,:,1]>180)&(a[:,:,1]<225)&(a[:,:,2]>165)&(a[:,:,2]<215)
  counts=mask.sum(axis=0);active=np.where(counts>12*scale)[0];assert len(active)>0;centers.append(float(active.mean()/scale+x1/scale));xs.append(active)
 moved=abs(centers[0]-centers[1]);restored=abs(centers[1]-centers[2]);checks.append({'name':name,'knobCenterCanvasX':centers,'defaultToChangedPixels':moved,'changedToReloadedPixels':restored,'pass':moved>15 and restored<=1})
r={'scope':'识别实体滑块的中心位置，忽略焦点/悬停引起的细轨道亮色；默认→拖动需移动>15画布像素，拖动→刷新误差≤1像素；不声称实际音量听感','pass':all(c['pass'] for c in checks),'checks':checks};(p/'settings-knobs.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r)
