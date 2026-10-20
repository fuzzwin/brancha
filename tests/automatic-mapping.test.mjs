import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {blank,validate} from '../dist/core.mjs';
import {atomic,paths} from '../adapters/capture.mjs';
import {ingestCheckpoint} from '../adapters/checkpoint.mjs';
import {ConversationMapper} from '../adapters/conversation-mapper.mjs';
import {MappingIntake} from '../adapters/mapping-intake.mjs';
import {ProjectReviewer} from '../adapters/project-reviewer.mjs';
import {localTools} from '../adapters/local-tools.mjs';
import {chatCatalog,chatData} from '../companion/chats.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-auto-map-')),config={vault:path.join(dir,'vault'),captureEnabled:false,capturePolicy:{mode:'approved',approvedSessionIds:['external_chat']},sessionProjects:{external_chat:'other'},mapper:{enabled:true,debounceMs:0},reviewer:{enabled:true,maxCallsPerDay:2,catchUpAfterMs:0}};
 const w=blank();w.projects=['project','other'].map(id=>({id,title:id,prompt:'Original intent '+id,createdAt:new Date().toISOString(),criteria:[]}));w.nodes=[{id:'goal',projectId:'project',title:'Original goal',type:'goal',status:'active',criteria:[]}];atomic(paths(config).file,w);
 return {dir,config,read:()=>validate(JSON.parse(fs.readFileSync(paths(config).file,'utf8')))};
}
const receipt={version:1,provider:'claude',sessionId:'external_chat',eventId:'receipt1',projectId:'project',title:'Next physical test',request:'Print the small test piece before the full stand.',summary:'Keep the test separate from the full build. The test piece has not been printed.',next:'Print and inspect the small test piece.'};
const answer=p=>({value:{needsReview:true,reason:'Physical acceptance remains unconfirmed.',items:[{key:'test',kind:'task',title:'Print the small test piece',detail:'Prepare the requested test, then inspect it.',sourceId:p.messages[0].id,quote:p.messages[0].text}],relations:[]},receipt:{requestedModel:'gpt-6-luna',reasoningEffort:'low',usage:{input_tokens:10,output_tokens:10}}});

test('portable saved receipts automatically map tasks and preserve exact project, chat and source without completion',async()=>{
 const f=fixture(),saved=ingestCheckpoint(f.config,receipt,0);let calls=0;
 const mapper=new ConversationMapper({...f.config,mapper:{...f.config.mapper,maxHighPerDay:0}},{runner:async p=>{calls++;return answer(p);}}),intake=new MappingIntake(f.config,mapper);
 assert.equal(intake.tick().queued,1);assert.equal(intake.tick().skipped,'unchanged');await mapper.tick();await mapper.tick();
 const w=f.read(),n=w.nodes.find(n=>n.mapper);assert.equal(calls,1);assert.equal(n.type,'task');assert.equal(n.status,'planned');assert.equal(n.projectId,'project');assert.equal(n.mapper.provider,'claude');assert.equal(n.mapper.needsReview,true);assert.equal(n.mapper.quote,receipt.request);assert(w.edges.some(e=>e.from===saved.nodeId&&e.to===n.id&&e.type==='informs'));assert(!w.edges.some(e=>e.type==='depends_on'));
 assert.equal(w.projects[0].prompt,'Original intent project');assert.equal(w.nodes.find(n=>n.id==='goal').status,'active');
 const c=chatCatalog(w).find(c=>c.sessionId==='external_chat');assert.equal(c.provider,'claude');assert.equal(c.reportCount,1);assert.equal(c.reports[0].request,receipt.request);assert.equal(c.reports[0].turnId,receipt.eventId);assert.equal(c.verified.length,0);assert.equal(chatData(w,c).map.items.find(i=>i.nodeId===n.id).sources[0].turnId,receipt.eventId);assert.equal(chatData(w,c).map.items.find(i=>i.nodeId===n.id).needsReview,true);
 assert.equal(ingestCheckpoint(f.config,receipt,0).reason,'duplicate');assert.equal(new MappingIntake(f.config,mapper).tick().queued,0);assert.equal(calls,1);
});

test('intake recovers a failed handoff without rereading transcripts or duplicating source receipts',()=>{
 const f=fixture();ingestCheckpoint(f.config,receipt,0);let fail=true;const actual=new ConversationMapper(f.config),mapper={enqueue(packet){if(fail)throw Error('disk temporarily unavailable');return actual.enqueue(packet);}},intake=new MappingIntake(f.config,mapper);
 assert.throws(()=>intake.tick(),/unavailable/);fail=false;assert.equal(intake.tick().queued,1);assert.equal(new MappingIntake(f.config,actual).tick().queued,0);assert.equal(f.read().events.length,1);assert.equal(fs.readdirSync(actual.jobs).length,1);
});

