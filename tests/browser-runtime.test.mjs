import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const url='https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',source=name=>fs.readFileSync(new URL('../browser-extension/'+name,import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
test('content capture waits for stable completion, excludes the activation baseline, and stops on chat changes',async()=>{
 let poll,listener,now=100000,messages=[{role:'user',text:'Old request',id:'u0'},{role:'assistant',text:'Old reply',id:'a0'}],generating=false;let activated=false;const sent=[],location={href:url,hostname:'chatgpt.com'};
 const context={location,document:{},Date:{now:()=>now},setInterval:fn=>{poll=fn;},BranchaCollector:{identity:v=>v,collect:()=>({messages,generating})},chrome:{runtime:{id:'ext',sendMessage:async m=>{if(m.op==='capture'){sent.push(m);return {captured:true};}return {enabled:activated&&location.href===url,permissionEpoch:activated&&location.href===url?'fixture-epoch':null};},onMessage:{addListener:fn=>listener=fn}}}};
 vm.runInNewContext(source('content.js'),context);await settle();activated=true;listener({op:'activate',permissionEpoch:'fixture-epoch'},{id:'ext'},()=>{});await settle();await poll();assert.equal(sent.length,0);
 messages=[...messages,{role:'user',text:'New request',id:'u1'},{role:'assistant',text:'Partial response',id:'a1'}];generating=true;await poll();now+=10000;await poll();assert.equal(sent.length,0);generating=false;messages.at(-1).text='Completed response';await poll();now+=9000;await poll();assert.equal(sent.length,1);assert.equal(sent[0].summary,'Completed response');await poll();assert.equal(sent.length,1);
 location.href='https://chatgpt.com/c/22222222-2222-4222-8222-222222222222';messages=[{role:'user',text:'Private other chat',id:'u2'},{role:'assistant',text:'Private reply',id:'a2'}];await poll();now+=10000;await poll();assert.equal(sent.length,1);
});
test('background serialises offline receipts, validates the sender and drains the local outbox once',async()=>{
 const data={enabled:{[url]:{permissionEpoch:'fixture-epoch'}},outbox:[]};let handler,alarm,offline=true;const delivered=[];
 const chrome={storage:{local:{get:async key=>structuredClone(typeof key==='string'?{[key]:data[key]}:data),set:async patch=>{await Promise.resolve();Object.assign(data,structuredClone(patch));}}},alarms:{create:()=>{},onAlarm:{addListener:fn=>alarm=fn}},runtime:{id:'ext',getURL:name=>'chrome-extension://ext/'+name,sendNativeMessage:async(host,p)=>{if(offline)throw Error('Host offline');delivered.push(p);return {captured:true};},onMessage:{addListener:fn=>handler=fn}},tabs:{}};
 vm.runInNewContext(source('background.js'),{chrome,URL,Promise,Error,String});
 const sender={id:'ext',url,frameId:0,tab:{id:1}},call=(m,s=sender)=>new Promise(resolve=>handler(m,s,resolve));
 const responses=await Promise.all([call({op:'capture',permissionEpoch:'fixture-epoch',turnKey:'1',request:'First request',summary:'First response'}),call({op:'capture',permissionEpoch:'fixture-epoch',turnKey:'2',request:'Second request',summary:'Second response'})]);assert(responses.every(r=>r.queued));assert.equal(data.outbox.length,2);
 assert((await call({op:'capture',permissionEpoch:'fixture-epoch',turnKey:'evil',request:'No',summary:'No'},{...sender,url:'https://evil.example/c/11111111-1111-4111-8111-111111111111'})).error);assert.equal(data.outbox.length,2);
 offline=false;alarm({name:'brancha-flush'});await settle();assert.equal(delivered.length,2);assert.equal(data.outbox.length,0);
});

test('popup on restricted or unsupported pages reports guidance without activating a chat',async()=>{
 let handler,active={id:1};let calls=0;
 const chrome={alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},runtime:{id:'ext',getURL:name=>'chrome-extension://ext/'+name,sendNativeMessage:async()=>{calls++;return {projects:[{id:'p',title:'Example'}]};},onMessage:{addListener:fn=>handler=fn}},tabs:{query:async()=>[active]}};
 vm.runInNewContext(source('background.js'),{chrome,URL,Promise,Error,String});
 const call=op=>new Promise(resolve=>handler({op},{id:'ext',url:'chrome-extension://ext/popup.html'},resolve));
 assert.equal((await call('projects')).projects[0].title,'Example');
 for(const value of [undefined,'chrome://extensions/','https://chatgpt.com/']){active.url=value;assert.equal((await call('status')).supported,false);assert.match((await call('activate')).error,/Open an existing/);}
 assert.equal(calls,1);
});
