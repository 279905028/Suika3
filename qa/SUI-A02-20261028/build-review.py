"""A02离线交接：只做编码、测量和诊断合成，不改生成原件像素。"""
from pathlib import Path
import copy
import hashlib
import json
import math
import sys

import numpy as np
import PIL
from PIL import Image, ImageCms, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
PKG = ROOT / 'assets/sources/20261028/SUI-A02'
FONT = '/System/Library/Fonts/STHeiti Light.ttc'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def rel(path):
    return str(path.relative_to(ROOT))


def anchor(path, needle, condition='ALL'):
    p = ROOT / path
    lines = p.read_text().splitlines()
    matches = [(i + 1, line) for i, line in enumerate(lines) if needle in line]
    if len(matches) != 1:
        raise ValueError((path, needle, matches))
    line, quote = matches[0]
    return {'path': path, 'line': line, 'quote': quote, 'sha256': sha(p),
            'condition': condition}


XM = 'scenario/罗小满-练习本.md'
C1 = 'scenario/第一章-回到毕节.md'
C2 = 'scenario/第二章-十四天.md'
SPECS = [
    ('base', '基础 · 微笑', 'base', 'option-a/char-xiaoman-human-base-option-a-v001.png',
     ['char-xiaoman'], [(XM, '我点头。她笑着走了。', 'ALL')],
     '默认砖红夹克/白内搭/深色牛仔裤；无额外道具。不同衣装、电话与视频镜头不自动套用。'),
    ('serious', '认真', 'expression', 'production/char-xiaoman-human-base-expression-serious-v001.png',
     ['char-xiaoman'], [(XM, '后面的二十分钟，她没再讲笑话。', 'ALL')],
     '夹克衣装的专注对话；第22天卷袖、含发夹及实际剪发动作仍以专门镜头为准。'),
    ('displeased', '不悦', 'expression', 'production/char-xiaoman-human-base-expression-displeased-v001.png',
     ['char-xiaoman'], [(XM, '“我还气着。”她没有松手', 'ALL'),
                        (C2, '她没有再问，低头把汤勺搁好', 'ALL')],
     '第14天被骗后、第15天仍生气的对话；不是喜剧怒脸，也不代表已原谅。'),
    ('embarrassed', '窘迫', 'expression', 'production/char-xiaoman-human-base-expression-embarrassed-v001.png',
     ['char-xiaoman'], [(XM, '她捡起夹子，耳朵红了一点。', 'ALL'),
                        (XM, '脸红得比亲吻时更厉害。', 'ALL')],
     '耳红/目光短暂移开；第22天仅作表情参考，不能替代含发夹及卷袖动作；裙装需保持衣装连续。'),
    ('hesitant', '犹豫', 'expression', 'production/char-xiaoman-human-base-expression-hesitant-v001.png',
     ['char-xiaoman'], [(XM, '她把本子合好，终于没再说回来就好了。', 'ALL')],
     '第60天共同段的迟疑；不能单凭此图判定继续或分开。'),
    ('downcast', '低落', 'expression', 'production/char-xiaoman-human-base-expression-downcast-v001.png',
     ['char-xiaoman'], [(XM, '她看着我，眼睛红了，却没靠过来。', 'XM07-01=B & XM08-01=A')],
     'BA分开段的表情依据；通用悲伤可经逐拍复核复用，不给BA追加拥抱、亲吻或复合。'),
    ('practice-notebook', '手持练习本', 'action', 'production/char-xiaoman-human-base-action-practice-notebook-v001.png',
     ['char-xiaoman', 'prop-xiaoman-practice-kit'],
     [(XM, '我笑了一下，她把本子合上，才跟着笑了半声。', 'ALL')],
     '闭合、无字的旧练习本；适合第15天预约交流收尾。不是打开错误页、报名材料或车站交还照片的动作。'),
    ('two-helmets', '双头盔 · 低落', 'action', 'production/char-xiaoman-human-base-action-two-helmets-v002.png',
     ['char-xiaoman', 'prop-xiaoman-helmets'],
     [(XM, '说完立刻转过身，抱着两顶头盔往另一边走。', 'ALL')],
     '第53天交车后抱两顶头盔；无钥匙。两顶灰色头盔是本包道具造型，不能据此补写原文颜色；寄店后不继续让她随身携带。'),
    ('work-apron', '工作围裙 · 剪刀/梳子', 'outfit-action', 'production/char-xiaoman-human-work-apron-tools-v001.png',
     ['char-xiaoman', 'prop-xiaoman-tools'],
     [(C1, '小满关掉水，在围裙上擦手', 'ALL'),
      (XM, '剪刀只动了几下。', 'ALL')],
     '白T/深灰围裙，闭合剪刀与梳子；用于理发店职业形象及道具连续性。擦手、举镜、剪发接触动作不由这张静态持物图代替。'),
    ('old-sweatshirt', '旧卫衣', 'outfit', 'production/char-xiaoman-human-old-sweatshirt-base-v001.png',
     ['char-xiaoman'], [(XM, '最后穿着店里的旧卫衣出了门。', 'XM07-01=A')],
     '用户选择深灰无图案圆领旧卫衣及原深色牛仔裤；仅按第40天A段衣装依据，不自动沿用到B段或整条后续路线。'),
    ('skirt', '第30天 · 裙装', 'outfit', 'production/char-xiaoman-human-skirt-base-v002.png',
     ['char-xiaoman'], [(XM, '她说裙子不好蹲', 'ALL')],
     '用户选择深灰黑色及膝A字裙，保留夹克/白内搭。上大腿截幅不显示裙摆与膝；及膝长度为后续全身/CG约束，本图不冒充全身长度验收。'),
]

