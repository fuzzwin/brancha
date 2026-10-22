import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
import {loadConfig} from '../scripts/config.mjs';
import {paths,atomic,sessionAllowed,controls,routeProject,redact,status} from './capture.mjs';
import {queueReceipt,drainReceipts} from './external-inbox.mjs';
import {setChatPermission,permissionEpoch,consentMatches} from './chat-privacy.mjs';
import {visibleUserText} from './conversation-mapper.mjs';

export function claudeHook(config,input){
 // A direct anchored human prompt is exact-chat activation, never transcript instructions.
 let activated=false;
 if(input.hook_event_name==='UserPromptSubmit'&&typeof input.prompt==='string'){
  const activate=input.prompt.trim().match(/^(?:Brainch|Branchi) this chat for (.{1,150}?)\.?$/i);
  if(activate){const w=JSON.parse(fs.readFileSync(paths(config).file,'utf8')),name=activate[1].toLowerCase(),matches=w.projects.filter(p=>p.title.toLowerCase()===name||p.id===activate[1]);if(matches.length!==1)throw Error('Branchi activation needs one exact existing project title.');setChatPermission(config,input.session_id,'include',{projectId:matches[0].id});activated=true;}
  if(/^Exclude this chat from Branchi[.!]?$/i.test(input.prompt.trim())){setChatPermission(config,input.session_id,'exclude');return {excluded:true};}
 }
 // No transcript path is opened, and excluded prompts are never persisted.
 if(!sessionAllowed(config,input.session_id)||controls(config).paused)return {captured:false,reason:'excluded or paused'};
 if(!['UserPromptSubmit','Stop'].includes(input.hook_event_name))return {captured:false,reason:'unsupported event'};
 const dir=path.join(paths(config).state,'claude'),file=path.join(dir,crypto.createHash('sha256').update(input.session_id).digest('hex')+'.json');
 if(input.hook_event_name==='UserPromptSubmit'){
  const request=visibleUserText(input.prompt||'');if(!request)return {captured:false,reason:'no visible request'};
  atomic(file,{eventId:input.prompt_id||crypto.randomUUID(),request:request.slice(0,6000),permissionEpoch:permissionEpoch(config,input.session_id),projectId:routeProject(config,{sessionId:input.session_id,cwd:input.cwd},JSON.parse(fs.readFileSync(paths(config).file,'utf8')))});return {staged:true,activated};
 }
 if(input.stop_hook_active||input.agent_id||!input.last_assistant_message)return {captured:false,reason:'not a main completed response'};
 const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(saved&&!consentMatches(config,{sessionId:input.session_id,permissionEpoch:saved.permissionEpoch??null}))return {captured:false,reason:'before-consent'};
 if(!saved)return {captured:false,reason:'prompt identity unavailable; no transcript scan attempted'};
 const w=JSON.parse(fs.readFileSync(paths(config).file,'utf8')),projectId=saved.projectId||routeProject(config,{sessionId:input.session_id,cwd:input.cwd},w);
 if(projectId==='codex_inbox')return {captured:false,reason:'choose an explicit project for this chat'};
 const summary=redact(input.last_assistant_message).slice(0,12000);if(!summary)return {captured:false,reason:'empty response'};
 const result=queueReceipt(config,{version:1,provider:'claude-code',sessionId:input.session_id,eventId:saved.eventId,projectId,title:'Claude · '+summary.split('\n').find(Boolean).slice(0,150),summary,request:saved.request,next:'Resume this Claude chat and review its latest saved response.'},{permissionEpoch:saved.permissionEpoch??null});
 if(result.queued)drainReceipts(config);
 if(result.queued)status(config,{lastClaudeCaptureAt:new Date().toISOString(),claudeCaptureError:null});
 return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 let feedback={};
 try{const raw=fs.readFileSync(0,'utf8');if(Buffer.byteLength(raw)>128000)throw Error('Hook input exceeds 128 KB');const {config}=loadConfig();const result=claudeHook(config,JSON.parse(raw));if(result.activated)feedback={hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'Branchi is enabled for this exact conversation and selected project. Future completed visible replies are saved locally automatically; no other chat was included.'}};}
 catch(e){console.error('Branchi Claude capture: '+redact(e.message));}
 // Advisory only. Never block, continue the agent, or request tools.
 console.log(JSON.stringify(feedback));
}
