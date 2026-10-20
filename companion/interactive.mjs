import {render} from '../dist/vendor/pele-1.7.0.mjs';
import {projectAnalytics, projectMindmap, statusLabel, flowLabel} from '../dist/core.mjs';
import {statusKey,statusSvg} from './status.mjs';
import {workstreamProgress} from './workstreams.mjs';
import {projectTimeline} from './timeline.mjs';
import {chatCatalog} from './chats.mjs';

const label=s=>String(s).replace(/["<>\[\]{}()\r\n]/g,' ').replaceAll('&','and').slice(0,74);
export function interactiveProject(w,p,overview,{chatTitles={}}={}){
 const nodes=w.nodes.filter(n=>n.projectId===p.id),ids=new Set(nodes.map(n=>n.id));
 const edges=w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const work=n=>!['source','goal','decision','branch'].includes(n.type);
 const groups=[
  ['goals','The goal',nodes.filter(n=>n.type==='goal')],
  ['work','Work in motion',nodes.filter(n=>work(n)&&!['done','parked'].includes(n.status))],
  ['decisions','Decisions',nodes.filter(n=>n.type==='decision')],
  ['branches','Offshoots',nodes.filter(n=>n.type==='branch')],
  ['outputs','Results',nodes.filter(n=>work(n)&&n.status==='done')],
  ['sources','Evidence and reports',nodes.filter(n=>n.type==='source')],
 ];
 const clean=n=>({id:n.id,title:n.title,type:n.type,status:statusLabel(n.status),statusId:n.status,proposal:!!n.mapper,needsReview:!!n.mapper?.needsReview,reviewReason:n.mapper?.reviewReason||'',detail:n.detail||'',next:n.next||''});
 const views={};
 const make=(key,title,seeds)=>{
  const seed=new Set(seeds.map(n=>n.id)),near=edges.filter(e=>seed.has(e.from)||seed.has(e.to));
  const wanted=new Set([...seed,...near.flatMap(e=>[e.from,e.to])]);
  const selected=[...seeds,...nodes.filter(n=>wanted.has(n.id)&&!seed.has(n.id))].slice(0,24);
  const chosen=new Set(selected.map(n=>n.id)),links=edges.filter(e=>chosen.has(e.from)&&chosen.has(e.to));
  const source=['flowchart LR',...selected.map(n=>`${n.id}["${label(n.title)} · ${statusKey.find(s=>s.id===n.status)?.mark||''} ${statusLabel(n.status)}${n.mapper?' · AI suggestion':''}"]`),
   ...links.map(e=>`${e.from} ${e.type==='informs'?'-.->':'-->'}|"${flowLabel(e.type)}"| ${e.to}`)].join('\n');
  views[key]={title,seedIds:[...seed],nodes:selected.map(n=>n.id),edges:links,total:wanted.size,
   svg:selected.length?statusSvg(render(source,{fontSize:18,padding:28,images:false,links:false,responsive:true}).svg,selected):null};
 };
 for(const [key,title,items]of groups)if(items.length)make('group_'+key,title,items);
 // Nodes use the same bounded neighbourhood, including prerequisite direction.
 for(const n of nodes)make('item_'+n.id,n.title,[n]);
 const compactSource=['mindmap',`  mm_root(("${label(p.title)}"))`,...groups.filter(g=>g[2].length).map(([id,title,ns])=>`    group_${id}[${label(title)} · ${ns.length}]`)];
 if(compactSource.length===2)compactSource.push('    empty[Start with the original brief]');
 const compactOverview=render(compactSource.join('\n'),{fontSize:18,padding:24,images:false,links:false,responsive:true}).svg;
 const workstreams=workstreamProgress(w,p.id);
 for(const stream of workstreams){const selected=new Set([stream.rootId,...stream.nodeIds]);make(stream.key,stream.title,nodes.filter(n=>selected.has(n.id)));}
 return {version:1,project:{id:p.id,title:p.title},revision:w.revision,analytics:projectAnalytics(w,p.id),
  statusKey,nodes:nodes.map(clean),edges,groups:groups.filter(g=>g[2].length).map(([id,title,ns])=>({id,title,nodeIds:ns.map(n=>n.id)})),
  chats:chatCatalog(w,{chatTitles}).filter(c=>c.projectId===p.id).map(c=>({title:c.title,path:c.path,reportCount:c.reportCount,summary:c.summary})),compactOverview,overview,shown:projectMindmap(w,p.id).shown,views,workstreams,timeline:projectTimeline(w,p.id)};
}