LAYOUT = {'canvas': [1280, 720], 'scale': .37, 'imageTop': 50,
          'imageLeft': round(640 - 1024 * .37 / 2),
          'criticalFaceRect': [350, 128, 355, 330],
          'pivot': [540, 480], 'pivotMeaning': '共同颈口排版基准；不是脚底，不直接用作NovelML坐标',
          'scope': '本批静态合成候选排版，未冻结引擎槽位'}
PROP_RECTS = {'practice-notebook': [520, 610, 210, 280],
              'two-helmets': [185, 680, 795, 480],
              'work-apron': [350, 550, 500, 330]}


def font(size):
    return ImageFont.truetype(FONT, size)


def solid_composite(im, color):
    out = Image.new('RGBA', im.size, color)
    out.alpha_composite(im)
    return out.convert('RGB')


def image_metadata(path):
    im = Image.open(path)
    im.load()
    alpha = im.convert('RGBA').getchannel('A')
    arr = np.asarray(im.convert('RGBA'))
    bbox = alpha.getbbox()
    rect = [bbox[0], bbox[1], bbox[2]-bbox[0], bbox[3]-bbox[1]]
    a = arr[:, :, 3]
    return {'format': im.format, 'width': im.width, 'height': im.height,
            'mode': im.mode, 'bytes': path.stat().st_size,
            'orientation': im.getexif().get(274, 1),
            'colorSpace': 'sRGB ICC' if im.info.get('icc_profile') else '未标记RGB；本批按sRGB解释，不改源图',
            'alpha': {'present': 'A' in im.getbands(), 'range': list(alpha.getextrema()),
                      'bbox': rect, 'coordinateBasis': '源图/衍生图像素；[x,y,width,height]',
                      'transparentPixels': int((a == 0).sum()),
                      'partialPixels': int(((a > 0) & (a < 255)).sum()),
                      'opaquePixels': int((a == 255).sum()),
                      'cornerValues': [int(a[y, x]) for x, y in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]],
                      'edgePixelsAbove128': {'left': int((a[:, 0] > 128).sum()),
                                             'right': int((a[:, -1] > 128).sum()),
                                             'top': int((a[0, :] > 128).sum()),
                                             'bottom': int((a[-1, :] > 128).sum())}},
            'rgbaDecodedBytes': im.width * im.height * 4, 'sha256': sha(path)}


