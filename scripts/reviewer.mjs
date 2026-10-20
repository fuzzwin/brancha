import {loadConfig} from './config.mjs';
import {ProjectReviewer} from '../adapters/project-reviewer.mjs';
import fs from 'node:fs';import {atomic} from '../adapters/capture.mjs';
const {config,configFile}=loadConfig();const command=process.argv[2]||'run';
if(command==='enable'||command==='disable'){
 fs.copyFileSync(configFile,configFile+'.'+Date.now()+'.backup',fs.constants.COPYFILE_EXCL);
 config.reviewer={maxCallsPerDay:8,timeoutMs:120000,...config.reviewer,enabled:command==='enable'};
 if(command==='enable'&&!config.mapper?.enabled)throw Error('Enable the conversation mapper first so completed visible turns are queued.');
 atomic(configFile,config);console.log(JSON.stringify({enabled:config.reviewer.enabled,model:'gpt-6-luna',effort:'high',maxCallsPerDay:config.reviewer.maxCallsPerDay,restartRequired:true}));
}else if(command==='request'){new ProjectReviewer(config).request();console.log('Review requested. The running companion will process it.');}
else if(command==='run')console.log(JSON.stringify(await new ProjectReviewer(config).run()));
else throw Error('Use reviewer.mjs enable|disable|run|request');
