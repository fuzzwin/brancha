import {observeGit} from './git-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {capture,atomic,paths,status,redact,controls,sessionAllowed} from './capture.mjs';
import {visibleUserText} from './conversation-mapper.mjs';
import {sessionLogs as logs,sessionMetadata as metadata} from './session-boundary.mjs';
import {captureBoundary} from './chat-privacy.mjs';
export class CodexWatcher{
 constructor(config,{mapper=null}={}){this.config=config;this.mapper=mapper;this.root=path.resolve(config.sessionsDirectory);this.file=path.join(paths(config).state,'codex-cursors.json');this.data={version:1,activatedAt:new Date().toISOString(),files:{},queue:[]};
  if(fs.existsSync(this.file)){this.data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(this.data.version!==1)throw Error('Unsupported capture cursor version');}
  else{for(const p of logs(this.root)){const st=fs.statSync(p);this.data.files[p]={offset:st.size,identity:st.ino,partial:''};}atomic(this.file,this.data);}
  status(config,{enabled:true,adapter:'codex-session-watch',startedAt:new Date().toISOString(),error:null});
 }
 poll(){
  // Pausing advances the cursor so paused work is not collected after resuming.
  const paused=controls(this.config).paused;
  for(const file of logs(this.root)){
   const stat=fs.statSync(file);let cursor=this.data.files[file];
   if(!cursor)cursor=this.data.files[file]={offset:0,identity:stat.ino,partial:''};
   if(paused){cursor.offset=stat.size;cursor.partial='';cursor.userMessages=[];continue;}
   if(cursor.identity!==stat.ino||stat.size<cursor.offset){cursor.offset=0;cursor.partial='';cursor.identity=stat.ino;delete cursor.sessionId;delete cursor.permissionEpoch;cursor.userMessages=[];}
   if(stat.size===cursor.offset)continue;
   if(!cursor.sessionId){const meta=metadata(file);cursor.sessionId=meta.id;cursor.cwd=meta.cwd;cursor.subagent=typeof meta.source==='object'&&Boolean(meta.source?.subagent);}
   if(cursor.subagent||!sessionAllowed(this.config,cursor.sessionId)){cursor.offset=stat.size;cursor.partial='';cursor.userMessages=[];continue;}
   const boundary=captureBoundary(this.config,cursor.sessionId);
   if(boundary&&cursor.permissionEpoch!==boundary.epoch){
    const baseline=boundary.files[file];
    if(baseline&&baseline.identity===stat.ino&&stat.size>=baseline.offset){cursor.offset=Math.max(cursor.offset,baseline.offset);cursor.discardPartial=baseline.partial&&cursor.offset===baseline.offset;}
    else if(stat.birthtimeMs<Date.parse(boundary.since)){cursor.offset=stat.size;}
    cursor.partial='';cursor.userMessages=[];cursor.permissionEpoch=boundary.epoch;
   }
   const fd=fs.openSync(file,'r');try{
    const count=Math.min(stat.size-cursor.offset,1024*1024),bytes=Buffer.alloc(count),n=fs.readSync(fd,bytes,0,count,cursor.offset);cursor.offset+=n;
    const whole=Buffer.concat([Buffer.from(cursor.partial||'','base64'),bytes.subarray(0,n)]);let last=whole.lastIndexOf(10);if(last<0){if(whole.length>8*1024*1024)throw Error('Codex record exceeded 8 MB; adapter needs review.');cursor.partial=whole.toString('base64');continue;}
    cursor.partial=whole.subarray(last+1).toString('base64');
    const lines=whole.subarray(0,last).toString('utf8').split('\n');if(cursor.discardPartial){lines.shift();cursor.discardPartial=false;}
    for(const line of lines){
     let r;try{r=JSON.parse(line);}catch{continue;}
     if(boundary&&r.timestamp&&Date.parse(r.timestamp)<Date.parse(boundary.since))continue;
     if(r.type==='session_meta'){cursor.sessionId=r.payload.id;cursor.cwd=r.payload.cwd;cursor.subagent=typeof r.payload.source==='object'&&Boolean(r.payload.source?.subagent);}
     const v=r.payload;if(!v||cursor.subagent)continue;
     if(r.type==='response_item'&&v.type==='message'&&v.role==='user'){
      const raw=(v.content||[]).filter(c=>['input_text','text'].includes(c.type)).map(c=>c.text||'').join('\n');
      if(/^Automation: Branchi maintenance/m.test(raw))cursor.maintenanceTurn=true;
     }
     if(r.type==='response_item'&&v.type==='message'&&v.role==='user'){
      const raw=(v.content||[]).filter(c=>['input_text','text'].includes(c.type)).map(c=>c.text||'').join('\n');
      if(raw.includes('<heartbeat>')||/^Automation:/m.test(raw))cursor.mapperExcludedTurn=true;
      const text=visibleUserText(raw);
      if(text){cursor.userMessages??=[];cursor.userMessages.push({role:'user',text});cursor.userMessages=cursor.userMessages.slice(-7);}
     }
     if(r.type!=='event_msg')continue;
     if(v.type==='task_started'){cursor.turnId=v.turn_id;cursor.userMessages=[];cursor.mapperExcludedTurn=false;cursor.maintenanceTurn=false;}
     if(v.type==='task_complete'&&cursor.maintenanceTurn){cursor.userMessages=[];continue;}
     if(v.type==='task_complete'&&cursor.sessionId&&v.last_agent_message){const turnId=v.turn_id||cursor.turnId;if(!turnId)continue;this.data.queue.push({sessionId:cursor.sessionId,turnId,cwd:cursor.cwd,git:observeGit(this.config,{sessionId:cursor.sessionId,cwd:cursor.cwd}),message:redact(v.last_agent_message).slice(0,14000),request:(cursor.userMessages||[]).map(m=>m.text).join('\n\n').slice(-6000),at:v.completed_at||r.timestamp,adapter:'codex-session-watch',permissionEpoch:boundary?.epoch??null,...(this.mapper?{mapperExcluded:cursor.mapperExcludedTurn===true,messages:[...(cursor.userMessages||[]),{role:'assistant',text:redact(v.last_agent_message).slice(0,8000)}]}:{})});cursor.userMessages=[];}
    }
   }finally{fs.closeSync(fd);}
  }
  if(paused){atomic(this.file,this.data);status(this.config,{lastScanAt:new Date().toISOString(),paused:true});return;}
  const pending=[];for(const input of this.data.queue){try{if(!sessionAllowed(this.config,input.sessionId))continue;const result=capture(this.config,input);if(result.retry)pending.push(input);else if(result.captured||result.reason==='duplicate')this.mapper?.enqueue(input);}catch(e){pending.push(input);status(this.config,{error:e.message});break;}}
  // Retain unprocessed entries on failure; capture's session/turn key makes replay safe.
  if(pending.length){const first=this.data.queue.findIndex(x=>x===pending[0]);this.data.queue=this.data.queue.slice(first);}else this.data.queue=[];
  atomic(this.file,this.data);status(this.config,{lastScanAt:new Date().toISOString(),paused});
 }
}
