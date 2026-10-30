'use strict';
// Optional adopted title art. Original SUI-U files remain intact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const MANIFEST='system/sui-title/manifest.json';
function load(root){
  const manifestFile=path.join(root,MANIFEST);
  if(!fs.existsSync(manifestFile))return null;
  const m=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(m.schemaVersion,1);assert.equal(m.approval.status,'approved');
  assert.deepEqual(m.canvas,[1280,720]);
  assert(m.gui.startsWith('system/sui-title/'));
  const entries=[m.source,...m.resources,...m.archiveFiles,...(m.motion?[m.motion,m.motion.source]:[])];
  if(m.motion){
    assert.equal(m.motion.platform,'web');assert(m.motion.path.startsWith('assets/current/title/')&&m.motion.path.endsWith('.mp4'));
    assert.deepEqual(m.motion.canvas,m.canvas);assert.equal(m.motion.muted,true);assert.equal(m.motion.loop,true);
  }
  for(const e of entries){
    assert(!path.isAbsolute(e.path)&&!e.path.split('/').includes('..'));
    const p=path.join(root,e.path);assert(fs.realpathSync(p).startsWith(root+path.sep));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),e.sha256,'封面文件指纹不符：'+e.path);
  }
  assert(m.resources.every(e=>e.path.startsWith('assets/current/title/')));
  assert(fs.existsSync(path.join(root,m.gui)));
  return {...m,manifestPath:MANIFEST,inputFiles:[MANIFEST,m.gui,...entries.map(e=>e.path)]};
}
module.exports={load};
