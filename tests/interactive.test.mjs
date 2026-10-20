import test from 'node:test';
import assert from 'node:assert/strict';
import {demo,STATUSES,statusLabel} from '../dist/core.mjs';
import {obsidianFiles} from '../companion/obsidian.mjs';

test('interactive views preserve scoped edges, source evidence and links with portable fallback',()=>{
 const w=demo(),before=JSON.stringify(w),files=obsidianFiles(w);
 for(const p of w.projects){
  const d=JSON.parse(files[`Interactive/${p.id}.json`]);
  assert.equal(d.project.id,p.id);assert(files[`Dashboards/${p.id}.md`].includes('```brancha-interactive'));
  assert(files[`Dashboards/${p.id}-static.md`].includes('## At a glance'));
  for(const n of d.nodes){
   const v=d.views['item_'+n.id];assert(v.nodes.includes(n.id));
   assert(files[`Items/${n.id}.md`]);assert(v.nodes.length<=24);
   for(const e of v.edges){assert(v.nodes.includes(e.from)&&v.nodes.includes(e.to));assert(w.edges.some(original=>JSON.stringify(original)===JSON.stringify(e)));}
  }
  for(const g of d.groups){assert(d.overview.includes(`data-id="group_${g.id}"`));assert.deepEqual(d.views['group_'+g.id].seedIds,g.nodeIds);}
 }
 assert.equal(JSON.stringify(w),before);
});

test('empty project has a useful interactive shell and dense categories disclose clipped diagrams',()=>{
 const w=demo(),p=w.projects[0];w.nodes=w.nodes.filter(n=>n.projectId!==p.id);w.edges=[];w.events=[];
 let d=JSON.parse(obsidianFiles(w)[`Interactive/${p.id}.json`]);assert.equal(d.nodes.length,0);assert.equal(d.groups.length,0);
 for(let i=0;i<30;i++)w.nodes.push({id:'task'+i,projectId:p.id,type:'task',title:'Task '+i,status:'planned',criteria:[],detail:'',evidence:'',next:''});
 d=JSON.parse(obsidianFiles(w)[`Interactive/${p.id}.json`]);assert.equal(d.views.group_work.nodes.length,24);assert.equal(d.views.group_work.total,30);assert.equal(d.views.group_work.seedIds.length,30);
});

test('status defaults remain consistent across maps, tags and guide without accepting reported results or AI suggestions',()=>{
 const w=demo(),p=w.projects[0];w.nodes=w.nodes.filter(n=>n.projectId!==p.id);w.edges=[];w.events=[];
 for(const status of STATUSES)w.nodes.push({id:'state_'+status,projectId:p.id,type:status==='parked'?'branch':'task',title:'State '+status,status,criteria:[],detail:'',evidence:status==='done'?'Recorded check':'',next:'',...(status==='planned'?{mapper:{sessionId:'chat',turnId:'turn',quote:'suggestion'}}:{})});
 const before=JSON.stringify(w),files=obsidianFiles(w),d=JSON.parse(files[`Interactive/${p.id}.json`]);
 assert.deepEqual(d.statusKey.map(s=>s.id).sort(),[...STATUSES].sort());
 for(const status of STATUSES){
  const n=d.nodes.find(n=>n.id==='state_'+status),key=d.statusKey.find(s=>s.id===status);
  assert.equal(n.statusId,status);assert.equal(n.status,statusLabel(status));
  assert(d.views['item_'+n.id].svg.includes(`data-status="${status}"`));
  assert(d.views['item_'+n.id].svg.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').includes(statusLabel(status)));
  const note=files[`Items/${n.id}.md`];assert(note.includes('brancha/status/'+status));assert(note.includes('brancha/type/'+n.type));
  assert(files['Guides/Status key.md'].includes(key.description));
 }
 assert(files['Items/state_planned.md'].includes('brancha/origin/ai-suggestion'));
 assert(!files['Items/state_reported_done.md'].includes('brancha/status/done'));
 assert(!d.groups.find(g=>g.id==='outputs').nodeIds.includes('state_reported_done'));
 const canvas=JSON.parse(files[`Maps/${p.id}.canvas`]);
 assert.equal(canvas.nodes.find(n=>n.id==='state_parked').color,'#8a9690');
 for(const n of canvas.nodes)if(n.color)assert(/^(?:[1-6]|#[a-f0-9]{6})$/i.test(n.color));
 for(const n of d.nodes.filter(n=>d.overview.includes(`data-id="item_${n.id}"`)))assert(d.overview.includes(`data-id="item_${n.id}" data-status="${n.statusId}"`));
 assert.equal(JSON.stringify(w),before);
});
