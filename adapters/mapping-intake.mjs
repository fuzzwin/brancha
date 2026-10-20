import fs from 'node:fs';
import path from 'node:path';
import {paths,atomic,controls,sessionAllowed,status} from './capture.mjs';
import {validate} from '../dist/core.mjs';
import {visibleUserText} from './conversation-mapper.mjs';

// Recover the capture -> map handoff from saved receipts, never external transcripts.
// Receipt identities are acknowledged only after enqueue succeeds or is a no-op.
export class MappingIntake {
 constructor(config,mapper){this.config=config;this.mapper=mapper;this.file=path.join(paths(config).state,'mapping-intake.json');this.stamp=null;}
 tick(){
  if(!this.mapper||!this.config.mapper?.enabled||controls(this.config).paused)return {skipped:'paused or disabled'};
  const file=paths(this.config).file;if(!fs.existsSync(file))return {skipped:'empty'};
  const st=fs.statSync(file),stamp=st.mtimeMs+':'+st.size;
  if(stamp===this.stamp)return {skipped:'unchanged'};
  if(st.size>8*1024*1024)throw Error('Workspace exceeds 8 MB.');
  const w=validate(JSON.parse(fs.readFileSync(file,'utf8')));
  const state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,seen:[]};
  if(state.version!==1||!Array.isArray(state.seen))throw Error('Invalid mapping intake cursor; inspect before recovery.');
  const seen=new Set(state.seen);let queued=0,checked=0,remaining=false;
  for(const e of w.events){
   const n=e.capture||(e.checkpointId?e.after:null),pv=n?.capture||n?.checkpoint;
   if(!pv||!e.id||seen.has(e.id))continue;
   if(checked>=100){remaining=true;break;}checked++;
   const request=visibleUserText(pv.request||''),body=String(n.detail||'').replace(/^AUTOMATIC CHECKPOINT[^\n]*\n*/,'').trim();
   if(sessionAllowed(this.config,pv.sessionId)&&!/<heartbeat>|^Automation:/m.test(request)&&body){
    queued+=Number(this.mapper.enqueue({sessionId:pv.sessionId,turnId:pv.turnId||pv.eventId,provider:pv.provider||'codex',...(n.checkpoint?{projectId:n.projectId,sourceNodeId:n.id}:{}),cwd:pv.cwd,at:pv.at||e.at,messages:[...(request?[{role:'user',text:request}]:[]),{role:'assistant',text:body}]}));
   }
   seen.add(e.id);
  }
  atomic(this.file,{version:1,seen:[...seen],checkedAt:new Date().toISOString()});
  if(!remaining)this.stamp=stamp;
  status(this.config,{mappingIntakeAt:new Date().toISOString(),mappingIntakeQueued:queued,mappingIntakeError:null});
  return {queued,checked,remaining};
 }
}
