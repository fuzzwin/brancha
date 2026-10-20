import test from 'node:test';
import assert from 'node:assert/strict';
import {blank} from '../dist/core.mjs';
import {projectReview,reviewMarkdown} from '../scripts/project-review.mjs';
test('review rejects cyclic input and inventories valid unconnected records without mutation',()=>{
 const w=blank();w.projects=[{id:'p',title:'Project',prompt:'Original',criteria:[],createdAt:'2026-10-01T00:00:00Z'}];
 w.nodes=['a','b','c'].map(id=>({id,projectId:'p',title:id,type:'task',status:'active',criteria:[]}));
 w.edges=[{id:'e1',from:'a',to:'b',type:'depends_on'},{id:'e2',from:'b',to:'a',type:'depends_on'}];
 assert.throws(()=>projectReview(w),/dependency creates a cycle/);
 w.edges.pop();const before=JSON.stringify(w),r=projectReview(w);
 assert.equal(r.integrity.cycles.length,0);assert.deepEqual(r.projects[0].unconnected.map(x=>x.id),['c']);assert.equal(JSON.stringify(w),before);
 assert.match(reviewMarkdown(r),/not independent verification|never calls a model|deterministic inventory/);
});
test('branches can loop without becoming prerequisite cycles',()=>{
 const w=blank();w.projects=[{id:'p',title:'Project',prompt:'Original',criteria:[],createdAt:'2026-10-01T00:00:00Z'}];
 w.nodes=['a','b'].map(id=>({id,projectId:'p',title:id,type:'branch',status:'parked',criteria:[]}));
 w.edges=[{id:'e1',from:'a',to:'b',type:'branches_from'},{id:'e2',from:'b',to:'a',type:'informs'}];
 assert.equal(projectReview(w).integrity.cycles.length,0);
});
