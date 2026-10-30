# -*- coding: utf-8 -*-
"""A08制作清单。只写本任务包；不生成图片、不执行扣费。"""
raise SystemExit('该历史即梦流程已按用户要求停用。当前请使用内置image_gen与production-plan.json续作。')
from pathlib import Path
import hashlib, json, shutil, uuid, random

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
SOURCE = ROOT / 'assets/sources/20261029/SUI-A08'
PROJECT = '61438dfb-b1b0-47c6-9892-fd4ba5d27986'
REQS = json.loads((ROOT/'qa/SUI-A01-20261028/requirements.json').read_text())['requirements']
WHITELIST = json.loads((ROOT/'qa/SUI-A01-20261028/source-inventory.json').read_text())['files']
REQUIREMENTS = {x['id']: x for x in REQS if x['owner'] == 'SUI-A08'}
HISTORY = {Path(x['path']).name.removeprefix('tc-bg-').removesuffix('.webp'): x for x in WHITELIST if '/current/backgrounds/' in x['path']}

# 同一行的每个旧图都先保留为待审候选，不继承历史采用。
AUDIT_ONLY = {
 'bg-bijie-slope-street': ['street-day','street-dusk','slope-day'],
 'bg-old-netcafe-counter': ['netcafe-counter-day','netcafe-counter-night','netcafe-pc-day','netcafe-pc-night'],
 'bg-old-netcafe-yard': ['courtyard-day','courtyard-night'],
 'bg-noodle-shop': ['breakfast-dawn','food-day','food-front-dusk'],
 'bg-friends-meal-shop': ['banquet-day'],
 'bg-bbq-xiaoman-friends': ['stall-night'],
 'bg-bus-stop-bijie': ['busstop-day','busstop-dusk'],
 'bg-zhouzhi-supermarket': ['supermarket-day'],
 'bg-guiyang-meal-shop': ['food-night'],
}
REUSE = {}

