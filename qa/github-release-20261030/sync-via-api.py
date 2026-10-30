#!/usr/bin/env python3
"""Git传输不可达时，按现有对象SHA通过GitHub Git Data API同步同一提交。"""
import base64,concurrent.futures,datetime,json,pathlib,re,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(__file__).resolve().parent
REPO='279905028/Suika3'
BASE='375b4195ead1df832779d2cc33b6a8e1c17fc28c'
TARGET='4561eb2df8f35c7c7b8d97dbae2ab3fba4bb8c2b'
TAG='v1.1.0-beta.1'

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def api(endpoint,payload=None,method=None):
 args=['gh','api','repos/'+REPO+'/'+endpoint]
 if payload is not None:args+=['--method',method or 'POST','--input','-']
 for attempt in range(4):
  p=subprocess.run(args,input=json.dumps(payload,ensure_ascii=False).encode() if payload is not None else None,capture_output=True)
  if p.returncode==0:return json.loads(p.stdout)
  if attempt==3:raise RuntimeError(endpoint+': '+p.stderr.decode()[:400])
  time.sleep(2+attempt*2)

def person(line):
 m=re.fullmatch(r'(.*) <([^>]*)> (\d+) ([+-]\d{4})',line);assert m,line
 offset=m[4];minutes=(int(offset[1:3])*60+int(offset[3:]))*(1 if offset[0]=='+' else -1)
 tz=datetime.timezone(datetime.timedelta(minutes=minutes))
 return {'name':m[1],'email':m[2],'date':datetime.datetime.fromtimestamp(int(m[3]),tz).isoformat()}

def main():
 assert git('rev-parse','HEAD').decode().strip()==TARGET
 remote=api('git/ref/heads/main')['object']['sha']
 assert remote in {BASE,TARGET},'远端main变化，停止同步'
 objects=[line.split()[0] for line in git('rev-list','--objects',BASE+'..'+TARGET).decode().splitlines()]
 info=subprocess.check_output(['git','cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],cwd=ROOT,input=('\n'.join(objects)+'\n').encode()).decode().splitlines()
 groups={k:[] for k in ['blob','tree','commit']}
 for row in info:
  oid,kind,size=row.split();groups[kind].append(oid)
 cache_path=OUT/'api-object-cache.json'
 uploaded=set(json.loads(cache_path.read_text()) if cache_path.exists() else [])
 def record(oid):
  uploaded.add(oid);cache_path.write_text(json.dumps(sorted(uploaded),indent=2)+'\n')
 def blob(oid):
  result=api('git/blobs',{'content':base64.b64encode(git('cat-file','blob',oid)).decode(),'encoding':'base64'})
  assert result['sha']==oid,'上传blob与本机SHA不同';return oid
 pending=[o for o in groups['blob'] if o not in uploaded]
 print('同步 '+str(len(pending))+' 个文件对象',flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  jobs=[pool.submit(blob,o) for o in pending]
  for i,f in enumerate(concurrent.futures.as_completed(jobs),1):
   record(f.result())
   if i%20==0 or i==len(jobs):print('文件对象 '+str(i)+'/'+str(len(jobs)),flush=True)
 tree_entries={}
 for oid in groups['tree']:
  entries=[]
  for row in git('ls-tree','-z',oid).split(b'\0'):
   if not row:continue
   metadata,name=row.split(b'\t',1);mode,kind,child=metadata.decode().split()
   entries.append({'path':name.decode(),'mode':mode.zfill(6),'type':kind,'sha':child})
  tree_entries[oid]=entries
 pending=set(groups['tree'])-uploaded
 def tree(oid):
  result=api('git/trees',{'tree':tree_entries[oid]});assert result['sha']==oid,'树SHA不同';return oid
 while pending:
  ready=[oid for oid in pending if all(e['sha'] not in pending for e in tree_entries[oid])];assert ready
  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
   for oid in pool.map(tree,ready):record(oid);pending.remove(oid)
  print('目录对象剩余 '+str(len(pending)),flush=True)
 raw=git('cat-file','commit',TARGET).decode();headers,message=raw.split('\n\n',1)
 fields={}
 for line in headers.splitlines():
  k,v=line.split(' ',1);fields.setdefault(k,[]).append(v)
 assert set(fields)=={'tree','parent','author','committer'},'提交存在未支持头信息'
 result=api('git/commits',{'tree':fields['tree'][0],'parents':fields['parent'],'message':message,'author':person(fields['author'][0]),'committer':person(fields['committer'][0])})
 assert result['sha']==TARGET,'远端提交SHA不同：'+result['sha']
 current=api('git/ref/heads/main')['object']['sha'];assert current in {BASE,TARGET}
 if current!=TARGET:api('git/refs/heads/main',{'sha':TARGET,'force':False},'PATCH')
 tag_oid=git('rev-parse',TAG).decode().strip();tag_raw=git('cat-file','tag',tag_oid).decode();header,message=tag_raw.split('\n\n',1)
 fields=dict(line.split(' ',1) for line in header.splitlines())
 result=api('git/tags',{'tag':fields['tag'],'message':message,'object':fields['object'],'type':fields['type'],'tagger':person(fields['tagger'])})
 assert result['sha']==tag_oid,'远端标签SHA不同：'+result['sha']
 refs=api('git/matching-refs/tags/'+TAG)
 exact=[r for r in refs if r['ref']=='refs/tags/'+TAG]
 if exact:assert exact[0]['object']['sha']==tag_oid
 else:api('git/refs',{'ref':'refs/tags/'+TAG,'sha':tag_oid})
 report={'pass':True,'method':'GitHub Git Data API；无强制覆盖','sourceCommit':TARGET,'tag':TAG,'tagObject':tag_oid,'tree':fields.get('tree',git('rev-parse',TARGET+'^{tree}').decode().strip()),'uploadedObjects':len(uploaded),'remoteMain':api('git/ref/heads/main')['object']['sha'],'remoteTag':api('git/ref/tags/'+TAG)['object']['sha']}
 (OUT/'source-push-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
