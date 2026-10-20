import {statusLabel} from '../dist/core.mjs';

const clip=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const chatId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)?value:null;
export function projectTimeline(w,projectId,{at=new Date().toISOString(),limit=400}={}){
 const nodes=new Map(w.nodes.filter(n=>n.projectId===projectId).map(n=>[n.id,n]));
 const history=w.events.filter(e=>e.projectId===projectId&&Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)<=Date.parse(at))
  .map((e,index)=>({e,index})).sort((a,b)=>Date.parse(a.e.at)-Date.parse(b.e.at)||a.index-b.index);
 const allItems=history.map(({e})=>{
  // Use the event's saved snapshot. A live checkpoint can have been replaced
  // by a later turn, so its current text must never stand in for past content.
  const snapshot=e.capture||e.after||null,current=nodes.get(e.nodeId);
  const mapped=e.mapperJobId&&current?.mapper?.jobId===e.mapperJobId?current.mapper:null;
  const provenance=snapshot?.capture||snapshot?.mapper||mapped;
  const sessionId=chatId(provenance?.sessionId),provider=snapshot?.capture?.provider||(snapshot?.mapper||mapped?'codex':null);
  const kind=e.capture?'checkpoint':e.mapperJobId?'proposal':snapshot?.type==='decision'?'decision':snapshot?.type==='branch'?'branch':snapshot?.type==='output'?'result':/^(Connected |Removed .* connection)/.test(e.text)?'connection':'update';
  const changes=[];
  if(e.before?.status&&snapshot?.status&&e.before.status!==snapshot.status)changes.push(`${statusLabel(e.before.status)} → ${statusLabel(snapshot.status)}`);
  if(e.before&&snapshot&&e.before.next!==snapshot.next&&snapshot.next)changes.push('Next action changed');
  return {id:e.id,at:e.at,kind,title:clip(e.text||'Saved update',240),text:clip(e.text,6000),
   nodeId:current?.id||null,sessionId,provider,turnId:chatId(provenance?.turnId),
   snapshot:snapshot&&typeof snapshot.title==='string'?{title:clip(snapshot.title,500),detail:clip(snapshot.detail,6000),evidence:clip(snapshot.evidence,3000),next:clip(snapshot.next,1500),status:statusLabel(snapshot.status),proposal:!!snapshot.mapper||!!e.mapperJobId}:null,changes};
 });
 const items=limit===Infinity?allItems:allItems.slice(-Math.max(1,Math.min(1000,limit)));
 const chats=new Map();for(const e of allItems)if(e.sessionId){const chat=chats.get(e.sessionId)||{id:e.sessionId,provider:e.provider,count:0};chat.count++;chats.set(e.sessionId,chat);}
 const created=w.projects?.find(p=>p.id===projectId)?.createdAt;
 const dates=[created,history[0]?.e.at].filter(v=>Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.parse(at));
 const startedAt=dates.sort((a,b)=>Date.parse(a)-Date.parse(b))[0]||at;
 const chatStarts={};for(const e of allItems)if(e.sessionId&&!chatStarts[e.sessionId])chatStarts[e.sessionId]=e.at;
 const points=allItems.map(({id,at,kind,title,nodeId,sessionId,provider,turnId})=>({id,at,kind,title,nodeId,sessionId,provider,turnId}));
 return {startedAt,chatStarts,points,archiveRevision:w.revision??0,items,chats:[...chats.values()],total:history.length,loaded:items.length,truncated:items.length<history.length,at};
}
