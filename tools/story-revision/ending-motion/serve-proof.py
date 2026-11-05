#!/usr/bin/env python3
"""Local-only delivery of the real-media probe; save one bounded JSON report."""
import http.server
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
batch=sys.argv[1] if len(sys.argv)>1 else 'real-media-v1'
if batch not in ('real-media-v1','real-media-v2'):
    raise SystemExit('只允许本轮已登记夹具')
QA=ROOT/'qa/ending-motion-P4-V-T-20261104'/batch
WEB=QA/'web'
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(WEB),**kwargs)
    def do_POST(self):
        if self.path!='/__proof':
            self.send_error(404);return
        size=int(self.headers.get('Content-Length','0'))
        if size<=0 or size>1000000:
            self.send_error(400);return
        data=json.loads(self.rfile.read(size))
        target=QA/'browser-report.json'
        if target.exists():
            self.send_error(409);return
        target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        self.send_response(200);self.end_headers();self.wfile.write(b'ok')
        print(json.dumps({'status':data.get('status'),'checks':len(data.get('checks',[])),'report':str(target)},ensure_ascii=False),flush=True)
    def log_message(self,*args):
        pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
print('http://127.0.0.1:'+str(server.server_port),flush=True)
server.serve_forever()
