"""独立补验收尾时新交的CG110～129；保留已完成的245版本证据。"""
import argparse
import collections
import csv
import html
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont
from audit import ROOT, BASE, QA, DOC, OUT, read, sha, rel, fp, write, measure

SUB = QA / 'cg110-129'
SOURCE = ROOT / 'assets/sources/20261103/CG-expansion-20'
UPDOC = BASE / 'CG扩充20张'
DATE = '2026-11-04'


def prepare():
    assert not SUB.exists(), '补验批次已有记录，不覆盖'
    inputs = {}
    for folder in [SOURCE, UPDOC, ROOT / 'qa/cg-expansion-20-20261103']:
        for p in folder.rglob('*'):
            if p.is_file():
                inputs[rel(p)] = fp(p)
    references = read(SOURCE / 'reference-sources-fingerprints.json')
    for f in references.values():
        assert sha(ROOT / f['path']) == f['sha256']
        inputs[f['path']] = fp(ROOT / f['path'])
    write(SUB / 'input-manifest.json', {'date': DATE, 'scope': '新增20张CG的制作原件、来源、计划、参考图与上游QA；不改上游', 'files': list(inputs.values())})
    upstream = read(SOURCE / 'resource-records.json')
    baseline = read(BASE / 'P4-01/input-manifest.json')
    assert upstream['inputFingerprint'] == baseline['inputFingerprint']
    assert upstream['contentBuildId'] == baseline['contentBuildId']
    plans = {r['assetId']: r for r in read(UPDOC / 'binding-plans.json')['records']}
    generated = {r['workspacePath']: r for r in read(SOURCE / 'generated-files.json')}
    paths = sorted({a[k]['path'] for a in upstream['records'] for k in ['source', 'runtimeCandidate']})
    with ThreadPoolExecutor(max_workers=4) as pool:
        measured = dict(zip(paths, pool.map(lambda p: measure(ROOT / p), paths)))
    rows = []
    provenance_paths = [*SOURCE.glob('*.json'), UPDOC / 'binding-plans.json', UPDOC / 'cg-registration.json']
    for a in upstream['records']:
        s, w = (measured[a[k]['path']] for k in ['source', 'runtimeCandidate'])
        assert generated[a['source']['path']]['sha256'] == s['sha256']
        for f in [a['source'], a['runtimeCandidate'], *a['references'], *a['previews'].values()]:
            assert sha(ROOT / f['path']) == f['sha256']
        checks = {'sourceFingerprint': s['sha256'] == a['source']['sha256'],
                  'runtimeFingerprint': w['sha256'] == a['runtimeCandidate']['sha256'],
                  'format': s['format'] == 'PNG' and w['format'] == 'WEBP',
                  'staticImage': s['frames'] == w['frames'] == 1,
                  'size': (s['width'], s['height']) == (w['width'], w['height']) == (1672, 941),
                  'orientation': s['normalizedOrientation'] == w['normalizedOrientation'] == 1,
                  'losslessBitstream': w['losslessWebP'],
                  'rgbaPixelsEqual': s['rgbaSha256'] == w['rgbaSha256'],
                  'alphaPixelsEqual': s['alphaSha256'] == w['alphaSha256']}
        assert all(checks.values())
        rows.append({'recordId': a['assetId'] + '@CG-expansion-20', 'assetId': a['assetId'], 'cgId': a['cgId'],
                     'type': 'cg', 'origin': 'CG-expansion-20', 'selected': True,
                     'source': fp(ROOT / a['source']['path']), 'runtime': fp(ROOT / a['runtimeCandidate']['path']),
                     'technical': {'source': s, 'runtime': w}, 'checks': checks, 'encoding': a['encoding'],
                     'formatStatus': 'passed', 'visualStatus': 'not-tested', 'approvalEvidence': None,
                     'colorNote': '源图和无损WebP保持像素与ICC；不声称运行色彩校准。',
                     'provenance': [fp(p) for p in provenance_paths] + [fp(ROOT / f['path']) for f in a['references']],
                     'references': [fp(ROOT / f['path']) for f in a['references']],
                     'previews': a['previews'], 'plan': plans[a['assetId']],
                     'restrictions': plans[a['assetId']]['restrictions'],
                     'proposedNodeIds': plans[a['assetId']]['proposedNodeIds'], 'usedNodeIds': []})
    write(SUB / 'measurements.json', {'date': DATE, 'inputFingerprint': upstream['inputFingerprint'], 'records': rows})
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 18)
    sheets = []
    for start in range(0, len(rows), 5):
        group = rows[start:start + 5]
        im = Image.new('RGB', (1280, 1152), '#e4e8e7')
        draw = ImageDraw.Draw(im)
        items = []
        for j, r in enumerate(group):
            x, y = (j % 2) * 640, (j // 2) * 384
            with Image.open(ROOT / r['previews']['overlay']['path']) as opened:
                preview = opened.convert('RGB')
                preview.thumbnail((640, 360), Image.Resampling.LANCZOS)
                im.paste(preview, (x, y + 24))
            draw.text((x + 8, y + 2), r['cgId'], fill='#182626', font=font)
            items.append({'recordId': r['recordId'], 'cell': j, 'fullImage': r['source'],
                          'overlay': fp(ROOT / r['previews']['overlay']['path'])})
        p = SUB / f'overlay-{start // 5 + 1:02d}.png'
        im.save(p)
        sheets.append({'kind': 'full-source-plus-overlay-contact', **fp(p), 'items': items})
    write(SUB / 'preview-index.json', {'scope': '20张原图逐张查看；另核制作方离线遮挡预览，不作引擎截图', 'sheets': sheets})
    print({'versions': len(rows), 'bitmaps': len(paths), 'protected': len(inputs), 'overlaySheets': len(sheets)})


def finalize():
    rows = read(SUB / 'measurements.json')['records']
    observations = read(SUB / 'visual-observations.json')
    notes = {r['cgId']: r for r in observations['records']}
    sheets = read(SUB / 'preview-index.json')['sheets']
    assert set(notes) == {r['cgId'] for r in rows}
    assert observations['overlaySheetsViewed'] == [x['path'] for x in sheets]
    seen = {i['recordId']: {'sheet': {k: s[k] for k in ['path', 'sha256']}, 'location': {'cell': i['cell']}}
            for s in sheets for i in s['items']}
    summary = []
    derivatives = []
    provenance = {}
    catalog = read(DOC / 'resources.candidate.json')
    assert len(catalog['assets']) == 242 and len(catalog['cg']) == 61
    for r in rows:
        note = notes[r['cgId']]
        assert note['status'] == 'passed' and note['fullImageViewed']
        for f in [r['source'], r['runtime'], *r['provenance']]:
            assert sha(ROOT / f['path']) == f['sha256']
        target = OUT / (r['assetId'] + '.webp')
        assert not target.exists()
        shutil.copyfile(ROOT / r['runtime']['path'], target)
        assert sha(target) == r['runtime']['sha256']
        runtime = fp(target)
        derivatives.append({'assetId': r['assetId'], 'source': r['source'], 'archiveWebP': r['runtime'],
                            'runtimeCandidate': runtime, 'operation': 'verified-lossless-byte-copy',
                            'metadata': r['technical']['runtime'], 'encoding': r['encoding'],
                            'resized': False, 'recompressed': False, 'rgbaPixelsEqualToSource': True,
                            'adoptionStatus': 'not-adopted'})
        for f in r['provenance']:
            provenance[f['path']] = f
        result = {'schemaVersion': 'p4-resource-check-v1', 'taskId': 'P4-05', 'date': DATE,
                  'recordId': r['recordId'], 'assetId': r['assetId'], 'type': 'cg', 'selected': True,
                  'inspectionStatus': 'passed', 'source': r['source'], 'runtime': runtime,
                  'technical': r['technical'], 'checks': r['checks'], 'encoding': r['encoding'], 'colorNote': r['colorNote'],
                  'visual': {'status': 'passed', 'method': 'full-source-plus-overlay-contact', **seen[r['recordId']],
                             'observationRecord': fp(SUB / 'visual-observations.json'), 'note': note['note'],
                             'evidence': [r['source'], fp(ROOT / r['previews']['overlay']['path']), *r['references']]},
                  'provenance': r['provenance'], 'catalogReviewStatus': 'pending',
                  'approval': {'evidence': None, 'status': 'not-recorded-for-candidate',
                               'note': '已有制作委托；P4-07核对实际授权登记采用依据，不重复询问已经授权的事项。'},
                  'candidateUseEvidence': [fp(UPDOC / 'binding-plans.json')],
                  'usedNodeIds': [], 'proposedNodeIds': r['proposedNodeIds'],
                  'restrictions': r['restrictions'] + note.get('additionalRestrictions', []),
                  'stageFit': {'canvas': [1280, 720], 'mode': 'uniform-contain-no-stretch',
                               'scale': min(1280 / 1672, 720 / 941),
                               'note': '按941高等比入720，宽约1279.32，居中留边；不横向拉伸。'},
                  'notTested': ['正式绑定', '引擎', '浏览器', '手机真机', '电脑原生', '存档', '发布']}
        check = SUB / 'checks' / (r['recordId'] + '.json')
        write(check, result)
        entry = {'recordId': r['recordId'], 'assetId': r['assetId'], 'type': 'cg', 'origin': r['origin'],
                 'selected': True, 'inspectionStatus': 'passed', 'catalogReviewStatus': 'pending',
                 'checkEvidence': fp(check), 'source': r['source'], 'runtime': runtime,
                 'visualMethod': 'full-source-plus-overlay-contact', 'restrictionSummary': note['note']}
        summary.append(entry)
        catalog['assets'].append({'assetId': r['assetId'], 'type': 'cg', 'source': r['source'], 'runtime': runtime,
                                  'reviewStatus': 'pending', 'approvalEvidence': None, 'checkEvidence': fp(check)})
        catalog['cg'].append({'cgId': r['cgId'], 'assetId': r['assetId'], 'registrationEvidence': fp(UPDOC / 'cg-registration.json')})
    write(OUT / 'runtime-derivatives.cg110-129.json', {'date': DATE, 'taskId': 'P4-05', 'records': derivatives})
    write(SUB / 'provenance-check.json', {'date': DATE, 'status': 'passed', 'records': summary, 'files': list(provenance.values())})
    write(DOC / 'resources.expanded.candidate.json', catalog)
    all_results = read(DOC / 'inspection-results.json')
    all_results['records'] += summary
    all_results['counts'].update(versionsInspected=265, candidateAssets=262, imageChecksPassed=262, cg=81,
                                 runtimeCandidatesDelivered=39, catalogPendingApprovalEvidence=39)
    all_results['interpretation'] = '已独立检查265版本，262项候选图像检查通过；223项沿原批准范围，39项采用依据待07登记。新增20CG登记目录超出P4-01冻结工具白名单，需06/07适配登记入口，不伪造04证据。'
    write(DOC / 'inspection-results.expanded.json', all_results)
    deps = read(DOC / 'rework-and-dependencies.json')
    for d in deps['dependencies']:
        if d['id'] == 'P4-05-D03':
            d['assets'] += [r['assetId'] for r in rows]
            d['action'] = d['action'].replace('19张', '39张')
        if d['id'] == 'P4-05-D05':
            d['action'] = d['action'].replace('61项', '81项')
    deps['dependencies'] += [
        {'id': 'P4-05-D06', 'owner': 'P4-06/P4-07', 'status': 'open', 'kind': 'registration-interface',
         'action': 'CG110～129独立制作目录的真实登记不在P4-01冻结检查器允许的P4-04路径内。扩展目录schema、编号、文件、检查证据有效，但原resourceCatalog拒绝此路径。接入方正式登记或适配工具，禁止05伪造P4-04证据或回写冻结工具。',
         'evidence': [fp(UPDOC / 'cg-registration.json')]},
        {'id': 'P4-05-D07', 'owner': 'P4-02/P4-07', 'status': 'open', 'kind': 'expanded-cg-bindings',
         'action': '接受20个计划锚点并核实际退出状态；CG116核夜景底层，CG122仅收到照片、CG126仅回忆。CG129扶板/搭肩为制作演绎；不得将ALL理解为解除路线入口。',
         'evidence': [fp(UPDOC / 'binding-plans.json')]}
    ]
    write(DOC / 'rework-and-dependencies.expanded.json', deps)
    with (QA / '逐项结果.csv').open(encoding='utf-8-sig', newline='') as f:
        csvrows = list(csv.reader(f))
    for r, s in zip(rows, summary):
        m = r['technical']['runtime']
        csvrows.append([r['recordId'], 'cg', True, '通过', 'pending', m['width'], m['height'],
                        str(m['alpha']['extrema']), '无损WebP；RGBA与源图一致', r['source']['path'],
                        s['runtime']['path'], s['checkEvidence']['path'], s['restrictionSummary']])
    csvfile = QA / '逐项结果-含新增20CG.csv'
    assert not csvfile.exists()
    with csvfile.open('w', encoding='utf-8-sig', newline='') as f:
        csv.writer(f).writerows(csvrows)
    render(all_results)
    print({'versions': 265, 'candidateAssets': 262, 'cg': 81, 'newRuntimeCandidates': 20, 'pendingAdoptionEvidence': 39})


def render(results):
    def href(p):
        return quote(os.path.relpath(ROOT / p, QA), safe='/')
    cards = []
    for r in sorted([r for r in results['records'] if r['selected']], key=lambda r: (r['origin'] != 'CG-expansion-20', r['origin'] == 'baseline', r['type'], r['assetId'])):
        c = read(ROOT / r['checkEvidence']['path'])
        links = ' · '.join(f'<a href="{href(p)}">{t}</a>' for p, t in [(r['source']['path'], '原图'), (r['runtime']['path'], '运行候选'), (c['visual']['sheet']['path'], '检查图'), (r['checkEvidence']['path'], '检查记录')])
        state = '沿已有批准范围' if r['catalogReviewStatus'] == 'passed' else '采用依据待登记'
        cards.append(f'<article data-origin="{r["origin"]}" data-type="{r["type"]}"><img loading="lazy" src="{href(r["runtime"]["path"])}" alt="{r["assetId"]}"><div><h2>{r["assetId"]}</h2><p class="tag">资源检查通过 · {state}</p><p>{html.escape(r["restrictionSummary"])}</p><nav>{links}</nav></div></article>')
    old = (QA / 'index.html').read_text()
    style = old.split('<style>')[1].split('</style>')[0]
    page = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P4-05 完整资源交接</title><style>' + style + '</style><main><header class="summary"><h1>P4-05 完整资源交接</h1><p>2026-11-04：265个版本，530份原图/WebP；262项候选，含81张CG。92项透明图四底及原像素边缘抽点通过；新增20张CG另做完整图、遮挡与人物参照复验。新增图像返修0、图像未测0。</p><p>223项沿已有批准范围，39张新/返修候选的采用依据由P4-07登记。新增20CG登记入口待P4-06/07接入；正式采用及运行验收另行执行。</p><nav>'
    page += ' · '.join(f'<a href="{href(rel(p))}">{t}</a>' for p, t in [(DOC / '交接.md', '交接说明'), (DOC / 'resources.expanded.candidate.json', '262项候选目录'), (QA / '逐项结果-含新增20CG.csv', '逐项结果'), (DOC / 'rework-and-dependencies.expanded.json', '后续依赖')])
    page += '</nav></header><div class="controls"><input id="q" placeholder="搜索人物、场景或CG编号"><select id="origin"><option value="new">39张新/返修候选</option><option value="expansion">新增20CG</option><option value="all">全部262项</option><option value="baseline">既有资源</option></select><select id="type"><option value="all">全部类型</option><option value="character">立绘</option><option value="prop">道具</option><option value="background">背景</option><option value="cg">CG</option></select></div><p id="count"></p><section class="grid">' + ''.join(cards)
    page += "</section><script>const q=document.querySelector('#q'),o=document.querySelector('#origin'),t=document.querySelector('#type');function filter(){let n=0;for(const a of document.querySelectorAll('article')){a.hidden=!(a.textContent.toLowerCase().includes(q.value.toLowerCase())&&(t.value==='all'||a.dataset.type===t.value)&&(o.value==='all'||(o.value==='new'?a.dataset.origin!=='baseline':o.value==='expansion'?a.dataset.origin==='CG-expansion-20':a.dataset.origin==='baseline')));if(!a.hidden)n++}document.querySelector('#count').textContent='显示 '+n+' 项'}for(const e of[q,o,t])e.addEventListener('input',filter);filter();</script></main></html>"
    p = QA / 'index-expanded.html'
    assert not p.exists()
    p.write_text(page)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['prepare', 'finalize'])
    args = parser.parse_args()
    {'prepare': prepare, 'finalize': finalize}[args.phase]()
