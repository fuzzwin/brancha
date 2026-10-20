import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,validate,demo,projectAnalytics,projectMindmap,projectTemplate,vaultFiles,progress,event} from '../dist/core.mjs';
import {obsidianFiles} from '../companion/obsidian.mjs';
import {dashboardSvg} from '../companion/dashboard-svg.mjs';
import {render} from '../dist/vendor/pele-1.7.0.mjs';
const at='2026-10-20T04:00:00Z';
const fixture=()=>{const w=blank();w.projects=[{id:'project',title:'Fictional prototype',prompt:'Preserve this exact request.',createdAt:at,criteria:[{id:'result',text:'An observed result'}]},{id:'other',title:'Other project',prompt:'Different scope',createdAt:at,criteria:[]}];const node=(id,type,status,extra={})=>({id,projectId:'project',title:'Fixture '+id,type,status,criteria:[],detail:'',next:'Check the result.',evidence:status==='done'?'Fictional observed evidence':'',rationale:'',alternatives:'',consequence:'',...extra});w.nodes=[node('goal','goal','active'),node('ready','task','active'),node('waiting','task','planned'),node('blocked','task','blocked'),node('report','source','reported_done'),node('output','output','done',{criteria:['result']}),node('decision','decision','planned')];w.edges=[{id:'edge',from:'blocked',to:'waiting',type:'depends_on'}];return {w,node};};

test('dashboard separates original goals, work, reports and unmet prerequisites without mutating evidence',()=>{
 const {w}=fixture(),before=JSON.stringify(w),a=projectAnalytics(w,'project',{at,timeZone:'UTC'});
 assert.deepEqual(a.originalGoals,{done:1,total:1,percent:100});assert.equal(a.workTotal,5);assert.equal(a.ready.length,2);assert.deepEqual(a.waiting.map(n=>n.id),['waiting']);assert.equal(a.blocked.length,1);assert.equal(a.reportsToReview.length,1);assert.equal(a.status.reduce((s,x)=>s+x.count,0),5);assert.equal(JSON.stringify(w),before);
 w.nodes.find(n=>n.id==='output').status='reported_done';assert.equal(projectAnalytics(w,'project',{at,timeZone:'UTC'}).originalGoals.done,0);
});

test('14-day activity respects timezone boundaries, excludes other projects and future events',()=>{
 const {w}=fixture();const add=(id,time,projectId='project',extra={})=>w.events.push({id,at:time,projectId,text:'An update',nodeId:null,...extra});
 add('yesterday','2026-10-19T12:00:00Z');add('today','2026-10-19T14:01:00Z','project',{after:{checkpoint:{provider:'artemis'}}});add('other','2026-10-20T00:00:00Z','other');add('future','2026-10-21T00:00:00Z');add('old','2026-09-01T00:00:00Z');
 const a=projectAnalytics(w,'project',{at,timeZone:'Australia/Melbourne'});assert.equal(a.activity.length,14);assert.equal(a.activity.at(-1).date,'2026-10-20');assert.equal(a.activity.at(-1).count,1);assert.equal(a.activity.at(-2).count,1);assert.equal(a.updates14d,2);assert.equal(a.activeDays,2);assert.deepEqual(a.providers,[{provider:'artemis',count:1}]);assert.equal(a.recent.length,3);
});

test('empty projects get usable dashboards without invented progress or activity',()=>{
 const {w}=fixture();w.nodes=w.nodes.filter(n=>n.projectId!=='project');w.edges=[];const a=projectAnalytics(w,'other',{at,timeZone:'UTC'});
 assert.equal(a.originalGoals.percent,null);assert.equal(a.updates14d,0);assert.equal(a.latest,null);assert.equal(a.workTotal,0);assert(projectMindmap(w,'other').source.includes('Add the first task or decision'));
 assert(vaultFiles(w)['Dashboards/other.md'].includes('No source checkpoints recorded yet.'));
});

test('templates tailor prompts without changing scope, tasks, statuses or success criteria',()=>{
 const {w}=fixture(),before=JSON.stringify(w);assert.equal(projectTemplate(w.projects[0]).id,'physical');assert.equal(projectTemplate({...w.projects[0],title:'Career & CV'}).id,'career');assert.equal(projectTemplate({...w.projects[0],templateId:'research'}).inferred,false);assert.equal(JSON.stringify(w),before);
 w.projects[0].templateId='unknown-template';assert.throws(()=>validate(w),/template/);
});

test('Pele mindmaps stay bounded for dense projects and labels cannot inject diagram syntax',()=>{
 const {w,node}=fixture();for(let i=0;i<60;i++)w.nodes.push(node('extra'+i,'source','active',{title:'Long " [title] <img>\nInjected line '+i}));
 const m=projectMindmap(w,'project');assert(m.shown<20);assert.equal(m.total,w.nodes.length);assert(m.source.includes('more in full map'));assert(!m.source.includes('<img>'));assert(!m.source.includes('\nInjected'));
 const output=render(m.source,{images:false,links:false});assert.equal(output.type,'mindmap');for(const id of m.nodeIds)assert(output.svg.includes('data-id="item_'+id+'"'));
 const svg=dashboardSvg(projectAnalytics(w,'project',{at,timeZone:'UTC'}));assert(svg.includes('role="img"'));assert(!svg.includes('NaN'));assert(!svg.includes('Infinity'));
});

