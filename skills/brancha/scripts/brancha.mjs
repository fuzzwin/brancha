import fs from 'node:fs';
import path from 'node:path';
import {atomic} from './storage.mjs';
import {blank,validate,uid,now,event,contextBrief,vaultFiles,reconcileImportedEdges} from './core.mjs';
const [command,file,arg,focus]=process.argv.slice(2);
const read=f=>{if(fs.statSync(f).size>8*1024*1024)throw Error('Workspace exceeds 8 MB.');return validate(JSON.parse(fs.readFileSync(f,'utf8')));};
function apply(w,p){
 if(p.expectedRevision!==w.revision)throw Error(`Revision conflict: expected ${p.expectedRevision}; current ${w.revision}. Read the current workspace before editing.`);
 let result={};
 const project=id=>{const x=w.projects.find(x=>x.id===id);if(!x)throw Error('Unknown project');return x;};
 const node=id=>{const x=w.nodes.find(x=>x.id===id);if(!x)throw Error('Unknown map item');return x;};
 if(p.op==='add-project'){
  if(!Array.isArray(p.criteria)||!p.criteria.length||typeof p.prompt!=='string'||!p.prompt.trim())throw Error('A project requires a prompt and success criteria.');
  const pr={id:uid(),title:p.title,prompt:p.prompt,createdAt:now(),criteria:p.criteria.map(text=>({id:uid(),text}))};w.projects.push(pr);event(w,pr.id,'Started the project and preserved the original request.');result=pr;
 }else if(p.op==='add-node'){
  project(p.projectId);const n={id:uid(),projectId:p.projectId,title:p.title,type:p.type||'task',status:p.status||'planned',criteria:p.criteria||[]};for(const k of ['detail','evidence','next','rationale','alternatives','consequence'])n[k]=p[k]||'';for(const k of ['acceptanceCriteria','verification','run'])if(p[k]!==undefined)n[k]=p[k];w.nodes.push(n);event(w,n.projectId,`Added ${n.type}: ${n.title} (${n.status}).${n.next?' Next: '+n.next:''}`,n.id);w.events.at(-1).after=structuredClone(n);result=n;
 }else if(p.op==='update-node'){
  const n=node(p.nodeId),before=structuredClone(n);const allowed=['title','type','status','detail','evidence','next','rationale','alternatives','consequence','criteria','acceptanceCriteria','verification','run'];if(!p.patch||Object.keys(p.patch).some(k=>!allowed.includes(k)))throw Error('Unsupported patch field.');Object.assign(n,p.patch);event(w,n.projectId,`Updated ${n.title}: ${before.status} → ${n.status}.${n.next?' Next: '+n.next:''}`,n.id);Object.assign(w.events.at(-1),{before,after:structuredClone(n)});result=n;
 }else if(p.op==='link'){
  const n=node(p.to);node(p.from);const e={id:uid(),from:p.from,to:p.to,type:p.type};w.edges.push(e);event(w,n.projectId,`Connected ${n.title}: ${p.type} ${node(p.from).title}.`,n.id);result=e;
 }else if(p.op==='unlink'){
  const e=w.edges.find(e=>e.id===p.edgeId);if(!e||typeof p.reason!=='string'||!p.reason.trim())throw Error('An existing connection and reason are required.');const n=node(e.to);w.edges=w.edges.filter(x=>x.id!==e.id);event(w,n.projectId,`Removed ${e.type} connection from ${node(e.from).title} to ${n.title}. Reason: ${p.reason}`,n.id);w.events.at(-1).before=e;
 }else if(p.op==='import-links'){
  project(p.projectId);result=reconcileImportedEdges(w,p.source,p.relationships);if(result.changed)event(w,p.projectId,'Reconciled imported relationships from '+p.source);
 }else if(p.op==='add-criterion'){
  const pr=project(p.projectId);const c={id:uid(),text:p.text};pr.criteria.push(c);event(w,pr.id,'Added success criterion: '+p.text);result=c;
 }else if(p.op==='log'){
  project(p.projectId);if(p.nodeId&&node(p.nodeId).projectId!==p.projectId)throw Error('Activity must match the item’s project.');if(typeof p.text!=='string'||!p.text.trim())throw Error('An activity description is required.');event(w,p.projectId,p.text,p.nodeId||null);
 }else throw Error('Unknown operation.');
 validate(w);return result;
}
try{
 if(!file)throw Error('Usage: brancha.mjs init|check|brief|apply|export-vault WORKSPACE [ARG]');
 const absolute=path.resolve(file);
 if(command==='init'){fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,JSON.stringify(blank(),null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({path:absolute,revision:0}));}
 else if(command==='check'){const w=read(absolute);console.log(JSON.stringify({valid:true,revision:w.revision,projects:w.projects.map(p=>({id:p.id,title:p.title,criteria:p.criteria})),nodes:w.nodes.map(n=>({id:n.id,projectId:n.projectId,title:n.title,status:n.status}))},null,2));}
 else if(command==='brief')console.log(contextBrief(read(absolute),arg,focus));
 else if(command==='export-vault'){
  if(!arg)throw Error('A new export directory is required.');const out=path.resolve(arg);fs.mkdirSync(out,{recursive:false});for(const [name,content]of Object.entries(vaultFiles(read(absolute)))){const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content,{flag:'wx'});}console.log(JSON.stringify({path:out}));
 }else if(command==='apply'){
  if(!arg)throw Error('Operation JSON path is required.');const lock=absolute+'.lock';const fd=fs.openSync(lock,'wx');let temp;
  try{const w=read(absolute),payload=JSON.parse(fs.readFileSync(arg,'utf8')),result=apply(w,payload);const backup=absolute+'.'+Date.now()+'.backup';fs.copyFileSync(absolute,backup,fs.constants.COPYFILE_EXCL);atomic(absolute,w);console.log(JSON.stringify({path:absolute,revision:w.revision,result,backup}));}
  finally{if(temp&&fs.existsSync(temp))fs.unlinkSync(temp);fs.closeSync(fd);fs.unlinkSync(lock);}
 }else throw Error('Unknown command.');
}catch(e){console.error(e.message);process.exitCode=1;}
