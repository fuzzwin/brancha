import test from 'node:test';
import assert from 'node:assert/strict';
import {demo} from '../dist/core.mjs';
import {navigationFiles,bookmarkPlan} from '../companion/navigation.mjs';

test('navigation groups actual events by local calendar date including DST and excludes future events',()=>{
 const w=demo(),p=w.projects[0];
 w.events=[
  {id:'previous',projectId:p.id,at:'2026-10-02T15:30:00Z',text:'Previous local day'},
  {id:'today',projectId:p.id,at:'2026-10-03T14:30:00Z',text:'Today before DST change'},
  {id:'future',projectId:p.id,at:'2026-10-04T15:30:00Z',text:'Future should be absent'}
 ];
 const files=navigationFiles(w,{at:new Date('2026-10-03T14:45:00Z'),timeZone:'Australia/Melbourne'});
 const note=files['Navigation/Today.md'];
 assert(note.includes('Today · 2026-10-04'));assert(note.includes('Yesterday · 2026-10-03'));
 assert(note.indexOf('Today before DST change')<note.indexOf('## Yesterday'));
 assert(note.indexOf('Previous local day')>note.indexOf('## Yesterday'));
 assert(!note.includes('Future should be absent'));
 // At 00:30 after the spring-forward day, subtracting 24h would skip yesterday.
 const next=navigationFiles(w,{at:new Date('2026-10-04T13:30:00Z'),timeZone:'Australia/Melbourne'})['Navigation/Today.md'];
 assert(next.includes('Yesterday · 2026-10-04'));
});

test('bookmark installation is additive, preserves existing shortcuts and discovers new projects',()=>{
 const w=demo(),before=JSON.stringify(w),first=bookmarkPlan(w,[{type:'file',value:'Notes/My note.md'}]);
 const installed=first.map(x=>({type:'file',value:x.file,title:x.title}));
 assert.equal(bookmarkPlan(w,installed).length,0);assert.equal(JSON.stringify(w),before);
 w.projects.push({...w.projects[0],id:'fresh',title:'Fresh project'});
 assert.deepEqual(bookmarkPlan(w,installed),[{file:'Generated/Dashboards/fresh.md',title:'Brancha · Fresh project'}]);
 const pages=navigationFiles(w);
 assert(pages['Navigation/Home.md'].includes('Generated/Dashboards/fresh'));
});

test('compact Today gives quiet projects equal visibility and limits each busy project detail group',()=>{
 const w=demo(),first=w.projects[0],second=w.projects[1];
 w.events=Array.from({length:70},(_,i)=>({id:'busy'+i,projectId:first.id,at:`2026-10-20T08:${String(i%60).padStart(2,'0')}:00Z`,text:'Busy update '+i}));
 w.events.push({id:'quiet',projectId:second.id,at:'2026-10-20T01:00:00Z',text:'Quiet project result'});
 const before=JSON.stringify(w),note=navigationFiles(w,{at:new Date('2026-10-20T12:00:00Z'),timeZone:'UTC'})['Navigation/Today.md'];
 const table=note.split('## Today')[1].split('## Yesterday')[0];
 for(const p of w.projects)assert(table.includes('Generated/Dashboards/'+p.id));
 assert(table.includes('Quiet project result'));assert(!note.includes('Showing the latest 40'));
 const detail=note.split('## Recent update details')[1];
 assert.equal((detail.match(/> - Today/g)||[]).length,4);assert.equal(JSON.stringify(w),before);
 assert(note.includes('\\|'+first.title));
});

test('status pages distinguish observed freshness and the three different records without leaking errors',()=>{
 const files=navigationFiles(demo(),{port:53000,capture:{enabled:true,paused:true,cloudEnabled:true,cloudError:'Authorization: private-secret'},hasGuide:true});
 const connections=files['Navigation/Connections.md'];
 assert(connections.includes('Paused'));assert(connections.includes('http://127.0.0.1:53000/'));
 assert(connections.includes('Local edits are not pushed back'));assert(connections.includes('browser-saved copy'));
 assert(!connections.includes('private-secret'));
 assert(files['Navigation/Home.md'].includes('Notes/Brancha guide'));
});
