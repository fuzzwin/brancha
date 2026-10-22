import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {atomic} from './storage.mjs';

const host=os.hostname(),claimName=/^[a-f0-9-]{36}\.json$/;
const busy=()=>Object.assign(Error('Workspace is being updated; read the current state before retrying.'),{code:'EEXIST'});
// A directory of immutable identities implements the bakery lock. There is no
 // shared recovery sentinel to orphan, and dead claims can be removed by their
 // unique names without ever unlinking a replacement owner's lock. Keep the
 // container stable: removing an empty directory can race another publisher's
 // exclusive open (including EINVAL on macOS/APFS).
export function acquireLock(directory) {
 const token=crypto.randomUUID(),file=path.join(directory,token+'.json');let published=false;
 const release=()=>{
  if(published){try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}published=false;}
 };
 const scan=()=>{
  const entries=[];
  for(const name of fs.readdirSync(directory)) {
   if(name===token+'.json'||/^[a-f0-9-]{36}\.json\.[a-f0-9-]{36}\.tmp$/.test(name))continue;
   if(!claimName.test(name))throw busy();
   const other=path.join(directory,name);let owner;
   try{if(fs.lstatSync(other).isSymbolicLink())throw busy();owner=JSON.parse(fs.readFileSync(other,'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw busy();}
   if(owner.version!==1||owner.token+'.json'!==name||owner.host!==host||!Number.isInteger(owner.pid)||owner.pid<1||typeof owner.choosing!=='boolean'||!Number.isSafeInteger(owner.ticket)||owner.ticket<0)throw busy();
   let dead=false;try{process.kill(owner.pid,0);}catch(e){dead=e.code==='ESRCH';if(!dead)throw busy();}
   if(dead){try{fs.unlinkSync(other);}catch(e){if(e.code!=='ENOENT')throw e;}continue;}
   entries.push(owner);
  }
  return entries;
 };
 try {
  try{fs.mkdirSync(directory,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
  // Legacy empty/file locks have no trustworthy owner: never steal them.
  const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw busy();
  const owner={version:1,pid:process.pid,host,token,choosing:true,ticket:0};
  atomic(file,owner);published=true;
  const ticket=1+Math.max(0,...scan().map(o=>o.ticket));if(!Number.isSafeInteger(ticket))throw busy();
  atomic(file,{...owner,choosing:false,ticket});
  if(scan().some(o=>o.choosing||o.ticket<ticket||o.ticket===ticket&&o.token<token))throw busy();
  return release;
 }catch(e){
  // External cleanup can still remove a container during publication. Fail
  // closed; never proceed without a successfully published unique claim.
  try{release();}catch{}
  if(['ENOENT','ENOTDIR','EISDIR','EPERM','EBUSY','EACCES'].includes(e.code))throw busy();throw e;
 }
}
