"""P4-04 离线图文复核：只写本包文档与新QA，不生产或采用游戏美术。"""
import hashlib
import html
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
DOC = ROOT / 'docs/修订协作/P4-演出与美术/P4-04'
BASE = DOC.parent / 'P4-01'
QA = ROOT / 'qa/dialogue-p4-P4-04-20261103'

def read(p):
    return json.loads(p.read_text())

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def rel(p):
    return str(p.relative_to(ROOT))

def write(p, value):
    assert p.is_relative_to(DOC) or p.is_relative_to(QA)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n' if not isinstance(value, str) else value)

def fingerprint(p):
    return {'path': rel(p), 'sha256': sha(p), 'bytes': p.stat().st_size}

def frozen_check():
    checked = {}
    for manifest in ['input-manifest.json', 'freeze.json']:
        for item in read(BASE / manifest)['files']:
            assert sha(ROOT / item['path']) == item['sha256'], '冻结输入变化: ' + item['path']
            checked[item['path']] = item
    return list(checked.values())

frozen = frozen_check()
freeze = read(BASE / 'freeze.json')
baseline = read(BASE / 'resources.baseline.json')
legacy = read(BASE / 'legacy-index.json')['cgs']
production_file = ROOT/'assets/sources/20261103/P4-04/production-assets.json'
produced = {r['cgId']:r for r in read(production_file)['records']}
legacy.append({'cgId':'CG109','assetId':'cg-hq-cg109','paragraphIds':['T-HQ-000586']})
paragraphs = read(BASE / 'paragraph-map.json')['paragraphs']
nodes = {n['nodeId']: n for n in read(BASE / 'node-map.json')['nodes']}
ps = {p['paragraphId']: p for p in paragraphs}
decisions = read(DOC / 'decisions.json')
overlay_notes = read(DOC / 'overlay-notes.json') if (DOC / 'overlay-notes.json').exists() else {}
assets = {a['assetId']: a for a in read(ROOT / 'assets/current/manifest.json')['assets']}
selection = read(ROOT / 'docs/CG当前选择.json')
titles = {c['id']: c.get('originalTitle', c.get('title')) for c in selection['items']}
titles['CG109']='自己的名字自己写'
assert set(decisions) == {c['cgId'] for c in legacy} == set(selection['activeSelectedIds']) | {'CG109'}
assert len(decisions) == 61
retired = selection['retiredRouteIds']
assert not set(retired) & set(decisions)
font_path = ROOT / 'system/font/NotoSansCJK-Medium.ttc'
font = ImageFont.truetype(str(font_path), 30)
name_font = ImageFont.truetype(str(font_path), 26)
small = ImageFont.truetype(str(font_path), 22)
config = read(ROOT / 'system/sui-u/config.patch.json')
msg = Image.open(ROOT / config['msgbox.image']).convert('RGBA')
namebox = Image.open(ROOT / config['namebox.image']).convert('RGBA')
old_bindings = read(ROOT / 'docs/整合/bindings.json')['bindings']
records = []

