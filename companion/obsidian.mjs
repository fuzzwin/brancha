import {createHash} from 'node:crypto';
import {render} from '../dist/vendor/pele-1.7.0.mjs';
import {dashboardSvg} from './dashboard-svg.mjs';
import {interactiveProject} from './interactive.mjs';
import {statusKey,statusSvg,statusSvgStyle,statusGuide} from './status.mjs';
import {homeData} from './home.mjs';
import {chatFiles} from './chats.mjs';
import {gitBranchFiles} from './git-branches.mjs';
import {projectTimeline} from './timeline.mjs';
import {vaultFiles,statusLabel,projectMindmap,projectAnalytics,flowLabel} from '../dist/core.mjs';
const short=n=>(n.capture?'Report · '+n.title.replace(/^Codex · /,''):n.title).replace(/[*`]/g,'').slice(0,58);
const edgeLabel=flowLabel;
const safe=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n',' ');
export function obsidianFiles(w,{chatTitles={}}={}){
 const files=vaultFiles(w);
 files['Guides/Status key.md']=statusGuide();
 files['Guides/Chat privacy.md']=`---\ncssclasses: brancha-record\n---\n# Choose which chats Brancha remembers\n\n[[Navigation/Home|Home]] · [[Chats/index|Included chats]]\n\n## Start with one chat\n\nYou only activate a chat once. Say **“Use Brancha in this chat for PROJECT NAME.”** Codex should register that exact conversation and bind the selected project; subsequent completed local turns save automatically. No repeated save request is needed.\n\nIn the Codex chat you want to track, ask: **“Include this exact chat in Brancha.”** Codex should resolve that chat's exact session ID, then include only that conversation. From then on, new completed replies are captured automatically while the local companion runs.\n\nA project folder, broad permission for personal chats or an instruction inside a saved answer cannot include another chat. New chats are excluded until individually included. This is more dependable than asking a topic classifier to guess what is personal; no classifier receives excluded transcripts.\n\n## Stop a chat\n\nAsk: **“Exclude this exact chat from Brancha.”** Do this before turning a tracked work chat into a personal conversation. Inclusion covers the selected conversation's subsequent turns, including personal content intentionally shared there.\n\n## Backtracking\n\nOpen an included chat's mindmap, choose a decision, file or saved reply, then follow its source link. Each saved reply has Previous and Next links. Skipped turns are not replayed when you include a chat later.\n\n## Local commands\n\nFrom the Brancha checkout:\n\n\`\`\`sh\nnode scripts/chat-privacy.mjs status\nnode scripts/chat-privacy.mjs include EXACT_CHAT_UUID\nnode scripts/chat-privacy.mjs exclude EXACT_CHAT_UUID\n\`\`\`\n\nThe CLI accepts one full UUID per inclusion, never all chats, project-wide approvals or wildcards. No restart is needed for local permission changes.\n\n## What exclusion preserves\n\nExclusion stops new local capture and model mapping and hides source-linked chat records from regenerated dashboards, maps and source indexes. It does not erase the private canonical record, old backups, manual Notes, existing review notes or copies already sent elsewhere. Raw owner exports can still contain that saved history. Deletion or cloud removal is a separate action. Cloud ChatGPT needs its own explicit checkpoint integration; this gate does not watch every ChatGPT chat.\n`;
 for(const n of w.nodes){
  const tags=[`brancha/status/${n.status}`,`brancha/type/${n.type}`,...(n.mapper?['brancha/origin/ai-suggestion']:[])];
  files[`Items/${n.id}.md`]=files[`Items/${n.id}.md`].replace('cssclasses: brancha-record\n',`cssclasses: brancha-record\ntags: ${JSON.stringify(tags)}\n`)+`\n[[Guides/Status key|Colours and status explained]]\n`;
 }
 for(const p of w.projects){
  const m=projectMindmap(w,p.id),a=projectAnalytics(w,p.id),rendered=render(m.source.replace(/^(\s+item_([a-zA-Z0-9_-]+)\[)(.*)\]$/gm,(line,prefix,id,title)=>{const n=w.nodes.find(n=>n.id===id);return n?`${prefix}${title} · ${statusKey.find(s=>s.id===n.status)?.mark||''} ${statusLabel(n.status)}]`:line;}),{fontSize:18,padding:30,images:false,links:false,responsive:true});
  const theme='<style>svg{--pele-bg:transparent;--pele-fg:#294236;--pele-border:#9daf95;--pele-surface:#f0f5e9;--pele-radius:9px;--pele-series-1:#7c9b6f;--pele-series-2:#b29564;--pele-series-3:#7896a4;--pele-series-4:#a78db5;--pele-series-5:#b5927d;--pele-series-6:#7d9d91}@media(prefers-color-scheme:dark){svg{--pele-fg:#dce8d7;--pele-surface:#29372d;--pele-border:#7c9375}}</style>';
  files[`Diagrams/${p.id}-mindmap.svg`]=statusSvg(rendered.svg,w.nodes.filter(n=>n.projectId===p.id),{overview:true}).replace(/(<svg[^>]*>)/,'$1'+theme+statusSvgStyle());
  files[`Diagrams/${p.id}-dashboard.svg`]=dashboardSvg({...a,mappedProposals:w.nodes.filter(n=>n.projectId===p.id&&n.mapper&&n.status==='planned').length});
  const asset=(kind,svg)=>{const name=`Diagrams/${p.id}-${kind}-${createHash('sha256').update(svg).digest('hex').slice(0,16)}.svg`;files[name]=svg;return name;};
  const mindmapAsset=asset('mindmap',files[`Diagrams/${p.id}-mindmap.svg`]),chartAsset=asset('dashboard',files[`Diagrams/${p.id}-dashboard.svg`]);
  files[`Dashboards/${p.id}.md`]=files[`Dashboards/${p.id}.md`].replace(/```mermaid\n[\s\S]*?\n```/,`![[${mindmapAsset}]]`).replace('## At a glance\n\n',`## At a glance\n\n![[${chartAsset}]]\n\n`);
  files[`Dashboards/${p.id}.md`]=files[`Dashboards/${p.id}.md`].replace(/\| Goals with evidence \| Work ready \| Waiting on prerequisites \| Reports to review \|\n\| --- \| --- \| --- \| --- \|\n\|[^\n]+\n/,'').replace(/\| Date \| Updates \|\n\| --- \| --- \|\n(?:\| \d{4}-[^\n]+\n)+/,'');
  const note=files[`Dashboards/${p.id}.md`],parts=note.split(/(?=^## )/m),sections=new Map(parts.slice(1).map(part=>[part.split('\n')[0],part]));
  const header=parts[0].replace('[[Maps/', '[[Dashboards/index|All projects]] · [[Maps/');
  const rhythm=sections.get('## Work rhythm · last 14 days')?.replace(/## Work rhythm[^\n]+\n/,'## Recent updates\n')||'';
  const recent=a.recent.map(e=>{const title=(e.text||'Saved update').replace(/[\r\n|\[\]]/g,' ').slice(0,120);return `- ${new Date(e.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · [[Activity/${e.at.slice(0,10)}|${title}]]`;}).join('\n');
  files[`Dashboards/${p.id}.md`]=header+[sections.get('## At a glance'),sections.get('## Ready to move'),sections.get('## Needs a look'),sections.get('## Project mindmap'),rhythm+recent+'\n\n',sections.get('## Decisions and offshoots'),sections.get('## Latest evidence and reports'),sections.get('## Next check-in')].filter(Boolean).join('');
 }
 for(const p of w.projects){
  const nodes=w.nodes.filter(n=>n.projectId===p.id),ids=new Set(nodes.map(n=>n.id)),edges=w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
  const source=['flowchart LR',...nodes.map(n=>`${n.id}["${safe(short(n))} · ${statusLabel(n.status)}${n.mapper?' · AI suggestion':''}"]`),...edges.map(e=>`${e.from} ${e.type==='informs'?'-.->':'-->'}${['depends_on','branches_from'].includes(e.type)?'|"'+edgeLabel(e.type)+'"|':''} ${e.to}`)].join('\n');
  if(!nodes.length)continue;
  const diagram=render(source,{fontSize:18,padding:32,images:false,links:false,responsive:true});
  let svg=statusSvg(diagram.svg,nodes);const theme='<style>svg{--pele-bg:transparent;--pele-fg:#253a33;--pele-line:#85998f;--pele-surface:#eef3ef;--pele-border:#97aaa0;--pele-radius:10px}.pele-edge{stroke-width:1.2}@media(prefers-color-scheme:dark){svg{--pele-fg:#e1eae5;--pele-line:#7e9489;--pele-surface:#25312c;--pele-border:#708d7e}}</style>';
  svg=svg.replace(/(<svg[^>]*>)/,'$1'+theme+statusSvgStyle());
  files[`Diagrams/${p.id}.svg`]=svg;
  const flowAsset=`Diagrams/${p.id}-flow-${createHash('sha256').update(svg).digest('hex').slice(0,16)}.svg`;files[flowAsset]=svg;
  files[`Maps/${p.id}.md`]=`---\ncssclasses: brancha-map\n---\n# ${p.title}\n\n![[${flowAsset}]]\n\nArrows run from prerequisite to dependent. “Must precede” is a work dependency; “goal to work” links scope; “offshoot” branches the idea; dotted “context” lines do not block work.\n\n[[Guides/Status key|Colours and status explained]] · [[Maps/${p.id}.canvas|Open the editable Canvas →]] · [[Projects/${p.id}|Original brief and progress]]\n\n## Details behind the map\n${nodes.map(n=>`- [[Items/${n.id}|${short(n)}]] — ${statusLabel(n.status)}`).join('\n')}\n`;
  const centres=new Map();for(const m of diagram.svg.matchAll(/<g class="pele-node [^"]*" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)"/g))centres.set(m[1],{x:Number(m[2]),y:Number(m[3])});
  if(centres.size===nodes.length){
   let scale=1.4;const width=290,height=160;
   const columns=[...new Set([...centres.values()].map(c=>c.x))].sort((a,b)=>a-b);
   const columnX=x=>columns.indexOf(x)*(width+130);
   for(let attempt=0;attempt<10;attempt++){let overlap=false;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=centres.get(nodes[i].id),b=centres.get(nodes[j].id);if(Math.abs(columnX(a.x)-columnX(b.x))<width+85&&Math.abs(a.y-b.y)*scale<height+60)overlap=true;}if(!overlap)break;scale*=1.25;}
   files[`Maps/${p.id}.canvas`]=JSON.stringify({nodes:nodes.map(n=>({id:n.id,type:'text',text:`**${short(n)}**\n\n${statusLabel(n.status)}${n.mapper?' · AI suggestion':''} · ${n.type}\n\n[[Items/${n.id}|Details →]]`,x:columnX(centres.get(n.id).x),y:Math.round(centres.get(n.id).y*scale-height/2),width,height,color:({done:'4',blocked:'1',active:'5',parked:'#8a9690',unknown:'#a193ad',planned:'3',reported_done:'2'})[n.status]||'3'})),edges:edges.map(e=>({id:e.id,fromNode:e.from,fromSide:'right',toNode:e.to,toSide:'left',toEnd:'arrow',label:'',color:({depends_on:'1',branches_from:'6',implements:'4',informs:'3'})[e.type]}))},null,2);
  }
  const canvas=JSON.parse(files[`Maps/${p.id}.canvas`]);
  let legendId='brancha_legend_'+p.id;while(ids.has(legendId))legendId+='_';
  const legend={id:legendId,type:'text',text:`### Status and connections\n\nCards: blue active · green complete · yellow proposed · red blocked · grey parked.\n\n[[Guides/Status key|Full status key →]]\n\n**Red:** prerequisite → dependent\n**Purple:** parent → offshoot\n**Green:** goal → work\n**Yellow:** context (does not block)\n\n[[Maps/${p.id}#Connection key|Full relationship table →]]`,x:0,y:-410,width:380,height:370};
  const secondary=new Set(nodes.filter(n=>n.type==='source'||n.mapper).map(n=>n.id));
  const workCards=canvas.nodes.filter(n=>!secondary.has(n.id));
  const workIds=new Set(workCards.map(n=>n.id));
  const columns=[...new Set(workCards.map(n=>n.x))].sort((a,b)=>a-b),groups=columns.map(x=>workCards.filter(n=>n.x===x).sort((a,b)=>a.y-b.y));let column=0;
  for(const cards of groups){for(let i=0;i<cards.length;i++){cards[i].x=(column+Math.floor(i/3))*420;cards[i].y=i%3*210;}column+=Math.ceil(cards.length/3);}
  if(secondary.size){
   // The complete Canvas retains every record and edge; the default stays readable.
   const complete=JSON.parse(files[`Maps/${p.id}.canvas`]);
   complete.nodes.push({...legend,x:Math.min(...complete.nodes.map(n=>n.x)),y:Math.min(...complete.nodes.map(n=>n.y))-410});
   files[`Maps/${p.id}-all.canvas`]=JSON.stringify(complete,null,2);
   workCards.push({id:legendId+'_context',type:'text',text:`### Working map\n\n${workIds.size} work and goal records shown.\n\n${secondary.size} source reports and mapped proposals are in the full record map.\n\n[[Maps/${p.id}-all.canvas|Open every record and connection →]]`,x:420,y:-260,width:420,height:220});
   files[`Maps/${p.id}.md`]+=`\n[[Maps/${p.id}-all.canvas|Full record Canvas, including sources and mapped proposals →]]\n`;
  }
  files[`Maps/${p.id}.canvas`]=JSON.stringify({nodes:[...workCards,legend],edges:canvas.edges.filter(e=>workIds.has(e.fromNode)&&workIds.has(e.toNode))},null,2);
  files[`Projects/${p.id}.md`]=files[`Projects/${p.id}.md`].replace(`[[Maps/${p.id}.canvas|Open this project map →]]`,`[[Maps/${p.id}|Open the dependency mindmap →]] · [[Maps/${p.id}.canvas|Canvas]]`);
  const clean=s=>String(s).replaceAll('|','/').replaceAll('\n',' ');
  files[`Maps/${p.id}.md`]+=`\n## Connection key\n\nCanvas arrow colours: red = prerequisite, purple = offshoot, green = goal to work, yellow = context. Labels are kept off Canvas paths to avoid collisions.\n\n| From | Relationship | To |\n|---|---|---|\n${edges.map(e=>`| [[Items/${e.from}\\|${clean(short(nodes.find(n=>n.id===e.from)))}]] | ${edgeLabel(e.type)} | [[Items/${e.to}\\|${clean(short(nodes.find(n=>n.id===e.to)))}]] |`).join('\n')}\n`;
  const sessions=[...new Set(nodes.filter(n=>n.mapper&&/^[a-zA-Z0-9_-]{1,100}$/.test(n.mapper.sessionId)).map(n=>n.mapper.sessionId))];
  if(sessions.length){
   files[`Dashboards/${p.id}.md`]+=`\n## Conversation maps\n\n${sessions.map(id=>`- [[Conversations/${id}|Chat ${id.slice(0,8)} — mapped choices and branches]]`).join('\n')}\n\nLuna-mapped items remain proposals until you review their source.\n`;
   for(const session of sessions){
    const mapped=nodes.filter(n=>n.mapper?.sessionId===session),selected=mapped.slice(-12),set=new Set(selected.map(n=>n.id));
    const lines=['flowchart TD','conversation_root["Conversation - shared source context"]',...selected.map(n=>`${n.id}["${safe(short(n))}"]`),...selected.map(n=>`conversation_root -->|"${n.type==='branch'?'offshoot':'choice to review'}"| ${n.id}`),...edges.filter(e=>set.has(e.from)&&set.has(e.to)).map(e=>`${e.from} -->|"${edgeLabel(e.type)}"| ${e.to}`)];
    const picture=render(lines.join('\n'),{fontSize:18,padding:24,images:false,links:false,responsive:true});
    const chatSvg=picture.svg.replace(/(<svg[^>]*>)/,'$1'+theme);
    const name=`Diagrams/${p.id}-chat-${createHash('sha256').update(session).digest('hex').slice(0,12)}-${createHash('sha256').update(chatSvg).digest('hex').slice(0,16)}.svg`;files[name]=chatSvg;
    files[`Conversations/${session}.md`]=`---\ncssclasses: brancha-map\n---\n# Conversation map · ${p.title}\n\n[Open source chat](codex://threads/${session}) · [[Dashboards/${p.id}|Project dashboard]]\n\n${mapped.length} mapped proposals; overview shows the latest ${selected.length}. These are extracted interpretations, not accepted decisions or verified outcomes.\n\n![[${name}]]\n\n${mapped.map(n=>`## ${clean(n.title)}\n\n[[Items/${n.id}|Open record and evidence]] · ${n.type} · ${n.status==='parked'?'Parked extraction':'Mapped proposal'}\n\n${n.detail}\n\n> ${String(n.mapper.quote).replaceAll('\n','\n> ')}\n\nSource turn: ${n.mapper.turnId}\n`).join('\n')}`;
   }
  }
 }
 for(const p of w.projects){
  const interactive=interactiveProject(w,p,files[`Diagrams/${p.id}-mindmap.svg`],{chatTitles});
  files[`TimelineHistory/${p.id}.json`]=JSON.stringify({version:1,projectId:p.id,revision:w.revision??0,items:projectTimeline(w,p.id,{limit:Infinity}).items});
  files[`Interactive/${p.id}.json`]=JSON.stringify(interactive);
  files[`Explorers/${p.id}.md`]=`---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n\`\`\`brancha-map\n${p.id}\n\`\`\`\n\n[[Dashboards/${p.id}|Back to project dashboard]] · [[Maps/${p.id}|Portable map]]\n`;
  files[`Timelines/${p.id}.md`]=`---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n\`\`\`brancha-timeline\n${p.id}\n\`\`\`\n\n[[Dashboards/${p.id}|Project dashboard]] · [[Timelines/${p.id}-history|Portable saved history]]\n\n## Chat timelines\n\n${interactive.timeline.chats.map(c=>`- [[Timelines/${p.id}-${c.id}|Chat ${c.id.slice(0,8)} · ${c.count} saved updates]]`).join('\n')||'No source chat IDs have been recorded for this project yet.'}\n`;
  const historyText=interactive.timeline.items.slice().reverse().map(e=>`## ${e.at}\n\n${e.text}\n\n${e.snapshot?e.snapshot.detail+'\n\n':''}${e.nodeId?'[[Items/'+e.nodeId+'|Open current record]]':''}`).join('\n\n');
  files[`Timelines/${p.id}-history.md`]=`---\ncssclasses: brancha-record\n---\n# Saved history · ${p.title}\n\n${interactive.timeline.loaded} of ${interactive.timeline.total} saved updates, newest first. These are saved checkpoints and changes, not measured work durations.\n\n[[Timelines/${p.id}|Interactive timeline]] · [[Dashboards/${p.id}|Dashboard]]\n\n${historyText||'No saved updates yet.'}\n`;
  for(const chat of interactive.timeline.chats){
   files[`Timelines/${p.id}-${chat.id}.md`]=`---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n\`\`\`brancha-timeline\n${p.id}\n${chat.id}\n\`\`\`\n\n[[Timelines/${p.id}|All project history]] · [[Timelines/${p.id}-history|Portable saved history]]\n`;
   const conversation=`Conversations/${chat.id}.md`;
   if(!files[conversation])files[conversation]=`---\ncssclasses: brancha-record\n---\n# Captured chat · ${p.title}\n\n[[Dashboards/${p.id}|Project dashboard]]\n\n`;
   files[conversation]+=`\n[[Timelines/${p.id}-${chat.id}|Open this chat’s interactive timeline →]]\n`;
  }
  files[`Dashboards/${p.id}-static.md`]=files[`Dashboards/${p.id}.md`];
  files[`Dashboards/${p.id}.md`]=`---\ncssclasses: [brancha-dashboard, brancha-interactive]\nbrancha_title: ${JSON.stringify(p.title)}\nbrancha_project: ${JSON.stringify(p.id)}\n---\n\`\`\`brancha-interactive\n${p.id}\n\`\`\`\n\n[[Dashboards/${p.id}-static|Portable dashboard and full notes]] · [[Dashboards/index|All projects]]\n\nRequires the local **Brancha Interactive** Obsidian plugin. The portable dashboard works without it.\n`;
 }
 Object.assign(files,gitBranchFiles(w,{chatTitles}));
 for(const p of w.projects)files[`Dashboards/${p.id}.md`]=files[`Dashboards/${p.id}.md`].replace('```brancha-interactive','[[Branches/'+p.id+'|Git branch history]]\n\n```brancha-interactive');
 Object.assign(files,chatFiles(w,{chatTitles}));
 files['Interactive/home.json']=JSON.stringify(homeData(w,{chatTitles}));
 files['Interactive/chats.json']=JSON.stringify(homeData(w,{chatTitles,chatLimit:1000}));
 files['Chats/index.md']='---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n```brancha-chats\n```\n';
 files['Navigation/Home.md']='---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n```brancha-home\n```\n\n[[Dashboards/index-static|Plain project list]]\n';
 files['Dashboards/index-static.md']=files['Dashboards/index.md'];
 files['Dashboards/index.md']='---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n```brancha-home\n```\n\n[[Navigation/Home|Home]] · [[Dashboards/index-static|Plain project list]]\n';
 for(const name of Object.keys(files))if(name.endsWith('.md')&&!files[name].includes('[[Navigation/Home|Home]]'))files[name]=files[name].replace(/^(---\n[\s\S]*?\n---\n)?/,match=>match+'\n[[Navigation/Home|Home]]\n\n');
 const overview=JSON.parse(files['Brancha.canvas']);for(const n of overview.nodes)n.text=n.text.replace(/\[\[Maps\/([^|]+)\.canvas\|Open project map →\]\]/g,'[[Maps/$1|Open dependency mindmap →]]');for(const n of overview.nodes)n.text=n.text.replace('[[Maps/'+n.id+'|Open dependency mindmap →]]','[[Dashboards/'+n.id+'|Open project dashboard →]]');files['Brancha.canvas']=JSON.stringify(overview,null,2);for(const name of Object.keys(files))if(name.endsWith('.md'))files[name]=files[name].replace(/!?\[([^\]]*)\]\((\/(?:Users|home|Volumes|var)\/[^)\n]+)\)/g,(_,label,local)=>`[${label}](file://${encodeURI(local)})`);return files;
}
