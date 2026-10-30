"""只重执行SUI-U现有生成器的图鉴登记三条语句；不重制GUI资源。"""
from pathlib import Path
import ast,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
source=ROOT/'system/sui-u/source/build.py'
text=source.read_text();tree=ast.parse(text)
starts=[i for i,n in enumerate(tree.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='cg' for t in n.targets)]
assert len(starts)==1
nodes=tree.body[starts[0]:starts[0]+3]
assert isinstance(nodes[1],ast.Expr) and isinstance(nodes[2],ast.Expr)
assert 'gallery.registry.json' in ast.get_source_segment(text,nodes[1])
assert 'gallery-order.ray' in ast.get_source_segment(text,nodes[2])
selection=json.loads((ROOT/'docs/CG当前选择.json').read_text())
assert len(selection['activeSelectedIds'])==60 and len(set(selection['activeSelectedIds']))==60
assert not set(selection['activeSelectedIds'])&set(selection['retiredRouteIds'])
existing=json.loads((ROOT/'system/sui-u/gallery.registry.json').read_text())
assert all(x['file'] is None for x in existing['items']),'已有图片绑定，禁止用空槽生成覆盖'
scope={'ROOT':ROOT,'BASE':ROOT/'system/sui-u','json':json}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),scope)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'method':'重执行现有SUI-U生成器中cg读取及两个登记写入语句；未修改生成器，未重制GUI',
 'source':'system/sui-u/source/build.py','sourceSha256':sha(source),
 'sourceLines':[nodes[0].lineno,nodes[-1].end_lineno],
 'selectionSha256':sha(ROOT/'docs/CG当前选择.json'),'slotCount':60,'pageSize':6,'expectedPages':10,
 'runtimeRebuilt':False,'boundImages':0,
 'outputs':[{'path':p,'sha256':sha(ROOT/p)} for p in ['system/sui-u/gallery.registry.json','system/sui-u/gallery-order.ray']]}
(OUT/'gallery-refresh.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'slots':60,'expectedPages':10,'boundImages':0,'runtimeRebuilt':False}))