for c in legacy:
    cid, aid = c['cgId'], c['assetId']
    pid, decision, reason = decisions[cid]
    p = ps[pid]
    n = nodes[p['nodeIds'][0]]
    assert n['op'] == 'text'
    assert pid in c['paragraphIds'], f'{cid} 的建议锚点超出旧来源，需单独核对'
    a = assets.get(aid)
    original_asset = a
    if cid in produced:
        pr = produced[cid]
        a = {'sourcePath':pr['source']['path'],'runtimePath':pr['runtime']['path'],
             'sourceSha256':pr['source']['sha256'],'runtimeSha256':pr['runtime']['sha256'],
             'width':pr['width'],'height':pr['height']}
    technical = {}
    for role in ['source', 'runtime']:
        path = ROOT / a[role + 'Path']
        assert sha(path) == a[role + 'Sha256']
        with Image.open(path) as im:
            im.load()
            technical[role] = {**fingerprint(path), 'format': im.format, 'size': list(im.size), 'mode': im.mode,
                               'alpha': 'A' in im.getbands(), 'exifOrientation': im.getexif().get(274)}
    assert technical['runtime']['format'] == 'WEBP'
    assert technical['runtime']['size'] == [a['width'], a['height']]
    placement = ({'x':0,'y':0,'scale':1280/a['width']} if cid in produced else
                 next(b['enter']['cg'] for b in old_bindings if b['cgId'] == cid))
    im = Image.open(ROOT / a['runtimePath']).convert('RGBA')
    full = Image.new('RGBA', (1280, 720), '#171c1d')
    scaled = im.resize((round(im.width*placement['scale']), round(im.height*placement['scale'])), Image.Resampling.LANCZOS)
    full.alpha_composite(scaled, (round(placement['x']), round(placement['y'])))
    view = full.copy()
    view.alpha_composite(msg, (int(config['msgbox.x']), int(config['msgbox.y'])))
    draw = ImageDraw.Draw(view)
    display_name = n['textMeta']['displayName']
    if display_name:
        view.alpha_composite(namebox, (int(config['namebox.x']), int(config['namebox.y'])))
        draw.text((92, 450), display_name, font=name_font, fill=(169,208,195))
    lines = []
    line = ''
    for ch in n['page']['text']:
        if ch == '\n' or draw.textlength(line + ch, font=font) > msg.width-72:
            lines.append(line)
            line = '' if ch == '\n' else ch
        else:
            line += ch
    if line:
        lines.append(line)
    assert len(lines) <= 3, (cid, lines)
    for i, line in enumerate(lines):
        draw.text((84, 514 + i*44), line, font=font, fill=(238,234,224))
    draw.text((72, 36), '查看全图 · V / 点击', font=small, fill=(169,208,195))
    preview_dir = QA / 'previews'
    preview_dir.mkdir(exist_ok=True)
    fullpath, overlaypath = preview_dir/f'{cid}-full.webp', preview_dir/f'{cid}-overlay.webp'
    full.convert('RGB').save(fullpath, lossless=True, method=4)
    view.convert('RGB').save(overlaypath, lossless=True, method=4)
    # 完整页底层由02逐段决定。此处只声明CG清除契约，不能伪装成最终binding。
    records.append({
        'cgId': cid, 'assetId': aid, 'title': titles[cid], 'packageId': p['packageId'],
        'decision': decision, 'basis': reason, 'legacyParagraphIds': [] if cid=='CG109' else c['paragraphIds'],
        'proposedNodeIds': [n['nodeId']],
        'anchor': {k: n[k] for k in ['nodeId','paragraphId','condition','routeIds','entryGate','textMeta','source']},
        'text': n['page']['text'],
        'exit': {'at': 'next-node', 'clearCg': True, 'fullView': False,
                 'underlay': '由P4-02按本页enter去掉CG给出完整状态；本表不复制旧人物/背景',
                 'destination': 'clear-before-target / recompute-destination',
                 'lexicalNextNodeId': n['lexicalNextNodeId'],
                 'note': 'lexicalNext仅定位，条件/调用/结局后的实际目标依控制流，不当作无条件跳转'},
        'fullView': True, 'unlock': 'on-actual-first-visible-frame',
        'technical': technical,
        'production': produced.get(cid),
        'previousAsset': {'sourcePath':original_asset['sourcePath'],'runtimePath':original_asset['runtimePath']} if cid in produced and original_asset else None,
        'previews': {'full': fingerprint(fullpath), 'overlay': fingerprint(overlaypath)},
        'review': {'content': 'reviewed', 'contactSheetVisual': 'reviewed',
                   'overlayVisual': ('reviewed-full-image-and-overlay' if cid in produced else 'reviewed-contact-sheet') if cid in overlay_notes else 'pending',
                   'overlayNote': overlay_notes.get(cid), 'P4-05': 'pending', 'runtime': 'not-tested'},
        'readyForBinding': False,
        'dependencies': ['P4-02正式镜头需求/锚点接受与底层退出状态', 'P4-05独立资源检查', 'P4-07统一采用']
    })

