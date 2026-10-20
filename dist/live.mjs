const root=document.querySelector('#view'),token=document.querySelector('meta[name="brancha-local-token"]').content,subscribers=new Set(),cache=new Map();
let current=null,currentPage='',identity=null,sequence=0,backCount=0,polling=false;
const api=async(path,options={})=>{const response=await fetch(path,{cache:'no-store',...options,headers:{'x-brancha-token':token,...options.headers}});const data=await response.json();if(!response.ok){const error=Error(data.error||'Local connection unavailable');error.status=response.status;throw error;}return data;};
const read=async(path)=>{const data=await api('/api/view?path='+encodeURIComponent(path));cache.set(path,data.content);return data.content;};
class Child{constructor(el){this.containerEl=el;this.events=[];}registerEvent(off){this.events.push(off);}unload(){this.onunload?.();for(const off of this.events)off?.();}}
class Notice{constructor(text){const el=document.querySelector('#notice');el.textContent=text;el.hidden=false;clearTimeout(Notice.timer);Notice.timer=setTimeout(()=>el.hidden=true,6000);}}
globalThis.BranchaHost={Plugin:class{},MarkdownRenderChild:Child,Notice};
await import('/shared/renderer.js');
const {Dashboard,Home,Chat,MapExplorer,safeSvg}=globalThis.BranchaRenderers;
const obsidianLink=page=>'obsidian://open?path='+encodeURIComponent(identity.vault+'/'+(/\.(?:md|svg|canvas|json)$/i.test(page)?page:page+'.md'));
const navigate=page=>{page=page.replace(/\.md$/,'');if(page!==currentPage){backCount++;history.pushState({branchaDepth:backCount},'', '#'+encodeURIComponent(page));render();}};
const plugin={app:{vault:{adapter:{read,exists:async()=>true,mkdir:async()=>{},write:async(path)=>{if(path!=='.brancha/reviewer/request.json')throw Error('Only the review request control is available');return api('/api/review-request',{method:'POST'});}},on:(_name,callback)=>{subscribers.add(callback);return()=>subscribers.delete(callback);}},workspace:{openLinkText:async page=>navigate(page),get activeLeaf(){return {history:{backHistory:backCount?[true]:[],back:()=>history.back()},getViewState:()=>({type:'browser'})};},getActiveFile:()=>null}}};
for(const link of document.querySelectorAll('[data-page]')){link.href='#'+encodeURIComponent(link.dataset.page);}
let dark=localStorage.getItem('brancha-live-theme')==='dark';const theme=()=>{document.body.classList.toggle('theme-dark',dark);localStorage.setItem('brancha-live-theme',dark?'dark':'light');};theme();document.querySelector('#theme').onclick=()=>{dark=!dark;theme();};
function el(parent,tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;}
function formatted(parent,text){const pattern=/\*\*([^*]+)\*\*|`([^`]+)`/g;let last=0;for(const match of text.matchAll(pattern)){parent.append(document.createTextNode(text.slice(last,match.index)));el(parent,match[1]?'strong':'code',match[1]||match[2]);last=match.index+match[0].length;}parent.append(document.createTextNode(text.slice(last)));}
function inline(parent,text){
 const pattern=/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\((?:<([^>]+)>|([^\s)]+))\)/g;let last=0;
 for(const match of text.matchAll(pattern)){
  formatted(parent,text.slice(last,match.index));const link=el(parent,'a',match[2]||match[3]||match[1]);
  if(match[1]){let page=match[1].replaceAll('\\','').split('#')[0];if(!page.startsWith('Generated/')&&!page.startsWith('Notes/'))page='Generated/'+page;link.href='#'+encodeURIComponent(page.replace(/\.md$/,''));}
  else{const target=match[4]||match[5];if(/^(https?:|obsidian:|codex:|file:)/i.test(target)){link.href=target;if(/^https?:/i.test(target)){link.target='_blank';link.rel='noopener noreferrer';}}}
  last=match.index+match[0].length;
 }formatted(parent,text.slice(last));
}
async function markdown(text,page){
 root.className='note';text=text.replace(/^---\n[\s\S]*?\n---\n/,'');const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(line.startsWith('```')){const collected=[];while(++i<lines.length&&!lines[i].startsWith('```'))collected.push(lines[i]);el(root,'pre',collected.join('\n'));continue;}
  if(/^\|/.test(line)&&/^\|[\s:|-]+\|$/.test(lines[i+1]||'')){const table=el(root,'table'),cells=value=>value.split(/(?<!\\)\|/).slice(1,-1).map(s=>s.trim().replaceAll('\\|','|'));const head=el(table,'tr');for(const cell of cells(line))inline(el(head,'th'),cell);i++;while(/^\|/.test(lines[i+1]||'')){const tr=el(table,'tr');for(const cell of cells(lines[++i]))inline(el(tr,'td'),cell);}continue;}
  const heading=line.match(/^(#{1,6})\s+(.*)/);if(heading){inline(el(root,'h'+heading[1].length),heading[2]);continue;}
  if(line.startsWith('>')){inline(el(root,'blockquote'),line.replace(/^>\s?/,'').replace(/^\[![^\]]+\][-+]?\s*/,''));continue;}
  if(/^[-*] /.test(line)){inline(el(root,'p'),'• '+line.slice(2));continue;}
  inline(el(root,'p'),line);
 }
}
async function render(){
 const mine=++sequence;current?.unload();current=null;subscribers.clear();root.className='';root.replaceChildren();el(root,'p','Opening your saved work…');
 let page;try{page=decodeURIComponent(location.hash.slice(1)||'Generated/Navigation/Home');}catch{page='Generated/Navigation/Home';}
 currentPage=page;for(const link of document.querySelectorAll('[data-page]'))link.setAttribute('aria-current',link.dataset.page===page?'page':'false');
 try{
  identity=await api('/api/identity');if(mine!==sequence)return;
  document.querySelector('#workspace-identity').textContent=identity.name+' · revision '+identity.revision+' · same record as Obsidian';
  const open=document.querySelector('#open-obsidian');open.href=obsidianLink(page);open.textContent='Open in main Obsidian ↗';
  if(!page.startsWith('Generated/')){root.replaceChildren();el(root,'h1','Your personal Obsidian note');el(root,'p','Personal notes stay in Obsidian. This live browser shares Brancha’s generated project and chat views.');const a=el(root,'a','Open this note in Obsidian ↗');a.className='obsidian-note';a.href=obsidianLink(page);return;}
  if(page.endsWith('.svg')){const raw=await read(page);if(mine!==sequence)return;root.replaceChildren();root.className='note';root.append(safeSvg(raw,document));return;}
  const text=await read(page.endsWith('.md')?page:page+'.md');if(mine!==sequence)return;root.replaceChildren();
  const block=text.match(/```(brancha-home|brancha-chats|brancha-chat|brancha-interactive|brancha-timeline|brancha-map)\n([^`]*?)```/);
  if(block){const [id,session]=block[2].trim().split(/\r?\n/);const kind=block[1];
   if(kind==='brancha-home'||kind==='brancha-chats')current=new Home(root,plugin,page,{chatsOnly:kind==='brancha-chats'});
   else if(kind==='brancha-map')current=new MapExplorer(root,plugin,id,page,session);
   else if(kind==='brancha-chat')current=new Chat(root,plugin,id,session,page);
   else current=new Dashboard(root,plugin,id,page,{timelineOnly:kind==='brancha-timeline',sessionId:session});
   current.onload();
  }else await markdown(text,page);
  document.querySelector('#connection').textContent='Connected locally · same generated views as Obsidian · refreshed '+new Date().toLocaleTimeString();
 }catch(error){if(mine!==sequence)return;root.replaceChildren();el(root,'h1','This view is unavailable');el(root,'p',error.message);const home=el(root,'a','Return to Brancha Home');home.href='#Generated%2FNavigation%2FHome';document.querySelector('#connection').textContent='Check the Brancha companion connection.';}
}
document.addEventListener('click',event=>{const link=event.target.closest('a');if(!link?.getAttribute('href')?.startsWith('#'))return;event.preventDefault();try{navigate(decodeURIComponent(link.getAttribute('href').slice(1)||'Generated/Navigation/Home'));}catch{navigate('Generated/Navigation/Home');}});
window.addEventListener('popstate',()=>{backCount=history.state?.branchaDepth||0;render();});window.addEventListener('hashchange',()=>{backCount=history.state?.branchaDepth||0;render();});await render();
setInterval(async()=>{if(polling||document.hidden)return;polling=true;try{
 const page=current?.path|| (currentPage.startsWith('Generated/')?currentPage.replace(/\.md$/,'')+'.md':null);if(!page)return;
 const before=cache.get(page),raw=await read(page);if(raw!==before){if(current){for(const callback of subscribers)callback({path:page});}else await render();}
 const status=await api('/api/identity');document.querySelector('#workspace-identity').textContent=status.name+' · revision '+status.revision+' · same record as Obsidian';document.querySelector('#connection').textContent='Connected locally · '+(status.capture?.paused?'capture paused':'updates while the companion runs')+' · checked '+new Date().toLocaleTimeString();
 }catch(error){if(error.status===404)await render();if(error.status===403){current?.unload();current=null;root.replaceChildren();el(root,'p','The local connection changed. Reload to reconnect.');const reload=el(root,'button','Reload workspace');reload.onclick=()=>location.reload();}document.querySelector('#connection').textContent='Local connection interrupted. Your saved Obsidian notes remain available.';}finally{polling=false;}},3000);
