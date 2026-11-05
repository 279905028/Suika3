"""汇总已实际查看的P4-05证据。检查结论、批准依据、正式采用分开记录。"""
import collections
import csv
import html
import json
import os
import shutil
from pathlib import Path
from urllib.parse import quote

from audit import ROOT, BASE, QA, DOC, OUT, read, sha, rel, fp, write, measure

DATE = '2026-11-04'
measurements = read(QA / 'measurements.json')
records = measurements['records']
preview_index = read(QA / 'preview-index.json')
observations = read(QA / 'visual-observations.json')
baseline = read(BASE / 'P4-01/resources.baseline.json')
assert not DOC.exists() and not OUT.exists(), '不得覆盖已交付批次'
notes = {v['sheet']: v for v in observations['sheetObservations']}
assert len(notes) == len(preview_index['sheets']) == 40
seen = {}
for sheet in preview_index['sheets']:
    assert sha(ROOT / sheet['path']) == sheet['sha256']
    note = notes[Path(sheet['path']).stem]
    assert note['result'].startswith('passed'), '目视问题未处置'
    for item in sheet['items']:
        assert item['recordId'] not in seen
        seen[item['recordId']] = {'sheet': {k: sheet[k] for k in ['path', 'sha256']},
                                  'method': sheet['kind'], 'note': note['note'],
                                  'location': {k: v for k, v in item.items() if k not in ['recordId', 'runtime']}}
assert set(seen) == {r['recordId'] for r in records}
detail_notes = {}
for d in observations['detailObservations']:
    detail_notes[d['assetId']] = {**d, 'evidence': [fp(ROOT / p) for p in d['paths']]}

# 来源追溯另留本轮实测指纹；历史记录只说明来源，不充当本批目视通过。
old_ledger = {a['assetId']: a for a in read(ROOT / 'qa/SUI-A11-20261029/pending-adoption.json')['records']}
source_rows = []
source_files = {}
for r in records:
    aid = r['assetId']
    row = {'recordId': r['recordId'], 'source': r['source'], 'records': list(r['provenance']),
           'promptOrProcess': [], 'basis': None}
    if r['origin'] == 'baseline' and aid in old_ledger:
        old = old_ledger[aid]
        d = read(ROOT / old['upstreamRecord'])
        values = d if isinstance(d, list) else d['records']
        raw = values[old['upstreamRecordIndex']]
        row['upstreamRecordIndex'] = old['upstreamRecordIndex']
        row['basis'] = '既有制作登记与当前源文件对应；本批另做解码与目视'
        paths = [raw.get(k) for k in ['promptOrProcessRecord', 'generationRecord', 'prompt']]
        src = raw.get('source')
        if isinstance(src, dict):
            paths += [src.get('promptFile'), src.get('reference')]
            row['sourceProcess'] = src
            if src.get('referenceSha256'):
                assert sha(ROOT / src['reference']) == src['referenceSha256']
        for p in paths:
            if isinstance(p, str) and (ROOT / p).is_file():
                row['promptOrProcess'].append(fp(ROOT / p))
        assert row['promptOrProcess'], '来源/过程记录缺失: ' + aid
    elif r['origin'] == 'baseline':
        selected_file = ROOT / 'assets/sources/20261030-portrait-gap-fill/selected.json'
        selected = next(a for a in read(selected_file)['assets'] if a['assetId'] == aid)
        assert selected['sourcePath'] == r['source']['path']
        row['records'].append(fp(selected_file))
        row['promptOrProcess'] = [fp(ROOT / ('assets/sources/20261030-portrait-gap-fill/' + n))
                                  for n in ['prompts.json', 'prompts-final.json']]
        row['basis'] = '14配角选定版本与生成提示对应；沿已有委托采用依据'
    else:
        row['promptOrProcess'] = list(r['provenance'])
        row['basis'] = '本批制作包来源/提示/参考图；仅交检查候选，未记用户逐图批准或正式采用'
    row['status'] = 'traceable'
    for x in row['records'] + row['promptOrProcess']:
        assert sha(ROOT / x['path']) == x['sha256']
        source_files[x['path']] = x
    source_rows.append(row)
write(QA / 'provenance-check.json', {'date': DATE, 'status': 'passed', 'records': source_rows,
                                    'files': list(source_files.values())})

