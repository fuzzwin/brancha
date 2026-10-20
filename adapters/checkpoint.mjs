import fs from 'node:fs';
import path from 'node:path';
import {blank, validate, event, reportedStatus, validateRun, redactText} from '../dist/core.mjs';
import {atomic, paths, controls, digest, sessionAllowed, status} from './capture.mjs';

const text = (value, max, required = false) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Error('Missing or oversized checkpoint text.');
  return redactText(value).trim();
};
const identity = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,150}$/.test(value) || redactText(value) !== value) throw Error('Use an opaque, non-secret checkpoint identity.');
  return value;
};
export function normaliseCheckpoint(input) {
  const allowed = ['version','provider','sessionId','eventId','projectId','title','summary','next','evidence','kind','status','sourceRef','at','run','acceptanceCriteria','prerequisiteIds','request'];
  if (!input || input.version !== 1 || Object.keys(input).some(key => !allowed.includes(key))) throw Error('Unsupported checkpoint envelope. Use version 1 and documented fields only.');
  const n = {
    version: 1, provider: identity(input.provider), sessionId: identity(input.sessionId), eventId: identity(input.eventId), projectId: identity(input.projectId),
    title: text(input.title, 200, true), summary: text(input.summary, 12000, true), next: text(input.next, 1000, true), evidence: text(input.evidence, 4000),
    kind: input.kind || 'source', recordedStatus: text(input.status, 200) || 'unknown', status: reportedStatus(input.status), sourceRef: text(input.sourceRef, 2000), ...(input.request!==undefined?{request:text(input.request,6000)}:{})
  };
  if (!['source','decision','branch'].includes(n.kind)) throw Error('External checkpoints must be sources, decisions or branches.');
  if (input.at !== undefined) {if (typeof input.at !== 'string' || isNaN(Date.parse(input.at))) throw Error('Invalid checkpoint time.'); n.at = new Date(input.at).toISOString();}
  n.prerequisiteIds = input.prerequisiteIds || [];
  if (!Array.isArray(n.prerequisiteIds) || n.prerequisiteIds.length > 100) throw Error('Invalid prerequisite IDs.');
  n.prerequisiteIds = [...new Set(n.prerequisiteIds.map(identity))].sort();
  n.acceptanceCriteria = input.acceptanceCriteria || [];
  if (!Array.isArray(n.acceptanceCriteria) || n.acceptanceCriteria.length > 100) throw Error('Invalid acceptance criteria.');
  n.acceptanceCriteria = n.acceptanceCriteria.map(c => ({text:text(c?.text,2000,true), status:reportedStatus(c.status), recordedStatus:text(c.status,200)||'unknown', evidence:text(c.evidence,4000), source:text(c.source,2000)}));
  if (input.run !== undefined) {
    const r = input.run;
    n.run = {phase:r.phase,outcome:r.outcome,decision:r.decision || 'undecided',hypothesis:text(r.hypothesis,4000),baseline:text(r.baseline,4000),observation:text(r.observation,4000),lesson:text(r.lesson,4000),artifacts:[]};
    if (!Array.isArray(r.artifacts) || r.artifacts.length > 32) throw Error('Invalid run artifacts.');
    n.run.artifacts = r.artifacts.map(a => ({label:text(a?.label,200,true),ref:text(a?.ref,2000,true)}));
    validateRun(n.run);
  }
  return n;
}

export function ingestCheckpoint(config, input, expectedRevision) {
  const n = normaliseCheckpoint(input);
  if (!sessionAllowed(config, n.sessionId)) return {captured:false,reason:'excluded'};
  if (controls(config).paused) return {captured:false,reason:'paused'};
  const p = paths(config);
  fs.mkdirSync(p.vault,{recursive:true});
  let fd;
  try {fd = fs.openSync(p.file + '.lock','wx');}
  catch (error) {if(error.code==='EEXIST')return {captured:false,retry:true,reason:'locked'};throw error;}
  try {
    if (fs.existsSync(p.file) && fs.statSync(p.file).size > 8*1024*1024) throw Error('Workspace exceeds 8 MB.');
    const w = fs.existsSync(p.file) ? validate(JSON.parse(fs.readFileSync(p.file,'utf8'))) : blank();
    const key = digest(JSON.stringify([n.provider,n.sessionId,n.eventId]));
    const fingerprint = digest(JSON.stringify(n)), prior = w.events.find(e => e.checkpointId === key);
    if (prior) {
      if (prior.checkpointFingerprint !== fingerprint) throw Error('eventId was already used for different content; use a new eventId for a new checkpoint.');
      return {captured:false,reason:'duplicate',revision:w.revision,nodeId:prior.nodeId};
    }
    if (!Number.isInteger(expectedRevision) || expectedRevision !== w.revision) throw Error('Revision conflict: read the current workspace before importing.');
    if (!w.projects.some(p => p.id === n.projectId)) throw Error('Choose an existing project explicitly; checkpoints cannot create or infer projects.');
    for (const id of n.prerequisiteIds) if (!w.nodes.some(x => x.id === id && x.projectId === n.projectId)) throw Error('Checkpoint prerequisites must belong to the selected project.');
    const node = {
      id:'cp_'+key.slice(0,30),projectId:n.projectId,title:n.title,type:n.kind,status:n.status,detail:n.summary,evidence:n.evidence,next:n.next,criteria:[],rationale:'',alternatives:'',consequence:'',
      recordedStatus:n.recordedStatus,acceptanceCriteria:n.acceptanceCriteria,
      verification:{implementation:n.status==='reported_done'?'reported_done':'unknown',testing:['passed','failed','blocked'].includes(n.run?.outcome)?n.run.outcome:'not_run',acceptance:'pending'},
      checkpoint:{provider:n.provider,sessionId:n.sessionId,eventId:n.eventId,at:n.at || new Date().toISOString(),sourceRef:n.sourceRef,...(n.request?{request:n.request}:{})},
      ...(n.run?{run:n.run}:{})
    };
    w.nodes.push(node);
    const goal = w.nodes.find(x => x.projectId === n.projectId && x.type === 'goal');
    if (goal) w.edges.push({id:'ce_'+digest(goal.id+node.id).slice(0,30),from:goal.id,to:node.id,type:n.kind==='branch'?'branches_from':'informs'});
    for (const id of n.prerequisiteIds) w.edges.push({id:'ce_'+digest(id+node.id).slice(0,30),from:id,to:node.id,type:'depends_on'});
    event(w,n.projectId,n.provider+' checkpoint: '+n.title,node.id);
    Object.assign(w.events.at(-1),{at:node.checkpoint.at,checkpointId:key,checkpointFingerprint:fingerprint,after:structuredClone(node)});
    validate(w);
    if (Buffer.byteLength(JSON.stringify(w)) > 8*1024*1024) throw Error('Workspace reached 8 MB; archive before continuing.');
    const backups=path.join(p.state,'backups');fs.mkdirSync(backups,{recursive:true});
    if(fs.existsSync(p.file))fs.copyFileSync(p.file,path.join(backups,Date.now()+'-'+key.slice(0,12)+'.json'),fs.constants.COPYFILE_EXCL);
    atomic(p.file,w);
    status(config,{lastCheckpointAt:node.checkpoint.at,lastCheckpointProvider:n.provider,error:null});
    return {captured:true,projectId:n.projectId,nodeId:node.id,revision:w.revision};
  } finally {fs.closeSync(fd);fs.unlinkSync(p.file+'.lock');}
}
