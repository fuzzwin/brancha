import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const sandbox={module:{exports:{}},require:()=>({Plugin:class{},MarkdownRenderChild:class{},Notice:class{}})};vm.runInNewContext(fs.readFileSync(new URL('../assets/obsidian/brancha-interactive/main.js',import.meta.url),'utf8'),sandbox);const x=sandbox.module.exports.explorer,plain=v=>JSON.parse(JSON.stringify(v));
const node=(id,status='active')=>({id,title:id,type:'task',statusId:status,status});
test('long filenames fit bounded text lines, retain full title, and support unbroken Unicode names',()=>{
 for(const title of ['AUMEL01_Switch_Implementation_Field_Workbook_v1_(1).xlsx','x'.repeat(180),'測'.repeat(90)]){const box=x.box({title,status:'Active'});assert.equal(box.title,title);assert(box.lines.length<=4);assert(box.lines.every(line=>line.length<=31));assert(box.height>=66);}
});
test('32-record fanout previews six and reveals every retained record through bounded branch pages',()=>{
 const model={title:'Evidence',nodes:Array.from({length:32},(_,i)=>node('doc'+i)),groups:[{id:'evidence',title:'Evidence and reports',nodeIds:Array.from({length:32},(_,i)=>'doc'+i)}],edges:[]},before=JSON.stringify(model),expanded=new Set(['evidence']);
 const preview=x.mindmap(model,expanded,'',{limit:6});assert.equal(preview.shown,6);assert.equal(preview.total,32);assert.equal(preview.boxes.filter(n=>n.moreGroup).length,1);assert.match(preview.boxes.find(n=>n.moreGroup).title,/26 more/);
 const seen=new Set();for(let page=0;page<4;page++){const plan=x.mindmap(model,expanded,'',{group:'evidence',page});assert.equal(plan.shown,8);for(const n of plan.boxes)if(n.id.startsWith('doc'))seen.add(n.id);}assert.equal(seen.size,32);assert.equal(x.mindmap(model,expanded).shown,32);assert.equal(JSON.stringify(model),before);
 const result=x.mindmap(model,expanded,'doc31',{limit:6});assert.equal(result.shown,1);assert(result.boxes.some(n=>n.id==='doc31'));
});
test('tracker keeps source-to-target direction and reveals joins without hiding unresolved ancestors',()=>{
 const model={scopeComplete:true,nodes:[node('source','done'),node('other','unknown'),node('middle','done'),node('target'),node('next'),node('fork')],edges:[{from:'source',to:'middle',type:'depends_on'},{from:'other',to:'middle',type:'depends_on'},{from:'middle',to:'target',type:'depends_on'},{from:'target',to:'next',type:'depends_on'},{from:'target',to:'fork',type:'depends_on'},{from:'fork',to:'source',type:'informs'}]},before=JSON.stringify(model);
 const plan=x.tracker(model,'target');assert.deepEqual(plain(plan.boxes.map(n=>n.id)),['other','middle','target']);assert.equal(new Set(plan.boxes.map(n=>n.y+n.height/2)).size,1);assert.equal(plan.firstUnresolved,'other');assert.deepEqual(plain(plan.offPath),['source']);assert.equal(plan.choices.length,2);assert(plan.links.every(e=>e.type==='depends_on'));assert.equal(plan.states.target.ready,false);
 const chosen=x.tracker(model,'target',{'up:middle':'source','down:target':'fork'});assert.deepEqual(plain(chosen.boxes.map(n=>n.id)),['source','middle','target','fork']);assert.deepEqual(plain(chosen.offPath),['other']);assert.equal(chosen.states.target.ready,false);assert.equal(JSON.stringify(model),before);
});
test('tracker terminates cycles and self loops; incomplete scope and reported completion never prove readiness',()=>{
 const m={scopeComplete:false,nodes:[node('a','reported_done'),node('b'),node('alone')],edges:[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'a',type:'depends_on'}]};const p=x.tracker(m,'b');assert(p.cycle);assert.equal(p.shown,2);assert.equal(p.states.b.ready,false);assert.equal(p.states.a.completed,false);assert.equal(x.tracker(m,'missing').shown,0);assert.equal(x.tracker(m,'alone').links.length,0);assert(x.tracker({nodes:[node('a')],edges:[{from:'a',to:'a',type:'depends_on'}]},'a').cycle);
});
