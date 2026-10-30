// Bind successful reports to the current source, archive and screenshot whitelist.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=__dirname,root=path.resolve(base,'../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const reportNames=['static-report.json','browser-report.json','controls-report.json'];
const reports=reportNames.map(read),build=read('build-manifest.json');
for(const r of reports){assert.equal(r.passed,true);assert((r.errors||[]).length===0);assert(r.checks.every(c=>c.pass))}
for(const r of reports.slice(1))assert.deepEqual(r.build.outputs,build.outputs,'Report used a different build');
for(const e of build.outputs)assert.equal(sha(path.join(base,e.path)),e.sha256,e.path);
for(const e of build.inputs)assert.equal(sha(path.join(base,'stage',e.path)),e.sha256,e.path);
const snapshot=read('input-snapshot.json');
for(const [p,h]of Object.entries(snapshot))assert.equal(sha(path.join(root,p)),h,p+' changed');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const uiFiles=walk(path.join(root,'system/sui-u')).map(p=>({path:path.relative(root,p),sha256:sha(p),bytes:fs.statSync(p).size}));
const screenshotNames=[...new Set(reports.slice(1).flatMap(r=>r.screenshots))];
assert(!screenshotNames.some(n=>n.includes('failure')));
const acceptedScreenshots=screenshotNames.map(name=>{const p=path.join(base,'screenshots',name);return{path:path.relative(root,p),sha256:sha(p)}});
const manifest={schemaVersion:1,date:'2026-10-28',status:'passed',scope:'SUI-U 独立原生界面；正式游戏/物理手机/桌面分发/发布未验',
 canvas:[1280,720],style:'用户选定：雨夜青灰，手机横屏阅读',
 checks:{static:reports[0].checks.length,browser:reports[1].checks.length,controls:reports[2].checks.length},
 protectedInputCount:Object.keys(snapshot).length,protectedInputsUnchanged:true,
 buildManifestSha256:sha(path.join(base,'build-manifest.json')),
 reports:reportNames.map(p=>({path:path.relative(root,path.join(base,p)),sha256:sha(path.join(base,p))})),
 uiFiles,acceptedScreenshots};
fs.writeFileSync(path.join(base,'acceptance-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:manifest.checks,protectedInputs:Object.keys(snapshot).length,uiFiles:uiFiles.length,screenshots:acceptedScreenshots.length}));
