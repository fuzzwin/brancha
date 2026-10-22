import fs from 'node:fs';
import path from 'node:path';
import {acquireLock} from '../../skills/brancha/scripts/locking.mjs';
const [directory,mode='hold']=process.argv.slice(2),lock=path.join(directory,'workspace.lock');
const deadline=Date.now()+45000;
if(mode==='hold'){acquireLock(lock);console.log('held');setInterval(()=>{},1000);setTimeout(()=>process.exit(2),45000);}
else for(let i=0;i<20;i++){
 let release;
 while(!release){if(Date.now()>deadline)throw Error('Lock stress deadline exceeded');try{release=acquireLock(lock);}catch(e){if(e.code!=='EEXIST')throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2+Math.floor(Math.random()*9));}}
 try{
  const active=fs.openSync(path.join(directory,'active'),'wx');
  try{const file=path.join(directory,'count'),n=Number(fs.readFileSync(file,'utf8'));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1);fs.writeFileSync(file,String(n+1));}
  finally{fs.closeSync(active);fs.unlinkSync(path.join(directory,'active'));}
 }finally{release();}
}
