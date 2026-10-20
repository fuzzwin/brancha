import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {startServer} from '../companion/server.mjs';import {demo} from '../dist/core.mjs';import {capture,atomic,paths,status} from '../adapters/capture.mjs';import {setChatPermission} from '../adapters/chat-privacy.mjs';
test('live browser shares Obsidian views, preserves record editing and protects the generated-view boundary',async()=>{
 const vault=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-live-view-')),w=demo(),project=w.projects[0].id,config={vault,capturePolicy:{approvedSessionIds:['local-chat']},sessionProjects:{'local-chat':project},directoryProjects:[]};w.demo=false;atomic(paths(config).file,w);capture(config,{sessionId:'local-chat',turnId:'one',message:'A source-linked result for the live workspace parity check.'});
 const instance=startServer({vault,port:51335,config});await new Promise(resolve=>instance.server.listening?resolve():instance.server.once('listening',resolve));
 try{
  const base='http://127.0.0.1:51335',html=await(await fetch(base)).text();assert(html.includes('live.mjs'));assert(html.includes('Open main Obsidian'));const token=html.match(/brancha-local-token" content="([a-f0-9]+)"/)[1],headers={'x-brancha-token':token};
  assert.equal((await fetch(base+'/api/identity')).status,403);assert.equal((await fetch(base+'/api/identity',{headers:{...headers,Origin:'https://example.com'}})).status,403);
  const identity=await(await fetch(base+'/api/identity',{headers})).json();assert.equal(identity.vault,vault);assert.equal(identity.name,path.basename(vault));assert(identity.obsidianHome.includes('Generated%2FNavigation%2FHome.md'));
  const view=async file=>fetch(base+'/api/view?path='+encodeURIComponent(file),{headers});
  for(const file of ['Generated/Interactive/home.json','Generated/Interactive/'+project+'.json','Generated/Interactive/chat-'+project+'-local-chat.json','Generated/Recaps/index.md','Generated/Branches/'+project+'.md']){
   const response=await view(file);assert.equal(response.status,200,file);const data=await response.json();assert.equal(data.content,fs.readFileSync(path.join(vault,file),'utf8'));
  }
  const home=JSON.parse((await(await view('Generated/Interactive/home.json')).json()).content);assert.equal(home.workspace.vault,vault);assert.equal(home.revision,identity.revision);
  for(const file of ['Notes/private.md','Generated/private.md','Generated/../brancha.json','.obsidian/workspace.json']){const target=path.join(vault,file);if(file.endsWith('private.md')){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'Private fixture must not be exposed');}assert.equal((await view(file)).status,404,file);}
  const shared=await(await fetch(base+'/shared/renderer.js')).text();assert.equal(shared,fs.readFileSync(new URL('../assets/obsidian/brancha-interactive/main.js',import.meta.url),'utf8'));assert((await(await fetch(base+'/editor')).text()).includes('app.mjs'));
  assert.equal((await fetch(base+'/api/review-request',{method:'POST',headers})).status,409);status(config,{reviewerEnabled:true});assert.equal((await fetch(base+'/api/review-request',{method:'POST',headers})).status,200);assert(fs.existsSync(path.join(vault,'.brancha/reviewer/request.json')));
  setChatPermission(config,'local-chat','exclude');assert.equal((await view('Generated/Interactive/chat-'+project+'-local-chat.json')).status,404);assert.equal((await view('Generated/Chats/'+project+'-local-chat-index.md')).status,404);
 }finally{await new Promise(resolve=>{instance.stop();instance.server.closeAllConnections();instance.server.once('close',resolve);});}
});
