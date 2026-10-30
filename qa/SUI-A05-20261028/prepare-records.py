#!/usr/bin/env python3
"""恢复已完成生成，建立本包精确来源与交接索引，不发起生成。"""
import hashlib
import json
import shutil
from pathlib import Path

QA = Path(__file__).resolve().parent
ROOT = QA.parent.parent
BASE = ROOT/'assets/sources/20261028/SUI-A05'
GEN = Path('/Users/yipin/.codex/generated_images/01a181f3-a5fb-7171-827e-a085cf163832')


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def rel(p):
    return str(Path(p).relative_to(ROOT))


def write(p, data):
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')


def copy_exact(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        assert sha(src)==sha(dst), f'拒绝覆盖已有不同文件：{dst}'
    else:
        shutil.copy2(src,dst)


def anchor(path, quote):
    p=ROOT/path
    lines=p.read_text().splitlines()
    matches=[i for i,line in enumerate(lines) if quote in line]
    assert len(matches)==1, (path,quote,matches)
    i=matches[0]
    heading=next((line for line in reversed(lines[:i+1]) if line.startswith('#')),None)
    node=next((line for line in reversed(lines[:i+1]) if line.startswith('<!-- NODE ')),None)
    return {'path':path,'line':i+1,'quote':quote,'heading':heading,'nearestNode':node,'sha256':sha(p)}


jobs=json.loads((QA/'generation-jobs.json').read_text())
ref='references/approved-b/char-piao-base.png'
new_jobs=[
 ('action-camera','exec-ed276814-db7d-4343-9977-3fcda19442d0.png','selected-b/char-piao-human-action-camera-v001.png',[ref,'props/prop-piao-camera-v001.png']),
 ('action-booklet','exec-692c1d75-164e-4b65-8a8c-a8f10ef8406d.png','selected-b/char-piao-human-action-booklet-v001.png',[ref,'props/prop-piao-booklet-blank-inside-cover-v001.png']),
 ('action-knot','exec-ad2b6958-74d8-4611-bbbf-62edca6bc4d2.png','selected-b/char-piao-human-action-knot-v001.png',[ref,'props/prop-piao-camera-bag-slipknot-v001.png']),
 ('camera-manual-v002','exec-56123efd-da33-466b-940a-00b10d92e64c.png','props/prop-piao-camera-manual-v002.png',['props/prop-piao-camera-manual-v001.png','props/prop-piao-camera-v001.png']),
]
for key,generated,target,refs in new_jobs:
    src,dst=GEN/generated,BASE/target
    copy_exact(src,dst)
    if not any(j['key']==key for j in jobs):
        jobs.append({'key':key,'tool':'image_gen.imagegen built-in','prompt':rel(BASE/'prompts'/f'{key}.txt'),
                     'references':[rel(BASE/r) for r in refs], 'generatedOriginal':str(src),
                     'savedOriginal':rel(dst),'sha256':sha(src),'byteIdentical':sha(src)==sha(dst)})
write(QA/'generation-jobs.json',jobs)

canon=anchor('docs/人物/飘.md','采用 Option B＋双侧浅酒窝：黑色低马尾')
camera=anchor('scenario/第一章-回到毕节.md','桌边放着一台借来的相机。')
booklet=anchor('scenario/飘-空白页.md','我赶紧看页码。她翻到封二，空的，没有那篇介绍，也没有替换的新文章。')
knot=anchor('scenario/跨路线-第36天的消息.md','低头摆弄相机包的带子。')
manual=anchor('scenario/飘-空白页.md','腾出手翻说明书。')
tools=anchor('scenario/飘-空白页.md','我对页码，她拿订书机。')
cloth=anchor('scenario/飘-空白页.md','又把束起样册的布条换了两种结法。')
specs=[]
face={'face':[330,165,330,310]}
inherited=[
 ('base','基础 · 已确认B','共通及两条路径的普通在场对话；无新持物。'),
 ('expression-smile','微笑','当场轻松对话；微笑不代表恋爱承诺，不能据此判定HIGH。'),
 ('expression-serious','认真','核稿、说明边界、讨论安排；不把认真等同拒绝。'),
 ('expression-hesitant','犹豫','当场尚未答复时；不替代PI-L06-01后飘的独立决定。'),
 ('expression-surprised','惊讶','明确受惊/意外反应时；不直接绑定LOW或怀孕状态。'),
 ('expression-displeased','不悦 · 备用','备用；可供A09核对被擅改稿件时的情绪，不默认生气贯穿全程。'),
 ('expression-downcast','低落','明确垂眼、失落的当场片段；不自动附加疾病或关系事实。'),
 ('action-wave','招手','普通打招呼；远程群消息不等于实际到场。'),
 ('action-thinking','思考','停顿与考虑；不用于手中必须同时持物的镜头。'),
 ('action-explaining','解释','普通摊掌说明；不得覆盖当场相机/册子持物状态。'),
]
for slug,label,usage in inherited:
    src=BASE/'references/approved-b'/f'char-piao-{slug}.png'
    dst=BASE/'selected-b'/f'char-piao-human-{slug}-v001.png'
    copy_exact(src,dst)
    critical=dict(face)
    if slug=='action-wave':critical['gesture']=[150,395,310,485]
    if slug=='action-thinking':critical['gesture']=[300,410,260,400]
    if slug=='action-explaining':critical['gesture']=[130,755,330,290]
    specs.append({'id':'piao-'+slug,'label':label,'kind':'character','group':'selected-b','file':rel(dst),
                  'prompt':rel(BASE/'references/approved-b/prompts.json'),'origin':'inherited-byte-identical',
                  'referenceCopy':rel(src),'requirements':['char-piao'],'anchors':[canon],
                  'approvalStatus':'已确认B外形的历史原件；本批复核，待A11/I采用',
                  'usage':usage,'criticalRects':critical})
specs.insert(0,{'id':'piao-option-a','label':'Option A · 呈现对照','kind':'character','group':'option-a',
               'file':rel(BASE/'option-a/char-piao-human-base-painterly-v001.png'),
               'prompt':rel(BASE/'prompts/option-a.txt'),'origin':'new-generation',
               'requirements':['char-piao'],'anchors':[canon],'approvalStatus':'未选对照；不撤销既有B',
               'usage':'同一已确认形象的较平滑绘制呈现；与B独立可看，不混入B差分。','criticalRects':face})
for key,label,requirement,anchors,usage,critical in [
 ('action-camera','持相机',['char-piao','prop-piao-camera'],[canon,camera],
  '借来的相机、征得同意后拍摄的准备动作。共通/HIGH/LOW按当场实际持物使用；不替代第30天LOW未举相机的镜头。',{'face':[330,165,330,310],'hands-camera':[270,595,375,310]}),
 ('action-booklet','持册子 · 空封二',['char-piao','prop-piao-booklet-kit'],[canon,booklet],
  'HIGH第34/39天核对恢复为空白的封二；不能用于已擅加作者介绍的错误稿、LOW未定稿册子或文文写过字的最后页。',{'face':[330,165,330,310],'hands-booklet':[195,570,545,400]}),
 ('action-knot','系相机包带',['char-piao','prop-piao-camera','prop-piao-knots'],[canon,knot],
  '相机包带的日常松结动作参考；公共第36天仅LOW使用且须按坐姿镜头复核。不是本线第36天湿绳的同一物件，也不替代衣角/布袋/纸袋绳结。',{'face':[330,165,330,310],'hands-knot':[310,705,410,265]})]:
    specs.append({'id':'piao-'+key,'label':label,'kind':'character','group':'selected-b',
                  'file':rel(BASE/'selected-b'/f'char-piao-human-{key}-v001.png'),
                  'prompt':rel(BASE/'prompts'/f'{key}.txt'),'origin':'new-generation',
                  'requirements':requirement,'anchors':anchors,
                  'approvalStatus':'按既定B制作的新动作；待A11/I采用复核','usage':usage,'criticalRects':critical})
for key,file,label,req,anchors,usage in [
 ('camera','prop-piao-camera-v001.png','借用相机',['prop-piao-camera'],[camera], '无品牌摄影学习道具；不写成已购器材或职业摄影师证明。'),
 ('camera-bag','prop-piao-camera-bag-slipknot-v001.png','相机包 · 松结',['prop-piao-camera','prop-piao-knots'],[knot], '相机包带版本；不作为装照片布袋或衣角绳结的替身。'),
 ('camera-manual-v002','prop-piao-camera-manual-v002.png','相机说明书 · 修订2',['prop-piao-camera'],[manual], '按本包相机形状修正的示意图；无虚构参数/日期/品牌，非可读教学说明。'),
 ('booklet','prop-piao-booklet-blank-inside-cover-v001.png','册子 · 空封二',['prop-piao-booklet-kit'],[booklet], '仅表现空封二和相邻空白扉页；不表示整册空白，不替代最后页。'),
 ('booklet-tools','prop-piao-booklet-tools-v001.png','装订工具与布条',['prop-piao-booklet-kit','prop-piao-knots'],[tools,cloth], '订书机、尺和普通布条的道具组合；整组使用，分层抽取或新增手持姿态须另制。')]:
    specs.append({'id':'piao-prop-'+key.replace('-v002',''),'label':label,'kind':'prop','group':'props',
                  'file':rel(BASE/'props'/file),'prompt':rel(BASE/'prompts'/f'{key}.txt'),'origin':'new-generation',
                  'requirements':req,'anchors':anchors,'approvalStatus':'本包制作设计；待A11/I采用复核','usage':usage})
write(QA/'asset-specs.json',specs)
write(QA/'approval.json',{'task':'SUI-A05','checkedDate':'2026-10-29',
                        'selection':'Option B + 双侧浅酒窝','authority':'本工程人物页记录的既有用户确认，非本轮新增批准',
                        'evidence':canon,'newSelectionRequested':False,
                        'newAssets':'在已确认B上补差分及道具；制作完成不等于最终采用获批',
                        'optionA':'独立呈现对照，保留原有B选型','adoptedInSuika3':False})
write(QA/'retained-revisions.json',[{'file':rel(BASE/'props/prop-piao-camera-manual-v001.png'),
                                   'reason':'说明书初稿画成凸起取景器机身，与本包平顶相机不一致',
                                   'replacement':rel(BASE/'props/prop-piao-camera-manual-v002.png'),
                                   'status':'原件保留，不列入最终交接候选'}])
resume=QA/'resume-before.json'
if not resume.exists():
    paths=[Path(x['path']) for x in json.loads((QA/'input-before.json').read_text())['files']]
    paths += [ROOT/f'system/sui-u/png/{name}.png' for name in ['reading-backdrop','message','name','menu-idle']]
    write(resume,{'date':'2026-10-29','note':'续作前快照；根TODO已由其他工作更新，本包尚未编辑。',
                  'files':[{'path':str(p),'sha256':sha(p),'bytes':p.stat().st_size} for p in paths]})
print(json.dumps({'savedGenerationJobs':len(jobs),'handoffAssets':len(specs),'selectedBCharacters':13,'props':5,'comparisonA':1},ensure_ascii=False))
