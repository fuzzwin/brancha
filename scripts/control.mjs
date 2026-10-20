import {loadConfig} from './config.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {atomic,paths,controls} from '../adapters/capture.mjs';
const {config,configFile:configPath}=loadConfig();const [cmd,sessionId,projectId]=process.argv.slice(2),p=paths(config);
if(cmd==='pause'||cmd==='resume'){atomic(p.control,{paused:cmd==='pause',changedAt:new Date().toISOString()});console.log('Capture '+(cmd==='pause'?'paused':'resumed'));}
else if(cmd==='status'){let s={};try{s=JSON.parse(fs.readFileSync(p.status,'utf8'));}catch{}console.log(JSON.stringify({...s,...controls(config)},null,2));}
else if(cmd==='route-session'){const w=JSON.parse(fs.readFileSync(p.file,'utf8'));if(!sessionId||!w.projects.some(p=>p.id===projectId))throw Error('Provide session ID and an existing project ID.');config.sessionProjects??={};config.sessionProjects[sessionId]=projectId;atomic(configPath,config);console.log('Route saved. Restart the service to apply it. Existing checkpoints are preserved.');}
else throw Error('Use status, pause, resume or route-session SESSION_ID PROJECT_ID');
