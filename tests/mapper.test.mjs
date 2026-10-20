import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ConversationMapper,validateExtraction,visibleUserText} from '../adapters/conversation-mapper.mjs';
import {CodexWatcher} from '../adapters/codex-watch.mjs';
import {atomic,paths} from '../adapters/capture.mjs';
import {blank,nextAction,validate} from '../dist/core.mjs';
import {obsidianFiles} from '../companion/obsidian.mjs';
import {createHash} from 'node:crypto';
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-mapper-')),vault=path.join(root,'vault'),sessionsDirectory=path.join(root,'sessions');fs.mkdirSync(vault);fs.mkdirSync(sessionsDirectory);const w=blank();w.projects=[{id:'p',title:'A real project',prompt:'Preserve original scope',createdAt:new Date().toISOString(),criteria:[{id:'c',text:'Physical test'}]}];w.nodes=[{id:'goal',projectId:'p',title:'Goal',type:'goal',status:'active',criteria:[]}];atomic(path.join(vault,'brancha.json'),w);return {config:{vault,sessionsDirectory,capturePolicy:{mode:'approved',approvedSessionIds:['chat','unknown']},sessionProjects:{chat:'p'},mapper:{enabled:true,debounceMs:0,maxCallsPerDay:3,maxHighPerDay:1}},read:()=>JSON.parse(fs.readFileSync(path.join(vault,'brancha.json')))};}
const input={sessionId:'chat',turnId:'turn',cwd:'/project',messages:[{role:'user',text:'Keep Obsidian first and park the online redesign.'},{role:'assistant',text:'We can explore an online redesign later.'}]};
test('Brancha maintenance output does not feed capture or the mapper again',()=>{
 const f=fixture(),watch=new CodexWatcher(f.config);const line=x=>JSON.stringify(x)+'\n',file=path.join(f.config.sessionsDirectory,'maintenance.jsonl');
 fs.writeFileSync(file,line({type:'session_meta',payload:{id:'chat',cwd:'/project',source:'cli'}})+line({type:'event_msg',payload:{type:'task_started',turn_id:'maintenance'}})+line({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Automation: Brancha maintenance. Check changed turns.'}]}})+line({type:'event_msg',payload:{type:'task_complete',turn_id:'maintenance',last_agent_message:'Maintenance receipt saved.'}}));watch.poll();assert.equal(f.read().events.length,0);
});
const result=packet=>({needsReview:false,reason:'',items:[{key:'priority',kind:'decision',title:'Obsidian first',detail:'The user requested Obsidian priority.',sourceId:packet.messages[0].id,quote:packet.messages[0].text},{key:'online',kind:'branch',title:'Online redesign later',detail:'A parked option to review.',sourceId:packet.messages[1].id,quote:packet.messages[1].text}],relations:[{from:'priority',to:'online',type:'branches_from'}]});
test('mapper captures proposals with source quotes, safe links, no completion and exactly-once replay',async()=>{
 const f=fixture();let calls=0;const runner=async packet=>{calls++;return {value:result(packet),receipt:{requestedModel:'gpt-6-luna',reasoningEffort:'low',usage:{input_tokens:12,output_tokens:8}}};};
 const m=new ConversationMapper(f.config,{runner});assert(m.enqueue(input));assert(!m.enqueue(input));await m.tick();await m.tick();const w=validate(f.read());assert.equal(calls,1);assert.equal(w.nodes.filter(n=>n.mapper).length,2);assert(w.nodes.filter(n=>n.mapper).every(n=>n.status==='planned'&&n.criteria.length===0));assert.equal(w.nodes[0].status,'active');assert.equal(w.projects[0].prompt,'Preserve original scope');assert(w.edges.some(e=>e.type==='branches_from'));assert.equal(w.edges.filter(e=>e.type==='depends_on').length,0);assert(!nextAction(w,'p').includes('Obsidian'));
 const views=obsidianFiles(w);assert(views['Conversations/chat.md'].includes('Keep Obsidian first'));assert(views['Dashboards/p-static.md'].includes('Conversation maps'));assert(!m.enqueue(input));
});
test('watcher reads visible user text, ignores tools/reasoning and queues only a completed turn',async()=>{
 const f=fixture(),m=new ConversationMapper(f.config,{runner:async p=>({value:{needsReview:false,reason:'',items:[],relations:[]},receipt:{}})}),watch=new CodexWatcher(f.config,{mapper:m});
 const file=path.join(f.config.sessionsDirectory,'chat.jsonl'),line=x=>JSON.stringify(x)+'\n';
 fs.writeFileSync(file,line({type:'session_meta',payload:{id:'chat',cwd:'/project',source:'cli'}})+line({type:'event_msg',payload:{type:'task_started',turn_id:'turn'}})+line({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Keep Obsidian first.'}]}})+line({type:'response_item',payload:{type:'reasoning',summary:[{text:'SECRET REASONING'}]}}));watch.poll();assert.equal(fs.readdirSync(m.jobs).length,0);
 fs.appendFileSync(file,line({type:'event_msg',payload:{type:'task_complete',turn_id:'turn',last_agent_message:'I will prioritise Obsidian and retain the other option.'}}));watch.poll();const job=JSON.parse(fs.readFileSync(path.join(m.jobs,fs.readdirSync(m.jobs)[0])));assert.equal(job.messages[0].role,'user');assert.equal(job.messages[0].text,'Keep Obsidian first.');assert(!JSON.stringify(job).includes('SECRET'));await m.tick();
});
test('bad evidence is rejected, unknown routes do not contaminate projects, budget and pause are respected',async()=>{
 const f=fixture();const packet={messages:[{id:'a',role:'user',text:'Keep this original wording.'}]};assert.throws(()=>validateExtraction({...result({messages:[{id:'a',text:'Invented quote'},{id:'b',text:'Another invented quote'}]})},packet),/quote/);
 let calls=0;const m=new ConversationMapper(f.config,{runner:async p=>{calls++;return {value:{needsReview:false,reason:'',items:[],relations:[]},receipt:{}};}});
 assert(m.enqueue({...input,sessionId:'unknown'}));await m.tick();assert.equal(calls,0);
 assert(!m.enqueue({...input,turnId:'review',mapperExcluded:true}));
 atomic(paths(f.config).control,{paused:true});assert(!m.enqueue(input));atomic(paths(f.config).control,{paused:false});atomic(path.join(m.root,'budget.json'),{date:new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne'}).format(new Date()),calls:3,high:0});m.enqueue(input);await m.tick();assert.equal(calls,0);assert.equal(f.read().revision,0);
 assert.equal(visibleUserText('# AGENTS.md instructions\nDo something'),'');assert.equal(visibleUserText('<environment_context>noise</environment_context>\n## My request:\nKeep the stand independent.'),'Keep the stand independent.');
});
test('Luna High is used only for flagged ambiguity and unresolved items remain proposals',async()=>{
 const f=fixture(),efforts=[];const m=new ConversationMapper(f.config,{runner:async(p,o)=>{efforts.push(o.effort);return {value:{...result(p),needsReview:o.effort==='low',reason:'Ambiguity'},receipt:{reasoningEffort:o.effort}};}});m.enqueue(input);await m.tick();assert.deepEqual(efforts,['low','high']);assert(f.read().nodes.filter(n=>n.mapper).every(n=>n.status==='planned'));
});
test('a failed extraction is retained and is not retried on every poll',async()=>{
 const f=fixture();let calls=0;const m=new ConversationMapper(f.config,{runner:async()=>{calls++;throw Error('Exact model unavailable');}});m.enqueue(input);await m.tick();await m.tick();assert.equal(calls,1);const job=JSON.parse(fs.readFileSync(path.join(m.jobs,fs.readdirSync(m.jobs)[0])));assert.equal(job.state,'failed');assert.equal(f.read().revision,0);assert.match(JSON.parse(fs.readFileSync(paths(f.config).status)).mapperError,/unavailable/);
});
test('historical turn proposals never attach to a later overwritten source checkpoint',async()=>{
 const f=fixture(),w=f.read(),id='codex_'+createHash('sha256').update('chat').digest('hex').slice(0,24);
 w.nodes.push({id,projectId:'p',title:'Later source',type:'source',status:'active',criteria:[],capture:{sessionId:'chat',turnId:'later'}});atomic(paths(f.config).file,w);
 const m=new ConversationMapper(f.config,{runner:async p=>({value:result(p),receipt:{}})});m.enqueue(input);await m.tick();const updated=f.read(),mapped=updated.nodes.filter(n=>n.mapper);for(const n of mapped)assert(updated.edges.some(e=>e.to===n.id&&e.from==='goal'));assert(!updated.edges.some(e=>e.from===id));
});
