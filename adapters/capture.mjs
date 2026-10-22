import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {observeGit} from './git-context.mjs';
import {chatAllowed,chatPermissions,captureBoundary} from './chat-privacy.mjs';
import {validate,event,uid,blank,redactText} from '../dist/core.mjs';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {acquireLock} from '../skills/brancha/scripts/locking.mjs';
export {atomic} from '../skills/brancha/scripts/storage.mjs';
export const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
export function redact(text=''){
 return redactText(text).replace(/^\*?Usage\b.*$/gmi,'').trim();
}
export function paths(config){const vault=path.resolve(config.vault);return {vault,file:path.join(vault,'brancha.json'),state:path.join(vault,'.brancha'),control:path.join(vault,'.brancha/control.json'),status:path.join(vault,'.brancha/status.json')};}
export function sessionAllowed(config, sessionId){
 return chatAllowed(config,sessionId);
}
export function controls(config){const p=paths(config);try{return JSON.parse(fs.readFileSync(p.control,'utf8'));}catch{return {paused:false};}}
export function status(config,patch={}){const p=paths(config);let current={};try{current=JSON.parse(fs.readFileSync(p.status,'utf8'));}catch{}const next={...current,...patch,paused:controls(config).paused===true};atomic(p.status,next);return next;}
export function routeProject(config,input,w){
 // An imported receipt's explicit project is authoritative only for its exact source.
 const source=input.sourceNodeId&&w.nodes.find(n=>n.id===input.sourceNodeId);
 if(source?.checkpoint&&source.checkpoint.sessionId===input.sessionId&&source.checkpoint.eventId===input.turnId&&source.checkpoint.provider===input.provider&&source.projectId===input.projectId)return source.projectId;
 const bound=chatPermissions(config).chats[input.sessionId]?.projectId;if(bound&&w.projects.some(p=>p.id===bound))return bound;
 const exact=config.sessionProjects?.[input.sessionId];if(exact&&w.projects.some(p=>p.id===exact))return exact;
 const cwd=path.resolve(input.cwd||'/');const choices=(config.directoryProjects||[]).filter(r=>{const d=path.resolve(r.directory);return cwd===d||cwd.startsWith(d+path.sep);}).sort((a,b)=>b.directory.length-a.directory.length);
 if(choices[0]&&w.projects.some(p=>p.id===choices[0].projectId))return choices[0].projectId;
 return 'codex_inbox';
}
export function capture(config,input){
 const p=paths(config);if(config.captureEnabled===false)return {captured:false,reason:'disabled'};
 if(!sessionAllowed(config,input.sessionId))return {captured:false,reason:'excluded'};
 if(controls(config).paused)return {captured:false,reason:'paused'};
 const text=redact(input.message);if(!text||text.length<20)return {captured:false,reason:'empty'};
 if(!input.sessionId||!input.turnId)throw Error('Capture requires session and turn IDs.');
 fs.mkdirSync(p.vault,{recursive:true});let release;try{release=acquireLock(p.file+'.lock');}catch(e){if(e.code==='EEXIST')return {captured:false,retry:true,reason:'locked'};throw e;}
 try{
  if(!sessionAllowed(config,input.sessionId))return {captured:false,reason:'excluded'};
  const boundary=captureBoundary(config,input.sessionId);
  if((input.adapter==='codex-session-watch'||Object.hasOwn(input,'permissionEpoch'))&&(input.permissionEpoch??null)!==(boundary?.epoch??null))return {captured:false,reason:'before-consent'};
  if(boundary&&input.at&&(!Number.isFinite(Date.parse(input.at))||Date.parse(input.at)<Date.parse(boundary.since)))return {captured:false,reason:'before-consent'};
  let w=fs.existsSync(p.file)?validate(JSON.parse(fs.readFileSync(p.file,'utf8'))):blank();
  if(w.demo)w=blank();
  const captureId=digest('codex:'+input.sessionId+':'+input.turnId);
  if(w.events.some(e=>e.captureId===captureId))return {captured:false,reason:'duplicate'};
  const projectId=routeProject(config,input,w),at=input.at&&!isNaN(Date.parse(input.at))?new Date(input.at).toISOString():new Date().toISOString();
  if(!w.projects.some(x=>x.id===projectId))w.projects.push({id:projectId,title:'Codex Inbox',prompt:'Collect new Codex completion checkpoints that have no configured project match. This is a capture inbox, not a reconstructed original project request.',createdAt:at,criteria:[]});
  const first=text.split('\n').map(t=>t.replace(/^[#>*\s]+/,'').trim()).find(Boolean);
  const title=first.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*`_]/g,'').split(/(?<=[.!?])\s/)[0].slice(0,100);
  const next=(text.match(/(?:^|\n)(?:#{1,3}\s*)?(?:next(?: steps?| actions?)?|continue from here)\s*[:—-]?\s*\n?([^\n]+)/i)?.[1]||'Review this captured report, then choose the next action.').slice(0,500);
  const git=input.git===undefined?observeGit(config,input):input.git;
  const legacyId='codex_'+digest(input.sessionId).slice(0,24),scopedId=legacyId+'_'+digest(projectId).slice(0,12);
  let node=w.nodes.find(n=>n.id===scopedId)||w.nodes.find(n=>n.id===legacyId&&n.projectId===projectId);
  const nodeId=node?.id||(w.nodes.some(n=>n.id===legacyId)?scopedId:legacyId);
  const data={id:nodeId,projectId,title:'Codex · '+title.slice(0,140),type:'source',status:'active',detail:'AUTOMATIC CHECKPOINT — assistant-reported; task completion and evidence are not independently verified.\n\n'+text.slice(0,12000)+(text.length>12000?'\n[abridged; open the Codex chat for the full result]':''),evidence:`Codex completed turn at ${at}. Session ${input.sessionId}; turn ${input.turnId}. Adapter: ${input.adapter||'hook'}.`,next,criteria:[],rationale:'',alternatives:'',consequence:'',capture:{provider:'codex',sessionId:input.sessionId,turnId:input.turnId,at,acceptedAt:new Date().toISOString(),permissionEpoch:boundary?.epoch??null,...(git?{git}:{}),...(input.request?{request:redact(input.request).slice(0,6000)}:{}),...(typeof input.cwd==='string'?{cwd:input.cwd.slice(0,1000)}:{})}};
  if(node)Object.assign(node,data);else{w.nodes.push(data);node=data;const goal=w.nodes.find(n=>n.projectId===projectId&&n.type==='goal');if(goal)w.edges.push({id:uid(),from:goal.id,to:node.id,type:'informs'});}
  event(w,projectId,'Codex checkpoint: '+title,node.id);Object.assign(w.events.at(-1),{at,captureId,capture:structuredClone(data)});
  validate(w);const raw=JSON.stringify(w,null,2)+'\n';if(Buffer.byteLength(raw)>8*1024*1024)throw Error('Workspace reached 8 MB; export/archive old checkpoints before continuing capture.');
  const backups=path.join(p.state,'backups');fs.mkdirSync(backups,{recursive:true});if(fs.existsSync(p.file))fs.copyFileSync(p.file,path.join(backups,Date.now()+'-'+crypto.randomUUID()+'.json'));
  atomic(p.file,w);
  status(config,{enabled:true,lastCaptureAt:at,lastProjectId:projectId,lastTitle:title,lastCaptureId:captureId,error:null});
  return {captured:true,projectId,nodeId,revision:w.revision};
 }finally{release();}
}
