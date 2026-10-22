import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {acquireLock} from '../skills/brancha/scripts/locking.mjs';
import {sessionBoundary} from './session-boundary.mjs';

const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,150}$/.test(id)&&!['all','personal','any','*'].includes(id.toLowerCase());
export const permissionFile=config=>path.join(path.resolve(config.vault),'.brancha','chat-permissions.json');
export function chatPermissions(config){
 try{const p=JSON.parse(fs.readFileSync(permissionFile(config),'utf8'));if(p.version!==1||!p.chats||typeof p.chats!=='object'||Array.isArray(p.chats))throw Error('Invalid chat permissions');return p;}
 catch(e){if(e.code==='ENOENT')return {version:1,chats:{}};return {version:1,chats:{},invalid:true};}
}
export function chatAllowed(config,id){
 if(!valid(id)||config.capturePolicy?.excludedSessionIds?.includes(id))return false;
 const p=chatPermissions(config);if(p.invalid)return false;
 const choice=p.chats[id]?.decision;
 if(choice==='exclude')return false;
 return choice==='include'||config.capturePolicy?.approvedSessionIds?.includes(id)===true;
}
export function privacyFingerprint(config){return JSON.stringify({permissions:chatPermissions(config),policy:config.capturePolicy||{}});}
export function workspaceEtag(config,raw){return crypto.createHash('sha256').update(raw+'\0'+(config?privacyFingerprint(config):'')).digest('hex');}
export function captureBoundary(config,id){return chatPermissions(config).chats[id]?.captureBoundary||null;}
export const permissionEpoch=(config,id)=>captureBoundary(config,id)?.epoch??null;
export const consentMatches=(config,input)=>chatAllowed(config,input.sessionId)&&(input.permissionEpoch??null)===permissionEpoch(config,input.sessionId);
export function setChatPermission(config,id,decision,{projectId}={}){
 if(!valid(id)||!['include','exclude'].includes(decision))throw Error('Specify one exact chat ID and include or exclude; group and wildcard approvals are not supported.');
 if(decision==='include'&&config.capturePolicy?.excludedSessionIds?.includes(id))throw Error('This exact chat is explicitly excluded in the configuration. Remove that exclusion before including it.');
 const file=permissionFile(config);fs.mkdirSync(path.dirname(file),{recursive:true});
 let release;try{release=acquireLock(path.join(path.resolve(config.vault),'brancha.json.lock'));}catch(e){if(e.code==='EEXIST')throw Error('Chat permissions or workspace are being updated. Read the current state before retrying.');throw e;}
 try{
 if(projectId!==undefined){
  if(decision!=='include'||typeof projectId!=='string')throw Error('Choose a project only when including this exact chat.');
  const workspace=path.join(path.resolve(config.vault),'brancha.json');if(fs.statSync(workspace).size>8*1024*1024)throw Error('Workspace too large');
  const w=JSON.parse(fs.readFileSync(workspace,'utf8'));if(!w.projects?.some(p=>p.id===projectId))throw Error('The selected project does not exist.');
 }
 const p=chatPermissions(config);if(p.invalid)throw Error('Chat permissions are unreadable; capture remains blocked. Restore the permissions file first.');
 const previous=p.chats[id],included=chatAllowed(config,id);
 const boundary=decision==='include'&&!included?{...sessionBoundary(config,id),epoch:crypto.randomUUID()}:previous?.captureBoundary;
 p.chats[id]={...(previous?.projectId?{projectId:previous.projectId}:{}),decision,at:new Date().toISOString(),...(boundary?{captureBoundary:boundary}:{}),...(projectId!==undefined?{projectId}:{})};atomic(file,p);fs.chmodSync(file,0o600);return p.chats[id];
 }finally{release();}
}
const sourceSession=n=>n?.capture?.sessionId||n?.mapper?.sessionId||n?.checkpoint?.sessionId;
// A derived view only: the canonical record and its private backups are retained.
export function privacyView(config,w){
 const allowed=new Map(),ok=id=>{if(!allowed.has(id))allowed.set(id,chatAllowed(config,id));return allowed.get(id);};
 const hidden=new Set(w.nodes.filter(n=>sourceSession(n)&&!ok(sourceSession(n))).map(n=>n.id));
 const nodes=w.nodes.filter(n=>!hidden.has(n.id)),ids=new Set(nodes.map(n=>n.id));
 const events=w.events.filter(e=>!hidden.has(e.nodeId)&&![e.capture,e.before,e.after].some(n=>sourceSession(n)&&!ok(sourceSession(n))));
 return {...w,nodes,edges:w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),events};
}
// Preserve hidden records when the local browser edits its filtered view.
export function mergePrivateRecords(original,visible,next){
 const merge=(key)=>{const shown=new Set(visible[key].map(x=>x.id)),hidden=original[key].filter(x=>!shown.has(x.id)),blocked=new Set(hidden.map(x=>x.id));if(next[key].some(x=>blocked.has(x.id)))throw Error('A hidden record ID cannot be replaced from the browser view.');return [...hidden,...next[key]];};
 return {...next,nodes:merge('nodes'),edges:merge('edges'),events:merge('events')};
}

// Counts only: excluded chat titles and transcript content never enter this hint.
export function chatPrivacySummary(config,w){
 const ids=new Set([...w.nodes.map(sourceSession),...w.events.flatMap(e=>[e.capture,e.before,e.after].map(sourceSession))].filter(Boolean));
 const included=[...ids].filter(id=>chatAllowed(config,id)).length;
 return {mode:'exact-chat',includedSavedChats:included,excludedSavedChats:ids.size-included};
}
