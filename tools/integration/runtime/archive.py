#!/usr/bin/env python3
"""Package an immutable, verified candidate without adding files to its directory."""
import hashlib,json,re,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[3];version=sys.argv[1]
assert re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,79}',version)
src=root/'dist'/version;out=root/'dist'/(version+'-packages');assert not out.exists(),'禁止覆盖已有压缩包'
m=json.loads((src/'candidate-manifest.json').read_text());assert m['mode']=='candidate' and m['complete'] and m['producerHandoff']
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()
for f in m['outputs']:
 p=src/f['path'];assert p.stat().st_size==f['bytes'] and sha(p)==f['sha256'],f['path']
out.mkdir();records=[]
for platform in ['web','macos','windows-x64','windows-arm64']:
 target=out/(version+'-'+platform+'.zip')
 with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_STORED) as z:
  files=[src/'candidate-manifest.json',src/'阅读说明.md',*sorted((src/platform).rglob('*'))]
  for p in files:
   if p.is_file():z.write(p,Path(version)/p.relative_to(src))
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  for item in m['outputs']:
   if item['path'].startswith(platform+'/'):
    assert hashlib.sha256(z.read(str(Path(version)/item['path']))).hexdigest()==item['sha256']
 records.append({'platform':platform,'path':target.name,'bytes':target.stat().st_size,'sha256':sha(target)})
 print(platform,records[-1]['bytes'])
(out/'checksums.json').write_text(json.dumps({'version':version,'inputFingerprint':m['inputFingerprint'],'zipCRC':'passed','archiveEntriesMatchCandidate':True,'packages':records},ensure_ascii=False,indent=2)+'\n')
(out/'阅读说明.md').write_text(f'# {version} 分平台压缩包\n\n网页使用 web 包，经本机静态服务或网页服务器打开。macOS 使用 macos 包，解压后运行启动.command。Windows 按架构选择 x64 或 ARM64 包，再运行启动.bat。\n\n本版网页浏览器初验见工程 qa/sui-i02-20261030/交接.md；macOS/Windows 原生运行、手机真机、长期压力和发布未验。未签名、公证或安装包封装。两端存档身份不同，原档保留，不互相导入。\n\n每个压缩包附候选来源清单；checksums.json 记录本包 SHA-256 和逐文件一致性结果。\n')