# 只依据当前稿给可见空间作必要的美术具体化；不为未定机构、店面补身份。
SCENES = {
 'bg-bijie-arrival-platform': ('无名交通站台的雨棚局部，湿地面与空的行李停放空间。画面不出现铁路、公路车辆、站名、车次、城市地标，保留交通类型未定。', ['day-rain']),
 'bg-bijie-slope-street': ('参照同键街巷母图，贵州小城的坡道街巷，低层旧楼与湿石路，行人位置留空。', ['night']),
 'bg-old-netcafe-counter': ('同键旧网吧柜台、机位、临街玻璃门的同一空间。柜台后有墙皮裂缝及被柜台遮住的儿童猫涂画；柜台、冰柜、收银与打印区位置固定。快十分钟的旧打卡钟与回声停钟完全不同。', ['fr-clearing-day','fr-handover-day']),
 'bg-old-netcafe-backroom': ('小网吧后间，旧收音机与可放饭盒的生活台面，通向后院的侧门。与黄球球房间是独立空间，不画通到黄球球房内的直通视线。', ['night']),
 'bg-old-netcafe-yard': ('同键后院原有院墙、门与蓝色塑料凳，补齐掉漆木门框、坏拖把、水桶、墙角小白花。视点在私密后院，不通向公共街道；无人无黄色角色。', ['door-ajar-night','door-open-afternoon','door-closed-morning']),
 'bg-huangqiuqiu-room': ('一间普通小房间，旧沙发、矮桌、蓝塑料凳、小窗、普通墙钟与旋钮收音机。桌上仅一颗没有眼鼻嘴的普通黄色小球，杯子单独交道具层，不画进固定底图。房间不是网吧后间。门窗家具位置固定，无神秘装置。', ['day','night','table-close-day']),
 'bg-wenwen-bijie-rental': ('小城便宜出租屋，一张床、一把旧凳，窗外近处完全是另一堵墙，没有山景远景。与贵阳旧房、所有女主住处不同。', ['day','night','downstairs-bench-day']),
 'bg-salon-bijie': ('朴素毕节理发店，镜子、贴着无可读金额价目表的镜边、裂纹理发椅、洗头池与卷毛巾。夹子盒留给A02绑定，不自行制作人物头盔。', ['mirror-day','washbasin-day','day91-mirror']),
 'bg-convenience-bijie': ('小城便利店，牛奶冷柜、收银台、出口布帘，明亮下午。不同于车站便利店，也不同于周栀去的大超市。', ['day']),
 'bg-bridge-shaobing': ('桥头的朴素烧饼小店内外接界，烤炉刚出一盘烧饼，檐下可避雨、旁边看见一小段桥栏；不画店名、校名或新增地标。', ['day','eaves-rain']),
 'bg-huisheng-306': ('回声普通旧KTV306包间，旧沙发、茶几、屏幕、地毯、局部镜子。墙上普通圆钟须固定11:47，分针指47刻度、时针接近12但仍在11与12之间、秒针静止。无床无艳俗装饰无人物。', ['operating-night','cleared-day']),
 'bg-huisheng-corridor': ('回声的旧KTV前台、窄走廊、楼梯与寄存柜，楼道可放尚未封口的纸箱。不要画任何人物、姓名、消费价格或其他娱乐场所。', ['operating-day','locked-day']),
 'bg-bbq-xiaoman-friends': ('同键烧烤摊附近停电动车的普通车棚背面，保留挡住公共视线的立柱与棚板。无人，无电动车无头盔，以免覆盖A02及道具版本。', ['bike-shed-night']),
 'bg-ajun-workplace-front': ('普通无名店铺入口的紧局部：门框、门槛及空地，画幅不暴露商品、店招或职业。阿俊现职店类型未定，不能画成水果店。', ['day']),
 'bg-bus-stop-bijie': ('普通公交车车厢后排视角，空座椅和侧窗，小城坡道路面从窗外虚化可见。无品牌、线路号或站名。', ['inside-day']),
 'bg-departure-station': ('无名出发车站的候车雨棚，检票入口与远处便利店门口的局部，空行李位置，交通方式保持画外，无轨道列车汽车、站名车次及现实标识。', ['morning-rain']),
 'bg-wenwen-guiyang-home': ('文文贵阳旧房，室内薄灰、两边长短不一的窗帘、家具移走后地板浅色印、柜里两只未拆完的搬家袋。不要画其他住处的书箱，不画拍卖敲槌或家庭照片。', ['day','corridor-day']),
 'bg-guiyang-housing-office': ('匿名办事窗口局部，普通桌面、玻璃隔挡、等候椅与空白材料位置；不出现法院银行拍卖或政府标志，无具体机构名，无印章判决文本。', ['day']),
 'bg-chengdu-salon-study': ('仅作远程照片内景的普通理发练习角：练习假头后脑一处剪短缺口、桌椅与空白练习纸。剪刀与个人练习本由A02引用同版，不自行画人物或补宿舍身份。', ['screen-reference-day']),
 'bg-zhouzhi-bijie-home': ('周栀毕节朴素住处，小桌、凉水壶、普通睡卧空间，生活化，非营业包间。', ['door-day','night','morning']),
 'bg-zhouzhi-other-venue': ('另一处普通工作场子的门面局部，发光但不可读的招牌与前台入口；无店名无人物无床，无回声招牌或性交易意象。', ['evening']),
 'bg-aying-prep-space': ('中性备菜空间，台面、土豆、待拆塑料袋、碗、菜刀。只表现备菜局部，不出现可判断是阿英住宅或营业餐厅的全景与招牌。', ['afternoon']),
 'bg-zhouzhi-guiyang-stall': ('贵阳朴素夜宵试摊，窄灶、一只锅、少量待拆塑料凳、土豆与餐具。小规模准备和收摊，不画盈利盛况、大餐厅、婚礼或商业招牌。', ['setup-day','service-night','closing-night']),
 'bg-zhouzhi-guiyang-home': ('周栀贵阳普通住处，室内小桌与普通床、门边洗手处，仅用于已满足留宿条件的独立地点。结构与毕节住处和孟遥贵阳独租房都不同。', ['night','morning']),
 'bg-mengyao-bijie-school': ('小城英语培训机构三楼，普通小教室、最后一排桌椅、讲台与空白黑板；不画大学校徽、学费、人物名字或学生。', ['classroom-day','corridor-day','entrance-day']),
 'bg-mengyao-drink-shop': ('培训机构附近普通饮品店，桌子两侧座椅和两人之间一把空椅，空椅留作人物包放手袋，低调下午光线；不放浪漫约会装饰。', ['afternoon']),
 'bg-mengyao-used-books': ('普通旧书店门口局部，几只纸箱与放书的台面，画外是书店而非私人住宅，书脊无可读标题；不新增店名。', ['day']),
 'bg-mengyao-guiyang-home': ('孟遥学校附近独租小房间，一张新桌、一把凳，床边留下放书箱的位置。个人书箱由A04引用，不补第二把椅子、婚照或离婚分居象征。', ['day','night']),
 'bg-mengyao-guiyang-school': ('贵阳英语培训机构的普通前台、走廊与教室门，前台留还书位置，没有人名、大学标志或学生；与毕节机构结构不同。', ['day']),
 'bg-oldstreet-shops': ('贵州老街，同一条街的杂货店外、关门照相馆门外、修鞋摊三个不同店面。各店分开，关门照相馆不展示内部。', ['grocery-day','photo-studio-closed-day','shoe-repair-day','grocery-changed-day67']),
 'bg-lianggao-shop': ('朴素凉糕小店，门帘、桌凳、不可读价目表、一小碗凉糕；不是桥头烧饼店、面馆或回声。', ['day']),
 'bg-piao-bijie-room': ('飘的毕节普通住处，桌面为装订纸稿留空，不画孟遥练习册与小满练习本；摄影包与册子后续引用A05同版。', ['day','night']),
 'bg-performance-mall': ('普通商场临时小舞台一侧与观众席空座，线缆、音箱与灯架；无观众或演员，无品牌与文文替身，现实规模。', ['side-stage-day']),
 'bg-performance-rehearsal': ('普通排练空间音箱门口，水泥台阶雨湿，收好的线缆和灯架，无人物无标志，不能套用KTV包间或商场内饰。', ['rain-day']),
 'bg-new-netcafe': ('新网吧的柜台、机位与门头局部，结构不同于旧网吧：更规整柜台、不同的入口方向，打印收银区。无猫墙画、奶茶标志或老板人物，无文字商标。', ['counter-day','counter-night','entrance-night']),
 'bg-old-netcafe-milk-tea': ('参照旧网吧临街门母图，保持墙柱玻璃门尺度位置，改为普通奶茶店门面，玻璃后墙面平整，旧猫画完全被覆盖。无人，无明确店名，不画成原网吧营业。', ['fr-day91']),
 'bg-photo-print-shop': ('正常营业的普通照片冲印店柜台、打印设备与纸袋，无姓名、照片人像或日期；它是独立商铺，不表现飘走访的关门照相馆复业。', ['day']),
}

