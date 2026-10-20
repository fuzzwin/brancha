import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {validate,projectAnalytics,nextAction,redactText} from '../dist/core.mjs';
import {atomicText} from '../skills/brancha/scripts/storage.mjs';

// Deterministic inventory only. It neither calls a model nor changes project truth.
export function projectReview(w,{at=new Date().toISOString()}={}){
 validate(w);
 const ids=new Map(w.nodes.map(n=>[n.id,n]));
 const dangling=w.edges.filter(e=>!ids.has(e.from)||!ids.has(e.to));
 const counts=new Map();
 for(const e of w.edges){const k=[e.type,e.from,e.to].join(':');counts.set(k,(counts.get(k)||0)+1);}
 const adjacency=new Map(w.nodes.map(n=>[n.id,[]]));
 for(const e of w.edges)if(e.type==='depends_on'&&ids.has(e.from)&&ids.has(e.to))adjacency.get(e.from).push(e.to);
 const active=new Set(),done=new Set(),cycles=[];
 function visit(id,stack){if(active.has(id)){cycles.push([...stack.slice(stack.indexOf(id)),id]);return;}if(done.has(id))return;active.add(id);for(const to of adjacency.get(id)||[])visit(to,[...stack,id]);active.delete(id);done.add(id);}
 for(const id of ids.keys())visit(id,[]);
 const projects=w.projects.map(p=>{
  const nodes=w.nodes.filter(n=>n.projectId===p.id),a=projectAnalytics(w,p.id,{at,timeZone:'Australia/Melbourne'});
  const events=w.events.filter(e=>e.projectId===p.id&&e.at<=at).sort((x,y)=>x.at.localeCompare(y.at));
  const linked=new Set(w.edges.flatMap(e=>[e.from,e.to]));
  const statuses={};for(const n of nodes)statuses[n.status]=(statuses[n.status]||0)+1;
  return {id:p.id,title:p.title,nodeCount:nodes.length,statuses,next:nextAction(w,p.id),
   criteriaTotal:p.criteria.length,criteriaWithEvidence:a.originalGoals.done,
   sourceReports:nodes.filter(n=>n.type==='source').length,
   ready:a.ready.map(n=>({id:n.id,title:n.title})),waiting:a.waiting.map(n=>({id:n.id,title:n.title})),
   decisions:nodes.filter(n=>n.type==='decision').map(n=>({id:n.id,title:n.title,status:n.status,detail:n.detail,alternatives:n.alternatives})),
   branches:nodes.filter(n=>n.type==='branch').map(n=>({id:n.id,title:n.title,status:n.status})),
   unconnected:nodes.filter(n=>!linked.has(n.id)).map(n=>({id:n.id,title:n.title,type:n.type})),
   latestRecordedUpdate:events.at(-1)?.at||null,eventCount:events.length,
   coverage:'Inventory of the canonical record; source reports and counts are not independent verification.'};
 });
 return {schemaVersion:1,at,revision:w.revision,projects,integrity:{dangling,cycles,duplicateConnections:[...counts].filter(([,n])=>n>1)},
  limitations:['No model was called by this helper.','No exhaustive chat-history or source verification is implied.','Unconnected records may be legitimate standalone notes.','Historical decision conflicts require review; no automatic supersession is inferred.']};
}
export function reviewMarkdown(r){
 const safe=x=>redactText(String(x??'')).replaceAll('|','\\|').replaceAll('\n',' ');
 return `# Brancha daily record inventory\n\nSnapshot: ${r.at} · revision ${r.revision}. This is a deterministic inventory; the scheduled Luna review adds source reconciliation separately.\n\n| Project | Records | Source reports | Ready | Waiting | Last recorded update |\n|---|---:|---:|---:|---:|---|\n${r.projects.map(p=>`| ${safe(p.title)} | ${p.nodeCount} | ${p.sourceReports} | ${p.ready.length} | ${p.waiting.length} | ${p.latestRecordedUpdate||'Unknown'} |`).join('\n')}\n\n## Integrity\n\nDangling connections: ${r.integrity.dangling.length}. Dependency cycles: ${r.integrity.cycles.length}. Duplicate connections: ${r.integrity.duplicateConnections.length}.\n\n${r.projects.map(p=>`## ${safe(p.title)}\n\nCurrent next-action record: ${safe(typeof p.next==='string'?p.next:JSON.stringify(p.next))}\n\nDecisions: ${p.decisions.map(x=>safe(x.title)).join('; ')||'None recorded'}.\n\nBranches: ${p.branches.map(x=>safe(x.title)+' ('+safe(x.status)+')').join('; ')||'None recorded'}.\n\nUnconnected records for review: ${p.unconnected.map(x=>safe(x.title)).join('; ')||'None'}.`).join('\n\n')}\n\n## Coverage limits\n\n${r.limitations.map(x=>'- '+x).join('\n')}\n`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),configArg=args.find(x=>x.startsWith('--config='));
 const {config}=loadConfig(configArg?.slice(9));
 const file=path.join(config.vault,'brancha.json');
 if(fs.statSync(file).size>8*1024*1024)throw Error('Workspace exceeds 8 MB.');
 const report=projectReview(JSON.parse(fs.readFileSync(file,'utf8')));
 if(args.includes('--write')){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(report.at));
  const folder=path.join(config.vault,'Notes','Reviews');fs.mkdirSync(folder,{recursive:true});
  const name=`${date} inventory ${report.at.replaceAll(/[:.]/g,'-')}`;
  atomicText(path.join(folder,name+'.json'),JSON.stringify(report,null,2)+'\n');
  atomicText(path.join(folder,name+'.md'),reviewMarkdown(report));
  console.log(JSON.stringify({written:path.join(folder,name+'.md'),revision:report.revision,projects:report.projects.length,integrity:report.integrity}));
 }else console.log(JSON.stringify(report,null,2));
}
