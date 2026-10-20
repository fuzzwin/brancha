import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {blank} from '../dist/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('live service captures completion, refreshes vault and exposes pause controls',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-service-')),vault=path.join(dir,'vault'),sessions=path.join(dir,'sessions'),configPath=path.join(dir,'config.json');fs.mkdirSync(vault);fs.mkdirSync(sessions);fs.writeFileSync(path.join(vault,'brancha.json'),JSON.stringify(blank()));fs.writeFileSync(configPath,JSON.stringify({vault,sessionsDirectory:sessions,port:51317,pollMs:50}));
 const child=spawn(process.execPath,[path.join(root,'companion/service.mjs'),configPath]);let output='',err='';child.stderr.on('data',b=>err+=b);
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Service readiness timeout: '+err)),4000);child.stdout.on('data',b=>{output+=b;if(output.includes('Brancha live:')){clearTimeout(timer);resolve();}});child.once('exit',c=>{clearTimeout(timer);reject(Error('Service exited '+c+': '+err));});});
 const base='http://127.0.0.1:51317',html=await(await fetch(base)).text(),token=html.match(/brancha-local-token" content="([a-f0-9]+)"/)[1],headers={'X-Brancha-Token':token};
 const get=async()=>await(await fetch(base+'/api/workspace',{headers})).json();
 const until=async check=>{for(let i=0;i<80;i++){const v=await get();if(check(v))return v;await new Promise(r=>setTimeout(r,25));}throw Error('Expected state missing: '+err);};
 const log=path.join(sessions,'live.jsonl');const record=turn=>JSON.stringify({type:'event_msg',payload:{type:'task_complete',turn_id:turn,last_agent_message:'Finished a service integration check.\nNext: inspect the generated vault.'}})+'\n';fs.writeFileSync(log,JSON.stringify({type:'session_meta',payload:{id:'live',cwd:dir,source:'cli'}})+'\n'+record('first'));
 const live=await until(v=>v.capture?.lastCaptureId);assert.equal(live.workspace.events.length,1);assert.equal(live.capture.lastProjectId,'codex_inbox');assert(fs.readFileSync(path.join(vault,'Generated/Resume/codex_inbox.md'),'utf8').includes('Finished a service integration check'));assert(fs.existsSync(path.join(vault,'Generated/Dashboards/codex_inbox.md')));assert(fs.readFileSync(path.join(vault,'Generated/Diagrams/codex_inbox-mindmap.svg'),'utf8').includes('pele-mindmap'));
 const oldAssets=JSON.parse(fs.readFileSync(path.join(vault,'.brancha/generated-assets.json'))).files;const unrelated=path.join(vault,'Generated/Diagrams/unrelated.svg');fs.writeFileSync(unrelated,'A fictional manual asset that must be preserved.');
 const toggle=async paused=>{const r=await fetch(base+'/api/capture',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({paused})});assert.equal(r.status,200);};
 await toggle(true);fs.appendFileSync(log,record('paused'));const scan=JSON.parse(fs.readFileSync(path.join(vault,'.brancha/codex-cursors.json'))).files[log].offset;await until(v=>{const c=JSON.parse(fs.readFileSync(path.join(vault,'.brancha/codex-cursors.json'))).files[log];return c.offset>scan;});await toggle(false);fs.appendFileSync(log,record('second'));const second=await until(v=>v.workspace.events.length===2);assert.equal(second.capture.paused,false);assert.equal(second.workspace.nodes.length,1);assert(second.workspace.events.every(e=>e.capture.capture.turnId!=='paused'));
 const newAssets=JSON.parse(fs.readFileSync(path.join(vault,'.brancha/generated-assets.json'))).files,obsolete=oldAssets.filter(name=>!newAssets.includes(name));assert(obsolete.length>0);for(const name of obsolete)assert(!fs.existsSync(path.join(vault,'Generated',name)));assert(fs.existsSync(unrelated));
 assert.equal((await fetch(base+'/api/capture',{method:'POST',headers:{...headers,Origin:'https://example.com'},body:'{"paused":true}'})).status,403);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
});

test('portable companion starts without Codex installed and generates views',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-portable-service-')),vault=path.join(dir,'vault'),configPath=path.join(dir,'config.json');
 fs.writeFileSync(configPath,JSON.stringify({vault,captureEnabled:false,port:51318}));
 const child=spawn(process.execPath,[path.join(root,'companion/service.mjs'),configPath]);let output='',err='';child.stderr.on('data',b=>err+=b);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Readiness timeout: '+err)),4000);child.stdout.on('data',b=>{output+=b;if(output.includes('Brancha live:')){clearTimeout(timer);resolve();}});child.once('exit',c=>{clearTimeout(timer);reject(Error('Exited '+c+': '+err));});});
  const html=await(await fetch('http://127.0.0.1:51318')).text(),token=html.match(/brancha-local-token" content="([a-f0-9]+)"/)[1];
  const state=await(await fetch('http://127.0.0.1:51318/api/workspace',{headers:{'x-brancha-token':token}})).json();
  assert.equal(state.capture.enabled,false);assert.equal(state.capture.adapter,'portable-checkpoint');assert(fs.existsSync(path.join(vault,'Generated','Records.md')));assert(!fs.existsSync(path.join(vault,'.brancha','codex-cursors.json')));
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
});
