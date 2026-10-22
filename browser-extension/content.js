(()=>{
 let url=null,enabled=false,permissionEpoch=null,seen=new Set(),stable=new Map(),busy=false,error='';
 const api=message=>chrome.runtime.sendMessage(message).then(r=>{if(r?.error)throw Error(r.error);return r;});
 const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16);};
 function snapshot(){return BranchaCollector.collect(document,location.hostname==='chatgpt.com'?'chatgpt':'claude');}
 function baseline(){seen=new Set(snapshot().messages.filter(m=>m.role==='assistant').map(m=>m.id+':'+hash(m.text)));stable.clear();}
 async function tick(){if(busy)return;busy=true;try{
  const current=BranchaCollector.identity(location.href);
  if(current!==url){url=current;enabled=false;permissionEpoch=null;seen.clear();stable.clear();}
  if(url){const state=await api({op:'enabled'}),changed=state.enabled!==enabled||state.permissionEpoch!==permissionEpoch;enabled=!!state.enabled;permissionEpoch=state.permissionEpoch??null;if(changed){if(enabled)baseline();else{seen.clear();stable.clear();}}}
  if(!enabled||!url)return;
  const s=snapshot();if(s.generating)return;
  let request='';for(const m of s.messages){if(m.role==='user'){request=m.text;continue;}if(!request)continue;
   const key=m.id+':'+hash(m.text);if(seen.has(key))continue;
   const first=stable.get(key);if(!first){stable.set(key,Date.now());continue;}if(Date.now()-first<8000)continue;
   const result=await api({op:'capture',permissionEpoch,turnKey:m.id,request:request.slice(0,6000),summary:m.text.slice(0,12000)});
   if(result.reason==='before-consent'||result.reason==='not activated'){enabled=false;permissionEpoch=null;stable.clear();return;}
   if(result.captured||result.queued||['duplicate','excluded','paused'].includes(result.reason)){seen.add(key);stable.delete(key);}else error=result.reason||'Delivery has not been acknowledged';
  }
 }catch(e){error=e.message;}finally{busy=false;}}
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id)return;
  if(m.op==='activate'){url=BranchaCollector.identity(location.href);enabled=true;permissionEpoch=m.permissionEpoch??null;if(m.includeVisible){seen.clear();stable.clear();}else baseline();reply({enabled,error});tick();}
  if(m.op==='deactivate'){enabled=false;permissionEpoch=null;seen.clear();stable.clear();reply({enabled:false});}
  if(m.op==='health')reply({enabled,error,recognisedMessages:enabled?snapshot().messages.length:0});
 });
 setInterval(tick,3000);tick();
})();
