import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
const q=s=>"'"+s.replaceAll("'","'\\''")+"'";
const target=process.argv[2]||path.join(os.homedir(),'.claude/settings.json'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{};
const command=q(process.execPath)+' '+q(path.join(root,'adapters/claude-hook.mjs'));
config.hooks??={};let changed=false;
for(const event of ['UserPromptSubmit','Stop']){
 config.hooks[event]??=[];
 if(!config.hooks[event].some(group=>group.hooks?.some(h=>h.command===command))){config.hooks[event].push({hooks:[{type:'command',command,timeout:10}]});changed=true;}
}
if(changed){if(fs.existsSync(target))fs.copyFileSync(target,target+'.'+Date.now()+'.backup',fs.constants.COPYFILE_EXCL);atomic(target,config);}
console.log(JSON.stringify({installed:true,changed,events:['UserPromptSubmit','Stop'],captureScope:'Only individually enabled chats; no transcript scanning. New Claude sessions may require settings reload.'}));
