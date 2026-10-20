import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {atomic,controls,paths as capturePaths} from '../adapters/capture.mjs';
import {validate} from '../dist/core.mjs';
import {obsidianFiles} from './obsidian.mjs';
import {atomicText} from '../skills/brancha/scripts/storage.mjs';
import {loadConfig} from '../scripts/config.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function startServer(options={}){
const vault=path.resolve(options.vault||path.join(base,'vault'));
const file=path.join(vault,'brancha.json'),port=Number(options.port||51207);
fs.mkdirSync(vault,{recursive:true});
if(!fs.existsSync(file))fs.copyFileSync(path.join(base,'dist/starter-workspace.json'),file,fs.constants.COPYFILE_EXCL);
const captureConfig=options.config||null;
function captureStatus(){if(!captureConfig)return null;let latest={};try{latest=JSON.parse(fs.readFileSync(capturePaths(captureConfig).status,'utf8'));}catch{}return {...latest,paused:controls(captureConfig).paused===true};}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let lastHash='',lastDay='',lastError='';
function read(){const raw=fs.readFileSync(file,'utf8');if(raw.length>8*1024*1024)throw Error('Workspace too large');return {raw,w:validate(JSON.parse(raw)),etag:hash(raw)};}
function refresh(){const r=read(),day=new Date().toLocaleDateString('en-CA');if(r.etag===lastHash&&day===lastDay)return r;
 const generated=path.join(vault,'Generated');fs.mkdirSync(generated,{recursive:true});
 for(const [name,original]of Object.entries(obsidianFiles(r.w))){if(name==='brancha.json')continue;let content=original.replaceAll('[[','[[Generated/');if(name.endsWith('.canvas')){const canvas=JSON.parse(original);canvas.nodes.forEach(n=>{if(n.file)n.file='Generated/'+n.file;if(n.text)n.text=n.text.replaceAll('[[','[[Generated/')});content=JSON.stringify(canvas,null,2);}atomicText(path.join(generated,name),content);}
 atomicText(path.join(generated,'START HERE.md'),'---\ncssclasses: brancha-dashboard\n---\n# Pick up the thread\n\nYour project dashboards are the starting point. They bring together the goal, mindmap, next action, decisions and evidence.\n\n[[Generated/Dashboards/index|Open all project dashboards →]] · [[Generated/Brancha.canvas|Visual project overview]]\n\n'+r.w.projects.map(p=>`- [[Generated/Dashboards/${p.id}|${p.title}]]`).join('\n')+'\n\n## Keep useful notes\n\nCopy a [[Generated/Templates/Check-in|Check-in]], [[Generated/Templates/Decision|Decision]] or [[Generated/Templates/Evidence review|Evidence review]] into Notes for your own writing.\n\nThese dashboards update from Brancha while the companion runs. Personal notes belong in Notes; generated pages are refreshed.');
 fs.mkdirSync(path.join(vault,'Notes'),{recursive:true});lastHash=r.etag;lastDay=day;lastError='';return r;
}
refresh();
const token=crypto.randomBytes(32).toString('hex');
const origin=`http://127.0.0.1:${port}`;
const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 try{
  if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{error:'Local host only'});
  if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origin rejected'});
  const url=new URL(req.url,origin);
  if(url.pathname==='/api/capture'&&req.method==='POST'){if(!captureConfig||req.headers['x-brancha-token']!==token)return send(403,{error:'Local capture connection required'});let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)return send(413,{error:'Invalid control'});}const control=JSON.parse(body);if(typeof control.paused!=='boolean')throw Error('Choose paused true or false.');atomic(capturePaths(captureConfig).control,{paused:control.paused,changedAt:new Date().toISOString()});return send(200,{capture:captureStatus()});}
  if(url.pathname==='/api/workspace'){
   if(req.headers['x-brancha-token']!==token)return send(403,{error:'Open the local companion to connect'});
   if(req.method==='GET'){const r=refresh();return send(200,{workspace:r.w,etag:r.etag,vault,viewError:lastError,capture:captureStatus()});}
   if(req.method!=='PUT')return send(405,{error:'Method not allowed'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8*1024*1024)return send(413,{error:'Workspace too large'});}
   const next=validate(JSON.parse(body));let fd;const lock=file+'.lock';
   try{fd=fs.openSync(lock,'wx');}catch{return send(409,{error:'Workspace is being updated. Try again after the other update finishes.'});}
   try{const current=read();if(req.headers['if-match']!==current.etag)return send(409,{error:'New changes arrived. Close the form, refresh and apply your change again.'});
    for(const p of current.w.projects){const found=next.projects.find(x=>x.id===p.id);if(!found||found.prompt!==p.prompt)throw Error('Live updates must preserve projects and original prompts. Use a separate workspace for replacement imports.');}
    if(next.revision<=current.w.revision)throw Error('Revision must advance');
    const backups=path.join(vault,'.brancha-backups');fs.mkdirSync(backups,{recursive:true});fs.writeFileSync(path.join(backups,Date.now()+'-'+crypto.randomUUID()+'.json'),current.raw,{flag:'wx'});
    atomic(file,next);
   }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
   let r;try{r=refresh();}catch(e){lastError=e.message;r=read();}
   return send(200,{workspace:r.w,etag:r.etag,vault,viewError:lastError,capture:captureStatus()});
  }
  if(req.method!=='GET')return send(405,{error:'Method not allowed'});
  const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const dest=path.resolve(base,'dist',relative);if(!dest.startsWith(path.join(base,'dist')+path.sep))return send(403,{error:'Invalid path'});
  let data=fs.readFileSync(dest);if(relative==='index.html')data=Buffer.from(data.toString().replace('<head>',`<head><meta name="brancha-local-token" content="${token}">`));
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(dest)]||'text/plain'});res.end(data);
 }catch(e){send(e.code==='ENOENT'?404:400,{error:e.message});}
});
const timer=setInterval(()=>{try{refresh();}catch(e){lastError=e.message;}},1000);
server.on('error',e=>{clearInterval(timer);console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Brancha live: ${origin}\nVault: ${vault}\nKeep this process running. Ctrl+C stops live updates.`));
function stop(){clearInterval(timer);server.close();}
return {server,stop};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const instance=startServer({vault:process.argv[2],port:process.argv[3],config:process.env.BRANCHA_CONFIG?loadConfig().config:null});
 process.on('SIGINT',instance.stop);process.on('SIGTERM',instance.stop);
}
