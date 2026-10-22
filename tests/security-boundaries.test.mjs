import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {blank,validate,vaultFiles,activityDate,validateExportPath} from '../dist/core.mjs';
import {zip} from '../dist/zip.mjs';
import {atomic,containedPath} from '../skills/brancha/scripts/storage.mjs';
import {acquireLock} from '../skills/brancha/scripts/locking.mjs';
import {capture,paths} from '../adapters/capture.mjs';
import {setChatPermission,workspaceEtag} from '../adapters/chat-privacy.mjs';
import {CodexWatcher} from '../adapters/codex-watch.mjs';
import {localTools} from '../adapters/local-tools.mjs';
import {pullCloud} from '../adapters/cloud-pull.mjs';
import {connectCloud} from '../scripts/connect-cloud.mjs';
import {startServer} from '../companion/server.mjs';

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'branchi-security-')),vault=path.join(dir,'vault'),sessionsDirectory=path.join(dir,'sessions');fs.mkdirSync(sessionsDirectory);
 const config={vault,sessionsDirectory,captureEnabled:true,capturePolicy:{approvedSessionIds:['chat']},sessionProjects:{chat:'a'}},w=blank();
 for(const id of ['a','b']){w.projects.push({id,title:'Fictional '+id,prompt:'Preserve fictional scope '+id,createdAt:'2026-10-20T00:00:00Z',criteria:[]});w.nodes.push({id:'goal_'+id,projectId:id,title:'Goal '+id,type:'goal',status:'active',criteria:[]});}
 atomic(paths(config).file,w);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,config,w,read:()=>JSON.parse(fs.readFileSync(paths(config).file,'utf8'))};
}
const input={sessionId:'chat',turnId:'one',message:'A fictional response with pending verification.',git:null};
const line=r=>JSON.stringify(r)+'\n';
const meta={type:'session_meta',payload:{id:'chat',source:'cli'}};
const complete=(turn,at)=>({type:'event_msg',...(at?{timestamp:at}:{}),payload:{type:'task_complete',turn_id:turn,last_agent_message:input.message}});

test('legacy timestamps normalize to safe UTC filenames and cannot overwrite sibling files',t=>{
 const f=fixture(t),bad='../../../2020-01-01',victim=path.join(f.dir,'2.md');fs.writeFileSync(victim,'Preserve this sibling');
 f.w.events.push({id:'history',projectId:'a',nodeId:null,at:bad,text:'Fictional imported history'});validate(f.w);atomic(paths(f.config).file,f.w);
 const files=vaultFiles(f.w);assert(files['Activity/'+activityDate(bad)+'.md']);assert(Object.keys(files).every(k=>!k.includes('../')));
 const instance=startServer({vault:f.config.vault,listen:false});instance.stop();assert.equal(fs.readFileSync(victim,'utf8'),'Preserve this sibling');
 assert.equal(activityDate('2026-10-21T01:00:00+11:00'),'2026-10-20');
 for(const name of ['../outside.md','/outside.md','C:/outside.md','a\\..\\outside.md','a//b.md','a/CON.md','a/b.']){assert.throws(()=>validateExportPath(name),/export path/);assert.throws(()=>zip({[name]:'fictional'}),/export path/);}
});

test('generated output rejects symbolic-link and junction components',t=>{
 const f=fixture(t),outside=path.join(f.dir,'outside');fs.mkdirSync(outside);const root=path.join(f.dir,'export');fs.mkdirSync(root);
 fs.symlinkSync(outside,path.join(root,'Activity'),process.platform==='win32'?'junction':'dir');
 assert.throws(()=>containedPath(root,'Activity/2026-10-20.md'),/symbolic link/);assert.equal(fs.readdirSync(outside).length,0);
});

