import fs from 'node:fs';import path from 'node:path';import {validate,event} from '../dist/core.mjs';import {paths,atomic,status,controls} from './capture.mjs';
export async function pullCloud(config,fetcher=fetch){
 if(!config.cloud?.connectionFile||controls(config).paused)return {changed:false};
 const connection=JSON.parse(fs.readFileSync(config.cloud.connectionFile,'utf8'));const url=new URL(connection.url);if(url.protocol!=='https:')throw Error('Cloud connection requires HTTPS');
 const response=await fetcher(new URL('/api/workspace',url),{headers:{'OAI-Sites-Authorization':'Bearer '+connection.siteBearer,'x-brancha-bridge':connection.bridgeToken},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('ChatGPT cloud connection returned HTTP '+response.status);const remote=validate((await response.json()).workspace);const p=paths(config);let fd;try{fd=fs.openSync(p.file+'.lock','wx');}catch(e){if(e.code==='EEXIST')return {changed:false,retry:true};throw e;}
 try{
  const local=validate(JSON.parse(fs.readFileSync(p.file,'utf8'))),ids=new Set([...local.projects,...local.nodes,...local.edges,...local.events].map(x=>x.id));let changed=false;
  for(const pr of remote.projects.filter(x=>x.cloudOrigin))if(!ids.has(pr.id)){local.projects.push(pr);ids.add(pr.id);changed=true;}
  const ps=new Set(local.projects.map(x=>x.id));for(const n of remote.nodes.filter(x=>x.cloudOrigin))if(!ids.has(n.id)){if(!ps.has(n.projectId))throw Error('Cloud checkpoint project is missing');local.nodes.push(n);ids.add(n.id);changed=true;}
  const ns=new Set(local.nodes.map(x=>x.id));for(const e of remote.edges.filter(x=>x.cloudOrigin))if(!ids.has(e.id)&&ns.has(e.from)&&ns.has(e.to)){local.edges.push(e);ids.add(e.id);changed=true;}
  for(const e of remote.events.filter(x=>x.cloudOrigin))if(!ids.has(e.id)){if(!ps.has(e.projectId)||e.nodeId&&!ns.has(e.nodeId))throw Error('Cloud activity references missing work');local.events.push(e);ids.add(e.id);changed=true;}
  if(changed){local.revision++;validate(local);const raw=JSON.stringify(local,null,2);if(Buffer.byteLength(raw)>8*1024*1024)throw Error('Merged workspace exceeds 8 MB');const dir=path.join(p.state,'backups');fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(p.file,path.join(dir,Date.now()+'-cloud.json'));atomic(p.file,local);}
  status(config,{cloudEnabled:true,lastCloudPullAt:new Date().toISOString(),cloudError:null});return {changed};
 }finally{fs.closeSync(fd);fs.unlinkSync(p.file+'.lock');}
}