# 上游已交无损WebP，独立复核后逐字节生成检查包中的运行候选；不二次压缩或改尺寸。
OUT.mkdir(parents=True)
derivatives = []
for r in records:
    assert r['formatStatus'] == 'passed' and all(r['checks'].values())
    if r['origin'] == 'baseline':
        continue
    source = ROOT / r['runtime']['path']
    target = OUT / (r['assetId'] + '.webp')
    assert not target.exists()
    shutil.copyfile(source, target)
    measured = measure(target)
    assert measured['sha256'] == r['runtime']['sha256']
    assert measured['rgbaSha256'] == r['technical']['source']['rgbaSha256']
    derivatives.append({'assetId': r['assetId'], 'source': r['source'], 'archiveWebP': r['runtime'],
                        'runtimeCandidate': fp(target), 'metadata': measured,
                        'operation': 'verified-lossless-byte-copy',
                        'encoding': r['encoding'], 'resized': False, 'recompressed': False,
                        'rgbaPixelsEqualToSource': True,
                        'adoptionStatus': 'not-adopted'})
assert len(derivatives) == 19
write(OUT / 'runtime-derivatives.json', {'date': DATE, 'taskId': 'P4-05', 'records': derivatives,
      'note': '运行候选保留原尺寸、ICC和alpha；不是assets/current正式采用。上游已是等像素无损WebP，无需有损重压。'})
derivatives_by_id = {a['assetId']: a for a in derivatives}
source_by_id = {a['recordId']: a for a in source_rows}
catalog = {'schemaVersion': 'p4-resources-v1', 'inputFingerprint': baseline['inputFingerprint'], 'assets': [], 'cg': list(baseline['cg'])}
reg = read(BASE / 'P4-04/cg-registration.json')['newRegistrations']
catalog['cg'] += [{'cgId': a['cgId'], 'assetId': a['assetId'],
                   'registrationEvidence': {k: a['registrationEvidence'][k] for k in ['path', 'sha256']}}
                  for a in reg]
summary_rows = []
for r in records:
    aid = r['assetId']
    runtime = derivatives_by_id[aid]['runtimeCandidate'] if r['origin'] != 'baseline' else r['runtime']
    transparent = r['technical']['runtime']['alpha']['extrema'][0] < 255
    scope = 'four-backgrounds-and-native-edge-samples' if transparent else 'full-image-contact-sheet'
    approval = r.get('approvalEvidence')
    state = 'passed' if approval else 'pending'
    w, h = (r['technical']['runtime'][k] for k in ['width', 'height'])
    scale = min(1280 / w, 720 / h)
    fit = [round((1280 - w*scale) / 2), round((720 - h*scale) / 2), round(w*scale), round(h*scale)]
    result = {'schemaVersion': 'p4-resource-check-v1', 'taskId': 'P4-05', 'date': DATE,
              'recordId': r['recordId'], 'assetId': aid, 'type': r['type'], 'selected': r['selected'],
              'inspectionStatus': 'passed', 'source': r['source'], 'runtime': runtime,
              'technical': r['technical'], 'checks': r['checks'],
              'colorNote': r['colorNote'], 'encoding': r['encoding'],
              'visual': {'status': 'passed', 'scope': scope, **seen[r['recordId']],
                         'detail': detail_notes.get(aid) if r['selected'] else None,
                         'observationRecord': fp(QA / 'visual-observations.json')},
              'provenance': source_by_id[r['recordId']],
              'approval': {'evidence': approval, 'status': 'existing-approved-scope-only' if approval else 'not-recorded-for-candidate',
                           'originalScope': r.get('approvedScope'),
                           'note': '检查通过不是逐图批准；新/返修文件不可继承同ID旧图批准。P4-07核对现有会话授权并登记实际采用依据。'},
              'catalogReviewStatus': state if r['selected'] else 'excluded-superseded',
              'candidateUseEvidence': r['candidateUseEvidence'],
              'usedNodeIds': r['usedNodeIds'], 'proposedNodeIds': r.get('proposedNodeIds', []),
              'restrictions': r['restrictions'],
              'stageFit': {'canvas': [1280, 720], 'mode': 'uniform-contain-no-stretch', 'drawRect': fit,
                           'note': '仅横图等比适配建议，整数像素留边保持；立绘仍用源图坐标，02另定站位，不将contain当角色定位。'},
              'notTested': ['引擎解码/颜色/合成', '逐节点实际遮挡与恢复', '浏览器', '手机真机', '电脑原生', '存档', '发布']}
    path = QA / 'checks' / (r['recordId'] + '.json')
    write(path, result)
    entry = {'recordId': r['recordId'], 'assetId': aid, 'type': r['type'], 'origin': r['origin'],
             'selected': r['selected'], 'inspectionStatus': 'passed',
             'catalogReviewStatus': result['catalogReviewStatus'], 'checkEvidence': fp(path),
             'source': r['source'], 'runtime': runtime,
             'visualMethod': scope, 'restrictionSummary': seen[r['recordId']]['note']}
    summary_rows.append(entry)
    if r['selected']:
        catalog['assets'].append({'assetId': aid, 'type': r['type'], 'source': r['source'], 'runtime': runtime,
                                 'reviewStatus': state, 'approvalEvidence': approval, 'checkEvidence': fp(path)})
