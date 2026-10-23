// Read-only layout guard. Never changes records, bookmarks or map relations.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {loadConfig} from './config.mjs';
const {config}=loadConfig(process.argv[2]),sandbox={module:{exports:{}},require:()=>({Plugin:class{},MarkdownRenderChild:class{},Notice:class{}})};
vm.runInNewContext(fs.readFileSync(new URL('../assets/obsidian/brancha-interactive/main.js',import.meta.url),'utf8'),sandbox);
const x=sandbox.module.exports.explorer,w=JSON.parse(fs.readFileSync(path.join(config.vault,'brancha.json'),'utf8')),errors=[],projects=[];
const check=(ok,message)=>{if(!ok)errors.push(message);};
for(const p of w.projects){
 const data=JSON.parse(fs.readFileSync(path.join(config.vault,'Generated/Interactive',p.id+'.json'),'utf8')),m=x.model(data),expanded=new Set(m.groups.map(g=>g.id)),before=JSON.stringify(m),preview=x.mindmap(m,expanded,'',{limit:6}),all=x.mindmap(m,expanded);
 check(all.shown===m.nodes.length,p.id+': full category coverage');
 const plans=[preview,x.dependencies(m),x.flow(m)];
 for(const g of m.groups){const ids=new Set();for(let page=0;page<Math.ceil(g.nodeIds.length/8);page++){const plan=x.mindmap(m,expanded,'',{group:g.id,page});plans.push(plan);check(plan.shown<=8,p.id+': branch page cap');for(const n of plan.boxes)if(!n.root&&!n.group&&!n.moreGroup)ids.add(n.id);}check(g.nodeIds.every(id=>ids.has(id)),p.id+': missing branch record');}
 for(const n of m.nodes){const trace=x.tracker(m,n.id);plans.push(trace);check(trace.boxes.length<=m.nodes.length,p.id+': unbounded tracker');check(new Set(trace.boxes.map(n=>n.y+n.height/2)).size<=1,p.id+': tracker not linear');for(const edge of trace.links)check(m.edges.some(e=>e.type==='depends_on'&&e.from===edge.from&&e.to===edge.to),p.id+': invented tracker edge');}
 for(const plan of plans){check([plan.width,plan.height].every(n=>Number.isFinite(n)&&n>0),p.id+': invalid dimensions');for(const n of plan.boxes){check(n.lines.every(s=>s.length<=31),p.id+': overflowing text '+n.id);check([n.x,n.y,n.width,n.height].every(Number.isFinite),p.id+': invalid box '+n.id);}for(let i=0;i<plan.boxes.length;i++)for(let j=i+1;j<plan.boxes.length;j++){const a=plan.boxes[i],b=plan.boxes[j];check(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),p.id+': overlapping boxes '+a.id+'/'+b.id);}}
 check(JSON.stringify(m)===before,p.id+': model changed during layout');projects.push({id:p.id,records:m.nodes.length,previewRecords:preview.shown,prerequisites:m.edges.filter(e=>e.type==='depends_on').length,layoutsChecked:plans.length});
}
console.log(JSON.stringify({passed:!errors.length,readOnly:true,revision:w.revision,projects,errors},null,2));if(errors.length)process.exitCode=1;
