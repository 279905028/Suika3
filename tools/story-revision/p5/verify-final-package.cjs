#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
function verify(buildPath,out){
  assert(buildPath&&out&&!fs.existsSync(path.join(ROOT,out)),'指定已构建版本与新的报告文件');
  const build=read(buildPath+'/build-result.json'),runtime=read(buildPath+'/runtime/build-manifest.json');
  const report={status:'running',runtimeBuildId:build.runtimeBuildId,contentBuildId:build.contentBuildId,checks:[],nonRuntimeChanges:[]};
  const check=(name,pass)=>{assert(pass,name);report.checks.push(name);};
  try{
    check('构建记录与运行清单同版本',build.runtimeBuildId===runtime.runtimeBuildId&&build.contentBuildId===runtime.contentBuildId);
    // 验收脚本和说明会在运行验证中完善；逐项记录，不把它们误称为字节冻结。
    const evidenceOnly=p=>p.endsWith('/README.md')||/^tools\/runtime\/verify-[^/]+\.cjs$/.test(p)||/^tools\/story-revision\/p5\/verify-[^/]+\.cjs$/.test(p);
    for(const item of build.inputs){
      assert.equal(sha(buildPath+'/input/'+item.path),item.sha256,'冻结快照改变：'+item.path);
      const current=sha(item.path);
      if(current!==item.sha256){assert(evidenceOnly(item.path),'正式输入发生漂移：'+item.path);report.nonRuntimeChanges.push({path:item.path,frozenSha256:item.sha256,currentSha256:current});}
    }
    check('全部冻结输入保持原指纹，当前运行/正文/资源输入无漂移',true);report.frozenInputCount=build.inputs.length;
    for(const item of runtime.outputs)assert.equal(sha(buildPath+'/runtime/'+item.path),item.sha256,'运行产物改变：'+item.path);
    check('全部网页产物与构建时指纹一致',true);report.outputCount=runtime.outputs.length;
    const batch=buildPath.slice(0,buildPath.lastIndexOf('/'));
    check('原静态资源清单未改写',sha('assets/current/manifest.json')===sha(batch+'/before/static-manifest.json'));
    check('原静态绑定未改写',sha('docs/整合/bindings.json')===sha(batch+'/before/static-bindings.json'));
    const manifest=read('assets/current/motion/manifest.json'),bindings=read('docs/整合/motion-bindings.json');
    assert.equal(manifest.items.length,29);assert.equal(bindings.bindings.length,29);
    assert.equal(new Set(bindings.bindings.map(x=>x.node)).size,29);
    for(const item of manifest.items){
      for(const [field,ext] of [['src','mp4'],['fallback','webp']]){
        assert.equal(sha(item[field]),item[field+'Sha256']);
        assert.equal(sha(buildPath+'/runtime/web/motion/'+item.key+'.'+ext),item[field+'Sha256']);
      }
    }
    check('29段视频和29张回退静帧从采用清单到网页逐字节一致',true);
    report.motionCG=manifest.items.length;
    report.status='pass';
  }catch(e){report.status='fail';report.error=e.stack;throw e;}
  finally{fs.mkdirSync(path.dirname(path.join(ROOT,out)),{recursive:true});fs.writeFileSync(path.join(ROOT,out),JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,frozenInputCount:report.frozenInputCount,outputCount:report.outputCount,nonRuntimeChanges:report.nonRuntimeChanges.map(x=>x.path)}));
  return report;
}
if(require.main===module)verify(process.argv[2],process.argv[3]);
module.exports={verify};
