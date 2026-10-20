import test from 'node:test';
import assert from 'node:assert/strict';
import {workstreamProgress} from '../companion/workstreams.mjs';
test('workstream counts follow recorded ownership and dependencies without promoting reports or suggestions',()=>{
 const n=(id,type,status='active',extra={})=>({id,projectId:'p',type,status,title:id,evidence:status==='done'?'Observed result':'',...extra});
 const w={nodes:[n('goal','goal'),n('branch','branch'),n('finished','output','done'),n('next','task'),n('offshoot','task','blocked'),n('report','source','done'),n('ai','task','done',{mapper:{}}),n('parked','task','parked'),n('loose','task'),n('foreign','task','done',{projectId:'other'})],edges:[
  {from:'goal',to:'finished',type:'implements'},{from:'finished',to:'next',type:'depends_on'},
  {from:'goal',to:'branch',type:'branches_from'},{from:'branch',to:'offshoot',type:'implements'},
  {from:'goal',to:'report',type:'informs'},{from:'goal',to:'ai',type:'implements'},
  {from:'goal',to:'parked',type:'implements'},{from:'goal',to:'loose',type:'informs'},
  {from:'goal',to:'foreign',type:'implements'}]};
 const before=JSON.stringify(w),rows=workstreamProgress(w,'p');
 assert.deepEqual(rows[0].nodeIds,['finished','next']);assert.equal(rows[0].done,1);assert.equal(rows[0].total,2);
 assert.deepEqual(rows[1].nodeIds,['offshoot']);assert.equal(rows[1].blocked,1);
 assert.deepEqual(rows[2].nodeIds,['loose']);assert.equal(JSON.stringify(w),before);
});
test('empty streams have no fabricated percentage and graph cycles are bounded',()=>{
 const w={nodes:[{id:'g',projectId:'p',type:'goal',status:'active',title:'Goal'}],edges:[]};
 assert.equal(workstreamProgress(w,'p')[0].percent,null);
 w.nodes.push({id:'t',projectId:'p',type:'task',status:'reported_done',title:'Claim'});
 w.edges=[{from:'g',to:'t',type:'implements'},{from:'t',to:'g',type:'branches_from'}];
 assert.equal(workstreamProgress(w,'p')[0].done,0);
 assert.equal(workstreamProgress(w,'p')[0].total,1);
});
