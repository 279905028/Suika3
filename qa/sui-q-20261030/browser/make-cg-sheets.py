from pathlib import Path
from PIL import Image,ImageDraw
import re,json
base=Path(__file__).parent/'sui-i02-20261030-v7'/'routes';files={}
for p in sorted((base/'screenshots').glob('*-CG*-full.png')):
 m=re.search(r'-(CG\d+)-full.png$',p.name)
 if m:files[m[1]]=p
assert len(files)==60,len(files)
items=sorted(files.items()); sheets=[]
for start in range(0,60,20):
 im=Image.new('RGB',(1280,1040),'#101f24');d=ImageDraw.Draw(im)
 for i,(cg,p) in enumerate(items[start:start+20]):
  img=Image.open(p).convert('RGB');w,h=img.size;scale=min(w/1280,(h-72)/720);left=(w-1280*scale)/2;top=48+(h-72-720*scale)/2
  img=img.crop((round(left),round(top),round(left+1280*scale),round(top+720*scale))).resize((320,180));x=(i%4)*320;y=(i//4)*208;im.paste(img,(x,y));d.text((x+8,y+186),cg,fill='#eeeeee')
 filename=f'cg-sheet-{start//20+1}.jpg';im.save(base/filename,quality=93);sheets.append(filename)
(base/'cg-sheets.json').write_text(json.dumps({'scope':'本批同候选自然路径全图截图联系表，不代替逐拍人工终审','cgCount':len(files),'sheets':sheets,'sources':{k:str(v.relative_to(base)) for k,v in files.items()}},ensure_ascii=False,indent=2)+'\n')
print(sheets)
