import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=name=>fs.readFileSync(new URL('../browser-extension/'+name,import.meta.url),'utf8');
test('two tabs preserve content consent generations and a suspended tab rebaselines after renewal',async()=>{
 const url='https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',store={enabled:{[url]:{permissionEpoch:'old'}}},native=[],tabs=new Map();let listener,epoch='old',time=10000;
 const bg={URL,Promise,chrome:{runtime:{id:'fixture',getURL:p=>'extension://'+p,sendNativeMessage:async(_,packet)=>{if(packet.op==='capture'){native.push(packet);return {captured:true};}if(packet.op==='activate')return {permissionEpoch:epoch='new'};return {};},onMessage:{addListener:f=>listener=f}},storage:{local:{get:async k=>({[k]:store[k]}),set:async o=>Object.assign(store,o)}},alarms:{create(){},onAlarm:{addListener(){}}},tabs:{query:async q=>q.active?[{id:1,url}]:[...tabs.keys()].map(id=>({id,url})),sendMessage:async(id,m)=>{const tab=tabs.get(id);if(tab.suspended)throw Error('Suspended fictional tab');tab.onMessage(m,{id:'fixture'},()=>{});}}}};
 vm.runInNewContext(source('background.js'),bg);const send=(message,sender)=>new Promise(resolve=>listener(message,sender,resolve));
 const drain=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
 function content(id){const tab={suspended:false,messages:[{id:'u',role:'user',text:'Please check the fictional tray.'},{id:'a',role:'assistant',text:'Initial visible fictional report.'}]};tabs.set(id,tab);const context={Date:{now:()=>time},Set,Map,location:{href:url,hostname:'chatgpt.com'},document:{},BranchaCollector:{identity:()=>url,collect:()=>({messages:tab.messages,generating:false})},setInterval:f=>tab.tick=f,chrome:{runtime:{id:'fixture',sendMessage:m=>send(m,{id:'fixture',tab:{id},frameId:0,url}),onMessage:{addListener:f=>tab.onMessage=f}}}};vm.runInNewContext(source('content.js'),context);return tab;}
 content(1);const b=content(2);await drain();b.suspended=true;
 const popup={id:'fixture',url:'extension://popup.html'};await send({op:'deactivate'},popup);
 b.messages.push({id:'excluded',role:'assistant',text:'Fictional response generated while capture was excluded.'});
 // A rejected off-period packet must never be upgraded by the background worker.
 assert.equal((await send({op:'capture',permissionEpoch:'old',turnKey:'excluded',request:'Fictional request',summary:'Excluded period text'},{id:'fixture',tab:{id:2},frameId:0,url})).reason,'not activated');
 await send({op:'activate',projectId:'fictional'},popup);
 const stale=await send({op:'capture',permissionEpoch:'old',turnKey:'excluded',request:'Fictional request',summary:'Excluded period text'},{id:'fixture',tab:{id:2},frameId:0,url});assert.equal(stale.reason,'before-consent');assert.equal(native.length,0);
 b.suspended=false;b.tick();await drain();time+=9000;b.tick();await drain();assert.equal(native.length,0);
 b.messages.push({id:'future',role:'assistant',text:'Future fictional response after renewed activation.'});b.tick();await drain();time+=9000;b.tick();await drain();assert.equal(native.length,1);assert.equal(native[0].turnKey,'future');assert.equal(native[0].permissionEpoch,'new');
});