test('browser rejects a stale filtered save after inclusion, retaining hidden history',async t=>{
 const f=fixture(t);capture(f.config,input);setChatPermission(f.config,'chat','exclude');
 const instance=startServer({vault:f.config.vault,port:51431,config:f.config});await once(instance.server,'listening');
 try{
  const base='http://127.0.0.1:51431',html=await(await fetch(base)).text(),token=html.match(/brancha-local-token" content="([a-f0-9]+)"/)[1],headers={'x-brancha-token':token};
  const stale=await(await fetch(base+'/api/workspace',{headers})).json(),before=fs.readFileSync(paths(f.config).file,'utf8');
  setChatPermission(f.config,'chat','include');stale.workspace.revision++;
  const response=await fetch(base+'/api/workspace',{method:'PUT',headers:{...headers,'content-type':'application/json','if-match':stale.etag},body:JSON.stringify(stale.workspace)});
  assert.equal(response.status,409);assert.equal(fs.readFileSync(paths(f.config).file,'utf8'),before);
 }finally{const closed=once(instance.server,'close');instance.stop();instance.server.closeAllConnections();await closed;}
});

test('MCP rejects permission changes between its snapshot and write',async t=>{
 const f=fixture(t);capture(f.config,input);setChatPermission(f.config,'chat','exclude');
 const before=fs.readFileSync(paths(f.config).file,'utf8'),etag=workspaceEtag(f.config,before),call=localTools(f.config),original=crypto.subtle.digest;
 let switched=false;
 crypto.subtle.digest=function(...args){if(!switched){switched=true;setChatPermission(f.config,'chat','include');}return original.apply(this,args);};
 try{await assert.rejects(call('brancha_checkpoint',{projectId:'a',expectedRevision:f.read().revision,requestId:'fixture',title:'New report',summary:'A fictional report for the selected project.',next:'Check it.'}),/Revision conflict/);}
 finally{crypto.subtle.digest=original;}
 assert(switched);assert.notEqual(workspaceEtag(f.config,before),etag);assert.equal(fs.readFileSync(paths(f.config).file,'utf8'),before);
});

test('inclusion between scans and watcher restart skip pre-consent and partial records',t=>{
 const f=fixture(t);f.config.capturePolicy.approvedSessionIds=[];let watcher=new CodexWatcher(f.config);const file=path.join(f.config.sessionsDirectory,'chat.jsonl');
 fs.writeFileSync(file,line(meta)+line(complete('old','2020-01-01T00:00:00Z'))+JSON.stringify(complete('partial')).slice(0,35));
 setChatPermission(f.config,'chat','include');watcher=new CodexWatcher(f.config);
 fs.appendFileSync(file,JSON.stringify(complete('partial')).slice(35)+'\n'+line(complete('future',new Date(Date.now()+1000).toISOString())));watcher.poll();
 assert.deepEqual(f.read().events.map(e=>e.capture.capture.turnId),['future']);
 setChatPermission(f.config,'chat','exclude');fs.appendFileSync(file,line(complete('excluded')));setChatPermission(f.config,'chat','include');watcher.poll();assert.equal(f.read().events.length,1);
 fs.appendFileSync(file,line(complete('next',new Date(Date.now()+1000).toISOString())));watcher.poll();assert.equal(f.read().events.length,2);
});

test('rebinding retains prior project sources and manual relationships',t=>{
 const f=fixture(t),first=capture(f.config,input);let w=f.read();w.edges.push({id:'manual',from:'goal_b',to:first.nodeId,type:'informs'});atomic(paths(f.config).file,w);
 setChatPermission(f.config,'chat','include',{projectId:'b'});const second=capture(f.config,{...input,turnId:'two'});w=f.read();
 assert.notEqual(first.nodeId,second.nodeId);assert.equal(w.nodes.find(n=>n.id===first.nodeId).projectId,'a');assert.equal(w.nodes.find(n=>n.id===second.nodeId).projectId,'b');
 assert(w.edges.some(e=>e.id==='manual'));assert(w.edges.some(e=>e.from==='goal_b'&&e.to===second.nodeId));assert(!w.edges.some(e=>e.from==='goal_a'&&e.to===second.nodeId));
});

test('renewed consent rejects durable queued turns without trustworthy timestamps',t=>{
 const f=fixture(t),file=path.join(f.config.sessionsDirectory,'chat.jsonl');let watcher=new CodexWatcher(f.config);
 fs.writeFileSync(paths(f.config).file+'.lock','');fs.writeFileSync(file,line(meta)+line(complete('queued-before-renewal')));watcher.poll();assert.equal(watcher.data.queue.length,1);
 fs.unlinkSync(paths(f.config).file+'.lock');setChatPermission(f.config,'chat','exclude');setChatPermission(f.config,'chat','include');watcher=new CodexWatcher(f.config);watcher.poll();assert.equal(f.read().events.length,0);assert.equal(watcher.data.queue.length,0);
 fs.appendFileSync(file,line(complete('new-after-renewal')));watcher.poll();assert.deepEqual(f.read().events.map(e=>e.capture.capture.turnId),['new-after-renewal']);
});

const worker=fileURLToPath(new URL('./fixtures/lock-worker.mjs',import.meta.url));
function lockChild(t,args){
 const child=spawn(process.execPath,[worker,...args]),timer=setTimeout(()=>child.kill('SIGKILL'),50000);child.once('exit',()=>clearTimeout(timer));
 t.after(async()=>{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}});return child;
}
test('dead-owner lock recovery follows process exit and never steals live or legacy locks',async t=>{
 const f=fixture(t),child=lockChild(t,[f.dir]);let output='';await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.on('data',b=>{output+=b;if(output.includes('held'))resolve();});child.once('exit',c=>reject(Error('Worker exited '+c)));});
 const lock=path.join(f.dir,'workspace.lock');assert.throws(()=>acquireLock(lock),e=>e.code==='EEXIST');
 child.kill('SIGTERM');await once(child,'exit');const release=acquireLock(lock);release();assert(!fs.existsSync(lock));
 fs.writeFileSync(lock,'');assert.throws(()=>acquireLock(lock),e=>e.code==='EEXIST');assert.equal(fs.readFileSync(lock,'utf8'),'');
});