test('every project automatically exports a dashboard, native Pele map, analytic SVG and reusable templates',()=>{
 const w=demo(),before=JSON.stringify(w),files=obsidianFiles(w);
 for(const p of w.projects){assert(new RegExp('!\\[\\[Diagrams/'+p.id+'-mindmap-[a-f0-9]{16}\\.svg\\]\\]').test(files['Dashboards/'+p.id+'-static.md']));assert(files['Diagrams/'+p.id+'-mindmap.svg'].includes('pele-mindmap'));assert(files['Diagrams/'+p.id+'-dashboard.svg'].includes('Last 14 days'));assert(files['Projects/'+p.id+'.md'].includes('Open project dashboard'));}
 for(const title of ['Check-in','Decision','Evidence review'])assert(files['Templates/'+title+'.md']);
 for(const [name,contents]of Object.entries(files).filter(([name])=>name.startsWith('Dashboards/')&&name.endsWith('.md')))for(const link of contents.matchAll(/\[\[([^|\]]+)/g)){const target=link[1].replace(/\\$/,'');assert(files[target]||files[target+'.md']||files[target+'.canvas'],'Missing '+target+' in '+name);}
 assert.equal(JSON.stringify(w),before);
});

test('the bounded mindmap prioritises the newest decision instead of hiding it behind old choices',()=>{
 const {w,node}=fixture();for(let i=0;i<4;i++)w.nodes.push(node('old-choice-'+i,'decision','active'));
 const latest=node('obsidian-priority','decision','active',{title:'Obsidian is the primary workspace'});w.nodes.push(latest);event(w,'project','Changed the primary workspace',latest.id);
 const map=projectMindmap(w,'project');assert(map.nodeIds.includes(latest.id));assert(!map.nodeIds.includes('old-choice-0'));
});


test('native diagrams get new content addresses when evidence or activity changes',()=>{
 const {w}=fixture(),one=obsidianFiles(w),before=one['Dashboards/project-static.md'];
 event(w,'project','A meaningful new update','ready');w.nodes.find(n=>n.id==='ready').title='A changed task title';
 const two=obsidianFiles(w),after=two['Dashboards/project-static.md'];
 const refs=text=>[...text.matchAll(/!\[\[(Diagrams\/[^\]]+\.svg)\]\]/g)].map(m=>m[1]);
 const old=refs(before),next=refs(after);assert.equal(old.length,2);assert.equal(next.length,2);assert.notDeepEqual(old,next);for(const name of next)assert(two[name]);assert.deepEqual(refs(obsidianFiles(w)['Dashboards/project-static.md']),next);
});

test('native overview puts actionable work ahead of maps and distinguishes relationship types',()=>{
 const w=demo(),files=obsidianFiles(w),p=w.projects[0],note=files[`Dashboards/${p.id}-static.md`];
 assert(note.indexOf('## Ready to move')<note.indexOf('## Project mindmap'));
 assert(note.includes('[[Dashboards/index|All projects]]'));
 const canvas=JSON.parse(files[`Maps/${p.id}.canvas`]);
 const labels={depends_on:'must precede',branches_from:'offshoot',implements:'goal to work',informs:'context'};
 for(const edge of canvas.edges)assert.equal(edge.label,'');
 assert(files['Maps/'+p.id+'.md'].includes('## Connection key'));
});

test('sparse activity is compact and gains a trend only after two active days',()=>{
 const {w}=fixture();
 const empty=dashboardSvg(projectAnalytics(w,'project',{at,timeZone:'UTC'}));
 assert(empty.includes('viewBox="0 0 1100 395"'));assert(empty.includes('No saved updates yet'));assert(empty.includes('Work status'));assert(empty.includes('Luna proposals'));
 w.events.push({id:'a',projectId:'project',at:'2026-10-19T12:00:00Z',text:'one'});
 w.events.push({id:'b',projectId:'project',at:'2026-10-20T02:00:00Z',text:'two'});
 assert(dashboardSvg(projectAnalytics(w,'project',{at,timeZone:'UTC'})).includes('viewBox="0 0 1100 550"'));
});

test('focused Canvas keeps all context records and edges in its linked full view without mutating evidence',()=>{
 const {w,node}=fixture();
 const source=node('report-context','source','active');w.nodes.push(source);
 w.edges.push({id:'report-link',from:source.id,to:w.nodes[0].id,type:'informs'});
 const before=JSON.stringify(w),files=obsidianFiles(w),focused=JSON.parse(files['Maps/project.canvas']),full=JSON.parse(files['Maps/project-all.canvas']);
 assert(!focused.nodes.some(n=>n.id===source.id));
 for(const n of w.nodes)assert(full.nodes.some(c=>c.id===n.id));
 for(const e of w.edges)assert(full.edges.some(c=>c.id===e.id));
 assert(focused.nodes.some(n=>n.text.includes('Open every record and connection')));
 assert(focused.nodes.some(n=>n.text.includes('Connection key')));
 assert.equal(JSON.stringify(w),before);
});
