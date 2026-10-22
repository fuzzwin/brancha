import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {demo} from '../dist/core.mjs';import {obsidianFiles} from '../companion/obsidian.mjs';
import {privacyView} from '../adapters/chat-privacy.mjs';import os from 'node:os';import path from 'node:path';
const sandbox={module:{exports:{}},require:()=>({Plugin:class{},MarkdownRenderChild:class{},Notice:class{}})};vm.runInNewContext(fs.readFileSync(new URL('../assets/obsidian/brancha-interactive/main.js',import.meta.url),'utf8'),sandbox);const {explorer,mapSize}=sandbox.module.exports,plain=v=>JSON.parse(JSON.stringify(v));
test('full-page maps retain all records beyond dashboard caps, including parked work, and never invent dependency edges',()=>{
 const w=demo(),p=w.projects[0];w.nodes=Array.from({length:45},(_,i)=>({id:'record'+i,projectId:p.id,title:'A saved work item '+i,type:'task',status:i===44?'parked':'planned',criteria:[],detail:'Saved evidence boundary',evidence:'',next:''}));w.edges=[{id:'actual',from:'record0',to:'record44',type:'depends_on'}];w.events=[];const before=JSON.stringify(w),files=obsidianFiles(w),d=JSON.parse(files[`Interactive/${p.id}.json`]),m=explorer.model(d);
 assert(files[`Explorers/${p.id}.md`].includes('```brancha-map'));assert.equal(d.views.group_work.nodes.length,24);assert.equal(m.nodes.length,45);assert(m.groups.some(g=>g.nodeIds.includes('record44')));
 const all=explorer.mindmap(m,new Set(m.groups.map(g=>g.id))),collapsed=explorer.mindmap(m,new Set()),flow=explorer.flow(m);
 assert.equal(all.shown,45);assert.equal(collapsed.shown,0);assert.equal(explorer.mindmap(m,new Set(),'item 44').shown,1);assert.equal(flow.boxes.length,45);assert.deepEqual(plain(flow.links),w.edges);assert.equal(m.isolated.length,43);assert.equal(JSON.stringify(w),before);
});
test('dependency layout keeps cycles, self-loops, disconnected nodes and arrow direction without infinite ranks',()=>{
 const model={nodes:['a','b','c','d','alone'].map(id=>({id,title:id})),edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'c',type:'informs'},{from:'c',to:'b',type:'informs'},{from:'c',to:'d',type:'branches_from'},{from:'alone',to:'alone',type:'informs'}]};const before=JSON.stringify(model),plan=explorer.flow(model),by=new Map(plan.boxes.map(n=>[n.id,n]));
 assert.equal(plan.boxes.length,5);assert.equal(plan.links.length,5);assert.equal(plan.cycleEdges,3);assert(by.get('a').x<by.get('b').x);assert.equal(by.get('b').x,by.get('c').x);assert(by.get('c').x<by.get('d').x);for(const n of plan.boxes)assert([n.x,n.y,n.width,n.height].every(Number.isFinite));assert.equal(explorer.flow(model,'','a').shown,2);assert.equal(JSON.stringify(model),before);
});
test('full chat map retains all saved replies, and exposes only explicit in-scope record connections',()=>{
 const w=demo(),p=w.projects[0];w.nodes=[];w.edges=[];w.events=Array.from({length:85},(_,i)=>({id:'event'+i,projectId:p.id,at:'2026-10-20T01:00:00Z',text:'Captured report',capture:{title:'Reply '+i,type:'source',status:'active',detail:'A saved report',capture:{provider:'codex',sessionId:'chat',turnId:'turn'+i,request:'Request '+i}}}));
 for(const id of ['one','two'])w.nodes.push({id,projectId:p.id,type:'decision',status:'planned',title:id,criteria:[],detail:'A choice',mapper:{sessionId:'chat',turnId:'turn0',quote:'A saved quote'}});w.edges=[{id:'explicit',from:'one',to:'two',type:'informs'}];const files=obsidianFiles(w),d=JSON.parse(files[`Interactive/chat-${p.id}-chat.json`]),m=explorer.model(d),plan=explorer.flow(m);
 assert(files[`Explorers/chat-${p.id}-chat.md`].includes('```brancha-map'));assert.equal(m.nodes.length,172);assert.equal(plan.boxes.length,172);assert.equal(plan.links.length,1);const edge=plan.links[0];assert.equal(m.nodes.find(n=>n.id===edge.from).recordId,'one');assert.equal(m.nodes.find(n=>n.id===edge.to).recordId,'two');assert.equal(edge.type,'informs');assert(m.nodes.filter(n=>n.type==='reply').every(n=>files[n.sources[0].logPath+'.md']));
});
test('full-page scaling uses remaining pane height, retains readable controls and supports an actual fit overview',()=>{
 const args={width:1800,height:2000,availableWidth:1000,availableHeight:760,fullPage:true};assert.equal(mapSize(args).frame,760);assert(mapSize(args).scale>=11/15);const fit=mapSize({...args,fitAll:true});assert(fit.height<=760);assert(fit.width<=1000);assert.equal(mapSize({...args,readable:true}).scale,1);
});