def ui_preview(im, key):
    ui = json.loads((ROOT/'system/sui-u/integration.json').read_text())
    out = Image.open(ROOT/'system/sui-u/png/reading-backdrop.png').convert('RGBA')
    sprite = im.resize((round(im.width*LAYOUT['scale']), round(im.height*LAYOUT['scale'])), Image.Resampling.LANCZOS)
    out.alpha_composite(sprite, (LAYOUT['imageLeft'], LAYOUT['imageTop']))
    for name, rect in [('message', ui['message']['rect']), ('name', ui['name']['rect']), ('menu-idle', ui['menuRect'])]:
        out.alpha_composite(Image.open(ROOT/f'system/sui-u/png/{name}.png').convert('RGBA'), (rect[0], rect[1]))
    d = ImageDraw.Draw(out)
    d.text((96,451),'罗小满',font=font(26),fill='#edf0e8')
    # 本批说明，不伪造正文台词或实际引擎截图。
    d.text((84,516),'角色资源静态适配预览',font=font(30),fill='#edf0e8')
    d.text((84,560),'正文框采用 SUI-U 原资源；此图不是游戏运行验收。',font=font(25),fill='#c5d8d3')
    out.convert('RGB').save(QA/'ui'/f'{key}.png')
    x,y,w,h = LAYOUT['criticalFaceRect']
    face = [LAYOUT['imageLeft']+x*.37,50+y*.37,w*.37,h*.37]
    prop = PROP_RECTS.get(key)
    prop_canvas = [LAYOUT['imageLeft']+prop[0]*.37,50+prop[1]*.37,prop[2]*.37,prop[3]*.37] if prop else None
    return {'placement': LAYOUT, 'faceRectOnCanvas': face,
            'faceAboveDialogue': face[1]+face[3] < ui['message']['rect'][1],
            'propRectOnCanvas': prop_canvas,
            'propAboveDialogue': prop_canvas[1]+prop_canvas[3] < 490 if prop else None,
            'sixChoiceCoversCharacter': True,
            'choiceHandling': '六选项时隐藏/淡出立绘或按E/U另排；本批静态正文合成不等于选择态运行通过'}


