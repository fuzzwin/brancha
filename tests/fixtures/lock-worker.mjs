import fs from 'node:fs';
import path from 'node:path';
import {acquireLock} from '../../skills/brancha/scripts/locking.mjs';
const [directory,mode='hold']=process.argv.slice(2),lock=path.join(directory,'workspace.lock');
if(mode==='hold'){acquireLock(lock);console.log('held');setInterval(()=>{},1000);}
else for(let i=0;i<20;i++){
 let release;
 while(!release){try{release=acquireLock(lock);}catch(e){if(e.code!=='EEXIST')throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2);}}
 try{
  const active=fs.openSync(path.join(directory,'active'),'wx');
  try{const file=path.join(directory,'count'),n=Number(fs.readFileSync(file,'utf8'));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1);fs.writeFileSync(file,String(n+1));}
  finally{fs.closeSync(active);fs.unlinkSync(path.join(directory,'active'));}
 }finally{release();}
}
