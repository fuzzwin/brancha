import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {blank} from '../dist/core.mjs';
import {capture,atomic,paths} from '../adapters/capture.mjs';
import {setChatPermission,captureBoundary,privacyFingerprint} from '../adapters/chat-privacy.mjs';
import {browserReceipt} from '../adapters/browser-receipt.mjs';
import {MappingIntake} from '../adapters/mapping-intake.mjs';
import {desktopHook,drainDesktopHooks} from '../adapters/desktop-hook.mjs';
import {claudeHook} from '../adapters/claude-hook.mjs';
import {ConversationMapper,applyMappedProposals} from '../adapters/conversation-mapper.mjs';
import {ProjectReviewer} from '../adapters/project-reviewer.mjs';
import {queueReceipt,drainReceipts} from '../adapters/external-inbox.mjs';
import {ingestCheckpoint} from '../adapters/checkpoint.mjs';
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'branchi-consent-')),config={vault:path.join(dir,'vault'),sessionsDirectory:path.join(dir,'sessions'),captureEnabled:true,capturePolicy:{approvedSessionIds:['chat']},sessionProjects:{chat:'a'},mapper:{enabled:true,debounceMs:0,maxCallsPerDay:10,maxHighPerDay:10},reviewer:{enabled:true,maxCallsPerDay:10,catchUpAfterMs:0}},w=blank();fs.mkdirSync(config.sessionsDirectory);for(const id of ['a','b']){w.projects.push({id,title:'Fictional '+id,prompt:'Keep the fictional scope.',createdAt:'2026-10-20T00:00:00Z',criteria:[]});w.nodes.push({id:'goal_'+id,projectId:id,title:'Goal',type:'goal',status:'active',criteria:[]});}atomic(paths(config).file,w);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {config,read:()=>JSON.parse(fs.readFileSync(paths(config).file,'utf8'))};}
const input={sessionId:'chat',turnId:'turn',message:'A fictional report with pending verification.',messages:[{role:'user',text:'Please test the fictional watering tray.'}],git:null,permissionEpoch:null,adapter:'codex-session-watch'};
const result=p=>({value:{needsReview:false,reason:'Fictional quoted request',items:[{key:'task',kind:'task',title:'Test the tray',detail:'Run the requested fictional test.',sourceId:p.messages[0].id,quote:p.messages[0].text}],relations:[]},receipt:{reasoningEffort:'low'}});
const renew=config=>{setChatPermission(config,'chat','exclude');setChatPermission(config,'chat','include');};
const jobFor=m=>JSON.parse(fs.readFileSync(path.join(m.jobs,fs.readdirSync(m.jobs)[0]),'utf8'));

