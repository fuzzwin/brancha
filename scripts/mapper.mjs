import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {loadConfig} from './config.mjs';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {ConversationMapper} from '../adapters/conversation-mapper.mjs';
const [command,arg]=process.argv.slice(2),{config,configFile}=loadConfig();
if(command==='enable'||command==='disable'){
 fs.copyFileSync(configFile,configFile+'.'+Date.now()+'.backup',fs.constants.COPYFILE_EXCL);
 const bundled='/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex';
 config.mapper={maxCallsPerDay:20,maxHighPerDay:3,debounceMs:30000,timeoutMs:90000,executable:process.platform==='darwin'&&fs.existsSync(bundled)?bundled:'codex',...config.mapper,enabled:command==='enable'};
 atomic(configFile,config);console.log(JSON.stringify({enabled:config.mapper.enabled,model:'gpt-6-luna',low:'low',escalation:'high',maxCallsPerDay:config.mapper.maxCallsPerDay,restartRequired:true}));
}else if(command==='status'){
 const root=path.join(config.vault,'.brancha/mapper'),folder=path.join(root,'jobs'),counts={};let last=null;
 for(const file of fs.existsSync(folder)?fs.readdirSync(folder).filter(x=>x.endsWith('.json')):[]){const job=JSON.parse(fs.readFileSync(path.join(folder,file)));counts[job.state]=(counts[job.state]||0)+1;if(job.completedAt&&(!last||job.completedAt>last.at))last={at:job.completedAt,items:job.applied?.items,receipts:job.receipts};}
 console.log(JSON.stringify({enabled:Boolean(config.mapper?.enabled),model:'gpt-6-luna',counts,last},null,2));
}else if(command==='enqueue'){
 if(!arg||fs.statSync(arg).size>100000)throw Error('Provide one bounded visible-conversation packet JSON file (max 100 KB).');
 if(!config.mapper?.enabled)throw Error('Enable the mapper first.');const m=new ConversationMapper(config);console.log(JSON.stringify({queued:m.enqueue(JSON.parse(fs.readFileSync(arg,'utf8')))}));
}else if(command==='retry'){
 if(!/^[a-f0-9]{64}$/.test(arg||''))throw Error('Provide the failed job ID from the private mapper jobs folder.');
 const file=path.join(config.vault,'.brancha/mapper/jobs',arg+'.json'),job=JSON.parse(fs.readFileSync(file,'utf8'));if(job.state!=='failed')throw Error('Only a failed extraction can be explicitly retried.');
 job.previousAttempts??=[];job.previousAttempts.push({error:job.error,receipts:job.receipts||[]});job.state='pending';job.queuedAt=Date.now();delete job.error;atomic(file,job);console.log('Queued one explicit retry; existing daily limits still apply.');
}else if(command==='run'){
 if(!config.mapper?.enabled)throw Error('Enable the mapper first.');await new ConversationMapper(config).tick();console.log('Mapper checked one queued turn; inspect mapper status for its receipt.');
}else throw Error('Use mapper.mjs enable|disable|status|enqueue PACKET.json|retry JOB_ID|run. Enabling requires a signed-in Codex CLI; no API key is created.');
