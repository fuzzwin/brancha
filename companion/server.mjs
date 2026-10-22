import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {atomic,controls,paths as capturePaths} from '../adapters/capture.mjs';
import {validate} from '../dist/core.mjs';
import {obsidianFiles} from './obsidian.mjs';
import {navigationFiles} from './navigation.mjs';
import {atomicText,containedPath} from '../skills/brancha/scripts/storage.mjs';
import {acquireLock} from '../skills/brancha/scripts/locking.mjs';
import {loadConfig} from '../scripts/config.mjs';
import {chatTitles} from '../adapters/chat-titles.mjs';
import {privacyView,chatPermissions,mergePrivateRecords,chatPrivacySummary,workspaceEtag} from '../adapters/chat-privacy.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function startServer(options={}){
const vault=path.resolve(options.vault||path.join(base,'vault'));
const file=path.join(vault,'brancha.json'),port=Number(options.port||51207);
fs.mkdirSync(vault,{recursive:true});
if(!fs.existsSync(file))fs.copyFileSync(path.join(base,'dist/starter-workspace.json'),file,fs.constants.COPYFILE_EXCL);
const captureConfig=options.config||null;
const listen=options.listen??(captureConfig?.view!=='obsidian');
function captureStatus(){if(!captureConfig)return null;let latest={};try{latest=JSON.parse(fs.readFileSync(capturePaths(captureConfig).status,'utf8'));}catch{}return {...latest,paused:controls(captureConfig).paused===true};}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let lastHash='',lastDay='',lastError='',lastNavigation='',viewNames=new Set(),navigationNames=new Set();
const identity={name:path.basename(vault),vault,localUrl:listen?'http://127.0.0.1:'+port:null,obsidianHome:'obsidian://open?path='+encodeURIComponent(path.join(vault,'Generated/Navigation/Home.md').split(path.sep).join('/'))};
function read(locked=false){const release=locked?null:acquireLock(file+'.lock');try{const raw=fs.readFileSync(file,'utf8');if(raw.length>8*1024*1024)throw Error('Workspace too large');const canonical=validate(JSON.parse(raw)),w=captureConfig?privacyView(captureConfig,canonical):canonical;const etag=workspaceEtag(captureConfig,raw);return {raw,canonical,w,etag,viewKey:etag};}finally{release?.();}}
function refreshNavigation(r){
 const guide=fs.existsSync(path.join(vault,'Notes','Brancha guide.md')),names=fs.existsSync(path.join(vault,'Notes','Brancha name ideas.md'));
 const hasIndex=fs.existsSync(path.join(vault,'Notes','Project index.md'));
 const observed={...captureStatus(),...(captureConfig?{chatPrivacy:chatPrivacySummary(captureConfig,r.canonical)}:{})};
 const key=[r.viewKey,Math.floor(Date.now()/60000),guide,names,hasIndex,observed?.reviewerState,observed?.reviewerLastAt,observed?.reviewerError,observed?.paused].join(':');if(key===lastNavigation)return;
 const pages=navigationFiles(r.w,{port,capture:observed,hasGuide:guide,hasNames:names,hasIndex,chatTitles:chatTitles(captureConfig||{},r.w),workspace:identity});
 navigationNames=new Set(Object.keys(pages));
 const recapManifest=path.join(vault,'.brancha/generated-recaps.json');let oldRecaps=[];
 try{oldRecaps=JSON.parse(fs.readFileSync(recapManifest,'utf8')).files||[];}catch{}
 const recaps=Object.keys(pages).filter(name=>/^Recaps\/(?:index|\d{4}-\d{2}-\d{2})\.md$/.test(name));
 for(const name of oldRecaps)if(/^Recaps\/(?:index|\d{4}-\d{2}-\d{2})\.md$/.test(name)&&!recaps.includes(name)){try{fs.unlinkSync(containedPath(path.join(vault,'Generated'),name));}catch(e){if(e.code!=='ENOENT')throw e;}}
 atomic(recapManifest,{version:1,files:recaps});
 for(const [name,content] of Object.entries(pages)){
  const target=containedPath(path.join(vault,'Generated'),name);
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)atomicText(target,content);
 }
 lastNavigation=key;
}
function refresh(){const r=read(),day=new Date().toLocaleDateString('en-CA');if(r.viewKey===lastHash&&day===lastDay){refreshNavigation(r);return r;}
 const generated=path.join(vault,'Generated');fs.mkdirSync(generated,{recursive:true});
 const views=obsidianFiles(r.w,{chatTitles:chatTitles(captureConfig||{},r.w)}),assetPattern=/^Diagrams\/[a-zA-Z0-9_-]+-(?:mindmap|dashboard|flow|chat-[a-f0-9]{12})-[a-f0-9]{16}\.svg$/,assets=Object.keys(views).filter(name=>assetPattern.test(name));
 viewNames=new Set(Object.keys(views));
 const assetManifest=path.join(vault,'.brancha','generated-assets.json');let priorAssets=[];
 const pageManifest=path.join(vault,'.brancha','generated-pages.json');let oldPages=[];
 try{oldPages=JSON.parse(fs.readFileSync(pageManifest,'utf8')).files||[];}catch{
  // Migration: only paths that this version can derive from the canonical
  // record are managed. User-authored Notes and unrelated files are untouched.
  if(captureConfig)oldPages=Object.keys(obsidianFiles(r.canonical));
 }
 try{const previous=JSON.parse(fs.readFileSync(assetManifest,'utf8'));if(previous.version===1&&Array.isArray(previous.files))priorAssets=previous.files.filter(name=>typeof name==='string'&&assetPattern.test(name));}catch{}
 for(const [name,original]of Object.entries(views).sort(([a],[b])=>Number(!a.endsWith('.svg'))-Number(!b.endsWith('.svg')))){if(name==='brancha.json')continue;let content=name.endsWith('.md')?original.replaceAll('[[','[[Generated/'):original;if(name.endsWith('.canvas')){const canvas=JSON.parse(original);canvas.nodes.forEach(n=>{if(n.file)n.file='Generated/'+n.file;if(n.text)n.text=n.text.replaceAll('[[','[[Generated/')});content=JSON.stringify(canvas,null,2);}const target=containedPath(generated,name);if(name.endsWith('.md')&&content.includes('```brancha-')&&fs.existsSync(target)&&fs.readFileSync(target,'utf8')===content)continue;atomicText(target,content);}
 atomicText(containedPath(generated,'START HERE.md'),'---\ncssclasses: [brancha-page, brancha-dashboard]\n---\n# Pick up the thread\n\n[[Generated/Navigation/Home|Open Branchi Home →]]\n\n[[Generated/Navigation/Today|Today and yesterday]] · [[Generated/Dashboards/index|All projects]] · [[Generated/Navigation/Review|Needs a look]] · [[Generated/Navigation/Connections|Connections and freshness]] · [[Generated/Navigation/How to use|How to use]]\n\nHome brings together the goal, next action, dashboards, maps and resume briefs. These pages update while the companion runs. Keep personal writing in Notes; generated pages are refreshed.');
 const retained=[];for(const name of priorAssets)if(!assets.includes(name)){try{fs.unlinkSync(containedPath(generated,name));}catch(e){if(e.code!=='ENOENT')retained.push(name);}}
 atomic(assetManifest,{version:1,files:[...new Set([...assets,...retained])]});
 const names=Object.keys(views).filter(n=>n!=='brancha.json'),retainedPages=[];
 for(const name of oldPages)if(typeof name==='string'&&!name.includes('..')&&!path.isAbsolute(name)&&name!=='brancha.json'&&!names.includes(name)){try{fs.unlinkSync(containedPath(generated,name));}catch(e){if(e.code!=='ENOENT')retainedPages.push(name);}}
 atomic(pageManifest,{version:1,files:[...new Set([...names,...retainedPages])]});
 fs.mkdirSync(path.join(vault,'Notes'),{recursive:true});refreshNavigation(r);lastHash=r.viewKey;lastDay=day;lastError='';return r;
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
  if(url.pathname==='/api/view'||url.pathname==='/api/identity'||url.pathname==='/api/review-request'){
   if(req.headers['x-brancha-token']!==token)return send(403,{error:'Open the local companion to connect'});
   const r=refresh();
   if(url.pathname==='/api/identity')return req.method==='GET'?send(200,{...identity,revision:r.w.revision,capture:captureStatus()}):send(405,{error:'Method not allowed'});
   if(url.pathname==='/api/review-request'){
    if(req.method!=='POST')return send(405,{error:'Method not allowed'});
    const state=captureStatus();if(!captureConfig||!state?.reviewerEnabled||state.paused)return send(409,{error:'Review is unavailable or paused'});
    atomic(path.join(vault,'.brancha/reviewer/request.json'),{id:crypto.randomUUID(),requestedAt:new Date().toISOString()});return send(200,{requested:true});
   }
   if(req.method!=='GET')return send(405,{error:'Method not allowed'});
   const selected=url.searchParams.get('path')||'',name=selected.startsWith('Generated/')?selected.slice(10):'';
   if(!name||!viewNames.has(name)&&!navigationNames.has(name)&&name!=='START HERE.md')return send(404,{error:'This generated view is not available'});
   const root=path.join(vault,'Generated'),dest=path.resolve(root,name);if(!dest.startsWith(root+path.sep)||!fs.realpathSync(dest).startsWith(fs.realpathSync(root)+path.sep))return send(403,{error:'Invalid view path'});
   return send(200,{path:selected,content:fs.readFileSync(dest,'utf8'),revision:r.w.revision});
  }
  if(url.pathname==='/api/workspace'){
   if(req.headers['x-brancha-token']!==token)return send(403,{error:'Open the local companion to connect'});
   if(req.method==='GET'){const r=refresh();return send(200,{workspace:r.w,etag:r.etag,vault,viewError:lastError,capture:captureStatus()});}
   if(req.method!=='PUT')return send(405,{error:'Method not allowed'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8*1024*1024)return send(413,{error:'Workspace too large'});}
   const next=validate(JSON.parse(body));let release;
   try{release=acquireLock(file+'.lock');}catch(e){if(e.code==='EEXIST')return send(409,{error:'Workspace is being updated. Try again after the other update finishes.'});throw e;}
   try{const current=read(true);if(req.headers['if-match']!==current.etag)return send(409,{error:'New changes arrived. Close the form, refresh and apply your change again.'});
    for(const p of current.w.projects){const found=next.projects.find(x=>x.id===p.id);if(!found||found.prompt!==p.prompt)throw Error('Live updates must preserve projects and original prompts. Use a separate workspace for replacement imports.');}
    if(next.revision<=current.w.revision)throw Error('Revision must advance');
    const backups=path.join(vault,'.brancha-backups');fs.mkdirSync(backups,{recursive:true});fs.writeFileSync(path.join(backups,Date.now()+'-'+crypto.randomUUID()+'.json'),current.raw,{flag:'wx'});
    atomic(file,validate(mergePrivateRecords(current.canonical,current.w,next)));
   }finally{release();}
   let r;try{r=refresh();}catch(e){lastError=e.message;r=read();}
   return send(200,{workspace:r.w,etag:r.etag,vault,viewError:lastError,capture:captureStatus()});
  }
  if(req.method!=='GET')return send(405,{error:'Method not allowed'});
  const shared={'/shared/renderer.js':'assets/obsidian/brancha-interactive/main.js','/shared/renderer.css':'assets/obsidian/brancha-interactive/styles.css'};
  if(shared[url.pathname]){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'text/javascript'});return res.end(fs.readFileSync(path.join(base,shared[url.pathname])));}
  const relative=url.pathname==='/'?'live.html':url.pathname==='/editor'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const dest=path.resolve(base,'dist',relative);if(!dest.startsWith(path.join(base,'dist')+path.sep))return send(403,{error:'Invalid path'});
  let data=fs.readFileSync(dest);if(['index.html','live.html'].includes(relative))data=Buffer.from(data.toString().replace('<head>',`<head><meta name="brancha-local-token" content="${token}">`).replace('<body>',relative==='index.html'?'<body><div style="padding:12px 24px;background:#e9eee4;color:#263a31">Record editor · same live workspace · <a href="/">Return to Branchi Home →</a></div>':'<body>'));
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(dest)]||'text/plain'});res.end(data);
 }catch(e){send(e.code==='ENOENT'?404:400,{error:e.message});}
});
const timer=setInterval(()=>{try{refresh();}catch(e){lastError=e.message;}},1000);
server.on('error',e=>{clearInterval(timer);console.error(e.message);process.exitCode=1;});
if(listen)server.listen(port,'127.0.0.1',()=>console.log(`Branchi live: ${origin}\nVault: ${vault}\nKeep this process running. Ctrl+C stops live updates.`));
else console.log('Branchi Obsidian: saved pages are refreshing. Localhost is disabled.');
function stop(){clearInterval(timer);if(server.listening)server.close();}
return {server,stop};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const instance=startServer({vault:process.argv[2],port:process.argv[3],config:process.env.BRANCHA_CONFIG?loadConfig().config:null});
 process.on('SIGINT',instance.stop);process.on('SIGTERM',instance.stop);
}
