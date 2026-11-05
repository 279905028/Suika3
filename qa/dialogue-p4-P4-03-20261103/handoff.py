"""从已核对的收件、处置与素材记录汇总交接；不写上游包。"""
import hashlib, html, json, os
from pathlib import Path
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/修订协作/P4-演出与美术/P4-03'
QA=ROOT/'qa/dialogue-p4-P4-03-20261103'
def read(p): return json.loads(p.read_text())
def fp(p): return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write(p,data):
 assert not p.exists(),f'不覆盖交付：{p}'
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
intake=read(QA/'intake-final.json')
groups={g['resourceKey']:g for g in intake['groups']}
nodeDoc=ROOT/'docs/修订协作/P4-演出与美术/P4-01/node-map.json'
nodes={n['nodeId']:n for n in read(nodeDoc)['nodes']}
records=read(DOC/'resource-records.json')
assets={r['assetId']:r for r in records['assets']}
old={a['assetId']:a for a in read(QA/'inventory.json')['assets']}
needLookup={n['needId']:n for p in intake['packages'] for n in p['needs']}
decisions=[]
for spec in read(DOC/'decisions.spec.json'):
 key=spec.pop('key');g=groups[key]
 row=dict(spec,resourceKey=key,needIds=g['needIds'],packageIds=g['packageIds'],requestNodeIds=g['nodeIds'],requestConstraints=g['constraints'])
 row['sourceNeeds']=[{'needId':nid,'statusAtReceipt':needLookup[nid]['status'],'actionAtReceipt':needLookup[nid]['action']} for nid in g['needIds']]
 row['producerStatus']='escalated-to-coordinator' if spec['decision']=='escalated' else 'disposition-delivered'
 row['finalAdoptionStatus']='pending-P4-05-P4-02-P4-07'
 row['nodeScopes']=[{'nodeId':nid,'paragraphId':nodes[nid]['paragraphId'],'packageId':nodes[nid]['packageId'],'condition':nodes[nid]['condition']} for nid in g['nodeIds']]
 off=set(spec.get('offscreenNodeIds',[]))
 row['assetNodeScopes']=spec.get('assetNodeScopes',{a:[n for n in g['nodeIds'] if n not in off] for a in spec['assetIds']})
 row['scopeMeaning']='仅限定候选使用上界，不是自动绑定；具体进退场、分页、媒介、动作和恢复由所属P4-02包闭合。'
 row['evidence']=[fp(QA/'intake-final.json'),fp(nodeDoc)]
 for a in spec['assetIds']:
  if a in assets: row['evidence'].append(assets[a]['productionEvidence'])
  else:
   assert a in old
   row['evidence'].extend([{k:old[a]['runtime'][k] for k in ['path','sha256']},{k:old[a]['approvalEvidence'][k] for k in ['path','sha256']}])
 if spec.get('scopeExtension'):
  row['originalApprovedScopes']={a:old[a]['approvedScope'] for a in spec['assetIds']}
  row['scopeExtensionStatus']='P4-03依据冻结正文提出扩展候选；原批准不改写，P4-05复验与P4-07采用仍待。'
 if spec['decision']=='escalated': row['evidence'].append(fp(ROOT/'docs/修订协作/P4-演出与美术/P4-02/approved-text-amendment.json'))
 # 同键共享资源仍只交一个定义，保留两侧准确节点与条件。
 unique={e['path']:e for e in row['evidence']};row['evidence']=list(unique.values())
 decisions.append(row)
write(DOC/'decisions.json',{'schemaVersion':'p4-03-decisions-v1','taskId':'P4-03','date':'2026-11-03',
 'inputFingerprint':intake['inputFingerprint'],'interfaceFingerprint':intake['interfaceFingerprint'],
 'contentBuildId':intake['contentBuildId'],'intake':fp(QA/'intake-final.json'),
 'counts':{'packages':7,'needs':23,'resourceKeys':20,'dispositionsDelivered':19,'upstreamTextDependency':1,
           'selectedImages':15,'newOrRepairedImages':14,'copiedReference':1,'reuseKeys':5,'offscreenKeys':1},
 'decisions':decisions})

