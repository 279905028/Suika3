#!/usr/bin/env node
'use strict';
// SUI-I02: validate, freeze, compile, package. Never infer adoption from a directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=p=>sha(fs.readFileSync(p));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function write(p,data){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
function safe(rel){assert(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.includes('\\')&&!rel.split('/').some(p=>p==='..'||p==='.'||p===''),'非法相对路径：'+rel);return rel;}
function same(source,entries){for(const entry of entries)assert.equal(hash(path.join(source,entry.path)),entry.sha256,'构建期间输入变化：'+entry.path);}
function records(dir){return walk(dir).map(p=>({path:path.relative(dir,p),bytes:fs.statSync(p).size,sha256:hash(p)}));}
function build(options={}){
  const {compile}=require('../../compiler/compile.cjs');
  const standardValidate=require('./validate.cjs').validate;
  let validate=standardValidate;
  const {integrate}=require('./presentation-full.cjs');
  const {build:runtimeBuild}=require('../../runtime/build.cjs');
  const diagnostic=options.mode==='diagnostic';
  assert(['candidate','diagnostic'].includes(options.mode||'candidate'),'mode须为candidate或diagnostic');
  const version=options.version;assert(/^[a-z0-9][a-z0-9._-]{2,79}$/.test(version||''),'必须指定 --version，使用小写字母/数字/点/横线');
  const base=diagnostic?path.resolve(ROOT,options.out||'qa/sui-i02-20261029/'+version):path.join(ROOT,'build',version);
  const dist=diagnostic?path.join(base,'packages'):path.join(ROOT,'dist',version);
  assert(!fs.existsSync(base),'版本目录已存在，禁止覆盖：'+base);
  assert(!fs.existsSync(dist),'分发目录已存在，禁止覆盖：'+dist);
  if(diagnostic)assert(/^qa\/sui-i02-[^/]+\/.+/.test(path.relative(ROOT,base))&&!path.relative(ROOT,base).split('/').includes('..'),'诊断只允许输出到qa/sui-i02-*/子目录');
  const resolve=p=>path.resolve(ROOT,p);
  const manifestPath=resolve(options.manifest||'assets/current/manifest.json');
  const bindingsPath=resolve(options.bindings||'docs/整合/bindings.json');
  assert(options.snapshot,'必须指定 I01 冻结快照 --snapshot；没有交接不能生成正式候选');
  const snapshotPath=resolve(options.snapshot);
  const producer=read(manifestPath).schemaVersion==='sui-i01-data-v1';
  if(producer)validate=require('./validate-i01.cjs').validate;
  const compiled=compile({pageSize:108});
  const v=validate({root:ROOT,manifestPath:path.relative(ROOT,manifestPath),bindingsPath:path.relative(ROOT,bindingsPath),snapshotPath:path.relative(ROOT,snapshotPath),compiled,mode:diagnostic?'diagnostic':'candidate',outputDir:base,outputRoot:ROOT});
  const paths=new Set(['main.ray','start.novel','config.ini','docs/整合/interface-v1.json','docs/CG当前选择.json']);
  for(const dir of ['scenario','tools/compiler','tools/runtime','tools/integration/runtime','system/sui-u'])for(const p of walk(path.join(ROOT,dir)))paths.add(path.relative(ROOT,p));
  const titleCover=require('../../runtime/title-cover.cjs').load(ROOT);
  if(titleCover)for(const rel of titleCover.inputFiles)paths.add(rel);
  const cinema=require('../../runtime/cinema-theme.cjs').load(ROOT);
  if(cinema)for(const rel of cinema.inputFiles)paths.add(rel);
  for(const p of ['SDK/wasm/index.html','SDK/macos/suika3-pack','SDK/macos/root/bin/suika3','SDK/windows/suika3-win64.exe','SDK/windows/suika3-arm64.exe','system/font/NotoSansCJK-Medium.ttc','system/font/OFL.txt','sound/se/click.ogg'])paths.add(p);
  for(const line of fs.readFileSync(path.join(ROOT,'config.ini'),'utf8').split('\n')){if(!/^[a-z][^=]*=/.test(line))continue;const value=line.slice(line.indexOf('=')+1).trim();if(/\.(?:png|webp|anime|ogg|ttc|ttf)$/.test(value)){assert(value.startsWith('system/')||value==='sound/se/click.ogg','配置资源越界');paths.add(value);}}
  for(const entry of v.files)paths.add(entry.path);
  for(const p of [manifestPath,bindingsPath,snapshotPath])paths.add(path.relative(ROOT,p));
  for(const asset of v.assets){paths.add(asset.runtimePath);paths.add(asset.sourcePath);}
  const inputs=[...paths].sort().map(p=>{safe(p);const full=path.join(ROOT,p);assert(fs.realpathSync(full).startsWith(ROOT+path.sep),'输入链接越界：'+p);return {path:p,sha256:hash(full),bytes:fs.statSync(full).size};});
  const fingerprint=sha(JSON.stringify(inputs));
  const frozen=path.join(base,'input');
  fs.mkdirSync(frozen,{recursive:true});
  try{
    for(const entry of inputs){const dest=path.join(frozen,entry.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,entry.path),dest);}
    same(frozen,inputs);same(ROOT,inputs);
    write(path.join(base,'input-manifest.json'),{schemaVersion:1,version,mode:diagnostic?'diagnostic':'candidate',fingerprint,inputs});
    const frozenCompiled=compile({root:frozen,pageSize:108});assert.equal(frozenCompiled.ir.buildId,compiled.ir.buildId,'冻结后正文版本不一致');
    const fv=validate({root:frozen,manifestPath:path.relative(ROOT,manifestPath),bindingsPath:path.relative(ROOT,bindingsPath),snapshotPath:path.relative(ROOT,snapshotPath),compiled:frozenCompiled,mode:diagnostic?'diagnostic':'candidate',outputDir:base,outputRoot:ROOT});
    const buildOne=(platform,out)=>runtimeBuild({out,projectRoot:frozen,compiled:frozenCompiled,databasePrefix:diagnostic?'bijie-rain-suika3-i02-diagnostic:':'bijie-rain-suika3-v1:',integration:{diagnostic,extraFiles:producer?['tools/runtime/neutral.png']:[],assets:fv.assets,bindings:fv.bindingsList,fingerprint:sha(fingerprint+platform),adapt:args=>(producer?require('./i01-compose.cjs').integrateI01:integrate)({...args,assets:fv.assets,bindings:fv.bindingsList,rawBindings:fv.rawBindings,contract:frozenCompiled.ir.contract,resolvedBindings:fv.resolvedBindings,mode:diagnostic?'diagnostic':'candidate',sdkPlatform:platform})}});
    const webManifest=buildOne('wasm',path.join(base,'wasm'));
    const desktopManifest=buildOne('desktop',path.join(base,'desktop'));
    fs.mkdirSync(dist,{recursive:true});fs.cpSync(path.join(base,'wasm/web'),path.join(dist,'web'),{recursive:true});
    for(const [platform,exe]of [['macos','SDK/macos/root/bin/suika3'],['windows-x64','SDK/windows/suika3-win64.exe'],['windows-arm64','SDK/windows/suika3-arm64.exe']]){
      const dest=path.join(dist,platform);fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(path.join(base,'desktop/stage/assets.arc'),path.join(dest,'assets.arc'));
      fs.copyFileSync(path.join(frozen,exe),path.join(dest,platform==='macos'?'suika3':'suika3.exe'));
      if(platform==='macos'){fs.chmodSync(path.join(dest,'suika3'),0o755);write(path.join(dest,'启动.command'),'#!/bin/sh\ncd "$(dirname "$0")"\nexec ./suika3\n');fs.chmodSync(path.join(dest,'启动.command'),0o755);}
      else write(path.join(dest,'启动.bat'),'@echo off\r\ncd /d "%~dp0"\r\nsuika3.exe\r\n');
    }
    write(path.join(dist,'阅读说明.md'),`# ${diagnostic?'SUI-I02诊断包':'Suika3候选包'} ${version}\n\n范围：${fv.scope.description}。${diagnostic?'仅开发验证，不代表资源采用或完整整合。':''}\n\n网页：使用本机静态服务打开 web/。电脑：macOS运行启动.command，Windows选择对应架构运行启动.bat。电脑原生、手机真机与发布需另验。本包未签名或公证。\n\n两端来自同一输入快照，但WebP通道兼容策略按平台区分。两端存档构建身份不同，不互相导入。\n`);
    same(frozen,inputs);same(ROOT,inputs);
    const outputRecords=records(dist);
    const candidate={schemaVersion:1,task:'SUI-I02',version,mode:diagnostic?'diagnostic':'candidate',scope:fv.scope,complete:!diagnostic&&fv.complete,inputFingerprint:fingerprint,contentBuildId:frozenCompiled.ir.buildId,interfaceSha256:hash(path.join(frozen,v.interfacePath||'docs/整合/interface-v1.json')),producerHandoff:!fv.snapshot?.notProducerHandoff,handoff:{manifest:{path:path.relative(ROOT,manifestPath),sha256:hash(manifestPath)},bindings:{path:path.relative(ROOT,bindingsPath),sha256:hash(bindingsPath)},snapshot:{path:path.relative(ROOT,snapshotPath),sha256:hash(snapshotPath)}},runtimeBuildIds:{web:webManifest.runtimeBuildId,desktop:desktopManifest.runtimeBuildId},counts:{...frozenCompiled.manifest.counts,assets:fv.assets.length,bindings:fv.counts?.cues??fv.bindingsList.length,gallerySource:read(path.join(frozen,'system/sui-u/gallery.registry.json')).items.length},inputs,outputs:outputRecords,runtimeManifests:['wasm','desktop'].map(p=>({path:p+'/build-manifest.json',sha256:hash(path.join(base,p,'build-manifest.json'))})),generatedRuntime:['wasm','desktop'].flatMap(p=>['stage/main.ray','stage/start.novel','stage/config.ini','runtime-positions.json'].map(f=>({path:p+'/'+f,sha256:hash(path.join(base,p,f)),bytes:fs.statSync(path.join(base,p,f)).size}))),generated:{web:records(path.join(base,'wasm/generated')),desktop:records(path.join(base,'desktop/generated'))},verification:{inputStable:true,packaging:'passed',webBrowser:'未测',desktopNative:'未测',mobileDevice:'未测',release:'未执行'}};
    write(path.join(base,'candidate-manifest.json'),candidate);write(path.join(dist,'candidate-manifest.json'),candidate);
    console.log(JSON.stringify({version,mode:candidate.mode,build:path.relative(ROOT,base),dist:path.relative(ROOT,dist),inputFingerprint:fingerprint,runtimeBuildIds:candidate.runtimeBuildIds}));return candidate;
  }catch(error){write(path.join(base,'build-failure.json'),{status:'failed',message:error.message,version});throw error;}
}
if(require.main===module){try{const options={},args=process.argv.slice(2);while(args.length){const flag=args.shift();assert(['--version','--mode','--out','--manifest','--bindings','--snapshot'].includes(flag),'未知参数：'+flag);const value=args.shift();assert(value&&!value.startsWith('--'),'参数缺值：'+flag);options[flag.slice(2)]=value;}build(options);}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports={build};