ending_decisions = {
    'XM-E1': (['CG022','CG023'], 'CG023只呈现视频中的挡脸一拍；余下以远程通话状态结束，无需新CG。'),
    'XM-E2': (['CG102'], '未裁掉的旧作品照足以收束普通互助，保持不开视频、不重启关系。'),
    'ZZ-E1': (['CG034','CG035'], '此前交杯和结尾独处电话已经形成相处落点，不增补同居图。'),
    'ZZ-E2': (['CG103'], '独自捋袖口回应前文，后续消息和回屋由普通场景承担。'),
    'MY-E1': (['CG104'], '独处收笔而不是公开复合图；AA且婚姻仍在，未定车票不画成已出行。'),
    'MY-E2': (['CG105'], '在三种断开共同的取消提醒处进入，所有分支都不出现新的亲密。'),
    'PI-E1': (['CG069'], 'CG069保留在此前车站，不移入结尾电话。第91天册页、语音、电话和收到照片可由原场景/远程状态承接；没有必须新增完整CG的独立事实。'),
    'PI-E2': (['CG106'], '收册入抽屉完成情感收束，后续吃饭与工作恢复正常场景。'),
    'PI-LE1': (['CG068'], '优先复核：确认试交往→递相机→重拍→核课与班。CG068只在递相机定格，不能铺满结尾；不画孕肚/新家庭/替毛狼承诺。'),
    'PI-LE2': (['CG070'], '优先复核：消息确认收到照片后清CG，下一次聚会另算现场。现有桌面照可承接朋友收束，不需追加恋爱图。'),
    'HQ-E1': (['CG109'], '收到HQ-N010后新增一张人形写杯名靠肩收束图，只在T-HQ-000586；球形CG073和第57天CG079不挪用。'),
    'HQ-E2': (['CG107'], '五点旧提醒取消，与晚上新班表分开。她仍保持人形，无手机、无公开出游。'),
    'FR-E1': (['CG108'], '两份早饭对应师匠和文文，毛狼只在之后消息中商量见面，不补画虚假三人团聚。'),
    'FR-E2': (['CG094'], '新柜台的过去式回答收束，后日谈继续消息视角，不以祝福复原亲密。')
}
routes = read(ROOT / 'scenario/routes.json')['routes']
expected = {e for r in routes for e in r['endings'] + r.get('lowPathEndings', [])}
assert expected == set(ending_decisions) and len(expected) == 14
endings = []
for eid, (cgs, reason) in ending_decisions.items():
    units = [p for p in paragraphs if p['source']['context'] == eid]
    assert units
    endings.append({'endingId': eid, 'paragraphIds': [p['paragraphId'] for p in units],
                    'conditions': sorted({p['condition'] for p in units}), 'relatedCgs': cgs,
                    'newCgDecision': 'CG109-produced' if eid=='HQ-E1' else 'not-required', 'basis': reason,
                    'reviewStatus': 'reviewed', 'P4-02Acceptance': 'pending'})

envelope = {'schemaVersion':'p4-cg-review-v1', 'taskId':'P4-04',
            'inputFingerprint': baseline['inputFingerprint'],
            'contentBuildId': read(BASE/'input-manifest.json')['contentBuildId'],
            'interfaceFingerprint': freeze['interfaceFingerprint'],
            'status':'production-complete-awaiting-P4-05',
            'scope':'CG图文复核建议；不是02完整绑定或05资源通过目录'}
write(DOC/'cg-review.json', {**envelope, 'records': records})
write(DOC/'endings.json', {**envelope, 'endings': endings})
write(DOC/'cg-registration.json', {**envelope, 'existing': baseline['cg'],
    'retiredIds': retired, 'newRegistrations': [{'cgId':'CG109','assetId':'cg-hq-cg109','registrationEvidence':fingerprint(DOC/'CG109登记.json')}], 'reservedIds': [],
    'nextUnallocatedId': 'CG110',
    'rule':'新增CG109；退役编号禁用，07统一采用前不改全局登记，06须处理61项容量。'})

for pack in ['COMMON','XM','ZZ','MY','PI','HQ','FR']:
    pack_records = [r for r in records if r['packageId'] == 'P4-02-'+pack]
    write(DOC/'packages'/f'{pack}.json', {**envelope, 'packageId':'P4-02-'+pack, 'records':pack_records})

extra_inputs = [ROOT/'docs/CG当前选择.json',ROOT/'docs/美术资源规范.md',ROOT/'docs/CG调整清单.md',
                ROOT/'system/sui-u/config.patch.json',ROOT/'system/sui-u/png/message.png',ROOT/'system/sui-u/png/name.png',font_path]
