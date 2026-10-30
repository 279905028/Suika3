# -*- coding: utf-8 -*-
"""记录基础方案与正文适用条件；不批准选型、不接入运行。"""
from pathlib import Path
import json, hashlib, copy
ROOT=Path(__file__).resolve().parents[2]
QA=Path(__file__).resolve().parent
SRC=ROOT/'assets/sources/20261028/SUI-A06'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def anchor(quote,path='scenario/黄球球-门后.md'):
    p=ROOT/path; lines=p.read_text().splitlines()
    matches=[i for i,l in enumerate(lines) if quote in l]
    assert len(matches)==1,(quote,matches)
    return {'path':path,'line':matches[0]+1,'quote':quote,'sha256':sha(p)}

items=[
    ('orb-base','orb','相识后至第55天17:00以前；门未开时不能强行展示','塑料凳上还是那个黄色圆球，深眉毛，大眼睛，红嘴抿得很平。'),
    ('orb-amused','orb','剥橘子或第40天调收音机后的短暂笑意；不表示关系保证','她扭头笑了，手里的那半个还没动。'),
    ('orb-serious','orb','第34天说清边界；仍保留圆眼短红嘴','扫我的，就容易一点？'),
    ('orb-downcast','orb','相识初期受冷落后的失落；不增加眼泪或伤病','她没替我接一句没关系。'),
    ('orb-wave','orb','第47天共同段告别抬手；不新增人体躯干或脚','她把自己的手也抬起来。'),
    ('human-toy-base','human','第55天17:00自主呈现；HQ07两项均可用；后续持物按正文','棕色齐刘海中长发，浅米灰的拉链外套，白色印花上衣。'),
    ('human-neutral','human','第55天后普通交谈，无持续持有依据时用空手；本锚点的持纸当拍须用A08核定道具','还是人形，外套拉链只拉到一半，另一只手拿着我的纸。'),
    ('human-serious','human','第75天拒绝默认同居等边界谈话；两个关系分支均保持人形','我能听你讲。可你不能把房子没了，接成以后就住我这里。'),
    ('human-downcast','human','第60天门外受限后的低落；不画昏迷、消失、伤病或退回球形','她看着门口，眼睛红了，却不肯转头让我先安慰。'),
    ('human-tearful','human','HQ08=A且HQ07=B明确落泪；或HQ08=B且HQ07=A告别段。落泪不恢复关系','她听着，眼泪落下来，自己抹掉，不让我靠过去。'),
    ('human-chin','human','保留已确认托腮习惯；普通交谈动作候选，不强指定未描写托腮的拍点','变身后保留她的名字、成年女性身份、声音、干巴巴的吐槽与托腮习惯'),
]
usage=[]
for key,form,scope,quote in items:
    usage.append({'key':key,'form':form,'scope':scope,
                  'anchor':anchor(quote,'docs/人物/黄球球.md' if key=='human-chin' else 'scenario/黄球球-门后.md'),
                  'production':'A/B已制，待选型' if key in ['orb-base','human-toy-base'] else '待基础选型后制作'})
save(QA/'story-usage.json',{
    'date':'2026-10-28','task':'SUI-A06','scope':'制作及后续演出约束，尚未绑定运行','items':usage,
    'formRules':{
        'orbReveal':anchor('蓝色凳子上坐着一个黄色圆球','scenario/第二章-十四天.md'),
        'humanStart':anchor('第55天下午四点五十七，我已经到了后院。等到五点，才敲那三下。'),
        'noReversion':anchor('人形没有变，她仍站在我眼前'),
        'ending1':anchor('还是第55天以后那副我已经熟悉的模样'),
        'ending2':anchor('最后见面时她仍是人形，亲手把杯子包好，交回我手里。'),
        'gate':'C01-02=A且C02-01=A；相识正式开门后显示球形；人形时点不由恋爱选择控制',
        'ending':'HQ07-01与HQ08-01均A为HQ-E1；其余为HQ-E2；均human',
        'priorIntimacy':'第55、57天在HQ08之前的共同段；不能因最终AB/BA/BB抹除已发生的亲密',
        'phone':'无自己的手机和通信设定；第24天短暂看的是文文手机，不登记为她的道具',
        'restore':'球形正方形contain，人形腰部截幅；选择界面先隐藏或弱化人物，恢复按正文状态决定形态、表情和道具'},
    'otherOwners':[
        {'id':'prop-hq-tableware','owner':'SUI-A08','scope':'写名双杯、铅笔、纸条和信封；未取得A08版本前不另造持物图'},
        {'id':'prop-hq-room-fixed','owner':'SUI-A08','scope':'收音机、墙钟、沙发、矮桌和普通黄色小球；小球道具与她本人分开'},
        {'id':'prop-shared-food-boxes','owner':'SUI-A08','scope':'食品及餐具按共用道具核定'}],
    'excluded':['未放行CG','新下装或全身','公开街道或婚宴现身','眼伤或疾病推断','玩偶棒魔法功能','变身作为恋爱奖励']})

