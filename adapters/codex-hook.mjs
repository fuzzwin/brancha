import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadConfig} from '../scripts/config.mjs';
import {capture,status} from './capture.mjs';
try{
 const file=process.env.BRANCHA_CONFIG||path.join(os.homedir(),'.config/brancha/config.json');
 if(fs.existsSync(file)){
  const config=loadConfig(file).config,input=JSON.parse(fs.readFileSync(0,'utf8'));
  if(input.hook_event_name==='Stop'&&input.last_assistant_message)capture(config,{sessionId:input.session_id,turnId:input.turn_id,cwd:input.cwd,message:input.last_assistant_message,adapter:'codex-stop-hook'});
 }
}catch(e){console.error('Branchi checkpoint was not saved: '+e.message);}
// Advisory only: never continue, block, or change the Codex turn.
console.log('{}');
