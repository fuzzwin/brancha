globalThis.BranchaHost={Plugin:class{},MarkdownRenderChild:class{constructor(el){this.containerEl=el;}registerEvent(){}},Notice:class{constructor(text){console.info(text);}}};
await import('/shared/renderer.js');
const {MapExplorer}=globalThis.BranchaRenderers;
const palette=[
 ['planned','○','An idea or suggested next step; not started.','#fff4da','#9a701f','#44391f','#d8b260'],
 ['active','▶','Work is underway.','#e6f0fa','#4b79a5','#263b50','#8ab4dc'],
 ['blocked','!','Cannot continue until the recorded blocker is resolved.','#fdece8','#ad554b','#492d2c','#e19b91'],
 ['reported_done','?','Completion was reported; evidence still needs review.','#fff0df','#ad7138','#483523','#dfb37d'],
 ['done','✓','Complete with recorded evidence; open the record to inspect it.','#e6f3e9','#548465','#273f30','#9dc5a5'],
 ['parked','Ⅱ','Deliberately set aside; kept for later.','#edf0ef','#788580','#303634','#a6b1ac'],
 ['unknown','–','No reliable status has been recorded yet.','#f2eff5','#897b96','#38313f','#b6a8c5'],
];
const labels={unknown:'Unknown',planned:'Proposed',active:'Active',blocked:'Blocked',reported_done:'Reported done',done:'Recorded complete',parked:'Parked'};
export function mapData(w,id){
 const project=w.projects.find(p=>p.id===id),ids=new Set(w.nodes.filter(n=>n.projectId===id).map(n=>n.id)),queue=[...ids];
 for(let i=0;i<queue.length;i++)for(const e of w.edges)if(e.type==='depends_on'&&e.to===queue[i]&&!ids.has(e.from)){ids.add(e.from);queue.push(e.from);}
 const nodes=w.nodes.filter(n=>ids.has(n.id)).map(n=>{let status=n.status;if(n.mapImport&&n.sourceStatus){if(/unknown|unconfirmed|not live verified|investigation step|proposed/i.test(n.sourceStatus))status='unknown';else if(status==='done')status='reported_done';}return {...n,statusId:status,status:labels[status]||status,external:n.projectId!==id,projectTitle:w.projects.find(p=>p.id===n.projectId)?.title,detail:[n.sourceStatus?'Recorded source status: '+n.sourceStatus:'',n.detail,n.evidence?'Evidence: '+n.evidence:'',n.rationale?'Decision reason: '+n.rationale:''].filter(Boolean).join('\n\n')};});
 const kinds=[['goals','Goals',['goal']],['work','Tasks',['task']],['decisions','Decisions',['decision']],['branches','Offshoots',['branch']],['outputs','Outputs',['output']],['sources','Evidence',['source']]];
 return {version:1,software:{appVersion:'0.22.0'},project,revision:w.revision,dependencyScopeComplete:true,nodes,edges:w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),groups:kinds.map(([id,title,types])=>({id,title,nodeIds:nodes.filter(n=>types.includes(n.type)).map(n=>n.id)})).filter(g=>g.nodeIds.length),statusKey:palette.map(([id,mark,description,fill,stroke,darkFill,darkStroke])=>({id,label:labels[id],mark,description,fill,stroke,darkFill,darkStroke})),analytics:{ready:[],waiting:[]}};
}
function evidence(w,path){const id=path.split('/').at(-1),n=w.nodes.find(n=>n.id===id);if(!n)return;const dialog=document.createElement('dialog'),heading=document.createElement('h2'),text=document.createElement('pre'),close=document.createElement('button');heading.textContent=n.title;text.textContent=[n.detail,n.evidence?'Evidence: '+n.evidence:'',n.next?'Next: '+n.next:''].filter(Boolean).join('\n\n');close.textContent='Close';close.onclick=()=>{dialog.close();dialog.remove();};dialog.style.cssText='width:min(90vw,900px);max-height:85vh';text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';dialog.append(heading,text,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();}
export function mountSharedMap(target,w,id,{selected=null,embedded=true,onMap=()=>{}}={}){
 target.replaceChildren();target.classList.add('bi','bi-embedded-map');const plugin={app:{vault:{adapter:{read:async()=>{throw Error('Use this project’s cloud tools to resume.');}}},workspace:{openLinkText:async path=>path.includes('/Items/')?evidence(w,path):onMap(id),getActiveFile:()=>null}}};
 const controller=new MapExplorer(target,plugin,id,'',undefined,{embedded});controller.data=mapData(w,id);controller.initialSelection=true;controller.mode='mindmap';controller.expanded=new Set(controller.data.groups.map(g=>g.id));if(selected){controller.selected=selected;controller.inspectorVisible=true;}controller.draw();
 return {destroy:()=>controller.onunload(),controller};
}