assert len(catalog['assets']) == 242 and len(catalog['cg']) == 61
write(DOC / 'resources.candidate.json', catalog)
write(DOC / 'inspection-results.json', {'schemaVersion': 'p4-inspection-results-v1', 'date': DATE,
      'inputFingerprint': baseline['inputFingerprint'], 'records': summary_rows,
      'counts': {'versionsInspected': 245, 'candidateAssets': 242, 'imageChecksPassed': 242,
                 'imageRework': 0, 'imageNotTested': 0, 'supersededOldVersions': 3,
                 'transparentAssets': 92, 'cg': 61, 'runtimeCandidatesDelivered': 19,
                 'catalogPassedWithExistingApproval': 223, 'catalogPendingApprovalEvidence': 19},
      'interpretation': 'inspectionStatus是本批离线资源检查。目录reviewStatus遵守P4-01通过需批准依据的门禁；19候选有检查证据但批准栏留空，不将pending解释为图像未检查。'})
replaced = [{'assetId': r['assetId'], 'oldSource': r['source'], 'oldRuntime': r['runtime'],
             'replacement': next(x['runtime'] for x in summary_rows if x['assetId'] == r['assetId'] and x['selected']),
             'reason': {'cg-zz-cg025': '夜景替换为白昼v002', 'cg-pi-cg066': '站姿替换为床沿/矮凳坐姿v003',
                        'cg-common-cg101': '站姿替换为台阶坐姿v003'}[r['assetId']]}
            for r in records if not r['selected']]
dependencies = [
    {'id': 'P4-05-D01', 'owner': 'P4-06', 'status': 'open', 'kind': 'ui',
     'assets': ['cg-common-cg001', 'cg-zz-cg031', 'cg-common-cg101'],
     'action': '全图入口提示在亮天空/窗/墙上对比不足；使用稳定深色底板或等效高对比呈现，全图隐藏菜单，保留不推进文字/可见帧解锁语义。',
     'evidence': [fp(ROOT / f'qa/dialogue-p4-P4-04-20261103/previews/{c}-overlay.webp') for c in ['CG001', 'CG031', 'CG101']]},
    {'id': 'P4-05-D02', 'owner': 'P4-02/P4-07', 'status': 'open', 'kind': 'binding',
     'assets': ['piao-seated-base', 'char-xiaoman-work-apron-empty-hands'],
     'action': '两张新立绘保留源尺寸和透明边；坐姿含凳且下缘截幅，按真实场景定落点、遮挡及退出。小满空手不等于能直接表演理发/扫地。不能照抄制作方示意参数。'},
    {'id': 'P4-05-D03', 'owner': 'P4-07', 'status': 'open', 'kind': 'adoption-evidence',
     'assets': [a['assetId'] for a in derivatives],
     'action': '19张候选检查通过，尚无对应新字节的采用批准记录；合并时核对授权并登记依据，再更新目录reviewStatus。不得把制作记录或旧CG批准指向新图充数；本任务不请求重复确认已授权事项。'},
    {'id': 'P4-05-D04', 'owner': 'P4-02/P4-07', 'status': 'open', 'kind': 'scope-and-freeze',
     'action': '消费03/04节点范围并回填需求；既有图扩展到下午/第30天工作裙仅为候选范围。小满头盔顺序须按已确认移段另行重冻结，复核受影响锚点；勿回写旧P3/P4-01。'},
    {'id': 'P4-05-D05', 'owner': 'P4-06/P4-07', 'status': 'open', 'kind': 'integration',
     'action': '接入61项CG，使用本目录文件/检查证据，保留3个返修CG的原编号；02、06、07联动与P5运行另验。'},
]
write(DOC / 'rework-and-dependencies.json', {'date': DATE, 'imageReworkRequests': [], 'imageNotTested': [],
      'supersededVersions': replaced, 'dependencies': dependencies,
      'closedObservations': [{'id': 'P4-05-O01', 'assets': ['bg-huangqiuqiu-room-day', 'bg-huangqiuqiu-room-night', 'bg-huangqiuqiu-room-table-close-day'],
       'status': 'closed-by-existing-source', 'finding': '图内黄色球体容易被误认为黄球球本人；初判未成为返修。',
       'resolution': '现行采用清单已明确该小球是普通道具，允许两种形态共用房间；保留原批准，不擅自删球。',
       'evidence': fp(ROOT / 'assets/current/manifest.json')}],
      'notTested': ['全部候选在引擎/浏览器/手机真机/电脑原生中的呈现、存读档/回退/改选/刷新恢复', '正式采用与发布']})

