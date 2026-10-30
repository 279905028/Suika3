"""SUI-A09 人工审读结论。只写本任务文档及QA，不写选择、正文或采用库。"""
from pathlib import Path
import json, hashlib, re

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
def read(p): return json.loads((ROOT/p).read_text())
def digest(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
selection = read('docs/CG当前选择.json')
original = {x['id']: x for x in selection['items']}
idx = read('qa/SUI-A09-20261029/source-index.json')['paragraphs']
requirements = {x['id']: x for x in read('qa/SUI-A01-20261028/requirements.json')['requirements']}
bgplan = read('qa/SUI-A08-20261029/production-plan.json')
records = []

# 引用键对应本作包内已选版本；图片只作制作前置，不等于运行采用。
catalog = {}
paths = {
 'A02':'assets/sources/20261028/SUI-A02/resource-records.json',
 'A03':'assets/sources/20261028/SUI-A03/resource-records.json',
 'A04':'qa/SUI-A04-20261028/resource-records.json',
 'A05':'qa/SUI-A05-20261028/resource-records.json',
 'A06':'assets/sources/20261029/SUI-A06/resource-records.json',
 'A07':'assets/sources/20261029/SUI-A07/resource-records.json'}
for package,p in paths.items():
    d=read(p)
    for x in d if isinstance(d,list) else d['records']:
        key=x.get('packageKey') or x.get('key') or x.get('id') or x['assetId']
        if key in ['option-a','piao-option-a','yelan-a','chensheng-a','char-mengyao-human-teaching-option-b'] or key.endswith('-webp'): continue
        src=x.get('sourceFile') or x.get('png',{}).get('path') or x.get('file')
        if not src: raise ValueError(key)
        catalog[package+'/'+key]={'owner':'SUI-'+package,'recordPath':p,'recordSha256':digest(p),
          'assetKey':key,'sourceFile':src,'sourceSha256':digest(src),'version':re.search(r'(v\d+)',src).group(1),
          'label':x.get('label') or key,'scope':'已选形象/包内图的制作参考；不代表本CG姿态或运行采用已批准'}

refs={
 'W':'A07/wenwen-base','M':'A07/maolang-base','MS':'A07/maolang-serious','MT':'A07/maolang-stage',
 'S':'A07/shijiang-base','SS':'A07/shijiang-serious','CS':'A07/chensheng-b','CSD':'A07/chensheng-documents',
 'X':'A02/char-xiaoman-base','XW':'A02/char-xiaoman-work-apron','XN':'A02/char-xiaoman-practice-notebook','XH':'A02/char-xiaoman-two-helmets',
 'Z':'A03/base','ZS':'A03/smile','ZW':'A03/work-neutral','ZWS':'A03/work-serious','ZC':'A03/tied-tired-cup',
 'Y':'A04/char-mengyao-human-base-neutral','YT':'A04/char-mengyao-human-teaching-base','YJ':'A04/char-mengyao-human-casual-jacket',
 'YB':'A04/prop-mengyao-workbook-cover','YP':'A04/prop-mengyao-phone-stand','YBK':'A04/prop-mengyao-borrowed-book',
 'P':'A05/piao-base','PC':'A05/piao-prop-camera','PB':'A05/piao-prop-booklet','PK':'A05/piao-prop-camera-bag','PT':'A05/piao-prop-booklet-tools',
 'HO':'A06/sui-a06-orb-base-v001-png','HH':'A06/sui-a06-human-neutral-v001-png','HT':'A06/sui-a06-human-toy-base-v001-png',
}

supplemental = {
 'bg-my-riverside':{'owner':'SUI-A08','name':'第44天下午河边局部','reason':'孟遥正文明确河边、路口、树；A01的41场景及A08当前计划无河边独立键。不得用桥头店或长凳出租屋冒充。','source':'当天下午，我们按约在河边见面。'},
 'prop-game-screen':{'owner':'SUI-A10-COMMON','name':'普通组队游戏屏幕草图','reason':'仅根据角色停在角落及语音暂停制作无品牌草图，不补具体游戏名、头像或恋爱UI。'},
 'prop-message-screen':{'owner':'按镜头唯一制作包分配','name':'电话/消息/日历局部草图','reason':'每镜独立需求键，由该镜唯一A10包制作画内局部，不创建游戏GUI；只排原文明确文字，未给的头像、日期、金额、系统品牌不编造；设备外形交A07。'},
 'prop-piao-epilogue-pages':{'owner':'SUI-A05','name':'后日谈新改册页/费用留空纸','reason':'现有空封二不能冒充后日谈新稿或费用表；只保留留白与有据笔画，不补金额/产期。'},
 'pose-my-day44':{'owner':'SUI-A04','name':'第44天河边靠肩衣装连续性','reason':'正文未明确当天衣装；A04私人外套仅绑定第28天，不自动沿用。先提交与定稿脸型一致的当拍衣装/手部草图。'},
 'pose-xm-morning':{'owner':'SUI-A02','name':'第45天后次晨接电话的可见衣装','reason':'正文未写睡衣款式。构图限肩上和持手机手部；不得添加内衣、裸露或把第40天旧卫衣自动套来。'},
 'prop-xm-phone':{'owner':'SUI-A02','name':'小满接阿俊电话的手机','reason':'个人手机归小满，不引用文文的手机为同一实体；不显示号码、品牌或未给金额。'},
 'prop-my-umbrella':{'owner':'SUI-A07','name':'第23天文文撑开的伞','reason':'按文文个人持物归A07，并与孟遥A04核对两人握法；不能把周栀借还的伞当成同一件；仅需柄、伞骨和握法参考。'},
 'pose-maolang-aftershow':{'owner':'SUI-A07','name':'第18天演出后聚餐衣装','reason':'正文未说明散场后是否换衣；毛狼演出西装与日常花T均有版本，须在本镜草图中核定，不把衣装选择写成剧情新事实。'},
}

def shot(id, time, present, offscreen, wardrobe, props, frame, guards, reference, needs, note, *,
         anchor=None, path=None, route=None, candidate=False, title=None, rationale=None, support=()):
    old=original.get(id)
    if old:
        path='scenario/'+Path(old['originalSources'][0]['path']).name
        anchor=anchor or old['originalSources'][0]['anchor']
        route=old['originalRouteKey']
        title=title or old['originalTitle']
    matches=[p for p in idx if p['path']==path and anchor in p['quote']]
    assert len(matches)==1,(id,anchor,len(matches))
    p=matches[0]
    owner='SUI-A10-'+('COMMON' if route in ['COMMON','PM'] else route)
    deps=[]
    for k in needs.split():
        if k in requirements:
            r=requirements[k]
            candidates=[{'assetId':a['assetId'],'status':a['status']} for a in bgplan['generation'] if a['requirementId']==k]
            deps.append({'requirementId':k,'owner':r['owner'],'name':r['name'],
              'status':'待对应制作包核验当拍版本','plannedVersions':candidates})
        else:
            assert k in supplemental,k
            dep={'requirementId':k,**supplemental[k],'status':'待补当拍参考；非已放行资源'}
            if k=='prop-message-screen':
                dep.update({'requirementId':k+'-'+id.lower(),'templateKey':k,'owner':owner})
            deps.append(dep)
    current_refs=[refs.get(k,k) for k in reference.split()]
    for k in current_refs: assert k in catalog,k
    gates=[]
    if route in ['XM','ZZ','MY','PI','HQ','FR']:
        gates.append({'type':'route','value':{'XM':'xiaoman','ZZ':'zhouzhi','MY':'mengyao','PI':'piao','HQ':'huangqiuqiu','FR':'friends'}[route]})
    elif route=='PM':
        gates.append({'type':'epilogue','value':Path(path).name})
    if candidate and path=='scenario/跨路线-第36天的消息.md':
        gates=[{'type':'sharedEvent','value':'PIAO-D36','routes':['xiaoman','zhouzhi','mengyao','huangqiuqiu','friends'],'relation':'LOW'}]
    source={k:p[k] for k in ['path','line','paragraph','scope','nearestNode','quote','conditions','sourceSha256']}
    source['matchText']=anchor
    source['oldAnchorExact']=bool(old and old['originalSources'][0]['anchor'] in p['quote'])
    context=[]
    for frag in support:
        hits=[q for q in idx if q['path']==path and frag in q['quote']]
        assert len(hits)==1,(id,frag,len(hits))
        context.append({k:hits[0][k] for k in ['path','line','quote','sourceSha256']})
    row={'id':id,'kind':'replacement-candidate' if candidate else 'retained-selection','title':title,
      'originalTitle':old['originalTitle'] if old else None,'originalSources':old['originalSources'] if old else [],
      'time':time,'routeGroup':route,'source':source,'contextSources':context,
      'cast':{'present':present,'offscreenOrRemote':offscreen},'wardrobeAndForm':wardrobe,
      'propState':props,'composition':frame,'conditions':{'entryGates':gates,'requiredExpressions':guards},
      'reviewNotes':note,'referenceKeys':current_refs,'pendingDependencies':deps,
      'lifecycle':{'policy':'A09-ONE-PARAGRAPH-v1','enterBeforeId':p['enterId'],'visiblePageIds':p['pageIds'],'exitBeforeId':p['exitBeforeId'],
          'snapshotBefore':f'{time}；{present}；{wardrobe}；{props}',
          'exitRestore':'该段最后一页离开即清CG，恢复进入前背景/人物槽/衣装/形态/持物；若下一节点改变其中任一项，按下一节点演出重新计算。',
          'saveRollback':'仅在本段稳定页保存；读档先验证来源指纹及本段条件，再恢复CG编号/页相位及进入前快照；回退跨出本段清CG，不写关系、事件或结局。',
          'special':note},
      'production':{'package':owner,'contentReviewed':True,'state':'待用户确认' if candidate else '待核',
          'productionReady':False,'userSelectionConfirmed':not candidate,
          'blockingReasons':(['补选未获用户确认'] if candidate else [])+[f"{d['owner']}：{d['name']}" for d in deps]},
      'rationale':rationale}
    records.append(row)

# 共通九镜
shot('CG001','第1天，返乡站台','文文、毛狼','银行来电已结束；路人不需具名面孔','两人沿A07已选日常服；掌心与毛狼半身为主',
 '坏行李箱、脱落轮子；电话已挂断','轮子交到文文掌心，毛狼没有修好或接回；背景是抵达雨棚。',[],
 'W M','bg-bijie-arrival-platform prop-wenwen-luggage','此拍后才蹲下试拧；不预先画成修复箱。')
shot('CG004','共通第3—4天段，理发店','文文、罗小满','店内其他人留画外','小满A工作围裙及工具基准；文文衣袖沿B',
 '已打开的练习本，页角夹报名表；后脑勺练习图','桌面和小满抚平页角的手；展示不完美练习，不能以空白闭本替代。',[],
 'W X XW XN','bg-salon-bijie prop-xiaoman-practice-kit','打开页与报名材料尚待A02提供当拍参考；不补具体开课日期、校名或学费。')
shot('CG005','共通第3—4天段，便利店出口','文文、孟遥','收银员可画外；陈晟不出镜','孟遥A日常教学外形，文文B衣袖',
 '文文已自付的水瓶、孟遥装牛奶的布袋、挡门布帘','孟遥抬起布帘等文文；不画替他付款，不加丈夫来电或婚姻符号。',[],
 'W Y','bg-convenience-bijie prop-shared-food-boxes','共通不提前揭露婚姻；这次等候不是正式复合。')
shot('CG006','第5天休班，游戏中','文文的屏幕/操作手','叶岚、毛狼、师匠均为队内声音；不据语音推定同室','仅文文手/袖沿B；叶岚实体形象不需要',
 '电脑、耳机；叶岚游戏角色停在角落','使用新版停在角落的队友屏幕；原“只剩她/站在我旁边”构图不再成立。',[],
 'W','bg-old-netcafe-counter prop-netcafe-counter-equipment prop-game-screen','旧锚点已删除；镜头内部不画叶岚人脸、暧昧双人头像或独立恋爱提示。具体实体地点正文未说死，采用设备紧局部，A08柜台参考只约束设备，不认定人在网吧。',
 anchor='快赢时她忽然没了声音，角色停在角落。')
shot('CG007','共通第5—7天段，吃面时','文文、周栀；毛狼同桌','工作电话另一端画外','周栀B青衬衫；沿当拍私人吃面状态',
 '面碗、手机、正在折的摊位图','聚焦周栀接工作电话时折纸的手；不把熟客语气当恋人承诺。',[],
 'W Z M','bg-noodle-shop prop-zhouzhi-planning prop-shared-food-boxes','此刻电话未挂，挂断后须退出接电话动作；摊位图不画具体租金或地址。')
shot('CG008','第7天聚餐，毛狼到达前','文文、飘','毛狼此刻尚未到，不增加其他席位人物','飘B白衬衫衣摆打结，非默认垂下衣摆',
 '小册子有空页，桌边借来的相机','飘把册子推向文文；本拍未定义展示哪一页，不填未写完的话。',[],
 'W P PB PC','bg-friends-meal-shop prop-piao-knots','衣摆结需要与B同脸的当拍参考；借相机不改成已购买，不把空封二等同所有空页。')
shot('CG010','第11天，门边赴约前','文文、毛狼、飘','其他配角画外','三人日常已选形象；不画情侣站位',
 '毛狼卷出白边的海报，文文的手仍在门把上','飘站门边说明自己还未开口；海报尚未递到她手中。',[],
 'W M P','bg-old-netcafe-counter prop-maolang-performance-kit','海报递交在下一段；不提前画她答应整场或要求文文退出。')
shot('CG011','第14天聚餐，拍卖坦白','文文、毛狼、罗小满、飘、周栀；孟遥晚课后到','叶岚明确缺席；师匠未列席，不加；店员之后端汤',
 '五位可辨人物沿各已选日常版；孟遥仅作为晚到席位，不擅定此句已抵达','菜、碗筷、飘册子/相机、小满膝上头盔；文文手机扣桌',
 '文文与毛狼/小满反应为主体，周栀和飘可入画；孟遥席位/画外处理，避免自定到场时刻。',[],
 'W M X P Z Y XH','bg-friends-meal-shop prop-shared-food-boxes prop-xiaoman-helmets','去除旧叶岚恋爱群像。正文只说孟遥晚课后才来，没有给到达拍点；不得强画此句全员到齐。',
 support=('叶岚当天有事，提前说了不参加。',))
shot('CG012','第14天20:30，正式开门','文文、黄球球球形','其他人不出现','黄球球球形A，一只小手托腮；文文门框手部',
 '蓝凳、门框；另一张凳子尚未搬到近处','从门口看蓝凳上的黄色圆球；不画人形或儿童身体。',['C01-02=A','C02-01=A'],
 'W HO','bg-huangqiuqiu-room prop-yard-fixed','不能要求day14-meeting-read已真才显示首次见面；该事件在整段相识完成后才置真。')

# 罗小满七镜
shot('CG014','第22天剪发','文文、罗小满','其他店员顾客不需出镜','小满工作围裙、卷袖；文文已围围布；短发长度按剪发进行中',
 '镜子、发夹、围布、剪刀/梳子','镜中对视，发夹刚落在围布上；不要仍含嘴里或悬停成装饰。',[],
 'W XW','bg-salon-bijie prop-xiaoman-tools prop-salon-fixed','新增镜像手位/卷袖/发夹草图待A02；镜像不改变人物原有左右特征。')
shot('CG015','第22天剪完冲碎发','文文、罗小满','其他人画外','小满延续同日工作版；文文湿短发、仰躺洗头池',
 '卷毛巾、洗头池；睫毛一滴水','文文仰视小满低头近景，手在后颈捻掉碎发；不是接吻。',[],
 'W XW','bg-salon-bijie prop-salon-fixed prop-xiaoman-tools','起身碰下巴在后段；本拍不能提前坐起。')
shot('CG016','第27天烧烤摊','文文、罗小满','阿俊及同桌朋友在场但以画外声音保留','小满A日常衣装、文文B外套',
 '塑料凳、膝边餐桌；小满抓文文外套前襟','抓衣领主动亲吻近景；两人已成年；没有举手机拍照。',[],
 'W X','bg-bbq-xiaoman-friends prop-shared-food-boxes','当众说对象尚未经文文同意，不能图内写成贵阳已交往；阿俊未定脸，不凭空补出。')
shot('CG019','第45天留宿后的次晨','文文、罗小满','阿俊在电话另一端','小满乱发；肩上紧景衣领待A02同版确认，文文床头衣装不扩展',
 '手机通话，水杯尚未递出','小满坐起认真催账，文文在画外等待；不显示具体欠款金额。',['XM07-01=A'],
 'W X','bg-wenwen-bijie-rental pose-xm-morning prop-xm-phone','此拍属于早期A，未来XM08可A或B；不能限最终AA。接阿俊来电的是小满手机，设备不可错误绑定为文文同一台。')
shot('CG020','第53天卖车之后','文文、罗小满','买车女人已离开','小满A低落抱双头盔v002，文文B','两顶头盔、台阶；车和备用钥匙已交出',
 '小满坐台阶，提起拖地的头盔带；车辆不再在身旁。',[],
 'W XH','bg-bus-stop-bijie prop-xiaoman-helmets','随后头盔寄店，不随身带去成都；不使用微笑v001。')
shot('CG022','第60天车站','文文、罗小满','广播；其他旅客画外','小满A日常版，文文B外套','拉住领口；脚边行李箱绑带已收好',
 '拉领口近景，对应“还认不认”而非提前显示下一段接吻。',['XM07-01=A&XM08-01=A'],
 'W X','bg-departure-station prop-transport-packing','AB拥抱/BA交照片/BB无拥抱均不能复用此镜；不画已售电动车和寄存头盔。')
shot('CG023','第91天，成都宿舍视频通话','文文在毕节；罗小满仅在手机视频内','宿舍室友仅声音，不补外形','小满A脸型；视频截胸上，不补睡衣；文文B袖',
 '手机视频、打开再挡脸的练习本','明确手机边框分隔两地；取练习本挡半脸一拍，飞吻由文字承接。',['XM07-01=A&XM08-01=A'],
 'W X XN','bg-chengdu-salon-study bg-bijie-slope-street prop-xiaoman-practice-kit prop-message-screen','不是文文到成都，也不是隔本实体接吻；宿舍细节以A08远程参考为限。')

# 周栀八镜
shot('CG025','第15—21天段，回声306，上班前','文文、周栀','其他人未同处','周栀私人青衬衫B自然笑；文文B','两支麦克风、沙发；她麦克风扣在腿上、袖口瓜子壳',
 '两人唱跑调后的真笑；不画营业陪客群像。',[],
 'W ZS','bg-huisheng-306 prop-huisheng-sales','回声停钟为11:47而非网吧快十分钟钟；不复制歌曲歌词/品牌UI。')
shot('CG026','第22天，回声门口工作中','周栀、乔哥的袖口/手；文文视点','包房客人画外','周栀B脸型；当日工作衣装只用现有已选基准，乔哥不露脸','手机套、翻起袖口；文文握伞',
 '周栀压平乔哥袖口的手部紧景；不把手替换成文文。',[],
 'W Z','bg-huisheng-corridor prop-zhouzhi-personal-box char-qiaoge','乔哥外形未定，只申请必要袖口/手部参考；若扩大成露脸构图须先A07定稿。')
shot('CG027','第24天，回声前台','文文、周栀；前台递单手可画外','乔哥不在该拍','周栀休半天，B私人版，不能套当班陪酒姿态','未付款消费单、伞','单子隔在两人之间；撤单尚在下一段。',[],
 'W Z','bg-huisheng-corridor prop-huisheng-sales prop-zhouzhi-personal-box','不得写已付款、小费金额或假消费项目；不要提前把单子画成撤销回执。')
shot('CG029','第30天，回声最后夜，ZZ06的B段','文文、周栀','乔哥/前台/同桌人在场但可画外','周栀工作神态，保持当日衣装连续；文文B',
 '消费单已交还前台；她此句后才拿起麦克风','周栀没有站到文文旁边，明确说不接这张单；非甜蜜官宣合影。',['ZZ06-01=B'],
 'W ZWS','bg-huisheng-306 prop-huisheng-sales','A段不能出现本镜；不画手持已交还的单子，也不画双方拥抱。')
shot('CG031','第36天之后、45天之前；取最后私人物品日，正文未定具体日号','文文、周栀','楼下搬运者画外','周栀B私人版；文文B','11:47停钟仍挂原处；茶几已搬走、残镜和箱子',
 '周栀仰看旧钟，没有摘走；停业后的306。',[],
 'W Z','bg-huisheng-306 prop-huisheng-stopped-clock prop-zhouzhi-personal-box','不沿用旧第32天标签，不画回声继续营业；紧随A亲密/B保持距离不能混拍。')
shot('CG032','第46天，新接工作场子门口','文文、周栀','前台/抽烟人和室内顾客不需具名面孔','周栀B工作裙装，头发重新整理，沿306找回的耳饰',
 '她递文文的折伞；另一块招牌','门口递伞，明确是另一个工作场子，不套回声原门面。',[],
 'W ZW','bg-zhouzhi-other-venue prop-zhouzhi-personal-box','不新造场所名称/标志；回声关闭不等于退出陪酒。')
shot('CG034','第60天，车站第二遍广播','文文、周栀','阿英同程但此拍留画外','周栀B私人版；文文B','蓝沿白杯由周栀交给文文，行李箱由她自己拖',
 '选取分开拥抱后交杯一拍，不能让同一人既递杯又已在检票远景。',['ZZ06-01=A&ZZ08-01=A'],
 'W Z ZC','bg-departure-station prop-zhouzhi-blue-rim-cup prop-transport-packing','AB也交杯但情绪/告别不同，不能靠相似道具放宽此镜AA条件；杯交出后清她持杯状态。')
shot('CG035','第91天清晨，文文回租屋后','文文','周栀仅电话声音，不显示视频或实体同场','文文B衣袖；周栀衣装不需要可视化','烧饼纸袋、通知袋、放手边的通话手机',
 '文文咬饼与电话近景；以普通通话标识表达两地，周栀哈欠来自声音。',['ZZ06-01=A&ZZ08-01=A'],
 'W','bg-wenwen-bijie-rental prop-wenwen-phone prop-wenwen-housing-papers prop-shared-food-boxes prop-message-screen','新版段落未开视频；禁止把周栀画进手机人像画面或同一出租屋。')

# 孟遥五镜
shot('CG038','第21天，清旧书桌边；场所不额外定名','文文、孟遥','陈晟未到场','孟遥A；文文B衣袖','旧练习册封面“文文/48/60”，书箱；册子尚在她手里',
 '封面与两人手部近景；60为重做成绩，非把48涂改。',[],
 'W Y YB','prop-mengyao-book-box prop-shared-food-boxes','第27天才揭露婚姻；不加戒指特写、相机或“等你多年”的图内文字。场所只画桌箱局部。')
shot('CG039','第23天，烧饼店雨檐下','文文、孟遥','其他人画外','孟遥A当日服，文文B湿肩；不切私人第28天外套','刚撑正的伞，双方手共同握/扶柄',
 '她一手抓伞柄、一手穿过文文胳膊，贴近但未亲吻。',[],
 'W Y','bg-bridge-shaobing prop-my-umbrella','MY07未发生；不套结局AA门槛。伞是本段文文打开的伞，不沿用周栀借伞归属。')
shot('CG040','第27日17:30之后、下楼之前，试讲结束','文文、孟遥','陈晟在楼下约定处，尚未被介绍，不入此图','孟遥A教学衣装，文文B领口','试讲手机/支架，夹子掉桌边；视频已播完',
 '两人额头相抵的瞬间，手机只表现试讲结束；不画私密录像或已知婚姻后的公开关系。',[],
 'W Y YP','bg-mengyao-bijie-school prop-mengyao-teaching-kit','旧句重定位到新段；同段后半孟遥看时间坐直，画面取前半，离段即退，不能持续到丈夫到场。',
 anchor='分开时，视频已经播完。她额头抵着我的')
shot('CG041','第27天，机构门口','文文、孟遥、陈晟','学生通行画外','陈晟B方圆脸与发白深色外套，孟遥A，文文B','文件袋此刻在陈晟手里；门边纸箱刚挪开',
 '普通接人场景；陈晟先挪挡门箱，保持友善日常，文文站台阶。',[],
 'W Y CS CSD','bg-mengyao-bijie-school prop-chensheng-handheld prop-shared-food-boxes','旧句重定位；人物显示名在“陈晟，我丈夫”前不提前贴丈夫标签；袋交出后退出持袋图。',
 anchor='陈晟站在门口，穿一件洗得有点发白的深色外套')
shot('CG044','第44天下午，河边','文文、孟遥','陈晟不在场，婚姻仍在','孟遥当天衣装待A04当拍草图；不自动沿用第28天私人外套','两只烧饼，一只递给文文','她递饼并把头靠到肩上；不放回第38天谈账长凳，不表现同居。',['MY07-01=A'],
 'W Y','bg-my-riverside pose-my-day44 prop-shared-food-boxes','旧锚点失效，改核第44天；AB前期亲密保留，BA/BB禁入；注意路口/树位置，但不新增地名。',
 anchor='她从袋里拿出两只烧饼，把一只递给我，头靠到肩上。')

# 飘八镜
shot('CG061','LOW第18天，演出后小店','飘、文文、毛狼、周栀','其他朋友仅匿名画外','飘B；毛狼演出后衣装待A07确定是否换回日常，不径用舞台西装；周栀B',
 '飘相机；毛狼先挡脸、放下后才拍','取按快门前征询许可的瞬间；相机未拍，不在挡脸时偷拍。',['PIAO_RELATION=LOW'],
 'W P PC M Z','bg-friends-meal-shop prop-piao-photos prop-shared-food-boxes pose-maolang-aftershow','照片成片另依赖人物/席位，A05本批未交付；不能把HIGH毛狼退让场景混入。')
shot('CG062','HIGH第21天，网吧柜台','文文、飘、毛狼','其他人画外','三人日常既定版；毛狼认真，不强行微笑','裁歪海报、剪刀已放下、飘包','毛狼承认退出追求但不必立刻高兴；纸歪边留在桌面。',['PIAO_RELATION=HIGH'],
 'W P MS','bg-old-netcafe-counter prop-maolang-performance-kit','剪刀已经放下，不画仍扬剪；海报不得补演出日期、地点。')
shot('CG063','HIGH第23日下午，凉糕店','文文、飘','发问者已到门外','飘B；此前衣角/外套结若可见需A05核同日连续性','凉糕碗、重新拿起的勺、纸巾','飘平视讲述过去；不制作旧KTV闪回、羞辱人群或创伤象征。',['PIAO_RELATION=HIGH'],
 'W P','bg-lianggao-shop prop-shared-food-boxes prop-piao-knots','当前待业与摄影学习不改写；不增加职业经历和解释。')
shot('CG066','HIGH第七章装订当日，傍晚前','文文、飘','窗外收雨棚人只保留声音','飘B同日衣装；两人全衣状态，过程留白','未装订纸页落地，订书机/工具，末页尚空','双人亲近与落下纸张；不把装订册子每本都画完或把末页写满。',['PIAO_RELATION=HIGH'],
 'W P PB PT','bg-piao-bijie-room prop-piao-booklet-kit','本拍不依赖PI06；PI06=B的后续亲密也真实发生，不能误筛成最终AA。')
shot('CG067','LOW第36天，本线面馆门外','文文、飘','毛狼没有在本拍到场','飘B，身形不因怀孕被擅自改造','从台阶捡起的湿绳，绕手指后松开','飘与文文双人谈话前的手部近景；她还未说出怀孕消息。',['PIAO_RELATION=LOW'],
 'W P','bg-noodle-shop prop-piao-knots','仅PI本线，不复用五线公共事件；本镜绳是湿绳，公共事件是相机包带；PI-L06选项尚未发生。')
shot('CG068','LOW第91天，下午散步','文文、飘','毛狼只在谈话中提及，不在散步现场','飘B成年形象，孕期外观未指定；不补孕肚/医疗细节','相机从飘递给文文；打结的手，结的具体对象未明','手与相机紧景，第一次糊片后再对焦；不补具体绳结对象。',['PIAO_RELATION=LOW','PI-L06-01=A'],
 'W P PC','prop-piao-knots prop-piao-photos','若画结的载体须A05先核草图；试着交往不能解释为代替毛狼承担父亲角色。场所仅散步局部，不补公园或河边。')
shot('CG069','HIGH第60天车站','文文、飘','其他旅客画外','飘B、文文B；出发服按同日连续','飘自己的包已从文文手中取回，放脚边','她腾出双手拥抱；视线和身体留出进站方向。',['PIAO_RELATION=HIGH','PI08-01=A','PI06-01=A'],
 'W P PK','bg-departure-station prop-transport-packing','不取消她独自出发，不让包仍挂文文手臂或用拥抱阻拦行程。')
shot('CG070','LOW第91天，收照片后回复','文文','飘仅消息；毛狼仅照片里的手/茶杯语义','只需文文B衣袖；不画三人实时同桌','寄来的两张照片：桌面与雨后老街；手机回复','照片、手与手机近景；保留推茶杯往来，不把未明确的合照人物补满。',['PIAO_RELATION=LOW','PI-L06-01=B'],
 'W','prop-piao-photos prop-wenwen-phone prop-message-screen','照片正面/反面日期参数未给具体值，A05需补成片；不能拿CG068恋人散步图代替。')

# 黄球球六镜
shot('CG073','第18天晚间，黄球球房间','文文、黄球球球形','其他人不出现','球形A一只小手；文文B手袖','黄球球杯底已有姓名；文文正在写自己的杯底；铅笔由她交来',
 '手、双杯和球形脸；取写字一拍，不同时画倒水完成。',[],
 'W HO','bg-huangqiuqiu-room prop-hq-tableware','准确字样“文文”和“黄球球”；不把球形小手画成两只人手，倒水由后文承接。')
shot('CG075','第24天，房内看小白花照片','文文、黄球球球形','其他人画外','球形A；一只小手操作，非人形','文文手机、小白花模糊照片','球形小手挡住屏幕局部，文文按她要求调整放大。',[],
 'W HO','bg-huangqiuqiu-room prop-yard-fixed prop-wenwen-phone','黄球球没有自有手机；这张是花，不偷拍她，不画门外公开活动。')
shot('CG077','第45天17:00按约吃饭接近结束','文文、黄球球球形','师匠不在房间，工作照片远程','球形A，文文B衣袖','桌沿、吃过的餐盒，文文手机扣下','球形仅有的小手搭文文手背；不提前变人形。',['HQ07-01=A'],
 'W HO','bg-huangqiuqiu-room prop-hq-tableware prop-shared-food-boxes','HQ08未来可A/B，均保留本次守约；不能把触手当变身奖励。')
shot('CG078','第55天17:00，自主呈人形','文文视点、黄球球人形','无公开路人','人形B：棕齐刘海、米灰外套/白印花上衣、黑颈饰、画面右白遮片；腰上截幅',
 '浅色圆脸玩偶棒在手，门把手','房门内腰上首次人形构图；不补裤裙/腿，不推断遮片病史。',[],
 'W HT','bg-huangqiuqiu-room prop-yard-fixed','HQ07的A/B均显示；不是选择奖励，玩偶无魔法功能；后续普通镜不默认持棒。')
shot('CG079','第57天房内，第二次靠近','文文、黄球球人形','门外脚步在下一段，只保留声响','人形B空手，同版眼部遮片；文文外套尚未脱，肩上近景','湿纸巾已放下，文文的手被牵到她肩侧','额头相抵、她主动靠近；不把玩偶棒或纸巾留在抓握手里。',[],
 'W HH','bg-huangqiuqiu-room prop-hq-room-fixed','共同段允许所有结局组合；不要求未来AA，也不画此拍之后才脱去的外套。')
shot('CG082','第75天贵阳交钥匙后，房内限时见面','文文、黄球球人形','其他人不出现','人形B空手、腰上/手部近景；文文B旧包','钥匙圈少旧房钥匙，仍有出租屋钥匙；换洗物留包中','她指向仍可用的租屋钥匙，拒绝未经商量搬住；非同居邀请。',[],
 'W HH','bg-huangqiuqiu-room prop-wenwen-keyring prop-wenwen-luggage','所有关系组合均发生，不把分手画成退回球形；包没有被接收进屋安置。')

# 朋友四镜
shot('CG086','第21天下午，旧网吧柜台','文文、师匠、毛狼；网吧买家在场但可留画外','无其他需定脸群众','文文B、师匠A、毛狼D','卷尺在柜台边，毛狼演出单；文文手中饮料箱尚未放下',
 '文文说明需自己答应，主体是三人反应及饮料箱手部；买家不露脸。',[],
 'W SS M','bg-old-netcafe-counter prop-extras-handheld prop-maolang-performance-kit prop-netcafe-counter-equipment','此买家不是小满电动车买家；不能画师匠已替文文确定新工作。')
shot('CG090','第36天下午，售出游戏机后','文文、师匠','买家已出门；毛狼不在擦灰拍点','师匠A、文文B手部','旧游戏机位置只留灰印，设备和手柄已卖出','师匠擦空位；游戏机不能还在台上。',[],
 'W S','bg-old-netcafe-counter prop-netcafe-console','LOW须先完成公共事件再返回；HIGH正常到此。待结薪不意味着工资已结清。')
shot('CG091','第52天，旧网吧打印串词','文文、毛狼','演出负责人仅电话','毛狼D，文文B','电脑文本页、鼠标、打印机；那页正在被删除','毛狼自己按删除，文文已把手从鼠标移开；画面取空掉页，不重印私事笑话。',[],
 'W MS','bg-old-netcafe-counter prop-maolang-performance-kit prop-netcafe-counter-equipment','题目稍后才抹掉，不把删除主体画成文文；普通选择不改变本拍。')
shot('CG094','第91天22:00前，新网吧','文文','新同事提问画外；毛狼师匠不在此柜台','文文B日常衣袖','笔、本子、饮料零钱柜台；手机无新消息','拿笔停顿答“挺好过”，画的是新柜台；不是旧三人团聚。',['FR06-01=B|FR08-01=B'],
 'W','bg-new-netcafe prop-netcafe-records','AB/BA/BB均已结薪但友情疏远；旧网吧已奶茶店，不用旧柜台背景。')

# 双后日谈五镜统一归COMMON
shot('CG095','HIGH后日谈，第一年碰面饭局','文文、飘、毛狼','其余人未具体说明，留画外','飘B、毛狼D日常服；未到婚后，不用婚礼服','饭碗被飘推回毛狼面前，普通菜','飘让他先吃饭，毛狼仍讲实际少收的收入；不补金额。',['PIAO_RELATION=HIGH','ENDING!=PI-E1','ENDING!=FR-E2'],
 'W P M','bg-friends-meal-shop prop-shared-food-boxes','FR-E2不在现场，PI-E1不读本篇；不画怀孕纸/孕肚。主线伴侣不因结局自动加入。')
shot('CG096','LOW后日谈，第91天以后碰面','文文、飘、毛狼','问两人关系的人留画外','飘B、毛狼D日常；不设孕期体态或婚姻','写有已知部分和留空项的纸、手机日程、布袋','毛狼说实际能承担的数，飘落笔；纸上的具体金额不出现。',['PIAO_RELATION=LOW','ENDING!=FR-E2'],
 'W P M','bg-friends-meal-shop prop-piao-epilogue-pages prop-piao-knots','需要合法LOW后日谈分派及事件已读；PI-LE1仍与文文试着交往，不让画面暗示飘毛狼成夫妻。')
shot('CG098','LOW后日谈，饭后拍照之前','文文、飘、毛狼；其余愿意入镜者不补脸','明确不愿入镜者及其椅子留画外','飘B、毛狼D日常；不加新配角定脸','相机、椅子、桌；毛狼先搬椅子后才坐','取飘询问是否拍照的局部，空出画外边界；不是已拍好的全员合照。',['PIAO_RELATION=LOW','ENDING!=FR-E2'],
 'W P M PC','bg-friends-meal-shop prop-piao-photos prop-shared-food-boxes','FR-E2没赴饭局；黄球球不参加，孟遥结局不追加公开情侣站位；同意后才可表现按快门。')
shot('CG099','HIGH后日谈，两年后婚后朋友饭','文文、毛狼、飘','其他主线角色不自动带入','飘明确没穿礼裙，沿B日常；毛狼D日常','新改册子、水渍、普通饭桌','飘先擦水渍再放册子；不是婚礼宴会，夫妻的婚后饭。',['PIAO_RELATION=HIGH','ENDING!=PI-E1','ENDING!=FR-E2'],
 'W P M PB','bg-friends-meal-shop prop-piao-epilogue-pages prop-shared-food-boxes','不能借本镜给孟遥宣布离婚/公开关系，也不带黄球球公开出场；“两年后”按源文相对时序，不补公历日期。')
shot('CG100','HIGH后日谈，两年后，FR-E2群消息','文文的手/手机','毛狼与飘只在群消息，婚讯照片为远程附件','文文B袖；不画其赴宴，也不自动设计婚纱','群消息“我们结婚了”，同条照片附件、祝福短回复','只画手机消息和未展开照片附件框；照片具体场景/服装未给，不擅制婚礼照。',['PIAO_RELATION=HIGH','ENDING!=PI-E1','ENDING=FR-E2'],
 'W','prop-wenwen-phone prop-message-screen','若要展开照片，须另确认具体画面；本版本保留附件信息即可，不恢复友情或现场视角。')

# 8项缺口候选：暂用候选号，绝不复活取消编号或改写选择文件。
def alt(n,title,path,anchor,time,present,offscreen,wardrobe,props,frame,guards,reference,needs,note,route,rationale):
    shot(f'A09-C{n:02d}',time,present,offscreen,wardrobe,props,frame,guards,reference,needs,note,
         candidate=True,title=title,path='scenario/'+path,anchor=anchor,route=route,rationale=rationale)
alt(1,'先问这件事能告诉谁','跨路线-第36天的消息.md','我问这件事能告诉谁。',
 '五条非飘路线第36天公共事件','文文、飘、毛狼','师匠等饭，不在现场','飘B、毛狼D、文文B日常，不增孕期外观',
 '相机收包、松结包带、小本子；毛狼接电话时走远两步','飘说明消息边界，文文倾听；毛狼接电话移远，三人位置与本线CG067区别清楚。',
 [],'W P M PK','bg-noodle-shop prop-piao-knots prop-piao-booklet-kit',
 '五线LOW通过CALL进入，RETURN前退；保留调用栈与原路线，不增加追求选项；不得复用PI湿绳独谈图。','COMMON',
 '补目前五条非飘路线公共事件的三人镜头，CG067仅覆盖飘本线。')
alt(2,'没裁掉的失败处','罗小满-练习本.md','我把另一张补上。她收到以后，问我刚才是不是又去店里。',
 '第91天，XM-E2','文文','小满仅消息，没有视频','文文B袖；小满只以作品/剪发照片关联',
 '第22天原始侧面照、手机，不开视频','发出没有裁掉剪坏耳边的原照；画文文手与照片，不造成都同场。',
 ['XM07-01=B|XM08-01=B'],'W XW','prop-xiaoman-practice-kit prop-wenwen-phone prop-message-screen',
 '保留分开后普通互助，AB/BA/BB不重新许诺；照片正面另需A02同版参考。','XM',
 '补小满分开结局的视觉收束，与CG023继续线视频形成差别。')
alt(3,'自己把袖口捋平','周栀-十一点四十七分.md','没有她伸手帮我压平，我便自己往下捋了一下。',
 '第91天清晨，ZZ-E2','文文','周栀不在场也未通话','文文B外套，皱袖口、没打理的头发',
 '闭店回声玻璃反光、纸袋垃圾已拿到桶边','只拍文文在玻璃倒影里自行捋平袖口；不叠周栀幻影。',
 ['ZZ06-01=B|ZZ08-01=B'],'W','bg-huisheng-corridor',
 '回声仍停业；不是她回头或准备复合；镜中左右按实际倒影处理。','ZZ',
 '呼应CG026袖口动作，补周栀分开结局并突出文文自己生活。')
alt(4,'第98天先留空','孟遥-旧题.md','我把第98天先留空，车票没买。',
 '第91天，MY-E1','文文','孟遥仅此前通话；陈晟不在室内','文文B衣袖',
 '留空日程、红笔收抽屉、旧练习册分开放；车票未买','抽屉和留空安排近景，不画情侣新家或已订车票。',
 ['MY07-01=A&MY09-01=A'],'W YB YT','bg-wenwen-bijie-rental prop-mengyao-teaching-kit prop-message-screen',
 '第98天是未定计划，不是下一场已发生约会；孟遥未离婚，秘密继续。','MY',
 '补孟遥继续结局的当下代价，现有五镜均发生在最终选择前。')
alt(5,'取消单独的提醒','孟遥-旧题.md','才取消置顶，关掉单独的提醒。',
 '第91天，MY-E2最后电话后','文文','孟遥电话已结束；陈晟不知情不另演发现','文文B手/袖',
 '手机取消置顶及单独提醒；不删除历史或照片','手从通话收束到取消置顶；不画重约、拉黑、抹掉旧情。',
 ['MY07-01=B|MY09-01=B'],'W','prop-wenwen-phone prop-message-screen',
 'AB/BA/BB都可；不放归还红笔/包裹，因为仅AB有这一历史。','MY',
 '补三个断开组合的共同收束，避免只用AB寄物代表整个MY-E2。')
alt(6,'最后一页不再等确认','飘-空白页.md','下午，我睡醒后把册子收进抽屉。',
 'HIGH第91天下午，PI-E2','文文','飘未在场','文文B袖',
 '属于文文的那本册子、抽屉；末页不等于空封二','把册子收好，不撕、不扔；文字最后一页只按源稿，不补对方回复。',
 ['PIAO_RELATION=HIGH','PI06-01=B|PI08-01=B'],'W PB','bg-wenwen-bijie-rental prop-piao-booklet-kit',
 '前面已经写过内容；空白封二资源不可冒充此页。HIGH分开后才能接对应后日谈。','PI',
 '补飘HIGH分开结局，区分LOW朋友结局CG070。')
alt(7,'五点不再等的提醒','黄球球-门后.md','手机五点的旧提醒响了。我看了一会儿，把它取消，',
 '第91天下午，HQ-E2','文文','黄球球仍在自己房内且为人形，不同场','文文B手/袖','旧五点提醒、柜中自己的杯子；保留今晚工作提醒',
 '文文手机取消旧约，自己的杯子已放柜子；不让黄球球操作手机。',
 ['HQ07-01=B|HQ08-01=B'],'W','bg-old-netcafe-counter prop-wenwen-phone prop-hq-tableware prop-message-screen',
 '非朋友线网吧未默认转手；不画黄球球消失、退回球形或伤病；不补恋爱惩罚。','HQ',
 '补黄球球分开结局，同时保留她自主生活与人形持续。')
alt(8,'两份早饭，不假装人齐','朋友与职业-夜班.md','师匠递来一份早饭，这回只买了两份。',
 '第91天早晨，FR-E1','文文、师匠','毛狼还在外地；没有第三人同席','文文B、师匠A日常','两份早饭、装好的猫画照片纸袋','旧店旁递早饭；只两份，不多摆空碗假装毛狼在场。',
 ['FR06-01=A&FR08-01=A'],'W S','bg-old-netcafe-milk-tea prop-netcafe-cat-drawing prop-shared-food-boxes',
 '背景旧店已变奶茶店；平等往来，不重新当雇主或恢复旧网吧；猫图及冲印照同源。','FR',
 '补朋友线继续结局，与CG094的新柜台疏远结局相对。')

assert {r['id'] for r in records if r['kind']=='retained-selection'}==set(selection['activeSelectedIds'])
assert len(records)==60
used={k for r in records for k in r['referenceKeys']}
result={'schemaVersion':1,'task':'SUI-A09','date':'2026-10-29','scope':'CG文字镜头复核与补选提案；非图像制作/最终采用/运行绑定',
 'inputSelection':{'path':'docs/CG当前选择.json','sha256':digest('docs/CG当前选择.json'),'activeCount':52},
 'retiredIds':selection['retiredRouteIds'],'replacementIdsAreProvisional':True,
 'references':{k:catalog[k] for k in sorted(used)},'supplementalRequests':supplemental,'shots':records}
(OUT/'review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

def link_source(p):
    return f"[{Path(p['path']).stem}:{p['line']}](<{ROOT/p['path']}:{p['line']}>)"
def condition_text(r):
    pre=[]
    for g in r['conditions']['entryGates']:
        value={'xiaoman':'罗小满','zhouzhi':'周栀','mengyao':'孟遥','piao':'飘','huangqiuqiu':'黄球球','friends':'朋友与职业'}.get(g['value'],g['value'])
        pre.append({'route':'仅路线','epilogue':'合法后日谈分派','sharedEvent':'五线LOW调用'}[g['type']]+' '+value)
    return '；'.join(pre+[e.replace('|',' 或 ').replace('&',' 且 ') for e in r['conditions']['requiredExpressions']]) or '共通到达本段，无选项门槛'
def prereq_text(r):
    a=['`'+k+'`' for k in r['referenceKeys']]
    return '、'.join(a)+'；待核：'+'、'.join(d['name']+'（'+d['owner']+'）' for d in r['pendingDependencies'])

md='''# SUI-A09 CG复核与补选候选

2026-10-29｜**52项保留选择逐镜审读完成，提出8项补选候选；用户尚未补选。** 原选择和8项取消记录保持不变。当前A08场景/共用物件尚在制作，另有当拍道具与衣装待核，因此本批正式放行制作 **0镜**。这不影响本任务的复核交付完成。

[机器可读逐镜记录](../../qa/SUI-A09-20261029/review.json) · [核验报告](../../qa/SUI-A09-20261029/verification.json) · [交接](../../qa/SUI-A09-20261029/交接.md)

## 复核结果

- 原60选择中52保留，取消CG049、CG050、CG052、CG053、CG055、CG057、CG058、CG060；取消项不进入7个制作包。候选使用A09-C01～C08临时号，不占用旧编号。
- 48项原文字锚点仍能在当前正文唯一匹配；CG006、CG040、CG041、CG044已按新版重新定位。行号只方便阅读，绑定须使用本批原文、来源指纹、段落ID与页ID联合校验。
- 保留镜头的标题沿用原选择名称以便追溯，不作为新版画面事实；尤其CG006不能再按“只剩她”构图。标题变更与最终编号由集成者在用户确认后合并。
- CG006改为普通队友因工作暂停游戏，叶岚无实体同场或恋爱暗示；CG011不画当天缺席的叶岚、未登记同席的师匠，也不推定孟遥具体到场时刻。
- 孟遥CG038～041发生在MY07前，不按最终AA删去；CG044仅要求MY07=A，AB也应保留。MY07=B后不能用亲密图；所有组合婚姻仍在。陈晟引用A07已选B。
- CG019、CG066、CG077及黄球球第55/57天共同段不得误用最终双A过滤。CG035只有声音通话，CG023才是视频。黄球球始终没有自己的手机。
- CG067是飘LOW本线的湿绳独谈；五线公共事件用相机包带且有毛狼，不能共用。后日谈统一归COMMON制作，FR-E2只读消息；CG095/096/098/099不得让FR-E2到场。

“已复核”指正文语义、锚点和条件已审；“待核”指还缺列明的制作前置；“待用户确认”用于8个候选；“可制作”仅在镜头与全部所需参考就绪后由A09更新。本批没有复审历史14张CG的画质，也没有把历史图数量抵扣52项需求。

## 8项补选提案

每项填补当前选集的不同空缺，数量合计8。选择范围、保留原60张目标与最终编号均由用户决定；这张表不构成自动补选。

| 临时号 | 候选镜头 | 出现条件 | 补足的位置 |
| --- | --- | --- | --- |
'''
for r in records[52:]:
    md+=f"| {r['id']} | [{r['title']}](#{r['id'].lower()}) | {condition_text(r)} | {r['rationale']} |\n"
md+='''
## 版本、构图与恢复约定

所有人物参考键的**实际路径、版本、SHA-256及上游记录指纹**见[review.json的references](../../qa/SUI-A09-20261029/review.json)。A02选A、A03选B、A04选A、A05沿既定B、A06球A/人B；A07文文B、毛狼D、师匠A、陈晟B。叶岚本选集无需实体画像，不以取消镜头恢复她的恋爱资源。

参考图用于沿用脸型、发型、已确认衣装或同一物件结构；按逐镜文字决定姿态与数量。例如CG011只取双头盔参考中的头盔造型，不把卖车后的两顶低落抱姿复制到第14天；CG034只取蓝沿杯造型，不继承第36天扎发疲态。

逐镜只画原文明确动作；未说清地点采用紧局部，不命名新地点。当前构图是A09制作约束，不等于新衣装、配角脸或图像草稿获批。人物“在场”也不等于每位都必须入画；画外人物仍须保留正文存在。新增露脸配角先交A07，个人道具归各人物包，共用道具和场景归A08。

沿A01的1280×720横屏，以[64,96,1152,322]作脸/手/关键物件建议区域；正文框在y=490起，姓名框在y=442起。文字多的手机或练习本特写可由E安排正文框显隐，未验证前不保证能读清；不把一张竖立绘拉伸成CG。

统一采用 **A09-ONE-PARAGRAPH-v1**：每镜只在下表锚点所在的一个正文段落呈现；分成多页的段落保持同一镜。入段前保存背景、在场人物、形态、衣装和持物快照，隐藏重复立绘；离开该段最后一页立即清CG，恢复快照或执行下一拍明确变更。不得默认一直保持到下一张CG。

每镜准确的`enterBeforeId`、`visiblePageIds`、`exitBeforeId`及恢复上下文均已登记在JSON；没有写入正文/NovelML。读档需验证本版本来源及该拍可达条件，恢复CG与进入前快照；回退跨出该段即清图，不追加关系/事件/结局。公共事件另保留返回点，后日谈保留原结局。以上是交接规范，E/Q仍须验证进入、退出、选择、跳读、回退、读档及缺图回退，不能视为已运行通过。

## 52项逐镜复核

每项的“锚点”是**本次正文**，引句即入镜拍；本段结束即退。完整原段、页相位、前置版本、条件及未就绪原因在JSON中可逐项追溯。

'''
for pkg in ['COMMON','XM','ZZ','MY','PI','HQ','FR']:
    group=[r for r in records[:52] if r['production']['package']=='SUI-A10-'+pkg]
    md+=f"### SUI-A10-{pkg}（{len(group)}项）\n\n"
    for r in group:
        md+=f"#### {r['id']}｜{r['title']} · 待核\n\n"
        md+=f"- 锚点：{link_source(r['source'])}；{r['time']}。原句：『{r['source']['matchText']}』\n"
        md+=f"- 条件：{condition_text(r)}。\n"
        md+=f"- 人物/画面：{r['cast']['present']}；{r['composition']} 画外/远程：{r['cast']['offscreenOrRemote']}。\n"
        md+=f"- 衣装/道具：{r['wardrobeAndForm']}；{r['propState']}。\n"
        md+=f"- 前置：{prereq_text(r)}。\n"
        md+=f"- 专项限制：{r['reviewNotes']}\n\n"
md+='## 候选详细约束\n\n'
for r in records[52:]:
    md+=f"### {r['id']}\n\n**{r['title']}｜待用户确认｜{r['production']['package']}**\n\n"
    md+=f"{r['rationale']}\n\n"
    md+=f"- 锚点：{link_source(r['source'])}，{r['time']}；『{r['source']['matchText']}』。\n"
    md+=f"- 条件：{condition_text(r)}。\n"
    md+=f"- 人物：{r['cast']['present']}；画外/远程：{r['cast']['offscreenOrRemote']}。\n"
    md+=f"- 衣装/道具：{r['wardrobeAndForm']}；{r['propState']}。\n"
    md+=f"- 构图：{r['composition']}\n"
    md+=f"- 前置：{prereq_text(r)}。\n"
    md+=f"- 退出/恢复：依统一单段约定。{r['reviewNotes']}\n\n"
md+='''## 接续待办

- [x] 52项当前锚点、分支、形态、衣装/道具、出入场、版本前置及唯一制作归属登记。
- [x] 提出8项有正文依据的候选，不修改原选择，不复活取消编号。
- [x] 当前正文重新解析，逐镜可达性/条件核验；详细实际结果见本批verification.json。
- [ ] 用户决定候选及最终数量；集成者更新全局选择与图鉴编号，本任务保持原文件只读。
- [ ] A02～A07补逐镜缺项；A08交付经过复核的场景/共用物件，特别补MY第44天河边参考。未定具体衣装、乔哥局部及展开婚讯照片等，仅在确需绘出时再确认，不擅自补设。
- [ ] A09按镜头更新放行状态后，A10的7包分别制作；A11检查与I正式采用另行记录。
- [ ] E/Q完成实际CG绑定、退出/回退/读档、网页/手机真机/桌面验收。图片制作、运行与发布均非本批已完成项。

COMMON与六线可按逐镜就绪程度并行；每镜严格按“候选获选（仅候选）→所需参考完成→A09放行→A10制作→A11/I→E/Q”执行，无需等无关路线。派发模型建议沿项目约定GPT-6 Astra / 高，本轮未启动其他代理或图像生成。
'''
(ROOT/'docs/美术/SUI-A09.md').write_text(md)
summary={pkg:{'retained':[r['id'] for r in records[:52] if r['production']['package']==pkg],
              'candidatesUnconfirmed':[r['id'] for r in records[52:] if r['production']['package']==pkg],
              'releasedForProduction':[]} for pkg in sorted({r['production']['package'] for r in records})}
(OUT/'package-index.json').write_text(json.dumps({'scope':'归属和待办，非生产放行单','packages':summary},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'retained':52,'candidates':8,'versionedReferences':len(used),'productionReleased':0,'packages':{k:len(v['retained']) for k,v in summary.items()}},ensure_ascii=False))
