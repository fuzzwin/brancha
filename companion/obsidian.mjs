import {render} from '../dist/vendor/pele-1.7.0.mjs';
import {dashboardSvg} from './dashboard-svg.mjs';
import {vaultFiles,statusLabel,projectMindmap,projectAnalytics} from '../dist/core.mjs';
const short=n=>n.capture?'Latest Codex checkpoint':n.title.replace(/[*`]/g,'').slice(0,58);
const safe=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n',' ');
export function obsidianFiles(w){
 const files=vaultFiles(w);
 for(const p of w.projects){
  const m=projectMindmap(w,p.id),a=projectAnalytics(w,p.id),rendered=render(m.source,{fontSize:18,padding:30,images:false,links:false,responsive:true});
  const theme='<style>svg{--pele-bg:transparent;--pele-fg:#294236;--pele-border:#9daf95;--pele-surface:#f0f5e9;--pele-radius:9px;--pele-series-1:#7c9b6f;--pele-series-2:#b29564;--pele-series-3:#7896a4;--pele-series-4:#a78db5;--pele-series-5:#b5927d;--pele-series-6:#7d9d91}@media(prefers-color-scheme:dark){svg{--pele-fg:#dce8d7;--pele-surface:#29372d;--pele-border:#7c9375}}</style>';
  files[`Diagrams/${p.id}-mindmap.svg`]=rendered.svg.replace(/(<svg[^>]*>)/,'$1'+theme);
  files[`Diagrams/${p.id}-dashboard.svg`]=dashboardSvg(a);
  files[`Dashboards/${p.id}.md`]=files[`Dashboards/${p.id}.md`].replace(/```mermaid\n[\s\S]*?\n```/,`![[Diagrams/${p.id}-mindmap.svg]]`).replace('## At a glance\n\n',`## At a glance\n\n![[Diagrams/${p.id}-dashboard.svg]]\n\n`);
  files[`Dashboards/${p.id}.md`]=files[`Dashboards/${p.id}.md`].replace(/(## At a glance[\s\S]*?)(## Project mindmap[\s\S]*?)(## Work rhythm)/,'$2\n$1\n$3').replace(/\| Goals with evidence \| Work ready \| Waiting on prerequisites \| Reports to review \|\n\| --- \| --- \| --- \| --- \|\n\|[^\n]+\n/,'').replace(/\| Date \| Updates \|\n\| --- \| --- \|\n(?:\| \d{4}-[^\n]+\n)+/,'');
 }
 for(const p of w.projects){
  const nodes=w.nodes.filter(n=>n.projectId===p.id),ids=new Set(nodes.map(n=>n.id)),edges=w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
  const source=['flowchart LR',...nodes.map(n=>`${n.id}["${safe(short(n))} · ${statusLabel(n.status)}"]`),...edges.map(e=>`${e.from} ${e.type==='informs'?'-.->':'-->'}${e.type==='depends_on'?'|"before"|':e.type==='branches_from'?'|"branch"|':''} ${e.to}`)].join('\n');
  if(!nodes.length)continue;
  const diagram=render(source,{fontSize:18,padding:32,images:false,links:false,responsive:true});
  let svg=diagram.svg;const theme='<style>svg{--pele-bg:transparent;--pele-fg:#253a33;--pele-line:#85998f;--pele-surface:#eef3ef;--pele-border:#97aaa0;--pele-radius:10px}.pele-edge{stroke-width:1.2}.pele-node[data-status="done"]{--_s:#e7f2e9;--_b:#76a084}.pele-node[data-status="blocked"]{--_s:#f7e9e5;--_b:#bb897b}@media(prefers-color-scheme:dark){svg{--pele-fg:#e1eae5;--pele-line:#7e9489;--pele-surface:#25312c;--pele-border:#708d7e}.pele-node[data-status="done"]{--_s:#21372b;--_b:#749f80}.pele-node[data-status="blocked"]{--_s:#442d28;--_b:#bb897b}}</style>';
  svg=svg.replace(/(<svg[^>]*>)/,'$1'+theme);
  for(const n of nodes)svg=svg.replace(`data-id="${n.id}" transform=`,`data-id="${n.id}" data-status="${n.status}" transform=`);
  files[`Diagrams/${p.id}.svg`]=svg;
  files[`Maps/${p.id}.md`]=`---\ncssclasses: brancha-map\n---\n# ${p.title}\n\n![[Diagrams/${p.id}.svg]]\n\nDependencies flow left to right. Dotted lines add context; branches keep offshoots visible.\n\n[[Maps/${p.id}.canvas|Open the editable Canvas →]] · [[Projects/${p.id}|Original brief and progress]]\n\n## Details behind the map\n${nodes.map(n=>`- [[Items/${n.id}|${short(n)}]] — ${statusLabel(n.status)}`).join('\n')}\n`;
  const centres=new Map();for(const m of diagram.svg.matchAll(/<g class="pele-node [^"]*" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)"/g))centres.set(m[1],{x:Number(m[2]),y:Number(m[3])});
  if(centres.size===nodes.length){
   let scale=1.4;const width=290,height=160;
   const columns=[...new Set([...centres.values()].map(c=>c.x))].sort((a,b)=>a-b);
   const columnX=x=>columns.indexOf(x)*(width+130);
   for(let attempt=0;attempt<10;attempt++){let overlap=false;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=centres.get(nodes[i].id),b=centres.get(nodes[j].id);if(Math.abs(columnX(a.x)-columnX(b.x))<width+85&&Math.abs(a.y-b.y)*scale<height+60)overlap=true;}if(!overlap)break;scale*=1.25;}
   files[`Maps/${p.id}.canvas`]=JSON.stringify({nodes:nodes.map(n=>({id:n.id,type:'text',text:`**${short(n)}**\n\n${statusLabel(n.status)} · ${n.type}\n\n[[Items/${n.id}|Details →]]`,x:columnX(centres.get(n.id).x),y:Math.round(centres.get(n.id).y*scale-height/2),width,height,color:({done:'4',blocked:'1',active:'5',parked:'6'})[n.status]||'3'})),edges:edges.map(e=>({id:e.id,fromNode:e.from,fromSide:'right',toNode:e.to,toSide:'left',toEnd:'arrow',...(e.type==='depends_on'?{label:'before'}:e.type==='branches_from'?{label:'branch'}:{})}))},null,2);
  }
  files[`Projects/${p.id}.md`]=files[`Projects/${p.id}.md`].replace(`[[Maps/${p.id}.canvas|Open this project map →]]`,`[[Maps/${p.id}|Open the dependency mindmap →]] · [[Maps/${p.id}.canvas|Canvas]]`);
 }
 const overview=JSON.parse(files['Brancha.canvas']);for(const n of overview.nodes)n.text=n.text.replace(/\[\[Maps\/([^|]+)\.canvas\|Open project map →\]\]/g,'[[Maps/$1|Open dependency mindmap →]]');for(const n of overview.nodes)n.text=n.text.replace('[[Maps/'+n.id+'|Open dependency mindmap →]]','[[Dashboards/'+n.id+'|Open project dashboard →]]');files['Brancha.canvas']=JSON.stringify(overview,null,2);for(const name of Object.keys(files))if(name.endsWith('.md'))files[name]=files[name].replace(/!?\[([^\]]*)\]\((\/(?:Users|home|Volumes|var)\/[^)\n]+)\)/g,(_,label,local)=>`[${label}](file://${encodeURI(local)})`);return files;
}
