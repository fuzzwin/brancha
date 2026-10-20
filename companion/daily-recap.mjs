import {chatCatalog} from './chats.mjs';
import {receiptPath} from './chat-map.mjs';
import {nextAction,statusLabel} from '../dist/core.mjs';

const clean=(s,max=350)=>String(s||'').replace(/<[^>]*>/g,'').replace(/[\r\n|\[\]`]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const localDay=(s,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const link=(path,label)=>`[[Generated/${path}|${clean(label,150)}]]`;
export function dailyRecap(w,day,{at=new Date().toISOString(),timeZone='Australia/Melbourne',capture=null}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Choose a calendar date.');
 const chats=chatCatalog(w,{at}),today=localDay(at,timeZone),projects=[];
 for(const p of w.projects){
  const scoped=chats.filter(c=>c.projectId===p.id).map(c=>({...c,reports:c.reports.filter(r=>localDay(r.at,timeZone)===day)})).filter(c=>c.reports.length);
  const events=w.events.filter(e=>e.projectId===p.id&&Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)<=Date.parse(at)&&localDay(e.at,timeZone)===day);
  if(!scoped.length&&!events.length)continue;
  const sourceTurns=new Set(scoped.flatMap(c=>c.reports.map(r=>c.sessionId+'\0'+r.turnId)));
  const manualIds=new Set(events.flatMap(e=>[e.after?.id,...(!e.capture&&!e.mapperJobId&&!e.checkpointId&&e.nodeId?[e.nodeId]:[])].filter(Boolean)));
  const records=w.nodes.filter(n=>n.projectId===p.id&&(
   n.mapper&&sourceTurns.has(n.mapper.sessionId+'\0'+n.mapper.turnId)||
   n.checkpoint&&sourceTurns.has(n.checkpoint.sessionId+'\0'+n.checkpoint.eventId)||
   !n.mapper&&!n.capture&&!n.checkpoint&&manualIds.has(n.id)
  )).filter(n=>['decision','branch','task','output'].includes(n.type));
  const latest=scoped.flatMap(c=>c.reports).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).at(-1);
  projects.push({id:p.id,title:p.title,chats:scoped.map(c=>({sessionId:c.sessionId,title:c.title,path:c.path,provider:c.provider,reportCount:c.reports.length})),
   reports:scoped.flatMap(c=>c.reports.map(r=>({...r,source:receiptPath(c,r),chatPath:c.path}))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),
   updates:events.filter(e=>!e.capture&&!e.mapperJobId&&!e.checkpointId&&!/^Connected |^Removed .*connection/.test(e.text||'')).map(e=>({text:e.text,path:e.nodeId?'Items/'+e.nodeId:'Activity/'+e.at.slice(0,10)})),
   decisions:records.filter(n=>n.type==='decision'),branches:records.filter(n=>n.type==='branch'),tasks:records.filter(n=>n.type==='task'),results:records.filter(n=>n.type==='output'),
   next:latest?.next||nextAction(w,p.id),eventCount:events.length});
 }
 return {version:1,day,timeZone,at,inProgress:day===today,projects,chatCount:projects.reduce((n,p)=>n+p.chats.length,0),reportCount:projects.reduce((n,p)=>n+p.reports.length,0),
  coverage:{scope:'Included saved work only; unavailable and excluded chats are not reconstructed.',pending:capture?.mapperPending??null,limited:!!capture?.mapperBudgetExhausted,paused:!!capture?.paused}};
}
export function recapMarkdown(d){
 const lines=['---','cssclasses: brancha-dashboard','tags: [brancha/recap]','---',`# ${d.inProgress?'Today, so far':'Your day'} · ${d.day}`,'',`${link('Navigation/Home','Home')} · ${link('Recaps/index','Daily recaps')} · ${link('Navigation/Today','Today')} · ${link('Navigation/Review','Review')}`,'',
  `**${d.projects.length} projects · ${d.chatCount} included chat scopes · ${d.reportCount} saved replies**`,'',
  `> [!info] ${d.inProgress?'Live daily recap':'Daily recap, refreshed from saved sources'}\n> ${d.coverage.scope} ${d.coverage.paused?'Capture is paused. ':''}${d.coverage.pending!==null?d.coverage.pending+' mapping turns currently queued. ':''}${d.coverage.limited?'Luna has reached its daily allowance; some decisions/tasks may not appear yet. ':''}\n> ${d.timeZone} · generated ${new Date(d.at).toLocaleString('en-AU',{timeZone:d.timeZone})}. Reported work is not independently verified completion. Later grounded interpretations and review status may update this recap.`,''];
 if(!d.projects.length)lines.push('No included saved work for this date. This does not mean no work happened.','');
 const choice=n=>`${link('Items/'+n.id,n.title)} — ${n.mapper?'AI proposal; unaccepted':statusLabel(n.status)}${n.mapper?.needsReview?' · interpretation needs review':''}\n  - **Why:** ${n.rationale?clean(n.rationale,550):'Reason not recorded; no rationale inferred.'}${n.mapper?.rationaleQuote?'\n  - **Reason excerpt:** “'+clean(n.mapper.rationaleQuote,500)+'”':''}${n.mapper?.quote?'\n  - **Choice excerpt:** “'+clean(n.mapper.quote,500)+'”':''}`;
 for(const p of d.projects){
  lines.push(`## ${clean(p.title,150)}`,'',`${link('Dashboards/'+p.id,'Project and map')} · ${link('Timelines/'+p.id,'Timeline')} · ${link('Resume/'+p.id,'Resume with AI')}`,'','### What you worked on','');
  lines.push(...p.reports.slice(-6).map(r=>`- ${link(r.source,r.title)} — ${clean(r.body,320)}`));
  lines.push(...p.updates.slice(-4).map(e=>`- ${link(e.path,e.text)}`));
  if(p.reports.length>6)lines.push(`- ${p.reports.length-6} earlier replies remain in the linked chat source indexes.`);
  if(!p.reports.length&&!p.updates.length)lines.push('- Saved mapping or connection updates; inspect the project timeline.');
  lines.push('','### Decisions and why','',...(p.decisions.length?p.decisions.slice(-10).map(n=>'- '+choice(n)):['- No source-linked decisions recorded for this date.']),'','### Branches and open directions','',...(p.branches.length?p.branches.slice(-8).map(n=>'- '+choice(n)):['- No offshoots recorded for this date.']),'','### Tasks and reported results','',...[...p.tasks,...p.results].slice(-10).map(n=>`- ${link('Items/'+n.id,n.title)} — ${n.mapper?'AI proposal; not accepted':statusLabel(n.status)}`));
  if(!p.tasks.length&&!p.results.length)lines.push('- No separately recorded tasks or results for these sources.');
  lines.push('','### Pick up tomorrow','',`> ${clean(p.next,700)}\n>\n> Latest saved next step, not an automatically executed task. Confirm physical, hosted or external outcomes before treating them as complete.`,'','<details><summary>Chats and source coverage</summary>','',...p.chats.map(c=>`- ${link(c.path,c.title)} · ${c.reportCount} saved replies`),'','</details>','');
 }
 return lines.join('\n')+'\n';
}
export function dailyRecapFiles(w,options={}){
 const at=options.at||new Date().toISOString(),zone=options.timeZone||'Australia/Melbourne',today=localDay(at,zone),date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);const yesterday=date.toISOString().slice(0,10);
 const dates=[...new Set([today,yesterday,...w.events.filter(e=>Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)<=Date.parse(at)).map(e=>localDay(e.at,zone))])].sort().reverse().slice(0,31),files={};
 for(const day of dates)files['Recaps/'+day+'.md']=recapMarkdown(dailyRecap(w,day,{...options,at,timeZone:zone}));
 files['Recaps/index.md']='---\ncssclasses: brancha-dashboard\n---\n# Your daily recaps\n\n'+link('Navigation/Home','Home')+' · '+link('Navigation/Today','Today')+'\n\nBuilt automatically while the companion runs. No additional model calls are needed to assemble these pages. Only included saved work is shown; a missing entry does not mean no work happened.\n\n'+dates.map(day=>'- '+link('Recaps/'+day,day+(day===today?' · today, so far':''))).join('\n')+'\n\nThe latest 31 recorded dates are available here. Earlier source history remains in the canonical record.\n';
 return files;
}
