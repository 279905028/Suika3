#!/usr/bin/env python3
"""将GitHub服务器计算的附件指纹与本地已验文件逐一比对。"""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
QA=pathlib.Path(__file__).resolve().parent
REPO='279905028/Suika3'
VERSION='v1.1.0-beta.1'
RELEASE_ID=428805277
EXPECT_DRAFT='--draft' in sys.argv

def api(path):return json.loads(subprocess.check_output(['gh','api','repos/'+REPO+'/'+path]))
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()

release=api('releases/'+str(RELEASE_ID))
assert release['tag_name']==VERSION and release['prerelease'] and release['draft']==EXPECT_DRAFT
local=ROOT/'dist'/(VERSION+'-release')
files={p.name:p for p in local.iterdir() if p.is_file()}
assets={a['name']:a for a in release['assets']}
assert set(assets)==set(files),{'missing':sorted(set(files)-set(assets)),'extra':sorted(set(assets)-set(files))}
checks=[]
for name,file in sorted(files.items()):
 asset=assets[name];sha=digest(file)
 assert asset['state']=='uploaded' and asset['size']==file.stat().st_size,name
 assert asset['digest']=='sha256:'+sha,name
 checks.append({'name':name,'bytes':asset['size'],'sha256':sha,'remoteDigest':asset['digest'],'url':asset['browser_download_url'],'pass':True})
manifest=json.loads((local/'release-manifest.json').read_text())
tag=api('git/ref/tags/'+VERSION)['object']
assert tag['type']=='tag'
commit=api('git/tags/'+tag['sha'])['object']
assert commit['type']=='commit' and commit['sha']==manifest['sourceCommit']
assert release['target_commitish']==manifest['sourceCommit']
notes=(QA/'github-release-notes.md').read_text()
assert release['body'].rstrip()==notes.rstrip(),'Release说明与本地定稿不同'
report={'pass':True,'releaseId':release['id'],'url':release['html_url'],'tag':VERSION,'draft':release['draft'],'prerelease':release['prerelease'],'publishedAt':release['published_at'],'sourceCommit':commit['sha'],'tagObject':tag['sha'],'remoteMain':api('git/ref/heads/main')['object']['sha'],'inputFingerprint':manifest['inputFingerprint'],'validation':'GitHub服务器SHA-256、字节数、状态与本机已验附件逐项一致；标签指向同一源码提交。','assets':checks}
(QA/('upload-verification.json' if EXPECT_DRAFT else 'release-verification.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':True,'url':release['html_url'],'draft':release['draft'],'prerelease':release['prerelease'],'assetsVerified':len(checks),'sourceCommit':commit['sha']},ensure_ascii=False))
