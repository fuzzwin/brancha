import {createHash} from 'node:crypto';
import {render} from '../dist/vendor/pele-1.7.0.mjs';
import {flowLabel} from '../dist/core.mjs';
import {statusSvg} from './status.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const label=s=>String(s||'').replace(/["<>\[\]{}()\r\n]/g,' ').replaceAll('&','and').replace(/[*`#]/g,'').replace(/\s+/g,' ').slice(0,76);
export const receiptKey=(c,r)=>hash([c.projectId,c.sessionId,r.turnId||r.eventId||r.at].join(':'));
export const receiptPath=(c,r)=>`ChatLogs/${c.projectId}-${c.sessionId}/${receiptKey(c,r)}`;
export function chatMindmap(w,c){
 const items=[],groups=[['requests','Captured requests'],['replies','Saved replies'],['decisions','Decisions and suggestions'],['branches','Offshoots'],['work','Work and outcomes'],['files','Files and links']].map(([id,title])=>({id,title,itemIds:[]}));
 const add=(group,item)=>{items.push(item);groups.find(g=>g.id===group).itemIds.push(item.id);};
 const refs=reports=>reports.map(r=>({title:r.title.replace(/^Codex · /,''),at:r.at,turnId:r.turnId,logPath:receiptPath(c,r)}));
 for(const r of [...c.reports].reverse()){
  const key=receiptKey(c,r),source=refs([r]);
  add('replies',{id:'reply_'+key,kind:'reply',title:r.title.replace(/^Codex · /,''),at:r.at,summary:'Saved assistant report; outcomes need their own evidence.',sources:source});
  if(r.request)add('requests',{id:'request_'+key,kind:'request',title:r.request.slice(0,100),at:r.at,summary:r.request.slice(0,1000),sources:source});
 }
 const recordIds=new Map(c.records.map(n=>[n.id,'record_'+hash(n.id)]));
 for(const n of c.records){
  const report=c.reports.find(r=>n.source?.turnId&&r.turnId===n.source.turnId),group=n.type==='decision'?'decisions':n.type==='branch'?'branches':'work';
  const connections=w.edges.filter(e=>recordIds.has(e.from)&&recordIds.has(e.to)&&(e.from===n.id||e.to===n.id)).map(e=>({id:recordIds.get(e.from===n.id?e.to:e.from),label:(e.from===n.id?'Leads to · ':'Comes from · ')+flowLabel(e.type)}));
  add(group,{id:recordIds.get(n.id),kind:n.type,title:n.title,statusId:n.statusId,status:n.status,proposal:n.proposal,needsReview:n.needsReview,reviewReason:n.reviewReason,nodeId:n.id,summary:n.detail||'',quote:n.source?.quote||'',sourceTurn:n.source?.turnId||null,sources:report?refs([report]):[],connections});
 }
 for(const a of c.artifacts){
  const reports=c.reports.filter(r=>(a.sources||[a]).some(source=>source.turnId?r.turnId===source.turnId:source.eventId&&r.eventId===source.eventId));
  add('files',{id:'file_'+hash(a.url),kind:'file',title:a.label||a.url,url:a.url,summary:'Link mentioned in a saved report; existence and current contents have not been checked.',sources:refs([...reports].reverse())});
 }
 const populated=groups.filter(g=>g.itemIds.length),views={};
 const diagram=(title,branches,{overview=false,limit=5,preview=false}={})=>{
  const selected=[];const lines=['mindmap',`  cm_root(("${label(title)}"))`];
  for(const g of branches){lines.push(`    group_${g.id}[${label(g.title)} · ${g.itemIds.length}]`);if(overview)continue;const ordered=preview&&['decisions','branches','work'].includes(g.id)?[...g.itemIds].reverse().filter(id=>items.find(n=>n.id===id)?.statusId!=='parked'):g.itemIds;const ids=ordered.slice(0,limit);for(const id of ids){const n=items.find(n=>n.id===id);selected.push(n);lines.push(`      item_${id}[${label(preview&&n.title.length>54?n.title.slice(0,53)+'…':n.title)}${n.status?' · '+n.status:''}${n.proposal&&!preview?' · AI suggestion':''}]`);}if(g.itemIds.length>ids.length)lines.push(`      more_${g.id}[+ ${g.itemIds.length-ids.length} more · browse this group]`);}
  if(!branches.length)lines.push('    empty[No captured items yet]');
  const svg=render(lines.join('\n'),{fontSize:18,padding:28,images:false,links:false,responsive:true}).svg;
  return statusSvg(svg,selected.filter(n=>n.statusId).map(n=>({id:n.id,status:n.statusId})),{overview:true});
 };
 for(const g of populated)views[g.id]=diagram(g.title,[g]);
 const edges=w.edges.filter(e=>recordIds.has(e.from)&&recordIds.has(e.to)).map(e=>({...e,from:recordIds.get(e.from),to:recordIds.get(e.to)}));
 return {version:1,edges,overview:diagram(c.title,populated,{overview:true}),preview:diagram(c.title,populated,{limit:1,preview:true}),groups:populated,items,views,indexPath:`Chats/${c.projectId}-${c.sessionId}-index`,receiptCount:c.reports.length};
}
