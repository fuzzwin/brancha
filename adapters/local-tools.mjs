import fs from 'node:fs';
import path from 'node:path';
import {validate} from '../dist/core.mjs';
import {tool, TOOLS} from '../cloud/worker.mjs';
import {atomic, paths, digest, controls} from './capture.mjs';
export {TOOLS};

// Same four tools as the cloud edition, backed by the user's local JSON record.
// No HTTP listener, model calls, cloud connection or background transcript access.
export function localTools(config) {
  const file=paths(config).file;
  const read=()=>{
    if(!fs.existsSync(file))return null;
    if(fs.statSync(file).size>8*1024*1024)throw Error('Workspace exceeds 8 MB.');
    const raw=fs.readFileSync(file,'utf8');validate(JSON.parse(raw));return raw;
  };
  const bucket={
    async get(){const raw=read();return raw?{etag:digest(raw),json:async()=>JSON.parse(raw)}:null;},
    async put(key,raw,options){
      fs.mkdirSync(path.dirname(file),{recursive:true});let fd;
      try{fd=fs.openSync(file+'.lock','wx');}catch(e){if(e.code==='EEXIST')throw Error('Workspace locked; reread before retrying.');throw e;}
      try{
        const current=read(),etag=current?digest(current):null,h=options.onlyIf;
        if(h.get('if-match')&&h.get('if-match')!=='"'+etag+'"'||h.get('if-none-match')==='*'&&current)return null;
        const w=validate(JSON.parse(raw));
        if(current){const dir=path.join(paths(config).state,'backups');fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(file,path.join(dir,Date.now()+'-'+crypto.randomUUID()+'.json'),fs.constants.COPYFILE_EXCL);}
        atomic(file,w);return {etag:digest(fs.readFileSync(file,'utf8'))};
      }finally{fs.closeSync(fd);fs.unlinkSync(file+'.lock');}
    }
  };
  return async(name,args={})=>{
    const definition=TOOLS.find(t=>t.name===name);if(!definition)throw Error('Unknown tool.');
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(definition.inputSchema.properties,k)))throw Error('Invalid tool arguments.');
    if(definition.inputSchema.required?.some(k=>args[k]===undefined))throw Error('Missing tool arguments.');
    if(!definition.annotations.readOnlyHint&&controls(config).paused)throw Error('Capture is paused. Resume before saving a checkpoint.');
    return tool(name,args,{BUCKET:bucket,BRANCHA_LOCAL:true});
  };
}