test('renewed consent prevents pending mapper transmission and persisted ready application',async t=>{
 for(const ready of [false,true]){const f=fixture(t);capture(f.config,input);let calls=0;const m=new ConversationMapper(f.config,{runner:async p=>{calls++;return result(p);}});m.enqueue(input);if(ready){const j=jobFor(m);j.state='ready';j.result=result({messages:j.messages}).value;atomic(path.join(m.jobs,j.id+'.json'),j);}renew(f.config);await m.tick();assert.equal(calls,0);assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);assert.equal(jobFor(m).state,'excluded');}
});
test('revocation during Low prevents High transmission and all proposal writes',async t=>{
 const f=fixture(t);capture(f.config,input);let calls=0;const m=new ConversationMapper(f.config,{runner:async p=>{calls++;await Promise.resolve();setChatPermission(f.config,'chat','exclude');return {...result(p),value:{...result(p).value,needsReview:true}};}});m.enqueue(input);await m.tick();assert.equal(calls,1);assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);
});
test('renewal during a model call rejects its result even when inclusion is currently true',async t=>{
 const f=fixture(t);capture(f.config,input);const m=new ConversationMapper(f.config,{runner:async p=>{await Promise.resolve();renew(f.config);return result(p);}});m.enqueue(input);await m.tick();assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);
});
test('permission change immediately before canonical acquire blocks mapper application',t=>{
 const f=fixture(t);capture(f.config,input);const m=new ConversationMapper(f.config);m.enqueue(input);const job={...jobFor(m),permissionFingerprint:privacyFingerprint(f.config)},original=fs.mkdirSync;let armed=true;
 fs.mkdirSync=function(directory,...args){if(armed&&directory===paths(f.config).file+'.lock'){armed=false;setChatPermission(f.config,'chat','exclude');}return original.call(this,directory,...args);};
 try{assert.equal(applyMappedProposals(f.config,job,result({messages:job.messages}).value,'a').excluded,true);}finally{fs.mkdirSync=original;}
 assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);
});
test('delayed mapping stays with the immutable captured project after chat rebinding',async t=>{
 const f=fixture(t),accepted=capture(f.config,input);const m=new ConversationMapper(f.config,{runner:async p=>result(p)});m.enqueue(input);setChatPermission(f.config,'chat','include',{projectId:'b'});await m.tick();const w=f.read();assert(w.nodes.filter(n=>n.mapper).every(n=>n.projectId==='a'));assert.equal(w.nodes.filter(n=>n.mapper).length,1);assert(w.edges.some(e=>e.from===accepted.nodeId&&w.nodes.find(n=>n.id===e.to)?.mapper));
});
test('renewed consent blocks reviewer pending jobs and persisted ready runs',async t=>{
 for(const ready of [false,true]){const f=fixture(t);capture(f.config,input);const m=new ConversationMapper(f.config);m.enqueue(input);const job=jobFor(m);let calls=0;const reviewer=new ProjectReviewer(f.config,{runner:async p=>{calls++;return result(p);}});
  if(ready){atomic(path.join(reviewer.root,'runs','saved.json'),{id:'saved',state:'ready',startedAt:new Date().toISOString(),projectId:'a',jobs:[job],packet:{messages:job.messages},value:result({messages:job.messages}).value,receipt:{},backlog:0});}
  renew(f.config);await reviewer.run();assert.equal(calls,0);assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);
 }
});
test('queued automatic receipts do not cross renewal; explicit historical submission is accepted now',t=>{
 const f=fixture(t),cp={version:1,provider:'claude-code',sessionId:'chat',eventId:'old',projectId:'a',title:'Fictional report',summary:'A fictional older report deliberately submitted.',next:'Review its evidence.',at:'2020-01-01T00:00:00Z'};queueReceipt(f.config,cp);renew(f.config);drainReceipts(f.config);assert.equal(f.read().nodes.filter(n=>n.checkpoint).length,0);
 const accepted=ingestCheckpoint(f.config,{...cp,eventId:'explicit-now'},f.read().revision);assert(accepted.captured);const provenance=f.read().nodes.find(n=>n.id===accepted.nodeId).checkpoint;assert.equal(provenance.permissionEpoch,captureBoundary(f.config,'chat').epoch);assert(Number.isFinite(Date.parse(provenance.acceptedAt)));assert.equal(provenance.at,'2020-01-01T00:00:00.000Z');
});

