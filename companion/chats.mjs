import {visibleUserText} from '../adapters/conversation-mapper.mjs';
import {statusLabel} from '../dist/core.mjs';
import {projectTimeline} from './timeline.mjs';
import {chatMindmap,receiptPath} from './chat-map.mjs';
import {statusKey} from './status.mjs';
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
const text=(s,max=400)=>String(s||'').replace(/(?:^|\n)\s*(?:<small>?\s*)?[*_]*(?:Usage\b|Tokens:)[\s\S]*$/i,'').replace(/<[^>\n]+>/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*`#>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const reportBody=s=>String(s||'').replace(/^AUTOMATIC CHECKPOINT[^\n]*\n*/,'').trim();
const provenance=n=>n?.capture||(n?.mapper?{...n.mapper,provider:n.mapper.provider||'codex'}:n?.checkpoint);
export const chatPath=(projectId,sessionId)=>`Chats/${projectId}-${sessionId}`;
function links(report){
 const out=[];
 for(const m of report.matchAll(/\[([^\]\n]{1,200})\]\((?:<([^>\n]+)>|([^\n]+?))\)/g)){
  let target=(m[2]||m[3]).trim();
  if(!/^(?:https?:\/\/|file:\/\/|\/(?!\/)|[A-Za-z]:[\\/])/.test(target)||/[\u0000-\u001f]/.test(target))continue;
  if(target.startsWith('/'))target='file://'+encodeURI(target);
  if(/^[A-Za-z]:[\\/]/.test(target))target='file:///'+encodeURI(target.replaceAll('\\','/'));
  out.push({label:text(m[1],200),url:target});
 }
 return out;
}
export function chatCatalog(w,{at=new Date().toISOString(),chatTitles={}}={}){
 const entries=new Map(),projects=new Map(w.projects.map(p=>[p.id,p]));
 const ensure=(projectId,pv)=>{if(!projects.has(projectId)||!valid(pv?.sessionId))return null;const key=projectId+'-'+pv.sessionId;let c=entries.get(key);if(!c){c={projectId,projectTitle:projects.get(projectId).title,sessionId:pv.sessionId,provider:pv.provider||'unknown',reports:[],records:[]};entries.set(key,c);}return c;};
 for(const e of w.events){if(!Number.isFinite(Date.parse(e.at))||Date.parse(e.at)>Date.parse(at))continue;const snapshot=e.capture||(e.checkpointId?e.after:null);const pv=provenance(snapshot);if(snapshot&&pv){const c=ensure(e.projectId,pv);if(c&&!c.reports.some(r=>r.turnId&&r.turnId===(pv.turnId||pv.eventId)))c.reports.push({eventId:e.id,nodeId:e.nodeId||null,turnId:pv.turnId||pv.eventId||null,at:e.at,title:snapshot.title||e.text,body:reportBody(snapshot.detail),next:snapshot.next||'',request:visibleUserText(pv.request||''),cwd:pv.cwd||''});}}
 for(const n of w.nodes){const pv=provenance(n),c=ensure(n.projectId,pv);if(!c)continue;
  if(n.type==='source'&&(n.capture||n.checkpoint)&&!c.reports.length&&Number.isFinite(Date.parse(pv.at))&&Date.parse(pv.at)<=Date.parse(at))c.reports.push({eventId:null,nodeId:n.id,turnId:pv.turnId||pv.eventId||null,at:pv.at,title:n.title,body:reportBody(n.detail),next:n.next||'',request:visibleUserText(pv.request||''),cwd:pv.cwd||''});
  if(n.type!=='source')c.records.push({id:n.id,title:n.title,type:n.type,statusId:n.status,status:statusLabel(n.status),evidence:n.evidence||'',next:n.next||'',proposal:!!n.mapper,needsReview:!!n.mapper?.needsReview,reviewReason:n.mapper?.reviewReason||'',detail:n.detail||'',source:{turnId:pv.turnId||pv.eventId||null,quote:n.mapper?.quote||'',sourceId:n.mapper?.sourceId||null}});
 }
 return [...entries.values()].filter(c=>c.reports.length||c.records.length).map(c=>{
  c.reports.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));const latest=c.reports.at(-1);
  const verified=c.records.filter(n=>n.statusId==='done'&&!n.proposal&&n.evidence.trim()),proposals=c.records.filter(n=>n.proposal&&n.statusId!=='parked');
  const artifacts=[],seen=new Map();for(const report of [...c.reports].reverse())for(const a of links(report.body)){const source={at:report.at,turnId:report.turnId,eventId:report.eventId};if(seen.has(a.url)){const item=seen.get(a.url);if(!item.sources.some(s=>s.turnId===source.turnId&&s.eventId===source.eventId))item.sources.push(source);continue;}const item={...a,...source,sources:[source]};seen.set(a.url,item);artifacts.push(item);}
  return {...c,title:chatTitles[c.sessionId]||text(latest?.title?.replace(/^Codex · /,''),150)||'Chat '+c.sessionId.slice(0,8),named:!!chatTitles[c.sessionId],find:[...c.reports.map(r=>text(r.title,200)),...artifacts.map(a=>a.label+' '+a.url)].join(' ').slice(0,40000),at:latest?.at||projects.get(c.projectId).createdAt,summary:text(latest?.body||'Source-linked records are available.'),next:latest?.next||'Open the saved evidence and choose the next step.',verified,proposals,artifacts,reportCount:c.reports.length,path:chatPath(c.projectId,c.sessionId)};
 }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
export function chatData(w,c,{at=new Date().toISOString()}={}){
 const eventIds=new Set(c.reports.map(r=>r.eventId).filter(Boolean));
 const associated=e=>eventIds.has(e.id)||[e.capture,e.after,e.before].some(n=>provenance(n)?.sessionId===c.sessionId)||e.mapperJobId&&c.records.some(n=>n.id===e.nodeId);
 const timeline=projectTimeline({...w,events:w.events.filter(e=>e.projectId===c.projectId&&associated(e))},c.projectId,{at});
 return {version:1,statusKey,project:{id:c.projectId,title:c.projectTitle},sessionId:c.sessionId,provider:c.provider,title:c.title,at:c.at,summary:c.summary,next:c.next,reportCount:c.reportCount,map:chatMindmap(w,c),reports:c.reports.slice(-80).reverse().map(r=>({...r,logPath:receiptPath(c,r)})),reportsTruncated:c.reports.length>80,records:c.records,verified:c.verified,proposals:c.proposals,artifacts:c.artifacts.slice(0,100),artifactTotal:c.artifacts.length,timeline};
}
const md=s=>String(s||'').replace(/[\r\n|\[\]]/g,' ');
export function chatFiles(w,options={}){
 const files={},catalog=chatCatalog(w,options);
 for(const c of catalog){const d=chatData(w,c,options),key=c.projectId+'-'+c.sessionId;
  const reports=c.reports;
  for(let i=0;i<reports.length;i++){
   const r=reports[i],path=receiptPath(c,r),recordLinks=c.records.filter(n=>n.source?.turnId&&n.source.turnId===r.turnId);
   files[path+'.md']=`---\ncssclasses: brancha-record\nbrancha_chat: ${JSON.stringify(c.sessionId)}\nbrancha_turn: ${JSON.stringify(r.turnId)}\nbrancha_captured_at: ${JSON.stringify(r.at)}\ntags: [brancha/source/chat-reply]\n---\n# ${md(r.title.replace(/^Codex · /,''))}\n\n[[${c.path}|Chat mindmap and overview]] · [[Chats/${key}-index|Source index]] · [[Dashboards/${c.projectId}|Project]]\n\n> [!info] Saved source\n> Captured ${r.at}. This is an assistant report, not independently verified completion evidence.\n\n${c.provider==='codex'?'[Open original chat](codex://threads/'+c.sessionId+')\n\n':''}## Captured request\n\n${r.request||'Not captured with this older reply. Open the original chat for its context.'}\n\n## Saved output\n\n${r.body}\n\n## Source-linked choices and records\n\n${recordLinks.map(n=>`- [[Items/${n.id}|${md(n.title)}]] — ${n.status}${n.proposal?' · AI suggestion':''}`).join('\n')||'No choices explicitly attributed to this captured turn.'}\n\n## Backtrack through captures\n\n${i?'[['+receiptPath(c,reports[i-1])+'|← Previous captured reply]]':'First saved reply in this scope.'} · ${i+1<reports.length?'[['+receiptPath(c,reports[i+1])+'|Next captured reply →]]':'Latest saved reply in this scope.'}\n\nChronological neighbours are navigation, not work dependencies.\n\nSession: ${c.sessionId}\n\nTurn: ${r.turnId||'Not recorded'}\n${r.cwd?'\nCaptured working folder: `'+r.cwd+'`\n':''}`;
  }
  files[`Chats/${key}-index.md`]=`---\ncssclasses: brancha-record\n---\n# Source index · ${md(c.title)}\n\n[[${c.path}|Chat mindmap and overview]] · [[Chats/index|All chats]]\n\n${reports.length} captured replies. Each link opens its historical saved output and captured request where available. These notes are derived from the local record; no chat needs to manually write them.\n\n| Captured | Saved reply | Source turn |\n|---|---|---|\n${reports.map(r=>`| ${r.at} | [[${receiptPath(c,r)}\\|${md(r.title.replace(/^Codex · /,''))}]] | ${r.turnId||'Not recorded'} |`).join('\n')}\n`;
  files[`Interactive/chat-${key}.json`]=JSON.stringify(d);
  files[c.path+'.md']=`---\ncssclasses: [brancha-dashboard, brancha-interactive]\n---\n\`\`\`brancha-chat\n${c.projectId}\n${c.sessionId}\n\`\`\`\n\n[[${c.path}-notes|Portable chat overview]] · [[Chats/index|All chats]]\n`;
  files[c.path+'-notes.md']=`---\ncssclasses: brancha-record\n---\n# ${md(c.title)}\n\n[[${c.path}|Interactive chat overview and mindmap]] · [[Chats/${key}-index|Source index]] · [[Dashboards/${c.projectId}|${md(c.projectTitle)}]]\n\n${c.reportCount} saved completion reports. Reports are assistant claims, not verified outcomes. Earlier uncaptured work is not reconstructed.\n\n## Pick up here\n\n${c.next}\n\n## Latest saved report\n\n${c.reports.at(-1)?.body||'No completion report saved.'}\n\n## Verified outcomes linked to this chat\n\n${c.verified.map(n=>`- [[Items/${n.id}|${md(n.title)}]] — ${n.evidence}`).join('\n')||'None explicitly recorded with this chat’s provenance. Project outcomes may exist separately; they are not automatically attributed to this chat.'}\n\n## Where to find the work\n\n${d.artifacts.map(a=>`- [${md(a.label)}](<${a.url}>) — reported ${a.at}`).join('\n')||'No file or web links were found in the saved reports.'}\n\nLinks are extracted from saved reports; their existence and current contents have not been checked. ${c.artifacts.length} links found; up to 100 shown.\n\n## Decisions and offshoots\n\n${c.records.map(n=>`- [[Items/${n.id}|${md(n.title)}]] — ${n.status}${n.proposal?' · AI suggestion':''}`).join('\n')||'No source-linked choices recorded for this chat yet.'}\n\n[[${c.path}|Open this chat’s overview and timeline]]\n`;
 }
 return files;
}
