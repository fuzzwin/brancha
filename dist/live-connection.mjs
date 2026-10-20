// Loopback credentials rotate when the companion restarts. Reconnect only to
// this origin and retry read-only requests once; never replay a write.
export function localConnection(initialToken,fetcher=fetch){
 let token=initialToken,renewal=null;
 async function renew(){
  if(!renewal)renewal=(async()=>{
   const response=await fetcher('/',{cache:'no-store',redirect:'error'});if(!response.ok)return false;
   const match=(await response.text()).match(/<meta\s+name="brancha-local-token"\s+content="([a-f0-9]{32,})"/);if(!match||match[1]===token)return false;
   token=match[1];return true;
  })().finally(()=>{renewal=null;});
  return renewal;
 }
 async function api(path,options={},canReconnect=true){
  const response=await fetcher(path,{cache:'no-store',...options,headers:{...options.headers,'x-brancha-token':token}});
  if(response.status===403&&canReconnect&&(options.method||'GET').toUpperCase()==='GET'&&await renew())return api(path,options,false);
  const data=await response.json();if(!response.ok){const error=Error(data.error||'Local connection unavailable');error.status=response.status;throw error;}return data;
 }
 return api;
}