# A01中55张旧背景的referenceCopyEligible均为false，本轮仅审计，重新制作本作场景。
SCENES['bg-bijie-slope-street'] = ('贵州小城坡道街巷，低层旧楼和石路，雨棚与店门错落，没有可读店名，没有现实地标。行人位置留空。', ['day-overcast','dusk','night'])
SCENES['bg-old-netcafe-counter'] = (SCENES['bg-old-netcafe-counter'][0], ['day','night','fr-clearing-day','fr-handover-day'])
SCENES['bg-old-netcafe-yard'] = (SCENES['bg-old-netcafe-yard'][0].replace('原有','固定的'), ['door-ajar-night','door-open-afternoon','door-closed-morning'])
SCENES['bg-noodle-shop'] = ('普通小城面馆，店里朴素桌凳、煮面台，门口一张凳与两级台阶，通用无名店组件，不用店名暗示早餐店与第36天面馆必为同址。', ['day','front-dawn'])
SCENES['bg-friends-meal-shop'] = ('朋友聚餐用的普通小店桌边，几张朴素凳、杯碗与汽水，桌上空处可放A05册子与相机。不是婚宴，不画婚礼装饰，不把第7天、第14天和后日谈写成同一地址。', ['day','evening'])
SCENES['bg-bbq-xiaoman-friends'] = ('小城路边烧烤摊，普通塑料凳、烧烤炉、汽水和桌面，没有账单文字，没有人物。附近车棚另一角度共享普通材质而不在画面摆人物电动车。', ['stall-night','bike-shed-night'])
SCENES['bg-bus-stop-bijie'] = ('普通小城公交站雨棚、无可读线路的站牌、台阶；车内角度只画普通公交车后排空座椅与侧窗，不暴露车辆品牌或线路号。', ['stop-day','inside-day'])
SCENES['bg-zhouzhi-supermarket'] = ('普通超市杯子货架与门口局部，架上有蓝沿白杯等日用品，门外路边炸洋芋台面的一角，无人物无品牌，不是共通便利店。', ['day'])
SCENES['bg-guiyang-meal-shop'] = ('贵阳普通小店桌边，简单能吃完的一餐，门口边缘一小份烤土豆，朴素安静无品牌店名，不是夜宵试摊或桥头店。', ['evening'])

