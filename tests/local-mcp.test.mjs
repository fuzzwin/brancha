import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {blank,demo} from '../dist/core.mjs';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {localTools} from '../adapters/local-tools.mjs';
import {capture} from '../adapters/capture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-mcp-')),config={vault:path.join(dir,'vault'),captureEnabled:false,capturePolicy:{mode:'approved',approvedSessionIds:['new-chat']}},file=path.join(dir,'config.json');atomic(file,config);return {dir,config,file};};

test('local MCP tools support fresh projects, independent clients, safe retries and concurrent conflicts',async()=>{
 const f=fixture(),one=localTools(f.config),two=localTools(f.config);
 assert.equal((await one('brancha_projects')).revision,0);
 const args={title:'A fictional project',originalRequest:'Preserve the original request.',criteria:['Observable result'],expectedRevision:0,requestId:'start-project'};
 const created=await one('brancha_create_project',args);assert((await two('brancha_create_project',args)).duplicate);
 const cp={projectId:created.projectId,expectedRevision:created.revision,requestId:'first-result',title:'Prepared a draft',summary:'The draft is ready for testing.',next:'Test it.'};
 const result=await one('brancha_checkpoint',cp);assert((await two('brancha_checkpoint',cp)).duplicate);
 await assert.rejects(()=>two('brancha_checkpoint',{...cp,requestId:'other-client'}),/Revision/);
 const brief=await two('brancha_resume',{projectId:created.projectId});assert(brief.brief.includes(cp.summary));
 const simultaneous=await Promise.allSettled([one('brancha_checkpoint',{...cp,expectedRevision:result.revision,requestId:'parallel1'}),two('brancha_checkpoint',{...cp,expectedRevision:result.revision,requestId:'parallel2'})]);
 assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1);assert.equal(simultaneous.filter(r=>r.status==='rejected').length,1);
 const w=JSON.parse(fs.readFileSync(path.join(f.config.vault,'brancha.json')));assert(w.nodes.every(n=>n.cloudOrigin===false));assert(w.nodes.every(n=>n.criteria.length===0));assert.equal(w.projects[0].prompt,args.originalRequest);
 atomic(path.join(f.config.vault,'.brancha','control.json'),{paused:true});await assert.rejects(()=>one('brancha_checkpoint',{...cp,expectedRevision:w.revision,requestId:'paused'}),/paused/);assert.equal((await one('brancha_projects')).revision,w.revision);
});

test('stdio MCP negotiates, exposes four project tools plus one capture receipt tool, writes and resumes without a browser or Codex folder',async()=>{
 const f=fixture(),child=spawn(process.execPath,[path.join(root,'scripts/mcp.mjs'),f.file]);let buffer='',err='';const pending=new Map();
 child.stderr.on('data',chunk=>err+=chunk);child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);const m=JSON.parse(line);pending.get(m.id)?.(m);pending.delete(m.id);}});
 let id=0;const rpc=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout: '+err));},5000);pending.set(key,m=>{clearTimeout(timer);resolve(m);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 try{
  assert.equal((await rpc('tools/list')).error.code,-32002);
  const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'fictional-client',version:'1'}});assert.equal(init.result.protocolVersion,'2025-06-18');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');assert.equal((await rpc('tools/list')).result.tools.length,5);
  const created=await rpc('tools/call',{name:'brancha_create_project',arguments:{title:'Fixture',originalRequest:'A testable local project.',criteria:['Check it'],expectedRevision:0,requestId:'fixture-start'}});assert(!created.result.isError);const projectId=created.result.structuredContent.projectId;
  assert((await rpc('tools/call',{name:'brancha_resume',arguments:{projectId}})).result.structuredContent.brief.includes('A testable local project.'));
  assert.equal((await rpc('missing-method')).error.code,-32601);
  const json=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/mcp-config.mjs'),'json',f.file],{encoding:'utf8'}));assert.deepEqual(json.mcpServers.brancha.args,[path.join(root,'scripts/mcp.mjs'),f.file]);
  child.stdin.end();await new Promise(resolve=>child.once('exit',resolve));assert.equal(child.exitCode,0);
 }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
});


test('first real MCP project replaces only the demo and is safe from later automatic capture',async()=>{
 const f=fixture(),w=demo();atomic(path.join(f.config.vault,'brancha.json'),w);const call=localTools(f.config);
 const made=await call('brancha_create_project',{title:'Real fixture',originalRequest:'Preserve this new request.',criteria:['A checked outcome'],expectedRevision:w.revision,requestId:'first-real'});
 const saved=JSON.parse(fs.readFileSync(path.join(f.config.vault,'brancha.json')));assert.equal(saved.demo,false);assert.equal(saved.projects.length,1);assert.equal(saved.projects[0].id,made.projectId);
 assert(capture({...f.config,captureEnabled:true},{sessionId:'new-chat',turnId:'first',message:'A new automatic report that must preserve the real project.'}).captured);assert(JSON.parse(fs.readFileSync(path.join(f.config.vault,'brancha.json'))).projects.some(p=>p.id===made.projectId));
});
