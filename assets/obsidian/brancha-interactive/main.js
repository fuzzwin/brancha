const {Plugin,MarkdownRenderChild,Notice}=globalThis.BranchaHost||require('obsidian');
// Work in CSS pixels; never magnify a small diagram just to fill a wide note.
// Very narrow or dense maps keep an 11px label floor and can scroll.
function mapSize({width,height,availableWidth,availableHeight,zoom=1,readable=false,fullWidth=false,fullPage=false,fitAll=false}){
 if(![width,height,availableWidth,availableHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 const frame=fullPage?Math.max(240,Math.floor(availableHeight)):fullWidth?Math.floor(Math.min(560,Math.max(300,availableHeight*.62))):Math.min(430,Math.max(260,availableHeight*.5));
 const fit=Math.min(1,availableWidth/width,frame/height);
 const scale=(readable?1:fullPage&&fitAll?fit:Math.max(fullPage?11/15:11/18,fit))*Math.max(.25,Math.min(3,zoom));
 return {width:Math.round(width*scale),height:Math.round(height*scale),frame,scale};
}
function savedStamp(value){
 if(!value||!Number.isFinite(Date.parse(value)))return 'No saved update yet';
 return 'Last saved '+new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
const valid=id=>/^[a-zA-Z0-9_-]+$/.test(id);
// Generated SVG is still data. Only drawing elements and safe presentation
// attributes are allowed; no scripts, foreignObject, links or external resources.
function safeSvg(text,doc){
 const parsed=new DOMParser().parseFromString(text,'image/svg+xml');
 if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw Error('Invalid diagram');
 const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','defs','marker']);
 const attrs=new Set(['xmlns','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','transform','class','id','data-id','data-status','fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','font-size','font-family','font-weight','text-anchor','dominant-baseline','dy','dx','marker-end','marker-start','markerWidth','markerHeight','refX','refY','orient','markerUnits','preserveAspectRatio','role','aria-label','aria-labelledby']);
 for(const el of [...parsed.querySelectorAll('*')]){
  if(!tags.has(el.localName)){el.remove();continue;}
  if(el.localName==='style'&&/url\s*\(|@import|expression\s*\(/i.test(el.textContent)){el.remove();continue;}
  for(const a of [...el.attributes])if(!attrs.has(a.name)||(/url\s*\(/i.test(a.value)&&!/^url\(#[\w-]+\)$/.test(a.value)))el.removeAttribute(a.name);
 }
 return doc.importNode(parsed.documentElement,true);
}
class Dashboard extends MarkdownRenderChild{
 constructor(el,plugin,id,sourcePath,options={}){super(el);this.plugin=plugin;this.id=id;this.sourcePath=sourcePath;this.focus=null;this.history=[];this.mapPreview=true;this.zoom=1;this.readable=false;this.timelineOnly=!!options.timelineOnly;this.timelineChat=options.sessionId||'all';this.timelineLocked=!!options.sessionId;this.timelineDays='all';this.timelineKind='all';this.timelineVisible=20;}
 onload(){
  this.containerEl.classList.add('bi');
  this.registerEvent(this.plugin.app.vault.on('modify',file=>{if(file.path===this.path){clearTimeout(this.timer);this.timer=setTimeout(()=>this.refresh(),250);}}));
  this.refresh();
 }
 onunload(){clearTimeout(this.timer);this.mapObserver?.disconnect();this.dead=true;}
 get path(){return `Generated/Interactive/${this.id}.json`;}
 async refresh(){
  try{const raw=await this.plugin.app.vault.adapter.read(this.path);if(this.dead)return;this.data=JSON.parse(raw);if(this.data.version!==1||this.data.project.id!==this.id)throw Error('Unsupported dashboard');
   if(this.sessionId&&this.data.sessionId!==this.sessionId)throw Error('Chat scope does not match');
   if(this.focus&&!this.data.views[this.focus])this.focus=null;this.draw();
  }catch(e){if(!this.dead){this.containerEl.replaceChildren();this.el(this.containerEl,'p','Dashboard unavailable. Open the portable note below. '+e.message);}}
 }
 el(parent,tag,text,cls){const e=parent.ownerDocument.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;parent.append(e);return e;}
 button(parent,text,action,cls){const b=this.el(parent,'button',text,cls);b.type='button';b.addEventListener('click',action);return b;}
 paintStatus(el,id){
  const key=this.data.statusKey?.find(s=>s.id===id);if(!key)return;
  el.dataset.status=id;
  for(const [property,field]of [['--bi-light-fill','fill'],['--bi-light-stroke','stroke'],['--bi-dark-fill','darkFill'],['--bi-dark-stroke','darkStroke']])if(/^#[a-f0-9]{6}$/i.test(key[field]))el.style.setProperty(property,key[field]);
 }
 badge(parent,n){
  const key=this.data.statusKey?.find(s=>s.id===n.statusId),wrap=this.el(parent,'span',undefined,'bi-badges');
  const badge=this.el(wrap,'span',`${key?.mark||''} ${n.status}`.trim(),'bi-badge');this.paintStatus(badge,n.statusId);
  this.el(wrap,'span',({branch:'↗ Offshoot',task:'Task',output:'Result',source:'Source report',goal:'Goal',decision:'Decision'})[n.type]||n.type,n.type==='branch'?'bi-type bi-offshoot':'bi-type');
  if(n.proposal)this.el(wrap,'span','AI suggestion','bi-type');
  if(n.needsReview){const flag=this.el(wrap,'span','? Review interpretation','bi-type');flag.title=n.reviewReason||'An interpretation needs review.';}
 }
 gauge(parent,done,total,label){
  const known=Number.isFinite(total)&&total>0&&Number.isFinite(done),value=known?Math.max(0,Math.min(total,done)):0;
  const ring=this.el(parent,'span',undefined,'bi-gauge');ring.style.setProperty('--bi-gauge',known?Math.round(100*value/total)+'%':'0%');
  ring.setAttribute('role','img');ring.setAttribute('aria-label',known?`${label}: ${value} of ${total}`:`${label}: no recorded goals`);ring.title=ring.getAttribute('aria-label');this.el(ring,'b',known?`${value}/${total}`:'—');return ring;
 }
 async quickSwitch(parent){
  const bar=this.el(parent,'div',undefined,'bi-quick-switch');
  try{const data=JSON.parse(await this.plugin.app.vault.adapter.read('Generated/Interactive/home.json'));if(this.dead||!this.containerEl.contains(bar))return;
   if(this.sessionId&&data.automation){const a=data.automation;this.el(bar,'small',a.paused?'Capture paused':`${a.captureEnabled?'Local capture enabled':'Capture not connected'} · ${a.mapperLimited?'AI mapping: daily limit':a.mapperEnabled?'AI mapping enabled':'AI mapping not enabled'}${a.mapperPending?' · '+a.mapperPending+' queued':''}`,'bi-auto-state');}
   for(const [label,entries]of [['Projects',data.projects.map(p=>({title:p.title,path:`Generated/Dashboards/${p.id}`,selected:p.id===this.id}))],['Chats',data.chats.map(c=>({title:c.projectTitle+' · '+c.title,path:`Generated/Chats/${c.projectId}-${c.sessionId}`,selected:c.sessionId===this.sessionId&&c.projectId===this.id}))]]){
    const wrap=this.el(bar,'label');this.el(wrap,'span',label);const select=this.el(wrap,'select');select.setAttribute('aria-label','Switch '+label.toLowerCase());const initial=this.el(select,'option',label==='Chats'&&!entries.length?'No included chats':'Choose '+label.toLowerCase());initial.value='';
    for(const entry of entries){const option=this.el(select,'option',entry.title);option.value=entry.path;option.selected=entry.selected;}
    if(label==='Chats'){const all=this.el(select,'option','All included chats…');all.value='Generated/Chats/index';}
    select.addEventListener('change',()=>{if(select.value)this.open(select.value);});
   }
  }catch{this.button(bar,'Projects & chats',()=>this.open('Generated/Navigation/Home'));}
 }
 back(){
  const history=this.plugin.app.workspace.activeLeaf?.history;
  if(history?.backHistory?.length)history.back();else this.open('Generated/Navigation/Home');
 }
 async open(path){
  const app=this.plugin.app;await app.workspace.openLinkText(path,this.sourcePath,false);
  // Generated interactive pages open as views, even when the previous note
  // was being edited. This avoids landing on their renderer code blocks.
  if((/^Generated\/(Dashboards|Timelines|Chats|ChatLogs|Guides|Explorers)\//.test(path)||path==='Generated/Navigation/Home')&&!path.endsWith('-static')&&!path.endsWith('-history')){
   const leaf=app.workspace.activeLeaf,state=leaf?.getViewState();
   if(state?.type==='markdown'&&app.workspace.getActiveFile()?.path===path.replace(/\.md$/,'')+'.md')await leaf.setViewState({...state,state:{...state.state,mode:'preview'}});
  }
 }
 select(key){if(key==='mm_root'){this.focus=null;this.history=[];}else{if(key.startsWith('more_'))key=key.replace('more_','group_');if(!this.data.views[key])return;if(key!==this.focus)this.history.push(this.focus);this.focus=key;}this.zoom=1;this.readable=false;this.draw();this.containerEl.querySelector('.bi-map')?.scrollIntoView({block:'start',behavior:'smooth'});}
 draw(){
  const root=this.containerEl,d=this.data,a=d.analytics;this.mapObserver?.disconnect();this.svg=null;root.replaceChildren();
  if(this.timelineOnly){this.el(root,'h1',`${this.timelineLocked?'Chat':'Project'} timeline · ${d.project.title}`);this.button(root,'← Home',()=>this.open('Generated/Navigation/Home'));this.button(root,'Project dashboard',()=>this.open(`Generated/Dashboards/${this.id}`));this.renderTimeline(root);return;}
  const top=this.el(root,'div',undefined,'bi-top');
  this.el(top,'h1',d.project.title);
  this.quickSwitch(top);
  const saved=this.el(root,'div',undefined,'bi-freshness');this.el(saved,'span',savedStamp(a.latest?.at));this.el(saved,'span',`${a.updates14d} updates in 14 days`);
  const nav=this.el(root,'nav',undefined,'bi-nav');
  this.button(nav,'← Back',()=>this.back());
  this.button(nav,'← Home',()=>this.open('Generated/Navigation/Home'));
  this.button(nav,'Chats',()=>root.querySelector('.bi-project-chats')?.scrollIntoView({block:'start',behavior:'smooth'}));
  this.button(nav,'Original plan',()=>this.open(`Generated/Projects/${this.id}`));
  this.button(nav,'Git branches',()=>this.open(`Generated/Branches/${this.id}`));
  this.button(nav,'Timeline',()=>root.querySelector('.bi-timeline')?.scrollIntoView({block:'start',behavior:'smooth'}));
  this.button(nav,'How to use',()=>{const help=root.querySelector('.bi-help');help.open=!help.open;if(help.open)help.scrollIntoView({block:'nearest'});});
  const help=this.el(root,'details',undefined,'bi-help');
  this.el(help,'summary','A simple way to pick up where you left off');
  const steps=this.el(help,'ol');
  for(const text of ['Look at the cards and map to see where this project stands.','Click a map box to explore. Use Previous map or Whole project to return.','Read “Your next step” below, then open the handover when you want to continue with AI.','Choose another project at the top whenever you switch work.'])this.el(steps,'li',text);
  this.el(help,'p','New saved work appears here while Branchi’s local companion is running. Opening a box only changes your view; it does not complete work or accept an AI suggestion.','bi-muted');
  const glance=this.el(root,'section',undefined,'bi-glance');
  this.el(glance,'h2','At a glance');
  this.el(glance,'p','Your progress and project map, together. Click a card or box to explore.','bi-intro');
  const cards=this.el(glance,'div',undefined,'bi-cards');
  for(const [title,value,desc,key]of [
   ['Goals with evidence',a.originalGoals.total?`${a.originalGoals.done} / ${a.originalGoals.total}`:'Not set','Original recorded goals','group_goals'],
   ['Ready to move',a.ready.length,'Can start; AI suggestions excluded','ready'],
   ['Waiting on work',a.waiting.length,`${a.blocked.length} marked as blocked`,'waiting'],
   ['Reports to review',a.reportsToReview.length,'Saved reports still need checking','group_sources']]){
   const card=this.button(cards,'',()=>{if(key==='ready'||key==='waiting'){this.listFilter=key;this.draw();root.querySelector('.bi-work')?.scrollIntoView({block:'center'});}else this.select(key);},'bi-card');
   if(key.startsWith('group_')&&!d.views[key]){card.disabled=true;card.title='No records in this section yet.';}
   this.el(card,'span',title);this.el(card,'strong',value);this.el(card,'small',desc);if(key==='group_goals')this.gauge(card,a.originalGoals.done,a.originalGoals.total,'Original goals with evidence');
  }
  const panel=this.el(glance,'section',undefined,'bi-panel bi-map'),heading=this.el(panel,'div',undefined,'bi-panel-head');
  this.el(heading,'h2',this.focus?d.views[this.focus].title:'Your project, connected');
  this.button(heading,'Full-page map ↗',()=>this.open(`Generated/Explorers/${this.id}`));
  if(this.focus)this.button(heading,'Previous map',()=>{this.focus=this.history.pop()??null;this.zoom=1;this.draw();});
  if(this.focus)this.button(heading,'Whole project',()=>this.select('mm_root'));
  const tools=this.el(panel,'div',undefined,'bi-tools');
  if(!this.focus&&d.compactOverview){const previews=this.button(tools,this.mapPreview?'Hide item previews':'Item previews',()=>{this.mapPreview=!this.mapPreview;this.zoom=1;this.draw();});previews.setAttribute('aria-pressed',String(!!this.mapPreview));}
  this.el(tools,'span',this.focus?'Click a box to see what leads into it and what follows.':'Start with a coloured group, or choose any box.','bi-muted');
  this.button(tools,'−',()=>this.scale(-.2)).setAttribute('aria-label','Zoom out');
  this.button(tools,'Fit map',()=>{this.zoom=1;this.readable=false;this.scale(0);});
  this.button(tools,'Readable size',()=>{this.zoom=1;this.readable=true;this.scale(0);});
  this.button(tools,'+',()=>this.scale(.2)).setAttribute('aria-label','Zoom in');
  const key=this.el(panel,'div',undefined,'bi-key');
  key.hidden=!d.nodes.length;this.el(key,'span','Item colours:','bi-muted');
  for(const state of d.statusKey||[]){if(!d.nodes.some(n=>n.statusId===state.id))continue;const badge=this.el(key,'span',`${state.mark} ${state.label}`,'bi-badge');this.paintStatus(badge,state.id);badge.title=state.description;}
  const legend=this.el(panel,'details',undefined,'bi-legend');this.el(legend,'summary','What do the colours and labels mean?');
  this.el(legend,'p','Category boxes group the map. Individual boxes show work status. A purple Offshoot badge means a branch of the idea; it can have any status.','bi-muted');
  const meanings=this.el(legend,'dl');for(const state of d.statusKey||[]){const term=this.el(meanings,'dt',`${state.mark} ${state.label}`,'bi-badge');this.paintStatus(term,state.id);this.el(meanings,'dd',state.description);}
  this.el(legend,'p','Dashed box borders mark proposals and unverified completion reports. Dotted arrows add context. Opening a box changes your view; it never completes work.','bi-muted');
  this.button(legend,'Open status & tags guide',()=>this.open('Generated/Guides/Status key'));
  const scroll=this.el(panel,'div',undefined,'bi-map-scroll');
  const view=this.focus?d.views[this.focus]:null;
  if(view?.svg||!view){const svg=safeSvg(view?view.svg:(!this.mapPreview&&d.compactOverview?d.compactOverview:d.overview),root.ownerDocument);scroll.append(svg);this.svg=svg;
   for(const n of svg.querySelectorAll('[data-id]')){const record=d.nodes.find(item=>item.id===(view?n.getAttribute('data-id'):n.getAttribute('data-id').replace(/^item_/,'')));if(record)this.paintStatus(n,record.statusId);const key=view?'item_'+n.getAttribute('data-id'):n.getAttribute('data-id');if(key==='mm_root'||d.views[key]||key.startsWith('more_')){
    n.setAttribute('tabindex','0');n.setAttribute('role','button');n.setAttribute('aria-label',n.textContent.trim()+(record?` · ${record.type==='branch'?'Offshoot':record.type}${record.proposal?' · AI suggestion':''}`:''));n.classList.add('bi-click');
    n.addEventListener('click',()=>this.select(key));n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.select(key);}});
   }}this.scale(0);this.mapObserver=new ResizeObserver(()=>this.scale(0));this.mapObserver.observe(scroll);
  }else this.el(scroll,'p','No records in this section yet.');
  this.el(panel,'p',view?`${view.nodes.length} of ${view.total} connected records shown. “Must precede” means the first item needs to happen before the next. Dotted lines add context.`:!this.mapPreview&&d.compactOverview?`${d.groups.length} areas · ${d.nodes.length} records. Choose an area to explore its work and connections.`:`${d.shown} of ${d.nodes.length} records in this preview. Open a group to see more.`,'bi-caption');
  this.el(panel,'p','Scroll sideways to see the rest of the map, or use − to zoom out.','bi-scroll-hint');
  const shortcuts=this.el(panel,'details',undefined,'bi-map-shortcuts');this.el(shortcuts,'summary','Browse groups by name');
  const chips=this.el(shortcuts,'div',undefined,'bi-chips');
  for(const g of d.groups)this.button(chips,`${g.title} · ${g.nodeIds.length}`,()=>this.select('group_'+g.id));
  if(view){
   const list=this.el(root,'section',undefined,'bi-panel bi-records');this.el(list,'h2','Details for this part of the map');const ids=new Set(view.nodes);
   if(!this.focus.startsWith('item_'))for(const id of view.seedIds)ids.add(id);
   for(const n of d.nodes.filter(n=>ids.has(n.id))){const row=this.el(list,'div',undefined,'bi-record');
    this.button(row,n.title,()=>this.select('item_'+n.id));this.badge(row,n);
    if(view.seedIds.includes(n.id)&&n.next)this.el(row,'p',n.next);
    this.button(row,'Open evidence ↗',()=>this.open(`Generated/Items/${n.id}`));
   }
   if(!view.edges.length)this.el(list,'p','No connections recorded here yet. Items in the same group do not automatically depend on each other.','bi-muted');
  }
  const overviewLayout=this.el(glance,'div',undefined,'bi-overview-grid');glance.insertBefore(overviewLayout,cards);overviewLayout.append(cards,panel);
  const streams=this.el(glance,'section',undefined,'bi-panel bi-streams');
  this.el(streams,'h2','Workstream progress');
  this.el(streams,'p','Follow each goal or offshoot. Select a row to see its work and connections.','bi-muted');
  for(const s of d.workstreams||[]){
   const row=this.button(streams,'',()=>this.select(s.key),'bi-stream');
   this.el(row,'strong',s.title);
   this.el(row,'span',s.total?`${s.done} of ${s.total} complete`:'No linked tasks yet','bi-stream-count');
   if(s.total){const bar=this.el(row,'progress');bar.max=s.total;bar.value=s.done;bar.setAttribute('aria-label',`${s.title}: ${s.done} of ${s.total} recorded tasks and outputs complete`);}
   this.el(row,'small',s.total?`${s.active} active · ${s.blocked} blocked · ${s.total-s.done} remaining`:'Open this area to review its plan and evidence.');
  }
  if(!d.workstreams?.length)this.el(streams,'p','Workstreams appear when goals, offshoots or tasks are recorded. Start with your original plan.');
  this.el(streams,'p','Counts recorded tasks and outputs equally. AI suggestions, reports and parked work are excluded. Shared work can appear in more than one row; these counts are separate from original-goal progress.','bi-caption');
  const lower=this.el(glance,'div',undefined,'bi-lower'),status=this.el(lower,'section',undefined,'bi-panel');
  this.el(status,'small','CURRENT RECORD');this.el(status,'h2','Where the work stands');
  for(const s of a.status.filter(s=>s.count)){const row=this.el(status,'div',undefined,'bi-status');this.paintStatus(row,s.id);this.el(row,'span',`${d.statusKey?.find(k=>k.id===s.id)?.mark||''} ${s.label}`);this.el(row,'b',s.count);const meter=this.el(row,'progress');meter.max=Math.max(1,a.workTotal);meter.value=s.count;meter.setAttribute('aria-label',s.label);}
  if(!a.workTotal)this.el(status,'p','No work records yet. Start with the original brief.');
  this.el(status,'p','Work excludes goals and source reports. Completion reflects recorded evidence.','bi-caption');
  this.el(status,'p',a.template.stages.join(' → '),'bi-stages');this.el(status,'small','Suggested stages, not completed milestones.','bi-muted');
  const rhythm=this.el(lower,'section',undefined,'bi-panel');this.el(rhythm,'small','YOUR WORK RHYTHM');this.el(rhythm,'h2','The last two weeks');
  this.el(rhythm,'p',`${a.updates14d} saved updates · ${a.activeDays} active day${a.activeDays===1?'':'s'}`);const chart=this.el(rhythm,'div',undefined,'bi-chart'),max=Math.max(1,...a.activity.map(x=>x.count));
  for(const day of a.activity){const col=this.el(chart,'div');col.title=`${day.date}: ${day.count} saved updates`;this.el(col,'small',day.count||'');const track=this.el(col,'div',undefined,'bi-track');const bar=this.el(track,'div');bar.style.height=100*day.count/max+'%';this.el(col,'small',day.date.slice(8));}
  this.el(rhythm,'p',`${a.timeZone} · Recorded updates, not hours or productivity.`,'bi-caption');
  lower.append(streams);
  this.renderTimeline(glance);
  const resume=this.el(root,'section',undefined,'bi-resume');this.el(resume,'small','YOUR NEXT STEP');this.el(resume,'p',a.next);
  this.button(resume,'Continue with AI →',()=>this.open(`Generated/Resume/${this.id}`));
  this.el(resume,'small','Opens a handover you can use in your AI chat.','bi-handover-hint');
  root.insertBefore(resume,glance);
  // Keep written detail below the visual overview and the next action.
  const recordList=root.querySelector('.bi-records');if(recordList)root.append(recordList);
  const todo=this.el(root,'section',undefined,'bi-panel bi-work');this.el(todo,'h2','What you can work on');
  const queue=this.el(todo,'div',undefined,'bi-queue');
  for(const [key,title,count]of [['ready','Ready to move',a.ready.length],['waiting','Waiting on other work',a.waiting.length]]){
   const b=this.button(queue,`${title} · ${count}`,()=>{this.listFilter=key;this.draw();root.querySelector('.bi-work')?.scrollIntoView({block:'center'});});
   b.setAttribute('aria-pressed',String((this.listFilter||'ready')===key));
  }
  const rows=this.listFilter==='waiting'?a.waiting:a.ready;
  if(!rows.length)this.el(todo,'p','No records in this queue.');
  for(const n of rows){const row=this.el(todo,'div',undefined,'bi-record');this.button(row,n.title,()=>this.select('item_'+n.id));this.el(row,'p',n.next||'Review the linked record.');}
  const chatSection=this.el(root,'section',undefined,'bi-panel bi-project-chats');this.el(chatSection,'h2','Chats behind this project');
  if(!d.chats?.length)this.el(chatSection,'p','No included chats with saved turns are linked here. Open the intended Codex chat and ask to include that exact chat in Branchi.');
  this.button(chatSection,'Set up a chat',()=>this.open('Generated/Guides/Chat privacy'));
  for(const chat of d.chats||[]){const row=this.el(chatSection,'div',undefined,'bi-record');this.button(row,chat.title,()=>this.open('Generated/'+chat.path));this.el(row,'small',`${chat.reportCount} saved reports`);this.el(row,'p',chat.summary,'bi-chat-preview');}
  const recent=this.el(root,'details',undefined,'bi-panel');this.el(recent,'summary','Recent updates & review prompts');
  for(const e of a.recent)this.el(recent,'p',`${new Date(e.at).toLocaleString()} · ${e.text}`);
  for(const prompt of a.template.prompts)this.el(recent,'p',prompt);
  const more=this.el(root,'details',undefined,'bi-more');this.el(more,'summary','More views & update details');
  for(const [title,path]of [['All notes & chat maps',`Dashboards/${this.id}-static`],['Canvas board',`Maps/${this.id}.canvas`],['Connection status','Navigation/Connections']])this.button(more,title,()=>this.open('Generated/'+path));
  this.el(more,'p',`Local record · revision ${d.revision} · ${a.template.title} · generated ${new Date(a.at).toLocaleString()}`,'bi-muted');
 }
 renderTimeline(parent){
  const d=this.data,t=d.timeline||{items:[],points:[],chats:[],total:0,loaded:0},zone=d.analytics?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const panel=this.el(parent,'section',undefined,'bi-panel bi-timeline');
  this.el(panel,'h2',this.timelineLocked?'This chat, over time':'Project timeline');
  this.el(panel,'p','Follow the work from the start of its saved record to now. Select a marker to explore.','bi-muted');
  const kinds=[['decision','Decisions'],['result','Results'],['branch','Offshoots'],['proposal','AI proposals'],['checkpoint','Checkpoints'],['connection','Connections'],['update','Other updates']];
  const kindName={checkpoint:'Saved checkpoint',decision:'Decision',branch:'Offshoot',proposal:'AI proposal',result:'Result record',connection:'Connection',update:'Project update'};
  const controls=this.el(panel,'div',undefined,'bi-timeline-filters');
  const field=(title,options,value,change)=>{const label=this.el(controls,'label');this.el(label,'span',title);const input=this.el(label,'select');input.setAttribute('aria-label',title);for(const [id,text]of options){const opt=this.el(input,'option',text);opt.value=id;opt.selected=id===value;}input.addEventListener('change',()=>{change(input.value);this.timelineSelected=null;this.timelineGroup=null;this.timelineVisible=20;paint();});return input;};
  const chatOptions=[['all','All project updates'],['project','Updates without a linked chat'],...t.chats.map(c=>[c.id,`Chat ${c.id.slice(0,8)} · ${c.count} updates`])];
  if(this.timelineLocked&&!t.chats.some(c=>c.id===this.timelineChat))chatOptions.push([this.timelineChat,'This chat']);
  field('Chat',chatOptions,this.timelineChat,v=>this.timelineChat=v).disabled=this.timelineLocked;
  field('When',[['all','All saved history'],['7','Last 7 days'],['30','Last 30 days']],this.timelineDays,v=>this.timelineDays=v);
  const content=this.el(panel,'div',undefined,'bi-timeline-content');
  const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}),dayKey=at=>dayFormatter.format(new Date(at));
  const when=(at,options)=>new Date(at).toLocaleString(undefined,{timeZone:zone,...options});
  const date=at=>when(at,{day:'numeric',month:'short',year:'numeric'});
  const renderToken=this.timelineRenderToken=(this.timelineRenderToken||0)+1,cacheKey=this.id+':'+t.archiveRevision,points=t.points||t.items;
  let fullItems=this.timelineArchive?.key===cacheKey?this.timelineArchive.items:t.items,loading=false,loadError='';
  const loadHistory=async()=>{
   if(!t.truncated||this.timelineArchive?.key===cacheKey||loading||loadError)return;
   loading=true;loadError='';paint();
   try{const archive=JSON.parse(await this.plugin.app.vault.adapter.read(`Generated/TimelineHistory/${this.id}.json`));
    if(archive.version!==1||archive.projectId!==this.id||archive.revision!==t.archiveRevision||!Array.isArray(archive.items))throw Error('History changed; wait for the refreshed timeline, then reopen it.');
    fullItems=archive.items;this.timelineArchive={key:cacheKey,items:fullItems};
   }catch(e){loadError=e.message;}finally{loading=false;if(!this.dead)paint();}
  };
  const detail=(host,e)=>{
   const box=this.el(host,'div',undefined,'bi-timeline-detail');this.el(box,'h3',e.snapshot?.title||e.title);this.el(box,'p',`${kindName[e.kind]||'Update'} · ${when(e.at,{dateStyle:'medium',timeStyle:'short'})}`,'bi-muted');
   if(e.text&&e.text!==e.title)this.el(box,'p',e.text);
   if(e.kind==='checkpoint')this.el(box,'p','Saved assistant report; review its evidence before treating the outcome as verified.','bi-caption');
   if(e.snapshot){this.el(box,'h4','Saved at this point');this.el(box,'p',e.snapshot.proposal?'AI proposal · review required':e.snapshot.status,'bi-muted');
    if(e.snapshot.detail)this.el(box,'p',e.snapshot.detail,'bi-snapshot');if(e.snapshot.next){this.el(box,'h4','Next step at that time');this.el(box,'p',e.snapshot.next);}
    if(e.snapshot.evidence){this.el(box,'h4','Recorded evidence');this.el(box,'p',e.snapshot.evidence,'bi-snapshot');}
   }else if(!e.text&&t.truncated&&!this.timelineArchive)this.el(box,'p',loading?'Loading the saved details…':'Open full saved history below to load the archived details.','bi-caption');
   else this.el(box,'p','A full historical record snapshot was not saved for this entry.','bi-caption');
   if(e.changes?.length)this.el(box,'p',e.changes.join(' · '));
   if(e.nodeId)this.button(box,'Open current record ↗',()=>this.open(`Generated/Items/${e.nodeId}`));
   if(e.sessionId){this.button(box,'Chat overview',()=>this.open(`Generated/Chats/${this.id}-${e.sessionId}`));if(e.provider==='codex'){const link=this.el(box,'a','Open source chat ↗','external-link');link.href=`codex://threads/${e.sessionId}`;}}
   if(e.turnId)this.el(box,'small',`Source turn: ${e.turnId}`,'bi-muted');
  };
  const matches=e=>{
   const today=dayKey(new Date().toISOString()),anchor=Date.parse(today+'T00:00:00Z');
   return (this.timelineChat==='all'||(this.timelineChat==='project'?!e.sessionId:e.sessionId===this.timelineChat))&&(this.timelineKind==='all'||e.kind===this.timelineKind)&&(this.timelineDays==='all'||(anchor-Date.parse(dayKey(e.at)+'T00:00:00Z'))/86400000<Number(this.timelineDays));
  };
  const paint=()=>{
   if(this.dead||this.timelineRenderToken!==renderToken)return;content.replaceChildren();
   const legend=this.el(content,'div',undefined,'bi-time-legend');this.el(legend,'span','Event colours:','bi-muted');
   const all=this.button(legend,'All types',()=>{this.timelineKind='all';this.timelineSelected=null;this.timelineGroup=null;paint();});all.setAttribute('aria-pressed',String(this.timelineKind==='all'));
   for(const [kind,name]of kinds){const button=this.button(legend,name,()=>{this.timelineKind=this.timelineKind===kind?'all':kind;this.timelineSelected=null;this.timelineGroup=null;paint();});button.dataset.kind=kind;button.classList.add('bi-time-key');button.setAttribute('aria-pressed',String(this.timelineKind===kind));}
   const filtered=points.filter(matches),now=new Date().toISOString(),start=this.timelineChat!=='all'&&this.timelineChat!=='project'?(t.chatStarts?.[this.timelineChat]||filtered[0]?.at||t.startedAt||now):(t.startedAt||points[0]?.at||now);
   const startMs=Date.parse(start),endMs=Math.max(startMs+1,Date.parse(now)),span=endMs-startMs;
   const range=this.el(content,'div',undefined,'bi-time-range');this.el(range,'strong','Start · '+date(start));this.el(range,'span',`${filtered.length} recorded updates · ${zone}`);this.el(range,'strong','Now · '+date(now));
   const scroller=this.el(content,'div',undefined,'bi-time-scroll'),plot=this.el(scroller,'div',undefined,'bi-time-plot');
   const axis=this.el(plot,'div',undefined,'bi-time-axis');this.el(axis,'span','Recorded time');const ticks=this.el(axis,'div',undefined,'bi-time-ticks');
   for(let i=0;i<5;i++){const at=new Date(startMs+span*i/4).toISOString();this.el(ticks,'span',when(at,span<2*86400000?{hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short'}));}
   for(const [kind,name]of kinds){const events=filtered.filter(e=>e.kind===kind);if(!events.length)continue;
    const row=this.el(plot,'div',undefined,'bi-time-lane');row.dataset.kind=kind;this.el(row,'span',`${name} · ${events.length}`,'bi-time-lane-name');const track=this.el(row,'div',undefined,'bi-time-track'),buckets=new Map();
    for(const e of events){const position=Math.max(0,Math.min(1,(Date.parse(e.at)-startMs)/span)),slot=Math.min(17,Math.floor(position*18)),bucket=buckets.get(slot)||[];bucket.push(e);buckets.set(slot,bucket);}
    for(const [slot,events]of buckets){const key=kind+'_'+slot,position=(slot+.5)/18;
     const marker=this.button(track,events.length>99?'99+':events.length>1?events.length:'',()=>{this.timelineGroup={key,ids:events.map(e=>e.id)};this.timelineSelected=events[0].id;paint();if(!fullItems.some(e=>e.id===this.timelineSelected))loadHistory();[...content.querySelectorAll('[data-point]')].find(el=>el.dataset.point===key)?.focus({preventScroll:true});},'bi-time-marker');
     marker.style.left=`${Math.max(1,Math.min(99,position*100))}%`;marker.dataset.point=key;marker.setAttribute('aria-pressed',String(this.timelineGroup?.key===key));const label=events.length===1?`${kindName[kind]}: ${events[0].title}`:`${events.length} ${name.toLowerCase()} · select to browse`;marker.title=label;marker.setAttribute('aria-label',label+' · '+when(events[0].at,{dateStyle:'medium',timeStyle:'short'}));
    }
   }
   if(!filtered.length)this.el(plot,'p','No saved updates match these filters. Try All types or All saved history.');
   this.el(content,'p','Marker colours show event type. Nearby events are grouped; counts are saved updates, not task durations or completion scores.','bi-caption');
   if(this.timelineGroup){const selected=this.el(content,'section',undefined,'bi-time-selection');this.el(selected,'h3',`${this.timelineGroup.ids.length} selected update${this.timelineGroup.ids.length===1?'':'s'}`);this.button(selected,'Close selection',()=>{this.timelineGroup=null;this.timelineSelected=null;paint();});
    const choices=this.el(selected,'div',undefined,'bi-time-choices');for(const id of this.timelineGroup.ids){const e=points.find(p=>p.id===id);if(!e)continue;const button=this.button(choices,when(e.at,{hour:'2-digit',minute:'2-digit'})+' · '+e.title,()=>{this.timelineSelected=id;paint();if(!fullItems.some(e=>e.id===id))loadHistory();});button.setAttribute('aria-pressed',String(id===this.timelineSelected));}
    const e=fullItems.find(e=>e.id===this.timelineSelected)||points.find(e=>e.id===this.timelineSelected);if(e)detail(selected,e);
   }
   const history=this.el(content,'details',undefined,'bi-time-history');this.el(history,'summary',`Full saved history · ${filtered.length} matching updates`);history.open=!!this.timelineHistoryOpen;
   history.addEventListener('toggle',()=>{this.timelineHistoryOpen=history.open;if(history.open)loadHistory();});
   if(loading)this.el(history,'p','Loading older saved details…','bi-muted');if(loadError)this.el(history,'p',loadError,'bi-muted');
   const items=fullItems.filter(matches).slice().reverse(),shown=items.slice(0,this.timelineVisible),list=this.el(history,'ol',undefined,'bi-timeline-list');let day=null;
   for(const e of shown){const key=dayKey(e.at),li=this.el(list,'li',undefined,'bi-timeline-entry');li.dataset.kind=e.kind;if(key!==day){this.el(li,'h3',date(e.at),'bi-timeline-day');day=key;}
    const row=this.button(li,'',()=>{this.timelineHistorySelected=this.timelineHistorySelected===e.id?null:e.id;paint();[...content.querySelectorAll('[data-event]')].find(node=>node.dataset.event===e.id)?.focus({preventScroll:true});},'bi-timeline-event');row.dataset.event=e.id;row.setAttribute('aria-expanded',String(this.timelineHistorySelected===e.id));
    this.el(row,'time',when(e.at,{hour:'2-digit',minute:'2-digit'})).dateTime=e.at;this.el(row,'span',kindName[e.kind]||'Saved update','bi-timeline-kind');this.el(row,'strong',e.title);if(this.timelineHistorySelected===e.id)detail(li,e);
   }
   if(items.length>shown.length)this.button(history,`Show 20 more · ${items.length-shown.length} remaining`,()=>{this.timelineVisible+=20;paint();});
   if(t.truncated&&!this.timelineArchive)this.el(history,'p',`${t.loaded} recent detail records loaded. Opening this dropdown loads the older saved details locally.`,'bi-caption');
  };
  paint();
  this.el(panel,'p','Start means the beginning of Branchi’s saved record for this scope. Earlier uncaptured work is not reconstructed.','bi-caption');
  if(!this.timelineOnly)this.button(panel,'Open timeline page ↗',()=>this.open(`Generated/Timelines/${this.id}`));
 }
 scale(delta){
  this.zoom=Math.max(.25,Math.min(3,this.zoom+delta));if(!this.svg)return;
  const scroll=this.svg.parentElement,box=this.svg.viewBox.baseVal,pane=this.containerEl.closest('.workspace-leaf-content');
  const size=mapSize({width:box.width,height:box.height,availableWidth:scroll.clientWidth,availableHeight:this.fullPage?Math.max(240,(pane?.getBoundingClientRect().bottom||this.containerEl.ownerDocument.defaultView.innerHeight)-scroll.getBoundingClientRect().top-48):(pane?.clientHeight||this.containerEl.ownerDocument.defaultView.innerHeight),fullPage:!!this.fullPage,fitAll:!!this.fitAll,zoom:this.zoom,readable:this.readable,fullWidth:!!this.data.compactOverview||!!this.data.map});
  if(!size)return;this.svg.style.width=size.width+'px';this.svg.style.minWidth='0';this.svg.style.height=size.height+'px';scroll.style.maxHeight=size.frame+'px';
 }
}
class Home extends Dashboard{
 constructor(el,plugin,sourcePath,options={}){super(el,plugin,'home',sourcePath);this.search='';this.chatsOnly=!!options.chatsOnly;}
 get path(){return this.chatsOnly?'Generated/Interactive/chats.json':'Generated/Interactive/home.json';}
 async refresh(){try{const raw=await this.plugin.app.vault.adapter.read(this.path);if(this.dead||raw===this.previous)return;this.previous=raw;this.data=JSON.parse(raw);if(!Array.isArray(this.data.projects))throw Error('Invalid Home data');this.draw();}catch(e){if(!this.dead){this.containerEl.replaceChildren();this.el(this.containerEl,'p','Home is waiting for the Branchi companion. Open the plain project list below.');}}}
 draw(){
  const root=this.containerEl,d=this.data,r=d.review;root.replaceChildren();root.classList.add('bi-home');
  this.el(root,'h1',this.chatsOnly?'Your saved chats':'Branchi Home');if(d.workspace){const identity=this.el(root,'p',`LIVE · ${d.workspace.name} · revision ${d.revision}`,'bi-workspace-identity');identity.title=d.workspace.vault;const browser=this.el(identity,'a',' · Open localhost');browser.href=d.workspace.localUrl;}this.el(root,'p',this.chatsOnly?'Find what you worked on, what was saved, and where to continue.':'Pick up where you left off. Your saved decisions, dependencies and side ideas stay connected.','bi-home-intro');const nav=this.el(root,'nav',undefined,'bi-nav');this.button(nav,'← Back',()=>this.back());this.button(nav,this.chatsOnly?'← Home':'All saved chats',()=>this.open(this.chatsOnly?'Generated/Navigation/Home':'Generated/Chats/index'));this.button(nav,'Start here',()=>this.open('Generated/Navigation/How to use'));this.button(nav,'Daily recap',()=>this.open('Generated/Recaps/index'));this.button(nav,'Set up another chat',()=>this.open('Generated/Guides/Chat privacy'));
  const setup=this.el(root,'div',undefined,'bi-chat-setup');this.el(setup,'span',d.privacy?`${d.privacy.includedSavedChats} included chat${d.privacy.includedSavedChats===1?'':'s'} · ${d.privacy.excludedSavedChats} previously saved chats excluded by your privacy settings.`:'Only individually included chats with saved turns appear here.');
  const bar=this.el(root,'div',undefined,'bi-home-bar'),input=this.el(bar,'input');input.type='search';input.placeholder='Find a project or chat…';input.setAttribute('aria-label','Find a project or chat');input.value=this.search;
  const check=this.button(bar,'Check now',async()=>{check.disabled=true;try{const adapter=this.plugin.app.vault.adapter;for(const folder of ['.brancha','.brancha/reviewer'])if(!await adapter.exists(folder))await adapter.mkdir(folder);await adapter.write('.brancha/reviewer/request.json',JSON.stringify({id:Date.now()+'_'+Math.random().toString(16).slice(2),requestedAt:new Date().toISOString()}));new Notice('Check requested. Branchi will review new saved turns and update Obsidian.');check.textContent='Check requested';}catch(e){check.disabled=false;new Notice('Check could not be requested. Open Connection status for setup details.');}});
  check.disabled=!r.enabled||r.paused||/reviewing|Updating/.test(r.state);
  const status=this.el(root,'div',undefined,'bi-home-status');this.el(status,'strong',r.paused?'Capture and review are paused':r.enabled?`Luna High review · ${r.state}`:'Automatic review is not configured');
  this.el(status,'span',r.lastAt?`Last completed ${new Date(r.lastAt).toLocaleString()}`:'No completed High review observed yet.');
  if(r.backlog)this.el(status,'span',`${r.backlog} saved turns waiting for a later batch.`);
  if(r.note)this.button(status,'Latest review',()=>this.open(r.note.replace(/\.md$/,'')));
  this.button(status,'Connection status',()=>this.open('Generated/Navigation/Connections'));
  const overview=this.el(root,'div',undefined,'bi-home-overview');
  for(const [value,label]of [[d.projects.length,'Projects'],[d.chatTotal??d.chats.length,'Included chats'],[d.projects.reduce((n,p)=>n+p.ready,0),'Ready to move']]){const stat=this.el(overview,'div');this.el(stat,'strong',value);this.el(stat,'span',label);}
  if(d.automation){const a=d.automation,pipeline=this.el(root,'div',undefined,'bi-pipeline');for(const [label,state]of [['Capture',a.paused?'Paused':a.captureEnabled?'Enabled':'Not connected'],['AI mapping',a.mapperLimited?`Daily limit · ${a.mapperPending} queued`:a.mapperEnabled?`${a.mapperPending} queued`:'Not enabled'],['Review',r.state]]){const item=this.el(pipeline,'div');this.el(item,'strong',label);this.el(item,'span',state);}}
  const columns=this.el(root,'div',undefined,this.chatsOnly?'bi-chat-index':'bi-home-columns');
  const projectSection=this.el(columns,'section',undefined,'bi-panel');projectSection.hidden=this.chatsOnly;this.el(projectSection,'h2',`Your projects · ${d.projects.length}`);
  const searchable=[];
  for(const p of d.projects){const row=this.el(projectSection,'div',undefined,'bi-home-project');searchable.push({el:row,text:p.title+' '+p.next});
   const head=this.el(row,'div',undefined,'bi-project-head');this.gauge(head,p.goals.done,p.goals.total,'Goals with evidence');const title=this.el(head,'div');this.button(title,p.title,()=>this.open(`Generated/Dashboards/${p.id}`),'bi-home-project-title');this.el(title,'small',savedStamp(p.lastAt));this.el(row,'p',p.next);
   this.el(row,'small',`${p.chatCount??0} included chats · ${p.updates14d??0} updates / 14 days`,'bi-project-facts');
   const actions=this.el(row,'div',undefined,'bi-home-actions');this.el(actions,'small',`${p.ready} ready · ${p.waiting} waiting · ${p.goals.done}/${p.goals.total} goals with evidence`);
   this.button(actions,'Open project',()=>this.open(`Generated/Dashboards/${p.id}`));this.button(actions,'Timeline',()=>this.open(`Generated/Timelines/${p.id}`));this.button(actions,'AI handover',()=>this.open(`Generated/Resume/${p.id}`));
  }
  const chats=this.el(columns,'section',undefined,'bi-panel');this.el(chats,'h2',this.chatsOnly?`Saved chats · ${d.chatTotal??d.chats.length}`:'Recent chats');
  if(!d.chats.length)this.el(chats,'p','Saved chats appear here once Branchi captures a source-chat ID. Your projects above are ready to open.');
  for(const c of d.chats){const row=this.el(chats,'div',undefined,'bi-home-chat');searchable.push({el:row,text:c.projectTitle+' '+c.title+' '+(c.summary||'')+' '+(c.find||'')});this.el(row,'small',`${c.projectTitle} · ${savedStamp(c.at)}`);
   this.button(row,c.title,()=>this.open(`Generated/Chats/${c.projectId}-${c.sessionId}`),'bi-home-chat-title');
   this.el(row,'p',c.summary||'Open this chat’s saved work.','bi-chat-preview');this.el(row,'small',`${c.reportCount||0} saved reports · ${c.verifiedCount||0} verified outcomes linked · ${c.artifactCount||0} file/web links`);this.el(row,'small','Open chat overview →');if(c.provider==='codex'){const link=this.el(row,'a','Continue in Codex ↗','external-link');link.href=`codex://threads/${c.sessionId}`;}
  }
  const empty=this.el(root,'p','Nothing matches that search. Try a project name.','bi-muted');
  const filter=()=>{let count=0;for(const entry of searchable){entry.el.hidden=!entry.text.toLowerCase().includes(this.search.toLowerCase());if(!entry.el.hidden)count++;}empty.hidden=count>0||!this.search;};
  input.addEventListener('input',()=>{this.search=input.value;filter();});filter();
  this.el(root,'p',`Local Home snapshot · ${new Date(d.at).toLocaleString()}. New work appears while the companion runs. Only chats with saved provenance are listed.`,'bi-caption');
 }
}
class Chat extends Dashboard{
 constructor(el,plugin,id,sessionId,sourcePath){super(el,plugin,id,sourcePath,{sessionId});this.sessionId=sessionId;}
 get path(){return `Generated/Interactive/chat-${this.id}-${this.sessionId}.json`;}
 async refresh(){try{const raw=await this.plugin.app.vault.adapter.read(this.path);if(this.dead)return;this.data=JSON.parse(raw);if(this.data.version!==1||this.data.sessionId!==this.sessionId||this.data.project.id!==this.id)throw Error('Unsupported chat');this.draw();}catch(e){if(!this.dead){this.containerEl.replaceChildren();this.el(this.containerEl,'p','This chat overview is waiting for the companion. Open the portable overview below.');}}}
 draw(){
  const root=this.containerEl,d=this.data;this.mapObserver?.disconnect();this.svg=null;root.replaceChildren();root.classList.add('bi-chat');
  this.el(root,'small',`CHAT OVERVIEW · ${d.project.title}`);this.el(root,'h1',d.title);this.quickSwitch(root);this.el(root,'div',savedStamp(d.at),'bi-freshness');
  const nav=this.el(root,'nav',undefined,'bi-nav');this.button(nav,'← Back',()=>this.back());this.button(nav,'← Home',()=>this.open('Generated/Navigation/Home'));this.button(nav,'All chats',()=>this.open('Generated/Chats/index'));this.button(nav,'Project dashboard',()=>this.open(`Generated/Dashboards/${this.id}`));this.button(nav,'Source index',()=>this.open(`Generated/Chats/${this.id}-${this.sessionId}-index`));
  if(d.provider==='codex'){const a=this.el(nav,'a','Resume this chat ↗','external-link');a.href=`codex://threads/${this.sessionId}`;}
  this.el(root,'p','Saved work from this chat, with a clear route back to the source. Reports describe what the assistant said; verified outcomes require separate evidence.','bi-muted');
  const cards=this.el(root,'div',undefined,'bi-cards');for(const [label,value]of [['Saved reports',d.reportCount],['Verified outcomes linked',d.verified.length],['AI suggestions to review',d.proposals.length],['File / web links',d.artifactTotal]]){const target=({'Saved reports':'.bi-chat-reports','Verified outcomes linked':'.bi-chat-outcomes','AI suggestions to review':'.bi-chat-choices','File / web links':'.bi-chat-artifacts'})[label];const card=this.button(cards,'',()=>{const section=root.querySelector(target);if(section?.tagName==='DETAILS')section.open=true;section?.scrollIntoView({block:'start',behavior:'smooth'});},'bi-card');this.el(card,'span',label);this.el(card,'strong',value);this.el(card,'small','Explore →');}
  this.renderChatMap(root);
  const next=this.el(root,'section',undefined,'bi-resume');this.el(next,'small','PICK UP THIS CHAT');this.el(next,'p',d.next);this.button(next,'Chat handover →',()=>this.open(`Generated/Chats/${this.id}-${this.sessionId}-notes`));this.el(next,'small','Opens this chat’s saved overview and source links. Resume this chat above returns to the original Codex conversation.','bi-handover-hint');
  root.insertBefore(next,cards);
  const latest=d.reports[0],summary=this.el(root,'section',undefined,'bi-panel');this.el(summary,'h2','What you worked on');
  if(latest?.request){this.el(summary,'h3','Latest captured request');this.el(summary,'p',latest.request,'bi-chat-request');}else this.el(summary,'p','The original user request was not captured for these older reports. Open the source chat for its full scope.','bi-muted');
  this.el(summary,'h3','Latest saved result · assistant report');this.el(summary,'p',d.summary);if(latest){const details=this.el(summary,'details');this.el(details,'summary','Read the full saved report');this.el(details,'p',latest.body,'bi-snapshot');}
  const outcomes=this.el(root,'section',undefined,'bi-panel bi-chat-outcomes');this.el(outcomes,'h2','Outcomes and choices');
  if(!d.verified.length)this.el(outcomes,'p','No verified outcomes explicitly linked to this chat yet. This does not mean no work was done: saved reports are above, and project evidence may be recorded separately.');
  for(const n of d.verified){this.button(outcomes,'✓ '+n.title,()=>this.open(`Generated/Items/${n.id}`));this.el(outcomes,'p',n.evidence);}
  const choices=this.el(outcomes,'details',undefined,'bi-chat-choices');this.el(choices,'summary',`${d.records.filter(n=>!d.verified.some(v=>v.id===n.id)).length} source-linked choices and records · expand to review`);
  for(const n of d.records.filter(n=>!d.verified.some(v=>v.id===n.id))){const row=this.el(choices,'div',undefined,'bi-record');this.button(row,n.title,()=>this.open(`Generated/Items/${n.id}`));this.el(row,'small',`${n.status} · ${n.type==='branch'?'Offshoot':n.type}${n.proposal?' · AI suggestion':''}`);}
  const artifacts=this.el(root,'section',undefined,'bi-panel');this.el(artifacts,'h2','Where to find the work');
  this.el(artifacts,'p','Links found in saved reports. Branchi has not checked whether these files or pages still exist.','bi-muted');
  const list=this.el(artifacts,'ul',undefined,'bi-chat-artifacts');for(const item of d.artifacts){if(!/^(https?:\/\/|file:\/\/)/i.test(item.url)||/[\u0000-\u001f]/.test(item.url))continue;const li=this.el(list,'li'),a=this.el(li,'a',item.label||item.url,'external-link');a.href=item.url;this.el(li,'small',` · saved ${new Date(item.at).toLocaleDateString()}`);}
  if(!d.artifacts.length)this.el(artifacts,'p','No links were included in the captured reports. Open the source chat or project dashboard for more context.');if(d.artifactTotal>d.artifacts.length)this.el(artifacts,'p',`${d.artifacts.length} of ${d.artifactTotal} distinct links shown. Older links remain in saved reports.`,'bi-muted');
  if(latest?.cwd)this.el(artifacts,'p','Latest captured working folder: '+latest.cwd,'bi-chat-folder');
  const reports=this.el(root,'section',undefined,'bi-panel bi-chat-reports');this.el(reports,'h2','Saved work, report by report');this.el(reports,'p',`${d.reports.length} of ${d.reportCount} reports shown, newest first. Capture starts when the local watcher is enabled; earlier uncaptured turns are not reconstructed.`,'bi-muted');
  for(const report of d.reports){const entry=this.el(reports,'details',undefined,'bi-chat-report');this.el(entry,'summary',`${new Date(report.at).toLocaleString()} · ${report.title.replace(/^Codex · /,'')}`);if(report.request)this.el(entry,'p','Request: '+report.request);this.el(entry,'p',report.body,'bi-snapshot');if(report.logPath)this.button(entry,'Open saved reply and neighbours',()=>this.open('Generated/'+report.logPath));if(report.turnId)this.el(entry,'small','Source turn: '+report.turnId);}
  this.renderTimeline(root);
 }
 renderChatMap(parent){
  const m=this.data.map;if(!m)return;
  const navigate=(group,item)=>{if((this.chatMapGroup||null)===(group||null)&&(this.chatMapItem||null)===(item||null))return;this.chatMapHistory??=[];this.chatMapHistory.push({group:this.chatMapGroup||null,item:this.chatMapItem||null});this.chatMapGroup=group;this.chatMapItem=item;this.zoom=1;this.readable=false;this.draw();const target=this.containerEl.querySelector(item?'.bi-chat-map-detail':'.bi-chat-map');target?.scrollIntoView({block:'start',behavior:'smooth'});};
  const group=m.groups.find(g=>g.id===this.chatMapGroup),selected=m.items.find(i=>i.id===this.chatMapItem),panel=this.el(parent,'section',undefined,'bi-panel bi-map bi-chat-map'),heading=this.el(panel,'div',undefined,'bi-panel-head');
  this.el(heading,'h2',group?group.title:'This chat, connected');
  this.button(heading,'Full-page map ↗',()=>this.open(`Generated/Explorers/chat-${this.id}-${this.sessionId}`));
  if(this.chatMapHistory?.length)this.button(heading,'Previous map',()=>{const previous=this.chatMapHistory.pop();this.chatMapGroup=previous.group;this.chatMapItem=previous.item;this.zoom=1;this.readable=false;this.draw();this.containerEl.querySelector('.bi-chat-map')?.scrollIntoView({block:'start'});});
  if(group||selected)this.button(heading,'Whole chat',()=>{this.chatMapGroup=null;this.chatMapItem=null;this.chatMapHistory=[];this.zoom=1;this.readable=false;this.draw();this.containerEl.querySelector('.bi-chat-map')?.scrollIntoView({block:'start'});});
  const tools=this.el(panel,'div',undefined,'bi-tools');if(!group&&m.preview){const previews=this.button(tools,this.mapPreview?'Hide item previews':'Item previews',()=>{this.mapPreview=!this.mapPreview;this.zoom=1;this.readable=false;this.draw();});previews.setAttribute('aria-pressed',String(!!this.mapPreview));}this.el(tools,'span','Select a group or item to trace its saved source.','bi-muted');this.button(tools,'−',()=>this.scale(-.2)).setAttribute('aria-label','Zoom chat map out');this.button(tools,'Fit map',()=>{this.zoom=1;this.readable=false;this.scale(0);});this.button(tools,'Readable size',()=>{this.zoom=1;this.readable=true;this.scale(0);});this.button(tools,'+',()=>this.scale(.2)).setAttribute('aria-label','Zoom chat map in');
  const scroll=this.el(panel,'div',undefined,'bi-map-scroll'),svg=safeSvg(group?m.views[group.id]:(this.mapPreview&&m.preview?m.preview:m.overview),panel.ownerDocument);scroll.append(svg);this.svg=svg;
  for(const node of svg.querySelectorAll('.pele-node[data-id]')){
   const id=node.dataset.id,item=m.items.find(i=>'item_'+i.id===id),target=m.groups.find(g=>'group_'+g.id===id||'more_'+g.id===id);
   if(item?.statusId)this.paintStatus(node,item.statusId);
   if(id!=='cm_root'&&!item&&!target)continue;node.classList.add('bi-click');node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',node.textContent.trim());
   const action=()=>{if(id==='cm_root')navigate(null,null);else if(target){if(group?.id===target.id){const list=panel.querySelector('.bi-chat-map-list');if(list){list.open=true;list.scrollIntoView({block:'nearest'});}}else navigate(target.id,null);}else navigate(group?.id||m.groups.find(g=>g.itemIds.includes(item.id))?.id||null,item.id);};
   node.addEventListener('click',action);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}});
  }
  this.scale(0);this.mapObserver=new ResizeObserver(()=>this.scale(0));this.mapObserver.observe(scroll);
  this.el(panel,'p','Groups organise this chat’s captured material. Source links trace provenance; they do not create task dependencies or verify reported outcomes.','bi-caption');
  const actions=this.el(panel,'div',undefined,'bi-chips');for(const g of m.groups)this.button(actions,`${g.title} · ${g.itemIds.length}`,()=>navigate(g.id,null));this.button(actions,'Open source index',()=>this.open('Generated/'+m.indexPath));
  if(group){const list=this.el(panel,'details',undefined,'bi-chat-map-list');list.open=true;this.el(list,'summary',`Browse all ${group.itemIds.length} items`);const rows=this.el(list,'div',undefined,'bi-chat-map-items');
   for(const id of group.itemIds){const item=m.items.find(i=>i.id===id);this.button(rows,item.title,()=>navigate(group.id,item.id));}
  }
  if(selected){const detail=this.el(panel,'section',undefined,'bi-chat-map-detail');this.el(detail,'h3',selected.title);this.el(detail,'p',`${selected.kind==='branch'?'Offshoot':selected.kind}${selected.status?' · '+selected.status:''}${selected.proposal?' · AI suggestion; review required':''}`,'bi-muted');
   if(selected.needsReview)this.el(detail,'p','Review interpretation: '+(selected.reviewReason||'An uncertain interpretation needs checking against its source.'),'bi-caption');
   if(selected.summary)this.el(detail,'p',selected.summary,'bi-snapshot');if(selected.quote){this.el(detail,'h4','Exact saved excerpt');this.el(detail,'blockquote',selected.quote);}
   if(selected.nodeId)this.button(detail,'Open record and evidence',()=>this.open('Generated/Items/'+selected.nodeId));
   if(selected.url&&/^(https?:\/\/|file:\/\/)/i.test(selected.url)){const a=this.el(detail,'a','Open linked file / page ↗','external-link');a.href=selected.url;}
   this.el(detail,'h4','Backtrack to the source');
   if(!selected.sources?.length)this.el(detail,'p','The matching reply was not captured locally. The saved excerpt and original chat remain available; no missing reply has been invented.','bi-muted');
   for(const source of selected.sources||[]){const row=this.el(detail,'div',undefined,'bi-chat-source');this.button(row,new Date(source.at).toLocaleString()+' · Open saved reply',()=>this.open('Generated/'+source.logPath));this.el(row,'small',source.turnId?'Source turn: '+source.turnId:'Source turn ID unavailable');}
   if(selected.sourceTurn&&!selected.sources?.length)this.el(detail,'small','Referenced source turn: '+selected.sourceTurn,'bi-muted');
   if(this.data.provider==='codex'){const a=this.el(detail,'a','Open original chat ↗','external-link');a.href=`codex://threads/${this.sessionId}`;}
   if(selected.connections?.length){this.el(detail,'h4','Recorded connections within this chat');for(const link of selected.connections){const other=m.items.find(i=>i.id===link.id);if(other)this.button(detail,link.label+' · '+other.title,()=>navigate(m.groups.find(g=>g.itemIds.includes(other.id))?.id||null,other.id));}}
  }
 }

}
// These layouts retain every record. Group branches organise; only saved edges
// enter the dependency graph. Neither layout writes back to the project.
function explorerModel(data){
 const chat=!!data.sessionId,raw=chat?data.map.items:data.nodes;
 const nodes=raw.map(n=>({...n,detail:n.detail||n.summary||'',recordId:chat?n.nodeId:n.id,type:n.type||n.kind}));
 const ids=new Set(nodes.map(n=>n.id));
 const groups=(chat?data.map.groups:data.groups).map(g=>({...g,nodeIds:[...(g.nodeIds||g.itemIds)].filter(id=>ids.has(id))}));
 const grouped=new Set(groups.flatMap(g=>g.nodeIds)),remaining=nodes.filter(n=>!grouped.has(n.id));
 if(remaining.length)groups.push({id:'other',title:'Other saved records',nodeIds:remaining.map(n=>n.id)});
 const edges=(chat?data.map.edges||[]:data.edges).filter(e=>ids.has(e.from)&&ids.has(e.to));
 const linked=new Set(edges.flatMap(e=>[e.from,e.to]));
 return {title:chat?data.title:data.project.title,nodes,groups,edges,isolated:nodes.filter(n=>!linked.has(n.id))};
}
function explorerBox(n){
 const words=String(n.title||'Untitled').split(/\s+/),lines=[];let line='';
 for(const word of words){if(line&&(line+' '+word).length>31){lines.push(line);line='';}line+=(line?' ':'')+word;}
 if(line)lines.push(line);if(lines.length>4){lines.length=4;lines[3]=lines[3].slice(0,29)+'…';}
 return {...n,lines,width:250,height:Math.max(66,lines.length*18+(n.status?36:24))};
}
function explorerMindmap(model,expanded,query=''){
 const term=query.trim().toLowerCase(),byId=new Map(model.nodes.map(n=>[n.id,n]));
 const groups=model.groups.map(g=>({...g,nodeIds:g.nodeIds.filter(id=>!term||byId.get(id).title.toLowerCase().includes(term))})).filter(g=>g.nodeIds.length);
 const sides=[[],[]];groups.forEach((g,i)=>sides[i%2].push(g));
 const plans=sides.map(side=>side.map(g=>{const open=!!term||expanded.has(g.id),items=open?g.nodeIds.map(id=>explorerBox(byId.get(id))):[];return {g,open,items,height:Math.max(82,items.reduce((v,n)=>v+n.height+14,0)-14)};}));
 const height=Math.max(220,...plans.map(side=>side.reduce((v,g)=>v+g.height+40,0)))+60,boxes=[],links=[];
 const root={id:'explorer_root',title:model.title,lines:explorerBox({title:model.title}).lines,x:640,y:height/2-46,width:220,height:92,root:true};boxes.push(root);
 plans.forEach((side,i)=>{let y=(height-side.reduce((v,g)=>v+g.height+40,0))/2;
  for(const {g,open,items,height:h}of side){const group=explorerBox({id:'group_'+g.id,title:g.title+' · '+g.nodeIds.length,group:g.id,open});Object.assign(group,{x:i?924:326,y:y+h/2-group.height/2,width:240});boxes.push(group);links.push({from:root.id,to:group.id,category:true});
   let itemY=y;for(const n of items){Object.assign(n,{x:i?1210:30,y:itemY});boxes.push(n);links.push({from:group.id,to:n.id,category:true});itemY+=n.height+14;}y+=h+40;
  }
 });
 const left=Math.min(...boxes.map(n=>n.x))-30,right=Math.max(...boxes.map(n=>n.x+n.width))+30;for(const n of boxes)n.x-=left;
 return {boxes,links,width:right-left,height,shown:boxes.filter(n=>!n.root&&!n.group).length,total:model.nodes.filter(n=>!term||n.title.toLowerCase().includes(term)).length};
}
function explorerFlow(model,query='',focus=null){
 const term=query.trim().toLowerCase(),wanted=focus?new Set([focus,...model.edges.filter(e=>e.from===focus||e.to===focus).flatMap(e=>[e.from,e.to])]):null;
 const nodes=model.nodes.filter(n=>(!wanted||wanted.has(n.id))&&(!term||n.title.toLowerCase().includes(term))),ids=new Set(nodes.map(n=>n.id)),edges=model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 // Iterative strongly connected components keep cycles finite and place the
 // condensed dependency DAG from left to right. No edge is dropped for layout.
 const outgoing=new Map(nodes.map(n=>[n.id,[]])),incoming=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){outgoing.get(e.from).push(e.to);incoming.get(e.to).push(e.from);}
 const seen=new Set(),order=[];
 for(const n of nodes){if(seen.has(n.id))continue;seen.add(n.id);const stack=[[n.id,0]];while(stack.length){const top=stack.at(-1),next=outgoing.get(top[0]);if(top[1]<next.length){const id=next[top[1]++];if(!seen.has(id)){seen.add(id);stack.push([id,0]);}}else{order.push(top[0]);stack.pop();}}}
 const component=new Map();let count=0;
 for(const id of order.reverse()){if(component.has(id))continue;const stack=[id];component.set(id,count);while(stack.length)for(const previous of incoming.get(stack.pop()))if(!component.has(previous)){component.set(previous,count);stack.push(previous);}count++;}
 const next=Array.from({length:count},()=>new Set()),degree=Array(count).fill(0),rank=Array(count).fill(0);
 for(const e of edges){const a=component.get(e.from),b=component.get(e.to);if(a!==b&&!next[a].has(b)){next[a].add(b);degree[b]++;}}
 const queue=degree.flatMap((v,i)=>v?[]:[i]);for(let i=0;i<queue.length;i++)for(const b of next[queue[i]]){rank[b]=Math.max(rank[b],rank[queue[i]]+1);if(!--degree[b])queue.push(b);}
 const columns=new Map();for(const n of nodes){const col=rank[component.get(n.id)];if(!columns.has(col))columns.set(col,[]);columns.get(col).push(explorerBox(n));}
 const height=Math.max(180,...[...columns.values()].map(ns=>ns.reduce((v,n)=>v+n.height+26,0)))+140,boxes=[];
 for(const [col,ns]of columns){let y=(height-ns.reduce((v,n)=>v+n.height+26,0))/2;for(const n of ns){Object.assign(n,{x:30+col*360,y});boxes.push(n);y+=n.height+26;}}
 return {boxes,links:edges,width:Math.max(350,(Math.max(0,...columns.keys())+1)*360),height,shown:boxes.length,total:model.nodes.length,cycleEdges:edges.filter(e=>component.get(e.from)===component.get(e.to)).length};
}
class MapExplorer extends Dashboard{
 constructor(el,plugin,id,sourcePath,sessionId){super(el,plugin,id,sourcePath);this.sessionId=sessionId;this.mode='mindmap';this.query='';this.expanded=null;this.selected=null;this.connectionFocus=null;this.fullPage=true;}
 get path(){return `Generated/Interactive/${this.sessionId?'chat-'+this.id+'-'+this.sessionId:this.id}.json`;}
 draw(){
  const root=this.containerEl,d=this.data,m=explorerModel(d);this.model=m;this.mapObserver?.disconnect();this.svg=null;
  const activeId=root.ownerDocument.activeElement?.getAttribute('data-id');
  const old=root.querySelector('.bi-map-scroll'),offset=old?{left:old.scrollLeft,top:old.scrollTop}:null;
  root.replaceChildren();root.classList.add('bi-explorer');this.expanded??=new Set(m.nodes.length<=40?m.groups.map(g=>g.id):[]);
  const top=this.el(root,'div',undefined,'bi-top');this.el(top,'h1',m.title);this.el(top,'span',this.sessionId?'Full-page chat map':'Full-page project map','bi-muted');
  const nav=this.el(root,'nav',undefined,'bi-nav');this.button(nav,this.sessionId?'← Chat dashboard':'← Project dashboard',()=>this.open(this.sessionId?`Generated/Chats/${this.id}-${this.sessionId}`:`Generated/Dashboards/${this.id}`));this.button(nav,'Home',()=>this.open('Generated/Navigation/Home'));this.quickSwitch(nav);
  const tools=this.el(root,'div',undefined,'bi-explorer-tools');
  for(const [key,label]of [['mindmap','Mindmap'],['flow','Flow / dependencies']]){const b=this.button(tools,label,()=>{this.mode=key;this.zoom=1;this.fitAll=false;this.draw();});b.setAttribute('aria-pressed',String(this.mode===key));}
  if(this.mode==='mindmap'){this.button(tools,'Expand all',()=>{this.expanded=new Set(m.groups.map(g=>g.id));this.draw();});this.button(tools,'Collapse all',()=>{this.expanded.clear();this.draw();});}
  if(this.connectionFocus)this.button(tools,'Show whole map',()=>{this.connectionFocus=null;this.query='';this.draw();});
  const form=this.el(tools,'form'),input=this.el(form,'input');input.type='search';input.placeholder='Find a saved item…';input.setAttribute('aria-label','Find map items');input.value=this.query;const search=this.el(form,'button','Find');search.type='submit';form.addEventListener('submit',e=>{e.preventDefault();this.query=input.value;this.zoom=1;this.draw();});if(this.query)this.button(tools,'Clear search',()=>{this.query='';this.draw();});
  const diagnostics=this.el(root,'details',undefined,'bi-explorer-diagnostics');this.el(diagnostics,'summary',`${m.nodes.length} records · ${m.edges.length} saved connections · ${m.isolated.length} without connections`);
  this.el(diagnostics,'p','Unconnected records may be useful source material, or work waiting to be linked. Group branches organise the mindmap; they are not dependencies. AI suggestions remain unverified.','bi-muted');
  const isolated=this.el(diagnostics,'div',undefined,'bi-chips');for(const n of m.isolated)this.button(isolated,n.title,()=>{this.selected=n.id;this.query='';this.draw();});
  this.el(root,'p',this.mode==='mindmap'?'Click a branch to expand or collapse it. Select a record for its details and recorded connections.':'Arrows follow saved relationships. Dashed arrows add context. Select a record to trace its connections.','bi-explorer-guide');
  const layout=this.el(root,'div',undefined,'bi-explorer-layout'),panel=this.el(layout,'section',undefined,'bi-map bi-explorer-canvas');
  const zoom=this.el(panel,'div',undefined,'bi-tools');this.button(zoom,'−',()=>this.scale(-.2)).setAttribute('aria-label','Zoom full map out');this.button(zoom,'Fit whole map',()=>{this.zoom=1;this.readable=false;this.fitAll=true;this.scale(0);});this.button(zoom,'Readable size',()=>{this.zoom=1;this.readable=true;this.fitAll=false;this.scale(0);});this.button(zoom,'+',()=>this.scale(.2)).setAttribute('aria-label','Zoom full map in');
  const key=this.el(zoom,'div',undefined,'bi-key');for(const state of d.statusKey||[]){if(!m.nodes.some(n=>n.statusId===state.id))continue;const badge=this.el(key,'span',`${state.mark} ${state.label}`,'bi-badge');this.paintStatus(badge,state.id);badge.title=state.description;}
  const scroll=this.el(panel,'div',undefined,'bi-map-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Full map. Scroll horizontally or vertically to explore.');
  const plan=this.mode==='mindmap'?explorerMindmap(m,this.expanded,this.query):explorerFlow(m,this.query,this.connectionFocus);
  const svg=this.diagram(scroll,plan);this.svg=svg;this.scale(0);this.mapObserver=new ResizeObserver(()=>this.scale(0));this.mapObserver.observe(scroll);if(offset){scroll.scrollLeft=offset.left;scroll.scrollTop=offset.top;}
  if(activeId)[...svg.querySelectorAll('[data-id]')].find(n=>n.dataset.id===activeId)?.focus({preventScroll:true});
  this.el(panel,'p',`${plan.shown} of ${plan.total} ${this.query?'matching ':''}records visible${this.mode==='mindmap'?' · expand a branch to reveal its items':''}. Scroll in either direction; Readable size keeps labels larger.${plan.cycleEdges?' Cyclic connections share a column.':''}`,'bi-caption');
  if((!plan.shown&&!m.groups.length)||(this.query&&!plan.shown))this.el(panel,'p',this.query?'No matching saved items. Clear the search to return to the whole map.':'No saved records yet. Return to the dashboard to begin.','bi-muted');
  const n=m.nodes.find(n=>n.id===this.selected);
  if(n){const detail=this.el(layout,'aside',undefined,'bi-explorer-detail');const header=this.el(detail,'div',undefined,'bi-panel-head');this.el(header,'h2','Selected record');this.button(header,'Close',()=>{this.selected=null;this.draw();});this.el(detail,'h3',n.title);if(n.status)this.badge(detail,n);else this.el(detail,'small',n.type);if(n.detail)this.el(detail,'p',n.detail,'bi-snapshot');if(n.next)this.el(detail,'p','Next: '+n.next);if(n.quote)this.el(detail,'blockquote',n.quote);
   if(n.recordId)this.button(detail,'Open record & evidence',()=>this.open('Generated/Items/'+n.recordId));
   for(const source of n.sources||[])this.button(detail,'Open saved source · '+new Date(source.at).toLocaleString(),()=>this.open('Generated/'+source.logPath));
   if(n.url&&/^(https?:\/\/|file:\/\/)/i.test(n.url)){const a=this.el(detail,'a','Open linked file / page ↗');a.href=n.url;}
   const links=m.edges.filter(e=>e.from===n.id||e.to===n.id);this.el(detail,'h4',`${links.length} saved connections`);if(!links.length)this.el(detail,'p','No dependency or context connections recorded for this item.','bi-muted');
   for(const e of links){const other=m.nodes.find(x=>x.id===(e.from===n.id?e.to:e.from));this.button(detail,`${e.from===n.id?'→':'←'} ${this.edgeLabel(e)} · ${other.title}`,()=>{this.selected=other.id;this.draw();});}
   this.button(detail,'Focus connected records',()=>{this.mode='flow';this.query='';this.connectionFocus=n.id;this.draw();});
  }
 }
 edgeLabel(e){return ({depends_on:'Must precede',branches_from:'Offshoot',implements:'Goal to work',informs:'Context'})[e.type]||e.type||'Recorded connection';}
 diagram(parent,plan){
  const doc=parent.ownerDocument,ns='http://www.w3.org/2000/svg',make=(tag,attrs={},text)=>{const n=doc.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;},svg=make('svg',{viewBox:`0 0 ${plan.width} ${plan.height}`,role:'group','aria-label':this.mode==='mindmap'?'Expandable mindmap':'Recorded dependency map'});parent.append(svg);
  const defs=make('defs'),marker=make('marker',{id:'bi-explorer-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(make('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'var(--bi-muted)'}));defs.append(marker);svg.append(defs);
  const boxes=new Map(plan.boxes.map(n=>[n.id,n]));
  for(const e of plan.links){const a=boxes.get(e.from),b=boxes.get(e.to);if(!a||!b)continue;const right=b.x>a.x,x=a.x+(right?a.width:0),end=b.x+(right?0:b.width),y=a.y+a.height/2,ey=b.y+b.height/2,bend=a.x===b.x?x-70:(x+end)/2;
   const curve=e.from===e.to?`M ${a.x+a.width-25} ${a.y} C ${a.x+a.width+70} ${a.y-60}, ${a.x+a.width+70} ${a.y+20}, ${a.x+a.width} ${a.y+25}`:`M ${x} ${y} C ${bend} ${y}, ${bend} ${ey}, ${end} ${ey}`;
   const path=make('path',{d:curve,fill:'none',stroke:'var(--bi-muted)','stroke-width':1.6,...(e.category?{}:{'marker-end':'url(#bi-explorer-arrow)'}),...(e.type==='informs'?{'stroke-dasharray':'6 5'}:{})});path.append(make('title',{},e.category?'Mindmap grouping':this.edgeLabel(e)));svg.append(path);
   if(!e.category&&plan.links.length<=24&&a.x!==b.x){const text=make('text',{x:(x+end)/2,y:(y+ey)/2-7,'text-anchor':'middle','font-size':11,fill:'var(--bi-muted)',class:'bi-edge-caption'},this.edgeLabel(e));svg.append(text);}
  }
  for(const n of plan.boxes){const group=make('g',{class:'pele-node bi-explorer-node'+(n.id===this.selected?' is-selected':''),'data-id':n.id,transform:`translate(${n.x},${n.y})`});if(n.group)group.dataset.category=n.group;
   group.append(make('title',{},n.title));group.append(make('rect',{width:n.width,height:n.height,rx:n.root?32:10}));
   const y=n.status?22:((n.height-(n.lines.length-1)*18)/2+5);n.lines.forEach((line,i)=>group.append(make('text',{x:n.width/2,y:y+i*18,'text-anchor':'middle','font-size':15},line)));
   if(n.status)group.append(make('text',{x:n.width/2,y:n.height-13,'text-anchor':'middle','font-size':11},`${n.proposal?'AI suggestion · ':''}${n.status}`));
   if(n.group){group.append(make('text',{x:n.width-15,y:18,'text-anchor':'middle','font-size':16},n.open?'−':'+'));group.setAttribute('aria-expanded',String(n.open));}
   if(n.statusId)this.paintStatus(group,n.statusId);
   if(!n.root){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',n.title+(n.status?' · '+n.status:''));const action=()=>{if(n.group){if(this.expanded.has(n.group))this.expanded.delete(n.group);else this.expanded.add(n.group);}else this.selected=n.id;this.draw();if(!n.group)this.containerEl.querySelector('.bi-explorer-detail')?.scrollIntoView({block:'nearest',behavior:'smooth'});};group.addEventListener('click',action);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}});}
   svg.append(group);
  }
  return svg;
 }
}

class BranchaInteractive extends Plugin{
 onload(){this.registerMarkdownCodeBlockProcessor('brancha-map',(source,el,ctx)=>{const [id,sessionId]=source.trim().split(/\r?\n/).map(s=>s.trim());if(!valid(id)||sessionId&&!valid(sessionId)){el.textContent='Invalid map ID';return;}ctx.addChild(new MapExplorer(el,this,id,ctx.sourcePath,sessionId));});
  this.registerMarkdownCodeBlockProcessor('brancha-interactive',(source,el,ctx)=>{const id=source.trim();if(!valid(id)){el.textContent='Invalid Branchi project ID';return;}ctx.addChild(new Dashboard(el,this,id,ctx.sourcePath));});
  this.registerMarkdownCodeBlockProcessor('brancha-timeline',(source,el,ctx)=>{const [id,sessionId]=source.trim().split(/\r?\n/).map(s=>s.trim());if(!valid(id)||sessionId&&!valid(sessionId)){el.textContent='Invalid timeline ID';return;}ctx.addChild(new Dashboard(el,this,id,ctx.sourcePath,{timelineOnly:true,sessionId}));});
  this.registerMarkdownCodeBlockProcessor('brancha-home',(_source,el,ctx)=>ctx.addChild(new Home(el,this,ctx.sourcePath)));
  this.registerMarkdownCodeBlockProcessor('brancha-chats',(_source,el,ctx)=>ctx.addChild(new Home(el,this,ctx.sourcePath,{chatsOnly:true})));
  this.registerMarkdownCodeBlockProcessor('brancha-chat',(source,el,ctx)=>{const [id,sessionId]=source.trim().split(/\r?\n/).map(s=>s.trim());if(!valid(id)||!valid(sessionId)){el.textContent='Invalid chat ID';return;}ctx.addChild(new Chat(el,this,id,sessionId,ctx.sourcePath));});
  const home=()=>new Dashboard(document.createElement('div'),this,'home','').open('Generated/Navigation/Home');
  this.addCommand({id:'open-home',name:'Open Branchi Home',callback:home});this.addRibbonIcon('house','Branchi Home',home);}
}
if(typeof module!=='undefined'){module.exports=BranchaInteractive;module.exports.safeSvg=safeSvg;module.exports.mapSize=mapSize;module.exports.renderers={Dashboard,Home,Chat,MapExplorer};module.exports.explorer={model:explorerModel,mindmap:explorerMindmap,flow:explorerFlow};}
else globalThis.BranchaRenderers={Dashboard,Home,Chat,MapExplorer,safeSvg};