# 固定设施由背景承载；可跨人持拿、易发生连续性错误的物件给独立参考图。
PROPS = {
 'prop-netcafe-records': ('普通网吧交班本、班表、结薪页与设备清单四类纸本，俯拍平铺，文字区空白无姓名无金额无具体日期，区分纸本形状。', ['blank-reference']),
 'prop-netcafe-fast-clock': ('一只朴素旧塑料壳打卡钟正面与背面，同一只钟，背面留贴纸区空白；它正常走动但快十分钟，不画固定11:47，也不声称修好。', ['reference']),
 'prop-netcafe-mealbox': ('一个可反复使用的朴素旧饭盒，盒与配套盒盖摆在一起，材质旧而干净，无品牌、食物与文字。', ['open-reference']),
 'prop-netcafe-cat-drawing': ('墙皮有裂缝的儿童猫涂画正面，完整猫耳，朴拙儿童线条，只有猫而无孩子、姓名、年月或家庭照片。后续冲印照必须引用同一图的相同内容，不另造第二幅猫。', ['wall-reference']),
 'prop-netcafe-console': ('一台旧无品牌家用游戏机、两个有线手柄及电源线，插头接口清楚，不展示品牌游戏画面，不增加维修工具。', ['reference']),
 'prop-shared-audio-cables': ('一条完好普通麦克风线，两端常见音频接头清楚，无损坏无品牌；不同于毛狼的大型演出器材。', ['microphone-cable-reference']),
 'prop-huisheng-stopped-clock': ('一只普通旧圆形挂钟，精确11:47：分针指47刻度、时针在11和12之间并靠近12，秒针固定不动。正面特写，无神秘光效，无新地点。', ['1147-reference']),
 'prop-xiaoman-ebike': ('一辆朴素二手电动车，前篮、双后视镜、可坐两人的车座，车身旧刮痕和普通无字贴纸，右转灯清楚，无品牌车牌、无头盔钥匙、无人。', ['reference']),
 'prop-hq-tableware': ('同一套两只朴素杯子，图中一只正放一只底朝前，旁边一支铅笔、一张空白纸条和信封。杯底仅准确写黄球球三个字，另一只杯子不写名，绝不画手机。', ['name-and-blank-reference']),
 'prop-transport-packing': ('普通无品牌车辆后备厢的紧局部，开着箱盖，几只书箱与袋子留有不压材料的空间，车顶一只普通水杯，无人、无车牌车标，不画同居标语。', ['car-trunk-day']),
}
EMBED = {
 'prop-netcafe-counter-equipment':['bg-old-netcafe-counter','bg-new-netcafe'],
 'prop-huisheng-sales':['bg-huisheng-306','bg-huisheng-corridor'],
 'prop-salon-fixed':['bg-salon-bijie','bg-chengdu-salon-study'],
 'prop-yard-fixed':['bg-old-netcafe-yard'],
 'prop-hq-room-fixed':['bg-huangqiuqiu-room'],
 'prop-shared-food-boxes':['bg-friends-meal-shop','bg-noodle-shop','bg-huangqiuqiu-room','bg-huisheng-corridor'],
 'prop-stall-kitchen':['bg-aying-prep-space','bg-zhouzhi-guiyang-stall'],
}

