import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {atomic} from '../adapters/capture.mjs';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
const dir=path.join(os.homedir(),'.config/brancha');const configFile=value('--config')&&args.includes('--config')?path.resolve(value('--config')):path.join(dir,'config.json');
if(fs.existsSync(configFile))throw Error('Configuration already exists: '+configFile+'. Edit it explicitly to preserve project routing.');
const config={vault:args.includes('--vault')?path.resolve(value('--vault')):path.join(os.homedir(),'Documents/Brancha'),sessionsDirectory:path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'),port:51207,pollMs:3000,sessionProjects:{},directoryProjects:[]};atomic(configFile,config);console.log('Created '+configFile+'\nStart with: node companion/service.mjs '+JSON.stringify(configFile)+'\nOpen http://127.0.0.1:51207 and the configured vault in Obsidian.');
