import fs from 'node:fs';import crypto from 'node:crypto';
import {setChatPermission,chatAllowed,permissionEpoch,consentMatches} from './chat-privacy.mjs';
import {paths,controls,status} from './capture.mjs';
import {ingestCheckpoint} from './checkpoint.mjs';
import {privacyView} from './chat-privacy.mjs';
export function browserChat(value){
 const u=new URL(value),match=u.pathname.match(/^\/(?:c|chat)\/([a-f0-9-]{36})\/?$/i);
 if(u.protocol!=='https:'||!match||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(match[1])))throw Error('Open an existing ChatGPT or Claude conversation with a stable chat URL.');
 const provider=u.hostname==='chatgpt.com'&&u.pathname.startsWith('/c/')?'chatgpt-web':u.hostname==='claude.ai'&&u.pathname.startsWith('/chat/')?'claude-web':null;
 if(!provider)throw Error('Unsupported chat origin.');
 return {provider,sessionId:provider+'-'+match[1].toLowerCase(),sourceRef:u.origin+u.pathname.replace(/\/$/,'')};
}
export function browserReceipt(config,input){
 if(!input||!['projects','status','activate','deactivate','capture'].includes(input.op))throw Error('Unknown browser operation.');
 const read=()=>{const p=paths(config).file;if(fs.statSync(p).size>8*1024*1024)throw Error('Workspace too large');return JSON.parse(fs.readFileSync(p,'utf8'));};
 if(input.op==='projects')return {projects:privacyView(config,read()).projects.map(p=>({id:p.id,title:p.title}))};
 const chat=browserChat(input.url);
 if(input.op==='activate'){if(controls(config).paused)throw Error('Capture is paused.');setChatPermission(config,chat.sessionId,'include',{projectId:input.projectId});return {enabled:true,...chat,permissionEpoch:permissionEpoch(config,chat.sessionId)};}
 if(input.op==='deactivate'){setChatPermission(config,chat.sessionId,'exclude');return {enabled:false,...chat};}
 if(input.op==='status')return {enabled:chatAllowed(config,chat.sessionId),paused:!!controls(config).paused,...chat,permissionEpoch:permissionEpoch(config,chat.sessionId)};
 // Validate permission before retaining or processing any text.
 if(!chatAllowed(config,chat.sessionId))return {captured:false,reason:'excluded'};
 if(controls(config).paused)return {captured:false,reason:'paused'};
 if(!consentMatches(config,{sessionId:chat.sessionId,permissionEpoch:input.permissionEpoch??null}))return {captured:false,reason:'before-consent'};
 for(const [key,max]of [['summary',12000],['request',6000],['turnKey',300]])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)throw Error('Missing or oversized visible '+key+'.');
 const w=read(),permission=JSON.parse(fs.readFileSync(paths(config).state+'/chat-permissions.json','utf8')).chats[chat.sessionId];
 if(!permission?.projectId)throw Error('Activate this exact chat with a project first.');
 const eventId=crypto.createHash('sha256').update(JSON.stringify([chat.provider,chat.sessionId,input.turnKey,input.request,input.summary])).digest('hex');
 const result=ingestCheckpoint(config,{version:1,...chat,eventId,projectId:permission.projectId,title:chat.provider.replace('-web','')+' · '+input.summary.split('\n').find(Boolean).slice(0,150),summary:input.summary,request:input.request,next:'Open this chat’s latest saved response and confirm the next concrete action.'},w.revision,{permissionEpoch:input.permissionEpoch??null});
 if(result.captured||result.reason==='duplicate')status(config,{lastBrowserCaptureAt:new Date().toISOString(),lastBrowserProvider:chat.provider,browserCaptureError:null});
 return result;
}
