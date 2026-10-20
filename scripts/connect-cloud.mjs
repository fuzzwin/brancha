import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {atomic} from '../adapters/capture.mjs';
const configFile=process.argv[2]||path.join(os.homedir(),'.config/brancha/config.json');
if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdout.write('Ready for private cloud connection JSON on stdin (input is hidden).\n');
let raw='';const input=await new Promise((resolve,reject)=>{process.stdin.on('data',b=>{raw+=b.toString();if(raw.includes('\n'))resolve(raw.slice(0,raw.indexOf('\n')));if(raw.length>1000000)reject(Error('Connection input too large'));});process.stdin.on('end',()=>resolve(raw));});if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
try{
 const value=JSON.parse(input),url=new URL(value.url);if(url.protocol!=='https:'||!value.siteBearer||!value.bridgeToken)throw Error('Provide an HTTPS private Site URL and both connection credentials');
 const headers={'OAI-Sites-Authorization':'Bearer '+value.siteBearer,'x-brancha-bridge':value.bridgeToken};
 const existing=await fetch(new URL('/api/workspace',url),{headers,signal:AbortSignal.timeout(15000)});if(!existing.ok)throw Error('Cloud authentication failed: HTTP '+existing.status);let data=await existing.json();
 if(value.seedFile&&data.workspace.projects.length===0){const seed=fs.readFileSync(value.seedFile,'utf8');const response=await fetch(new URL('/api/import',url),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:seed,signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Cloud initialisation failed: HTTP '+response.status);console.log('Initialised private cloud project baselines.');}
 const config=JSON.parse(fs.readFileSync(configFile,'utf8'));const connectionFile=path.join(path.dirname(configFile),'cloud-connection.json');if(fs.existsSync(connectionFile)){const previous=JSON.parse(fs.readFileSync(connectionFile,'utf8'));if(previous.url!==url.origin)throw Error('A different cloud workspace is already connected; reconcile it before replacing the connection.');}
 atomic(connectionFile,{url:url.origin,siteBearer:value.siteBearer,bridgeToken:value.bridgeToken});config.cloud={connectionFile};atomic(configFile,config);console.log('Private cloud connection saved. Restart the companion to begin pulling ChatGPT checkpoints.');
}catch(e){console.error(e.message);process.exitCode=1;}