STYLE = '视觉小说背景，成人日系半写实手绘，贵州小城日常生活，雨夜青灰与克制暖光，材质细腻、空间可信，无人物、无剪影、无头像，无水印无可读招牌。16:9横图，单幅完整画面，不拼贴。1280×720显示时下方490至696像素是正文框：关键设施位于中上部，中央留人物站位；右上菜单区不要放关键物件。'

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 SOURCE.mkdir(parents=True,exist_ok=True)
 existing=json.loads((QA/'production-plan.json').read_text()) if (QA/'production-plan.json').exists() else {}
 old={x['assetId']:x for x in existing.get('generation',[])}
 reused=[]; jobs=[]; coverage=[]
 for key,req in REQUIREMENTS.items():
  directory=SOURCE/key
  for name in REUSE.get(key,[]):
   h=HISTORY[name]
   assert h['referenceCopyEligible'] and h['exists']
   src=Path(h['path']);assert digest(src)==h['sha256']
   dest=directory/'historical-candidates'/src.name
   dest.parent.mkdir(parents=True,exist_ok=True)
   if not dest.exists():shutil.copy2(src,dest)
   assert digest(dest)==digest(src)
   reused.append({'requirementId':key,'file':str(dest.relative_to(ROOT)),'source':str(src),'sourceSha256':digest(src),'status':'待审候选；不继承旧采用','permission':'referenceCopyEligible','adopted':False})
  spec=SCENES.get(key) or PROPS.get(key)
  ids=[]
  if spec:
   detail,states=spec
   first=None
   for state in states:
    asset=f'{key}-{state}-v001'; ids.append(asset)
    known=old.get(asset,{})
    node=known.get('nodeId','node_'+''.join(random.SystemRandom().choices('0123456789abcdefghjkmnpqrstvwxyz',k=10)))
    if first is None:first=node
    isvariant=state!=states[0] and key not in ['bg-oldstreet-shops','bg-wenwen-guiyang-home','bg-salon-bijie','bg-mengyao-bijie-school','bg-new-netcafe']
    base=STYLE if key.startswith('bg-') else '视觉小说共用道具设定参考图，成人日系半写实手绘，克制青灰色调，朴素材质，单幅横图，无人物无水印。中性浅灰底，物件完整并彼此分开，不伪装成透明底；不是运行立绘。'
    state_text={
     'fr-clearing-day':'仅朋友线第45天清点设备，保留未拆完的部分电脑。',
     'fr-handover-day':'仅朋友线第60天交接，旧柜台被移开，猫画先完整显露；新柜台靠墙遮半张猫脸的变化另交动态演出，不把两状态画在同图。',
     'cleared-day':'停业清空，茶几已搬走，地毯有一圈深色水印，角落纸箱和残留半面镜子；原停钟仍留墙上。',
     'locked-day':'第31天后锁门断电，玻璃门关闭，前台无人，不再营业。',
     'downstairs-bench-day':'仅画楼下漆磨掉的长凳、楼道门外与台阶，不画房内床。',
     'day91-mirror':'第91天椅子裂纹再贴透明胶、镜边价目表换成新纸，夹子盒换人；不自动添加未定稿的两顶头盔或车钥匙。',
     'door-day':'只画住处门外门槛，不露床及私密内部。',
     'grocery-changed-day67':'与杂货店母图保持店面结构一致，旧凳货物撤走、门后一张旧凳，无人物不自编新店名。',
     'screen-reference-day':'仅作为远程图片参考，不表示文文身处成都。',
    }.get(state,'')
    prompt=base+'\n具体内容：'+detail+'\n本图状态：'+state+'。'+state_text
    if isvariant:prompt+='\n严格保持参考图同一房间或物件的门窗、家具、墙体与镜头透视，仅改变本状态确需变化之处。'
    d=directory/'prompts';d.mkdir(parents=True,exist_ok=True)
    pf=d/(asset+'.txt');pf.write_text(prompt+'\n')
    jobs.append({'assetId':asset,'requirementId':key,'state':state,'nodeId':node,'updateId':known.get('updateId',str(uuid.uuid4())),'submitId':known.get('submitId',str(uuid.uuid4())),'projectId':PROJECT,'model':'seedream_4.6','mode':'i2i' if isvariant else 't2i','ratio':'16:9','resolution':'2K','count':1,'references':[first] if isvariant else [],'promptFile':str(pf.relative_to(ROOT)),'status':known.get('status','planned'),'quoteStatus':'未报价','outputDirectory':str(directory.relative_to(ROOT))})
  coverage.append({'requirementId':key,'name':req['name'],'constraints':req['constraints'],'sourceAnchors':req['sources'],'reusedCandidates':[x['file'] for x in reused if x['requirementId']==key],'plannedAssets':ids,'embeddedIn':EMBED.get(key,[]),'implementation':'独立道具参考' if key in PROPS else ('固定场景组件/文字演出，禁止自动新增独立近景' if key in EMBED else '场景资源'),'status':'制作准备完成；尚未制作验收','adopted':False})
 assert len(coverage)==58
 assert all(x['reusedCandidates'] or x['plannedAssets'] or x['embeddedIn'] for x in coverage)
 plan={'schemaVersion':1,'task':'SUI-A08','date':'2026-10-29','projectId':PROJECT,'webUrl':f'https://jimeng.jianying.com/ai-tool/ai-canvas/{PROJECT}','status':'待报价与生成','runtimeAdopted':False,'style':'成人日系半写实手绘，雨夜青灰/克制暖光，空场景','reusePolicy':'候选仅为按白名单单文件复制；逐项视觉复核后方可放行。原件不改写。','summary':{'requirements':len(coverage),'backgroundRequirements':41,'sharedPropRequirements':17,'historicalCandidateFiles':len(reused),'plannedGenerationOutputs':len(jobs),'backgroundOutputs':sum(x['requirementId'].startswith('bg-') for x in jobs),'propReferenceOutputs':sum(x['requirementId'].startswith('prop-') for x in jobs)},'historicalCandidates':reused,'generation':jobs,'coverage':coverage,'unresolved':[],'notTested':['生成结果视觉终审','同地点状态结构连续性','WebP衍生与编码对照','真实资源UI合成','A11复核','SUI-I采用与演出绑定','引擎运行/回退/存档','浏览器/手机真机/桌面','发布']}
 (QA/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
 (SOURCE/'production-plan.json').write_text(json.dumps({'schemaVersion':1,'task':'SUI-A08','qaPlan':'qa/SUI-A08-20261029/production-plan.json','runtimeAdopted':False,'generationOutputs':len(jobs),'historicalCandidates':len(reused)},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(plan['summary'],ensure_ascii=False))

if __name__=='__main__': main()
