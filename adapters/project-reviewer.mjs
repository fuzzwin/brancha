import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {runLuna,validateExtraction,applyMappedProposals} from './conversation-mapper.mjs';
import {atomic,paths,controls,routeProject,sessionAllowed,status,redact} from './capture.mjs';
import {atomicText} from '../skills/brancha/scripts/storage.mjs';
import {validate} from '../dist/core.mjs';
import {privacyView} from './chat-privacy.mjs';
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export class ProjectReviewer{
 constructor(config,{runner=runLuna,clock=()=>Date.now()}={}){this.config=config;this.runner=runner;this.clock=clock;this.autoBusy=false;this.root=path.join(paths(config).state,'reviewer');fs.mkdirSync(path.join(this.root,'runs'),{recursive:true});}
 request(){atomic(path.join(this.root,'request.json'),{id:crypto.randomUUID(),requestedAt:new Date().toISOString()});}
 async tick(){
  if(!this.config.reviewer?.enabled||controls(this.config).paused||this.autoBusy)return;
  const request=path.join(this.root,'request.json');
  if(fs.existsSync(request)){const job=read(request);const result=await this.run();if(!result.busy&&!String(result.skipped||'').startsWith('paused')&&read(request)?.id===job.id)fs.unlinkSync(request);return result;}
  const interval=this.config.reviewer.autoCheckMs;if(!interval)return;
  const file=path.join(this.root,'automatic.json'),previous=read(file,{});if(this.clock()<(previous.nextCheckAt||0))return;
  this.autoBusy=true;
  try{
   const result=await this.run();
   // Shared worker contention is not a model failure. Leave the due check pending.
   if(result.busy||String(result.skipped||'').startsWith('paused'))return result;
   const at=this.clock(),nextCheckAt=at+(result.backlog>0?Math.min(interval,60000):interval);
   atomic(file,{checkedAt:new Date(at).toISOString(),nextCheckAt,result:{reviewed:result.reviewed||0,applied:result.applied||0,backlog:result.backlog||0,skipped:result.skipped||null,failed:!!result.failed}});
   status(this.config,{reviewerAutomatic:true,reviewerAutoCheckedAt:new Date(at).toISOString(),reviewerNextCheckAt:new Date(nextCheckAt).toISOString()});return result;
  }finally{this.autoBusy=false;}
 }
 async run(){
  const cfg=this.config,root=this.root,lock=path.join(root,'worker.lock');
  if(!cfg.reviewer?.enabled)return {skipped:'disabled'};if(controls(cfg).paused)return {skipped:'paused'};
  const owner=read(lock,null);if(owner){try{process.kill(owner.pid,0);return {busy:true};}catch(e){if(e.code!=='ESRCH')return {busy:true};fs.unlinkSync(lock);}}
  let fd;try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));}catch(e){if(e.code==='EEXIST')return {busy:true};throw e;}
  let run=null,mapfd;const maplock=path.join(paths(cfg).state,'mapper/worker.lock');
  try{
   fs.mkdirSync(path.dirname(maplock),{recursive:true});
   try{mapfd=fs.openSync(maplock,'wx');fs.writeFileSync(mapfd,JSON.stringify({pid:process.pid,kind:'review'}));}catch(e){if(e.code==='EEXIST')return {busy:true};throw e;}
   const stateFile=path.join(root,'state.json'),state=read(stateFile,{version:1,reviewed:[],failed:[]});
   const all=fs.readdirSync(path.join(root,'runs')).filter(f=>f.endsWith('.json')).map(f=>read(path.join(root,'runs',f)));
   state.reviewed=[...new Set([...state.reviewed,...all.filter(r=>r.state==='done').flatMap(r=>r.jobs.map(j=>j.id))])];
   for(const interrupted of all.filter(x=>x.state==='running')){interrupted.state='failed';interrupted.error='Review interrupted; inspect its receipt before an explicit retry.';atomic(path.join(root,'runs',interrupted.id+'.json'),interrupted);for(const j of interrupted.jobs||[])if(!state.failed.includes(j.id))state.failed.push(j.id);}
   atomic(stateFile,state);
   run=all.find(x=>x.state==='ready');
   if(!run){
    const file=paths(cfg).file,w=privacyView(cfg,validate(read(file))),folder=path.join(paths(cfg).state,'mapper/jobs');
    const excluded=new Set([...state.reviewed,...state.failed]);
    const jobs=(fs.existsSync(folder)?fs.readdirSync(folder):[]).filter(f=>f.endsWith('.json')).map(f=>read(path.join(folder,f)))
     .filter(j=>(['done','failed'].includes(j.state)||['pending','needs_route'].includes(j.state)&&Date.now()-j.queuedAt>=(cfg.reviewer.catchUpAfterMs??300000))&&!excluded.has(j.id)&&sessionAllowed(cfg,j.sessionId)&&j.messages?.length)
     .map(j=>({...j,projectId:routeProject(cfg,j,w)})).filter(j=>j.projectId!=='codex_inbox'&&w.projects.some(p=>p.id===j.projectId))
     .sort((a,b)=>a.queuedAt-b.queuedAt);
    if(!jobs.length){status(cfg,{reviewerState:state.failed.length?'needs attention':'idle',reviewerCheckedAt:new Date().toISOString(),reviewerBacklog:0});return {skipped:'unchanged'};}
    const budgetFile=path.join(root,'budget.json');let budget=read(budgetFile,{date:day(),calls:0});if(budget.date!==day())budget={date:day(),calls:0};
    if(budget.calls>=(cfg.reviewer.maxCallsPerDay??8)){status(cfg,{reviewerState:'daily limit',reviewerBacklog:jobs.length});return {skipped:'daily limit'};}
    const projectId=jobs[0].projectId,selected=jobs.filter(j=>j.projectId===projectId).slice(0,8);
    let chars=0;const bounded=selected.map(j=>({...j,messages:j.messages.map(m=>{const remaining=Math.max(0,36000-chars),text=m.text.slice(0,Math.min(4500,remaining));chars+=text.length;return {...m,text};}).filter(m=>m.text.length>=8)})).filter(j=>j.messages.length);
    const p=w.projects.find(p=>p.id===projectId),packet={project:{id:p.id,title:p.title},context:w.nodes.filter(n=>n.projectId===projectId&&['goal','decision','branch'].includes(n.type)&&!n.mapper).slice(-10).map(n=>({id:n.id,title:n.title,status:n.status})),messages:bounded.flatMap(j=>j.messages),reviewPurpose:'Reconcile recent visible chat turns. Extract only still-useful explicit decisions, tasks and offshoots; existing mapped reports are unverified. Do not invent completion or task dependencies.'};
    run={version:1,id:crypto.randomUUID(),state:'running',startedAt:new Date().toISOString(),projectId,jobs:bounded.map(j=>({id:j.id,sessionId:j.sessionId,turnId:j.turnId,provider:j.provider||'codex',sourceNodeId:j.sourceNodeId,projectId:j.projectId,messages:j.messages,priorState:j.state})),packet,inputFingerprint:hash(packet),backlog:jobs.length-bounded.length,harnessVersion:'brancha-review-v1'};
    const out=path.join(root,'runs',run.id+'.json');atomic(out,run);budget.calls++;atomic(budgetFile,budget);
    status(cfg,{reviewerState:'Luna High reviewing',reviewerBacklog:jobs.length,reviewerError:null});
    try{const result=await this.runner(packet,{effort:'high',directory:path.join(root,'runner'),executable:cfg.reviewer.executable||cfg.mapper?.executable||'codex',timeoutMs:cfg.reviewer.timeoutMs||120000});validateExtraction(result.value,packet);run.value=result.value;run.receipt=result.receipt;run.state='ready';atomic(out,run);}
    catch(e){run.state='failed';run.error=redact(e.message).slice(0,1200);if(e.receipt)run.receipt=e.receipt;atomic(out,run);state.failed=[...new Set([...state.failed,...run.jobs.map(j=>j.id)])];atomic(stateFile,state);status(cfg,{reviewerState:'needs attention',reviewerError:run.error});return {failed:true,error:run.error,backlog:run.backlog};}
   }
   if(controls(cfg).paused)return {skipped:'paused before update'};
   if(run.jobs.some(j=>!sessionAllowed(cfg,j.sessionId))){run.state='excluded';atomic(path.join(root,'runs',run.id+'.json'),run);return {skipped:'chat permission revoked'};}
   status(cfg,{reviewerState:'Updating Obsidian'});
   validateExtraction(run.value,run.packet);let applied=0,duplicates=0;
   for(const source of run.jobs){
    const w=validate(read(paths(cfg).file)),ids=new Set(source.messages.map(m=>m.id));
    const items=run.value.items.filter(item=>ids.has(item.sourceId)).filter(item=>{const duplicate=w.nodes.some(n=>n.projectId===run.projectId&&n.type===item.kind&&n.mapper?.sessionId===source.sessionId&&n.mapper?.quote===item.quote);if(duplicate)duplicates++;return !duplicate;});
    if(!items.length)continue;
    const keys=new Set(items.map(i=>i.key)),result={...run.value,items,relations:run.value.relations.filter(e=>keys.has(e.from)&&keys.has(e.to))};
    const receipt={...run.receipt,usageScope:'Shared batch receipt; count usage once from the reviewer run, not each proposal.'};
    const job={...source,id:hash(['review',run.id,source.id]),receipts:[receipt]};
    const change=applyMappedProposals(cfg,job,result,run.projectId);if(change.retry)return {busy:true,stage:'update pending'};applied+=change.items||0;
   }
   const relative=`Notes/Reviews/Hourly/${run.startedAt.replace(/[:.]/g,'-')}-${run.id.slice(0,8)}.md`;
   atomicText(path.join(cfg.vault,relative),`---\ncssclasses: brancha-record\n---\n# Luna High project check\n\n[[Generated/Navigation/Home|Home]] · [[Generated/Dashboards/${run.projectId}|Project]]\n\n${run.jobs.length} completed turns reviewed. ${applied} source-linked proposals added; ${duplicates} duplicates skipped. ${run.backlog} turns remain outside this batch.\n\nRequested **gpt-6-luna · high**. Proposed decisions remain unaccepted. The update worker only writes validated proposals and derived views.\n\n${run.value.reason}\n\n${run.value.items.map(i=>`## ${i.title}\n\n${i.detail}\n\n> ${i.quote.replaceAll('\n','\n> ')}\n\nSource: ${i.sourceId}`).join('\n\n')}\n\n## Run evidence\n\nExact source-quote validation passed. Original scope and accepted statuses preserved. Input: ${run.inputFingerprint}. Harness: ${run.harnessVersion}. Full packet, validation result and one authoritative usage receipt are retained privately under .brancha/reviewer/runs.\n`);
   run.state='done';run.completedAt=new Date().toISOString();run.note=relative;run.applied=applied;run.duplicates=duplicates;run.evaluation={grounded:true,proposalOnly:true,duplicateCount:duplicates};atomic(path.join(root,'runs',run.id+'.json'),run);
   for(const source of run.jobs){const jobFile=path.join(root,'../mapper/jobs',source.id+'.json'),job=read(jobFile,null);if(job&&['pending','needs_route'].includes(job.state)){job.state='done';job.completedAt=run.completedAt;job.reviewedBy=run.id;atomic(jobFile,job);}}
   state.reviewed=[...new Set([...state.reviewed,...run.jobs.map(j=>j.id)])];state.lastSuccessfulAt=run.completedAt;state.lastNote=relative;atomic(stateFile,state);
   status(cfg,{reviewerState:run.backlog?'batch complete':'up to date',reviewerLastAt:run.completedAt,reviewerLastNote:relative,reviewerApplied:applied,reviewerBacklog:run.backlog,reviewerError:null});
   return {reviewed:run.jobs.length,applied,duplicates,backlog:run.backlog,note:relative,receipt:run.receipt};
  }finally{if(mapfd!==undefined){fs.closeSync(mapfd);fs.unlinkSync(maplock);}fs.closeSync(fd);fs.unlinkSync(lock);}
 }
}
