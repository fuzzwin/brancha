import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {atomic,controls,paths as capturePaths} from '../adapters/capture.mjs';
import {validate,vaultFiles} from '../dist/core.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vault=path.resolve(process.argv[2]||path.join(base,'vault'));
const file=path.join(vault,'brancha.json'),port=Number(process.argv[3]||51207);
fs.mkdirSync(vault,{recursive:true});
if(!fs.existsSync(file))fs.copyFileSync(path.join(base,'dist/starter-workspace.json'),file,fs.constants.COPYFILE_EXCL);
const captureConfig=process.env.BRANCHA_CONFIG?JSON.parse(fs.readFileSync(process.env.BRANCHA_CONFIG,'utf8')):null;
function captureStatus(){if(!captureConfig)return null;let latest={};try{latest=JSON.parse(fs.readFileSync(capturePaths(captureConfig).status,'utf8'));}catch{}return {...latest,paused:controls(captureConfig).paused===true};}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let lastHash='',lastError='';
function read(){const raw=fs.readFileSync(file,'utf8');if(raw.length>8*1024*1024)throw Error('Workspace too large');return {raw,w:validate(JSON.parse(raw)),etag:hash(raw)};}
function refresh(){const r=read();if(r.etag===lastHash)return r;
 const generated=path.join(vault,'Generated');fs.mkdirSync(generated,{recursive:true});
 for(const [name,original]of Object.entries(vaultFiles(r.w))){if(name==='brancha.json')continue;let content=original.replaceAll('[[','[[Generated/');if(name.endsWith('.canvas')){const canvas=JSON.parse(original);canvas.nodes.forEach(n=>{if(n.file)n.file='Generated/'+n.file;if(n.text)n.text=n.text.replaceAll('[[','[[Generated/')});content=JSON.stringify(canvas,null,2);}const dest=path.join(generated,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest+'.tmp',content);fs.renameSync(dest+'.tmp',dest);}
 fs.writeFileSync(path.join(generated,'START HERE.md'),'# Brancha live views\n\nGenerated from ../brancha.json while the local companion is running. These views are overwritten on each record update. Keep your own notes in ../Notes.\n\n[[Generated/Brancha.canvas|Open the whole map]]\n\n'+r.w.projects.map(p=>`- [[Generated/Projects/${p.id}|${p.title}]]`).join('\n'));
 fs.mkdirSync(path.join(vault,'Notes'),{recursive:true});lastHash=r.etag;lastError='';return r;
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
    const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,file);
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
function stop(){clearInterval(timer);server.close();}process.on('SIGINT',stop);process.on('SIGTERM',stop);