const depNode=(id,status='active',extra={})=>({id,title:'Duplicate title',type:'task',statusId:status,...extra});
test('privacy-filtered prerequisites never establish readiness or disclose hidden source identity',t=>{
 const vault=fs.mkdtempSync(path.join(os.tmpdir(),'branchi-map-privacy-'));t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));const w=demo(),p=w.projects[0];w.events=[];w.nodes=[{id:'visible_done',projectId:p.id,title:'Fictional completed prerequisite',type:'task',status:'done',criteria:[],evidence:'Fictional evidence'},{id:'private_blocker',projectId:p.id,title:'FICTIONAL_PRIVATE_TITLE',type:'source',status:'unknown',criteria:[],capture:{sessionId:'excluded-chat'}},{id:'target',projectId:p.id,title:'Fictional target',type:'task',status:'active',criteria:[]}];w.edges=[{id:'done_edge',from:'visible_done',to:'target',type:'depends_on'},{id:'hidden_edge',from:'private_blocker',to:'target',type:'depends_on'}];
 const before=JSON.stringify(w),view=privacyView({vault,capturePolicy:{approvedSessionIds:[]}},w),data=JSON.parse(obsidianFiles(view)['Interactive/'+p.id+'.json']),plan=explorer.dependencies(explorer.model(data));assert.equal(data.dependencyScopeComplete,false);assert.equal(plan.states.target.ready,false);assert.match(explorer.model(data).scopeMessage,/omits prerequisite context/);assert(!explorer.model(data).scopeMessage.includes('Regenerate'));assert(!JSON.stringify(data).includes('private_blocker'));assert(!JSON.stringify(data).includes('FICTIONAL_PRIVATE_TITLE'));assert.equal(JSON.stringify(w),before);
});
test('cross-project prerequisites remain explicit and chat scope never proves project readiness',()=>{
 const w=demo(),p=w.projects[0],q=w.projects[1];w.nodes=[{...depNode('outside','unknown'),status:'unknown',projectId:q.id,criteria:[]},{...depNode('inside','done'),status:'done',evidence:'Fictional evidence',projectId:p.id,criteria:[]},{...depNode('target'),status:'active',projectId:p.id,criteria:[]}];w.edges=[{id:'external',from:'outside',to:'target',type:'depends_on'},{id:'internal',from:'inside',to:'target',type:'depends_on'}];w.events=[];
 const d=JSON.parse(obsidianFiles(w)['Interactive/'+p.id+'.json']),m=explorer.model(d),plan=explorer.dependencies(m);assert(m.nodes.find(n=>n.id==='outside').external);assert.equal(plan.states.target.ready,false);assert.deepEqual(plain(plan.states.target.blocked),['outside']);
 const legacy={...d,nodes:d.nodes.filter(n=>n.id!=='outside'),edges:d.edges.filter(e=>e.from!=='outside')};delete legacy.dependencyScopeComplete;assert.equal(explorer.dependencies(explorer.model(legacy)).states.target.ready,false);
 const scoped=explorer.dependencies({...m,scopeComplete:false,nodes:m.nodes.filter(n=>n.id!=='outside'),edges:m.edges.filter(e=>e.from!=='outside')});assert.equal(scoped.states.target.ready,false);assert.equal(scoped.states.target.scopeComplete,false);
 for(const type of ['source','goal']){const x=explorer.dependencies({nodes:[depNode('done','done'),depNode('target','active',{type})],edges:[{from:'done',to:'target',type:'depends_on'}]});assert.equal(x.states.target.ready,false);}
});
test('completed direct prerequisite cannot hide unresolved earlier prerequisites',()=>{
 const plan=explorer.dependencies({nodes:[depNode('a','unknown'),depNode('b','done'),depNode('c')],edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'c',type:'depends_on'}]},{focus:'c'});assert.equal(plan.states.c.ready,false);assert.deepEqual(plain(plan.states.c.blocked),[]);assert.deepEqual(plain(plan.states.c.unresolvedAncestors),['a']);assert.equal(plan.hiddenPrerequisites,1);
});
test('dependency order ignores context cycles, offshoots and goal links',()=>{
 const model={nodes:['a','b','c'].map(id=>depNode(id)),edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'c',type:'depends_on'},{from:'c',to:'a',type:'informs'},{from:'a',to:'c',type:'informs'},{from:'c',to:'a',type:'branches_from'},{from:'c',to:'b',type:'implements'}]},before=JSON.stringify(model);
 const plan=explorer.dependencies(model,{layers:['informs','branches_from','implements']}),by=new Map(plan.boxes.map(n=>[n.id,n]));
 assert(by.get('a').x<by.get('b').x);assert(by.get('b').x<by.get('c').x);assert.equal(plan.dependencyCycles,0);assert.equal(plan.links.length,6);assert.deepEqual(plain(plan.states.b.prerequisites),['a']);assert.equal(JSON.stringify(model),before);
});
test('dependency cycles and self-loops stay finite and never establish readiness downstream',()=>{
 const model={nodes:['a','b','c','self'].map(id=>depNode(id,'done')),edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'a',type:'depends_on'},{from:'b',to:'c',type:'depends_on'},{from:'self',to:'self',type:'depends_on'}]};model.nodes[2].statusId='active';
 const plan=explorer.dependencies(model);assert.equal(plan.dependencyCycles,3);assert(plan.states.a.cycle);assert(plan.states.self.cycle);assert(plan.states.c.upstreamCycle);assert.equal(plan.states.c.ready,false);for(const box of plan.boxes)assert([box.x,box.y,box.width,box.height].every(Number.isFinite));
});
test('unknown, reported, parked and proposed work is unresolved; absence of edges is not readiness',()=>{
 for(const [status,extra]of [['unknown',{}],['reported_done',{}],['parked',{}],['planned',{}],['done',{proposal:true}],['done',{type:'source'}]]){
  const plan=explorer.dependencies({nodes:[depNode('a',status,extra),depNode('b')],edges:[{from:'a',to:'b',type:'depends_on'}]});assert.equal(plan.states.b.ready,false);assert.deepEqual(plain(plan.states.b.blocked),['a']);
 }
 const model={nodes:[depNode('a','done'),depNode('b'),depNode('isolated')],edges:[{from:'a',to:'b',type:'depends_on'}]},plan=explorer.dependencies(model);assert(plan.states.b.ready);assert.equal(plan.states.isolated.ready,false);
});
test('focused dependency expansion counts all upstream records, uses IDs and preserves the model',()=>{
 const model={nodes:['a','b','c','d'].map(id=>depNode(id)),edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'c',type:'depends_on'},{from:'c',to:'d',type:'depends_on'}]},before=JSON.stringify(model);
 const focused=explorer.dependencies(model,{focus:'c'});assert.equal(focused.shown,3);assert.equal(focused.hiddenPrerequisites,1);const all=explorer.dependencies(model,{focus:'c',upstream:Infinity});assert.equal(all.shown,4);assert.equal(all.hiddenPrerequisites,0);assert.equal(explorer.dependencies(model,{query:'b'}).shown,1);assert.equal(JSON.stringify(model),before);
});
test('120 records and 471 mixed connections retain every ID without scheduling context edges',()=>{
 const nodes=Array.from({length:120},(_,i)=>depNode('n'+i)),edges=Array.from({length:119},(_,i)=>({from:'n'+i,to:'n'+(i+1),type:'depends_on'}));for(let i=0;edges.length<471;i++)edges.push({from:'n'+(i%120),to:'n'+((i+13)%120),type:['informs','branches_from','implements'][i%3]});
 const model={nodes,edges},before=JSON.stringify(model),plan=explorer.dependencies(model,{layers:['informs','branches_from','implements']});assert.equal(plan.shown,120);assert.equal(plan.links.length,471);assert.equal(plan.dependencyTotal,119);assert.equal(plan.dependencyCycles,0);assert.equal(new Set(plan.boxes.map(n=>n.id)).size,120);assert.equal(JSON.stringify(model),before);
});