write(QA/'input-manifest.json', {**envelope,'frozenFiles':frozen,'previewInputs':[fingerprint(p) for p in extra_inputs]})
write(QA/'image-decode.json', {'count':61,'decodedFiles':122,'records':[{k:r[k] for k in ['cgId','technical']} for r in records],
                            'scope':'真实格式、完整解码、尺寸、方向元数据和指纹；未替代P4-05像素比较与全量资源终审'})

cards=[]
for r in records:
    cid=r['cgId']; issue=r['decision'] in ['repair-complete','new']
    cards.append(f'''<article data-pack="{r['packageId']}" data-issue="{str(issue).lower()}"><h2>{cid} · {html.escape(r['title'] or '')}</h2>
<p>{html.escape(r['packageId'])} · {html.escape(r['decision'])}</p><div class="pair"><figure><img loading="lazy" src="previews/{cid}-full.webp"><figcaption>完整图（1280×720分析缩放）</figcaption></figure><figure><img loading="lazy" src="previews/{cid}-overlay.webp"><figcaption>现行文字框＋冻结锚点正文（离线模拟）</figcaption></figure></div>
<p>{html.escape(r['basis'])}</p><p>{html.escape(r['review']['overlayNote'] or '')}</p><p><code>{r['anchor']['nodeId']}</code>：{html.escape(r['text'])}</p><details><summary>条件、门禁与退出</summary><pre>{html.escape(json.dumps({'condition':r['anchor']['condition'],'entryGate':r['anchor']['entryGate'],'exit':r['exit']},ensure_ascii=False,indent=2))}</pre></details>
<a href="../../{r['technical']['source']['path']}">原始图</a> · <a href="../../{r['technical']['runtime']['path']}">当前WebP</a></article>''')
write(QA/'index.html','''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P4-04 CG复核</title><style>
body{margin:0;background:#111c20;color:#ebe9df;font:16px/1.6 system-ui}header,main{max-width:1500px;margin:auto;padding:28px}header{position:sticky;top:0;background:#111c20f2;z-index:1}h1{margin:0}h2{font-size:23px}button,select{padding:8px;margin:5px}article{border-top:1px solid #536267;padding:24px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%;height:auto}a{color:#9dcdbc}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{color:#f4cb8f}figcaption{font-size:13px;color:#a5b3b2}@media(max-width:850px){.pair{grid-template-columns:1fr}}
</style><header><h1>P4-04 · 61张CG候选</h1><p>60旧图复核＋3张返修＋1张新增，14结局均已审读。制作完成、待05检查；这里是离线预览，不是引擎运行验收。</p>
<select id="pack"><option value="">全部七包</option>'''+''.join(f'<option>P4-02-{p}</option>' for p in ['COMMON','XM','ZZ','MY','PI','HQ','FR'])+'''</select><label><input id="issues" type="checkbox">仅返修／新增</label>
<a href="../../docs/修订协作/P4-演出与美术/P4-04/交接.md">交接说明</a></header><main>'''+''.join(cards)+'''</main><script>
const filter=()=>document.querySelectorAll('article').forEach(x=>x.hidden=(pack.value&&x.dataset.pack!==pack.value)||(issues.checked&&x.dataset.issue!=='true'));pack.onchange=filter;issues.onchange=filter;</script></html>''')

for start in range(0,len(records),10):
    sheet = Image.new('RGB',(1920,5*294),'#d9dddc')
    draw=ImageDraw.Draw(sheet)
    for i,r in enumerate(records[start:start+10]):
        im=Image.open(ROOT/r['previews']['overlay']['path']); im.thumbnail((480,270))
        # full + overlay并排，每行两张CG；每个CG宽960
        x=(i%2)*960; y=(i//2)*294
        f=Image.open(ROOT/r['previews']['full']['path']); f.thumbnail((480,270))
        sheet.paste(f,(x,y+24));sheet.paste(im,(x+480,y+24))
        draw.text((x+8,y),r['cgId']+' / '+r['decision'],font=small,fill='black')
    sheet.save(QA/f'overlay-sheet-{start//10+1}.jpg',quality=94)

frozen_check()
print(json.dumps({'cg':len(records),'endings':len(endings),'decoded':len(records)*2,'previews':len(records)*2,'frozenFiles':len(frozen),
                  'status':envelope['status']},ensure_ascii=False))
