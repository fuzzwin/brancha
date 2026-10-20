const HOST='com.brancha.capture';
const native=packet=>chrome.runtime.sendNativeMessage(HOST,packet).then(r=>{if(r?.error)throw Error(r.error);return r;});
function conversation(value){const u=new URL(value),m=u.pathname.match(/^\/(?:c|chat)\/([a-f0-9-]{36})\/?$/i);if(u.protocol!=='https:'||!m||!['chatgpt.com','claude.ai'].includes(u.hostname))throw Error('Open an existing ChatGPT or Claude chat first.');return u.origin+u.pathname.replace(/\/$/,'');}
let sequence=Promise.resolve();const serial=fn=>{const pending=sequence.then(fn);sequence=pending.catch(()=>{});return pending;};
let flushing=false;
async function flush(){if(flushing)return;flushing=true;try{const {outbox=[]}=await chrome.storage.local.get('outbox'),remaining=[];for(const packet of outbox){try{const r=await native(packet);if(r.retry)remaining.push(packet);}catch{remaining.push(packet);}}await chrome.storage.local.set({outbox:remaining});}finally{flushing=false;}}
chrome.alarms.create('brancha-flush',{periodInMinutes:1});chrome.alarms.onAlarm.addListener(a=>{if(a.name==='brancha-flush')serial(flush);});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 serial(async()=>{
  if(sender.id!==chrome.runtime.id)throw Error('Unexpected sender');
  if(sender.tab){
   if(sender.frameId!==0)throw Error('Only the main chat frame is supported');const url=conversation(sender.url);
   const {enabled={}}=await chrome.storage.local.get('enabled');
   if(message.op==='enabled')return {enabled:!!enabled[url]};
   if(message.op!=='capture'||!enabled[url])return {captured:false,reason:'not activated'};
   const packet={op:'capture',url,turnKey:String(message.turnKey||'').slice(0,300),request:String(message.request||'').slice(0,6000),summary:String(message.summary||'').slice(0,12000)};
   try{const result=await native(packet);if(!result.retry)return result;}catch{}
   // Persistent local-only outbox, serialised by the service worker message queue.
   const {outbox=[]}=await chrome.storage.local.get('outbox');if(outbox.length>=100)throw Error('Local delivery queue is full; open Brancha before continuing capture.');
   if(!outbox.some(p=>p.url===packet.url&&p.turnKey===packet.turnKey&&p.summary===packet.summary))outbox.push(packet);
   await chrome.storage.local.set({outbox});return {queued:true};
  }
  if(sender.url!==chrome.runtime.getURL('popup.html'))throw Error('Open the extension popup to change capture');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(message.op==='projects')return native({op:'projects'});
  if(message.op==='flush'){await flush();return {flushed:true};}
  let url;try{url=conversation(tab?.url);}catch{if(message.op==='status')return {supported:false};throw Error('Open an existing ChatGPT or Claude chat first.');}
  const result=await native({op:message.op,url,...(message.op==='activate'?{projectId:message.projectId}:{})});
  if(['activate','deactivate'].includes(message.op)){
   const {enabled={}}=await chrome.storage.local.get('enabled');enabled[url]=message.op==='activate';await chrome.storage.local.set({enabled});
   if(message.op==='deactivate'){const {outbox=[]}=await chrome.storage.local.get('outbox');await chrome.storage.local.set({outbox:outbox.filter(p=>p.url!==url)});}
   await chrome.tabs.sendMessage(tab.id,{op:message.op,includeVisible:!!message.includeVisible});
  }
  const {outbox=[]}=await chrome.storage.local.get('outbox');return {...result,queued:outbox.length};
 }).then(reply).catch(e=>reply({error:e.message}));return true;
});
