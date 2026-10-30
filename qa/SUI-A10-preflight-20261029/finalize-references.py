from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json, hashlib, html, math

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
DEST=ROOT/'assets/sources/20261029-cg-preflight'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p): return str(p.relative_to(ROOT))
def save(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')

jobs=json.loads((OUT/'job-plan.json').read_text())
excluded={
 'photo-xiaoman-wenwen-day22-haircut-v001':'耳前剪短处不够明确，已返修为v002；保留原件，不作生产参考。',
 'prop-piao-knots-reference-v001':'布袋误呈束口袋，已返修为手提袋v002；保留原件，不作生产参考。'
}
notes={
 'bg-my-riverside-afternoon-v001':'CG044第44天下午河边局部；不得替代为第38天租屋楼下长凳。无人物或新增地名。',
 'prop-xiaoman-open-practice-kit-v001':'只按镜头取打开练习页、报名表背面、发夹或小满浅灰手机；不整板入镜，不填日期/学费。',
 'photo-xiaoman-wenwen-day22-haircut-v002':'CG102原始侧面照，耳前发际有轻微不齐缺口，保留耳周；不可美化修齐，不是第91天新拍。',
 'char-xiaoman-morning-white-tee-v001':'用户确认白色内搭；CG019只取肩部近景与脸发基准，不照抄全身姿势。',
 'prop-zhouzhi-private-kit-v001':'私人资料箱、摊位线框/纸背、耳饰、发圈、手机套和折伞，按当拍选择；折伞为借还链，不与CG039长柄伞混同。',
 'char-piao-knotted-shirt-v001':'CG008同B脸型白衬衫衣摆结，不露腹，不据此给其他日期强加衣摆结。',
 'prop-piao-knots-reference-v002':'湿绳供CG067；手提布袋及结供CG096；CG068结对象未明，只参考手结姿态，不指定布袋或新增绳种。',
 'photo-piao-table-hands-v001':'按共同段毛狼护腕手推杯向画外；后续文文回复保留此前推茶往来，不改成当下实时同桌，不补未知露脸成员。',
 'photo-piao-oldstreet-after-rain-v001':'沿A08老街顺序与材质；只用正面，不编造背面拍摄日期和参数。',
 'prop-piao-last-page-black-mark-v001':'仅末页共同句“我过得好。”的黑痕紧局部；分支文字在裁外，非整页空白。CG106主体为收册入抽屉。',
 'prop-piao-epilogue-paper-kit-v001':'CG096斜拍纸背，金额/地点/检查日期不入画；CG099闭合新改册子，非婚礼纪念册。',
 'prop-wenwen-personal-kit-v001':'道具多视图不表示多部手机。CG001坏轮未修；CG082只保留当拍仍可用租屋钥匙，不复制板上的全部钥匙。',
 'prop-maolang-performance-papers-v001':'卷起白边海报/歪裁边/串词白背分镜取用；演出单只远景纸背，不编第三行姓名以外的名单与档期；CG091删除私事页，不把文案重印。',
 'prop-qiaoge-cuff-reference-v001':'CG026仅乔哥前臂袖口造型，不建立其脸、年龄或独立人物立绘。',
 'photo-hq-yard-whiteflowers-blurred-v001':'CG075文文手机内的墙根小白花照片，半幅失焦；不据此给黄球球手机或公开出院。',
 'prop-extras-tools-reference-v001':'CG086柜台边卷尺；扳手仅存结构参考，不增加当拍维修动作。',
 'prop-salon-washbasin-reference-v001':'CG015沿原店黑洗头盆近景，补清颈托、龙头、喷头和卷毛巾，不把远景理发椅当洗头姿势。',
 'prop-station-travel-bags-reference-v001':'左灰蓝箱供CG022小满，中灰布箱供CG034周栀，右棕旅行包供CG069飘；各人物持有独立物件，轮子完好，不借文文坏箱替代。',
 'prop-shared-handheld-food-boxes-reference-v001':'按镜头单取瓶水、装奶布袋、烧饼纸袋、箱子、两份早餐或消费单纸背；不整板入画、不补品牌、日期与金额。'
}
records=[]; checks=[]
for j in jobs:
 p=DEST/j['owner']/(j['id']+'.png')
 im=Image.open(p);im.load();rgba=im.convert('RGBA')
 assert im.format=='PNG'
 row={'assetId':j['id'],'owner':j['owner'],'sourceFile':rel(p),'sourceSha256':sha(p),'size':list(im.size),'mode':im.mode,'alphaExtrema':list(rgba.getchannel('A').getextrema()),'requirements':j['requirements'],'shots':j['shots'],'generationRecord':rel(p.with_suffix('.generation.json')),'generationRecordSha256':sha(p.with_suffix('.generation.json')),'runtimeAdopted':False}
 if j['id'] in excluded:
  row.update({'status':'superseded-not-for-production','reason':excluded[j['id']]})
 else:
  webp=p.with_suffix('.webp')
  if not webp.exists(): im.save(webp,'WEBP',lossless=True,quality=100,method=6,exact=True)
  out=Image.open(webp);out.load()
  assert out.format=='WEBP' and out.size==im.size
  assert out.convert('RGBA').tobytes()==rgba.tobytes(),j['id']+' decoded RGBA mismatch'
  row.update({'derivativeFile':rel(webp),'derivativeSha256':sha(webp),'encoding':{'format':'WebP','lossless':True,'method':6,'exact':True,'decodedRGBAEqual':True},'status':'format-pass-awaiting-visual-summary','usage':notes[j['id']]})
  checks.append({'id':j['id'],'sourcePNG':True,'webpDecodedRGBAEqual':True,'orientation':im.getexif().get(274,1),'alphaPreserved':True,'iccPresent':bool(im.info.get('icc_profile')),'sourceBytes':p.stat().st_size,'webpBytes':webp.stat().st_size})
 records.append(row)
save(DEST/'resource-records.json',{'date':'2026-10-29','purpose':'CG上游补充参考；不是最终CG或运行采用','generatedOriginals':len(records),'selectedReferences':len(checks),'runtimeAdopted':0,'records':records})
save(OUT/'format-check.json',{'status':'pass','selected':len(checks),'excluded':len(excluded),'checks':checks,'scope':'本批PNG实际解码、无损WebP逐像素RGBA比较；原件保留。非引擎测试。'})

selected=[r for r in records if 'derivativeFile' in r]
def sheets(rows,stem):
 for start in range(0,len(rows),8):
  batch=rows[start:start+8];sheet=Image.new('RGB',(1600,math.ceil(len(batch)/2)*510),'#e7e4df');d=ImageDraw.Draw(sheet)
  for k,r in enumerate(batch):
   im=Image.open(ROOT/r['sourceFile']).convert('RGBA');thumb=ImageOps.contain(im,(780,460))
   x=(k%2)*800+(800-thumb.width)//2;y=(k//2)*510
   sheet.paste(thumb,(x,y),thumb);d.text(((k%2)*800+14,y+469),r['assetId'],fill='#202020')
  sheet.save(OUT/(stem+'-'+str(start//8+1)+'.jpg'),quality=92)
sheets(selected,'reference-contact')
alpha=[]
day=ROOT/'assets/sources/20261029/SUI-A08/bg-salon-bijie/bg-salon-bijie-mirror-day-v001.png'
night=ROOT/'assets/sources/20261029/SUI-A08/bg-old-netcafe-counter/bg-old-netcafe-counter-night-v001.png'
for r in selected:
 if r['alphaExtrema'][0]!=0: continue
 sheet=Image.new('RGB',(1600,650),'#777777');d=ImageDraw.Draw(sheet)
 fg=ImageOps.contain(Image.open(ROOT/r['sourceFile']).convert('RGBA'),(400,610))
 for n,bg in enumerate(['white','black',day,night]):
  b=Image.new('RGBA',(400,610),bg) if isinstance(bg,str) else ImageOps.fit(Image.open(bg).convert('RGBA'),(400,610))
  b.alpha_composite(fg,((400-fg.width)//2,610-fg.height));sheet.paste(b.convert('RGB'),(n*400,0));d.text((n*400+12,620),['WHITE','BLACK','DAY','NIGHT'][n],fill='white')
 path=OUT/(r['assetId']+'-four-backgrounds.jpg');sheet.save(path,quality=93);alpha.append({'assetId':r['assetId'],'proof':rel(path),'alphaUnchanged':True,'backgroundSources':[rel(day),rel(night)]})
save(OUT/'alpha-check.json',{'status':'awaiting-visual-review','composites':alpha,'note':'保留生成原始alpha 0..254，不人为拉满；仅供衣装参考，不作为新运行立绘。'})

cards=[]
for r in selected:
 src='../../'+r['derivativeFile'];cards.append('<article><a href="'+html.escape(src)+'"><img src="'+html.escape(src)+'" loading="lazy"></a><h2>'+html.escape(r['assetId'])+'</h2><p>'+html.escape(r['usage'])+'</p><small>'+r['owner']+' · '+', '.join(r['shots'])+' · '+str(r['size'][0])+'×'+str(r['size'][1])+'</small></article>')
(OUT/'参考预览.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CG开工参考补充</title><style>body{margin:32px;background:#f0eee8;color:#20252a;font:16px/1.65 system-ui}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(390px,1fr));gap:22px}article{background:white;padding:20px;border-radius:12px}img{width:100%;height:320px;object-fit:contain;background:#ddd9d1}h2{font-size:15px;overflow-wrap:anywhere}small{color:#666}</style><h1>CG开工参考补充 · 2026-10-29</h1><p>'+str(len(selected))+'项生产参考，另保留2份返修前原件。点击可打开无损WebP。以下为上游参考，不计入60张正式CG，也未进入运行资源。</p><main>'+''.join(cards)+'</main></html>')
print(json.dumps({'originals':len(records),'selected':len(selected),'excluded':len(excluded),'format':'pass','preview':rel(OUT/'参考预览.html')},ensure_ascii=False))