checks=json.loads((QA/'option-checks.json').read_text())
template=json.loads((ROOT/'qa/SUI-A01-20261028/resource-record.template.json').read_text())
refs=json.loads((SRC/'source-references.json').read_text()); records=[]
for x in checks['files']:
    for role in ['source','derivative']:
        m=x[role]; r=copy.deepcopy(template); form=x['form']; ix=0 if form=='orb' else 5
        r.update({'assetId':'sui-a06-'+x['key']+'-v001-'+m['format'].lower(),'kind':'character','ownerTask':'SUI-A06',
                  'characterOrSceneKey':'huangqiuqiu','form':form,'variant':'base-neutral','version':'v001','status':'待用户选型',
                  'requirementKeys':['char-huangqiuqiu-'+form]+(['prop-huangqiuqiu-human-accessories'] if form=='human' else []),
                  'storyAnchors':[usage[ix]['anchor']],
                  'sources':[z for z in refs if ('human' in z['copy'])==(form=='human')],
                  'promptOrProcessRecord':str((SRC/'prompts'/('options-'+form+'.json')).relative_to(ROOT)),
                  'sourceFile':x['source']['path'],'derivativeFile':m['path'],
                  'sha256Source':x['source']['sha256'],'sha256Derivative':m['sha256'],
                  'format':m['format'],'width':m['size'][0],'height':m['size'][1],'bytes':m['bytes'],
                  'orientation':m['orientation'],'colorSpace':m['colorHandling'],'sourceMetadata':x['source'],
                  'encoding':x['encoding'] if role=='derivative' else {'tool':'built-in image_gen','process':'PNG生成原件，未改写'},
                  'placement':x['placement']})
        r['alpha'].update({'present':True,'range':m['alphaRange'],'bbox':m['alphaBBox']})
        r['approval']={'appearanceEvidence':['docs/人物/黄球球.md','本批已查看照片与球形原图'],'imageEvidence':[],
                       'currentProjectAdopted':False,'adoptionEvidence':None}
        r['binding'].update({'routeIds':['huangqiuqiu'],'condition':usage[ix]['scope'],
                             'exitAndRestore':'由E/I按story-usage.json接入；本包未绑定'})
        r['checks']={'metadata':'通过','decodedPixels':'PNG与WebP全部RGBA一致',
                     'compositeWhiteBlackDayNight':'已离线回看，见visual-review.md','engine':'未测','browser':'未测',
                     'physicalPhone':'未测','desktop':'未测','deployment':'未执行'}
        r['pending']=['分别选定球形/人形','选型后扩差分','A11复核、I导入、E绑定、Q运行验收']
        records.append(r)
save(SRC/'resource-records.json',{'schemaVersion':'SUI-A06-review-1','records':records,'adoptedCount':0})
if not (QA/'approval.json').exists():
    save(QA/'approval.json',{'date':'2026-10-28','status':'awaiting_user','orb':None,'human':None,
         'selectionMeans':'基础选型后开展差分，不等于运行采用',
         'requestEvidence':'当前聊天已展示球形与人形两组A/B；等待用户分别选择'})
print('正文适用11项；基础方案PNG/WebP记录8项；采用0项。')
