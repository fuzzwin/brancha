import fs from 'node:fs';
import {startServer} from './server.mjs';
import {pullCloud} from '../adapters/cloud-pull.mjs';
import {CodexWatcher} from '../adapters/codex-watch.mjs';
import {paths,status} from '../adapters/capture.mjs';
import {loadConfig} from '../scripts/config.mjs';
const {config,configFile}=loadConfig(process.argv[2]||process.env.BRANCHA_CONFIG);
const p=paths(config);fs.mkdirSync(p.state,{recursive:true});
const watcher=config.captureEnabled?new CodexWatcher(config):null;
if(watcher)watcher.poll();else status(config,{enabled:false,adapter:'portable-checkpoint',error:null});
const companion=startServer({vault:config.vault,port:config.port,config});
let exiting=false;const timer=setInterval(()=>{try{watcher?.poll();}catch(e){status(config,{error:e.message});console.error('Capture: '+e.message);}},config.pollMs||3000);
let pulling=false;const pull=async()=>{if(pulling||!config.cloud?.connectionFile)return;pulling=true;try{await pullCloud(config);}catch(e){status(config,{cloudEnabled:true,cloudError:e.message});}finally{pulling=false;}};pull();const cloudTimer=setInterval(pull,30000);
companion.server.on('error',()=>{clearInterval(timer);clearInterval(cloudTimer);status(config,{enabled:false,error:'Companion server could not start.'});});
function stop(){if(exiting)return;exiting=true;clearInterval(timer);clearInterval(cloudTimer);status(config,{enabled:false,stoppedAt:new Date().toISOString()});companion.stop();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Brancha '+(watcher?'automatic Codex capture':'portable checkpoints')+' is active. Config: '+configFile);
