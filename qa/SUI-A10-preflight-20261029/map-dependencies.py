from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json,hashlib,copy,math,re
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'qa/SUI-A09-release-20261029';OUT.mkdir(exist_ok=True)
def load(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def save(p,v):(ROOT/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
OLD='qa/SUI-A09-selection-20261029/review-approved.json'
old=load(OLD);review=copy.deepcopy(old);refs=review['references']
A08='assets/sources/20261029/SUI-A08/resource-records.json'
NEW='assets/sources/20261029-cg-preflight/resource-records.json'
a08={r['assetId']:r for r in load(A08)['records']}
new={r['assetId']:r for r in load(NEW)['records'] if 'derivativeFile' in r}

def add(key,p,record,usage):
 if key not in refs:
  refs[key]={'sourceFile':p,'sourceSha256':sha(p),'version':re.search(r'(v\d+)\.png$',p).group(1),'recordPath':record,'recordSha256':sha(record),'usage':usage,'runtimeAdopted':False}
 return key
def bg(asset):
 r=a08[asset];return add('A08/'+asset,r['sourceFile'],A08,'A08已交付版本；本批核对CG当拍用途，见逐镜依赖说明。')
def fresh(asset):
 r=new[asset];return add('PRE/'+asset,r['sourceFile'],NEW,r['usage'])
def extra(key,p,record,usage):return add(key,p,record,usage)

scene_groups={
 'bg-bijie-arrival-platform-day-rain':['CG001'],
 'bg-salon-bijie-mirror-day':['CG004','CG014'],
 'bg-salon-bijie-washbasin-day':['CG015'],
 'bg-convenience-bijie-day':['CG005'],
 'bg-old-netcafe-counter-day':['CG006','CG062','CG086','CG090','CG091','CG107'],
 'bg-old-netcafe-counter-night':['CG010'],
 'bg-noodle-shop-day':['CG007','CG067','CG101'],
 'bg-friends-meal-shop-evening':['CG008','CG011','CG061'],
 'bg-friends-meal-shop-day':['CG095','CG096','CG098','CG099'],
 'bg-huangqiuqiu-room-night':['CG012','CG073','CG082'],
 'bg-huangqiuqiu-room-day':['CG075','CG077','CG078','CG079'],
 'bg-bbq-xiaoman-friends-stall-night':['CG016'],
 'bg-wenwen-bijie-rental-day':['CG019','CG035','CG104','CG106'],
 'bg-bus-stop-bijie-stop-day':['CG020'],
 'bg-departure-station-morning-rain':['CG022','CG034','CG069'],
 'bg-chengdu-salon-study-screen-reference-day':['CG023'],
 'bg-huisheng-306-operating-night':['CG025','CG029'],
 'bg-huisheng-306-cleared-day':['CG031'],
 'bg-huisheng-corridor-operating-day':['CG026','CG027'],
 'bg-zhouzhi-other-venue-evening':['CG032'],
 'bg-bridge-shaobing-eaves-rain':['CG039'],
 'bg-mengyao-bijie-school-classroom-day':['CG040'],
 'bg-mengyao-bijie-school-entrance-day':['CG041'],
 'bg-lianggao-shop-day':['CG063'],
 'bg-piao-bijie-room-day':['CG066'],
 'bg-new-netcafe-counter-night':['CG094'],
 'bg-huisheng-corridor-locked-day':['CG103'],
 'bg-old-netcafe-milk-tea-fr-day91':['CG108'],
}
scene={sid:bg(asset) for asset,ids in scene_groups.items() for sid in ids}
scene['CG044']=fresh('bg-my-riverside-afternoon-v001')
for r in a08.values():
 if 'bg-bijie-slope-street' in r['requirementKeys'] and r['assetId'].endswith('day-overcast'):slope=bg(r['assetId'])

bookbox=extra('A04/book-box','assets/sources/20261028/SUI-A04/selected-a/char-mengyao-human-book-box-neutral-v001.png','qa/SUI-A04-20261028/resource-records.json','CG038只取旧书和纸箱形制；书册仍在孟遥手中。')
stage=extra('A07/maolang-stage','assets/sources/20261029/SUI-A07/maolang/variants/char-maolang-stage-v001.png','assets/sources/20261029/SUI-A07/resource-records.json','CG061用户确认沿用演出西装，不新增换衣。')

def note(keys,text):return {'referenceKeys':keys,'frameUse':text,'status':'resolved-reference-frozen'}
def resolve(s,d):
 id=s['id'];q=d['requirementId']
 if q.startswith('prop-message-screen') or q=='prop-game-screen':
  return {'requirementId':q,'owner':d['owner'],'status':'in-package-production-work','frameUse':s['propState']+'；按当前正文原句制作无品牌局部，禁止添加真实日期、金额、账号及未给消息。','referenceKeys':[]}
 if q.startswith('bg-'):
  k=slope if q=='bg-bijie-slope-street' else scene[id]
  text='采用此场景的布局和材质，按本镜当拍人物/时段重构横屏CG，不复制空场景为成品。'
  if id=='CG006':text='仅取电脑/桌面紧局部，不据该参考认定实体地点在网吧；当前正文没有指定房间。'
  if id=='CG010':text='只取旧网吧门内/门把布局和室内灯光；正文为第11天傍晚，不把夜景外窗照搬。'
  if id=='CG023':text='成都端只取朴素墙面/桌边材质并截胸上，毕节端只取坡道路面；手机边框明确分隔两地。'
  if id in ['CG096','CG095','CG098','CG099']:text='只取普通饭桌/餐具材质，避开未给定门牌、窗外与时刻；不据参考补聚会日期。'
  if id=='CG082':text='取房内桌面与现有夜间室内光，画钥匙/旧包和腰上人物，不扩大成同居场面。'
  if id=='CG044':text='本批新绘第44天下午河边局部；不得改用第38天楼下长凳或烧饼店。'
  return note([k]+([fresh('prop-salon-washbasin-reference-v001')] if id=='CG015' else []),text)
 if q=='pose-xm-morning':return note([fresh('char-xiaoman-morning-white-tee-v001')],'用户已确认白色内搭、肩部近景；不另设睡衣/内衣或裸露。')
 if q=='pose-my-day44':return note(['A04/char-mengyao-human-teaching-base'],'用户已确认日常教学服；只取衣装，不把教案/红笔强加河边。')
 if q=='pose-maolang-aftershow':return note([stage],'用户已确认沿用演出西装；相机此拍尚未按下快门。')
 if q=='prop-wenwen-luggage':return note([fresh('prop-wenwen-personal-kit-v001')],'CG001仅坏轮箱/脱落轮子，尚未修复；CG082仅旧包与袋中换洗物，不搬入同住。')
 if q in ['prop-wenwen-phone','prop-wenwen-housing-papers','prop-wenwen-keyring','prop-my-umbrella']:
  uses={'prop-wenwen-phone':'只取同一无品牌黑手机，前背多视图不表示多部；黄球球不拥有手机。','prop-wenwen-housing-papers':'透明通知袋/纸背，正文未给金额和编号不入镜。','prop-wenwen-keyring':'按第75天交还后的状态，只明确留下仍能用的出租屋钥匙与空环；不照搬参考板的三把全量。','prop-my-umbrella':'灰色长柄伞供第23天两人共同扶柄；不与周栀折伞借还链混同。'}
  return note([fresh('prop-wenwen-personal-kit-v001')],uses[q])
 if q=='prop-xm-phone':return note([fresh('prop-xiaoman-open-practice-kit-v001')],'浅灰无品牌手机为小满使用；来电债额不显示。')
 if q=='prop-xiaoman-practice-kit':
  if id=='CG004':return note([fresh('prop-xiaoman-open-practice-kit-v001')],'打开黑练习本的后脑勺草图页，报名材料只露背/角，不加校名学费日期。')
  if id=='CG102':return note([fresh('photo-xiaoman-wenwen-day22-haircut-v002')],'发送第22天侧面原照，完整耳边剪坏处；不裁成完美作品，不开实时视频。')
  return note(['A02/char-xiaoman-practice-notebook',fresh('prop-xiaoman-open-practice-kit-v001')],'CG023用既有黑本外封挡半脸；同一本打开页供连续性，不在这一拍露整页或飞吻。')
 if q=='prop-xiaoman-tools':return note(['A02/char-xiaoman-work-apron',fresh('prop-xiaoman-open-practice-kit-v001')],'CG014发夹已落围布，剪刀梳子按工作基准；CG015仰躺洗头池，毛巾不凭空变围巾。')
 if q=='prop-xiaoman-helmets':return note(['A02/char-xiaoman-two-helmets'],'只取两顶头盔造型；CG011只放小满膝上所需头盔，不沿用卖车后抱姿；CG020为卖车后双头盔。')
 if q=='prop-zhouzhi-blue-rim-cup':return note(['A03/tied-tired-cup'],'仅取蓝沿白杯形制；CG034杯正交到文文手里，周栀沿当日私人版，不继承第36天疲态。')
 if q in ['prop-zhouzhi-personal-box','prop-zhouzhi-planning']:
  return note([fresh('prop-zhouzhi-private-kit-v001')],'按当拍取折起摊位图/手机套/折伞/私人箱/耳饰；CG032须工作裙版与找回耳饰，其他物件不整板同时入镜。')
 if q=='char-qiaoge':return note([fresh('prop-qiaoge-cuff-reference-v001')],'仅乔哥翻起袖口与前臂；由周栀压平，不用文文牛仔袖替代，不新增脸。')
 if q=='prop-mengyao-book-box':return note([bookbox,'A04/prop-mengyao-workbook-cover'],'旧书箱及封面“文文/48/60”；60为重做，非涂改48。只桌面近景，不命名地点。')
 if q=='prop-mengyao-teaching-kit':return note(['A04/char-mengyao-human-teaching-base','A04/prop-mengyao-phone-stand','A04/prop-mengyao-workbook-cover'],'CG040手机支架与夹子沿教学版，视频已播完；CG104红笔沿教学定稿、收抽屉，旧练习册放另一侧，不当成已归还。')
 if q=='prop-chensheng-handheld':return note(['A07/chensheng-documents'],'CG041文件袋仍在陈晟手里，纸箱刚移开；不另加布袋/电源线或反派表情。')
 if q=='prop-maolang-performance-kit':return note([fresh('prop-maolang-performance-papers-v001')],'CG010卷起白边海报尚未递出；CG062保留歪裁边；CG086演出单在桌边仅纸背/远景；CG091空掉文字页，删除动作由毛狼完成，不重现私事笑话。')
 if q=='prop-extras-handheld':return note([fresh('prop-extras-tools-reference-v001')],'CG086卷尺在柜台边/买家拿取范围，主体仍为三人及饮料箱；不新增买家脸。扳手不入当拍。')
 if q=='prop-piao-booklet-kit':
  if id=='CG106':return note(['A05/piao-prop-booklet',fresh('prop-piao-last-page-black-mark-v001')],'收进抽屉的属于文文的册子；若页边可见只用共同黑痕紧局部，不串入某一选项独有文字。')
  if id=='CG101':return note(['A05/piao-prop-booklet','A05/piao-prop-camera-bag'],'小本子只露纸背/斜页，未给的课程日期不可读；相机已入包，包带结松开重打。')
  return note(['A05/piao-prop-booklet','A05/piao-prop-booklet-tools'],'CG066未装订散页落地，末页尚空；不能把封二或已装订成品误当整段纸页状态。')
 if q=='prop-piao-knots':
  if id=='CG008':return note([fresh('char-piao-knotted-shirt-v001')],'当拍白衬衫衣摆结；不推定其他日期都打同一结。')
  if id=='CG101':return note(['A05/piao-prop-camera-bag'],'五线第36天为相机包带松结；不可借用LOW本线湿绳独谈。')
  return note([fresh('prop-piao-knots-reference-v002')],'CG067湿绳；CG096手提布袋带结。CG063碗勺近景无衣角结特写；CG068正文未明打结对象，镜头限手与相机，对象保持画外，不把参考袋子补入。')
 if q=='prop-piao-epilogue-pages':return note([fresh('prop-piao-epilogue-paper-kit-v001')],'CG096纸背斜面保留写字/划掉动作，金额、日程、检查地点不可读；CG099已改册子闭合、先擦水再放，非婚礼。')
 if q=='prop-piao-photos':
  if id=='CG070':return note([fresh('photo-piao-table-hands-v001'),fresh('photo-piao-oldstreet-after-rain-v001')],'两张寄来照片用正面：桌面毛狼手推杯/雨后老街；背面未知日期参数不见。文文回复保持普通朋友；不画实时三人同桌。')
  return note(['A05/piao-prop-camera'],'CG061/CG098为征询许可、按快门之前，画内没有已拍照片；CG068是重对焦时的手与相机，不必出现第一次糊片屏幕。')
 if q=='prop-yard-fixed':
  if id=='CG075':return note([fresh('photo-hq-yard-whiteflowers-blurred-v001')],'仅文文手机内的小白花糊照；小手挡一部分屏幕，不新造黄球球手机或人形。')
  return note([bg('bg-old-netcafe-yard-door-ajar-night' if id=='CG012' else 'bg-old-netcafe-yard-door-open-afternoon'),scene[id]],'只取门框/门把和蓝凳的既有组件；CG012另一凳尚未搬近；CG078腰上人形，不把黄球球放到公开街道。')
 if q=='prop-hq-room-fixed':return note([scene[id]],'房内固定家具按既有布局；肩上近景，纸巾已放下，不把普通黄色小球当角色替身。')
 if q=='prop-hq-tableware':return note([bg('prop-hq-tableware-name-and-blank-reference')],'CG073她杯底已有黄球球姓名、文文正在写自己的杯底，尚未倒水；CG077吃过的餐盒另取餐具；CG107文文杯已在柜中，提醒只在文文手机。')
 if q=='prop-salon-fixed':return note([scene[id]]+([fresh('prop-salon-washbasin-reference-v001')] if id=='CG015' else []),'镜台/围布/洗头池/卷毛巾从对应镜台或洗头池版本取用，CG015不是镜台坐姿。')
 if q=='prop-huisheng-sales':return note([bg('bg-huisheng-306-operating-night'),bg('bg-huisheng-corridor-operating-day'),fresh('prop-shared-handheld-food-boxes-reference-v001')],'CG025双麦一支扣腿；CG027未付单只露纸背避免杜撰数额；CG029单已退前台且尚未拿麦，不能照搬两件在手。')
 if q=='prop-huisheng-stopped-clock':return note([bg('prop-huisheng-stopped-clock-1147-reference'),bg('bg-huisheng-306-cleared-day')],'采用v002指针停钟11:47，与空306局部绑定；钟仍挂原处未摘，茶几已搬走。')
 if q=='prop-netcafe-counter-equipment':return note([bg('bg-old-netcafe-counter-day')]+([fresh('prop-shared-handheld-food-boxes-reference-v001')] if id=='CG086' else []),'只取旧网吧电脑/键盘/打印机/柜台固定设备；CG086饮料箱取补充板；CG006紧屏幕不据此认定所在地，CG091用空文字页而非私事原文。')
 if q=='prop-netcafe-console':return note([bg('prop-netcafe-console-reference'),bg('bg-old-netcafe-counter-day')],'设备及手柄已售出，参考只约束原占地/灰印；最终画面必须无游戏机与手柄。')
 if q=='prop-netcafe-records':return note([bg('prop-netcafe-records-blank-reference'),bg('bg-new-netcafe-counter-night')],'第91天新店的本子/笔与零钱柜台；不编营业金额或新消息。')
 if q=='prop-netcafe-cat-drawing':return note([bg('prop-netcafe-cat-drawing-wall-reference')],'CG108只见装好的照片纸袋；内容来源是旧墙猫画，不把旧猫画直接重新挂在新奶茶店。')
 if q=='prop-transport-packing':return note([fresh('prop-station-travel-bags-reference-v001')],'CG022取左灰蓝箱、绑带已收；CG034取中灰布箱由周栀自拖；CG069取右棕旅行包，飘已收回脚边。彼此是独立物件，不用文文坏箱或汽车后备箱替代。')
 if q=='prop-shared-food-boxes':
  keys=[scene[id]] if id in scene else [bookbox]
  if id=='CG044':keys=[bg('bg-bridge-shaobing-day')]
  if id=='CG035':keys=[bg('bg-bridge-shaobing-day'),bg('bg-noodle-shop-day')]
  if id in ['CG077','CG108']:keys=[bg('prop-netcafe-mealbox-open-reference'),scene[id]]
  if id in ['CG005','CG035','CG041','CG044','CG108']:keys.append(fresh('prop-shared-handheld-food-boxes-reference-v001'))
  return note(keys,'固定场景组件按镜头取瓶水/牛奶袋、碗筷/纸巾、纸箱或餐盒；专属杯/资料箱不替换。CG044两只烧饼；CG077为吃过餐盒；CG108严格两份早饭。品牌/价格/地址均不补。')
 raise ValueError((id,q))

wardrobe={
 'CG019':'小满沿A02已选白色内搭，乱发、肩部近景；文文画外，不扩展床头衣装。',
 'CG044':'孟遥沿A04已选日常教学服；不套第28天私人外套，不带教学道具到河边。',
 'CG061':'毛狼沿A07演出西装（用户确认）；飘B、周栀B；不新增换衣剧情。'
}
for s in review['shots']:
 deps=[{**d,**resolve(s,d)} for d in s['pendingDependencies']]
 s['previousPendingDependencies']=s['pendingDependencies']
 s['resolvedDependencies']=[d for d in deps if d['status']=='resolved-reference-frozen']
 s['internalWorkItems']=[d for d in deps if d['status']=='in-package-production-work']
 s['pendingDependencies']=[]
 if s['id'] in wardrobe:
  s['previousWardrobeAndForm']=s['wardrobeAndForm'];s['wardrobeAndForm']=wardrobe[s['id']]
  s['lifecycle']['snapshotBefore']=s['lifecycle']['snapshotBefore'].replace(s['previousWardrobeAndForm'],s['wardrobeAndForm'])
 s['productionReferenceKeys']=list(dict.fromkeys(s['referenceKeys']+[k for d in s['resolvedDependencies'] for k in d['referenceKeys']]))
 if s['id']=='CG032' and 'A03/work-neutral' not in s['productionReferenceKeys']:s['productionReferenceKeys'].append('A03/work-neutral')
 s['production'].update({'state':'可制作','productionReady':True,'blockingReasons':[],'gate':'all-60-upstream-before-first-cg','releasedBy':'A09本轮正文/参考核验','releaseEvidence':'qa/SUI-A09-release-20261029/verification.json','runtimeAdopted':False,'generatedCG':False})

selection=load('docs/CG当前选择.json')
if not (OUT/'selection-before.json').exists():save('qa/SUI-A09-release-20261029/selection-before.json',selection)
selection=load('qa/SUI-A09-release-20261029/selection-before.json')
selection['productionReady']=True;selection['currentReview']='qa/SUI-A09-release-20261029/review-released.json'
selection['revision']='cg-selection-release-20261029'
for item in selection['items']:
 if item['id'] in selection['activeSelectedIds']:
  item['status']='已选；上游参考已核验，A09可制作；CG图像及运行采用待完成'
  item['productionReady']=True
  item['releaseRecord']='qa/SUI-A09-release-20261029/review-released.json'
selection['productionRelease']={'date':'2026-10-29','releasedCount':60,'generatedCount':0,'runtimeAdopted':False,'evidence':'qa/SUI-A09-release-20261029/verification.json'}
save('qa/SUI-A09-release-20261029/selection-released.json',selection)
review.update({'revision':'upstream-reference-release-20261029','task':'SUI-A09 CG制作开工放行','priorReview':{'path':OLD,'sha256':sha(OLD)},'inputSelection':{'path':'qa/SUI-A09-release-20261029/selection-released.json','sha256':sha('qa/SUI-A09-release-20261029/selection-released.json')},'releaseBasis':{'userRequest':'完成未达成的开工条件','authorization':'qa/SUI-A10-preflight-20261029/authorization.json','wardrobeDecisions':'qa/SUI-A10-20261029/decisions.json','newReferenceManifest':NEW,'scope':'冻结60镜相关上游制作参考；不是用户逐图运行采用、A11总验收或60张CG完成。','validationState':'awaiting-final-verification'},'counts':{'shots':60,'released':60,'newReferences':len(new),'generatedCG':0,'runtimeAdopted':0}})
review['priorSupplementalRequests']=copy.deepcopy(old['supplementalRequests'])
for k,v in review['supplementalRequests'].items():
 v['status']='in-package-production-work' if k in ['prop-game-screen','prop-message-screen'] else 'resolved-reference-frozen'
 v['currentEvidence']='qa/SUI-A09-release-20261029/dependency-release.json'
save('qa/SUI-A09-release-20261029/review-released.json',review)
packages={}
for s in review['shots']:
 p=packages.setdefault(s['production']['package'],{'selectedIds':[],'releasedForProduction':[],'generated':[],'candidatesUnconfirmed':[]})
 p['selectedIds'].append(s['id']);p['releasedForProduction'].append(s['id'])
save('qa/SUI-A09-release-20261029/package-index.json',{'date':'2026-10-29','packages':packages,'gate':'全部60镜上游一起放行；各包依当前源指纹开工'})
deps={}
for s in review['shots']:
 for d in s['resolvedDependencies']:
  v=deps.setdefault(d['requirementId'],{'owner':d['owner'],'shots':[],'referenceKeys':[],'status':'resolved-reference-frozen'})
  v['shots'].append(s['id']);v['referenceKeys']=list(dict.fromkeys(v['referenceKeys']+d['referenceKeys']))
save('qa/SUI-A09-release-20261029/dependency-release.json',{'upstreamRequirements':len(deps),'requirements':deps,'internalWorkItems':[{**d,'shot':s['id']} for s in review['shots'] for d in s['internalWorkItems']]})

# 只生成审阅拼图，不修改正式图像。原28参考已经有独立审核，此处复看新映射的A08和额外参考。
contact=[(k,v) for k,v in refs.items() if k.startswith('A08/') or k in ['A04/book-box','A07/maolang-stage']]
for start in range(0,len(contact),8):
 batch=contact[start:start+8];sheet=Image.new('RGB',(1800,math.ceil(len(batch)/2)*550),'#e8e5de');draw=ImageDraw.Draw(sheet)
 for i,(key,v) in enumerate(batch):
  im=Image.open(ROOT/v['sourceFile']).convert('RGBA');th=ImageOps.contain(im,(880,500));x=(i%2)*900+(900-th.width)//2;y=(i//2)*550
  sheet.paste(th,(x,y),th);draw.text(((i%2)*900+12,y+510),key,fill='#222222')
 sheet.save(OUT/('upstream-contact-'+str(start//8+1)+'.jpg'),quality=93)
print(json.dumps({'shots':len(review['shots']),'upstreamRequirements':len(deps),'references':len(refs),'a08AndExtraContacts':len(contact),'newReferences':len(new)},ensure_ascii=False))