test('concurrent processes serialize updates with no recovery sentinel or lost writes',async t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.dir,'count'),'0');
 const children=Array.from({length:5},()=>lockChild(t,[f.dir,'stress']));
 const results=await Promise.all(children.map(child=>new Promise((resolve,reject)=>{let error='';child.stderr.on('data',b=>error+=b);child.once('error',reject);child.once('exit',code=>code===0?resolve(code):reject(Error(error)));})));
 assert.equal(results.length,5);assert.equal(fs.readFileSync(path.join(f.dir,'count'),'utf8'),'100');assert(!fs.existsSync(path.join(f.dir,'workspace.lock')));
});

test('cloud pull rejects cross-origin credential redirects without contacting their destination',async t=>{
 const f=fixture(t),connectionFile=path.join(f.dir,'connection.json');fs.writeFileSync(connectionFile,JSON.stringify({url:'https://fictional.example',siteBearer:'FAKE_SITE',bridgeToken:'FAKE_BRIDGE'}));let leaked=false;
 const target=http.createServer((req,res)=>{leaked=true;res.end('{}');});target.listen(0,'127.0.0.1');await once(target,'listening');
 const source=http.createServer((req,res)=>{res.writeHead(302,{location:'http://127.0.0.1:'+target.address().port});res.end();});source.listen(0,'127.0.0.1');await once(source,'listening');
 try{await assert.rejects(pullCloud({...f.config,cloud:{connectionFile}},(url,options)=>{assert.equal(options.redirect,'error');return fetch('http://127.0.0.1:'+source.address().port,options);}));assert.equal(leaked,false);}
 finally{source.closeAllConnections();target.closeAllConnections();await Promise.all([new Promise(r=>source.close(r)),new Promise(r=>target.close(r))]);}
});

test('cloud connection rejects authentication and seed redirects without saving credentials',async t=>{
 const f=fixture(t),configFile=path.join(f.dir,'config.json'),seedFile=path.join(f.dir,'fictional-seed.json');atomic(configFile,{vault:f.config.vault});atomic(seedFile,f.w);let hits=0;
 const target=http.createServer((req,res)=>{hits++;res.end('{}');});target.listen(0,'127.0.0.1');await once(target,'listening');
 const source=http.createServer((req,res)=>{res.writeHead(307,{location:'http://127.0.0.1:'+target.address().port});res.end();});source.listen(0,'127.0.0.1');await once(source,'listening');
 const value={url:'https://fictional.example',siteBearer:'FAKE_SITE',bridgeToken:'FAKE_BRIDGE',seedFile},before=fs.readFileSync(configFile,'utf8');
 try{for(const phase of ['authentication','seed']){
  await assert.rejects(connectCloud(configFile,value,(url,options)=>phase==='seed'&&url.pathname==='/api/workspace'?Promise.resolve({ok:true,json:async()=>({workspace:blank()})}):fetch('http://127.0.0.1:'+source.address().port,options)));
  assert.equal(hits,0);assert.equal(fs.readFileSync(configFile,'utf8'),before);assert(!fs.existsSync(path.join(f.dir,'cloud-connection.json')));
 }}finally{source.closeAllConnections();target.closeAllConnections();await Promise.all([new Promise(r=>source.close(r)),new Promise(r=>target.close(r))]);}
});
