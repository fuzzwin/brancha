import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTimeline} from '../companion/timeline.mjs';
import {obsidianFiles} from '../companion/obsidian.mjs';
import {demo} from '../dist/core.mjs';
const at='2026-10-20T10:00:00Z';
test('timeline preserves historical snapshots and exact source chat without substituting the current report',()=>{
 const w={nodes:[{id:'n',projectId:'p',title:'Later report',detail:'Latest text',capture:{sessionId:'chat-b',turnId:'later'}}],events:[
  {id:'old',projectId:'p',nodeId:'n',at:'2026-10-19T02:00:00Z',text:'Original checkpoint',capture:{title:'Earlier report',detail:'Original text',status:'active',capture:{provider:'codex',sessionId:'chat-a',turnId:'original'}}},
  {id:'manual',projectId:'p',nodeId:'n',at:'2026-10-20T01:00:00Z',text:'Manual connection'},
  {id:'other',projectId:'q',at:'2026-10-20T02:00:00Z',text:'Other project'},
  {id:'future',projectId:'p',at:'2026-10-21T01:00:00Z',text:'Future'}]};
 const before=JSON.stringify(w),t=projectTimeline(w,'p',{at});
 assert.equal(t.total,2);assert.equal(t.items[0].snapshot.detail,'Original text');assert.equal(t.items[0].sessionId,'chat-a');assert.equal(t.items[0].turnId,'original');
 assert.equal(t.items[1].snapshot,null);assert.equal(t.items[1].sessionId,null);assert.deepEqual(t.chats,[{id:'chat-a',provider:'codex',count:1}]);assert.equal(JSON.stringify(w),before);
});
test('timeline bounds loaded history, keeps stable ordering, rejects unsafe chat IDs and retains status changes',()=>{
 const w={nodes:[],events:[0,1,2].map(i=>({id:'e'+i,projectId:'p',at:'2026-10-20T02:00:00Z',text:'Event '+i}))};
 w.events[2].before={status:'active',next:'Old'};w.events[2].after={title:'Decision',type:'decision',status:'done',next:'New',capture:{sessionId:'unsafe/../chat'}};
 const t=projectTimeline(w,'p',{at,limit:2});assert.equal(t.total,3);assert.equal(t.loaded,2);assert.equal(t.truncated,true);assert.deepEqual(t.items.map(e=>e.id),['e1','e2']);assert.equal(t.items[1].sessionId,null);assert.equal(t.items[1].kind,'decision');assert.equal(t.items[1].changes.length,2);
});
test('all projects export timeline pages and captured chats get their own linked timeline',()=>{
 const w=demo(),p=w.projects[0];w.events.push({id:'saved-chat',projectId:p.id,at:'2026-10-19T01:00:00Z',nodeId:null,text:'Saved checkpoint',capture:{title:'A report',type:'source',status:'active',detail:'Historical detail',capture:{provider:'codex',sessionId:'session-1',turnId:'turn-1'}}});
 const files=obsidianFiles(w);for(const project of w.projects){assert(files[`Timelines/${project.id}.md`]);assert(files[`Timelines/${project.id}-history.md`]);}
 assert(files[`Timelines/${p.id}-session-1.md`].includes('```brancha-timeline\n'+p.id+'\nsession-1'));
 assert(files['Conversations/session-1.md'].includes(`Timelines/${p.id}-session-1`));assert(JSON.parse(files[`Interactive/${p.id}.json`]).timeline.items.some(e=>e.id==='saved-chat'));
});


test('timeline overview spans the saved record and retains old markers and chat starts beyond the detail window',()=>{
 const w={revision:7,projects:[{id:'p',createdAt:'2026-09-01T00:00:00Z'}],nodes:[],events:Array.from({length:450},(_,i)=>({id:'e'+i,projectId:'p',at:'2026-10-19T02:00:00Z',text:'Saved '+i,capture:{title:'Report '+i,status:'active',detail:'Original '+i,capture:{provider:'codex',sessionId:i===0?'old-chat':'busy-chat',turnId:'turn'+i}}}))};
 w.events.push({id:'future',projectId:'p',at:'2026-10-21T00:00:00Z',text:'Not yet'});
 const before=JSON.stringify(w),t=projectTimeline(w,'p',{at});assert.equal(t.startedAt,'2026-09-01T00:00:00Z');assert.equal(t.items.length,400);assert.equal(t.points.length,450);assert.equal(t.points[0].id,'e0');assert.equal(t.chatStarts['old-chat'],'2026-10-19T02:00:00Z');assert(t.chats.some(c=>c.id==='old-chat'));assert(!('snapshot' in t.points[0]));assert(!t.points.some(e=>e.id==='future'));assert.equal(projectTimeline(w,'p',{at,limit:Infinity}).items[0].snapshot.detail,'Original 0');assert.equal(JSON.stringify(w),before);
});

test('each project exports a revision-matched local archive for the full-history dropdown',()=>{
 const w=demo(),p=w.projects[0];w.events=Array.from({length:430},(_,i)=>({id:'history'+i,projectId:p.id,at:'2026-10-19T02:00:00Z',text:'Saved update '+i}));
 const files=obsidianFiles(w),payload=JSON.parse(files[`Interactive/${p.id}.json`]),archive=JSON.parse(files[`TimelineHistory/${p.id}.json`]);assert.equal(payload.timeline.items.length,400);assert.equal(payload.timeline.points.length,430);assert.equal(archive.items.length,430);assert.equal(archive.projectId,p.id);assert.equal(archive.revision,payload.timeline.archiveRevision);assert.equal(archive.items[0].id,'history0');
});
