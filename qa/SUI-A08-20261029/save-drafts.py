# -*- coding: utf-8 -*-
"""保存已获用户上传授权的草稿；不run、不confirm、不扣费。"""
import json, subprocess, sys
raise SystemExit('该历史即梦流程已按用户要求停用。当前请使用内置image_gen与production-plan.json续作。')
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
QA=Path(__file__).resolve().parent
plan=json.loads((QA/'production-plan.json').read_text())
journal=QA/'draft-saves.jsonl'
done={}
if journal.exists():
 for line in journal.read_text().splitlines():
  row=json.loads(line)
  if row.get('ok'): done[row['assetId']]=row
limit=int(sys.argv[1]) if len(sys.argv)>1 else len(plan['generation'])
for index,job in enumerate(plan['generation'][:limit]):
 if job['assetId'] in done: continue
 args=['dreamina-canvas','node','create','image','--project-id',plan['projectId'],
       '--node-id',job['nodeId'],'--update-id',job['updateId'],
       '--title',job['assetId'],'--mode',job['mode'],'--model',job['model'],
       '--ratio',job['ratio'],'--resolution',job['resolution'],'--count','1',
       '--prompt',(ROOT/job['promptFile']).read_text()]
 for reference in job['references']:args+=['--ref','node:'+reference]
 r=subprocess.run(args,capture_output=True,text=True)
 try:result=json.loads(r.stdout)
 except ValueError:result={'ok':False,'error':{'code':'unparsed_response','message':r.stderr[:500]}}
 row={'assetId':job['assetId'],'nodeId':job['nodeId'],'ok':result.get('ok',False),'response':result}
 with journal.open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print(index+1,job['assetId'],'saved' if row['ok'] else json.dumps(result,ensure_ascii=False),flush=True)
 if not row['ok']:sys.exit(1)
print('草稿保存完成；未生成图片、未批准扣费。',flush=True)
