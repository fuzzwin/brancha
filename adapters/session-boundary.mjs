import fs from 'node:fs';
import path from 'node:path';

export function sessionLogs(root,out=[]){
 if(!root||!fs.existsSync(root))return out;
 for(const e of fs.readdirSync(root,{withFileTypes:true})){const file=path.join(root,e.name);if(e.isDirectory())sessionLogs(file,out);else if(e.isFile()&&e.name.endsWith('.jsonl'))out.push(file);}
 return out;
}
export function sessionMetadata(file){
 const fd=fs.openSync(file,'r');
 try{const bytes=Buffer.alloc(65536),size=fs.readSync(fd,bytes,0,bytes.length,0),first=bytes.subarray(0,size).toString('utf8').split('\n')[0],r=JSON.parse(first);return r.type==='session_meta'?r.payload:{};}catch{return {};}finally{fs.closeSync(fd);}
}
export function sessionBoundary(config,id){
 const files={};
 for(const file of sessionLogs(config.sessionsDirectory))if(sessionMetadata(file).id===id){
  const stat=fs.statSync(file),fd=fs.openSync(file,'r'),last=Buffer.alloc(1);
  try{if(stat.size)fs.readSync(fd,last,0,1,stat.size-1);}finally{fs.closeSync(fd);}
  files[file]={offset:stat.size,identity:stat.ino,partial:stat.size>0&&last[0]!==10};
 }
 return {since:new Date().toISOString(),files};
}
