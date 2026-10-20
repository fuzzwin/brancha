import test from 'node:test';
import assert from 'node:assert/strict';
import {demo, contextBrief, event} from '../dist/core.mjs';

test('a fresh instance receives recent checkpoints even with many older active tasks', () => {
  const w = demo(), p = w.projects[0], template = w.nodes.find(n => n.projectId === p.id);
  for (let i = 0; i < 12; i++) w.nodes.push({...template, id: 'task_'+i, title: 'Older task '+i, type: 'task', status: 'active', criteria: []});
  const checkpoint = {...template, id: 'newest_checkpoint', title: 'Latest session result', type: 'source', status: 'active', criteria: [], detail: 'A new decision from another chat.', next: 'Check the revised prototype.', cloudOrigin: true};
  w.nodes.push(checkpoint);event(w, p.id, 'Saved another-chat checkpoint.', checkpoint.id);
  const before = JSON.stringify(w), brief = contextBrief(w, p.id);
  assert(brief.includes(checkpoint.detail));
  assert(brief.includes(p.prompt));
  assert(brief.indexOf(checkpoint.title) < brief.indexOf('Older task 0'));
  assert(brief.includes('## Continue from here\n\n'+checkpoint.next));
  assert.equal(JSON.stringify(w), before);
});

test('recent local checkpoint next actions take precedence over older active tasks and cloud notes',()=>{
 const w=demo(),p=w.projects[0],template=w.nodes[0];
 const old={...template,id:'cloud-old',type:'source',cloudOrigin:true,next:'An old cloud next step.',criteria:[]};w.nodes.push(old);event(w,p.id,'Earlier cloud checkpoint',old.id);
 const local={...template,id:'local-new',type:'source',status:'reported_done',next:'Review the current portable change.',criteria:[]};w.nodes.push(local);event(w,p.id,'Latest local checkpoint',local.id);
 const brief=contextBrief(w,p.id);assert(brief.includes('## Continue from here\n\n'+local.next));
});
