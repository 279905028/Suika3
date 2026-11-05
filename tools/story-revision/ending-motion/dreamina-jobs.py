#!/usr/bin/env python3
"""Explicit CLI orchestration. Never approves credits; resumes use original IDs."""
import json,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
QA=ROOT/'qa/ending-motion-P4-V00-20261104'
STATE=QA/'generation-state.json'
FROZEN=json.loads((QA/'freeze-resume.json').read_text())
s=json.loads(STATE.read_text())
project=s['projectId']
def save():
 STATE.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n');STATE.chmod(0o600)
def call(args):
 p=subprocess.run(['dreamina-canvas',*args],cwd=ROOT,capture_output=True,text=True)
 try:r=json.loads(p.stdout)
 except ValueError:raise RuntimeError('CLI未返回JSON；退出码 '+str(p.returncode))
 if not r.get('ok'):
  print(json.dumps({'ok':False,'error':r.get('error'),'creditConfirmation':r.get('creditConfirmation'),'partialData':r.get('partialData'),'meta':r.get('meta')},ensure_ascii=False),flush=True)
  raise RuntimeError('CLI未完成，保留原身份后检查')
 return r
if sys.argv[1]=='prepare':
 for item in FROZEN['items']:
  key=item['ending'];job=s['items'][key]
  # The previously prepared long IDs failed CLI syntax and the inspected draft was empty.
  if 'legacyPrepared' not in job:
   job['legacyPrepared']={k:job[k] for k in ['imageNodeId','videoNodeId'] if k in job}
   job.pop('imageNodeId',None);job.pop('videoNodeId',None);save()
  if not job.get('uploaded'):
   r=call(['resource','upload','--project-id',project,'--resource-id',job['uploadId'],'--file',item['firstFrame']['path'],'--type','image','--name',item['key']+'首帧','--import-kind','local_upload'])
   job['uploaded']=True;job['uploadRequestId']=r.get('meta',{}).get('requestId');save();print(key+' upload complete',flush=True)
  if not job.get('imageNodeId'):
   r=call(['node','create','image','--project-id',project,'--title',item['key']+' 首帧','--resource-id',job['uploadId'],'--import-kind','local_upload','--submit-id',job['importSubmitId'],'--update-id',job['imageUpdateId']])
   node=r['data'].get('node',{});nodeid=node.get('nodeId') or r['data'].get('nodeId')
   if not nodeid:print('data fields',list(r.get('data',{})), 'node fields',list(node));raise RuntimeError('需要核查保存响应身份')
   job['imageNodeId']=nodeid;job['imageRequestId']=r.get('meta',{}).get('requestId');save();print(key+' first frame '+nodeid,flush=True)
  if not job.get('videoNodeId'):
   prompt=(ROOT/item['prompt']['path']).read_text()
   r=call(['node','create','video','--project-id',project,'--title',item['key']+' 五秒动态CG v001','--mode','first_last_frame','--model','seedance_2.5','--ratio','16:9','--resolution','720p','--duration','5','--count','1','--ref','node:'+job['imageNodeId'],'--prompt',prompt,'--update-id',job['updateId']])
   node=r['data'].get('node',{});nodeid=node.get('nodeId') or r['data'].get('nodeId')
   if not nodeid:print('data fields',list(r.get('data',{})), 'node fields',list(node));raise RuntimeError('需要核查保存响应身份')
   job.update(videoNodeId=nodeid,model='seedance_2.5',resolution='720p',duration=5,phase='draft-saved')
   job['videoRequestId']=r.get('meta',{}).get('requestId');save();print(key+' video draft '+nodeid,flush=True)
 print('SIX_DRAFTS_READY',flush=True)
elif sys.argv[1]=='quote':
 args=['node','quote','--project-id',project]
 for job in s['items'].values():args+=['--node-id',job['videoNodeId']]
 r=call(args);print(json.dumps(r,ensure_ascii=False),flush=True)
else:raise SystemExit('仅支持prepare或quote；不自动批准或提交生成')
