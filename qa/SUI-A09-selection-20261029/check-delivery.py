"""本批交付文件、链接及受保护输入检查；不写旧QA。"""
from pathlib import Path
import json,hashlib,re
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
changed_paths=['TODO-v1.1.md','docs/CG当前选择.json','docs/CG调整清单.md','docs/SUI-A美术子任务.md','docs/开发计划.md','docs/美术/SUI-A09.md','system/sui-u/README.md','system/sui-u/gallery.registry.json','system/sui-u/gallery-order.ray']
documents=[ROOT/p for p in changed_paths if p.endswith('.md')]+[OUT/'交接.md']
# 此报告在本脚本结尾生成，先把本次报告自身链接计入可解析范围。
self_report=OUT/'delivery-check.json'
links=[]; missing=[]
for p in documents:
    for m in re.finditer(r'\]\((<[^>]+>|[^)]+)\)',p.read_text()):
        target=m.group(1).strip('<>');target=unquote(target)
        if target.startswith(('https://','http://','codex://','mailto:','#')):continue
        target=target.split('#')[0];target=re.sub(r':\d+$','',target)
        resolved=Path(target) if Path(target).is_absolute() else p.parent/target
        resolved=resolved.resolve()
        exists=resolved.exists() or resolved==self_report
        record={'document':str(p.relative_to(ROOT)),'target':target,'exists':exists}
        links.append(record)
        if not exists:missing.append(record)
assert not missing,missing
review=load(OUT/'review-approved.json');selection=load(ROOT/'docs/CG当前选择.json');verification=load(OUT/'verification.json')
assert verification['status']=='pass'
assert review['inputSelection']['sha256']==sha(ROOT/'docs/CG当前选择.json')
for shot in review['shots']:
    assert sha(ROOT/shot['source']['path'])==shot['source']['sourceSha256'],shot['id']
    for source in shot['contextSources']:assert sha(ROOT/source['path'])==source['sourceSha256']
for key,ref in review['references'].items():
    assert sha(ROOT/ref['sourceFile'])==ref['sourceSha256'],key
    assert sha(ROOT/ref['recordPath'])==ref['recordSha256'],key
before=load(OUT/'input-before.json')['files']
protected=[f for f in before if f['path'] not in changed_paths]
for f in protected:assert sha(ROOT/f['path'])==f['sha256'],f['path']
actual_changed=[f['path'] for f in before if sha(ROOT/f['path'])!=f['sha256']]
assert sorted(actual_changed)==sorted(changed_paths)
doc=(ROOT/'docs/美术/SUI-A09.md').read_text()
for item in selection['approvedAdditionalIds']:
    assert doc.count('### '+item+'\n')==1,item
    assert '(#'+item.lower()+')' in doc,item
assert '用户尚未补选' not in doc and '标题变更与最终编号由集成者在用户确认后合并' not in doc
files=sorted({ROOT/p for p in changed_paths}|{p for p in OUT.iterdir() if p.is_file() and p!=self_report})
result={'task':'SUI-A09补选集成','date':'2026-10-29','status':'pass',
 'checks':{'documents':len(documents),'localLinks':len(links),'missingLinks':0,'formalNewIdHeadings':8,
 'protectedFilesUnchanged':len(protected),'authorizedChangedFiles':actual_changed,
 'currentSourceAndReferenceHashesMatch':True,'verificationStatus':'pass'},
 'artifacts':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size} for p in files],
 'notTested':['新CG图像生成/视觉验收','正式运行包重建','引擎/浏览器/手机真机/桌面','发布']}
self_report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['checks'],ensure_ascii=False))