def contact_sheet(items, cols, thumb_size, path, title):
    tw, th = thumb_size
    cell_w, cell_h = tw+24, th+64
    rows = math.ceil(len(items)/cols)
    out = Image.new('RGB',(cols*cell_w+24, rows*cell_h+90),'#f2efe6')
    d = ImageDraw.Draw(out)
    d.text((24,18),title,font=font(30),fill='#20363c')
    for n,(label,im) in enumerate(items):
        x=24+(n%cols)*cell_w; y=76+(n//cols)*cell_h
        pic=im.copy(); pic.thumbnail((tw,th),Image.Resampling.LANCZOS)
        out.paste(pic,(x+(tw-pic.width)//2,y))
        d.text((x,y+th+10),label,font=font(21),fill='#20363c')
    out.save(path)


def main():
    for sub in ('composites','ui','heads'):
        (QA/sub).mkdir(exist_ok=True)
    template=json.loads((ROOT/'qa/SUI-A01-20261028/resource-record.template.json').read_text())
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    records=[]; asset_summary=[]; mappings=[]; comps=[]; faces=[]; ui_items=[]
    checks=[]
    generated=json.loads((QA/'generation-results.json').read_text())
    output_source={r['relativeFile']:r['generatedSource'] for r in generated}
    output_source['assets/sources/20261028/SUI-A02/option-a/char-xiaoman-human-base-option-a-v001.png']='/Users/yipin/.codex/generated_images/01a1818e-d822-7e72-a250-c92582af47ea/exec-164ceea3-ac43-4efd-88e9-508e8d2b942f.png'
    for key,label,kind,file,req_keys,anchors,restriction in SPECS:
        src=PKG/file
        source_md=image_metadata(src)
        im=Image.open(src).convert('RGBA')
        dst=src.with_suffix('.webp')
        # 纯格式派生，不抠图、不裁切、不改alpha、不重绘、不改可见/隐藏RGB。
        im.save(dst,format='WEBP',lossless=True,method=6,exact=True,icc_profile=icc)
        derivative_md=image_metadata(dst)
        same=np.array_equal(np.asarray(im),np.asarray(Image.open(dst).convert('RGBA')))
        anchors=[anchor(*a) for a in anchors]
        mapping={'assetId':'char-xiaoman-'+key, 'key':key,'label':label,'kind':kind,
                 'requirementKeys':req_keys,'storyAnchors':anchors,'useRestriction':restriction,
                 'clothing':'work-apron' if key=='work-apron' else ('old-sweatshirt' if key=='old-sweatshirt' else 'skirt' if key=='skirt' else 'base'),
                 'sourceFile':rel(src),'reviewWebP':rel(dst),'approvedBase':'char-xiaoman-base',
                 'currentProjectAdopted':False,'runtimeBinding':None}
        mappings.append(mapping)
        for bg,color in [('white','#ffffff'),('black','#000000'),('day','#d8dfdf'),('night','#142129')]:
            comp=solid_composite(im,color)
            comp.save(QA/'composites'/f'{key}-{bg}.png')
        faces.append((label,solid_composite(im,'#d8dfdf').crop((300,60,760,510))))
        comps.append((label,solid_composite(im,'#d8dfdf')))
        head=solid_composite(im,'#d8dfdf').crop((300,60,760,510));head.save(QA/'heads'/f'{key}.png')
        layout_check=ui_preview(im,key)
        ui_items.append((label,Image.open(QA/'ui'/f'{key}.png').convert('RGB')))
        checks.append({'assetId':mapping['assetId'],'pngTrueFormat':source_md['format']=='PNG',
                       'webpTrueFormat':derivative_md['format']=='WEBP',
                       'commonCanvas':im.size==(1024,1536), 'orientationNormal':source_md['orientation']==1,
                       'hasActualTransparency':source_md['alpha']['transparentPixels']>0,
                       'allDecodedRGBAEqual':same, 'layout':layout_check,
                       'sourceAlphaMax254AllowedByA01':source_md['alpha']['range'][1]==254})
        r=copy.deepcopy(template)
        r.update({'recordPurpose':'A02包内源稿与无损审阅副本；不是运行采用或全局采用清单',
                  'assetId':mapping['assetId'],'kind':kind,'ownerTask':'SUI-A02',
                  'characterOrSceneKey':'xiaoman','form':'human','variant':key,
                  'version':'v002' if key in ('skirt','two-helmets') else 'v001',
                  'status':'制作完成；待A11接收/逐图采用审定','requirementKeys':req_keys,
                  'storyAnchors':anchors,
                  'sources':[{'path':rel(PKG/'references/xiaoman-face-v2-reference.png'),
                              'sha256':sha(PKG/'references/xiaoman-face-v2-reference.png'),
                              'role':'既有外形基线；白名单单文件引用'},
                             {'path':output_source[rel(src)],'sha256':sha(src),'role':'内置image_gen原始输出；本工程有等字节副本'}],
                  'promptOrProcessRecord':'qa/SUI-A02-20261028/generation-requests.json' if key!='base' else 'qa/SUI-A02-20261028/prompts.md',
                  'sourceFile':rel(src),'derivativeFile':rel(dst),
                  'sha256Source':sha(src),'sha256Derivative':sha(dst),
                  'format':derivative_md['format'],'width':im.width,'height':im.height,
                  'bytes':dst.stat().st_size,'orientation':1,'colorSpace':derivative_md['colorSpace'],
                  'alpha':derivative_md['alpha'],'sourceMetadata':source_md,
                  'encoding':{'tool':'Pillow / libwebp','version':PIL.__version__+' / '+str(features.version('webp')),
                              'lossless':True,'quality':None,'method':6,'exact':True,
                              'profileProcess':'未标记源RGB按sRGB解释并嵌入标准ICC；无像素转换；PNG原件不变'},
                  'placement':{'coordinateBasis':'源图像素；左上原点；矩形[x,y,width,height]',
                               'pivot':LAYOUT['pivot'],'pivotMeaning':LAYOUT['pivotMeaning'],
                               'criticalRect':LAYOUT['criticalFaceRect'],'criticalPropRect':PROP_RECTS.get(key),
                               'cropRect':[0,0,1024,1536],'uiMaskReference':'system/sui-u/integration.json',
                               'scale':None,'staticPreview':layout_check},
                  'binding':{'routeIds':['XM'],'sceneNodeIds':[],
                             'condition':'逐项依据storyAnchors；不得从情绪图推导路线状态',
                             'enter':'待E/I根据正文稳定ID绑定；当前仅离线映射',
                             'exitAndRestore':'换场、电话/视频、CG进出、回退/读档需清除或恢复正确衣装/道具；由E/I/Q实现并验收'},
                  'approval':{'appearanceEvidence':['docs/人物/罗小满.md','本聊天：用户选定Option A；旧卫衣和裙型分别已选择'],
                              'imageEvidence':['本聊天：Option A基础图已确认'] if key=='base' else ['在已确认Option A基础上制作；本批视觉检查，未伪造用户逐图批准'],
                              'currentProjectAdopted':False,'adoptionEvidence':None},
                  'checks':{'metadata':'通过','decodedPixels':'PNG/WebP全部RGBA字节一致' if same else '失败',
                            'compositeWhiteBlackDayNight':'已生成诊断合成，逐图视觉结论见visual-review.json',
                            'engine':'未测','browser':'未测游戏；仅离线审阅页另记','physicalPhone':'未测','desktop':'未测游戏','deployment':'未执行'},
                  'pending':['A11正式格式接收与采用审定','SUI-I唯一导入','E/I演出及状态恢复绑定','Q引擎/浏览器/手机真机/桌面验收'],
                  'useRestriction':restriction,
                  'supersedes':'v001：头盔表情不适配卖车后' if key=='two-helmets' else 'v001：短裙不符合及膝设计，已隔离' if key=='skirt' else None})
        if key != 'base':
            approved = PKG/'option-a/char-xiaoman-human-base-option-a-v001.png'
            r['sources'].append({'path':rel(approved),'sha256':sha(approved),
                                 'role':'用户已选A基础；差分外形与画法约束'})
        parent = (PKG/'production/char-xiaoman-human-base-action-two-helmets-v001.png' if key=='two-helmets'
                  else PKG/'rejected/char-xiaoman-human-skirt-short-rejected-v001.png' if key=='skirt' else None)
        if parent:
            r['sources'].append({'path':rel(parent),'sha256':sha(parent),
                                 'role':'返修直接输入；旧版只追溯，不作采用'})
        records.append(r)
        asset_summary.append({'key':key,'label':label,'source':source_md,'reviewWebP':derivative_md})
    contact_sheet(comps,4,(300,450),QA/'contact-sheet.png','罗小满 · Option A 制作包（11张）')
    contact_sheet(faces,4,(300,294),QA/'head-consistency.png','罗小满 · 脸型与表情对照（统一区域）')
    contact_sheet(ui_items,3,(512,288),QA/'ui-contact-sheet.png','1280×720 · SUI-U 原界面静态合成')
    write_json(PKG/'resource-records.json',{'schemaVersion':'SUI-A02-1','ownerTask':'SUI-A02',
               'scope':'11张包内图及无损审阅副本；运行衍生由A11另行确认',
               'currentProjectAdopted':False,'records':records})
    write_json(QA/'需求映射.json',{'task':'SUI-A02','rules':{
        'endingContinue':'XM07-01=A & XM08-01=A','endingSeparate':'XM07-01=B | XM08-01=B',
        'day60Departure':'所有组合均去成都；第67—91天电话/视频不得表现小满仍在毕节实体出场',
        'helmets':'第53天卖车交钥匙，随后两顶头盔寄店；第91天防尘袋状态由A08固定场景/CG配合',
        'skirt':'第30天，及膝A字裙长度是用户确认设计；上大腿截幅不显示膝或裙摆',
        'noAutomaticEpilogueAppearance':'后日谈不因结局标签自动增加小满现场立绘'},
        'assets':mappings,'externalShotNeeds':[
            {'need':'第22天含夹子、卷袖、手镜及剪发接触近景','owner':'A09/A10-XM，必要立绘变体再回A02','state':'镜头复核范围；不冒充本批静态职业持物图'},
            {'need':'练习本错误页、报名材料及第22天剪发照片内容','owner':'A09/A10-XM；可读文字由正文/U给定','state':'本批仅闭合无字本，未编造内容'},
            {'need':'两顶头盔的寄店/防尘袋、车辆及车钥匙交接环境','owner':'A08固定物/A09/A10-XM；头盔造型引用A02同版','state':'本批只交持物两顶版本，不生成背景或绑定'},
            {'need':'成都视频的夹发、湿发和寝室构图','owner':'A09/A10-XM，按实际镜头决定','state':'电话/消息可用文字；不得使用本批站立图冒充毕节实体出场'}]})
    write_json(QA/'asset-audit.json',{'task':'SUI-A02','images':asset_summary,
               'sourcePNGBytes':sum(x['source']['bytes'] for x in asset_summary),
               'reviewWebPBytes':sum(x['reviewWebP']['bytes'] for x in asset_summary),
               'all11DecodedRGBABytesTheoretical':11*1024*1536*4,
               'memoryNote':'RGBA理论像素量，不是运行峰值内存或设备性能结论'})
    write_json(QA/'verification.json',{'task':'SUI-A02','scope':'离线格式/来源锚点/静态布局',
               'assets':checks,'assetCount':len(checks),
               'allMetadataAndPixelsPass':all(all(c[k] for k in ['pngTrueFormat','webpTrueFormat','commonCanvas','orientationNormal','hasActualTransparency','allDecodedRGBAEqual']) for c in checks),
               'allFaceRectsAboveDialogue':all(c['layout']['faceAboveDialogue'] for c in checks),
               'allPropRectsAboveDialogue':all(c['layout']['propAboveDialogue'] is not False for c in checks),
               'gameEngine':'未运行','browserGame':'未测','physicalPhone':'未测','desktopGame':'未测','deployment':'未执行'})
    write_json(QA/'ui-inputs.json',[{'path':str(p),'sha256':sha(p),'bytes':p.stat().st_size}
               for p in [ROOT/f'system/sui-u/png/{name}.png' for name in ['reading-backdrop','message','name','menu-idle']]])
    print(json.dumps({'assets':len(records),'allRGBAEqual':all(c['allDecodedRGBAEqual'] for c in checks),
           'allFaceRectsAboveDialogue':all(c['layout']['faceAboveDialogue'] for c in checks),
           'allPropRectsAboveDialogue':all(c['layout']['propAboveDialogue'] is not False for c in checks),
           'pngBytes':sum(x['source']['bytes'] for x in asset_summary),
           'webpBytes':sum(x['reviewWebP']['bytes'] for x in asset_summary)},ensure_ascii=False))


if __name__ == '__main__':
    main()
