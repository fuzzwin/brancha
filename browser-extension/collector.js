// DOM-only adapter. No cookies, private APIs, hidden thoughts, fetch or account tokens.
(()=>{
 function identity(url){const u=new URL(url),m=u.pathname.match(/^\/(c|chat)\/([a-f0-9-]{36})\/?$/i);return u.protocol==='https:'&&m&&((u.hostname==='chatgpt.com'&&m[1]==='c')||(u.hostname==='claude.ai'&&m[1]==='chat'))?u.origin+u.pathname.replace(/\/$/,''):null;}
 function collect(doc,provider){
  const selector=provider==='chatgpt'?'main [data-message-author-role]':'main [data-testid="user-message"], main [data-testid="assistant-message"], main .font-claude-response';
  const nodes=[...doc.querySelectorAll(selector)].filter((n,_,all)=>!all.some(other=>other!==n&&other.contains(n))),messages=[];
  for(const [index,node]of nodes.entries()){
   const role=provider==='chatgpt'?node.getAttribute('data-message-author-role'):node.getAttribute('data-testid')==='user-message'?'user':'assistant';if(!['user','assistant'].includes(role))continue;
   const content=(node.querySelector('.markdown')||node).cloneNode(true);content.querySelectorAll('button,textarea,script,style,[hidden],[aria-hidden="true"],[data-testid*="thinking"],[data-testid*="reasoning"]').forEach(n=>n.remove());
   const text=(content.innerText||content.textContent||'').trim();if(!text)continue;
   messages.push({role,text,id:node.getAttribute('data-message-id')||node.closest('[data-message-id]')?.getAttribute('data-message-id')||node.id||'visible-'+index});
  }
  return {messages,generating:!!doc.querySelector('[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Stop response"],[data-is-streaming="true"]')};
 }
 globalThis.BranchaCollector={identity,collect};
})();
