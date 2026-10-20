import {observeGit} from './git-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig} from '../scripts/config.mjs';
import {paths,atomic,digest,sessionAllowed,controls,redact,capture,status} from './capture.mjs';
import {setChatPermission} from './chat-privacy.mjs';
import {visibleUserText} from './conversation-mapper.mjs';

// Both local-only Work and Codex use the documented Codex hook event schema.
// Never open transcript_path or run instructions from a response.
export function desktopHook(config,input){
 if(!['UserPromptSubmit','Stop'].includes(input.hook_event_name)||input.agent_id)return {captured:false,reason:'unsupported event'};
 if(typeof input.session_id!=='string'||typeof input.turn_id!=='string'||!input.turn_id||input.turn_id.length>200)throw Error('A stable session and turn identity is required.');
 let activated=false;
 if(input.hook_event_name==='UserPromptSubmit'&&typeof input.prompt==='string'){
  const prompt=input.prompt.trim(),match=prompt.match(/^(?:Brainch|Branchi) this chat for (.{1,150}?)\.?$/i);
  if(/^Exclude this chat from Branchi[.!]?$/i.test(prompt)){setChatPermission(config,input.session_id,'exclude');return {excluded:true};}
  if(match){
   const w=JSON.parse(fs.readFileSync(paths(config).file,'utf8')),name=match[1].toLowerCase(),matches=w.projects.filter(p=>p.title.toLowerCase()===name||p.id===match[1]);
   if(matches.length!==1)throw Error('Choose one exact existing Branchi project title.');
   if(controls(config).paused)return {captured:false,reason:'paused'};
   setChatPermission(config,input.session_id,'include',{projectId:matches[0].id});activated=true;
  }
 }
 if(!sessionAllowed(config,input.session_id)||config.captureEnabled===false||controls(config).paused)return {captured:false,reason:'excluded, disabled or paused'};
 const root=paths(config).state,key=digest(input.session_id+':'+input.turn_id),promptFile=path.join(root,'desktop-prompts',key+'.json');
 status(config,{desktopHookLastEventAt:new Date().toISOString(),desktopHookError:null});
 if(input.hook_event_name==='UserPromptSubmit'){
  const request=redact(visibleUserText(input.prompt||'')).slice(0,6000);
  if(request)atomic(promptFile,{request});
  return {staged:!!request,activated};
 }
 if(input.stop_hook_active||!input.last_assistant_message)return {captured:false,reason:'not a main completed response'};
 let request='';try{request=JSON.parse(fs.readFileSync(promptFile,'utf8')).request||'';}catch(e){if(e.code!=='ENOENT')throw e;}
 const packet={sessionId:input.session_id,turnId:input.turn_id,cwd:input.cwd,git:observeGit(config,{sessionId:input.session_id,cwd:input.cwd}),message:redact(input.last_assistant_message).slice(0,14000),request,adapter:'desktop-stop-hook',at:new Date().toISOString()};
 const folder=path.join(root,'desktop-inbox'),file=path.join(folder,key+'.json');fs.mkdirSync(folder,{recursive:true});
 // A completed turn is durable before attempting the shared canonical lock.
 if(!fs.existsSync(file))try{fs.writeFileSync(file,JSON.stringify(packet),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 drainDesktopHooks(config);
 try{fs.unlinkSync(promptFile);}catch(e){if(e.code!=='ENOENT')throw e;}
 return {queued:fs.existsSync(file),delivered:!fs.existsSync(file)};
}
export function drainDesktopHooks(config){
 if(config.captureEnabled===false||controls(config).paused)return {skipped:'disabled or paused'};
 const folder=path.join(paths(config).state,'desktop-inbox');if(!fs.existsSync(folder))return {processed:0};let processed=0;
 for(const name of fs.readdirSync(folder).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,20)){
  const file=path.join(folder,name);let input;try{input=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!sessionAllowed(config,input.sessionId)){try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}continue;}
  const result=capture(config,input);if(result.retry)continue;
  if(result.captured||result.reason==='duplicate')status(config,{lastDesktopHookCaptureAt:new Date().toISOString(),desktopHookError:null});
  try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}processed++;
 }
 return {processed};
}
export function runDesktopHook(){
 let feedback={};
 try{
  const raw=fs.readFileSync(0,'utf8');if(Buffer.byteLength(raw)>128000)throw Error('Hook input exceeds 128 KB');
  const {config}=loadConfig(),result=desktopHook(config,JSON.parse(raw));
  if(result.activated)feedback={hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'Branchi is enabled for this exact local conversation and selected project. Completed responses save automatically; other chats remain off. Do not save a duplicate manual checkpoint.'}};
 }catch(e){feedback={systemMessage:'Branchi desktop capture needs attention: '+redact(e.message)};}
 // Advisory JSON only: never block or continue a turn, and never invoke a model.
 console.log(JSON.stringify(feedback));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runDesktopHook();
