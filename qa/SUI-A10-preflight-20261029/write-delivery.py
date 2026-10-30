from pathlib import Path
from PIL import Image
from collections import Counter
import json,hashlib,copy
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent;REL=ROOT/'qa/SUI-A09-release-20261029'
def load(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
report=load('qa/SUI-A09-release-20261029/verification.json');assert report['status']=='pass'
review=load('qa/SUI-A09-release-20261029/review-released.json')
review['releaseBasis']['validationState']='pass'
review['releaseBasis']['verificationSha256']=sha(REL/'verification.json')
save(REL/'review-released.json',review)
manifest=load('assets/sources/20261029-cg-preflight/resource-records.json')
selected=[r for r in manifest['records'] if r.get('derivativeFile')]
counts=Counter(r['owner'] for r in selected)

decoded=[]
for k,r in review['references'].items():
 p=ROOT/r['sourceFile'];im=Image.open(p);im.load()
 assert sha(p)==r['sourceSha256'];assert sha(ROOT/r['recordPath'])==r['recordSha256']
 decoded.append({'key':k,'path':r['sourceFile'],'sha256':r['sourceSha256'],'format':im.format,'size':list(im.size),'mode':im.mode,'recordSha256Verified':True})
save(REL/'reference-file-check.json',{'status':'pass','count':len(decoded),'scope':'87份实际生产参考重新解码并核对图片/资源记录指纹；不复述历史视觉审查为本轮全图终审。','rows':decoded})
up=[r for r in decoded if r['key'].startswith('A08/') or r['key'] in ['A04/book-box','A07/maolang-stage']]
save(REL/'upstream-visual-review.json',{'status':'pass-for-cg-reference-use','count':len(up),'scope':'40份新增映射的既有场景/道具/衣装，通过联系表及必要原图对照当前镜头。旧28角色基准沿原选定记录，不重复宣称重新逐图终审。','rows':up,'limits':['远景只约束布局材质；CG015另补洗头盆局部，原图不覆盖。','CG006设备紧局部不确定实体地点。CG023以手机边框分隔两地。','回声停业版与营业版分开；11:47读取依独立指针钟。','CG022/034/069使用新增车站行李，不用车后备箱场景代替。','近景共享食物/纸箱补齐，数量与使用状态按逐镜记录。','不明地点/日期/金额及未给相机背面参数维持画外或不可读。']})

changed=['TODO-v1.1.md','docs/CG当前选择.json','docs/CG调整清单.md','docs/SUI-A美术子任务.md','docs/开发计划.md']+['docs/美术/SUI-'+x+'.md' for x in ['A02','A03','A04','A05','A07','A08','A09','A10']]
backup=OUT/'documents-before';backup.mkdir(exist_ok=True)
for p in changed:
 src=ROOT/p;dest=backup/p;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():dest.write_bytes(src.read_bytes())
if not (REL/'task-document-before.md').exists():(REL/'task-document-before.md').write_bytes((ROOT/'docs/美术/SUI-A09.md').read_bytes())

# 当前选择仅改变制作状态/当前复核入口；取消编号及历史来源保留。
(ROOT/'docs/CG当前选择.json').write_bytes((REL/'selection-released.json').read_bytes())

owner_notes={
 'A02':'新增3项参考：打开练习本/报名资料与小满手机板、白色内搭次晨衣装、文文第22天剪发原照。剪发照使用v002；v001保留但排除。CG019继续按用户已确认的肩部近景。',
 'A03':'新增1项私人道具参考板：摊位图、私人箱/耳饰/发圈、折伞和手机套。CG032沿既有工作裙版；CG034只取蓝沿杯造型，不继承第36天疲态。',
 'A04':'无须新增衣装。CG044依用户确认锁定既有日常教学服；书箱、练习册封面、手机支架及红笔映射到既有版本。河边场景由A08补齐；婚姻/分支条件保持原文。',
 'A05':'新增6项参考：B版衣摆结、手提布袋/绳结v002、桌面与雨后老街照片、末页共同黑痕局部、后日谈修订册/纸背。v001束口袋保留排除；CG061/098按快门前不显示照片成片，CG068未明确结的对象保持画外。',
 'A07':'新增4项参考：文文个人物件板、毛狼海报/串词纸、乔哥袖口局部及卷尺/扳手。CG061按用户确认沿既有演出西装。乔哥仅前臂，不新增脸；CG082钥匙按交还后状态取用。',
 'A08':'新增5项CG专用参考：第44天下午河边、小白花糊照、洗头池局部、车站行李板、共享手持食物/纸箱板。原86项选集及99份PNG原件保持；新增图补足对应CG近景，不重写原包。'
}
for code,content in owner_notes.items():
 p=ROOT/('docs/美术/SUI-'+code+'.md');s=p.read_text()
 if code=='A02':s=s.replace('A09/A10-XM的CG','A10-XM的CG（A09本轮已放行）')
 if code=='A03':s=s.replace('- [ ] A09／A10-ZZ：逐镜放行后制作CG；本批基础图不等于周栀CG完成。','- [ ] A10-ZZ：A09本轮已放行，CG成品仍待制作；本批基础图不等于周栀CG完成。')
 if code=='A05':
  s=s.replace('桌角/群照/雨后老街照片成片，本包制作数为0；入镜人物、手部、场景与可见文字确认后由A05接续','原批照片成片为0；本次CG前置已补桌面与雨后老街两张原片，见下方补充记录')
  s=s.replace('双人亲密、婚后、跨线与后日谈等CG逐镜放行及制作','本轮60镜相关上游已放行；双人亲密、婚后、跨线与后日谈CG成品仍待制作')
 assert '## CG前置补充｜2026-10-29' not in s
 s+='\n## CG前置补充｜2026-10-29\n\n'+content+'\n\n'
 s+='依据用户“完成未达成的开工条件”，本次将相关参考冻结供CG制作；不是新增人物方案的用户逐图批准，也不是运行采用。原图/历史验收不改写。新增图已做PNG实际解码、无损WebP逐像素比较和视觉检查，透明补充另验四底。\n\n'
 s+='[补充预览](../../qa/SUI-A10-preflight-20261029/参考预览.html) · [资源与用途](../../assets/sources/20261029-cg-preflight/resource-records.json) · [本次检查](../../qa/SUI-A10-preflight-20261029/视觉检查.md) · [A09逐镜放行](../../qa/SUI-A09-release-20261029/review-released.json)\n'
 p.write_text(s)

a09='''# SUI-A09 CG复核与制作放行

2026-10-29｜**60/60镜相关上游参考已冻结并通过本轮核验，全部可进入A10制作。** 选集仍为52项保留＋CG101～CG108八项新增；8个叶岚退役编号继续取消。正式CG成品0张，运行采用0张。

[逐镜放行记录](../../qa/SUI-A09-release-20261029/review-released.json) · [60项依赖映射](../../qa/SUI-A09-release-20261029/dependency-release.json) · [当前验证](../../qa/SUI-A09-release-20261029/verification.json) · [交接](../../qa/SUI-A09-release-20261029/交接.md)

## 本轮完成

- 用户要求“完成未达成的开工条件”。已补齐19项CG专用参考，保留2项返修前原件；87份生产参考均有实际文件、版本和指纹。人物原选型不变，三处衣装沿用户已确认方案。
- 60个上游需求键已落实到146条逐镜依赖；9项游戏/电话/消息/日历画内局部仍属A10制作内容，不当成外部阻塞，也不宣称已完成。
- 重跑32组共通组合、2,818条路线展开、135项重点反例；60镜原文与108/120字素分页的进入/退出均通过。904项已有正文、原件及运行输入未改。
- 本轮冻结的是**制作参考**。最终CG视觉审查、A11、I采用、E绑定和Q运行验收继续分开进行。

## 制作约束

- CG019：小满白色内搭、肩部近景；CG044：孟遥日常教学服及新河边参考；CG061：毛狼演出西装。三项不重复询问，不新增换衣剧情。
- 孟遥CG038～041在MY07之前；CG044仅要求MY07=A，AB仍保留。CG104仅AA；CG105覆盖AB/BA/BB。婚姻持续，不画公开复合或自动离婚。
- 黄球球按正文日序呈球形/人形；人形腰上，不补下装或遮片经历；没有自己的手机。CG075用文文手机内半幅失焦花照。
- CG006仅普通队友游戏暂停，不画叶岚实体或恋爱暗示；CG023为视频，CG035仅语音。CG067的湿绳独谈与CG101的相机包带三人事件不能共图。
- 相机按快门前、杯子写字前后、箱轮未修/已售设备、钥匙交还后、册子分支文字均按逐镜`frameUse`执行。照片未知背面日期、金额、检查地点等不入画。
- 1280×720横屏，脸/手/关键物件建议区[64,96,1152,322]；正文框y=490、姓名框y=442起。最终CG仍须做实际遮挡与读取性检查。
- 沿用A09-ONE-PARAGRAPH-v1：入段存快照，离开该段最后一页清CG并恢复/重算下一拍；读档校验源指纹、条件及页相位。此规范尚未绑定到运行包。

## 当前60镜

每镜详细衣装、道具、条件、参考路径与进出场见上方JSON。表内参考数量包含身份、衣装和按镜头取用的物件，不能整板同时放入CG。

| 编号 | 镜头 | 制作包 | 参考数 | 正文锚点 |
| --- | --- | --- | ---: | --- |
'''
for s in review['shots']:
 p=ROOT/s['source']['path'];a09+=f"| {s['id']} | {s['title']} | {s['production']['package'].replace('SUI-A10-','')} | {len(s['productionReferenceKeys'])} | [第{s['source']['line']}行](<{p}:{s['source']['line']}>) |\n"
a09+='\n## 历史与边界\n\n[补选时文档快照](../../qa/SUI-A09-release-20261029/task-document-before.md)和[原待核记录](../../qa/SUI-A09-selection-20261029/review-approved.json)原样保留；其中“0镜放行/待核”是当时状态，本轮以后以上方放行记录为准。未以历史CG数量抵扣本次60镜；图鉴仍为60个空槽，未改正文、运行入口或玩家存档。\n'
(ROOT/'docs/美术/SUI-A09.md').write_text(a09)

a10='''# SUI-A10 CG制作

2026-10-29｜**开工条件已完成，60/60镜可制作；正式CG成品仍为0/60。** 用户“等上游全部定稿后再制作”的全量门槛已满足，本轮没有提前生产部分CG。

[当前制作队列](../../qa/SUI-A09-release-20261029/shot-queue.json) · [7包清单](../../qa/SUI-A09-release-20261029/package-index.json) · [A09放行](../../qa/SUI-A09-release-20261029/review-released.json) · [前置交接](../../qa/SUI-A10-preflight-20261029/交接.md) · [新增参考预览](../../qa/SUI-A10-preflight-20261029/参考预览.html)

## 已落实的开工条件

1. A02～A08相关人物、场景、衣装与道具逐镜映射完成：60个需求键、146条逐镜依赖、87份实际参考。补制19项，另保留2份返修前原件；既有原图和历史验收保持。
2. A09核验当前正文、条件、版本和指纹后放行60镜。32组共通组合、2,818条路线展开、135项重点反例通过；108/120分页下60镜进退场一致。
3. 全部上游一起就绪后按7包制作。A10自己的9项游戏/电话/消息/日历局部随CG生成，不能写成已经完成，也不形成上游循环依赖。

## 已确认衣装

| 镜头 | 沿用方案 |
| --- | --- |
| CG019 | 小满白色内搭、肩部近景，不另设睡衣或裸露 |
| CG044 | 孟遥日常教学服，不套第28天私人外套 |
| CG061 | 毛狼演出西装，不新增换衣剧情 |

原始问答保存在[用户决定](../../qa/SUI-A10-20261029/decisions.json)，本轮补齐上游依据见[授权记录](../../qa/SUI-A10-preflight-20261029/authorization.json)。不重复请求这三项确认。

## 制作进度

| 包 | 放行 | CG成品 |
| --- | ---: | ---: |
| COMMON | 15 | 0 |
| XM | 8 | 0 |
| ZZ | 9 | 0 |
| MY | 7 | 0 |
| PI | 9 | 0 |
| HQ | 7 | 0 |
| FR | 5 | 0 |

每小时自动续作保持启用，读取本次放行记录；源正文或参考指纹变化时先复核，不能照旧开工。原等待队列与11:12状态复查保留为历史，不再作为当前阻塞清单。

## 验证与未完成范围

- 19份PNG新增无损WebP，解码RGBA逐像素一致；2份透明参考白/黑/昼/夜合成已审。87份实际生产参考重新解码并核对图片/记录指纹；40份新映射既有参考核对用途。
- 904项本次开工前已有正文、原件及运行输入指纹不变。当前图鉴60空槽，绑定图像0张。
- 待完成：60张正式CG生成与逐镜视觉/格式/UI检查、A11汇总复核、I采用、E演出与读档恢复、Q引擎/浏览器/手机真机/桌面及发布。未访问玩家存档。
'''
(ROOT/'docs/美术/SUI-A10.md').write_text(a10)

queue={'task':'SUI-A10','state':'all-upstream-ready','sourceReview':'qa/SUI-A09-release-20261029/review-released.json','sourceReviewSha256':sha(REL/'review-released.json'),'released':60,'completedCG':0,'shots':review['shots'],'references':review['references']}
save(REL/'shot-queue.json',queue)

p=ROOT/'TODO-v1.1.md';s=p.read_text();lines=s.splitlines()
for i,line in enumerate(lines):
 if line.startswith('- [ ] SUI-A09制作放行：'):
  lines[i]='- [x] SUI-A09制作放行：60/60镜全部相关上游已冻结，60项需求键/146条逐镜依赖对应87份参考；补齐19项参考，保留2份返修原件。当前32组共通、2,818条路线展开、135项重点断言及双分页检查通过，904项已有输入未改；见[本次放行交接](qa/SUI-A09-release-20261029/交接.md)。制作参考放行不等于CG成品或运行采用。'
 if line.startswith('- [ ] SUI-A10 CG制作：'):
  lines[i]='- [ ] SUI-A10 CG制作：用户要求的“上游全部定稿”开工条件已完成，60镜/7包均可制作，正式CG仍为0/60；CG019白色内搭肩部近景、CG044日常教学服、CG061演出西装保持已确认方案。当前队列与验证见[任务文档](docs/美术/SUI-A10.md)，[新增19项参考可预览](qa/SUI-A10-preflight-20261029/参考预览.html)；每小时自动续作启用。最终CG、A11/I/E/Q与发布待完成。'
 if line.startswith('- 未完成范围：逐镜衣装与册子页状态、待人物/场景参考的照片成片'):
  lines[i]='- 原A05批次未制作照片成片；本轮CG前置已补6项衣装/页状态/照片参考并获A09制作放行。仍待A10-PI与COMMON正式CG、A11/I采用、E演出及Q网页/手机真机/电脑原生验收与发布；运行采用仍为0。'
 s='\n'.join(lines)+'\n'
p.write_text(s)

p=ROOT/'docs/CG调整清单.md';s=p.read_text();s=s.replace('[60镜清单](../qa/SUI-A09-selection-20261029/review-approved.json)','[60镜当前放行清单](../qa/SUI-A09-release-20261029/review-released.json)');s=s.replace('各镜待参考完成后再放行制作，详见[SUI-A09](美术/SUI-A09.md)与[本轮交接](../qa/SUI-A09-selection-20261029/交接.md)。','本轮相关上游已全部补齐并放行60/60镜；正式CG仍为0/60，详见[SUI-A09](美术/SUI-A09.md)与[最新放行交接](../qa/SUI-A09-release-20261029/交接.md)。');p.write_text(s)
p=ROOT/'docs/开发计划.md';s=p.read_text();s=s.replace('逐镜制作前置仍待核；候选选择确认已完成，非制作放行','当前60镜相关上游已全部冻结并经A09放行；CG成品及运行采用待完成');s=s.replace('每镜经A09放行，所需人物/场景定稿后制作；不同包可并行','本轮按用户要求等全部上游定稿；当前60/60已放行，按7包制作并分别验收');p.write_text(s)
p=ROOT/'docs/SUI-A美术子任务.md';s=p.read_text();s=s.replace('逐镜制作仍按各自依赖执行','本轮相关上游已全部冻结并放行60/60镜，正式CG仍为0/60');s=s.replace('8项已按用户委托选入CG101～CG108，制作前置继续逐镜核对','8项已按用户委托选入CG101～CG108；本轮60镜相关上游全部核验并放行');s=s.replace('每镜分别检查依赖；无需等待所有路线完成。需批准的方案先获批准，不依据旧行号直接生产','本轮遵从用户要求：全部60镜相关上游定稿及A09放行后开工；当前条件已满足。既有选型保持，不依据旧行号生产');s=s.replace('不能据此宣称60张已可生产','本轮另补参考并完成A09核验后已放行60/60；仍不能宣称CG成品已完成');s=s.replace('[清单](../qa/SUI-A09-selection-20261029/package-index.json)','[当前放行清单](../qa/SUI-A09-release-20261029/package-index.json)');s=s.replace('A09逐镜放行后，A10各包按已就绪依赖开工；A11滚动检查已完成批次。不等待无关路线，也不跳过相关人物或条件依赖。','本轮先满足用户要求的全部相关上游定稿与A09全量放行，再开展A10；当前60镜条件已满足。A11滚动检查已完成批次，不跳过人物或条件依赖。');p.write_text(s)

handoff='''# SUI-A10开工条件交接

2026-10-29｜**本次未达成的开工条件已补齐；60/60镜可进入正式制作。CG成品0/60，运行采用0张。**

用户此前要求“等上游全部定稿后再制作”，本次又要求“完成未达成的开工条件”。据此补制有正文依据的上游参考并逐镜冻结；三处衣装继续沿已确认方案，没有新增剧情设定或代替用户批准运行采用。

## 交付

- [19项参考预览](参考预览.html)：A02 3项、A03 1项、A05 6项、A07 4项、A08 5项。21份PNG含2份返修前原件；19份无损WebP。A04/A06沿既有定稿完成映射。
- [资源记录](../../assets/sources/20261029-cg-preflight/resource-records.json)记录原件、提示、生成来源、版本、指纹和用途。既有角色/场景原件与历史QA保持。
- [60镜放行](../SUI-A09-release-20261029/review-released.json)、[依赖清单](../SUI-A09-release-20261029/dependency-release.json)、[7包](../SUI-A09-release-20261029/package-index.json)与[制作队列](../SUI-A09-release-20261029/shot-queue.json)。60个上游需求键对应146条逐镜依赖，87份生产参考已冻结。

## 实际验证

- 新增19份PNG/WebP真实格式、尺寸及解码RGBA逐像素一致；两份透明衣装参考已查看白/黑/昼/夜合成。2份初稿因剪发缺口不明显、布袋类型错误返修并排除。
- 新映射既有40份参考已对照镜头用途；全部87份生产参考重新解码并核对图像及资源记录指纹。原28角色参考沿原用户选型和既有审查。
- 重跑32组共通相关组合、2,818条路线展开、135项重点反例、非法状态拒绝与60镜108/120分页进退场。904项已有正文/原件/运行输入指纹不变，见[A09本次核验](../SUI-A09-release-20261029/verification.json)。

## 后续

依新的队列制作60张CG和其中9项画内屏幕；最终画面仍需人物连续性、手部/道具、UI遮挡和格式检查。A11汇总、I采用、E绑定及Q引擎/网页/手机真机/桌面、发布尚未进行。未改正文、运行入口或玩家存档。当前每小时自动续作继续启用，源指纹变化时先复核。
'''
(OUT/'交接.md').write_text(handoff)
(REL/'交接.md').write_text('''# SUI-A09制作放行交接

2026-10-29｜60/60镜相关上游已冻结，开工条件全部满足。CG图像0张、运行采用0张。

[逐镜记录](review-released.json) · [当前选择](selection-released.json) · [依赖](dependency-release.json) · [7包](package-index.json) · [制作队列](shot-queue.json) · [当前核验](verification.json)

60个上游需求键对应146条逐镜依赖和87份实际参考；其中19项为本次补制，2项返修前原件保留排除。三处衣装按用户既有确认，没有改变60项选择、8个退役编号、原文、分支或进退场规则。9项画内屏幕归A10正式制作。

本次32组共通、2,818条路线展开、135项重点反例和108/120分页锚点检查通过，904项已有输入未变。[全部参考解码与指纹](reference-file-check.json)及[新映射参考用途审查](upstream-visual-review.json)通过。素材补制和视觉证据见[前置交接](../SUI-A10-preflight-20261029/交接.md)。

本次是CG制作参考放行；不是正式CG终审、用户运行采用批准或A11/I/E/Q完成。历史待核记录与文档快照保留，后续以本批为当前依据。
''')
save(OUT/'document-changes.json',{'files':changed,'beforeRoot':str(backup.relative_to(ROOT)),'purpose':'同步本次实际放行、补充参考与尚未完成范围'})
print(json.dumps({'documents':len(changed),'selectedReferences':len(selected),'decodedReferences':len(decoded),'upstreamVisualReviewed':len(up),'owners':dict(counts),'released':60,'completedCG':0},ensure_ascii=False))