notes={
 'bg-bridge-shaobing-dusk':'炉台、店面和河岸保持；暮色天空、暖灯可见，无人物。',
 'bg-guiyang-bus-stop-day':'普通城市站棚局部、道路与树；无站名与人脸。只交断开支两个候车节点，AA不使用。',
 'bg-guiyang-bus-stop-evening':'与日版同一站棚构图，窗灯与蓝夜时段明确；用于AA电话候车。',
 'bg-huisheng-306-operating-day':'窗外改白昼，沙发、电视、桌上麦克风与杯子、停钟保留；精确读钟不是本远景检查结论。',
 'bg-huisheng-corridor-operating-night':'夜间窗景与室内灯，前台、纸箱、楼梯保持；无锁闭停业暗示。',
 'bg-my-restaurant-eaves-rain':'无人、无伞、无烧饼陈列；保留木檐、雨势与暖灯，无店名。',
 'bg-noodle-shop-evening':'同店暖灯营业，门外和后窗去白昼；无人。',
 'bg-old-netcafe-backroom-neutral-day':'电脑、后间桌面与饭具保留，门外漫射日光；无具体饭点。',
 'bg-old-netcafe-yard-door-closed-night':'夜间闭门，无门内人影；不能用于单段跨傍晚/清晨的HQ277。',
 'bg-old-netcafe-yard-door-open-morning':'晨间开门、门框可见，背景无人；不增加黄球球公开出场。',
 'bg-performance-mall-side-stage-evening':'同商场台侧设备、暖灯和蓝夜天空，无演员人群。',
 'bg-xiaoman-packing-interior':'v002仅墙、地与桌局部；首稿固定竖箱已移除，不补房型。',
 'bg-my-riverside-afternoon':'原无人河岸、树与石栏复制一致，下午日照；与CG044地点参考一致。',
 'char-xiaoman-work-apron-empty-hands':'白T/灰围裙与既定脸型，空手，无固定剪刀梳子；白黑昼夜缩放合成未见明显矩形底或大块晕边。',
 'piao-seated-base':'既定白衬衫/黑裤/低马尾，坐姿空手，无孕期新增设定；四底未见明显底色；底部为截幅，不当全身图。'
}
previewIndex=read(QA/'delivery-preview-index.json')
previews={r['assetId']:r for r in previewIndex['previews']}
observations=[]
for a,r in assets.items():
 observations.append({'assetId':a,'source':{k:r['source'][k] for k in ['path','sha256']},
  'producerObservation':notes[a],'viewed':'工具返回原图/本地原图及联系表；角色加四底缩放合成与离线UI示意',
  'result':'selected-source-candidate','preview':fp(ROOT/previews[a]['preview']),
  'independentReview':'P4-05待独立复验；不是引擎、浏览器或真机截图通过'})
write(QA/'visual-observations.json',{'taskId':'P4-03','date':'2026-11-03','scope':'制作方目视初查',
 'observations':observations,'reusedCurrentResources':['bg-old-netcafe-yard-door-closed-morning','bg-noodle-shop-day','bg-wenwen-bijie-rental-day','char-zhouzhi-human-work-neutral','char-zhouzhi-human-work-serious'],
 'rejectedDrafts':[{'path':'assets/sources/20261103/P4-03/xiaoman-day40-packing-interior/bg-xiaoman-packing-interior-v001.png','reason':'固定竖放箱子与开箱/坐箱动作有冲突，选v002；首稿保留。'}],
 'limits':['四底预览是制作方缩放检查；P4-05仍须原尺寸透明边缘和全部拟采用资源独立检查。','UI只是1280×720遮挡示意；不代表实际引擎层顺序、手机或存读档通过。','普通背景图不承担精确文字/时钟读数。']})

