import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CodexWatcher} from '../adapters/codex-watch.mjs';
import {paths,status} from '../adapters/capture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configFile=process.argv[2]||process.env.BRANCHA_CONFIG||path.join(os.homedir(),'.config/brancha/config.json');
const config=JSON.parse(fs.readFileSync(configFile,'utf8'));if(!config.vault||!config.sessionsDirectory)throw Error('Run npm run setup first.');
const p=paths(config);fs.mkdirSync(p.state,{recursive:true});
const watcher=new CodexWatcher(config);watcher.poll();
const child=spawn(process.execPath,[path.join(root,'companion/server.mjs'),config.vault,String(config.port||51207)],{stdio:'inherit',env:{...process.env,BRANCHA_CONFIG:path.resolve(configFile)}});
let exiting=false;const timer=setInterval(()=>{try{watcher.poll();}catch(e){status(config,{error:e.message});console.error('Capture: '+e.message);}},config.pollMs||3000);
child.on('exit',code=>{clearInterval(timer);if(!exiting){status(config,{enabled:false,error:'Companion server exited '+code});process.exitCode=code||1;}});
function stop(){if(exiting)return;exiting=true;clearInterval(timer);status(config,{enabled:false,stoppedAt:new Date().toISOString()});child.kill('SIGINT');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Brancha automatic Codex capture is active. Config: '+configFile);