test('pause, exact-chat exclusion and failed-job retention survive intake recovery',async()=>{
 const f=fixture();ingestCheckpoint(f.config,receipt,0);const mapper=new ConversationMapper(f.config,{runner:async()=>{throw Error('Model not available');}}),intake=new MappingIntake(f.config,mapper);
 atomic(paths(f.config).control,{paused:true});assert.equal(intake.tick().skipped,'paused or disabled');assert.equal(fs.readdirSync(mapper.jobs).length,0);atomic(paths(f.config).control,{paused:false});assert.equal(intake.tick().queued,1);await mapper.tick();assert.equal(new MappingIntake(f.config,mapper).tick().queued,0);assert.equal(JSON.parse(fs.readFileSync(path.join(mapper.jobs,fs.readdirSync(mapper.jobs)[0]))).state,'failed');
 const separate=fixture();assert.equal(ingestCheckpoint(separate.config,{...receipt,sessionId:'personal'},0).reason,'excluded');assert.equal(new MappingIntake(separate.config,new ConversationMapper(separate.config)).tick().queued,0);
});

test('High catch-up covers pending receipts once and cannot race Low extraction',async()=>{
 const f=fixture();ingestCheckpoint(f.config,receipt,0);let low=0,high=0;const mapper=new ConversationMapper(f.config,{runner:async p=>{low++;return answer(p);}});new MappingIntake(f.config,mapper).tick();
 const reviewer=new ProjectReviewer(f.config,{runner:async(p,o)=>{high++;assert.equal(o.effort,'high');await mapper.tick();assert.equal(low,0);return answer(p);}});
 const run=await reviewer.run();assert.equal(run.reviewed,1);assert.equal(run.applied,1);await mapper.tick();assert.equal(low,0);assert.equal(high,1);assert.equal((await reviewer.run()).skipped,'unchanged');assert.equal(f.read().nodes.filter(n=>n.mapper).length,1);const j=JSON.parse(fs.readFileSync(path.join(mapper.jobs,fs.readdirSync(mapper.jobs)[0])));assert.equal(j.state,'done');assert(j.reviewedBy);
});

test('High catch-up respects overdue threshold and revoked chat permission',async()=>{
 const f=fixture();ingestCheckpoint(f.config,receipt,0);const mapper=new ConversationMapper(f.config);new MappingIntake(f.config,mapper).tick();let calls=0;
 f.config.reviewer.catchUpAfterMs=86400000;const reviewer=new ProjectReviewer(f.config,{runner:async p=>{calls++;return answer(p);}});assert.equal((await reviewer.run()).skipped,'unchanged');f.config.reviewer.catchUpAfterMs=0;f.config.capturePolicy.approvedSessionIds=[];assert.equal((await reviewer.run()).skipped,'unchanged');assert.equal(calls,0);
});

test('capture MCP receipt uses exact privacy and source identities with replay-safe revisions',async()=>{
 const f=fixture(),call=localTools(f.config),saved=await call('brancha_capture',{expectedRevision:0,checkpoint:receipt});assert(saved.captured);assert.equal((await call('brancha_capture',{expectedRevision:0,checkpoint:receipt})).reason,'duplicate');assert.equal((await call('brancha_capture',{expectedRevision:0,checkpoint:{...receipt,sessionId:'personal'}})).reason,'excluded');assert.throws(()=>ingestCheckpoint(f.config,{...receipt,summary:'Changed same receipt'},saved.revision),/eventId/);assert.equal(new MappingIntake(f.config,new ConversationMapper(f.config)).tick().queued,1);
});

test('new setup makes mapping primary, permits explicit no-AI, and never includes chats in bulk',()=>{
 const f=fixture(),one=path.join(f.dir,'default.json'),two=path.join(f.dir,'no-ai.json');
 execFileSync(process.execPath,['scripts/setup.mjs','--config',one,'--vault',f.config.vault,'--no-codex'],{cwd:root});const enabled=JSON.parse(fs.readFileSync(one));assert.equal(enabled.mapper.enabled,true);assert.equal(enabled.reviewer.enabled,true);assert.deepEqual(enabled.capturePolicy.approvedSessionIds,[]);
 execFileSync(process.execPath,['scripts/setup.mjs','--config',two,'--vault',f.config.vault,'--no-ai'],{cwd:root});const disabled=JSON.parse(fs.readFileSync(two));assert.equal(disabled.mapper.enabled,false);assert.equal(disabled.reviewer.enabled,false);
});


test('scheduled catch-up keeps a durable request when another mapper owns the lock',()=>{
 const f=fixture(),config=path.join(f.dir,'config.json');atomic(config,f.config);atomic(path.join(f.config.vault,'.brancha/mapper/worker.lock'),{pid:process.pid});
 const result=JSON.parse(execFileSync(process.execPath,['scripts/catch-up.mjs',config],{cwd:root,encoding:'utf8'}));assert.equal(result.review.busy,true);assert.equal(result.review.deferred,true);assert(fs.existsSync(path.join(f.config.vault,'.brancha/reviewer/request.json')));
});