def href(p): return quote(os.path.relpath(p,QA),safe='/')
cards=[]
for a,r in assets.items():
 decision=next(d for d in decisions if a in d['assetIds'])
 links=[f'<a href="{href(ROOT/r["source"]["path"])}">PNG原图</a>',f'<a href="{href(ROOT/r["archiveWebP"]["path"])}">无损WebP</a>']
 if 'alphaPreview' in previews[a]: links.append(f'<a href="{href(ROOT/previews[a]["alphaPreview"])}">四底检查</a>')
 guide=next((g for g in previewIndex['layoutGuides'] if g['assetId']==a),None)
 if guide: links.append(f'<a href="{href(ROOT/guide["preview"])}">文字框示意</a>')
 cards.append(f'<article><img src="{href(ROOT/previews[a]["preview"])}" alt="{html.escape(decision["title"])}"><div><h2>{html.escape(decision["title"])}</h2><code>{a}</code><p>{html.escape(notes[a])}</p><nav>{" · ".join(links)}</nav></div></article>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P4-03 素材交接预览</title><style>body{margin:0;background:#eef0ed;color:#233028;font:16px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1280px;margin:auto;padding:36px 24px}h1{font-size:32px;margin:0 0 12px}p{margin:12px 0}a{color:#275745}header{margin-bottom:28px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:white;border-radius:12px;overflow:hidden;border:1px solid #d5dcd4}article img{width:100%;height:360px;object-fit:contain;background:#dfe5e6}article div{padding:20px}h2{font-size:20px;margin:0 0 6px}code{font-size:12px;overflow-wrap:anywhere;color:#617265}nav{padding-top:8px}@media(max-width:760px){.grid{grid-template-columns:1fr}article img{height:260px}}</style><main><header><h1>P4-03 素材交接</h1><p>15张候选：14张新增或修订图＋1张河岸原件复用。所有PNG原件保留；附逐像素一致的无损WebP。</p><p>制作方检查已记录。P4-05独立复验、演出包闭合与P4-07采用仍待进行；这些预览不是运行截图。</p>'''
page+=f'<p><a href="{href(DOC/"交接.md")}">交接说明</a> · <a href="{href(DOC/"decisions.json")}">20项处置与节点范围</a> · <a href="{href(DOC/"上游交接.md")}">头盔顺序交接</a></p></header><section class="grid">'+''.join(cards)+'</section></main></html>'
assert not (QA/'preview.html').exists();(QA/'preview.html').write_text(page)

actionNames={'new':'补图','repair':'同场景修订','reuse':'复用现行图','reuse-source':'复用来源原件','offscreen':'画外','escalated':'交总协调'}
table='\n'.join('| '+d['title']+' | '+', '.join(d['needIds'])+' | '+actionNames[d['decision']]+' | '+d['reason']+' |' for d in decisions)
handoff=f'''# P4-03 制作与处置交接

2026-11-03｜**本包制作与处置交付完成，待P4-05独立复验和后续采用。** 七包共23条需求归并20个资源键：19键已交候选或处置，1键为用户要求总协调调整的头盔正文顺序，不记作已关闭。

共交15张候选（13背景、2立绘）：14张新增/修订、1张河岸原件复用；另有4个现行资源键直接复用、1个电梯独白画外处置。复用来源原件计入5个复用键。没有新增独立表情、道具或CG。

## 交付入口

- [素材预览与下载](../../../../qa/dialogue-p4-P4-03-20261103/preview.html)：完整PNG、无损WebP、2张立绘四底检查及UI示意。
- [20键处置与准确节点/条件](decisions.json)：保留23条原需求、适用范围、例外、原批准和扩展依据。范围是候选使用上界，不是自动绑定。
- [15项来源、尺寸、alpha、编码与指纹](resource-records.json)；[资源候选目录](resources.candidate.json)为原226项＋本批15项，全部仍pending。该目录中runtime暂指无损归档，P4-05需另交正式运行衍生。
- [制作记录](制作记录.md)含完整提示词入口；[本批检查与边界](../../../../qa/dialogue-p4-P4-03-20261103/交接.md)。

## 需求处置

| 内容 | 需求 | 处置 | 依据 |
| --- | --- | --- | --- |
{table}

## 接入时必须保留的限制

1. **头盔顺序**：按用户决定交总协调；已与[P4-02精确移段决定](../P4-02/approved-text-amendment.json)核对一致。须另建冻结版本，保留稳定ID和条件，不改旧P3/P4-01原件。详见[上游交接](上游交接.md)。
2. **站台分时段**：AA的793～796用晚间版，依据393“那个晚上没见成”；断开支398～399可用日版。交钥匙、上车及删消息等其余7节点画外；飘始终远程。需求键名称未改，以准确节点范围为准。
3. **跨时段与门禁**：HQ277单段跨傍晚/次晨，采用画外处置，不整段固定夜景。开门晨图仅背景，黄球球不公开出院、不补未确认下装。
4. **衣装与动作**：小满空手版不表演剪发/扫地；飘坐姿不补孕期身体变化，起身后退出。周栀工作裙第30天适用是本批扩展候选，原第46天批准保持；职业礼貌不等于关系承诺。
5. **地点与关系**：饭店雨檐不命名为烧饼店；河岸仅MY07=A既有前史，不能按未来MY09改写。电话人物不现场出现，孟遥电梯独白清空画面，不借用文文旧房走廊。

## 后续交接

- P4-04可按需要参考本批人物/场景候选，先读各自适用限制；CG制作和编号仍归04。
- P4-05独立复核既有拟采用图和本批15项，检查原尺寸透明边缘、读钟限制、文字框/凳子遮挡及衍生编码。源图大多为1672×941附近尺寸；等比适配1280×720，不拉伸。
- P4-02各包按本决定补引用/画外、关闭真实已解决need，再核边界与恢复。本窗口未修改其四份交付；当前上游仍有22条open及1条已resolved的P4-03需求。
- P4-07统一采用与输入重冻结；P5另做引擎、浏览器、真机、存读档和原生验证。本批未发布、未操作玩家存档。

本包不把制作方初查当P4-05通过，不把pending目录当最终handoff；其他窗口仍可继续各自任务。
'''
assert not (DOC/'交接.md').exists();(DOC/'交接.md').write_text(handoff)
print(json.dumps({'decisions':len(decisions),'needs':sum(len(d['needIds']) for d in decisions),'previewCards':len(cards)},ensure_ascii=False))
