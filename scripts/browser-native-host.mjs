import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {browserReceipt} from '../adapters/browser-receipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'browser-extension/manifest.json'),'utf8'));
export const extensionId=crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const caller=process.argv.find(a=>a.startsWith('chrome-extension://'));
if(caller!=='chrome-extension://'+extensionId+'/')throw Error('Unregistered extension origin.');
const arg=process.argv.find(a=>a.startsWith('--config=')),{config}=loadConfig(arg?.slice(9));
let buffer=Buffer.alloc(0);const reply=v=>{const body=Buffer.from(JSON.stringify(v)),head=Buffer.alloc(4);head.writeUInt32LE(body.length);process.stdout.write(Buffer.concat([head,body]));};
process.stdin.on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);
 while(buffer.length>=4){const size=buffer.readUInt32LE(0);if(size>64000){reply({error:'Browser packet exceeds 64 KB'});process.exit(1);}if(buffer.length<size+4)return;
  const raw=buffer.subarray(4,size+4);buffer=buffer.subarray(size+4);
  try{reply(browserReceipt(config,JSON.parse(raw.toString('utf8'))));}catch(e){reply({error:e.message});}
 }
});