test('contended dispatch consumes no mapper/reviewer budget and resumes once the lock clears',async t=>{
 for(const kind of ['mapper','reviewer']){const f=fixture(t);capture(f.config,input);let calls=0;const m=new ConversationMapper(f.config,{runner:async p=>{calls++;return result(p);}});m.enqueue(input);const worker=kind==='mapper'?m:new ProjectReviewer(f.config,{runner:async p=>{calls++;return result(p);}});fs.writeFileSync(paths(f.config).file+'.lock','held');for(let i=0;i<3;i++)await(kind==='mapper'?worker.tick():worker.run());assert.equal(calls,0);assert(!fs.existsSync(path.join(worker.root,'budget.json'))||JSON.parse(fs.readFileSync(path.join(worker.root,'budget.json'))).calls===0);fs.unlinkSync(paths(f.config).file+'.lock');await(kind==='mapper'?worker.tick():worker.run());assert.equal(calls,1);}
});
test('intake never stamps renewed consent onto older saved reports',t=>{
 const f=fixture(t);capture(f.config,input);renew(f.config);const m=new ConversationMapper(f.config),intake=new MappingIntake(f.config,m);intake.tick();assert.equal(fs.readdirSync(m.jobs).length,0);assert.equal(m.enqueue({...input,permissionEpoch:undefined}),false);
});
test('legacy ready model output without a permission snapshot requires review',async t=>{
 const f=fixture(t);capture(f.config,input);const m=new ConversationMapper(f.config);m.enqueue(input);const job=jobFor(m),reviewer=new ProjectReviewer(f.config,{runner:async()=>{throw Error('Must not invoke');}});atomic(path.join(reviewer.root,'runs','legacy.json'),{id:'legacy',state:'ready',startedAt:new Date().toISOString(),projectId:'a',jobs:[job],packet:{messages:job.messages,context:[{title:'FICTIONAL_EXCLUDED_CONTEXT'}]},value:{...result({messages:job.messages}).value,reason:'FICTIONAL_EXCLUDED_CONTEXT'},receipt:{},backlog:0});setChatPermission(f.config,'other-chat','exclude');assert.equal((await reviewer.run()).skipped,'legacy result requires review');assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);assert(!fs.existsSync(path.join(f.config.vault,'Notes')));
});
test('browser outbox packets retain their original activation epoch',t=>{
 const f=fixture(t),url='https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',first=browserReceipt(f.config,{op:'activate',url,projectId:'a'}),packet={op:'capture',url,permissionEpoch:first.permissionEpoch,turnKey:'old',request:'Please check the fictional tray.',summary:'A fictional visible response.'};browserReceipt(f.config,{op:'deactivate',url});const next=browserReceipt(f.config,{op:'activate',url,projectId:'a'});assert.equal(browserReceipt(f.config,packet).reason,'before-consent');assert(browserReceipt(f.config,{...packet,turnKey:'new',permissionEpoch:next.permissionEpoch}).captured);
});
test('desktop and Claude staged prompts cannot cross renewed inclusion',t=>{
 for(const kind of ['desktop','claude']){const f=fixture(t),hook=kind==='desktop'?desktopHook:claudeHook,prompt={hook_event_name:'UserPromptSubmit',session_id:'chat',turn_id:'turn',prompt_id:'prompt',prompt:'Please check the fictional tray.'};hook(f.config,prompt);renew(f.config);hook(f.config,{hook_event_name:'Stop',session_id:'chat',turn_id:'turn',last_assistant_message:'A fictional visible response with pending verification.'});drainDesktopHooks(f.config);drainReceipts(f.config);assert.equal(f.read().events.length,0);}
});
test('a contended or paused High dispatch resumes High once without repeating Low or charging waits',async t=>{
 for(const block of ['lock','pause']){const f=fixture(t);capture(f.config,input);const efforts=[],m=new ConversationMapper(f.config,{runner:async(p,o)=>{efforts.push(o.effort);await Promise.resolve();if(o.effort==='low'){if(block==='lock')fs.writeFileSync(paths(f.config).file+'.lock','held');else atomic(paths(f.config).control,{paused:true});}return {...result(p),value:{...result(p).value,needsReview:o.effort==='low'}};}});m.enqueue(input);await m.tick();assert.deepEqual(efforts,['low']);let budget=JSON.parse(fs.readFileSync(path.join(m.root,'budget.json')));assert.equal(budget.calls,1);assert.equal(budget.high,0);assert.equal(f.read().nodes.filter(n=>n.mapper).length,0);if(block==='lock')fs.unlinkSync(paths(f.config).file+'.lock');else atomic(paths(f.config).control,{paused:false});await m.tick();assert.deepEqual(efforts,['low','high']);assert.equal(f.read().nodes.filter(n=>n.mapper).length,1);budget=JSON.parse(fs.readFileSync(path.join(m.root,'budget.json')));assert.equal(budget.calls,2);assert.equal(budget.high,1);}
});
