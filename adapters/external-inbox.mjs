import fs from 'node:fs';import path from 'node:path';
import {paths,digest,sessionAllowed,controls,atomic} from './capture.mjs';
import {normaliseCheckpoint,ingestCheckpoint} from './checkpoint.mjs';
import {permissionEpoch,consentMatches} from './chat-privacy.mjs';
export function queueReceipt(config,checkpoint,acceptance={}){
 if(!sessionAllowed(config,checkpoint.sessionId)||controls(config).paused)return {queued:false,reason:'excluded or paused'};
 const normalized=normaliseCheckpoint(checkpoint),id=digest(JSON.stringify([normalized.provider,normalized.sessionId,normalized.eventId])),folder=path.join(paths(config).state,'external-inbox'),file=path.join(folder,id+'.json');
 fs.mkdirSync(folder,{recursive:true});
 const epoch=Object.hasOwn(acceptance,'permissionEpoch')?acceptance.permissionEpoch:permissionEpoch(config,checkpoint.sessionId);if(!consentMatches(config,{sessionId:checkpoint.sessionId,permissionEpoch:epoch}))return {queued:false,reason:'before-consent'};
 const entry={version:1,checkpoint,permissionEpoch:epoch,fingerprint:digest(JSON.stringify(normalized))};
 if(fs.existsSync(file)){if(JSON.parse(fs.readFileSync(file)).fingerprint!==entry.fingerprint)throw Error('Receipt identity reused for changed content');return {queued:true,duplicate:true};}
 try{fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 return {queued:true};
}
export function drainReceipts(config){
 if(controls(config).paused)return {skipped:'paused'};
 const folder=path.join(paths(config).state,'external-inbox');if(!fs.existsSync(folder))return {processed:0};let processed=0;
 for(const name of fs.readdirSync(folder).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,20)){
  const file=path.join(folder,name);let entry;
  try{entry=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!consentMatches(config,{sessionId:entry.checkpoint?.sessionId,permissionEpoch:entry.permissionEpoch??null})){fs.unlinkSync(file);continue;}
  try{const revision=JSON.parse(fs.readFileSync(paths(config).file,'utf8')).revision,result=ingestCheckpoint(config,entry.checkpoint,revision,{permissionEpoch:entry.permissionEpoch??null});if(result.retry)continue;fs.unlinkSync(file);processed++;}
  catch(e){if(/Revision conflict/.test(e.message))continue;atomic(file+'.failed',{...entry,error:e.message});fs.unlinkSync(file);}
 }
 return {processed};
}
