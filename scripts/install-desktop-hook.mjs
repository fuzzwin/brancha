import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
const q=s=>"'"+s.replaceAll("'","'\\''")+"'";
export function installDesktopHooks(target,{root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),node=process.execPath}={}){
 const config=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{};
 if(!config||typeof config!=='object'||Array.isArray(config)||config.hooks&&(typeof config.hooks!=='object'||Array.isArray(config.hooks)))throw Error('Invalid hooks configuration; no changes made.');
 const command=q(node)+' '+q(path.join(root,'adapters/desktop-hook.mjs'));config.hooks??={};let changed=false;
 for(const event of ['UserPromptSubmit','Stop']){
  if(config.hooks[event]!==undefined&&!Array.isArray(config.hooks[event]))throw Error('Invalid '+event+' hook groups; no changes made.');
  config.hooks[event]??=[];
  if(!config.hooks[event].some(group=>group.hooks?.some(h=>h.command===command))){config.hooks[event].push({hooks:[{type:'command',command,timeout:10,statusMessage:'Updating Branchi locally'}]});changed=true;}
 }
 let backup=null;if(changed){if(fs.existsSync(target)){backup=target+'.'+Date.now()+'.backup';fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);}atomic(target,config);}
 return {installed:true,changed,command,events:['UserPromptSubmit','Stop'],trustRequired:true,...(backup?{backup}:{}),note:'Review both exact definitions with /hooks before use. No trust bypass, chat activation, browser extension or model call was performed.'};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(installDesktopHooks(process.argv[2]||path.join(os.homedir(),'.codex/hooks.json')),null,2));
