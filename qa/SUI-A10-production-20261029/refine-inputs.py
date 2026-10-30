from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
p=OUT/'jobs.json';jobs=json.loads(p.read_text());r=json.loads((ROOT/'qa/SUI-A09-release-20261029/review-released.json').read_text())
drop={
 'CG004':['A02/char-xiaoman-base','A02/char-xiaoman-practice-notebook'],
 'CG008':['A05/piao-base'],
 'CG023':['A02/char-xiaoman-base','PRE/prop-xiaoman-open-practice-kit-v001'],
 'CG035':['A08/bg-bridge-shaobing-day','A08/bg-noodle-shop-day'],
 'CG040':['A04/char-mengyao-human-teaching-base','A04/prop-mengyao-workbook-cover'],
 'CG041':['A07/chensheng-b'],
 'CG044':['A04/char-mengyao-human-teaching-base','A08/bg-bridge-shaobing-day'],
 'CG061':['A07/wenwen-base'],
 'CG086':['PRE/prop-extras-tools-reference-v001','PRE/prop-maolang-performance-papers-v001'],
 'CG099':['A05/piao-prop-booklet'],
 'CG096':['A07/wenwen-base'],
 'CG101':['A05/piao-prop-booklet'],
 'CG108':['A08/prop-netcafe-mealbox-open-reference']
}
chars=['A07/wenwen-base','A07/maolang-base','A02/char-xiaoman-base','A05/piao-base','A03/base']
board=Image.new('RGB',(2000,1000),'#e8e5de');draw=ImageDraw.Draw(board)
for i,k in enumerate(chars):
 im=Image.open(ROOT/r['references'][k]['sourceFile']).convert('RGBA');im=ImageOps.contain(im,(390,910));board.paste(im,(i*400+(400-im.width)//2,0),im);draw.text((i*400+15,935),str(i+1),fill='black')
board.save(OUT/'cg011-five-identities.png')
provenance={'path':str((OUT/'cg011-five-identities.png').relative_to(ROOT)),'method':'参考联系表；仅原图等比缩放与排版，没有重绘或改变角色','sources':[{'key':k,**r['references'][k]} for k in chars]}
(OUT/'cg011-five-identities.provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
for j in jobs:
 oldcaps=j['prompt'].split('参考职责：\n',1)[1].split('\n核心画面：',1)[0].splitlines()
 captions={k:c.split('：',1)[1] for k,c in zip(j['referenceKeys'],oldcaps)}
 keys=[k for k in j['referenceKeys'] if k not in drop.get(j['id'],[])]
 if j['id']=='CG011':
  keys=['CG011-identity-board']+[k for k in keys if k not in chars]
  captions['CG011-identity-board']='五人身份对照，仅用于识别人脸衣装：从左到右 1文文金短寸牛仔衣，2毛狼黑图案T，3小满砖红夹克，4飘白滚边衬衫，5周栀青衬衫。请重画自然场景，不把对照板贴进画面。'
 assert len(keys)<=5,(j['id'],len(keys))
 j['referenceKeys']=keys;j['refs']=[provenance['path'] if k=='CG011-identity-board' else r['references'][k]['sourceFile'] for k in keys]
 prefix=j['prompt'].split('参考职责：\n',1)[0]+'参考职责：\n'
 rest=j['prompt'].split('\n核心画面：',1)[1]
 j['prompt']=prefix+'\n'.join(f'图{i+1}：{captions[k]}' for i,k in enumerate(keys))+'\n核心画面：'+rest
p.write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
(OUT/'generation-failures.json').write_text(json.dumps([{'id':'CG004','version':'v001','error':'referenced_image_paths at most 5','outputProduced':False,'resolution':'去除同一身份/闭本的冗余输入，保留W/工作围裙/场景/打开页4图；重试同版本'}],ensure_ascii=False,indent=2)+'\n')
(OUT/'initial-review-notes.json').write_text(json.dumps({'CG001':'人物/交箱轮动作吻合；手与箱轮需检查阅读框遮挡。','CG005':'返修：透明塑料门帘应改为正文布帘。','CG006':'返修：扩大了网吧实体地点；改为屏幕/手部紧景，画外不要可辨房间。'},ensure_ascii=False,indent=2)+'\n')
print('All 60 jobs now use at most 5 input images.')