with (QA / '逐项结果.csv').open('w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['版本', '资源类型', '进入候选', '资源检查', '交接目录状态', '宽', '高', 'alpha范围', '编码', '源图', '运行候选', '检查证据', '目视说明'])
    for r, s in zip(records, summary_rows):
        m = r['technical']['runtime']
        w.writerow([r['recordId'], r['type'], r['selected'], '通过', s['catalogReviewStatus'], m['width'], m['height'],
                    str(m['alpha']['extrema']), '无损WebP；RGBA与源图一致', r['source']['path'], s['runtime']['path'],
                    s['checkEvidence']['path'], s['restrictionSummary']])

def href(path):
    return quote(os.path.relpath(ROOT / path, QA), safe='/')

cards = []
for row in sorted([x for x in summary_rows if x['selected']], key=lambda x: (x['origin'] == 'baseline', x['type'], x['assetId'])):
    rid = row['recordId']
    sheet = seen[rid]['sheet']['path']
    links = ' · '.join(f'<a href="{href(p)}">{label}</a>' for p, label in [
        (row['source']['path'], '原图'), (row['runtime']['path'], '运行候选'),
        (sheet, '本批检查图'), (row['checkEvidence']['path'], '逐项记录')])
    state_text = '沿已有批准范围' if row['catalogReviewStatus'] == 'passed' else '待P4-07登记采用依据'
    cards.append(f'<article data-type="{row["type"]}" data-origin="{row["origin"]}"><img loading="lazy" src="{href(row["runtime"]["path"])}" alt="{html.escape(row["assetId"])}"><div><h2>{html.escape(row["assetId"])}</h2><p class="tag">资源检查通过 · {state_text}</p><p>{html.escape(row["restrictionSummary"])}</p><nav>{links}</nav></div></article>')
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P4-05 资源检查与交接</title><style>
body{margin:0;background:#edf0ec;color:#22342e;font:16px/1.6 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:32px 24px}h1{font-size:32px;margin:0 0 10px}h2{font-size:15px;overflow-wrap:anywhere;margin:0}.summary{background:#fff;padding:20px;border-radius:12px}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}input,select{font:inherit;padding:10px;border:1px solid #bccbc4;border-radius:6px}input{flex:1;min-width:180px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:white;border:1px solid #d3dcd5;border-radius:10px;overflow:hidden}article[hidden]{display:none}article img{width:100%;height:245px;object-fit:contain;background:repeating-conic-gradient(#e3e7e4 0 25%,#cfd7d2 0 50%) 50%/24px 24px}article>div{padding:16px}article p{font-size:13px}.tag{color:#356450}a{color:#245d4a}nav{font-size:13px}small{color:#53695d}@media(max-width:960px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style><main><header class="summary"><h1>P4-05 资源检查与交接</h1><p>完成：2026-11-04。245个版本重新检查，242项进入候选（含61张CG），3个旧CG版本保留为历史。</p><p>490份原图/WebP完整解码；245组无损像素相同；92项透明图四底及原像素边缘抽点完成。图像返修0项、图像未测0项。</p><p>223项沿已有批准范围；19张新/返修候选已检查，采用依据由P4-07登记。正式采用、引擎、浏览器、手机/原生、存档和发布未在本批执行。</p>'''
page += '<nav>' + ' · '.join(f'<a href="{href(p)}">{t}</a>' for p, t in [
    (rel(DOC / '交接.md'), '交接说明'), (rel(DOC / 'resources.candidate.json'), '候选目录'),
    (rel(QA / '逐项结果.csv'), '逐项结果表'), (rel(DOC / 'rework-and-dependencies.json'), '后续依赖')]) + '</nav></header>'
page += '<div class="controls"><input id="q" placeholder="搜索人物、场景或CG编号"><select id="origin"><option value="new">19张新/返修候选</option value="all">全部242项</option><option value="baseline">既有资源</option></select><select id="type"><option value="all">全部类型</option><option value="character">立绘</option><option value="prop">道具</option><option value="background">背景</option><option value="cg">CG</option></select></div><p id="count"></p><section class="grid">'
page += ''.join(cards) + '''</section><script>const q=document.querySelector('#q'),o=document.querySelector('#origin'),t=document.querySelector('#type');function filter(){let n=0;for(const a of document.querySelectorAll('article')){a.hidden=!(a.textContent.toLowerCase().includes(q.value.toLowerCase())&&(t.value==='all'||a.dataset.type===t.value)&&(o.value==='all'||(o.value==='new'?a.dataset.origin!=='baseline':a.dataset.origin==='baseline')));if(!a.hidden)n++}document.querySelector('#count').textContent='显示 '+n+' 项'}for(const e of[q,o,t])e.addEventListener('input',filter);filter();</script></main></html>'''
(QA / 'index.html').write_text(page)
print(json.dumps({'inspection': 242, 'superseded': 3, 'catalog': dict(collections.Counter(a['reviewStatus'] for a in catalog['assets'])),
                  'derivatives': len(derivatives), 'sourceRecords': len(source_rows)}, ensure_ascii=False))
